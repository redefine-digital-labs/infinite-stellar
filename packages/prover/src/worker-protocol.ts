import type {
  ProofArtifactProgress,
  ProofArtifactSelection,
  ProofArtifactRole,
  PROOF_ARTIFACT_WORKER_VERSION,
} from './artifact-manifest';

export interface ProofArtifactPreflightRequest {
  type: 'preflight';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
  selection: ProofArtifactSelection;
}

export interface ProofArtifactCancelRequest {
  type: 'cancel';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
}

export interface ProofGenerateRequest {
  type: 'prove';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
  manifestSha256: string;
  witness: Record<string, string>;
  expectedPublicSignals: string[];
}

export interface Groth16ProofJson {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: string;
  curve: string;
}

export type ProofArtifactWorkerRequest = ProofArtifactPreflightRequest | ProofGenerateRequest | ProofArtifactCancelRequest;

export interface ProofArtifactProgressMessage extends ProofArtifactProgress {
  type: 'progress';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
}

export interface ProofArtifactReadyMessage {
  type: 'ready';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
  circuitId: string;
  circuitVersion: number;
  manifestSha256: string;
  totalBytes: number;
  roles: ProofArtifactRole[];
}

export interface ProofArtifactCancelledMessage {
  type: 'cancelled';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
}

export interface ProofArtifactFailedMessage {
  type: 'failed';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
  code: string;
  message: string;
}

export interface ProofGeneratedMessage {
  type: 'proved';
  version: typeof PROOF_ARTIFACT_WORKER_VERSION;
  requestId: string;
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

export type ProofArtifactWorkerMessage =
  | ProofArtifactProgressMessage
  | ProofArtifactReadyMessage
  | ProofGeneratedMessage
  | ProofArtifactCancelledMessage
  | ProofArtifactFailedMessage;
