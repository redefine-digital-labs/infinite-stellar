import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRankedPrivateMapRecord,
  deriveRankedPlanetObjectId,
  mergeRankedPrivateMap,
  readRankedKnownUniverseProjection,
  appendRankedPrivateLocations,
  rankedMiningGeometry,
  round5MinerBatch,
  type RankedMiningGeometry,
  type Round5Coordinates,
  type RankedPrivateMapRecord,
  type RankedKnownUniverseProjection,
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
import { startRound5Miner, type MinerOperation, type MinerProgress } from './miner-client';

export interface RankedMiningSnapshot {
  phase: 'idle' | 'mining' | 'saving' | 'complete' | 'cancelled' | 'error';
  progress?: MinerProgress;
  message?: string;
}

export interface RankedMapSnapshot {
  phase: 'disabled' | 'restoring' | 'loading' | 'loaded' | 'error';
  seatId?: string;
  hasPrivateRecord?: boolean;
  protection?: RankedMapVault['protection'];
  map?: RankedMapView;
  error?: string;
  miningBlocker?: string;
  canMine?: boolean;
}

export interface RankedMapDependencies {
  vault: RankedMapVault;
  readKnownProjection: typeof readRankedKnownUniverseProjection;
  startMiner?: typeof startRound5Miner;
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
): { snapshot: RankedMapSnapshot; refresh: () => void; mining: RankedMiningSnapshot;
  mine: (center: Round5Coordinates) => void; cancelMining: () => void } {
  const [snapshot, setSnapshot] = useState<RankedMapSnapshot>(DISABLED);
  const [revision, setRevision] = useState(0);
  const requestSequence = useRef(0);
  const [mining, setMining] = useState<RankedMiningSnapshot>({ phase: 'idle' });
  const operation = useRef<MinerOperation | null>(null);
  const saving = useRef(false);
  const miningSequence = useRef(0);
  const miningContext = useRef<{
    identity: RankedMapIdentity; seat: PlayerSeatBundle; record: RankedPrivateMapRecord;
    projection: RankedKnownUniverseProjection; geometry: RankedMiningGeometry;
  } | null>(null);

  useEffect(() => {
    requestSequence.current += 1;
    miningSequence.current += 1;
    operation.current?.cancel();
    operation.current = null;
    saving.current = false;
    miningContext.current = null;
    setMining({ phase: 'idle' });
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
        let miningBlocker: string | undefined;
        try {
          const geometry = rankedMiningGeometry(projection);
          miningContext.current = { identity, seat, record, projection, geometry };
        } catch (error) {
          miningBlocker = error instanceof Error ? error.message : 'Season geometry is unavailable.';
        }
        setSnapshot({
          phase: 'loaded',
          seatId: seat.seatId,
          hasPrivateRecord: restored !== null,
          protection: dependencies.vault.protection,
          map,
          canMine: miningContext.current !== null,
          miningBlocker,
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
    return () => {
      abort.abort();
      miningSequence.current += 1;
      operation.current?.cancel();
      operation.current = null;
      miningContext.current = null;
    };
  }, [chainIdentifier, client, dependencies, deployment, revision, seat]);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const cancelMining = useCallback(() => {
    if (!operation.current || saving.current) return;
    miningSequence.current += 1;
    operation.current.cancel();
    operation.current = null;
    setMining({ phase: 'cancelled', message: 'Search cancelled. Unfinished results were not saved.' });
  }, []);

  const mine = useCallback((center: Round5Coordinates) => {
    const context = miningContext.current;
    if (!context || operation.current) return;
    const sequence = ++miningSequence.current;
    const current = () => miningSequence.current === sequence && miningContext.current === context;
    try {
      const chunks = round5MinerBatch(center, 0, 1, 64);
      const started = (dependencies.startMiner ?? startRound5Miner)(chunks, (progress) => {
        if (current()) setMining({ phase: 'mining', progress });
      }, context.geometry);
      operation.current = started;
      setMining({ phase: 'mining', progress: { checked: 0, total: 4096, found: 0 } });
      void started.result.then(async (result) => {
        if (!current()) return;
        saving.current = true;
        setMining({ phase: 'saving', progress: result });
        const timestamp = Math.max(Date.now(), context.record.updatedAtMs);
        const previous = new Map(context.record.locations.map((location) => [location.locationId, location]));
        // Worker data is untrusted. Check scope, then recompute all bindings before any durable write.
        if (result.locations.length > 4096) throw new Error('Mining results exceed the requested sector.');
        const chunk = chunks[0]!;
        for (const location of result.locations) {
          if (location.x < chunk.x || location.x >= chunk.x + chunk.side ||
              location.y < chunk.y || location.y >= chunk.y + chunk.side) {
            throw new Error('Mining returned a location outside the requested sector.');
          }
        }
        const candidate = appendRankedPrivateLocations(context.record, result.locations.map((location) => ({
          ...location, discoveredAtMs: previous.get(location.locationId)?.discoveredAtMs ?? timestamp,
        })), timestamp);
        mergeRankedPrivateMap(context.identity, context.seat, context.projection, candidate);
        await dependencies.vault.save(candidate);
        if (!current()) return;
        operation.current = null;
        saving.current = false;
        setMining({ phase: 'complete', progress: result, message: 'Discoveries encrypted and saved. Refreshing chain state.' });
        refresh();
      }).catch((error) => {
        if (!current()) return;
        operation.current = null;
        saving.current = false;
        setMining({ phase: 'error', message: error instanceof Error ? error.message : 'Exploration failed.' });
      });
    } catch (error) {
      if (current()) setMining({ phase: 'error', message: error instanceof Error ? error.message : 'Exploration could not start.' });
    }
  }, [dependencies, refresh]);
  return { snapshot, refresh, mining, mine, cancelMining };
}
