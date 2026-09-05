import { describe, expect, it, vi } from 'vitest';
import { serializeProofPublicSignals, type ProofArtifactWorkerMessage, type ProofArtifactWorkerRequest } from '@infinite-stellar/prover';
import { rankedActionFixture } from '../../../packages/game-sdk/test/ranked-action-fixtures';
import { prepareRankedAction } from '@infinite-stellar/game-sdk';
import { ProverWorkerClient, type ProofWorkerLike } from './prover-client';
import { prepareRankedActionWithWorker } from './ranked-action-prover';

class WorkerDouble implements ProofWorkerLike {
  posted: ProofArtifactWorkerRequest[] = [];
  terminate = vi.fn();
  receive?: (event: MessageEvent<ProofArtifactWorkerMessage>) => void;
  addEventListener(type: 'message' | 'error', listener: ((event: MessageEvent<ProofArtifactWorkerMessage>) => void) | ((event: ErrorEvent) => void)) {
    if (type === 'message') this.receive = listener as typeof this.receive;
  }
  postMessage(request: ProofArtifactWorkerRequest) { this.posted.push(request); }
  emit(message: ProofArtifactWorkerMessage) { this.receive?.({ data: message } as MessageEvent<ProofArtifactWorkerMessage>); }
}

describe('ranked per-action local Worker adapter', () => {
  it.each(['home', 'move', 'move_new'] as const)('selects the exact %s production pin and destroys the Worker', async (mode) => {
    const context = rankedActionFixture(mode);
    const request = mode === 'home'
      ? { kind: 'claim_home' as const, destinationLocationId: context.record.locations[0]!.locationId }
      : { kind: 'move' as const, sourceLocationId: context.record.locations[0]!.locationId,
        destinationLocationId: context.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n };
    const action = prepareRankedAction(context, request);
    const worker = new WorkerDouble();
    const readContext = vi.fn(async () => context);
    const operation = prepareRankedActionWithWorker(request, { readContext,
      manifestUrls: { [action.transaction.kind]: 'https://artifacts.example/action.json' } },
    () => new ProverWorkerClient(() => worker));
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    const preflight = worker.posted[0]!;
    expect(preflight).toMatchObject({ type: 'preflight', selection: { mode: 'production',
      manifestSha256: action.circuit.artifactManifestSha256, expectedCircuitId: action.circuit.circuitId,
      expectedPublicSignals: action.publicSignalOrder } });
    worker.emit({ type: 'ready', version: 1, requestId: preflight.requestId,
      circuitId: action.circuit.circuitId, circuitVersion: 1, manifestSha256: action.circuit.artifactManifestSha256,
      totalBytes: 1, roles: ['circuit-wasm', 'proving-key', 'verification-key'] });
    await vi.waitFor(() => expect(worker.posted).toHaveLength(2));
    const prove = worker.posted[1]!;
    expect(prove).toMatchObject({ type: 'prove', witness: action.privateWitness, expectedPublicSignals: action.publicSignals });
    worker.emit({ type: 'proved', version: 1, requestId: prove.requestId,
      circuitId: action.circuit.circuitId, circuitVersion: 1, manifestSha256: action.circuit.artifactManifestSha256,
      network: 'sui:mainnet', rulesetId: 'dark-forest-v06-round5',
      artifactManifestSha256: action.circuit.artifactManifestSha256, verifyingKeyDigest: action.circuit.verifyingKeyDigest,
      publicSignals: action.publicSignals, publicInputDigest: action.publicInputDigest,
      publicInputs: serializeProofPublicSignals(action.publicSignals.map(BigInt)), proofBytes: new Uint8Array(128),
      proof: { pi_a: [], pi_b: [], pi_c: [], protocol: 'groth16', curve: 'bn128' } });
    const result = await operation;
    expect(result.transaction.getData().commands).toHaveLength(1);
    expect(readContext).toHaveBeenCalledTimes(2);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('never creates a Worker before release gates pass', async () => {
    const context = rankedActionFixture();
    context.deployment.productionProofVerifierReady = false;
    const factory = vi.fn();
    await expect(prepareRankedActionWithWorker({ kind: 'claim_home', destinationLocationId: context.record.locations[0]!.locationId },
      { readContext: async () => context, manifestUrls: {} }, factory)).rejects.toThrow(/verifier/);
    expect(factory).not.toHaveBeenCalled();
  });

  it('terminates preflight immediately on cancellation and does not re-read or prove', async () => {
    const context = rankedActionFixture();
    const controller = new AbortController();
    const worker = new WorkerDouble();
    const readContext = vi.fn(async () => context);
    const operation = prepareRankedActionWithWorker({ kind: 'claim_home', destinationLocationId: context.record.locations[0]!.locationId },
      { readContext, signal: controller.signal, manifestUrls: { claim_home: 'https://artifacts.example/home.json' } },
      () => new ProverWorkerClient(() => worker));
    const rejection = expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(worker.posted).toHaveLength(1));
    controller.abort();
    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(readContext).toHaveBeenCalledOnce();
    expect(worker.posted).toHaveLength(1);
  });
});
