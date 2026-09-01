import { groth16 } from 'snarkjs';
import type { LoadedProofArtifacts } from './artifact-manifest';
import { BN254_SCALAR_FIELD } from './proof-intent';
import type { Groth16ProofJson } from './worker-protocol';

export interface GeneratedGroth16Proof {
  proof: Groth16ProofJson;
  publicSignals: string[];
  circuitId: string;
  circuitVersion: number;
  manifestSha256: string;
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
