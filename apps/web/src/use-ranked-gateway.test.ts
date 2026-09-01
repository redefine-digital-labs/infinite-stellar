import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  CanonicalSoul,
  InfiniteStellarDeployment,
  PlayerSeatBundle,
  SoulidityReadClient,
} from '@infinite-stellar/game-sdk';
import { MAINNET_DEPLOYMENT, SOULIDITY_MAINNET_PIN } from './deployment';
import {
  loadRankedGatewaySnapshot,
  useRankedGateway,
  type RankedGatewayDependencies,
} from './use-ranked-gateway';

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;
const CONTROLLER_A = id('a1');
const CONTROLLER_B = id('b1');
const CLIENT = {} as SoulidityReadClient;

function soul(owner: string, suffix: string): CanonicalSoul {
  return {
    soulId: id(`${suffix}1`),
    stateId: id(`${suffix}2`),
    name: `Soul ${suffix}`,
    description: 'Canonical fixture',
    imageUrl: '',
    provenanceKind: 0,
    originRef: null,
    creator: id('01'),
    currentOwner: owner,
    currentKioskId: id('02'),
    ownershipEpoch: 3n,
    listed: false,
    stateObjectVersion: '1',
    stateObjectDigest: 'digest',
    soulObjectVersion: '1',
    soulObjectDigest: 'digest',
  };
}

function enrolledSeat(controller: string): PlayerSeatBundle {
  return {
    status: 'enrolled',
    seatId: id('30'),
    seat: {
      objectId: id('30'), version: '1', digest: 'digest', previousTransaction: null,
      seasonId: id('31'), league: 1, controller, soulId: id('32'),
      projectionId: id('33'), civilizationId: id('34'), scoreCardId: id('35'),
    },
    projection: {
      objectId: id('33'), version: '1', digest: 'digest', previousTransaction: null,
      soulidityPackageId: id('36'), soulStateId: id('37'), soulId: id('32'),
      controllerAtEnrollment: controller, ownershipEpochAtEnrollment: 1n,
      projectionCommitment: new Uint8Array(32),
    },
    civilization: {
      objectId: id('34'), version: '1', digest: 'digest', previousTransaction: null,
      lifecycle: 'Active', controlledPlanetCount: 1n, pendingVoyageCount: 0n,
      spaceJunk: 0n, spaceJunkLimit: 1_000n, shipsClaimed: false,
      lastRevealAtSeconds: null, initialHomePlanetId: id('38'),
      homeClaimConsumed: true, activatedOnce: true,
    },
    scoreCard: {
      objectId: id('35'), version: '1', digest: 'digest', previousTransaction: null,
      score: 0n, pendingScoredArrivalCount: 0n,
    },
  };
}

function seatReadableDeployment(): InfiniteStellarDeployment {
  return {
    ...MAINNET_DEPLOYMENT,
    packageId: id('40'),
    manifestId: id('41'),
    enrollmentRegistryId: id('42'),
    seatRouting: {
      keyTypeOriginPackageId: id('40'),
      keyEncodingVersion: 1,
      league: 1,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('ranked wallet gateway', () => {
  it('resolves an existing controller Seat before scanning current Soul ownership', async () => {
    const readSeat = vi.fn(async () => enrolledSeat(CONTROLLER_A));
    const discoverSouls = vi.fn();
    const snapshot = await loadRankedGatewaySnapshot(
      CLIENT,
      CONTROLLER_A,
      seatReadableDeployment(),
      SOULIDITY_MAINNET_PIN,
      { readSeat, discoverSouls } as RankedGatewayDependencies,
    );

    expect(readSeat).toHaveBeenCalledOnce();
    expect(discoverSouls).not.toHaveBeenCalled();
    expect(snapshot.seat?.seat.controller).toBe(CONTROLLER_A);
    expect(snapshot.blockers).toContain('GAME_DEPLOYMENT_MISSING');
    expect(snapshot.writesReady).toBe(false);
  });

  it('shows chain-validated Souls while preserving every unavailable release gate', async () => {
    const canonicalSoul = soul(CONTROLLER_A, 'a');
    const snapshot = await loadRankedGatewaySnapshot(
      CLIENT,
      CONTROLLER_A,
      MAINNET_DEPLOYMENT,
      SOULIDITY_MAINNET_PIN,
      {
        readSeat: vi.fn(),
        discoverSouls: vi.fn(async () => ({
          souls: [canonicalSoul],
          complete: true,
          scannedEvents: 1,
          discoveredStateIds: 1,
          nextCursor: null,
        })),
      },
    );

    expect(snapshot.souls).toEqual([canonicalSoul]);
    expect(snapshot.blockers).toEqual([
      'GAME_DEPLOYMENT_MISSING',
      'SOUL_ADAPTER_CLOSED',
      'PROOF_VERIFIER_CLOSED',
      'RELEASE_EVIDENCE_MISSING',
    ]);
    expect(snapshot.writesReady).toBe(false);
  });

  it('does not let a stale wallet response overwrite the current controller', async () => {
    const first = deferred<{
      souls: CanonicalSoul[];
      complete: boolean;
      scannedEvents: number;
      discoveredStateIds: number;
      nextCursor: null;
    }>();
    const second = deferred<{
      souls: CanonicalSoul[];
      complete: boolean;
      scannedEvents: number;
      discoveredStateIds: number;
      nextCursor: null;
    }>();
    const discoverSouls = vi.fn((_client, _pin, owner: string) =>
      owner === CONTROLLER_A ? first.promise : second.promise);
    const dependencies = { readSeat: vi.fn(), discoverSouls } as RankedGatewayDependencies;
    const { result, rerender } = renderHook(
      ({ controller }) => useRankedGateway(
        CLIENT,
        controller,
        MAINNET_DEPLOYMENT,
        SOULIDITY_MAINNET_PIN,
        dependencies,
      ),
      { initialProps: { controller: CONTROLLER_A as string | undefined } },
    );

    rerender({ controller: CONTROLLER_B });
    await act(async () => second.resolve({
      souls: [soul(CONTROLLER_B, 'b')], complete: true, scannedEvents: 1,
      discoveredStateIds: 1, nextCursor: null,
    }));
    await waitFor(() => expect(result.current.snapshot.controller).toBe(CONTROLLER_B));
    await act(async () => first.resolve({
      souls: [soul(CONTROLLER_A, 'a')], complete: true, scannedEvents: 1,
      discoveredStateIds: 1, nextCursor: null,
    }));
    expect(result.current.snapshot.controller).toBe(CONTROLLER_B);
    expect(result.current.snapshot.souls[0]?.currentOwner).toBe(CONTROLLER_B);
  });

  it('retries a failed chain read without changing wallet identity', async () => {
    const discoverSouls = vi.fn()
      .mockRejectedValueOnce(new Error('temporary mainnet RPC failure'))
      .mockResolvedValueOnce({
        souls: [], complete: true, scannedEvents: 0, discoveredStateIds: 0, nextCursor: null,
      });
    const dependencies = { readSeat: vi.fn(), discoverSouls } as RankedGatewayDependencies;
    const { result } = renderHook(() => useRankedGateway(
      CLIENT,
      CONTROLLER_A,
      MAINNET_DEPLOYMENT,
      SOULIDITY_MAINNET_PIN,
      dependencies,
    ));

    await waitFor(() => expect(result.current.snapshot.phase).toBe('error'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    expect(result.current.snapshot.controller).toBe(CONTROLLER_A);
    expect(result.current.snapshot.blockers).toContain('NO_ELIGIBLE_SOUL');
  });
});
