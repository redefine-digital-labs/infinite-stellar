import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRankedPrivateMapRecord,
  deriveRankedPlanetObjectId,
  mergeRankedPrivateMap,
  readRankedKnownUniverseProjection,
  appendRankedPrivateLocations,
  rankedMiningGeometry,
  nextExplorationBatch,
  mergeExploredChunks,
  locationInChunks,
  mergeRankedPrivateRecords,
  rankedPrivateMapStorageKey,
  type RankedMiningGeometry,
  type Round5Coordinates,
  type ExploredChunk,
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
import { encryptRankedMapBackup, decryptRankedMapBackup } from './ranked-map-backup';
import { reconcileRankedDiscoveries } from './ranked-map-recovery';

export interface RankedBackupSnapshot {
  phase: 'idle' | 'exporting' | 'importing' | 'complete' | 'error';
  message?: string;
}

export interface RankedBackupDownload { filename: string; contents: string }

export interface RankedMiningSnapshot {
  phase: 'idle' | 'mining' | 'saving' | 'complete' | 'cancelled' | 'error';
  progress?: MinerProgress;
  message?: string;
  origin?: Round5Coordinates;
  chunks?: ExploredChunk[];
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
  refreshing?: boolean;
}

export interface RankedMapDependencies {
  vault: RankedMapVault;
  readKnownProjection: typeof readRankedKnownUniverseProjection;
  startMiner?: typeof startRound5Miner;
  encryptBackup?: typeof encryptRankedMapBackup;
  decryptBackup?: typeof decryptRankedMapBackup;
}

const DEFAULT_DEPENDENCIES: RankedMapDependencies = {
  vault: browserRankedMapVault(),
  readKnownProjection: readRankedKnownUniverseProjection,
};

const DISABLED: RankedMapSnapshot = { phase: 'disabled' };

export function rankedMapIdentityFor(
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
  mine: (center: Round5Coordinates) => void; cancelMining: () => void;
  backup: RankedBackupSnapshot; exportBackup: (passphrase: string) => Promise<RankedBackupDownload>;
  importBackup: (raw: string, passphrase: string) => Promise<void> } {
  const [snapshot, setSnapshot] = useState<RankedMapSnapshot>(DISABLED);
  const [revision, setRevision] = useState(0);
  const requestSequence = useRef(0);
  const [mining, setMining] = useState<RankedMiningSnapshot>({ phase: 'idle' });
  const operation = useRef<MinerOperation | null>(null);
  const exploring = useRef(false);
  const saving = useRef(false);
  const miningSequence = useRef(0);
  const [backup, setBackup] = useState<RankedBackupSnapshot>({ phase: 'idle' });
  const backupBusy = useRef(false);
  const miningContext = useRef<{
    identity: RankedMapIdentity; seat: PlayerSeatBundle; record: RankedPrivateMapRecord;
    projection: RankedKnownUniverseProjection; geometry?: RankedMiningGeometry; signal: AbortSignal;
  } | null>(null);

  useEffect(() => {
    requestSequence.current += 1;
    miningSequence.current += 1;
    operation.current?.cancel();
    operation.current = null;
    exploring.current = false;
    saving.current = false;
    backupBusy.current = false;
    miningContext.current = null;
    setMining({ phase: 'idle' });
    const request = requestSequence.current;
    const identity = rankedMapIdentityFor(deployment, chainIdentifier, seat);
    if (!identity || !seat) {
      setSnapshot(DISABLED);
      return;
    }
    const abort = new AbortController();
    setSnapshot((previous) => previous.map && rankedPrivateMapStorageKey(previous.map.identity) === rankedPrivateMapStorageKey(identity)
      ? { ...previous, refreshing: true, canMine: false, error: undefined }
      : { phase: 'restoring', seatId: seat.seatId, protection: dependencies.vault.protection });
    void dependencies.vault.restore(identity).then(async (restored) => {
      if (abort.signal.aborted || requestSequence.current !== request) return;
      const record = restored ?? createRankedPrivateMapRecord(identity);
      setSnapshot((previous) => previous.map && rankedPrivateMapStorageKey(previous.map.identity) === rankedPrivateMapStorageKey(identity)
        ? { ...previous, refreshing: true, canMine: false } : {
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
        let geometry: RankedMiningGeometry | undefined;
        try {
          geometry = rankedMiningGeometry(projection);
        } catch (error) {
          miningBlocker = error instanceof Error ? error.message : 'Season geometry is unavailable.';
        }
        miningContext.current = { identity, seat, record, projection, geometry, signal: abort.signal };
        setSnapshot({
          phase: 'loaded',
          seatId: seat.seatId,
          hasPrivateRecord: restored !== null,
          protection: dependencies.vault.protection,
          map,
          canMine: geometry !== undefined,
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
      exploring.current = false;
      miningContext.current = null;
    };
  }, [chainIdentifier, client, dependencies, deployment, revision, seat]);

  useEffect(() => { setBackup({ phase: 'idle' }); }, [chainIdentifier, client, dependencies, deployment, seat]);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const cancelMining = useCallback(() => {
    miningSequence.current += 1;
    exploring.current = false;
    operation.current?.cancel();
    operation.current = null;
    saving.current = false;
    setMining((current) => ({ ...current, phase: 'cancelled', chunks: [], message: 'Explorer paused. Completed chunks remain encrypted; unfinished work will be searched again.' }));
  }, []);

  const mine = useCallback((center: Round5Coordinates) => {
    const context = miningContext.current;
    if (!context?.geometry || exploring.current || operation.current || backupBusy.current) return;
    const sequence = ++miningSequence.current;
    exploring.current = true;
    const current = () => miningSequence.current === sequence && miningContext.current === context && !context.signal.aborted;
    void (async () => {
      let cursor = 0;
      let lastReadAt = Date.now();
      while (current() && exploring.current) {
      const next = nextExplorationBatch(center, Number(context.geometry!.worldRadius), context.record.exploredChunks ?? [], cursor);
      cursor = next.cursor;
      const chunks = next.chunks;
      if (!chunks.length) {
        if (next.exhausted) {
          exploring.current = false;
          setMining({ phase: 'complete', origin: center, message: 'Every chunk inside this finite world has been explored.' });
          return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        continue;
      }
      const total = chunks.reduce((sum, chunk) => sum + chunk.side * chunk.side, 0);
      const started = (dependencies.startMiner ?? startRound5Miner)(chunks, (progress) => {
        if (current()) setMining({ phase: 'mining', progress, origin: center, chunks });
      }, context.geometry);
      operation.current = started;
      setMining({ phase: 'mining', progress: { checked: 0, total, found: 0 }, origin: center, chunks });
      const result = await started.result;
        if (!current()) return;
        saving.current = true;
        setMining({ phase: 'saving', progress: result, origin: center, chunks });
        const timestamp = Math.max(Date.now(), context.record.updatedAtMs);
        const previous = new Map(context.record.locations.map((location) => [location.locationId, location]));
        // Worker data is untrusted. Check scope, then recompute all bindings before any durable write.
        if (result.locations.length > total || result.checked !== total || result.total !== total) throw new Error('Mining did not complete the requested chunks.');
        for (const location of result.locations) {
          if (!locationInChunks(location, chunks)) {
            throw new Error('Mining returned a location outside the requested sector.');
          }
        }
        const discoveries = appendRankedPrivateLocations(context.record, result.locations.map((location) => ({
          ...location, discoveredAtMs: previous.get(location.locationId)?.discoveredAtMs ?? timestamp,
        })), timestamp);
        const candidate = { ...discoveries, explorationOrigin: center,
          exploredChunks: mergeExploredChunks(context.record.exploredChunks ?? [], chunks) };
        const needsChainRead = result.locations.length > 0 || Date.now() - lastReadAt > 30_000;
        const reconciled = needsChainRead
          ? await reconcileRankedDiscoveries(client, deployment, context.identity, context.seat,
            candidate, context.projection, context.signal, dependencies.readKnownProjection)
          : { record: candidate, projection: context.projection };
        if (!current()) return;
        await dependencies.vault.save(reconciled.record);
        if (!current()) return;
        // Include concurrent-tab discoveries and coverage before choosing another chunk.
        const stored = await dependencies.vault.restore(context.identity);
        if (!current()) return;
        context.record = stored ? mergeRankedPrivateRecords(reconciled.record, stored) : reconciled.record;
        context.projection = reconciled.projection;
        if (needsChainRead) lastReadAt = Date.now();
        const map = mergeRankedPrivateMap(context.identity, context.seat, context.projection, context.record);
        setSnapshot((previousSnapshot) => ({ ...previousSnapshot, map, hasPrivateRecord: true }));
        operation.current = null;
        saving.current = false;
        try {
          context.geometry = rankedMiningGeometry(context.projection);
        } catch (error) {
          context.geometry = undefined;
          setSnapshot((previousSnapshot) => ({ ...previousSnapshot, canMine: false,
            miningBlocker: error instanceof Error ? error.message : 'Season exploration is unavailable.' }));
          throw error;
        }
        // Yield between bounded Worker batches; continuous search never blocks input.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    })().catch((error) => {
        if (!current()) return;
        exploring.current = false;
        operation.current = null;
        saving.current = false;
        setMining({ phase: 'error', origin: center, message: error instanceof Error ? error.message : 'Exploration failed.' });
    });
  }, [client, deployment, dependencies]);

  const exportBackup = useCallback(async (passphrase: string): Promise<RankedBackupDownload> => {
    const context = miningContext.current;
    if (!context || exploring.current || operation.current || backupBusy.current) throw new Error('Pause exploration before backing up.');
    backupBusy.current = true;
    const current = () => miningContext.current === context && !context.signal.aborted;
    setBackup({ phase: 'exporting' });
    try {
      const record = await dependencies.vault.restore(context.identity);
      if (!current()) throw new DOMException('The active Seat changed.', 'AbortError');
      if (!record || (!record.locations.length && !record.exploredChunks?.length)) throw new Error('This device has no discoveries to export yet.');
      const contents = await (dependencies.encryptBackup ?? encryptRankedMapBackup)(record, passphrase);
      if (!current()) throw new DOMException('The active Seat changed.', 'AbortError');
      setBackup({ phase: 'complete', message: 'Encrypted backup prepared. Keep the file and its passphrase separately; there is no passphrase reset.' });
      return { contents, filename: `infinite-stellar-map-${context.identity.seasonId.slice(-8)}-${context.identity.seatId.slice(-8)}.json` };
    } catch (error) {
      if (current()) setBackup({ phase: 'error', message: error instanceof Error ? error.message : 'Backup export failed.' });
      throw error;
    } finally {
      if (current()) backupBusy.current = false;
    }
  }, [dependencies]);

  const importBackup = useCallback(async (raw: string, passphrase: string): Promise<void> => {
    const context = miningContext.current;
    if (!context || exploring.current || operation.current || backupBusy.current) throw new Error('Pause exploration before restoring.');
    backupBusy.current = true;
    const current = () => miningContext.current === context && !context.signal.aborted;
    setBackup({ phase: 'importing' });
    try {
      const imported = await (dependencies.decryptBackup ?? decryptRankedMapBackup)(raw, passphrase, context.identity);
      if (!current()) throw new DOMException('The active Seat changed.', 'AbortError');
      const candidate = mergeRankedPrivateRecords(context.record, imported);
      const reconciled = await reconcileRankedDiscoveries(client, deployment, context.identity, context.seat,
        candidate, context.projection, context.signal, dependencies.readKnownProjection);
      if (!current()) throw new DOMException('The active Seat changed.', 'AbortError');
      await dependencies.vault.save(reconciled.record);
      if (!current()) throw new DOMException('The active Seat changed.', 'AbortError');
      setBackup({ phase: 'complete', message: 'Backup authenticated and merged. Ownership and resources were restored from Sui, not from the backup.' });
      refresh();
    } catch (error) {
      if (current()) setBackup({ phase: 'error', message: error instanceof Error ? error.message : 'Backup restore failed.' });
      throw error;
    } finally {
      if (current()) backupBusy.current = false;
    }
  }, [client, deployment, dependencies, refresh]);
  return { snapshot, refresh, mining, mine, cancelMining, backup, exportBackup, importBackup };
}
