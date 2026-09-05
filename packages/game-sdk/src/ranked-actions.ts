import {
  createMoveNewProofIntentCommitment, createProofIntentCommitment,
  MOVE_NEW_PUBLIC_SIGNAL_ORDER, PROOF_PUBLIC_SIGNAL_ORDER, proofNetworkField,
  splitSuiIdentifier, type SuiProofSubmission,
} from '@infinite-stellar/prover';
import { mergeRankedPrivateMap, type RankedPrivateMapRecord } from './ranked-map';
import { rankedSeasonGeometry } from './ranked-miner';
import type { RankedKnownUniverseProjection } from './ranked-projection';
import { routeDistanceBound } from './routing';
import {
  assertRankedReleaseDeploymentReady, buildHomeClaimTransaction, buildMoveNewTransaction,
  buildMoveTransaction, type CircuitConfigPin, type HomeClaimTransactionInput,
  type InfiniteStellarDeployment, type MoveNewTransactionInput, type MoveTransactionInput,
} from './sui-gateway';
import { deriveSeasonSeatId, type PlayerActionExpectation, type PlayerSeatBundle } from './sui-player-runtime';

export type RankedActionRequest =
  | { kind: 'claim_home'; destinationLocationId: string }
  | { kind: 'move'; sourceLocationId: string; destinationLocationId: string; sentEnergy: bigint; sentSilver: bigint };

export interface RankedActionContext {
  deployment: InfiniteStellarDeployment;
  seat: PlayerSeatBundle;
  projection: RankedKnownUniverseProjection;
  record: RankedPrivateMapRecord;
  /** A current time observation for preflight, never a substitute for Sui Clock. */
  nowMs: bigint;
  deadlineMs: bigint;
}

type PreparedTransaction =
  | { kind: 'claim_home'; input: Omit<HomeClaimTransactionInput, 'proof'> }
  | { kind: 'move'; input: Omit<MoveTransactionInput, 'proof'> }
  | { kind: 'move_new'; input: Omit<MoveNewTransactionInput, 'proof'> };

export interface PreparedRankedAction {
  transaction: PreparedTransaction;
  circuit: CircuitConfigPin;
  /** Send only to the local prover Worker. Never serialize into a recovery journal or RPC. */
  privateWitness: Record<string, string>;
  publicSignalOrder: readonly string[];
  publicSignals: string[];
  publicInputDigest: string;
  expectation: PlayerActionExpectation;
}

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function u64(value: bigint, label: string): bigint {
  requireCondition(typeof value === 'bigint' && value >= 0n && value <= 0xffff_ffff_ffff_ffffn,
    `${label} must be an exact u64.`);
  return value;
}

function coordinates(prefix: string, value: { x: number; y: number }): Record<string, string> {
  return {
    [`${prefix}x_magnitude`]: Math.abs(value.x).toString(),
    [`${prefix}x_sign`]: value.x < 0 ? '1' : '0',
    [`${prefix}y_magnitude`]: Math.abs(value.y).toString(),
    [`${prefix}y_sign`]: value.y < 0 ? '1' : '0',
  };
}

/** Prepare from fresh BCS point reads plus locally revalidated coordinate preimages.
 * This does not prove, sign, simulate, mutate a Planet, or upload coordinates.
 */
export function prepareRankedAction(context: RankedActionContext, request: RankedActionRequest): PreparedRankedAction {
  const { deployment, seat, projection, record, nowMs, deadlineMs } = context;
  assertRankedReleaseDeploymentReady(deployment);
  const pin = deployment.proofIntent!;
  const { manifest, runtime } = projection;
  u64(nowMs, 'Current time');
  u64(deadlineMs, 'Proof deadline');
  requireCondition(deadlineMs > nowMs, 'The proof deadline must be in the future.');
  requireCondition(
    record.packageId === deployment.packageId && record.seasonId === deployment.manifestId &&
    record.typeOriginPackageId === deployment.seatRouting!.keyTypeOriginPackageId &&
    record.planetRegistryId === deployment.planetRegistryId &&
    seat.seatId === deriveSeasonSeatId(deployment, record.controllerAddress) &&
    seat.seat.objectId === seat.seatId && seat.seat.league === pin.league &&
    seat.civilization.objectId === seat.seat.civilizationId && seat.scoreCard.objectId === seat.seat.scoreCardId &&
    manifest.league === pin.league && manifest.runtimeId === deployment.runtimeId &&
    manifest.enrollmentRegistryId === deployment.enrollmentRegistryId &&
    runtime.objectId === deployment.runtimeId &&
    manifest.proofNetworkField === proofNetworkField(pin.network) &&
    manifest.rulesGeometryCommitment.toString() === pin.rulesGeometryCommitment,
    'The action context does not match the pinned deployment, Seat, or Season.',
  );
  const geometry = rankedSeasonGeometry(projection);
  requireCondition(runtime.universeOpened && !runtime.cancelled && !runtime.settlementStarted,
    'The Season is not open for player actions.');
  requireCondition(nowMs < manifest.seasonEndAtMs && deadlineMs < manifest.seasonEndAtMs,
    'The action and its proof deadline must precede the Season end.');
  requireCondition(projection.coverage === 'known-private-locations', 'Exact private-location point reads are required.');
  const map = mergeRankedPrivateMap(record, seat, projection, record);
  const target = map.planets.find((planet) => planet.locationId === request.destinationLocationId);
  requireCondition(target, 'The destination has no verified private coordinates.');
  const verifyRead = (planet: typeof target) => {
    requireCondition(projection.requestedPlanetIds.includes(planet.objectId), 'The selected Planet was not included in fresh point reads.');
    const missing = projection.missingPlanetIds.includes(planet.objectId);
    requireCondition(missing === !planet.materialized, 'Planet existence is ambiguous in the point-read result.');
    requireCondition(!planet.destroyed && (!planet.chain || planet.chain.seasonId === record.seasonId),
      'The selected Planet is destroyed or belongs to another Season.');
  };
  verifyRead(target);
  const common = {
    seatId: seat.seatId, civilizationId: seat.civilization.objectId,
    sender: record.controllerAddress, deadlineMs,
    destinationLocationHash: BigInt(`0x${target.locationId}`),
  };
  let transaction: PreparedTransaction;
  let expectation: PlayerActionExpectation;
  let coordinateWitness: Record<string, string>;
  let sourceHash = 0n;
  let nonce = 0n;
  let distance = 0n;
  if (request.kind === 'claim_home') {
    requireCondition(seat.civilization.lifecycle === 'AwaitingHome' && !seat.civilization.homeClaimConsumed &&
      !seat.civilization.activatedOnce && seat.civilization.initialHomePlanetId === null,
    'This Seat is not eligible for its first home claim.');
    requireCondition(!runtime.paused && runtime.homeWindowResolution === 'Pending' &&
      nowMs >= runtime.homeClaimNotBeforeAtMs && nowMs < manifest.homeClaimCloseAtMs &&
      deadlineMs < manifest.homeClaimCloseAtMs, 'The home claim window is not available for this proof deadline.');
    requireCondition(!target.materialized, 'The home candidate is already materialized onchain.');
    requireCondition(target.perlin >= manifest.homePerlinMin && target.perlin < manifest.homePerlinMax,
      'The destination is outside the Season home Perlin band.');
    transaction = { kind: 'claim_home', input: { ...common, scoreCardId: seat.scoreCard.objectId } };
    expectation = {
      kind: 'claim_home', seasonId: record.seasonId, seatId: seat.seatId, planetId: target.objectId,
      requiredChangedObjectIds: [target.objectId, seat.civilization.objectId],
    };
    coordinateWitness = coordinates('', target);
  } else {
    requireCondition(seat.civilization.lifecycle === 'Active' && seat.civilization.activatedOnce,
      'Only an active Civilization can dispatch a fleet.');
    requireCondition(nowMs < manifest.homeClaimCloseAtMs || runtime.homeWindowResolution === 'ClosedAvailable',
      'The closed home window must be resolved before dispatch.');
    const source = map.planets.find((planet) => planet.locationId === request.sourceLocationId);
    requireCondition(source && source.objectId !== target.objectId, 'Select two different verified Planets.');
    verifyRead(source);
    requireCondition(source.chain && source.chain.ownerSeatId === seat.seatId,
      'The source must be a materialized Planet currently controlled by this Seat.');
    for (const planet of [source, target]) {
      requireCondition(!planet.chain?.pendingVoyages.some((voyage) => voyage.arrivalAtSeconds <= nowMs / 1000n),
        'Settle due arrivals on the selected Planets before preparing a fleet proof.');
    }
    const sentEnergy = u64(request.sentEnergy, 'Sent energy');
    const sentSilver = u64(request.sentSilver, 'Sent silver');
    requireCondition(sentEnergy > 0n, 'A normal fleet must send positive energy.');
    // Live growth, energy decay, silver capacity and arrival queues are rechecked by simulation/Move.
    sourceHash = BigInt(`0x${source.locationId}`);
    nonce = u64(source.chain.proofNonce, 'Source Planet nonce');
    distance = routeDistanceBound(source, target);
    const input = {
      ...common, sourcePlanetId: source.objectId, sourceLocationHash: sourceHash,
      sourcePlanetNonce: nonce, maxDistance: distance, sentEnergy, sentSilver,
    };
    transaction = target.materialized
      ? { kind: 'move', input: { ...input, targetPlanetId: target.objectId } }
      : { kind: 'move_new', input: { ...input, destinationSpacePerlin: target.perlin } };
    expectation = {
      kind: transaction.kind, seasonId: record.seasonId, seatId: seat.seatId,
      fromPlanetId: source.objectId, toPlanetId: target.objectId,
      requiredChangedObjectIds: [source.objectId, target.objectId, seat.civilization.objectId],
    };
    coordinateWitness = { ...coordinates('source_', source), ...coordinates('destination_', target) };
  }
  const circuit = transaction.kind === 'claim_home' ? deployment.claimHomeCircuitConfig!
    : transaction.kind === 'move' ? deployment.moveCircuitConfig! : deployment.moveNewCircuitConfig!;
  const binding = transaction.kind === 'claim_home' ? manifest.claimHomeCircuit
    : transaction.kind === 'move' ? manifest.moveCircuit : manifest.moveNewCircuit;
  requireCondition(binding.configId === circuit.objectId && binding.configDigest === circuit.configDigest &&
    binding.verifyingKeyDigest === circuit.verifyingKeyDigest, 'The action circuit is not bound to this Season.');
  const intent = {
    network: pin.network, league: pin.league, actionKind: transaction.kind, seasonId: record.seasonId,
    seatId: seat.seatId, sender: record.controllerAddress, sourceLocationHash: sourceHash,
    destinationLocationHash: common.destinationLocationHash, sourcePlanetNonce: nonce, amount: distance,
    deadlineMs, rulesGeometryCommitment: geometry.rulesGeometryCommitment,
  };
  const commitment = transaction.kind === 'move_new'
    ? createMoveNewProofIntentCommitment(intent, target.perlin) : createProofIntentCommitment(intent);
  const order = transaction.kind === 'move_new' ? MOVE_NEW_PUBLIC_SIGNAL_ORDER : PROOF_PUBLIC_SIGNAL_ORDER;
  const publicSignals = commitment.publicSignals.map(String);
  const [seasonLow, seasonHigh] = splitSuiIdentifier(record.seasonId);
  const [seatLow, seatHigh] = splitSuiIdentifier(seat.seatId);
  const [senderLow, senderHigh] = splitSuiIdentifier(record.controllerAddress);
  const privateWitness = {
    ...Object.fromEntries(order.map((name, index) => [name, publicSignals[index]!])),
    network_field: commitment.networkField.toString(), league: pin.league.toString(),
    season_id_low_128: seasonLow.toString(), season_id_high_128: seasonHigh.toString(),
    seat_id_low_128: seatLow.toString(), seat_id_high_128: seatHigh.toString(),
    sender_low_128: senderLow.toString(), sender_high_128: senderHigh.toString(),
    deadline_ms: deadlineMs.toString(), geometry_schema_version: '1',
    world_radius: manifest.worldRadius.toString(), planet_hash_threshold: manifest.planetHashThreshold.toString(),
    location_hash_key: manifest.locationHashKey.toString(), space_type_key: manifest.spaceTypeKey.toString(),
    perlin_scale: manifest.perlinScale.toString(), perlin_mirror_x: manifest.perlinMirrorX ? '1' : '0',
    perlin_mirror_y: manifest.perlinMirrorY ? '1' : '0', home_perlin_min: manifest.homePerlinMin.toString(),
    home_perlin_max: manifest.homePerlinMax.toString(), ...coordinateWitness,
    ...(transaction.kind !== 'claim_home' ? { max_distance: distance.toString(), source_planet_nonce: nonce.toString() } : {}),
  };
  return {
    transaction, circuit: { ...circuit }, privateWitness, publicSignalOrder: [...order],
    publicSignals, publicInputDigest: commitment.publicInputDigest, expectation,
  };
}

/** Call with a freshly prepared context after proving. Gateway rechecks the full public statement. */
export function buildPreparedRankedActionTransaction(
  deployment: InfiniteStellarDeployment,
  prepared: PreparedRankedAction,
  proof: SuiProofSubmission,
) {
  assertRankedReleaseDeploymentReady(deployment);
  const action = prepared.transaction;
  if (action.kind === 'claim_home') return buildHomeClaimTransaction(deployment, { ...action.input, proof });
  if (action.kind === 'move_new') return buildMoveNewTransaction(deployment, { ...action.input, proof });
  return buildMoveTransaction(deployment, { ...action.input, proof });
}
