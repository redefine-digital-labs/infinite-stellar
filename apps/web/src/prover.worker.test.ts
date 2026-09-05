import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ProverModule from '@infinite-stellar/prover';
import {
  loadProofArtifacts, generateAndVerifyGroth16Proof, prepareSuiProofSubmission,
  PROOF_ARTIFACT_WORKER_VERSION, PROOF_PUBLIC_SIGNAL_ORDER, ProofArtifactError,
  type LoadedProofArtifacts, type ProofArtifactSelection, type ProofArtifactWorkerRequest,
} from '@infinite-stellar/prover';

vi.mock('@infinite-stellar/prover', async (original) => ({
  ...await original<typeof ProverModule>(),
  loadProofArtifacts: vi.fn(), generateAndVerifyGroth16Proof: vi.fn(), prepareSuiProofSubmission: vi.fn(),
}));

const selection: ProofArtifactSelection = {
  manifestUrl: 'https://artifacts.example/home.json', manifestSha256: 'a'.repeat(64),
  mode: 'development', expectedNetwork: 'sui:mainnet', expectedRulesetId: 'round5',
  expectedCircuitId: 'home', expectedCircuitVersion: 1, expectedPublicSignals: PROOF_PUBLIC_SIGNAL_ORDER,
};

function loaded(hash = selection.manifestSha256): LoadedProofArtifacts {
  return { manifestSha256: hash, totalBytes: 0, artifacts: new Map(),
    manifest: { schemaVersion: 1, status: 'development', network: 'sui:mainnet', rulesetId: 'round5',
      circuitId: 'home', circuitVersion: 1, curve: 'bn254', publicSignals: [...PROOF_PUBLIC_SIGNAL_ORDER],
      source: { repository: 'test', commit: '0'.repeat(40), circuitSourceSha256: '0'.repeat(64), buildImage: 'test' },
      trustedSetup: { kind: 'development' }, artifacts: [] } };
}

describe('proof Worker cache isolation', () => {
  let receive: (event: MessageEvent<ProofArtifactWorkerRequest>) => void;
  const postMessage = vi.fn();
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('self', { postMessage,
      addEventListener: (_: string, listener: typeof receive) => { receive = listener; } });
    await import('./prover.worker');
  });
  afterEach(() => vi.unstubAllGlobals());
  const preflight = (requestId: string, pin = selection) => receive({ data: {
    type: 'preflight', version: PROOF_ARTIFACT_WORKER_VERSION, requestId, selection: pin,
  } } as MessageEvent<ProofArtifactWorkerRequest>);

  it('reuses only the complete same selection and refuses cached development in production', async () => {
    vi.mocked(loadProofArtifacts).mockResolvedValueOnce(loaded());
    preflight('first');
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', requestId: 'first' })));
    preflight('cached');
    expect(loadProofArtifacts).toHaveBeenCalledTimes(1);
    vi.mocked(loadProofArtifacts).mockRejectedValueOnce(new ProofArtifactError('DEVELOPMENT_SETUP_REJECTED', 'Development keys rejected.'));
    preflight('production', { ...selection, mode: 'production' });
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'failed', requestId: 'production', code: 'DEVELOPMENT_SETUP_REJECTED',
    })));
    expect(loadProofArtifacts).toHaveBeenCalledTimes(2);
    // Failed re-selection invalidates the former cache too.
    receive(new MessageEvent<ProofArtifactWorkerRequest>('message', { data: {
      type: 'prove', version: 1, requestId: 'stale', manifestSha256: selection.manifestSha256,
      witness: {}, expectedPublicSignals: [] } }));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'failed', requestId: 'stale', code: 'ARTIFACT_CACHE_MISMATCH' }));
  });

  it.each([
    { expectedCircuitId: 'different' }, { maxTotalBytes: 1 },
    { manifestUrl: 'https://different.example/home.json' }, { allowCrossOriginArtifacts: false },
  ])('revalidates changed identity, budget or origin policy %j', async (change) => {
    vi.mocked(loadProofArtifacts).mockResolvedValue(loaded());
    preflight('first');
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledOnce());
    preflight('changed', { ...selection, ...change });
    await vi.waitFor(() => expect(loadProofArtifacts).toHaveBeenCalledTimes(2));
  });

  it('keeps the artifact set fixed across asynchronous proof generation', async () => {
    const initial = loaded();
    const next = loaded('b'.repeat(64));
    vi.mocked(loadProofArtifacts).mockResolvedValueOnce(initial).mockResolvedValueOnce(next);
    preflight('first');
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledOnce());
    let resolveProof!: (value: Awaited<ReturnType<typeof generateAndVerifyGroth16Proof>>) => void;
    vi.mocked(generateAndVerifyGroth16Proof).mockImplementationOnce(() => new Promise((resolve) => { resolveProof = resolve; }));
    receive(new MessageEvent<ProofArtifactWorkerRequest>('message', { data: {
      type: 'prove', version: 1, requestId: 'proof', manifestSha256: selection.manifestSha256,
      witness: {}, expectedPublicSignals: [] } }));
    preflight('next', { ...selection, manifestSha256: next.manifestSha256 });
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    resolveProof({ circuitId: 'home', circuitVersion: 1, manifestSha256: initial.manifestSha256,
      publicSignals: [], proof: { pi_a: [], pi_b: [], pi_c: [], protocol: 'groth16', curve: 'bn128' } });
    await vi.waitFor(() => expect(prepareSuiProofSubmission).toHaveBeenCalledWith(initial, expect.anything(), []));
  });
});
