import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createRankedPrivateMapRecord,
  type InfiniteStellarDeployment,
  type PlayerSeatBundle,
  type RankedKnownUniverseProjection,
  type RankedMapIdentity,
  type RankedProjectionClient,
} from '@infinite-stellar/game-sdk';
import { useRankedMap, type RankedMapDependencies } from './use-ranked-map';

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
});
