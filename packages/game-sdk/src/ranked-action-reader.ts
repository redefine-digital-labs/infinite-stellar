import { bcs } from '@mysten/sui/bcs';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeStructTag, normalizeSuiAddress } from '@mysten/sui/utils';
import { assertRankedReleaseDeploymentReady, type InfiniteStellarDeployment } from './sui-gateway';
import { deriveSeasonSeatId, readPlayerSeatBundle, type PlayerSeatBundle } from './sui-player-runtime';
import { readRankedKnownUniverseProjection } from './ranked-projection';
import { deriveRankedPlanetObjectId, parseRankedPrivateMapRecord, type RankedPrivateMapRecord } from './ranked-map';
import type { RankedActionContext, RankedActionRequest } from './ranked-actions';

export const SUI_ACTION_CLOCK_ID = normalizeSuiAddress('0x6');
const ClockBcs = bcs.struct('Clock', { id: bcs.Address, timestamp_ms: bcs.u64() });
export type RankedActionReadClient = Pick<SuiGrpcClient, 'getObjects' | 'getChainIdentifier'>;

/** A current BCS observation, never a wall-clock approximation or settlement guarantee. */
export async function readSuiActionClock(client: Pick<SuiGrpcClient, 'getObjects'>, signal?: AbortSignal): Promise<bigint> {
  signal?.throwIfAborted();
  const response = await client.getObjects({ objectIds: [SUI_ACTION_CLOCK_ID], include: { content: true } });
  signal?.throwIfAborted();
  const value = response.objects[0];
  if (response.objects.length !== 1 || !value || value instanceof Error ||
    normalizeSuiAddress(value.objectId) !== SUI_ACTION_CLOCK_ID || value.owner.$kind !== 'Shared' ||
    normalizeStructTag(value.type) !== `${normalizeSuiAddress('0x2')}::clock::Clock` ||
    !(value.content instanceof Uint8Array) || value.content.byteLength !== 40) {
    throw new Error('The chain did not return the canonical shared Sui Clock with exact BCS content.');
  }
  const clock = ClockBcs.parse(value.content);
  if (normalizeSuiAddress(clock.id) !== SUI_ACTION_CLOCK_ID) throw new Error('The Sui Clock BCS identity is invalid.');
  return BigInt(clock.timestamp_ms);
}

export interface RankedActionReaderOptions {
  signal?: AbortSignal;
  /** Keep this fixed for every read belonging to one proof/signature operation. */
  deadlineMs?: bigint;
  proofLifetimeMs?: bigint;
}

export interface RankedActionReaderDependencies {
  readSeat: typeof readPlayerSeatBundle;
  readProjection: typeof readRankedKnownUniverseProjection;
  readClock: typeof readSuiActionClock;
}
const READERS: RankedActionReaderDependencies = {
  readSeat: readPlayerSeatBundle, readProjection: readRankedKnownUniverseProjection, readClock: readSuiActionClock,
};

function seatVersions(seat: PlayerSeatBundle): string {
  return [seat.seat, seat.projection, seat.civilization, seat.scoreCard]
    .map((value) => `${value.objectId}:${value.version}:${value.digest}`).join('|');
}

/** Re-reads chain identity, Seat bundle, selected Planets and Clock on every call.
 * Only one/two deterministic public object IDs leave the private map boundary.
 * No event-history scan and no coordinates, ownership or resources from the vault.
 */
export async function readRankedActionContext(
  client: RankedActionReadClient,
  deployment: InfiniteStellarDeployment,
  rawRecord: RankedPrivateMapRecord,
  request: RankedActionRequest,
  options: RankedActionReaderOptions = {},
  dependencies: RankedActionReaderDependencies = READERS,
): Promise<RankedActionContext> {
  options.signal?.throwIfAborted();
  assertRankedReleaseDeploymentReady(deployment);
  const record = parseRankedPrivateMapRecord(JSON.stringify(rawRecord));
  if (!record || record.network !== deployment.network || record.packageId !== deployment.packageId ||
    record.seasonId !== deployment.manifestId || record.planetRegistryId !== deployment.planetRegistryId ||
    record.typeOriginPackageId !== deployment.seatRouting!.keyTypeOriginPackageId ||
    record.seatId !== deriveSeasonSeatId(deployment, record.controllerAddress) ||
    deployment.clockObjectId !== SUI_ACTION_CLOCK_ID) {
    throw new Error('The action map does not match the exact deployment, controller Seat and canonical Clock.');
  }
  const wanted = new Set(request.kind === 'claim_home' ? [request.destinationLocationId]
    : [request.sourceLocationId, request.destinationLocationId]);
  const locations = record.locations.filter((location) => wanted.has(location.locationId));
  if (locations.length !== wanted.size || (request.kind === 'move' && wanted.size !== 2)) {
    throw new Error('The requested action needs verified coordinates for each distinct selected Planet.');
  }
  const lifetime = options.proofLifetimeMs ?? 120_000n;
  if (typeof lifetime !== 'bigint' || lifetime <= 0n || lifetime > 300_000n) {
    throw new Error('Proof preparation requires a positive lifetime of at most five minutes.');
  }
  const chain = await client.getChainIdentifier();
  options.signal?.throwIfAborted();
  if (chain.chainIdentifier !== record.chainIdentifier) throw new Error('The action RPC is connected to another chain.');
  const seat = await dependencies.readSeat(client, deployment, record.controllerAddress);
  options.signal?.throwIfAborted();
  if (seat.status !== 'enrolled' || seat.seatId !== record.seatId) throw new Error('The fixed controller Seat is not enrolled.');
  const projection = await dependencies.readProjection(client, deployment,
    locations.map((location) => deriveRankedPlanetObjectId(record, location.locationId)), { signal: options.signal });
  const finalSeat = await dependencies.readSeat(client, deployment, record.controllerAddress);
  options.signal?.throwIfAborted();
  if (finalSeat.status !== 'enrolled' || seatVersions(seat) !== seatVersions(finalSeat)) {
    throw new Error('The Seat changed during the action read. Refresh and try again.');
  }
  const nowMs = await dependencies.readClock(client, options.signal);
  options.signal?.throwIfAborted();
  const closing = request.kind === 'claim_home'
    ? (projection.manifest.homeClaimCloseAtMs < projection.manifest.seasonEndAtMs
      ? projection.manifest.homeClaimCloseAtMs : projection.manifest.seasonEndAtMs)
    : projection.manifest.seasonEndAtMs;
  const maximum = closing - 1n;
  const deadlineMs = options.deadlineMs ?? (nowMs + lifetime < maximum ? nowMs + lifetime : maximum);
  if (deadlineMs <= nowMs || deadlineMs > maximum) throw new Error('The proof deadline is no longer inside the live action window.');
  return { deployment, seat: finalSeat, projection, record: { ...record, locations }, nowMs, deadlineMs };
}
