import { Transaction } from '@mysten/sui/transactions';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  createMoveNewProofIntentCommitment,
  createProofIntentCommitment,
  type SuiProofSubmission,
} from '@infinite-stellar/prover';

export interface CircuitConfigPin {
  objectId: string;
  circuitId: string;
  circuitVersion: number;
  artifactManifestSha256: string;
  configDigest: string;
  verifyingKeyDigest: string;
}

export interface ProofIntentDeploymentPin {
  network: 'sui:mainnet';
  rulesetId: string;
  league: number;
  rulesGeometryCommitment: string;
}

export interface SeatRoutingPin {
  keyTypeOriginPackageId: string;
  keyEncodingVersion: number;
  league: number;
}

export interface ProductionReleaseEvidencePin {
  schemaVersion: 1;
  ceremonyTranscriptSha256: string;
  circuitAuditSha256: string;
  moveAuditSha256: string;
  clientAuditSha256: string;
  operationsApprovalSha256: string;
  multisigPolicySha256: string;
}

export interface InfiniteStellarDeployment {
  network: 'localnet' | 'devnet' | 'testnet' | 'mainnet';
  packageId?: string;
  manifestId?: string;
  runtimeId?: string;
  enrollmentRegistryId?: string;
  planetRegistryId?: string;
  randomObjectId?: string;
  clockObjectId?: string;
  soulidityCallablePackageId?: string;
  soulidityOriginalPackageId?: string;
  claimHomeCircuitConfig?: CircuitConfigPin;
  moveCircuitConfig?: CircuitConfigPin;
  moveNewCircuitConfig?: CircuitConfigPin;
  proofIntent?: ProofIntentDeploymentPin;
  seatRouting?: SeatRoutingPin;
  productionReleaseEvidence?: ProductionReleaseEvidencePin;
  productionSoulAdapterReady: boolean;
  productionProofVerifierReady: boolean;
}

export interface EnrollmentTransactionInput {
  soulStateId: string;
  sender: string;
  projectionCommitment: Uint8Array;
}

interface PlayerActionInput {
  seatId: string;
  civilizationId: string;
  sender: string;
  deadlineMs: string | bigint;
  proof: SuiProofSubmission;
}

export interface HomeClaimTransactionInput extends PlayerActionInput {
  scoreCardId: string;
  destinationLocationHash: string | bigint;
}

export interface MoveTransactionInput extends PlayerActionInput {
  sourcePlanetId: string;
  targetPlanetId: string;
  sourceLocationHash: string | bigint;
  destinationLocationHash: string | bigint;
  sourcePlanetNonce: string | bigint;
  maxDistance: string | bigint;
  sentEnergy: string | bigint;
  sentSilver: string | bigint;
}

export interface MoveNewTransactionInput extends Omit<MoveTransactionInput, 'targetPlanetId'> {
  destinationSpacePerlin: number;
}

const CANONICAL_OBJECT_ID = /^0x[0-9a-f]{64}$/;
const HEX_DIGEST = /^[0-9a-f]{64}$/;
const MAX_U64 = 0xffff_ffff_ffff_ffffn;

function requireCanonicalObjectId(value: string | undefined, label: string): string {
  if (!value || !CANONICAL_OBJECT_ID.test(value)) {
    throw new TransactionPreparationError('INVALID_INPUT', `${label} must be a canonical 32-byte Sui object ID.`);
  }
  return value;
}

function requireU64(value: string | bigint, label: string): bigint {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    throw new TransactionPreparationError('INVALID_INPUT', `${label} must be an unsigned 64-bit integer.`);
  }
  if (parsed < 0n || parsed > MAX_U64) {
    throw new TransactionPreparationError('INVALID_INPUT', `${label} must be an unsigned 64-bit integer.`);
  }
  return parsed;
}

function requireCircuitConfigPin(
  pin: CircuitConfigPin | undefined,
  action: 'claim_home' | 'move' | 'move_new',
): CircuitConfigPin {
  if (
    !pin ||
    !CANONICAL_OBJECT_ID.test(pin.objectId) ||
    typeof pin.circuitId !== 'string' || pin.circuitId.length === 0 ||
    !Number.isSafeInteger(pin.circuitVersion) || pin.circuitVersion < 1 ||
    !HEX_DIGEST.test(pin.artifactManifestSha256) ||
    !HEX_DIGEST.test(pin.configDigest) ||
    !HEX_DIGEST.test(pin.verifyingKeyDigest)
  ) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      `The ${action} CircuitConfig object and both 32-byte digests must be pinned.`,
    );
  }
  return pin;
}

function requireProductionReleaseEvidence(
  deployment: InfiniteStellarDeployment,
): ProductionReleaseEvidencePin {
  const evidence = deployment.productionReleaseEvidence;
  if (
    !evidence || evidence.schemaVersion !== 1 ||
    !HEX_DIGEST.test(evidence.ceremonyTranscriptSha256) ||
    !HEX_DIGEST.test(evidence.circuitAuditSha256) ||
    !HEX_DIGEST.test(evidence.moveAuditSha256) ||
    !HEX_DIGEST.test(evidence.clientAuditSha256) ||
    !HEX_DIGEST.test(evidence.operationsApprovalSha256) ||
    !HEX_DIGEST.test(evidence.multisigPolicySha256)
  ) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'Ranked player writes require exact ceremony, audit, operations, and multisig evidence digests.',
    );
  }
  return evidence;
}

export class IntegrationUnavailableError extends Error {
  readonly code:
    | 'DEPLOYMENT_UNAVAILABLE'
    | 'SOUL_ADAPTER_UNAVAILABLE'
    | 'PROOF_VERIFIER_UNAVAILABLE';

  constructor(
    code: IntegrationUnavailableError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationUnavailableError';
    this.code = code;
  }
}

export class TransactionPreparationError extends Error {
  constructor(
    readonly code: 'INVALID_INPUT' | 'PROOF_STATEMENT_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'TransactionPreparationError';
  }
}

function requireProductionProofIntent(deployment: InfiniteStellarDeployment): ProofIntentDeploymentPin {
  if (deployment.network !== 'mainnet' || !deployment.proofIntent) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'Proof-backed player transactions require a mainnet deployment with an exact proof-intent pin.',
    );
  }
  const pin = deployment.proofIntent;
  if (
    pin.network !== 'sui:mainnet' ||
    typeof pin.rulesetId !== 'string' || pin.rulesetId.length === 0 ||
    !Number.isSafeInteger(pin.league) || pin.league < 0 || pin.league > 255 ||
    !/^(0|[1-9][0-9]*)$/.test(pin.rulesGeometryCommitment)
  ) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The production proof-intent network, ruleset, league, and geometry commitment must be pinned.',
    );
  }
  if (deployment.seatRouting && deployment.seatRouting.league !== pin.league) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The proof-intent league does not match the deterministic Seat-routing league.',
    );
  }
  return pin;
}

export function assertRankedReleaseDeploymentReady(
  deployment: InfiniteStellarDeployment,
): void {
  if (!deployment.productionSoulAdapterReady) {
    throw new IntegrationUnavailableError(
      'SOUL_ADAPTER_UNAVAILABLE',
      'Ranked enrollment is disabled until the manifest-pinned Soulidity adapter is ready.',
    );
  }
  if (!deployment.productionProofVerifierReady) {
    throw new IntegrationUnavailableError(
      'PROOF_VERIFIER_UNAVAILABLE',
      'Ranked enrollment is disabled until every production proof verifier is ready.',
    );
  }
  if (deployment.network !== 'mainnet') {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'A ranked production release requires an explicit mainnet deployment record.',
    );
  }
  const objectPins = [
    deployment.packageId,
    deployment.manifestId,
    deployment.runtimeId,
    deployment.enrollmentRegistryId,
    deployment.planetRegistryId,
    deployment.randomObjectId,
    deployment.clockObjectId,
    deployment.soulidityCallablePackageId,
    deployment.soulidityOriginalPackageId,
  ];
  if (objectPins.some((value) => !value || !CANONICAL_OBJECT_ID.test(value))) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The ranked release requires every game, registry, system, and Soulidity object pin.',
    );
  }
  requireCircuitConfigPin(deployment.claimHomeCircuitConfig, 'claim_home');
  requireCircuitConfigPin(deployment.moveCircuitConfig, 'move');
  requireCircuitConfigPin(deployment.moveNewCircuitConfig, 'move_new');
  const intent = requireProductionProofIntent(deployment);
  const routing = deployment.seatRouting;
  if (
    !routing || !CANONICAL_OBJECT_ID.test(routing.keyTypeOriginPackageId) ||
    !Number.isSafeInteger(routing.keyEncodingVersion) || routing.keyEncodingVersion !== 1 ||
    !Number.isSafeInteger(routing.league) || routing.league < 0 || routing.league > 255 ||
    routing.league !== intent.league
  ) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The ranked release requires the exact v1 deterministic Seat-routing pin.',
    );
  }
  requireProductionReleaseEvidence(deployment);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireProofSubmission(
  proof: SuiProofSubmission,
  config: CircuitConfigPin,
  intentPin: ProofIntentDeploymentPin,
  expectedSignals: readonly bigint[],
  expectedPublicInputs: Uint8Array,
  expectedPublicInputDigest: string,
): Uint8Array {
  const canonicalSignals = expectedSignals.map((signal) => signal.toString());
  if (
    proof.network !== intentPin.network ||
    proof.rulesetId !== intentPin.rulesetId ||
    proof.circuitId !== config.circuitId ||
    proof.circuitVersion !== config.circuitVersion ||
    proof.artifactManifestSha256 !== config.artifactManifestSha256 ||
    proof.verifyingKeyDigest !== config.verifyingKeyDigest ||
    proof.publicSignals.length !== canonicalSignals.length ||
    proof.publicSignals.some((signal, index) => signal !== canonicalSignals[index]) ||
    !(proof.publicInputs instanceof Uint8Array) ||
    !equalBytes(proof.publicInputs, expectedPublicInputs) ||
    proof.publicInputDigest !== expectedPublicInputDigest ||
    bytesToHex(sha256(proof.publicInputs)) !== expectedPublicInputDigest ||
    !(proof.proofBytes instanceof Uint8Array) || proof.proofBytes.length !== 128
  ) {
    throw new TransactionPreparationError(
      'PROOF_STATEMENT_MISMATCH',
      'The prepared proof does not match the deployment pins and exact player action intent.',
    );
  }
  return proof.proofBytes;
}

function proofIntentOrInputError<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof TransactionPreparationError || error instanceof IntegrationUnavailableError) throw error;
    throw new TransactionPreparationError(
      'INVALID_INPUT',
      error instanceof Error ? error.message : 'The proof action input is invalid.',
    );
  }
}

function requireObjectIds(deployment: InfiniteStellarDeployment): asserts deployment is InfiniteStellarDeployment & {
  packageId: string;
  manifestId: string;
  runtimeId: string;
} {
  if (
    !deployment.packageId || !deployment.manifestId || !deployment.runtimeId ||
    !CANONICAL_OBJECT_ID.test(deployment.packageId) ||
    !CANONICAL_OBJECT_ID.test(deployment.manifestId) ||
    !CANONICAL_OBJECT_ID.test(deployment.runtimeId)
  ) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'Infinite Stellar has no pinned package, manifest, and runtime for this network.',
    );
  }
}

export function buildOpenUniverseTransaction(
  deployment: InfiniteStellarDeployment,
): Transaction {
  requireObjectIds(deployment);
  if (!deployment.randomObjectId || !deployment.clockObjectId) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'Random and Clock object IDs are required to open the universe.',
    );
  }
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::season::open_universe`,
    arguments: [
      transaction.object(deployment.manifestId),
      transaction.object(deployment.runtimeId),
      transaction.object(deployment.randomObjectId),
      transaction.object(deployment.clockObjectId),
    ],
  });
  return transaction;
}

export function buildTickHomeAvailabilityTransaction(
  deployment: InfiniteStellarDeployment,
): Transaction {
  requireObjectIds(deployment);
  if (!deployment.clockObjectId) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The Sui Clock object ID is required.',
    );
  }
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::season::tick_home_availability`,
    arguments: [
      transaction.object(deployment.manifestId),
      transaction.object(deployment.runtimeId),
      transaction.object(deployment.clockObjectId),
    ],
  });
  return transaction;
}

export function buildResolveHomeWindowTransaction(
  deployment: InfiniteStellarDeployment,
): Transaction {
  requireObjectIds(deployment);
  if (!deployment.clockObjectId) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The Sui Clock object ID is required.',
    );
  }
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::season::resolve_home_window`,
    arguments: [
      transaction.object(deployment.manifestId),
      transaction.object(deployment.runtimeId),
      transaction.object(deployment.clockObjectId),
    ],
  });
  return transaction;
}

export function buildEnrollmentTransaction(
  deployment: InfiniteStellarDeployment,
  input: EnrollmentTransactionInput,
): Transaction {
  assertRankedReleaseDeploymentReady(deployment);
  if (!(input.projectionCommitment instanceof Uint8Array) || input.projectionCommitment.length !== 32) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The Commander Projection commitment must be exactly 32 bytes.',
    );
  }
  const sender = requireCanonicalObjectId(input.sender, 'Sender address');
  const soulStateId = requireCanonicalObjectId(input.soulStateId, 'SoulState ID');
  const packageId = requireCanonicalObjectId(deployment.packageId, 'Infinite Stellar package ID');
  const manifestId = requireCanonicalObjectId(deployment.manifestId, 'Season Manifest ID');
  const enrollmentRegistryId = requireCanonicalObjectId(
    deployment.enrollmentRegistryId,
    'EnrollmentRegistry ID',
  );
  const clockObjectId = requireCanonicalObjectId(deployment.clockObjectId, 'Clock ID');

  const transaction = new Transaction();
  transaction.setSender(sender);
  transaction.moveCall({
    target: `${packageId}::soul_adapter::enroll`,
    arguments: [
      transaction.object(manifestId),
      transaction.object(enrollmentRegistryId),
      transaction.object(soulStateId),
      transaction.pure.vector('u8', Array.from(input.projectionCommitment)),
      transaction.object(clockObjectId),
    ],
  });
  return transaction;
}

export function buildHomeClaimTransaction(
  deployment: InfiniteStellarDeployment,
  input: HomeClaimTransactionInput,
): Transaction {
  if (!deployment.productionProofVerifierReady) {
    throw new IntegrationUnavailableError(
      'PROOF_VERIFIER_UNAVAILABLE',
      'Home claiming is disabled until the manifest-pinned proof verifier is ready.',
    );
  }
  requireObjectIds(deployment);
  requireProductionReleaseEvidence(deployment);
  const config = requireCircuitConfigPin(deployment.claimHomeCircuitConfig, 'claim_home');
  const intentPin = requireProductionProofIntent(deployment);
  const registryId = requireCanonicalObjectId(deployment.planetRegistryId, 'PlanetRegistry ID');
  const clockId = requireCanonicalObjectId(deployment.clockObjectId, 'Clock ID');
  const seatId = requireCanonicalObjectId(input.seatId, 'SeasonSeat ID');
  const civilizationId = requireCanonicalObjectId(input.civilizationId, 'CivilizationState ID');
  const scoreCardId = requireCanonicalObjectId(input.scoreCardId, 'ScoreCard ID');
  requireCanonicalObjectId(input.sender, 'Sender address');
  const deadlineMs = requireU64(input.deadlineMs, 'deadlineMs');
  return proofIntentOrInputError(() => {
    const intent = createProofIntentCommitment({
      network: intentPin.network,
      league: intentPin.league,
      actionKind: 'claim_home',
      seasonId: deployment.manifestId,
      seatId,
      sender: input.sender,
      sourceLocationHash: 0n,
      destinationLocationHash: input.destinationLocationHash,
      amount: 0n,
      sourcePlanetNonce: 0n,
      deadlineMs,
      rulesGeometryCommitment: intentPin.rulesGeometryCommitment,
    });
    const proofBytes = requireProofSubmission(
      input.proof,
      config,
      intentPin,
      intent.publicSignals,
      intent.publicInputBytes,
      intent.publicInputDigest,
    );
    const transaction = new Transaction();
    transaction.setSender(input.sender);
    transaction.moveCall({
      target: `${deployment.packageId}::proof_actions::claim_home`,
      arguments: [
        transaction.object(config.objectId),
        transaction.object(deployment.manifestId),
        transaction.object(deployment.runtimeId),
        transaction.object(registryId),
        transaction.object(seatId),
        transaction.object(civilizationId),
        transaction.object(scoreCardId),
        transaction.pure.u256(BigInt(input.destinationLocationHash)),
        transaction.pure.u64(deadlineMs),
        transaction.pure.vector('u8', Array.from(proofBytes)),
        transaction.object(clockId),
      ],
    });
    return transaction;
  });
}

export function buildMoveTransaction(
  deployment: InfiniteStellarDeployment,
  input: MoveTransactionInput,
): Transaction {
  if (!deployment.productionProofVerifierReady) {
    throw new IntegrationUnavailableError(
      'PROOF_VERIFIER_UNAVAILABLE',
      'Fleet dispatch is disabled until the manifest-pinned proof verifier is ready.',
    );
  }
  requireObjectIds(deployment);
  requireProductionReleaseEvidence(deployment);
  const config = requireCircuitConfigPin(deployment.moveCircuitConfig, 'move');
  const intentPin = requireProductionProofIntent(deployment);
  const clockId = requireCanonicalObjectId(deployment.clockObjectId, 'Clock ID');
  const seatId = requireCanonicalObjectId(input.seatId, 'SeasonSeat ID');
  const civilizationId = requireCanonicalObjectId(input.civilizationId, 'CivilizationState ID');
  const sourcePlanetId = requireCanonicalObjectId(input.sourcePlanetId, 'Source Planet ID');
  const targetPlanetId = requireCanonicalObjectId(input.targetPlanetId, 'Target Planet ID');
  requireCanonicalObjectId(input.sender, 'Sender address');
  const deadlineMs = requireU64(input.deadlineMs, 'deadlineMs');
  const sourcePlanetNonce = requireU64(input.sourcePlanetNonce, 'sourcePlanetNonce');
  const maxDistance = requireU64(input.maxDistance, 'maxDistance');
  const sentEnergy = requireU64(input.sentEnergy, 'sentEnergy');
  const sentSilver = requireU64(input.sentSilver, 'sentSilver');
  if (maxDistance > MAX_U64 / 100n) {
    throw new TransactionPreparationError('INVALID_INPUT', 'maxDistance exceeds the Move verifier bound.');
  }
  return proofIntentOrInputError(() => {
    const intent = createProofIntentCommitment({
      network: intentPin.network,
      league: intentPin.league,
      actionKind: 'move',
      seasonId: deployment.manifestId,
      seatId,
      sender: input.sender,
      sourceLocationHash: input.sourceLocationHash,
      destinationLocationHash: input.destinationLocationHash,
      amount: maxDistance,
      sourcePlanetNonce,
      deadlineMs,
      rulesGeometryCommitment: intentPin.rulesGeometryCommitment,
    });
    const proofBytes = requireProofSubmission(
      input.proof,
      config,
      intentPin,
      intent.publicSignals,
      intent.publicInputBytes,
      intent.publicInputDigest,
    );
    const transaction = new Transaction();
    transaction.setSender(input.sender);
    transaction.moveCall({
      target: `${deployment.packageId}::proof_actions::dispatch_move`,
      arguments: [
        transaction.object(config.objectId),
        transaction.object(deployment.manifestId),
        transaction.object(deployment.runtimeId),
        transaction.object(seatId),
        transaction.object(civilizationId),
        transaction.object(sourcePlanetId),
        transaction.object(targetPlanetId),
        transaction.pure.u64(maxDistance),
        transaction.pure.u64(sentEnergy),
        transaction.pure.u64(sentSilver),
        transaction.pure.u64(deadlineMs),
        transaction.pure.vector('u8', Array.from(proofBytes)),
        transaction.object(clockId),
      ],
    });
    return transaction;
  });
}

export function buildMoveNewTransaction(
  deployment: InfiniteStellarDeployment,
  input: MoveNewTransactionInput,
): Transaction {
  if (!deployment.productionProofVerifierReady) {
    throw new IntegrationUnavailableError(
      'PROOF_VERIFIER_UNAVAILABLE',
      'Natural-planet discovery is disabled until the manifest-pinned proof verifier is ready.',
    );
  }
  requireObjectIds(deployment);
  requireProductionReleaseEvidence(deployment);
  const config = requireCircuitConfigPin(deployment.moveNewCircuitConfig, 'move_new');
  const intentPin = requireProductionProofIntent(deployment);
  const registryId = requireCanonicalObjectId(deployment.planetRegistryId, 'PlanetRegistry ID');
  const clockId = requireCanonicalObjectId(deployment.clockObjectId, 'Clock ID');
  const seatId = requireCanonicalObjectId(input.seatId, 'SeasonSeat ID');
  const civilizationId = requireCanonicalObjectId(input.civilizationId, 'CivilizationState ID');
  const sourcePlanetId = requireCanonicalObjectId(input.sourcePlanetId, 'Source Planet ID');
  requireCanonicalObjectId(input.sender, 'Sender address');
  const deadlineMs = requireU64(input.deadlineMs, 'deadlineMs');
  const sourcePlanetNonce = requireU64(input.sourcePlanetNonce, 'sourcePlanetNonce');
  const maxDistance = requireU64(input.maxDistance, 'maxDistance');
  const sentEnergy = requireU64(input.sentEnergy, 'sentEnergy');
  const sentSilver = requireU64(input.sentSilver, 'sentSilver');
  if (!Number.isSafeInteger(input.destinationSpacePerlin) || input.destinationSpacePerlin < 0 || input.destinationSpacePerlin > 31) {
    throw new TransactionPreparationError('INVALID_INPUT', 'destinationSpacePerlin must be between 0 and 31.');
  }
  if (maxDistance > MAX_U64 / 100n) {
    throw new TransactionPreparationError('INVALID_INPUT', 'maxDistance exceeds the Move verifier bound.');
  }
  return proofIntentOrInputError(() => {
    const intent = createMoveNewProofIntentCommitment({
      network: intentPin.network,
      league: intentPin.league,
      actionKind: 'move_new',
      seasonId: deployment.manifestId,
      seatId,
      sender: input.sender,
      sourceLocationHash: input.sourceLocationHash,
      destinationLocationHash: input.destinationLocationHash,
      amount: maxDistance,
      sourcePlanetNonce,
      deadlineMs,
      rulesGeometryCommitment: intentPin.rulesGeometryCommitment,
    }, input.destinationSpacePerlin);
    const proofBytes = requireProofSubmission(
      input.proof,
      config,
      intentPin,
      intent.publicSignals,
      intent.publicInputBytes,
      intent.publicInputDigest,
    );
    const transaction = new Transaction();
    transaction.setSender(input.sender);
    transaction.moveCall({
      target: `${deployment.packageId}::proof_actions::dispatch_move_new`,
      arguments: [
        transaction.object(config.objectId),
        transaction.object(deployment.manifestId),
        transaction.object(deployment.runtimeId),
        transaction.object(registryId),
        transaction.object(seatId),
        transaction.object(civilizationId),
        transaction.object(sourcePlanetId),
        transaction.pure.u256(BigInt(input.destinationLocationHash)),
        transaction.pure.u8(input.destinationSpacePerlin),
        transaction.pure.u64(maxDistance),
        transaction.pure.u64(sentEnergy),
        transaction.pure.u64(sentSilver),
        transaction.pure.u64(deadlineMs),
        transaction.pure.vector('u8', Array.from(proofBytes)),
        transaction.object(clockId),
      ],
    });
    return transaction;
  });
}

export const UNCONFIGURED_TESTNET: InfiniteStellarDeployment = {
  network: 'testnet',
  productionSoulAdapterReady: false,
  productionProofVerifierReady: false,
};
