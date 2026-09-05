import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createRankedPrivateMapRecord,
  round5WorldLocation,
  type InfiniteStellarDeployment,
  type PlayerSeatBundle,
  type RankedKnownUniverseProjection,
  type RankedMapIdentity,
  type RankedProjectionClient,
} from '@infinite-stellar/game-sdk';
import { useRankedMap, type RankedMapDependencies } from './use-ranked-map';
import { ROUND5_RULES_GEOMETRY, createRulesGeometryCommitment } from '@infinite-stellar/prover';
import { EncryptedRankedMapVault, MemoryRankedMapVaultStore } from './ranked-map-vault';
import type { MinerResult } from './miner-client';

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
    return { deps, cancel, finish: (value: MinerResult) => finish(value) };
  }

  function minedResult(): MinerResult {
    const location = round5WorldLocation({ x: 73, y: 6421 })!;
    return { checked: 4096, total: 4096, found: 1, elapsedMs: 100, locations: [{
      x: location.x, y: location.y, locationId: location.locationId, perlin: location.perlin, biomebase: location.biomebase,
    }] };
  }

  it('validates, encrypts and point-reads discoveries after refresh without claiming ownership', async () => {
    const currentSeat = seat('31');
    const fixture = miningDependencies();
    const { result } = renderHook(() => useRankedMap(CLIENT, DEPLOYMENT, CHAIN, currentSeat, fixture.deps));
    await waitFor(() => expect(result.current.snapshot.canMine).toBe(true));
    act(() => result.current.mine({ x: 73, y: 6421 }));
    expect(fixture.deps.startMiner).toHaveBeenCalledWith(
      [{ index: 0, x: 41, y: 6389, side: 64 }], expect.any(Function),
      expect.objectContaining({ rulesGeometryCommitment: createRulesGeometryCommitment(ROUND5_RULES_GEOMETRY) }),
    );
    act(() => fixture.finish(minedResult()));
    await waitFor(() => expect(result.current.snapshot.map?.planets).toHaveLength(1));
    expect(result.current.snapshot.map?.planets[0]).toMatchObject({ materialized: false, owner: 'neutral' });
    expect((await fixture.deps.vault.restore(identity(currentSeat)))?.locations).toHaveLength(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.snapshot.map?.planets).toHaveLength(1));
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
