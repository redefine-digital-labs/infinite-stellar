import { serializeProofPublicSignals } from './proof-intent.js';

const BN254_BASE_FIELD =
  21_888_242_871_839_275_222_246_405_745_257_275_088_696_311_157_297_823_662_689_037_894_645_226_208_583n;

export interface SnarkjsGroth16Proof {
  pi_a: unknown;
  pi_b: unknown;
  pi_c: unknown;
  protocol?: string;
  curve?: string;
}

export interface SnarkjsGroth16VerificationKey {
  vk_alpha_1: unknown;
  vk_beta_2: unknown;
  vk_gamma_2: unknown;
  vk_delta_2: unknown;
  IC: unknown[];
  protocol?: string;
  curve?: string;
  nPublic?: number;
}

export interface SuiGroth16Bytes {
  verifyingKey: Uint8Array;
  proofPoints: Uint8Array;
  publicInputs: Uint8Array;
}

function assertBn254(label: string, protocol?: string, curve?: string): void {
  if (protocol !== undefined && protocol !== 'groth16') {
    throw new TypeError(`${label} must use the Groth16 protocol.`);
  }
  if (curve !== undefined && curve !== 'bn128' && curve !== 'bn254') {
    throw new TypeError(`${label} must use the BN254 curve.`);
  }
}

function writeU64LittleEndian(bytes: Uint8Array, offset: number, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Vector length must be a safe u64.');
  let remaining = BigInt(value);
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

function canonicalFq(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new TypeError(`${label} must be a canonical decimal BN254 base-field element.`);
  }
  const parsed = BigInt(value);
  if (parsed >= BN254_BASE_FIELD) throw new RangeError(`${label} is outside the BN254 base field.`);
  return parsed;
}

function littleEndianFq(value: bigint): Uint8Array {
  const bytes = new Uint8Array(32);
  let remaining = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function negateFq(value: bigint): bigint {
  return value === 0n ? 0n : BN254_BASE_FIELD - value;
}

function serializeG1(value: unknown, label: string): Uint8Array {
  if (!Array.isArray(value) || value.length < 2) throw new TypeError(`${label} must be a snarkjs G1 point.`);
  if (value.length >= 3 && value[2] !== '1') throw new TypeError(`${label} must be a finite affine point.`);
  const x = canonicalFq(value[0], `${label}.x`);
  const y = canonicalFq(value[1], `${label}.y`);
  const bytes = littleEndianFq(x);
  // Arkworks SWFlags sets the MSB when y is greater than its field negation.
  if (y > negateFq(y)) bytes[31] = bytes[31]! | 0x80;
  return bytes;
}

function serializeG2(value: unknown, label: string): Uint8Array {
  if (!Array.isArray(value) || value.length < 2 || !Array.isArray(value[0]) || !Array.isArray(value[1])) {
    throw new TypeError(`${label} must be a snarkjs G2 point.`);
  }
  if (
    value.length >= 3 &&
    (!Array.isArray(value[2]) || value[2][0] !== '1' || value[2][1] !== '0')
  ) {
    throw new TypeError(`${label} must be a finite affine point.`);
  }
  const x0 = canonicalFq(value[0][0], `${label}.x.c0`);
  const x1 = canonicalFq(value[0][1], `${label}.x.c1`);
  const y0 = canonicalFq(value[1][0], `${label}.y.c0`);
  const y1 = canonicalFq(value[1][1], `${label}.y.c1`);
  const bytes = new Uint8Array(64);
  bytes.set(littleEndianFq(x0), 0);
  bytes.set(littleEndianFq(x1), 32);
  // Arkworks orders Fq2 lexicographically by c1 and then c0.
  const negativeY1 = negateFq(y1);
  const negativeY0 = negateFq(y0);
  if (y1 > negativeY1 || (y1 === negativeY1 && y0 > negativeY0)) {
    bytes[63] = bytes[63]! | 0x80;
  }
  return bytes;
}

/// Converts snarkjs affine JSON into the exact Arkworks canonical-compressed
/// byte sequence consumed by sui::groth16 on BN254.
export async function serializeSnarkjsGroth16ForSui(
  proof: SnarkjsGroth16Proof,
  verificationKey: SnarkjsGroth16VerificationKey,
  publicSignals: readonly (string | bigint)[],
): Promise<SuiGroth16Bytes> {
  assertBn254('proof', proof.protocol, proof.curve);
  assertBn254('verification key', verificationKey.protocol, verificationKey.curve);
  if (!Array.isArray(verificationKey.IC) || verificationKey.IC.length !== publicSignals.length + 1) {
    throw new RangeError('The verification key IC length must equal public signal count plus one.');
  }
  if (verificationKey.nPublic !== undefined && verificationKey.nPublic !== publicSignals.length) {
    throw new RangeError('The verification key nPublic value does not match the public signals.');
  }

  const canonicalSignals = publicSignals.map((signal, index) => {
    if (typeof signal === 'string' && !/^(0|[1-9][0-9]*)$/.test(signal)) {
      throw new RangeError(`publicSignals[${index}] is not canonical decimal.`);
    }
    return BigInt(signal);
  });
  const publicInputs = serializeProofPublicSignals(canonicalSignals);
  const proofPoints = new Uint8Array(128);
  proofPoints.set(serializeG1(proof.pi_a, 'proof.pi_a'), 0);
  proofPoints.set(serializeG2(proof.pi_b, 'proof.pi_b'), 32);
  proofPoints.set(serializeG1(proof.pi_c, 'proof.pi_c'), 96);

  // Arkworks VerifyingKey canonical serialization is alpha G1, beta/gamma/
  // delta G2, then a u64 little-endian Vec length and each gamma_abc G1.
  const verifyingKey = new Uint8Array(232 + verificationKey.IC.length * 32);
  verifyingKey.set(serializeG1(verificationKey.vk_alpha_1, 'verificationKey.vk_alpha_1'), 0);
  verifyingKey.set(serializeG2(verificationKey.vk_beta_2, 'verificationKey.vk_beta_2'), 32);
  verifyingKey.set(serializeG2(verificationKey.vk_gamma_2, 'verificationKey.vk_gamma_2'), 96);
  verifyingKey.set(serializeG2(verificationKey.vk_delta_2, 'verificationKey.vk_delta_2'), 160);
  writeU64LittleEndian(verifyingKey, 224, verificationKey.IC.length);
  verificationKey.IC.forEach((point, index) => {
    verifyingKey.set(serializeG1(point, `verificationKey.IC[${index}]`), 232 + index * 32);
  });
  return { verifyingKey, proofPoints, publicInputs };
}
