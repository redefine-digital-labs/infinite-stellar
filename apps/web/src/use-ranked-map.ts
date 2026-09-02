import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRankedPrivateMapRecord,
  deriveRankedPlanetObjectId,
  mergeRankedPrivateMap,
  readRankedKnownUniverseProjection,
  type InfiniteStellarDeployment,
  type PlayerSeatBundle,
  type RankedMapIdentity,
  type RankedMapView,
  type RankedProjectionClient,
} from '@infinite-stellar/game-sdk';
import {
  browserRankedMapVault,
  type RankedMapVault,
} from './ranked-map-vault';

export interface RankedMapSnapshot {
  phase: 'disabled' | 'restoring' | 'loading' | 'loaded' | 'error';
  seatId?: string;
  hasPrivateRecord?: boolean;
  protection?: RankedMapVault['protection'];
  map?: RankedMapView;
  error?: string;
}

export interface RankedMapDependencies {
  vault: RankedMapVault;
  readKnownProjection: typeof readRankedKnownUniverseProjection;
}

const DEFAULT_DEPENDENCIES: RankedMapDependencies = {
  vault: browserRankedMapVault(),
  readKnownProjection: readRankedKnownUniverseProjection,
};

const DISABLED: RankedMapSnapshot = { phase: 'disabled' };

function identityFor(
  deployment: InfiniteStellarDeployment,
  chainIdentifier: string,
  seat: PlayerSeatBundle | undefined,
): RankedMapIdentity | null {
  if (
    !seat || deployment.network !== 'mainnet' || !deployment.packageId ||
    !deployment.manifestId || !deployment.planetRegistryId || !deployment.seatRouting ||
    chainIdentifier.length < 32
  ) return null;
  return {
    schemaVersion: 1,
    network: 'mainnet',
    chainIdentifier,
    packageId: deployment.packageId,
    typeOriginPackageId: deployment.seatRouting.keyTypeOriginPackageId,
    seasonId: deployment.manifestId,
    planetRegistryId: deployment.planetRegistryId,
    seatId: seat.seatId,
    controllerAddress: seat.seat.controller,
  };
}

export function useRankedMap(
  client: RankedProjectionClient,
  deployment: InfiniteStellarDeployment,
  chainIdentifier: string,
  seat: PlayerSeatBundle | undefined,
  dependencies: RankedMapDependencies = DEFAULT_DEPENDENCIES,
): { snapshot: RankedMapSnapshot; refresh: () => void } {
  const [snapshot, setSnapshot] = useState<RankedMapSnapshot>(DISABLED);
  const [revision, setRevision] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    requestSequence.current += 1;
    const request = requestSequence.current;
    const identity = identityFor(deployment, chainIdentifier, seat);
    if (!identity || !seat) {
      setSnapshot(DISABLED);
      return;
    }
    const abort = new AbortController();
    setSnapshot({
      phase: 'restoring',
      seatId: seat.seatId,
      protection: dependencies.vault.protection,
    });
    void dependencies.vault.restore(identity).then(async (restored) => {
      if (abort.signal.aborted || requestSequence.current !== request) return;
      const record = restored ?? createRankedPrivateMapRecord(identity);
      setSnapshot({
        phase: 'loading',
        seatId: seat.seatId,
        hasPrivateRecord: restored !== null,
        protection: dependencies.vault.protection,
      });
      const planetIds = record.locations.map((location) =>
        deriveRankedPlanetObjectId(identity, location.locationId));
      const projection = await dependencies.readKnownProjection(
        client,
        deployment,
        planetIds,
        { signal: abort.signal },
      );
      const map = mergeRankedPrivateMap(identity, seat, projection, record);
      if (!abort.signal.aborted && requestSequence.current === request) {
        setSnapshot({
          phase: 'loaded',
          seatId: seat.seatId,
          hasPrivateRecord: restored !== null,
          protection: dependencies.vault.protection,
          map,
        });
      }
    }).catch((error) => {
      if (abort.signal.aborted || requestSequence.current !== request) return;
      setSnapshot({
        phase: 'error',
        seatId: seat.seatId,
        protection: dependencies.vault.protection,
        error: error instanceof Error ? error.message : 'The ranked private map could not be restored.',
      });
    });
    return () => abort.abort();
  }, [chainIdentifier, client, dependencies, deployment, revision, seat]);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  return { snapshot, refresh };
}
