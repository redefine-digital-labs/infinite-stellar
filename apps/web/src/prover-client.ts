import {
  PROOF_ARTIFACT_WORKER_VERSION,
  type ProofArtifactProgress,
  type ProofArtifactRole,
  type ProofArtifactSelection,
  type ProofArtifactWorkerMessage,
  type ProofArtifactWorkerRequest,
  type Groth16ProofJson,
} from '@infinite-stellar/prover';

export interface ProofPreflightResult {
  circuitId: string;
  circuitVersion: number;
  manifestSha256: string;
  totalBytes: number;
  roles: ProofArtifactRole[];
}

export interface ProofPreflightOperation {
  requestId: string;
  result: Promise<ProofPreflightResult>;
  cancel: () => void;
}

export interface GeneratedProofResult {
  circuitId: string;
  circuitVersion: number;
  manifestSha256: string;
  proof: Groth16ProofJson;
  publicSignals: string[];
  network: string;
  rulesetId: string;
  artifactManifestSha256: string;
  verifyingKeyDigest: string;
  publicInputs: Uint8Array;
  publicInputDigest: string;
  proofBytes: Uint8Array;
}

export interface ProofGenerationOperation {
  requestId: string;
  result: Promise<GeneratedProofResult>;
  cancel: () => void;
}

export interface ProofWorkerLike {
  postMessage(message: ProofArtifactWorkerRequest): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<ProofArtifactWorkerMessage>) => void): void;
  addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
  terminate(): void;
}

interface PendingOperation {
  kind: 'preflight' | 'prove';
  resolve: (result: ProofPreflightResult | GeneratedProofResult) => void;
  reject: (reason: unknown) => void;
  onProgress: (progress: ProofArtifactProgress) => void;
  cancelTimer?: number;
}

function nextRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `prover-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultWorkerFactory(): ProofWorkerLike {
  return new Worker(new URL('./prover.worker.ts', import.meta.url), {
    type: 'module',
    name: 'infinite-stellar-prover',
  });
}

export class ProofPreflightError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'ProofPreflightError';
  }
}

export class ProverWorkerClient {
  private worker: ProofWorkerLike;
  private pending = new Map<string, PendingOperation>();
  private activeRequestId?: string;
  private destroyed = false;

  constructor(workerFactory: () => ProofWorkerLike = defaultWorkerFactory) {
    this.worker = workerFactory();
    this.worker.addEventListener('message', (event) => this.handleMessage(event.data));
    this.worker.addEventListener('error', (event) => {
      this.failAll(new ProofPreflightError('WORKER_CRASHED', event.message || 'The Prover Worker crashed.'));
    });
  }

  preflight(
    selection: ProofArtifactSelection,
    onProgress: (progress: ProofArtifactProgress) => void = () => undefined,
  ): ProofPreflightOperation {
    if (this.destroyed) throw new ProofPreflightError('WORKER_DESTROYED', 'The Prover Worker client is closed.');
    if (this.activeRequestId) this.cancel(this.activeRequestId);
    const requestId = nextRequestId();
    let resolveResult: (result: ProofPreflightResult) => void = () => undefined;
    let rejectResult: PendingOperation['reject'] = () => undefined;
    const result = new Promise<ProofPreflightResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.pending.set(requestId, {
      kind: 'preflight',
      resolve: resolveResult as PendingOperation['resolve'],
      reject: rejectResult,
      onProgress,
    });
    this.activeRequestId = requestId;
    this.worker.postMessage({
      type: 'preflight',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId,
      selection,
    });
    return { requestId, result, cancel: () => this.cancel(requestId) };
  }

  prove(
    manifestSha256: string,
    witness: Record<string, string>,
    expectedPublicSignals: string[],
  ): ProofGenerationOperation {
    if (this.destroyed) throw new ProofPreflightError('WORKER_DESTROYED', 'The Prover Worker client is closed.');
    if (this.activeRequestId) this.cancel(this.activeRequestId);
    const requestId = nextRequestId();
    let resolveResult: (result: GeneratedProofResult) => void = () => undefined;
    let rejectResult: PendingOperation['reject'] = () => undefined;
    const result = new Promise<GeneratedProofResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.pending.set(requestId, {
      kind: 'prove',
      resolve: resolveResult as PendingOperation['resolve'],
      reject: rejectResult,
      onProgress: () => undefined,
    });
    this.activeRequestId = requestId;
    this.worker.postMessage({
      type: 'prove',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId,
      manifestSha256,
      witness,
      expectedPublicSignals,
    });
    return { requestId, result, cancel: () => this.cancel(requestId) };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.worker.terminate();
    this.failAll(new ProofPreflightError('WORKER_DESTROYED', 'The Prover Worker client was closed.'));
  }

  private cancel(requestId: string): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.worker.postMessage({
      type: 'cancel',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId,
    });
    pending.cancelTimer = window.setTimeout(() => {
      this.settle(requestId, (entry) => entry.reject(new DOMException('Proof preflight cancelled.', 'AbortError')));
    }, 2_000);
  }

  private handleMessage(message: ProofArtifactWorkerMessage): void {
    if (message.version !== PROOF_ARTIFACT_WORKER_VERSION) return;
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    if (message.type === 'progress') {
      pending.onProgress({
        phase: message.phase,
        loadedArtifacts: message.loadedArtifacts,
        totalArtifacts: message.totalArtifacts,
        loadedBytes: message.loadedBytes,
        totalBytes: message.totalBytes,
        role: message.role,
      });
      return;
    }
    if (message.type === 'ready') {
      if (pending.kind !== 'preflight') return;
      this.settle(message.requestId, (entry) => entry.resolve({
        circuitId: message.circuitId,
        circuitVersion: message.circuitVersion,
        manifestSha256: message.manifestSha256,
        totalBytes: message.totalBytes,
        roles: message.roles,
      }));
    } else if (message.type === 'proved') {
      if (pending.kind !== 'prove') return;
      this.settle(message.requestId, (entry) => entry.resolve({
        circuitId: message.circuitId,
        circuitVersion: message.circuitVersion,
        manifestSha256: message.manifestSha256,
        proof: message.proof,
        publicSignals: message.publicSignals,
        network: message.network,
        rulesetId: message.rulesetId,
        artifactManifestSha256: message.artifactManifestSha256,
        verifyingKeyDigest: message.verifyingKeyDigest,
        publicInputs: message.publicInputs,
        publicInputDigest: message.publicInputDigest,
        proofBytes: message.proofBytes,
      }));
    } else if (message.type === 'cancelled') {
      this.settle(message.requestId, (entry) => {
        entry.reject(new DOMException('Proof preflight cancelled.', 'AbortError'));
      });
    } else {
      this.settle(message.requestId, (entry) => {
        entry.reject(new ProofPreflightError(message.code, message.message));
      });
    }
  }

  private settle(requestId: string, settle: (pending: PendingOperation) => void): void {
    const pending = this.pending.get(requestId);
    if (!pending) return;
    if (pending.cancelTimer !== undefined) window.clearTimeout(pending.cancelTimer);
    this.pending.delete(requestId);
    if (this.activeRequestId === requestId) this.activeRequestId = undefined;
    settle(pending);
  }

  private failAll(error: Error): void {
    for (const requestId of [...this.pending.keys()]) {
      this.settle(requestId, (pending) => pending.reject(error));
    }
  }
}
