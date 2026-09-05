import {
  createRankedLocationMiner, deriveRankedPlanetObjectId, mergeRankedPrivateMap,
  parseRankedPrivateMapRecord, rankedPrivateMapStorageKey, rankedSeasonGeometry,
  readRankedKnownUniverseProjection,
  type InfiniteStellarDeployment, type PlayerSeatBundle, type RankedMapIdentity,
  type RankedPrivateMapRecord, type RankedProjectionClient, type RankedKnownUniverseProjection,
} from '@infinite-stellar/game-sdk';

/** Private preimages are validated locally; only their derived public object IDs go to RPC. */
export async function reconcileRankedDiscoveries(
  client: RankedProjectionClient,
  deployment: InfiniteStellarDeployment,
  identity: RankedMapIdentity,
  seat: PlayerSeatBundle,
  rawRecord: RankedPrivateMapRecord,
  previousProjection: RankedKnownUniverseProjection,
  signal: AbortSignal,
  readProjection = readRankedKnownUniverseProjection,
) {
  signal.throwIfAborted();
  const record = parseRankedPrivateMapRecord(JSON.stringify(rawRecord));
  if (!record || rankedPrivateMapStorageKey(record) !== rankedPrivateMapStorageKey(identity)) {
    throw new Error('Private discoveries belong to another chain, Season, or controller Seat.');
  }
  // Match the public point-read bound; refuse, never silently truncate, a larger import.
  if (record.locations.length > 5000) throw new Error('This map exceeds the current 5,000-location projection limit. No discoveries were replaced.');
  const mine = createRankedLocationMiner(rankedSeasonGeometry(previousProjection));
  for (let index = 0; index < record.locations.length; index++) {
    const location = record.locations[index]!;
    const expected = mine(location);
    if (!expected || expected.locationId !== location.locationId || expected.perlin !== location.perlin ||
        expected.biomebase !== location.biomebase) throw new Error('Private discoveries do not match the committed Season geometry.');
    if (index % 32 === 31) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      signal.throwIfAborted();
    }
  }
  signal.throwIfAborted();
  const planetIds = record.locations.map((location) => deriveRankedPlanetObjectId(identity, location.locationId));
  const projection = await readProjection(client, deployment, planetIds, { signal });
  signal.throwIfAborted();
  // A newly recovered founding Planet must be point-read before this full merge.
  const map = mergeRankedPrivateMap(identity, seat, projection, record);
  return { record, map, projection };
}
