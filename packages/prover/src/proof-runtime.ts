import { groth16 } from 'snarkjs';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import type { LoadedProofArtifacts } from './artifact-manifest';
import { BN254_SCALAR_FIELD, serializeProofPublicSignals } from './proof-intent';
import {
  serializeSnarkjsGroth16ForSui,
  type SnarkjsGroth16VerificationKey,
} from './sui-groth16';
import type { Groth16ProofJson } from './worker-protocol';

export interface GeneratedGroth16Proof {
  proof: Groth16ProofJson;
  publicSignals: string[];
  circuitId: string;
  circuitVersion: number;
  manifestSha256: string;
}

export interface SuiProofSubmission {
  network: string;
  rulesetId: string;
  circuitId: string;
  circuitVersion: number;
  artifactManifestSha256: string;
  verifyingKeyDigest: string;
  publicSignals: string[];
  publicInputs: Uint8Array;
  publicInputDigest: string;
  proofBytes: Uint8Array;
}

export class ProofGenerationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ProofGenerationError';
  }
}

function requiredArtifact(loaded: LoadedProofArtifacts, role: 'circuit-wasm' | 'proving-key' | 'verification-key'): Uint8Array {
  const artifact = loaded.artifacts.get(role);
  if (!artifact) throw new ProofGenerationError('ARTIFACT_MISSING', `The ${role} artifact is missing.`);
  return artifact;
}

function assertCanonicalPublicSignals(publicSignals: string[], expectedCount: number): void {
  if (publicSignals.length !== expectedCount) {
    throw new ProofGenerationError(
      'PUBLIC_SIGNAL_MISMATCH',
      `The proof did not return the manifest-pinned ${expectedCount} public signals.`,
    );
  }
  for (const signal of publicSignals) {
    if (!/^(0|[1-9][0-9]*)$/.test(signal)) {
      throw new ProofGenerationError('PUBLIC_SIGNAL_MISMATCH', 'A proof public signal is not a canonical decimal integer.');
    }
    const value = BigInt(signal);
    if (value < 0n || value >= BN254_SCALAR_FIELD) {
      throw new ProofGenerationError('PUBLIC_SIGNAL_MISMATCH', 'A proof public signal is outside the BN254 scalar field.');
    }
  }
}

export async function generateAndVerifyGroth16Proof(
  loaded: LoadedProofArtifacts,
  witness: Record<string, string>,
): Promise<GeneratedGroth16Proof> {
  const wasm = requiredArtifact(loaded, 'circuit-wasm');
  const provingKey = requiredArtifact(loaded, 'proving-key');
  const verificationKeyBytes = requiredArtifact(loaded, 'verification-key');
  let verificationKey: Record<string, unknown>;
  try {
    verificationKey = JSON.parse(new TextDecoder().decode(verificationKeyBytes)) as Record<string, unknown>;
  } catch {
    throw new ProofGenerationError('VERIFICATION_KEY_INVALID', 'The verification-key artifact is not valid JSON.');
  }

  const { proof, publicSignals } = await groth16.fullProve(witness, wasm, provingKey);
  assertCanonicalPublicSignals(publicSignals, loaded.manifest.publicSignals.length);
  if (!await groth16.verify(verificationKey, publicSignals, proof)) {
    throw new ProofGenerationError('SELF_VERIFICATION_FAILED', 'The generated proof failed local verification.');
  }
  return {
    proof,
    publicSignals,
    circuitId: loaded.manifest.circuitId,
    circuitVersion: loaded.manifest.circuitVersion,
    manifestSha256: loaded.manifestSha256,
  };
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/// Produces the exact proof-point bytes consumed by `sui::groth16` and refuses
/// to prepare a transaction if the generated proof statement differs from the
/// caller's independently recomputed action intent.
export async function prepareSuiProofSubmission(
  loaded: LoadedProofArtifacts,
  generated: GeneratedGroth16Proof,
  expectedPublicSignals: readonly (string | bigint)[],
): Promise<SuiProofSubmission> {
  if (
    generated.circuitId !== loaded.manifest.circuitId ||
    generated.circuitVersion !== loaded.manifest.circuitVersion ||
    generated.manifestSha256 !== loaded.manifestSha256
  ) {
    throw new ProofGenerationError(
      'ARTIFACT_CACHE_MISMATCH',
      'The generated proof does not belong to the currently loaded artifact manifest.',
    );
  }
  const canonicalExpected = expectedPublicSignals.map((signal) => BigInt(signal).toString());
  assertCanonicalPublicSignals(canonicalExpected, loaded.manifest.publicSignals.length);
  if (
    generated.publicSignals.length !== canonicalExpected.length ||
    generated.publicSignals.some((signal, index) => signal !== canonicalExpected[index])
  ) {
    throw new ProofGenerationError(
      'PUBLIC_SIGNAL_MISMATCH',
      'The generated proof public statement does not match the requested action intent.',
    );
  }

  const verificationKeyBytes = requiredArtifact(loaded, 'verification-key');
  let verificationKey: SnarkjsGroth16VerificationKey;
  try {
    verificationKey = JSON.parse(new TextDecoder().decode(verificationKeyBytes)) as SnarkjsGroth16VerificationKey;
  } catch {
    throw new ProofGenerationError('VERIFICATION_KEY_INVALID', 'The verification-key artifact is not valid JSON.');
  }
  const serialized = await serializeSnarkjsGroth16ForSui(
    generated.proof,
    verificationKey,
    canonicalExpected,
  );
  const expectedPublicInputs = serializeProofPublicSignals(canonicalExpected.map(BigInt));
  if (!equalBytes(serialized.publicInputs, expectedPublicInputs)) {
    throw new ProofGenerationError(
      'PUBLIC_SIGNAL_MISMATCH',
      'Sui public-input serialization differs from the requested action intent.',
    );
  }

  return {
    network: loaded.manifest.network,
    rulesetId: loaded.manifest.rulesetId,
    circuitId: loaded.manifest.circuitId,
    circuitVersion: loaded.manifest.circuitVersion,
    artifactManifestSha256: loaded.manifestSha256,
    verifyingKeyDigest: bytesToHex(sha256(serialized.verifyingKey)),
    publicSignals: canonicalExpected,
    publicInputs: serialized.publicInputs,
    publicInputDigest: bytesToHex(sha256(serialized.publicInputs)),
    proofBytes: serialized.proofPoints,
  };
}
