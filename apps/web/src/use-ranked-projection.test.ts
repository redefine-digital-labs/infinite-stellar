import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  InfiniteStellarDeployment,
  PlayerSeatBundle,
  RankedProjectionClient,
  RankedUniverseProjection,
} from '@infinite-stellar/game-sdk';
import { useRankedProjection, type RankedProjectionDependencies } from './use-ranked-projection';

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;
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
  return { status: 'enrolled', seatId: id(suffix) } as PlayerSeatBundle;
}

function projection(marker: string): RankedUniverseProjection {
  return {
    planets: [], voyages: [], scannedEvents: 0, maxEventCheckpoint: '42',
    snapshotFingerprint: marker.padEnd(64, '0'),
  } as unknown as RankedUniverseProjection;
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

describe('ranked universe projection hook', () => {
  it('does not scan the universe before an existing chain Seat and deployment are present', () => {
    const readProjection = vi.fn();
    const { result } = renderHook(() => useRankedProjection(
      CLIENT,
      DEPLOYMENT,
      undefined,
      { readProjection } as RankedProjectionDependencies,
    ));
    expect(result.current.snapshot.phase).toBe('disabled');
    expect(readProjection).not.toHaveBeenCalled();
  });

  it('does not let an old Seat projection overwrite a newer Seat route', async () => {
    const first = deferred<RankedUniverseProjection>();
    const second = deferred<RankedUniverseProjection>();
    const seatA = seat('a1');
    const seatB = seat('b1');
    const readProjection = vi.fn((_client, _deployment, options: { signal?: AbortSignal }) =>
      options.signal?.aborted ? Promise.reject(new DOMException('Aborted', 'AbortError'))
        : readProjection.mock.calls.length === 1 ? first.promise : second.promise);
    const dependencies = { readProjection } as RankedProjectionDependencies;
    const { result, rerender } = renderHook(
      ({ currentSeat }) => useRankedProjection(CLIENT, DEPLOYMENT, currentSeat, dependencies),
      { initialProps: { currentSeat: seatA } },
    );

    rerender({ currentSeat: seatB });
    await act(async () => second.resolve(projection('b')));
    await waitFor(() => expect(result.current.snapshot.seatId).toBe(seatB.seatId));
    await act(async () => first.resolve(projection('a')));
    expect(result.current.snapshot.projection?.snapshotFingerprint.startsWith('b')).toBe(true);
  });

  it('retries a rejected projection without changing the Seat', async () => {
    const currentSeat = seat('c1');
    const readProjection = vi.fn()
      .mockRejectedValueOnce(new Error('checkpoint race'))
      .mockResolvedValueOnce(projection('c'));
    const dependencies = { readProjection } as RankedProjectionDependencies;
    const { result } = renderHook(() => useRankedProjection(
      CLIENT,
      DEPLOYMENT,
      currentSeat,
      dependencies,
    ));
    await waitFor(() => expect(result.current.snapshot.phase).toBe('error'));
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.snapshot.phase).toBe('loaded'));
    expect(result.current.snapshot.seatId).toBe(currentSeat.seatId);
  });
});
