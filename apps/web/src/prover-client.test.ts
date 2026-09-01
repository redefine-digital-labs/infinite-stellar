import { describe, expect, it, vi } from 'vitest';
import {
  PROOF_ARTIFACT_WORKER_VERSION,
  PROOF_PUBLIC_SIGNAL_ORDER,
  type ProofArtifactSelection,
  type ProofArtifactWorkerMessage,
  type ProofArtifactWorkerRequest,
} from '@infinite-stellar/prover';
import { ProverWorkerClient, type ProofWorkerLike } from './prover-client';

const selection: ProofArtifactSelection = {
  manifestUrl: 'https://proof.infinite-stellar.example/manifest.json',
  manifestSha256: 'a'.repeat(64),
  mode: 'production',
  expectedNetwork: 'sui:mainnet',
  expectedRulesetId: 'dark-forest-v06-round5',
  expectedCircuitId: 'round5-move',
  expectedCircuitVersion: 1,
  expectedPublicSignals: PROOF_PUBLIC_SIGNAL_ORDER,
};

class FakeWorker implements ProofWorkerLike {
  readonly posted: ProofArtifactWorkerRequest[] = [];
  readonly terminate = vi.fn();
  private messageListeners: Array<(event: MessageEvent<ProofArtifactWorkerMessage>) => void> = [];
  private errorListeners: Array<(event: ErrorEvent) => void> = [];

  postMessage(message: ProofArtifactWorkerRequest): void {
    this.posted.push(message);
  }

  addEventListener(type: 'message' | 'error', listener: ((event: MessageEvent<ProofArtifactWorkerMessage>) => void) | ((event: ErrorEvent) => void)): void {
    if (type === 'message') {
      this.messageListeners.push(listener as (event: MessageEvent<ProofArtifactWorkerMessage>) => void);
    } else {
      this.errorListeners.push(listener as (event: ErrorEvent) => void);
    }
  }

  emit(message: ProofArtifactWorkerMessage): void {
    this.messageListeners.forEach((listener) => listener({ data: message } as MessageEvent<ProofArtifactWorkerMessage>));
  }
}

describe('ProverWorkerClient', () => {
  it('reports pinned progress and resolves only the matching request', async () => {
    const worker = new FakeWorker();
    const progress = vi.fn();
    const client = new ProverWorkerClient(() => worker);
    const operation = client.preflight(selection, progress);

    worker.emit({
      type: 'progress',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: 'stale-request',
      phase: 'manifest',
      loadedArtifacts: 0,
      totalArtifacts: 3,
      loadedBytes: 0,
      totalBytes: 42,
    });
    expect(progress).not.toHaveBeenCalled();

    worker.emit({
      type: 'progress',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: operation.requestId,
      phase: 'artifact',
      loadedArtifacts: 1,
      totalArtifacts: 3,
      loadedBytes: 12,
      totalBytes: 42,
      role: 'circuit-wasm',
    });
    worker.emit({
      type: 'ready',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: operation.requestId,
      circuitId: 'round5-move',
      circuitVersion: 1,
      manifestSha256: selection.manifestSha256,
      totalBytes: 42,
      roles: ['circuit-wasm', 'proving-key', 'verification-key'],
    });

    await expect(operation.result).resolves.toMatchObject({ manifestSha256: selection.manifestSha256 });
    expect(progress).toHaveBeenCalledOnce();
  });

  it('cancels an older request before starting a replacement', async () => {
    const worker = new FakeWorker();
    const client = new ProverWorkerClient(() => worker);
    const first = client.preflight(selection);
    const second = client.preflight(selection);

    expect(worker.posted.map((message) => message.type)).toEqual(['preflight', 'cancel', 'preflight']);
    worker.emit({
      type: 'cancelled',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: first.requestId,
    });
    worker.emit({
      type: 'ready',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: second.requestId,
      circuitId: 'round5-move',
      circuitVersion: 1,
      manifestSha256: selection.manifestSha256,
      totalBytes: 42,
      roles: ['circuit-wasm', 'proving-key', 'verification-key'],
    });

    await expect(first.result).rejects.toMatchObject({ name: 'AbortError' });
    await expect(second.result).resolves.toMatchObject({ circuitId: 'round5-move' });
  });

  it('rejects every pending operation when destroyed', async () => {
    const worker = new FakeWorker();
    const client = new ProverWorkerClient(() => worker);
    const operation = client.preflight(selection);
    client.destroy();
    await expect(operation.result).rejects.toMatchObject({ code: 'WORKER_DESTROYED' });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('submits a witness only after preflight and resolves a self-verified proof', async () => {
    const worker = new FakeWorker();
    const client = new ProverWorkerClient(() => worker);
    const preflight = client.preflight(selection);
    worker.emit({
      type: 'ready',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: preflight.requestId,
      circuitId: 'round5-move',
      circuitVersion: 1,
      manifestSha256: selection.manifestSha256,
      totalBytes: 42,
      roles: ['circuit-wasm', 'proving-key', 'verification-key'],
    });
    await preflight.result;

    const proof = client.prove(selection.manifestSha256, { source_location_hash: '1' });
    expect(worker.posted.at(-1)).toMatchObject({
      type: 'prove',
      manifestSha256: selection.manifestSha256,
      witness: { source_location_hash: '1' },
    });
    worker.emit({
      type: 'proved',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: proof.requestId,
      circuitId: 'round5-move',
      circuitVersion: 1,
      manifestSha256: selection.manifestSha256,
      proof: {
        pi_a: ['1', '2', '1'],
        pi_b: [['1', '2'], ['3', '4'], ['1', '0']],
        pi_c: ['5', '6', '1'],
        protocol: 'groth16',
        curve: 'bn128',
      },
      publicSignals: ['1', '2', '3', '4'],
    });
    await expect(proof.result).resolves.toMatchObject({
      publicSignals: ['1', '2', '3', '4'],
      manifestSha256: selection.manifestSha256,
    });
  });
});
