import { poseidonHash } from '@mysten/sui/zklogin';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const BN254_SCALAR_FIELD =
  21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617n;
export const PROOF_INTERFACE_VERSION = 1 as const;
export const PROOF_INTENT_DOMAIN = 'INFINITE_STELLAR_PROOF_INTENT_V1';
export const PROOF_INTENT_DOMAIN_FIELD =
  13_909_138_997_969_785_233_372_616_111_572_825_994_268_025_797_777_928_597_047_068_964_955_765_571_998n;
export const ROUND5_RULES_GEOMETRY_COMMITMENT =
  6_761_147_084_378_425_910_415_724_448_274_404_356_606_413_803_680_297_929_056_799_117_911_141_148_911n;

export const PROOF_PUBLIC_SIGNAL_ORDER = [
  'source_location_hash',
  'destination_location_hash',
  'action_commitment',
  'rules_geometry_commitment',
] as const;

export type ProofPublicSignalName = typeof PROOF_PUBLIC_SIGNAL_ORDER[number];
export type ProofActionKind = 'claim_home' | 'move' | 'reveal' | 'capture';

export const PROOF_ACTION_KIND: Readonly<Record<ProofActionKind, number>> = {
  claim_home: 1,
  move: 2,
  reveal: 3,
  capture: 4,
};

export interface ProofIntentV1 {
  network: string;
  league: number;
  actionKind: ProofActionKind;
  seasonId: string;
  seatId: string;
  sender: string;
  sourceLocationHash: string | bigint;
  destinationLocationHash: string | bigint;
  amount: number | bigint;
  sourcePlanetNonce: number | bigint;
  deadlineMs: number | bigint;
  rulesGeometryCommitment: string | bigint;
}

export interface ProofIntentCommitmentV1 {
  interfaceVersion: typeof PROOF_INTERFACE_VERSION;
  domainField: bigint;
  networkField: bigint;
  contextField: bigint;
  actionFields: readonly bigint[];
  publicSignals: readonly [bigint, bigint, bigint, bigint];
  publicInputBytes: Uint8Array;
  publicInputDigest: string;
}

function domainField(label: string): bigint {
  const digest = sha256(new TextEncoder().encode(label));
  return BigInt(`0x${bytesToHex(digest)}`) % BN254_SCALAR_FIELD;
}

function field(value: string | number | bigint, name: string): bigint {
  let parsed: bigint;
  try {
    parsed = typeof value === 'string' && value.startsWith('0x')
      ? BigInt(value)
      : BigInt(value);
  } catch {
    throw new RangeError(`${name} must be an integer field element.`);
  }
  if (parsed < 0n || parsed >= BN254_SCALAR_FIELD) {
    throw new RangeError(`${name} must be a canonical BN254 scalar field element.`);
  }
  return parsed;
}

function boundedU64(value: number | bigint, name: string): bigint {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError(`${name} must fit an unsigned 64-bit integer.`);
  }
  return parsed;
}

function hex256(value: string, name: string): bigint {
  const normalized = value.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{1,64}$/.test(normalized)) {
    throw new RangeError(`${name} must be a hexadecimal Sui address or object ID up to 32 bytes.`);
  }
  return BigInt(`0x${normalized}`);
}

export function splitSuiIdentifier(value: string, name = 'identifier'): readonly [bigint, bigint] {
  const encoded = hex256(value, name);
  const limbBase = 1n << 128n;
  return [encoded % limbBase, encoded / limbBase];
}

function littleEndian32(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

export function serializeProofPublicSignals(signals: readonly bigint[]): Uint8Array {
  if (signals.length !== PROOF_PUBLIC_SIGNAL_ORDER.length) {
    throw new RangeError(`Proof interface v1 requires exactly ${PROOF_PUBLIC_SIGNAL_ORDER.length} public signals.`);
  }
  const output = new Uint8Array(signals.length * 32);
  signals.forEach((signal, index) => output.set(littleEndian32(field(signal, `publicSignals[${index}]`)), index * 32));
  return output;
}

export function createProofIntentCommitment(intent: ProofIntentV1): ProofIntentCommitmentV1 {
  if (!Number.isSafeInteger(intent.league) || intent.league < 0 || intent.league > 255) {
    throw new RangeError('league must fit an unsigned 8-bit integer.');
  }
  const actionKind = PROOF_ACTION_KIND[intent.actionKind];
  const networkField = domainField(intent.network);
  const contextField = poseidonHash([networkField, intent.league]);
  const [seasonLow, seasonHigh] = splitSuiIdentifier(intent.seasonId, 'seasonId');
  const [seatLow, seatHigh] = splitSuiIdentifier(intent.seatId, 'seatId');
  const [senderLow, senderHigh] = splitSuiIdentifier(intent.sender, 'sender');
  const sourceLocationHash = field(intent.sourceLocationHash, 'sourceLocationHash');
  const destinationLocationHash = field(intent.destinationLocationHash, 'destinationLocationHash');
  const rulesGeometryCommitment = field(intent.rulesGeometryCommitment, 'rulesGeometryCommitment');
  const actionFields = [
    PROOF_INTENT_DOMAIN_FIELD,
    BigInt(PROOF_INTERFACE_VERSION),
    BigInt(actionKind),
    contextField,
    seasonLow,
    seasonHigh,
    seatLow,
    seatHigh,
    senderLow,
    senderHigh,
    sourceLocationHash,
    destinationLocationHash,
    boundedU64(intent.amount, 'amount'),
    boundedU64(intent.sourcePlanetNonce, 'sourcePlanetNonce'),
    boundedU64(intent.deadlineMs, 'deadlineMs'),
    rulesGeometryCommitment,
  ] as const;
  const actionCommitment = poseidonHash([...actionFields]);
  const publicSignals = [
    sourceLocationHash,
    destinationLocationHash,
    actionCommitment,
    rulesGeometryCommitment,
  ] as const;
  const publicInputBytes = serializeProofPublicSignals(publicSignals);
  return {
    interfaceVersion: PROOF_INTERFACE_VERSION,
    domainField: PROOF_INTENT_DOMAIN_FIELD,
    networkField,
    contextField,
    actionFields,
    publicSignals,
    publicInputBytes,
    publicInputDigest: bytesToHex(sha256(publicInputBytes)),
  };
}

export function proofNetworkField(network: string): bigint {
  return domainField(network);
}
