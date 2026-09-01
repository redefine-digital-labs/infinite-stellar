/// <reference lib="webworker" />

import {
  loadProofArtifacts,
  generateAndVerifyGroth16Proof,
  prepareSuiProofSubmission,
  PROOF_ARTIFACT_WORKER_VERSION,
  ProofArtifactError,
  type LoadedProofArtifacts,
  type ProofArtifactWorkerMessage,
  type ProofArtifactWorkerRequest,
  type ProofArtifactPreflightRequest,
  type ProofGenerateRequest,
} from '@infinite-stellar/prover';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const controllers = new Map<string, AbortController>();
let activeRequestId: string | undefined;
let loadedCache: LoadedProofArtifacts | undefined;

function emit(message: ProofArtifactWorkerMessage): void {
  scope.postMessage(message);
}

async function prove(request: ProofGenerateRequest): Promise<void> {
  if (!loadedCache || loadedCache.manifestSha256 !== request.manifestSha256) {
    emit({
      type: 'failed',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: request.requestId,
      code: 'ARTIFACT_CACHE_MISMATCH',
      message: 'Proof generation requires the exact preflighted artifact set.',
    });
    return;
  }
  try {
    const generated = await generateAndVerifyGroth16Proof(loadedCache, request.witness);
    const submission = await prepareSuiProofSubmission(
      loadedCache,
      generated,
      request.expectedPublicSignals,
    );
    emit({
      type: 'proved',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: request.requestId,
      ...generated,
      ...submission,
    });
  } catch (error) {
    emit({
      type: 'failed',
      version: PROOF_ARTIFACT_WORKER_VERSION,
      requestId: request.requestId,
      code: error instanceof Error && 'code' in error ? String(error.code) : 'PROOF_GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Proof generation failed.',
    });
  }
}

function ready(request: ProofArtifactPreflightRequest, loaded: LoadedProofArtifacts): void {
  emit({
    type: 'ready',
    version: PROOF_ARTIFACT_WORKER_VERSION,
    requestId: request.requestId,
    circuitId: loaded.manifest.circuitId,
    circuitVersion: loaded.manifest.circuitVersion,
    manifestSha256: loaded.manifestSha256,
    totalBytes: loaded.totalBytes,
    roles: [...loaded.artifacts.keys()],
  });
}

async function preflight(request: ProofArtifactPreflightRequest): Promise<void> {
  if (loadedCache?.manifestSha256 === request.selection.manifestSha256) {
    ready(request, loadedCache);
    return;
  }
  if (activeRequestId) controllers.get(activeRequestId)?.abort();
  const controller = new AbortController();
  activeRequestId = request.requestId;
  controllers.set(request.requestId, controller);

  try {
    const loaded = await loadProofArtifacts(
      request.selection,
      (url, init) => fetch(url, { signal: init?.signal }),
      (progress) => emit({
        type: 'progress',
        version: PROOF_ARTIFACT_WORKER_VERSION,
        requestId: request.requestId,
        ...progress,
      }),
      controller.signal,
    );
    if (activeRequestId !== request.requestId) return;
    loadedCache = loaded;
    ready(request, loaded);
  } catch (error) {
    if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      emit({
        type: 'cancelled',
        version: PROOF_ARTIFACT_WORKER_VERSION,
        requestId: request.requestId,
      });
    } else {
      emit({
        type: 'failed',
        version: PROOF_ARTIFACT_WORKER_VERSION,
        requestId: request.requestId,
        code: error instanceof ProofArtifactError ? error.code : 'WORKER_PREFLIGHT_FAILED',
        message: error instanceof Error ? error.message : 'Proof artifact preflight failed.',
      });
    }
  } finally {
    controllers.delete(request.requestId);
    if (activeRequestId === request.requestId) activeRequestId = undefined;
  }
}

scope.addEventListener('message', (event: MessageEvent<ProofArtifactWorkerRequest>) => {
  const request = event.data;
  if (request.version !== PROOF_ARTIFACT_WORKER_VERSION) return;
  if (request.type === 'cancel') {
    controllers.get(request.requestId)?.abort();
    return;
  }
  if (request.type === 'prove') {
    void prove(request);
  } else {
    void preflight(request);
  }
});

export {};
