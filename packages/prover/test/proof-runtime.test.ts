import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groth16 } from 'snarkjs';
import type { LoadedProofArtifacts, ProofArtifactManifestV1 } from '../src/artifact-manifest';
import {
  generateAndVerifyGroth16Proof,
  prepareSuiProofSubmission,
} from '../src/proof-runtime';

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

function loadedWithSerializableVerificationKey(): LoadedProofArtifacts {
  const value = loaded();
  const artifacts = new Map(value.artifacts);
  artifacts.set('verification-key', encoder.encode(JSON.stringify({
    protocol: 'groth16',
    curve: 'bn128',
    nPublic: 4,
    vk_alpha_1: ['1', '2', '1'],
    vk_beta_2: [['1', '2'], ['3', '4'], ['1', '0']],
    vk_gamma_2: [['5', '6'], ['7', '8'], ['1', '0']],
    vk_delta_2: [['9', '10'], ['11', '12'], ['1', '0']],
    IC: Array.from({ length: 5 }, (_, index) => [String(index + 13), String(index + 23), '1']),
  })));
  return { ...value, artifacts };
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

  it('accepts a manifest-pinned five-signal move-new proof', async () => {
    const moveNew = loaded();
    moveNew.manifest.publicSignals = [
      'source_location_hash',
      'destination_location_hash',
      'destination_space_perlin',
      'action_commitment',
      'rules_geometry_commitment',
    ];
    vi.mocked(groth16.fullProve).mockResolvedValue({
      proof: validProof,
      publicSignals: ['1', '2', '14', '3', '4'],
    });
    vi.mocked(groth16.verify).mockResolvedValue(true);
    await expect(generateAndVerifyGroth16Proof(moveNew, {})).resolves.toMatchObject({
      publicSignals: ['1', '2', '14', '3', '4'],
    });
  });

  it('prepares exact Sui proof bytes only for the independently expected statement', async () => {
    const artifacts = loadedWithSerializableVerificationKey();
    const generated = {
      proof: validProof,
      publicSignals: ['1', '2', '3', '4'],
      circuitId: artifacts.manifest.circuitId,
      circuitVersion: artifacts.manifest.circuitVersion,
      manifestSha256: artifacts.manifestSha256,
    };
    await expect(prepareSuiProofSubmission(
      artifacts,
      generated,
      ['1', '2', '3', '4'],
    )).resolves.toMatchObject({
      network: 'sui:mainnet',
      rulesetId: 'dark-forest-v06-round5',
      circuitId: 'round5-move',
      publicSignals: ['1', '2', '3', '4'],
      proofBytes: expect.objectContaining({ length: 128 }),
      publicInputs: expect.objectContaining({ length: 128 }),
    });

    await expect(prepareSuiProofSubmission(
      artifacts,
      generated,
      ['1', '2', '3', '5'],
    )).rejects.toMatchObject({ code: 'PUBLIC_SIGNAL_MISMATCH' });
  });
});
