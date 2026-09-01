import { poseidonHash } from '@mysten/sui/zklogin';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export const BN254_SCALAR_FIELD =
  21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617n;
export const PROOF_INTERFACE_VERSION = 1 as const;
export const PROOF_INTENT_DOMAIN = 'INFINITE_STELLAR_PROOF_INTENT_V1';
export const PROOF_INTENT_DOMAIN_FIELD =
  13_909_138_997_969_785_233_372_616_111_572_825_994_268_025_797_777_928_597_047_068_964_955_765_571_998n;
export const RULES_GEOMETRY_DOMAIN = 'INFINITE_STELLAR_RULES_GEOMETRY_V1';
export const RULES_GEOMETRY_DOMAIN_FIELD =
  6_053_036_279_538_949_956_273_599_243_158_082_485_469_979_069_117_808_157_047_738_621_272_655_476_926n;
export const RULES_GEOMETRY_SCHEMA_VERSION = 1 as const;
export const CIRCUIT_CONFIG_SCHEMA_VERSION = 1 as const;
export const CIRCUIT_CONFIG_DOMAIN = 'INFINITE_STELLAR_CIRCUIT_CONFIG_V1';
export const ROUND5_PLANET_HASH_THRESHOLD =
  1_824_020_239_319_939_601_853_867_145_438_106_257_379_030_366_701_336_195_308_183_682_214_650_707n;
export const ROUND5_RULES_GEOMETRY_COMMITMENT =
  18_458_232_501_308_633_390_557_626_324_462_719_473_351_388_298_275_374_257_305_522_239_595_784_888_932n;

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

export interface RulesGeometryV1 {
  worldRadius: number | bigint;
  planetHashThreshold: string | bigint;
  locationHashKey: number | bigint;
  spaceTypeKey: number | bigint;
  perlinScale: number | bigint;
  perlinMirrorX: boolean;
  perlinMirrorY: boolean;
  homePerlinMinInclusive: number | bigint;
  homePerlinMaxExclusive: number | bigint;
}

export interface CircuitConfigV1Input {
  actionKind: 'claim_home' | 'move';
  circuitSourceDigest: Uint8Array;
  provingKeyDigest: Uint8Array;
  ceremonyTranscriptDigest: Uint8Array;
  artifactManifestDigest: Uint8Array;
  verifyingKeyBytes: Uint8Array;
}

export interface CircuitConfigV1Digest {
  schemaVersion: typeof CIRCUIT_CONFIG_SCHEMA_VERSION;
  actionKind: number;
  proofInterfaceVersion: typeof PROOF_INTERFACE_VERSION;
  publicInputCount: 4;
  verifyingKeyDigest: Uint8Array;
  configDigest: Uint8Array;
}

export const ROUND5_RULES_GEOMETRY: Readonly<RulesGeometryV1> = {
  worldRadius: 12_000,
  planetHashThreshold: ROUND5_PLANET_HASH_THRESHOLD,
  locationHashKey: 115,
  spaceTypeKey: 116,
  perlinScale: 16_384,
  perlinMirrorX: false,
  perlinMirrorY: false,
  homePerlinMinInclusive: 13,
  homePerlinMaxExclusive: 14,
};

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

function bounded(value: number | bigint, maximum: bigint, name: string): bigint {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed > maximum) {
    throw new RangeError(`${name} must be between 0 and ${maximum}.`);
  }
  return parsed;
}

function appendU64LittleEndian(output: number[], value: bigint): void {
  let remaining = value;
  for (let index = 0; index < 8; index += 1) {
    output.push(Number(remaining & 0xffn));
    remaining >>= 8n;
  }
}

function digest32(value: Uint8Array, name: string): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== 32) {
    throw new RangeError(`${name} must be exactly 32 bytes.`);
  }
  return value;
}

/// Computes the fixed-width digest that is independently reproduced by the
/// immutable Sui Move CircuitConfig object. The raw verifying key is hashed,
/// never embedded in a JSON identity tuple by reference.
export function createCircuitConfigDigest(input: CircuitConfigV1Input): CircuitConfigV1Digest {
  if (!(input.verifyingKeyBytes instanceof Uint8Array) || input.verifyingKeyBytes.length !== 392) {
    throw new RangeError('verifyingKeyBytes must be the 392-byte BN254 interface-v1 Arkworks key.');
  }
  const actionKind = PROOF_ACTION_KIND[input.actionKind];
  if (actionKind !== PROOF_ACTION_KIND.claim_home && actionKind !== PROOF_ACTION_KIND.move) {
    throw new RangeError('CircuitConfig actionKind must be claim_home or move.');
  }
  const verifyingKeyDigest = sha256(input.verifyingKeyBytes);
  const encoded = [...new TextEncoder().encode(CIRCUIT_CONFIG_DOMAIN)];
  appendU64LittleEndian(encoded, BigInt(CIRCUIT_CONFIG_SCHEMA_VERSION));
  encoded.push(actionKind);
  appendU64LittleEndian(encoded, BigInt(PROOF_INTERFACE_VERSION));
  encoded.push(PROOF_PUBLIC_SIGNAL_ORDER.length);
  encoded.push(...digest32(input.circuitSourceDigest, 'circuitSourceDigest'));
  encoded.push(...digest32(input.provingKeyDigest, 'provingKeyDigest'));
  encoded.push(...verifyingKeyDigest);
  encoded.push(...digest32(input.ceremonyTranscriptDigest, 'ceremonyTranscriptDigest'));
  encoded.push(...digest32(input.artifactManifestDigest, 'artifactManifestDigest'));
  return {
    schemaVersion: CIRCUIT_CONFIG_SCHEMA_VERSION,
    actionKind,
    proofInterfaceVersion: PROOF_INTERFACE_VERSION,
    publicInputCount: 4,
    verifyingKeyDigest,
    configDigest: sha256(Uint8Array.from(encoded)),
  };
}

export function createRulesGeometryCommitment(geometry: RulesGeometryV1): bigint {
  const worldRadius = bounded(geometry.worldRadius, 0xffff_ffffn, 'worldRadius');
  if (worldRadius < 12_000n) throw new RangeError('worldRadius must be at least 12000.');
  const threshold = field(geometry.planetHashThreshold, 'planetHashThreshold');
  if (threshold === 0n) throw new RangeError('planetHashThreshold must be positive.');
  if (threshold >= (1n << 252n)) throw new RangeError('planetHashThreshold must fit 252 bits.');
  const locationHashKey = bounded(geometry.locationHashKey, 0xffff_ffff_ffff_ffffn, 'locationHashKey');
  const spaceTypeKey = bounded(geometry.spaceTypeKey, 0xffff_ffff_ffff_ffffn, 'spaceTypeKey');
  const perlinScale = bounded(geometry.perlinScale, 16_384n, 'perlinScale');
  if (perlinScale === 0n || (perlinScale & (perlinScale - 1n)) !== 0n) {
    throw new RangeError('perlinScale must be a power of two no greater than 16384.');
  }
  const homeMin = bounded(geometry.homePerlinMinInclusive, 31n, 'homePerlinMinInclusive');
  const homeMax = bounded(geometry.homePerlinMaxExclusive, 32n, 'homePerlinMaxExclusive');
  if (homeMin >= homeMax) throw new RangeError('The home Perlin interval must be non-empty.');
  return poseidonHash([
    RULES_GEOMETRY_DOMAIN_FIELD,
    BigInt(RULES_GEOMETRY_SCHEMA_VERSION),
    worldRadius,
    threshold,
    locationHashKey,
    spaceTypeKey,
    perlinScale,
    geometry.perlinMirrorX ? 1n : 0n,
    geometry.perlinMirrorY ? 1n : 0n,
    homeMin,
    homeMax,
  ]);
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
