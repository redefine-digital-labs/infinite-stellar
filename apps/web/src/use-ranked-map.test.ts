import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createRankedPrivateMapRecord,
  appendRankedPrivateLocations,
  deriveRankedPlanetObjectId,
  nextExplorationBatch,
  exploredChunkArea,
  round5WorldLocation,
  type InfiniteStellarDeployment,
  type PlayerSeatBundle,
  type RankedKnownUniverseProjection,
  type RankedMapIdentity,
  type RankedProjectionClient,
  type PlanetProjection,
} from '@infinite-stellar/game-sdk';
import { useRankedMap, type RankedMapDependencies } from './use-ranked-map';
import { ROUND5_RULES_GEOMETRY, createRulesGeometryCommitment } from '@infinite-stellar/prover';
import { EncryptedRankedMapVault, MemoryRankedMapVaultStore } from './ranked-map-vault';
import type { MinerResult } from './miner-client';
import { encryptRankedMapBackup, decryptRankedMapBackup } from './ranked-map-backup';

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;
const CHAIN = '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S';
const CLIENT = {} as RankedProjectionClient;
const DEPLOYMENT: InfiniteStellarDeployment = {
  network: 'mainnet',
  packageId: id('10'),
  manifestId: id('11'),
  runtimeId: id('12'),
  enrollmentRegistryId: id('13'),
  planetRegistryId: id('14'),
  seatRouting: { keyTypeOriginPackageId: id('15'), keyEncodingVersion: 1, league: 1 },
  productionSoulAdapterReady: false,
  productionProofVerifierReady: false,
};

function seat(suffix: string): PlayerSeatBundle {
  return {
    status: 'enrolled',
    seatId: id(suffix),
    seat: { controller: id('77'), seasonId: DEPLOYMENT.manifestId },
    civilization: { initialHomePlanetId: null },
  } as PlayerSeatBundle;
}

function identity(currentSeat: PlayerSeatBundle): RankedMapIdentity {
  return {
    schemaVersion: 1,
    network: 'mainnet',
    chainIdentifier: CHAIN,
    packageId: DEPLOYMENT.packageId!,
    typeOriginPackageId: DEPLOYMENT.seatRouting!.keyTypeOriginPackageId,
    seasonId: DEPLOYMENT.manifestId!,
    planetRegistryId: DEPLOYMENT.planetRegistryId!,
    seatId: currentSeat.seatId,
    controllerAddress: currentSeat.seat.controller,
  };
}

function projection(): RankedKnownUniverseProjection {
  return {
    coverage: 'known-private-locations',
    manifest: { objectId: DEPLOYMENT.manifestId, planetRegistryId: DEPLOYMENT.planetRegistryId, worldRadius: 10_000n },
    runtime: { seasonId: DEPLOYMENT.manifestId },
    planets: [],
    voyages: [],
    maxEventCheckpoint: null,
    scannedEvents: 0,
    snapshotFingerprint: 'a'.repeat(64),
    requestedPlanetIds: [],
    missingPlanetIds: [],
  } as unknown as RankedKnownUniverseProjection;
}

function dependencies(currentSeat: PlayerSeatBundle): RankedMapDependencies {
  return {
    vault: {
      protection: 'memory-aes-gcm',
      restore: vi.fn().mockResolvedValue(createRankedPrivateMapRecord(identity(currentSeat))),
      save: vi.fn(),
      clear: vi.fn(),
    },
    readKnownProjection: vi.fn().mockResolvedValue(projection()),
  };
}

describe('ranked private map hook', () => {
  it('does not touch the private vault before a pinned deployment and Seat exist', () => {
    const currentSeat = seat('31');
    const deps = dependencies(currentSeat);
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, undefined, deps));
    expect(result.current.snapshot.phase).toBe('disabled');
    expect(deps.vault.restore).not.toHaveBeenCalled();
  });

  it('restores the exact namespace and loads a point-read map without event replay', async () => {
    const currentSeat = seat('31');
    const deps = dependencies(currentSeat);
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, deps));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    expect(deps.vault.restore).toHaveBeenCalledWith(identity(currentSeat));
    expect(deps.readKnownProjection).toHaveBeenCalledWith(
      CLIENT,
      DEPLOYMENT,
      [],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.snapshot.map).toMatchObject({
      planets: [], voyages: [], snapshotFingerprint: 'a'.repeat(64),
    });
  });

  it('retries a rejected vault read without changing the Seat', async () => {
    const currentSeat = seat('31');
    const deps = dependencies(currentSeat);
    vi.mocked(deps.vault.restore)
      .mockRejectedValueOnce(new Error('vault locked'))
      .mockResolvedValueOnce(createRankedPrivateMapRecord(identity(currentSeat)));
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, deps));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('error'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    expect(deps.vault.restore).toHaveBeenCalledTimes(2);
  });

  function miningDependencies() {
    const chain = projection();
    Object.assign(chain.manifest, ROUND5_RULES_GEOMETRY, {
      homePerlinMin: 13n, homePerlinMax: 14n,
      rulesGeometryCommitment: createRulesGeometryCommitment(ROUND5_RULES_GEOMETRY),
    });
    Object.assign(chain.runtime, { universeOpened: true, cancelled: false, settlementStarted: false });
    const vault = new EncryptedRankedMapVault(new MemoryRankedMapVaultStore(), crypto, 'memory-aes-gcm');
    let finish!: (result: MinerResult) => void;
    const cancel = vi.fn();
    const deps: RankedMapDependencies = {
      vault,
      readKnownProjection: vi.fn().mockResolvedValue(chain),
      startMiner: vi.fn(() => ({ requestId: 'fixture', result: new Promise<MinerResult>((resolve) => { finish = resolve; }), cancel })),
    };
    return { deps, cancel, chain, finish: (value: MinerResult) => finish(value) };
  }

  function minedResult(): MinerResult {
    const location = round5WorldLocation({ x: 73, y: 6421 })!;
    return { checked: 1024, total: 1024, found: 1, elapsedMs: 100, locations: [{
      x: location.x, y: location.y, locationId: location.locationId, perlin: location.perlin, biomebase: location.biomebase,
    }] };
  }

  function recoveryRecord(currentSeat: PlayerSeatBundle) {
    return { ...appendRankedPrivateLocations(createRankedPrivateMapRecord(identity(currentSeat)),
      minedResult().locations.map((location) => ({ ...location, discoveredAtMs: 100 })), 100),
      exploredChunks: [{ x: 64, y: 6416, side: 16 }], explorationOrigin: { x: 73, y: 6421 } };
  }

  it('exports a real authenticated backup and never sends private preimages to the projection reader', async () => {
    const currentSeat = seat('31');
    const fixture = miningDependencies();
    const record = recoveryRecord(currentSeat);
    await fixture.deps.vault.save(record);
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    let contents!: string;
    await act(async () => { contents = (await result.current.exportBackup('test-only recovery passphrase')).contents; });
    expect(await decryptRankedMapBackup(contents, 'test-only recovery passphrase', identity(currentSeat))).toEqual(record);
    expect(fixture.deps.readKnownProjection).toHaveBeenCalledWith(CLIENT, DEPLOYMENT,
      [deriveRankedPlanetObjectId(identity(currentSeat), record.locations[0]!.locationId)], expect.any(Object));
    expect(result.current.backup.phase).toBe('complete');
  });

  it('merges a portable backup but gets ownership and energy from the current chain read', async () => {
    const currentSeat = seat('31');
    const fixture = miningDependencies();
    const record = recoveryRecord(currentSeat);
    await fixture.deps.vault.save({ ...createRankedPrivateMapRecord(identity(currentSeat)),
      exploredChunks: [{ x: 0, y: 0, side: 16 }] });
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    const locationId = record.locations[0]!.locationId;
    const objectId = deriveRankedPlanetObjectId(identity(currentSeat), locationId);
    const chainPlanet = { objectId, locationHash: BigInt(`0x${locationId}`),
      locationCommitment: Uint8Array.from({ length: 32 }, (_, index) => Number.parseInt(locationId.slice(index * 2, index * 2 + 2), 16)),
      ownerSeatId: id('99'), energy: 777n, rulesetVersion: 1n, planetType: 0, spaceType: 0, artifactIds: [],
    } as unknown as PlanetProjection;
    vi.mocked(fixture.deps.readKnownProjection).mockResolvedValue({ ...fixture.chain, planets: [chainPlanet] });
    const raw = await encryptRankedMapBackup(record, 'test-only recovery passphrase');
    await act(async () => { await result.current.importBackup(raw, 'test-only recovery passphrase'); });
    await waitFor(() => expect(result.current.snapshot.map?.planets).toHaveLength(1));
    expect(result.current.snapshot.map?.planets[0]).toMatchObject({ materialized: true, owner: 'rival', energy: 777n });
    expect(exploredChunkArea((await fixture.deps.vault.restore(identity(currentSeat)))!.exploredChunks!)).toBe(512);
  });

  it.each(['password', 'geometry', 'projection', 'vault'] as const)(
    'preserves the existing map when recovery fails at %s', async (failure) => {
    const currentSeat = seat('31');
    const fixture = miningDependencies();
    const original = { ...createRankedPrivateMapRecord(identity(currentSeat)), exploredChunks: [{ x: 0, y: 0, side: 16 }] };
    await fixture.deps.vault.save(original);
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    const imported = recoveryRecord(currentSeat);
    if (failure === 'geometry') imported.locations[0]!.x += 1;
    const raw = await encryptRankedMapBackup(imported, 'test-only recovery passphrase');
    const save = vi.spyOn(fixture.deps.vault, 'save');
    if (failure === 'projection') vi.mocked(fixture.deps.readKnownProjection).mockRejectedValue(new Error('RPC unavailable'));
    if (failure === 'vault') save.mockRejectedValue(new Error('Storage unavailable'));
    await act(async () => {
      await expect(result.current.importBackup(raw, failure === 'password' ? 'test-only incorrect password' : 'test-only recovery passphrase')).rejects.toThrow();
    });
    expect(await fixture.deps.vault.restore(identity(currentSeat))).toEqual(original);
    expect(result.current.snapshot.map?.planets).toHaveLength(0);
    expect(result.current.backup.phase).toBe('error');
    if (failure !== 'vault') expect(save).not.toHaveBeenCalled();
  });

  it('does not save a late decrypted backup after the active Seat changes', async () => {
    const firstSeat = seat('31');
    const secondSeat = seat('32');
    const fixture = miningDependencies();
    let finish!: (record: ReturnType<typeof recoveryRecord>) => void;
    fixture.deps.decryptBackup = vi.fn(() => new Promise<ReturnType<typeof recoveryRecord>>((resolve) => { finish = resolve; }));
    const save = vi.spyOn(fixture.deps.vault, 'save');
    const { result, rerender } = renderHook(({ currentSeat }) =>
      useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps), { initialProps: { currentSeat: firstSeat } });
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    let pending!: Promise<void>;
    act(() => { pending = result.current.importBackup('pending-file', 'test-only recovery passphrase'); });
    const rejected = expect(pending).rejects.toThrow(/Seat changed/);
    rerender({ currentSeat: secondSeat });
    await waitFor(() => expect(result.current.snapshot.seatId).toBe(secondSeat.seatId));
    await act(async () => { finish(recoveryRecord(firstSeat)); await rejected; });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.snapshot.map?.planets).toHaveLength(0);
  });

  it('refuses to restore a founding Planet until its canonical chain object is present', async () => {
    const currentSeat = seat('31');
    const record = recoveryRecord(currentSeat);
    currentSeat.civilization.initialHomePlanetId = deriveRankedPlanetObjectId(identity(currentSeat), record.locations[0]!.locationId);
    const fixture = miningDependencies();
    const save = vi.spyOn(fixture.deps.vault, 'save');
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    const raw = await encryptRankedMapBackup(record, 'test-only recovery passphrase');
    await act(async () => { await expect(result.current.importBackup(raw, 'test-only recovery passphrase')).rejects.toThrow(/founding Planet/); });
    expect(save).not.toHaveBeenCalled();
  });

  it('validates, encrypts and point-reads discoveries after refresh without claiming ownership', async () => {
    const currentSeat = seat('31');
    const fixture = miningDependencies();
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.canMine).toBe(true));
    act(() => result.current.mine({ x: 73, y: 6421 }));
    expect(fixture.deps.startMiner).toHaveBeenCalledWith(
      nextExplorationBatch({ x: 73, y: 6421 }, 12000, []).chunks, expect.any(Function),
      expect.objectContaining({ rulesGeometryCommitment: createRulesGeometryCommitment(ROUND5_RULES_GEOMETRY) }),
    );
    act(() => fixture.finish(minedResult()));
    await waitFor(() => expect(result.current.snapshot.map?.planets).toHaveLength(1));
    expect(result.current.snapshot.map?.planets[0]).toMatchObject({ materialized: false, owner: 'neutral' });
    expect((await fixture.deps.vault.restore(identity(currentSeat)))?.locations).toHaveLength(1);
    await waitFor(() => expect(fixture.deps.startMiner).toHaveBeenCalledTimes(2));
    const stored = await fixture.deps.vault.restore(identity(currentSeat));
    expect(exploredChunkArea(stored?.exploredChunks ?? [])).toBe(1024);
    act(() => result.current.cancelMining());
    expect(result.current.mining.phase).toBe('cancelled');
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.snapshot.map?.planets).toHaveLength(1));
  });

  it('persists empty completed chunks and resumes without repeating them', async () => {
    const currentSeat = seat('31');
    const fixture = miningDependencies();
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.canMine).toBe(true));
    act(() => result.current.mine({ x: 73, y: 6421 }));
    act(() => fixture.finish({ ...minedResult(), found: 0, locations: [] }));
    await waitFor(() => expect(fixture.deps.startMiner).toHaveBeenCalledTimes(2));
    act(() => result.current.cancelMining());
    const stored = await fixture.deps.vault.restore(identity(currentSeat));
    expect(stored?.locations).toHaveLength(0);
    expect(exploredChunkArea(stored?.exploredChunks ?? [])).toBe(1024);
    const expected = nextExplorationBatch({ x: 73, y: 6421 }, 12000, stored!.exploredChunks!).chunks;
    act(() => result.current.mine({ x: 73, y: 6421 }));
    expect(fixture.deps.startMiner).toHaveBeenLastCalledWith(expected, expect.any(Function), expect.any(Object));
    act(() => result.current.cancelMining());
  });

  it.each(['hash', 'scope'] as const)('rejects Worker %s substitution before saving', async (kind) => {
    const currentSeat = seat('31');
    const fixture = miningDependencies();
    const save = vi.spyOn(fixture.deps.vault, 'save');
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.canMine).toBe(true));
    act(() => result.current.mine({ x: 73, y: 6421 }));
    const forged = minedResult();
    if (kind === 'hash') forged.locations[0]!.locationId = '0'.repeat(64);
    else forged.locations[0]!.x = 0;
    act(() => fixture.finish(forged));
    await waitFor(() => expect(result.current.mining.phase).toBe('error'));
    expect(save).not.toHaveBeenCalled();
  });

  it('stops continuous exploration and disables restart after a closed-season chain read', async () => {
    const fixture = miningDependencies();
    const currentSeat = seat('31');
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.canMine).toBe(true));
    act(() => result.current.mine({ x: 73, y: 6421 }));
    vi.mocked(fixture.deps.readKnownProjection).mockResolvedValue({ ...fixture.chain,
      runtime: { ...fixture.chain.runtime, settlementStarted: true } });
    act(() => fixture.finish(minedResult()));
    await waitFor(() => expect(result.current.snapshot.canMine).toBe(false));
    expect(result.current.snapshot.miningBlocker).toMatch(/closed/);
    expect(result.current.mining.phase).toBe('error');
    act(() => result.current.mine({ x: 73, y: 6421 }));
    expect(fixture.deps.startMiner).toHaveBeenCalledTimes(1);
    expect(result.current.snapshot.map?.planets).toHaveLength(1);
  });

  it('cancels old Seat work and ignores results even when its Worker completes late', async () => {
    const firstSeat = seat('31');
    const secondSeat = seat('32');
    const fixture = miningDependencies();
    const save = vi.spyOn(fixture.deps.vault, 'save');
    const { result, rerender } = renderHook(({ currentSeat }) =>
      useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps), { initialProps: { currentSeat: firstSeat } });
    await waitFor(() => expect(result.current.snapshot.canMine).toBe(true));
    act(() => result.current.mine({ x: 73, y: 6421 }));
    rerender({ currentSeat: secondSeat });
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    act(() => fixture.finish(minedResult()));
    await act(async () => { await Promise.resolve(); });
    expect(fixture.cancel).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(result.current.snapshot.seatId).toBe(secondSeat.seatId);
  });

  it('does not discard a readable map when mining parameters are unavailable', async () => {
    const currentSeat = seat('31');
    const deps = dependencies(currentSeat);
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, deps));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    expect(result.current.snapshot.canMine).toBe(false);
    expect(result.current.snapshot.miningBlocker).toMatch(/not open/);
  });
});
