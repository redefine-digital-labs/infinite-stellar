import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  MOVE_NEW_PUBLIC_SIGNAL_ORDER,
  PROOF_PUBLIC_SIGNAL_ORDER,
  type ProofPublicSignalName,
} from './proof-intent';

export const PROOF_ARTIFACT_MANIFEST_VERSION = 1 as const;
export const PROOF_ARTIFACT_WORKER_VERSION = 1 as const;
export const DEFAULT_MAX_PROOF_ARTIFACT_BYTES = 512 * 1024 * 1024;
export const MAX_PROOF_MANIFEST_BYTES = 1024 * 1024;

export type ProofArtifactRole = 'circuit-wasm' | 'proving-key' | 'verification-key';
export type ProofArtifactStatus = 'development' | 'production';

export interface ProofArtifactDescriptor {
  role: ProofArtifactRole;
  url: string;
  sha256: string;
  bytes: number;
  mediaType: string;
}

export interface ProofArtifactManifestV1 {
  schemaVersion: typeof PROOF_ARTIFACT_MANIFEST_VERSION;
  status: ProofArtifactStatus;
  network: string;
  rulesetId: string;
  circuitId: string;
  circuitVersion: number;
  curve: 'bn254';
  publicSignals: ProofPublicSignalName[];
  source: {
    repository: string;
    commit: string;
    circuitSourceSha256: string;
    buildImage: string;
  };
  trustedSetup: {
    kind: 'development' | 'phase2';
    ceremonyId?: string;
    transcriptSha256?: string;
  };
  artifacts: ProofArtifactDescriptor[];
}

export interface ProofArtifactSelection {
  manifestUrl: string;
  manifestSha256: string;
  mode: 'development' | 'production';
  expectedNetwork: string;
  expectedRulesetId: string;
  expectedCircuitId: string;
  expectedCircuitVersion: number;
  expectedPublicSignals: readonly ProofPublicSignalName[];
  allowCrossOriginArtifacts?: boolean;
  maxTotalBytes?: number;
}

export interface ProofFetchResponse {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type ProofFetcher = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<ProofFetchResponse>;

export interface LoadedProofArtifacts {
  manifest: ProofArtifactManifestV1;
  manifestSha256: string;
  artifacts: ReadonlyMap<ProofArtifactRole, Uint8Array>;
  totalBytes: number;
}

export interface ProofArtifactProgress {
  phase: 'manifest' | 'artifact';
  loadedArtifacts: number;
  totalArtifacts: number;
  loadedBytes: number;
  totalBytes: number;
  role?: ProofArtifactRole;
}

export type ProofArtifactErrorCode =
  | 'INVALID_MANIFEST'
  | 'UNPINNED_MANIFEST'
  | 'MANIFEST_MISMATCH'
  | 'DEVELOPMENT_SETUP_REJECTED'
  | 'CROSS_ORIGIN_ARTIFACT'
  | 'ARTIFACT_FETCH_FAILED'
  | 'ARTIFACT_SIZE_MISMATCH'
  | 'ARTIFACT_HASH_MISMATCH'
  | 'ARTIFACT_MEDIA_TYPE_MISMATCH'
  | 'ARTIFACT_BUDGET_EXCEEDED';

export class ProofArtifactError extends Error {
  constructor(readonly code: ProofArtifactErrorCode, message: string) {
    super(message);
    this.name = 'ProofArtifactError';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function digest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

const ROLE_MEDIA_TYPE: Readonly<Record<ProofArtifactRole, string>> = {
  'circuit-wasm': 'application/wasm',
  'proving-key': 'application/octet-stream',
  'verification-key': 'application/json',
};

function parseDescriptor(value: unknown): ProofArtifactDescriptor {
  if (!record(value)) throw new ProofArtifactError('INVALID_MANIFEST', 'Artifact descriptors must be objects.');
  const role = value.role;
  if (role !== 'circuit-wasm' && role !== 'proving-key' && role !== 'verification-key') {
    throw new ProofArtifactError('INVALID_MANIFEST', 'The manifest contains an unknown artifact role.');
  }
  if (
    typeof value.url !== 'string' || value.url.length === 0 ||
    !digest(value.sha256) ||
    !Number.isSafeInteger(value.bytes) || Number(value.bytes) <= 0 ||
    value.mediaType !== ROLE_MEDIA_TYPE[role]
  ) {
    throw new ProofArtifactError('INVALID_MANIFEST', `The ${role} descriptor is invalid.`);
  }
  return {
    role,
    url: value.url,
    sha256: value.sha256,
    bytes: Number(value.bytes),
    mediaType: value.mediaType,
  };
}

export function parseProofArtifactManifest(raw: string): ProofArtifactManifestV1 {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ProofArtifactError('INVALID_MANIFEST', 'The proof artifact manifest is not valid JSON.');
  }
  if (!record(value)) throw new ProofArtifactError('INVALID_MANIFEST', 'The proof artifact manifest must be an object.');
  const source = value.source;
  const trustedSetup = value.trustedSetup;
  const publicSignals = Array.isArray(value.publicSignals)
    ? value.publicSignals.join(':')
    : '';
  const supportedPublicSignals =
    publicSignals === PROOF_PUBLIC_SIGNAL_ORDER.join(':') ||
    publicSignals === MOVE_NEW_PUBLIC_SIGNAL_ORDER.join(':');
  if (
    value.schemaVersion !== PROOF_ARTIFACT_MANIFEST_VERSION ||
    (value.status !== 'development' && value.status !== 'production') ||
    typeof value.network !== 'string' ||
    typeof value.rulesetId !== 'string' ||
    typeof value.circuitId !== 'string' ||
    !Number.isSafeInteger(value.circuitVersion) || Number(value.circuitVersion) < 1 ||
    value.curve !== 'bn254' ||
    !supportedPublicSignals ||
    !record(source) ||
    typeof source.repository !== 'string' ||
    typeof source.commit !== 'string' || !/^[0-9a-f]{40}$/.test(source.commit) ||
    !digest(source.circuitSourceSha256) ||
    typeof source.buildImage !== 'string' || source.buildImage.length === 0 ||
    !record(trustedSetup) ||
    (trustedSetup.kind !== 'development' && trustedSetup.kind !== 'phase2') ||
    !Array.isArray(value.artifacts)
  ) {
    throw new ProofArtifactError('INVALID_MANIFEST', 'The proof artifact manifest schema is invalid.');
  }
  const artifacts = value.artifacts.map(parseDescriptor);
  const roles = new Set(artifacts.map((artifact) => artifact.role));
  if (roles.size !== 3 || artifacts.length !== 3) {
    throw new ProofArtifactError('INVALID_MANIFEST', 'The manifest must pin exactly one artifact for every runtime role.');
  }
  if (value.status === 'production') {
    if (
      trustedSetup.kind !== 'phase2' ||
      typeof trustedSetup.ceremonyId !== 'string' || trustedSetup.ceremonyId.length === 0 ||
      !digest(trustedSetup.transcriptSha256)
    ) {
      throw new ProofArtifactError('INVALID_MANIFEST', 'A production manifest requires pinned Phase 2 setup provenance.');
    }
  }
  return {
    schemaVersion: PROOF_ARTIFACT_MANIFEST_VERSION,
    status: value.status,
    network: value.network,
    rulesetId: value.rulesetId,
    circuitId: value.circuitId,
    circuitVersion: Number(value.circuitVersion),
    curve: 'bn254',
    publicSignals: [...value.publicSignals as ProofPublicSignalName[]],
    source: {
      repository: source.repository,
      commit: source.commit,
      circuitSourceSha256: source.circuitSourceSha256,
      buildImage: source.buildImage,
    },
    trustedSetup: {
      kind: trustedSetup.kind,
      ceremonyId: typeof trustedSetup.ceremonyId === 'string' ? trustedSetup.ceremonyId : undefined,
      transcriptSha256: typeof trustedSetup.transcriptSha256 === 'string'
        ? trustedSetup.transcriptSha256
        : undefined,
    },
    artifacts,
  };
}

function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

function assertSelection(manifest: ProofArtifactManifestV1, selection: ProofArtifactSelection): void {
  if (
    manifest.network !== selection.expectedNetwork ||
    manifest.rulesetId !== selection.expectedRulesetId ||
    manifest.circuitId !== selection.expectedCircuitId ||
    manifest.circuitVersion !== selection.expectedCircuitVersion ||
    manifest.publicSignals.join(':') !== selection.expectedPublicSignals.join(':')
  ) {
    throw new ProofArtifactError('MANIFEST_MISMATCH', 'The proof manifest does not match the active season selection.');
  }
  if (selection.mode === 'production' && manifest.status !== 'production') {
    throw new ProofArtifactError('DEVELOPMENT_SETUP_REJECTED', 'Development proof artifacts cannot enter production mode.');
  }
}

function resolvedArtifactUrl(
  manifestUrl: URL,
  descriptor: ProofArtifactDescriptor,
  allowCrossOrigin: boolean,
  mode: ProofArtifactSelection['mode'],
): URL {
  const url = new URL(descriptor.url, manifestUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ProofArtifactError('INVALID_MANIFEST', 'Proof artifact URLs must use HTTP or HTTPS.');
  }
  if (url.username || url.password || url.hash) {
    throw new ProofArtifactError('INVALID_MANIFEST', 'Proof artifact URLs cannot contain credentials or fragments.');
  }
  if (mode === 'production' && url.protocol !== 'https:') {
    throw new ProofArtifactError('INVALID_MANIFEST', 'Production proof artifacts require HTTPS.');
  }
  if (!allowCrossOrigin && url.origin !== manifestUrl.origin) {
    throw new ProofArtifactError('CROSS_ORIGIN_ARTIFACT', 'Cross-origin proof artifacts require an explicit season policy.');
  }
  return url;
}

function checkedManifestUrl(selection: ProofArtifactSelection): URL {
  let url: URL;
  try {
    url = new URL(selection.manifestUrl);
  } catch {
    throw new ProofArtifactError('INVALID_MANIFEST', 'The proof manifest URL is invalid.');
  }
  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username || url.password || url.hash
  ) {
    throw new ProofArtifactError('INVALID_MANIFEST', 'The proof manifest URL must be an HTTP(S) URL without credentials or fragments.');
  }
  if (selection.mode === 'production' && url.protocol !== 'https:') {
    throw new ProofArtifactError('INVALID_MANIFEST', 'Production proof manifests require HTTPS.');
  }
  if (
    url.protocol === 'http:' &&
    url.hostname !== 'localhost' &&
    url.hostname !== '127.0.0.1' &&
    url.hostname !== '[::1]'
  ) {
    throw new ProofArtifactError('INVALID_MANIFEST', 'Plain HTTP is limited to local development manifests.');
  }
  return url;
}

export async function loadProofArtifacts(
  selection: ProofArtifactSelection,
  fetcher: ProofFetcher,
  onProgress: (progress: ProofArtifactProgress) => void = () => undefined,
  signal?: AbortSignal,
): Promise<LoadedProofArtifacts> {
  if (!digest(selection.manifestSha256)) {
    throw new ProofArtifactError('UNPINNED_MANIFEST', 'The active season must pin a lowercase SHA-256 manifest digest.');
  }
  const manifestUrl = checkedManifestUrl(selection);
  const manifestResponse = await fetcher(manifestUrl.href, { signal });
  if (!manifestResponse.ok) {
    throw new ProofArtifactError('ARTIFACT_FETCH_FAILED', `Proof manifest fetch failed with HTTP ${manifestResponse.status}.`);
  }
  const manifestContentType = manifestResponse.headers?.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (manifestContentType !== 'application/json') {
    throw new ProofArtifactError('ARTIFACT_MEDIA_TYPE_MISMATCH', 'The proof manifest must use application/json.');
  }
  const manifestBytes = new Uint8Array(await manifestResponse.arrayBuffer());
  if (manifestBytes.byteLength > MAX_PROOF_MANIFEST_BYTES) {
    throw new ProofArtifactError('ARTIFACT_BUDGET_EXCEEDED', 'The proof manifest exceeds its one-megabyte limit.');
  }
  const manifestSha256 = sha256Hex(manifestBytes);
  if (manifestSha256 !== selection.manifestSha256) {
    throw new ProofArtifactError('UNPINNED_MANIFEST', 'The proof manifest digest does not match the active season pin.');
  }
  const manifest = parseProofArtifactManifest(new TextDecoder().decode(manifestBytes));
  assertSelection(manifest, selection);
  const totalBytes = manifest.artifacts.reduce((total, artifact) => total + artifact.bytes, 0);
  const maxTotalBytes = selection.maxTotalBytes ?? DEFAULT_MAX_PROOF_ARTIFACT_BYTES;
  if (!Number.isSafeInteger(totalBytes) || !Number.isSafeInteger(maxTotalBytes) || maxTotalBytes <= 0 || totalBytes > maxTotalBytes) {
    throw new ProofArtifactError('ARTIFACT_BUDGET_EXCEEDED', 'The proof artifact set exceeds the declared memory budget.');
  }
  onProgress({ phase: 'manifest', loadedArtifacts: 0, totalArtifacts: 3, loadedBytes: 0, totalBytes });

  const loaded = new Map<ProofArtifactRole, Uint8Array>();
  let loadedBytes = 0;
  for (const descriptor of manifest.artifacts) {
    signal?.throwIfAborted();
    const url = resolvedArtifactUrl(
      manifestUrl,
      descriptor,
      selection.allowCrossOriginArtifacts ?? false,
      selection.mode,
    );
    const response = await fetcher(url.href, { signal });
    if (!response.ok) {
      throw new ProofArtifactError('ARTIFACT_FETCH_FAILED', `${descriptor.role} fetch failed with HTTP ${response.status}.`);
    }
    const contentType = response.headers?.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== descriptor.mediaType) {
      throw new ProofArtifactError(
        'ARTIFACT_MEDIA_TYPE_MISMATCH',
        `${descriptor.role} returned ${contentType ?? 'no content type'}.`,
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== descriptor.bytes) {
      throw new ProofArtifactError('ARTIFACT_SIZE_MISMATCH', `${descriptor.role} byte length does not match its pin.`);
    }
    if (sha256Hex(bytes) !== descriptor.sha256) {
      throw new ProofArtifactError('ARTIFACT_HASH_MISMATCH', `${descriptor.role} SHA-256 does not match its pin.`);
    }
    loaded.set(descriptor.role, bytes);
    loadedBytes += bytes.byteLength;
    onProgress({
      phase: 'artifact',
      loadedArtifacts: loaded.size,
      totalArtifacts: manifest.artifacts.length,
      loadedBytes,
      totalBytes,
      role: descriptor.role,
    });
  }
  return { manifest, manifestSha256, artifacts: loaded, totalBytes };
}
