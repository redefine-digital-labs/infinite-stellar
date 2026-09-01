import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readRankedUniverseProjection,
  type InfiniteStellarDeployment,
  type PlayerSeatBundle,
  type RankedProjectionClient,
  type RankedUniverseProjection,
} from '@infinite-stellar/game-sdk';

export interface RankedProjectionSnapshot {
  phase: 'disabled' | 'loading' | 'loaded' | 'error';
  seatId?: string;
  projection?: RankedUniverseProjection;
  error?: string;
}

export interface RankedProjectionDependencies {
  readProjection: typeof readRankedUniverseProjection;
}

const DEFAULT_DEPENDENCIES: RankedProjectionDependencies = {
  readProjection: readRankedUniverseProjection,
};

const DISABLED: RankedProjectionSnapshot = { phase: 'disabled' };

function canReadProjection(
  deployment: InfiniteStellarDeployment,
  seat: PlayerSeatBundle | undefined,
): seat is PlayerSeatBundle {
  return Boolean(
    seat && deployment.network === 'mainnet' && deployment.packageId &&
    deployment.manifestId && deployment.runtimeId && deployment.enrollmentRegistryId &&
    deployment.planetRegistryId && deployment.seatRouting,
  );
}

export function useRankedProjection(
  client: RankedProjectionClient,
  deployment: InfiniteStellarDeployment,
  seat: PlayerSeatBundle | undefined,
  dependencies: RankedProjectionDependencies = DEFAULT_DEPENDENCIES,
): { snapshot: RankedProjectionSnapshot; refresh: () => void } {
  const [snapshot, setSnapshot] = useState<RankedProjectionSnapshot>(DISABLED);
  const [revision, setRevision] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    requestSequence.current += 1;
    const request = requestSequence.current;
    if (!canReadProjection(deployment, seat)) {
      setSnapshot(DISABLED);
      return;
    }
    const abort = new AbortController();
    setSnapshot({ phase: 'loading', seatId: seat.seatId });
    void dependencies.readProjection(client, deployment, { signal: abort.signal })
      .then((projection) => {
        if (!abort.signal.aborted && requestSequence.current === request) {
          setSnapshot({ phase: 'loaded', seatId: seat.seatId, projection });
        }
      })
      .catch((error) => {
        if (abort.signal.aborted || requestSequence.current !== request) return;
        setSnapshot({
          phase: 'error',
          seatId: seat.seatId,
          error: error instanceof Error ? error.message : 'The ranked universe projection could not be read.',
        });
      });
    return () => abort.abort();
  }, [client, dependencies, deployment, revision, seat]);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  return { snapshot, refresh };
}
