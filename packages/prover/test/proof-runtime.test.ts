import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groth16 } from 'snarkjs';
import type { LoadedProofArtifacts, ProofArtifactManifestV1 } from '../src/artifact-manifest';
import { generateAndVerifyGroth16Proof } from '../src/proof-runtime';

vi.mock('snarkjs', () => ({
  groth16: {
    fullProve: vi.fn(),
    verify: vi.fn(),
  },
}));

const encoder = new TextEncoder();
const validProof = {
  pi_a: ['1', '2', '1'],
  pi_b: [['1', '2'], ['3', '4'], ['1', '0']],
  pi_c: ['5', '6', '1'],
  protocol: 'groth16',
  curve: 'bn128',
};

function loaded(): LoadedProofArtifacts {
  const manifest: ProofArtifactManifestV1 = {
    schemaVersion: 1,
    status: 'development',
    network: 'sui:mainnet',
    rulesetId: 'dark-forest-v06-round5',
    circuitId: 'round5-move',
    circuitVersion: 1,
    curve: 'bn254',
    publicSignals: [
      'source_location_hash',
      'destination_location_hash',
      'action_commitment',
      'rules_geometry_commitment',
    ],
    source: {
      repository: 'https://github.com/redefine-digital-labs/infinite-stellar',
      commit: 'a'.repeat(40),
      circuitSourceSha256: 'b'.repeat(64),
      buildImage: 'development-only',
    },
    trustedSetup: { kind: 'development' },
    artifacts: [],
  };
  return {
    manifest,
    manifestSha256: 'c'.repeat(64),
    artifacts: new Map([
      ['circuit-wasm', new Uint8Array([1])],
      ['proving-key', new Uint8Array([2])],
      ['verification-key', encoder.encode('{"protocol":"groth16"}')],
    ]),
    totalBytes: 3,
  };
}

describe('Groth16 proof runtime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only a locally verified four-signal proof', async () => {
    vi.mocked(groth16.fullProve).mockResolvedValue({
      proof: validProof,
      publicSignals: ['1', '2', '3', '4'],
    });
    vi.mocked(groth16.verify).mockResolvedValue(true);
    await expect(generateAndVerifyGroth16Proof(loaded(), { x: '9' })).resolves.toMatchObject({
      circuitId: 'round5-move',
      publicSignals: ['1', '2', '3', '4'],
    });
    expect(groth16.verify).toHaveBeenCalledOnce();
  });

  it('rejects malformed signals and a proof that fails self-verification', async () => {
    vi.mocked(groth16.fullProve).mockResolvedValue({ proof: validProof, publicSignals: ['1', '2', '3'] });
    await expect(generateAndVerifyGroth16Proof(loaded(), {})).rejects.toMatchObject({
      code: 'PUBLIC_SIGNAL_MISMATCH',
    });

    vi.mocked(groth16.fullProve).mockResolvedValue({
      proof: validProof,
      publicSignals: ['1', '2', '3', '4'],
    });
    vi.mocked(groth16.verify).mockResolvedValue(false);
    await expect(generateAndVerifyGroth16Proof(loaded(), {})).rejects.toMatchObject({
      code: 'SELF_VERIFICATION_FAILED',
    });
  });
});
