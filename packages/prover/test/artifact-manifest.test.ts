import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { describe, expect, it, vi } from 'vitest';
import {
  loadProofArtifacts,
  type ProofArtifactError,
  type ProofArtifactManifestV1,
  type ProofArtifactSelection,
  type ProofFetcher,
} from '../src/artifact-manifest';
import {
  MOVE_NEW_PUBLIC_SIGNAL_ORDER,
  PROOF_PUBLIC_SIGNAL_ORDER,
} from '../src/proof-intent';

const encoder = new TextEncoder();
const ARTIFACTS = {
  'circuit.wasm': encoder.encode('wasm fixture'),
  'proving.zkey': encoder.encode('proving fixture'),
  'verification.json': encoder.encode('{"protocol":"groth16"}'),
};

function digest(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function manifest(status: 'development' | 'production' = 'development'): ProofArtifactManifestV1 {
  return {
    schemaVersion: 1,
    status,
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
      commit: '1234567890abcdef1234567890abcdef12345678',
      circuitSourceSha256: '1'.repeat(64),
      buildImage: 'ghcr.io/redefine-digital-labs/infinite-stellar-circuits@sha256:' + '2'.repeat(64),
    },
    trustedSetup: status === 'production'
      ? { kind: 'phase2', ceremonyId: 'round5-phase2-v1', transcriptSha256: '3'.repeat(64) }
      : { kind: 'development' },
    artifacts: [
      {
        role: 'circuit-wasm',
        url: './circuit.wasm',
        sha256: digest(ARTIFACTS['circuit.wasm']),
        bytes: ARTIFACTS['circuit.wasm'].byteLength,
        mediaType: 'application/wasm',
      },
      {
        role: 'proving-key',
        url: './proving.zkey',
        sha256: digest(ARTIFACTS['proving.zkey']),
        bytes: ARTIFACTS['proving.zkey'].byteLength,
        mediaType: 'application/octet-stream',
      },
      {
        role: 'verification-key',
        url: './verification.json',
        sha256: digest(ARTIFACTS['verification.json']),
        bytes: ARTIFACTS['verification.json'].byteLength,
        mediaType: 'application/json',
      },
    ],
  };
}

function fixture(overrides: Partial<ProofArtifactSelection> = {}, status: 'development' | 'production' = 'development') {
  const body = encoder.encode(JSON.stringify(manifest(status)));
  const selection: ProofArtifactSelection = {
    manifestUrl: 'https://proof.infinite-stellar.example/round5/manifest.json',
    manifestSha256: digest(body),
    mode: status,
    expectedNetwork: 'sui:mainnet',
    expectedRulesetId: 'dark-forest-v06-round5',
    expectedCircuitId: 'round5-move',
    expectedCircuitVersion: 1,
    expectedPublicSignals: PROOF_PUBLIC_SIGNAL_ORDER,
    ...overrides,
  };
  return { body, selection };
}

function response(bytes: Uint8Array, mediaType: string, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: { get: (name: string) => name.toLowerCase() === 'content-type' ? mediaType : null },
    arrayBuffer: async () => {
      const payload = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(payload).set(bytes);
      return payload;
    },
  };
}

function fetcherFor(body: Uint8Array, overrides: Partial<Record<keyof typeof ARTIFACTS, Uint8Array>> = {}): ProofFetcher {
  return vi.fn(async (url: string) => {
    if (url.endsWith('manifest.json')) return response(body, 'application/json');
    const name = url.split('/').at(-1) as keyof typeof ARTIFACTS;
    const bytes = overrides[name] ?? ARTIFACTS[name];
    const mediaType = name === 'circuit.wasm'
      ? 'application/wasm'
      : name === 'verification.json' ? 'application/json' : 'application/octet-stream';
    return response(bytes, mediaType);
  });
}

async function expectCode(promise: Promise<unknown>, code: ProofArtifactError['code']) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('proof artifact manifest preflight', () => {
  it.each(['development', 'production'] as const)('loads a fully pinned %s artifact set', async (status) => {
    const { body, selection } = fixture({}, status);
    const progress = vi.fn();
    const loaded = await loadProofArtifacts(selection, fetcherFor(body), progress);

    expect(loaded.manifest.status).toBe(status);
    expect(loaded.artifacts.size).toBe(3);
    expect(loaded.manifestSha256).toBe(selection.manifestSha256);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ loadedArtifacts: 3 }));
  });

  it('accepts the pinned five-signal move-new extension and rejects other orders', async () => {
    const moveNew = manifest();
    moveNew.circuitId = 'round5-move-new';
    moveNew.publicSignals = [
      'source_location_hash',
      'destination_location_hash',
      'destination_space_perlin',
      'action_commitment',
      'rules_geometry_commitment',
    ];
    const body = encoder.encode(JSON.stringify(moveNew));
    const selection = fixture({
      manifestSha256: digest(body),
      expectedCircuitId: 'round5-move-new',
      expectedPublicSignals: MOVE_NEW_PUBLIC_SIGNAL_ORDER,
    }).selection;
    await expect(loadProofArtifacts(selection, fetcherFor(body))).resolves.toMatchObject({
      manifest: { publicSignals: moveNew.publicSignals },
    });

    moveNew.publicSignals = [...moveNew.publicSignals].reverse();
    const invalidBody = encoder.encode(JSON.stringify(moveNew));
    await expectCode(loadProofArtifacts(
      { ...selection, manifestSha256: digest(invalidBody) },
      fetcherFor(invalidBody),
    ), 'INVALID_MANIFEST');
  });

  it('rejects an unpinned or mismatched manifest', async () => {
    const { body, selection } = fixture({ manifestSha256: 'f'.repeat(64) });
    await expectCode(loadProofArtifacts(selection, fetcherFor(body)), 'UNPINNED_MANIFEST');
  });

  it.each([
    ['expectedNetwork', 'sui:testnet'],
    ['expectedRulesetId', 'another-ruleset'],
    ['expectedCircuitId', 'another-circuit'],
    ['expectedCircuitVersion', 2],
  ] as const)('rejects a mismatched %s', async (key, value) => {
    const { body, selection } = fixture({ [key]: value });
    await expectCode(loadProofArtifacts(selection, fetcherFor(body)), 'MANIFEST_MISMATCH');
  });

  it('rejects a manifest whose public-signal order differs from the selected action', async () => {
    const { body, selection } = fixture({ expectedPublicSignals: MOVE_NEW_PUBLIC_SIGNAL_ORDER });
    await expectCode(loadProofArtifacts(selection, fetcherFor(body)), 'MANIFEST_MISMATCH');
  });

  it('rejects development setup in production mode', async () => {
    const { body, selection } = fixture({ mode: 'production' });
    await expectCode(loadProofArtifacts(selection, fetcherFor(body)), 'DEVELOPMENT_SETUP_REJECTED');
  });

  it('requires HTTPS for every production manifest and artifact', async () => {
    const production = fixture({}, 'production');
    await expectCode(
      loadProofArtifacts(
        { ...production.selection, manifestUrl: 'http://proof.infinite-stellar.example/manifest.json' },
        fetcherFor(production.body),
      ),
      'INVALID_MANIFEST',
    );

    const value = manifest('production');
    value.artifacts[0]!.url = 'http://cdn.example/circuit.wasm';
    const body = encoder.encode(JSON.stringify(value));
    const { selection } = fixture({ manifestSha256: digest(body), allowCrossOriginArtifacts: true }, 'production');
    await expectCode(loadProofArtifacts(selection, fetcherFor(body)), 'INVALID_MANIFEST');
  });

  it('rejects cross-origin artifacts unless season policy permits them', async () => {
    const value = manifest();
    value.artifacts[0]!.url = 'https://cdn.example/circuit.wasm';
    const body = encoder.encode(JSON.stringify(value));
    const { selection } = fixture({ manifestSha256: digest(body) });
    await expectCode(loadProofArtifacts(selection, fetcherFor(body)), 'CROSS_ORIGIN_ARTIFACT');
  });

  it('rejects artifact size and hash tampering', async () => {
    const { body, selection } = fixture();
    await expectCode(
      loadProofArtifacts(selection, fetcherFor(body, { 'circuit.wasm': encoder.encode('short') })),
      'ARTIFACT_SIZE_MISMATCH',
    );
    await expectCode(
      loadProofArtifacts(selection, fetcherFor(body, { 'circuit.wasm': encoder.encode('XXXXXXXXXXXX') })),
      'ARTIFACT_HASH_MISMATCH',
    );
  });

  it('rejects an artifact with the wrong media type', async () => {
    const { body, selection } = fixture();
    const fetcher: ProofFetcher = async (url) => url.endsWith('manifest.json')
      ? response(body, 'application/json')
      : response(ARTIFACTS['circuit.wasm'], 'text/html');
    await expectCode(loadProofArtifacts(selection, fetcher), 'ARTIFACT_MEDIA_TYPE_MISMATCH');
  });

  it('rejects a set above the selected memory budget before fetching artifacts', async () => {
    const { body, selection } = fixture({ maxTotalBytes: 1 });
    const fetcher = fetcherFor(body);
    await expectCode(loadProofArtifacts(selection, fetcher), 'ARTIFACT_BUDGET_EXCEEDED');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('honors cancellation before downloading the next artifact', async () => {
    const { body, selection } = fixture();
    const controller = new AbortController();
    const fetcher: ProofFetcher = vi.fn(async (url) => {
      if (url.endsWith('manifest.json')) {
        controller.abort();
        return response(body, 'application/json');
      }
      throw new Error('artifact fetch must not start');
    });
    await expect(loadProofArtifacts(selection, fetcher, undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
