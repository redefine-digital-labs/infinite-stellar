import { bcs } from '@mysten/sui/bcs';
import { ObjectError, type SuiClientTypes } from '@mysten/sui/client';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import type { Transaction } from '@mysten/sui/transactions';
import { deriveObjectID, normalizeSuiAddress } from '@mysten/sui/utils';
import type { InfiniteStellarDeployment, SeatRoutingPin } from './sui-gateway';

const CANONICAL_ADDRESS = /^0x[0-9a-f]{64}$/;

const ControllerSeatKeyBcs = bcs.struct('ControllerSeatKey', {
  encoding_version: bcs.u64(),
  season_id: bcs.Address,
  league: bcs.u8(),
  controller: bcs.Address,
});

const SeasonSeatBcs = bcs.struct('SeasonSeat', {
  id: bcs.Address,
  season_id: bcs.Address,
  league: bcs.u8(),
  controller: bcs.Address,
  soul_id: bcs.Address,
  projection_id: bcs.Address,
  civilization_id: bcs.Address,
  score_card_id: bcs.Address,
});

const CommanderProjectionBcs = bcs.struct('CommanderProjection', {
  id: bcs.Address,
  season_id: bcs.Address,
  seat_id: bcs.Address,
  soulidity_package_id: bcs.Address,
  soul_state_id: bcs.Address,
  soul_id: bcs.Address,
  controller_at_enrollment: bcs.Address,
  ownership_epoch_at_enrollment: bcs.u64(),
  projection_commitment: bcs.vector(bcs.u8()),
});

const CivilizationStateBcs = bcs.struct('CivilizationState', {
  id: bcs.Address,
  season_id: bcs.Address,
  seat_id: bcs.Address,
  status: bcs.u8(),
  controlled_planet_count: bcs.u64(),
  pending_voyage_count: bcs.u64(),
  space_junk: bcs.u64(),
  space_junk_limit: bcs.u64(),
  ships_claimed: bcs.bool(),
  last_reveal_at_seconds: bcs.option(bcs.u64()),
  initial_home_planet_id: bcs.option(bcs.Address),
  home_claim_consumed: bcs.bool(),
  activated_once: bcs.bool(),
});

const ScoreCardBcs = bcs.struct('ScoreCard', {
  id: bcs.Address,
  season_id: bcs.Address,
  seat_id: bcs.Address,
  score: bcs.u64(),
  pending_scored_arrival_count: bcs.u64(),
});

const SeatEnrolledEventBcs = bcs.struct('SeatEnrolled', {
  season_id: bcs.Address,
  seat_id: bcs.Address,
  controller: bcs.Address,
  soul_id: bcs.Address,
  projection_id: bcs.Address,
});

const FoundingPlanetClaimedEventBcs = bcs.struct('FoundingPlanetClaimed', {
  season_id: bcs.Address,
  seat_id: bcs.Address,
  planet_id: bcs.Address,
});

const VoyageDispatchedEventBcs = bcs.struct('VoyageDispatched', {
  season_id: bcs.Address,
  voyage_id: bcs.Address,
  player_seat_id: bcs.Address,
  from_planet_id: bcs.Address,
  to_planet_id: bcs.Address,
  arrival_at_seconds: bcs.u64(),
  is_abandon: bcs.bool(),
});

export type PlayerSuiClient = Pick<
  SuiGrpcClient,
  'getObjects' | 'simulateTransaction' | 'waitForTransaction'
>;

export class PlayerTransactionExecutionError extends Error {
  constructor(
    readonly code:
      | 'INVALID_DEPLOYMENT'
      | 'SIMULATION_FAILED'
      | 'SUBMISSION_FAILED'
      | 'EXECUTION_FAILED'
      | 'FINALITY_FAILED'
      | 'RECONCILIATION_FAILED'
      | 'READ_MODEL_INVALID',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'PlayerTransactionExecutionError';
  }
}

export interface PlayerGasEstimate {
  computationCost: bigint;
  storageCost: bigint;
  storageRebate: bigint;
  nonRefundableStorageFee: bigint;
  netGasMist: bigint;
}

export interface PlayerTransactionSimulation {
  digest: string;
  gas: PlayerGasEstimate;
  changedObjectIds: string[];
  balanceChanges: SuiClientTypes.BalanceChange[];
  commandCount: number;
}

export type PlayerActionExpectation =
  | {
      kind: 'enroll';
      seasonId: string;
      controller: string;
      soulId: string;
      requiredChangedObjectIds?: string[];
    }
  | {
      kind: 'claim_home';
      seasonId: string;
      seatId: string;
      requiredChangedObjectIds?: string[];
    }
  | {
      kind: 'move' | 'move_new';
      seasonId: string;
      seatId: string;
      fromPlanetId: string;
      toPlanetId: string;
      requiredChangedObjectIds?: string[];
    };

export interface ReconciledPlayerEvent {
  eventType: string;
  seasonId: string;
  seatId: string;
  createdObjectId: string;
  fromPlanetId?: string;
  toPlanetId?: string;
  arrivalAtSeconds?: bigint;
}

export interface FinalizedPlayerTransaction {
  digest: string;
  checkpoint: string;
  timestampMs: number;
  changedObjectIds: string[];
  event: ReconciledPlayerEvent;
  simulation: PlayerTransactionSimulation;
}

export interface SubmitPlayerTransactionInput {
  client: PlayerSuiClient;
  transaction: Transaction;
  execute: (
    transaction: Transaction,
  ) => Promise<SuiClientTypes.TransactionResult>;
  deployment: InfiniteStellarDeployment;
  expectation: PlayerActionExpectation;
  timeoutMs?: number;
  pollScheduleMs?: number[];
}

export type CivilizationLifecycle =
  | 'AwaitingHome'
  | 'Active'
  | 'Eliminated'
  | 'Settled'
  | 'Cancelled';

export interface ChainObjectVersion {
  objectId: string;
  version: string;
  digest: string;
  previousTransaction: string | null;
}

export interface PlayerSeatBundle {
  status: 'enrolled';
  seatId: string;
  seat: ChainObjectVersion & {
    seasonId: string;
    league: number;
    controller: string;
    soulId: string;
    projectionId: string;
    civilizationId: string;
    scoreCardId: string;
  };
  projection: ChainObjectVersion & {
    soulidityPackageId: string;
    soulStateId: string;
    soulId: string;
    controllerAtEnrollment: string;
    ownershipEpochAtEnrollment: bigint;
    projectionCommitment: Uint8Array;
  };
  civilization: ChainObjectVersion & {
    lifecycle: CivilizationLifecycle;
    controlledPlanetCount: bigint;
    pendingVoyageCount: bigint;
    spaceJunk: bigint;
    spaceJunkLimit: bigint;
    shipsClaimed: boolean;
    lastRevealAtSeconds: bigint | null;
    initialHomePlanetId: string | null;
    homeClaimConsumed: boolean;
    activatedOnce: boolean;
  };
  scoreCard: ChainObjectVersion & {
    score: bigint;
    pendingScoredArrivalCount: bigint;
  };
}

export interface PlayerNotEnrolled {
  status: 'not-enrolled';
  seatId: string;
}

function requireAddress(value: string | undefined, label: string): string {
  if (!value || !CANONICAL_ADDRESS.test(value)) {
    throw new PlayerTransactionExecutionError(
      'INVALID_DEPLOYMENT',
      `${label} must be a canonical 32-byte Sui address.`,
    );
  }
  return value;
}

function requireSeatRouting(deployment: InfiniteStellarDeployment): SeatRoutingPin {
  const routing = deployment.seatRouting;
  if (
    !routing ||
    !CANONICAL_ADDRESS.test(routing.keyTypeOriginPackageId) ||
    !Number.isSafeInteger(routing.keyEncodingVersion) ||
    routing.keyEncodingVersion < 1 ||
    !Number.isSafeInteger(routing.league) ||
    routing.league < 0 ||
    routing.league > 255
  ) {
    throw new PlayerTransactionExecutionError(
      'INVALID_DEPLOYMENT',
      'Deterministic Seat routing requires a pinned key type origin, encoding version, and league.',
    );
  }
  return routing;
}

function normalized(value: string): string {
  return normalizeSuiAddress(value);
}

function formatExecutionFailure(
  result: SuiClientTypes.TransactionResult | SuiClientTypes.SimulateTransactionResult,
): string {
  if (result.$kind === 'Transaction') return 'Unknown transaction failure.';
  return result.FailedTransaction.status.error?.message ?? 'Unknown transaction failure.';
}

function gasEstimate(effects: SuiClientTypes.TransactionEffects): PlayerGasEstimate {
  const computationCost = BigInt(effects.gasUsed.computationCost);
  const storageCost = BigInt(effects.gasUsed.storageCost);
  const storageRebate = BigInt(effects.gasUsed.storageRebate);
  const nonRefundableStorageFee = BigInt(effects.gasUsed.nonRefundableStorageFee);
  return {
    computationCost,
    storageCost,
    storageRebate,
    nonRefundableStorageFee,
    netGasMist: computationCost + storageCost - storageRebate,
  };
}

export function deriveSeasonSeatId(
  deployment: InfiniteStellarDeployment,
  controller: string,
): string {
  const registryId = requireAddress(deployment.enrollmentRegistryId, 'EnrollmentRegistry ID');
  const seasonId = requireAddress(deployment.manifestId, 'SeasonManifest ID');
  const canonicalController = requireAddress(controller, 'Controller');
  const routing = requireSeatRouting(deployment);
  const key = ControllerSeatKeyBcs.serialize({
    encoding_version: routing.keyEncodingVersion,
    season_id: seasonId,
    league: routing.league,
    controller: canonicalController,
  }).toBytes();
  return deriveObjectID(
    registryId,
    `${routing.keyTypeOriginPackageId}::identity::ControllerSeatKey`,
    key,
  );
}

export async function simulatePlayerTransaction(
  client: Pick<SuiGrpcClient, 'simulateTransaction'>,
  transaction: Transaction,
): Promise<PlayerTransactionSimulation> {
  let result;
  try {
    result = await client.simulateTransaction({
      transaction,
      checksEnabled: true,
      doGasSelection: true,
      include: {
        effects: true,
        balanceChanges: true,
        objectTypes: true,
        commandResults: true,
      },
    });
  } catch (error) {
    throw new PlayerTransactionExecutionError(
      'SIMULATION_FAILED',
      error instanceof Error ? error.message : 'The Sui node could not simulate the transaction.',
      { cause: error },
    );
  }
  if (result.$kind === 'FailedTransaction' || !result.Transaction.status.success) {
    throw new PlayerTransactionExecutionError(
      'SIMULATION_FAILED',
      formatExecutionFailure(result),
    );
  }
  const effects = result.Transaction.effects;
  if (!effects) {
    throw new PlayerTransactionExecutionError(
      'SIMULATION_FAILED',
      'The Sui simulation omitted transaction effects.',
    );
  }
  return {
    digest: result.Transaction.digest,
    gas: gasEstimate(effects),
    changedObjectIds: effects.changedObjects.map(({ objectId }) => normalized(objectId)),
    balanceChanges: result.Transaction.balanceChanges ?? [],
    commandCount: result.commandResults?.length ?? 0,
  };
}

function assertExpectedEvent(
  deployment: InfiniteStellarDeployment,
  events: SuiClientTypes.Event[],
  expectation: PlayerActionExpectation,
): ReconciledPlayerEvent {
  const packageId = requireAddress(deployment.packageId, 'Infinite Stellar package ID');
  const expectedSeasonId = normalized(expectation.seasonId);
  if (expectation.kind === 'enroll') {
    const eventType = `${packageId}::identity::SeatEnrolled`;
    const event = events.find((candidate) =>
      candidate.eventType === eventType &&
      normalized(candidate.packageId) === packageId &&
      candidate.module === 'identity');
    if (!event) throw new Error(`Missing ${eventType} event.`);
    const decoded = SeatEnrolledEventBcs.parse(event.bcs);
    if (
      normalized(decoded.season_id) !== expectedSeasonId ||
      normalized(decoded.controller) !== normalized(expectation.controller) ||
      normalized(decoded.soul_id) !== normalized(expectation.soulId)
    ) {
      throw new Error('SeatEnrolled event fields do not match the submitted enrollment.');
    }
    return {
      eventType,
      seasonId: normalized(decoded.season_id),
      seatId: normalized(decoded.seat_id),
      createdObjectId: normalized(decoded.projection_id),
    };
  }
  if (expectation.kind === 'claim_home') {
    const eventType = `${packageId}::planet::FoundingPlanetClaimed`;
    const event = events.find((candidate) =>
      candidate.eventType === eventType &&
      normalized(candidate.packageId) === packageId &&
      candidate.module === 'planet');
    if (!event) throw new Error(`Missing ${eventType} event.`);
    const decoded = FoundingPlanetClaimedEventBcs.parse(event.bcs);
    if (
      normalized(decoded.season_id) !== expectedSeasonId ||
      normalized(decoded.seat_id) !== normalized(expectation.seatId)
    ) {
      throw new Error('FoundingPlanetClaimed event fields do not match the submitted claim.');
    }
    return {
      eventType,
      seasonId: normalized(decoded.season_id),
      seatId: normalized(decoded.seat_id),
      createdObjectId: normalized(decoded.planet_id),
    };
  }
  const eventType = `${packageId}::voyage::VoyageDispatched`;
  const event = events.find((candidate) =>
    candidate.eventType === eventType &&
    normalized(candidate.packageId) === packageId &&
    candidate.module === 'voyage');
  if (!event) throw new Error(`Missing ${eventType} event.`);
  const decoded = VoyageDispatchedEventBcs.parse(event.bcs);
  if (
    normalized(decoded.season_id) !== expectedSeasonId ||
    normalized(decoded.player_seat_id) !== normalized(expectation.seatId) ||
    normalized(decoded.from_planet_id) !== normalized(expectation.fromPlanetId) ||
    normalized(decoded.to_planet_id) !== normalized(expectation.toPlanetId) ||
    decoded.is_abandon
  ) {
    throw new Error('VoyageDispatched event fields do not match the submitted fleet move.');
  }
  return {
    eventType,
    seasonId: normalized(decoded.season_id),
    seatId: normalized(decoded.player_seat_id),
    createdObjectId: normalized(decoded.voyage_id),
    fromPlanetId: normalized(decoded.from_planet_id),
    toPlanetId: normalized(decoded.to_planet_id),
    arrivalAtSeconds: BigInt(decoded.arrival_at_seconds),
  };
}

export async function submitAndFinalizePlayerTransaction(
  input: SubmitPlayerTransactionInput,
): Promise<FinalizedPlayerTransaction> {
  const simulation = await simulatePlayerTransaction(input.client, input.transaction);
  let submitted: SuiClientTypes.TransactionResult;
  try {
    submitted = await input.execute(input.transaction);
  } catch (error) {
    throw new PlayerTransactionExecutionError(
      'SUBMISSION_FAILED',
      error instanceof Error ? error.message : 'The wallet did not submit the transaction.',
      { cause: error },
    );
  }
  if (submitted.$kind === 'FailedTransaction' || !submitted.Transaction.status.success) {
    throw new PlayerTransactionExecutionError('EXECUTION_FAILED', formatExecutionFailure(submitted));
  }

  const submittedDigest = submitted.Transaction.digest;
  let finalized;
  try {
    finalized = await input.client.waitForTransaction({
      digest: submittedDigest,
      timeout: input.timeoutMs ?? 60_000,
      pollSchedule: input.pollScheduleMs ?? [0, 250, 500, 1_000, 2_000, 4_000],
      include: { effects: true, events: true, objectTypes: true },
    });
  } catch (error) {
    throw new PlayerTransactionExecutionError(
      'FINALITY_FAILED',
      error instanceof Error ? error.message : 'The transaction did not reach indexed finality in time.',
      { cause: error },
    );
  }
  if (finalized.$kind === 'FailedTransaction' || !finalized.Transaction.status.success) {
    throw new PlayerTransactionExecutionError('EXECUTION_FAILED', formatExecutionFailure(finalized));
  }
  const transaction = finalized.Transaction;
  if (
    transaction.digest !== submittedDigest ||
    transaction.checkpoint === null ||
    transaction.timestampMs === null ||
    !transaction.effects ||
    !transaction.events
  ) {
    throw new PlayerTransactionExecutionError(
      'FINALITY_FAILED',
      'The indexed transaction is missing its exact digest, checkpoint, timestamp, effects, or events.',
    );
  }

  const changedObjectIds = transaction.effects.changedObjects.map(({ objectId }) => normalized(objectId));
  try {
    const event = assertExpectedEvent(input.deployment, transaction.events, input.expectation);
    const required = [
      ...(input.expectation.requiredChangedObjectIds ?? []),
      event.createdObjectId,
      ...(input.expectation.kind === 'enroll' ? [event.seatId] : []),
    ].map(normalized);
    for (const requiredObjectId of required) {
      if (!changedObjectIds.includes(requiredObjectId)) {
        throw new Error(`Expected changed object ${requiredObjectId} is absent from finalized effects.`);
      }
    }
    return {
      digest: transaction.digest,
      checkpoint: transaction.checkpoint,
      timestampMs: transaction.timestampMs,
      changedObjectIds,
      event,
      simulation,
    };
  } catch (error) {
    throw new PlayerTransactionExecutionError(
      'RECONCILIATION_FAILED',
      error instanceof Error ? error.message : 'The finalized transaction did not match the player action.',
      { cause: error },
    );
  }
}

function objectVersion(object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>): ChainObjectVersion {
  return {
    objectId: normalized(object.objectId),
    version: object.version,
    digest: object.digest,
    previousTransaction: object.previousTransaction,
  };
}

function assertSharedObject(
  object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  objectId: string,
  type: string,
): void {
  if (
    normalized(object.objectId) !== normalized(objectId) ||
    object.type !== type ||
    object.owner.$kind !== 'Shared' ||
    !(object.content instanceof Uint8Array)
  ) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      `Object ${objectId} does not match the pinned shared ${type} identity.`,
    );
  }
}

function lifecycle(status: number): CivilizationLifecycle {
  const values: CivilizationLifecycle[] = [
    'AwaitingHome',
    'Active',
    'Eliminated',
    'Settled',
    'Cancelled',
  ];
  const value = values[status];
  if (!value) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      `Unknown CivilizationState lifecycle value ${status}.`,
    );
  }
  return value;
}

export async function readPlayerSeatBundle(
  client: Pick<SuiGrpcClient, 'getObjects'>,
  deployment: InfiniteStellarDeployment,
  controller: string,
): Promise<PlayerSeatBundle | PlayerNotEnrolled> {
  const routing = requireSeatRouting(deployment);
  const packageOrigin = routing.keyTypeOriginPackageId;
  const seasonId = requireAddress(deployment.manifestId, 'SeasonManifest ID');
  const canonicalController = requireAddress(controller, 'Controller');
  const seatId = deriveSeasonSeatId(deployment, canonicalController);
  const seatResponse = await client.getObjects({
    objectIds: [seatId],
    include: { content: true, previousTransaction: true },
  }).catch((error: unknown) => {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      error instanceof Error ? error.message : `The derived SeasonSeat ${seatId} could not be read.`,
      { cause: error },
    );
  });
  const seatObject = seatResponse.objects[0];
  if (seatObject instanceof ObjectError && seatObject.reason === 'notFound') {
    return { status: 'not-enrolled', seatId };
  }
  if (!seatObject || seatObject instanceof Error) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      seatObject?.message ?? `The derived SeasonSeat ${seatId} could not be read.`,
      { cause: seatObject },
    );
  }
  assertSharedObject(seatObject, seatId, `${packageOrigin}::identity::SeasonSeat`);

  let seat;
  try {
    seat = SeasonSeatBcs.parse(seatObject.content);
  } catch (error) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      `SeasonSeat ${seatId} has invalid BCS content.`,
      { cause: error },
    );
  }
  if (
    normalized(seat.id) !== seatId ||
    normalized(seat.season_id) !== seasonId ||
    seat.league !== routing.league ||
    normalized(seat.controller) !== canonicalController
  ) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      `SeasonSeat ${seatId} does not match its deterministic route and controller binding.`,
    );
  }

  const projectionId = normalized(seat.projection_id);
  const civilizationId = normalized(seat.civilization_id);
  const scoreCardId = normalized(seat.score_card_id);
  const childResponse = await client.getObjects({
    objectIds: [projectionId, civilizationId, scoreCardId],
    include: { content: true, previousTransaction: true },
  }).catch((error: unknown) => {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      error instanceof Error ? error.message : 'The Seat-bound objects could not be read.',
      { cause: error },
    );
  });
  const [projectionObject, civilizationObject, scoreObject] = childResponse.objects;
  if (
    !projectionObject || projectionObject instanceof Error ||
    !civilizationObject || civilizationObject instanceof Error ||
    !scoreObject || scoreObject instanceof Error
  ) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      'The SeasonSeat references a missing Projection, CivilizationState, or ScoreCard.',
    );
  }
  assertSharedObject(projectionObject, projectionId, `${packageOrigin}::identity::CommanderProjection`);
  assertSharedObject(civilizationObject, civilizationId, `${packageOrigin}::identity::CivilizationState`);
  assertSharedObject(scoreObject, scoreCardId, `${packageOrigin}::identity::ScoreCard`);

  let projection;
  let civilization;
  let score;
  try {
    projection = CommanderProjectionBcs.parse(projectionObject.content);
    civilization = CivilizationStateBcs.parse(civilizationObject.content);
    score = ScoreCardBcs.parse(scoreObject.content);
  } catch (error) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      'A Seat-bound object has invalid BCS content.',
      { cause: error },
    );
  }
  if (
    normalized(projection.id) !== projectionId ||
    normalized(projection.season_id) !== seasonId ||
    normalized(projection.seat_id) !== seatId ||
    normalized(projection.soul_id) !== normalized(seat.soul_id) ||
    normalized(projection.controller_at_enrollment) !== canonicalController ||
    normalized(civilization.id) !== civilizationId ||
    normalized(civilization.season_id) !== seasonId ||
    normalized(civilization.seat_id) !== seatId ||
    normalized(score.id) !== scoreCardId ||
    normalized(score.season_id) !== seasonId ||
    normalized(score.seat_id) !== seatId
  ) {
    throw new PlayerTransactionExecutionError(
      'READ_MODEL_INVALID',
      'The Seat-bound Projection, CivilizationState, or ScoreCard has a mismatched identity binding.',
    );
  }

  return {
    status: 'enrolled',
    seatId,
    seat: {
      ...objectVersion(seatObject),
      seasonId,
      league: seat.league,
      controller: canonicalController,
      soulId: normalized(seat.soul_id),
      projectionId,
      civilizationId,
      scoreCardId,
    },
    projection: {
      ...objectVersion(projectionObject),
      soulidityPackageId: normalized(projection.soulidity_package_id),
      soulStateId: normalized(projection.soul_state_id),
      soulId: normalized(projection.soul_id),
      controllerAtEnrollment: normalized(projection.controller_at_enrollment),
      ownershipEpochAtEnrollment: BigInt(projection.ownership_epoch_at_enrollment),
      projectionCommitment: Uint8Array.from(projection.projection_commitment),
    },
    civilization: {
      ...objectVersion(civilizationObject),
      lifecycle: lifecycle(civilization.status),
      controlledPlanetCount: BigInt(civilization.controlled_planet_count),
      pendingVoyageCount: BigInt(civilization.pending_voyage_count),
      spaceJunk: BigInt(civilization.space_junk),
      spaceJunkLimit: BigInt(civilization.space_junk_limit),
      shipsClaimed: civilization.ships_claimed,
      lastRevealAtSeconds: civilization.last_reveal_at_seconds === null
        ? null
        : BigInt(civilization.last_reveal_at_seconds),
      initialHomePlanetId: civilization.initial_home_planet_id
        ? normalized(civilization.initial_home_planet_id)
        : null,
      homeClaimConsumed: civilization.home_claim_consumed,
      activatedOnce: civilization.activated_once,
    },
    scoreCard: {
      ...objectVersion(scoreObject),
      score: BigInt(score.score),
      pendingScoredArrivalCount: BigInt(score.pending_scored_arrival_count),
    },
  };
}
