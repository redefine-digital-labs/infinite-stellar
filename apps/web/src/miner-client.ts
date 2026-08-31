import {
  ROUND5_MINER_PROTOCOL_VERSION,
  mineRound5Chunks,
  round5MinerTotal,
  type MinedRound5Location,
  type Round5MinerChunk,
  type Round5MinerMessage,
  type Round5MinerRequest,
} from '@infinite-stellar/game-sdk';

export interface MinerProgress {
  checked: number;
  total: number;
  found: number;
}

export interface MinerResult extends MinerProgress {
  locations: MinedRound5Location[];
  elapsedMs: number;
}

export interface MinerOperation {
  requestId: string;
  result: Promise<MinerResult>;
  cancel: () => void;
}

function requestId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `miner-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fallbackMining(
  id: string,
  chunks: readonly Round5MinerChunk[],
  onProgress: (progress: MinerProgress) => void,
): MinerOperation {
  let cancelled = false;
  const total = round5MinerTotal(chunks);
  const result = new Promise<MinerResult>((resolve, reject) => {
    window.setTimeout(() => {
      if (cancelled) {
        reject(new DOMException('Mining cancelled.', 'AbortError'));
        return;
      }
      const startedAt = performance.now();
      try {
        const locations = mineRound5Chunks(chunks);
        const elapsedMs = Math.max(1, Math.round(performance.now() - startedAt));
        onProgress({ checked: total, total, found: locations.length });
        resolve({ checked: total, total, found: locations.length, locations, elapsedMs });
      } catch (error) {
        reject(error);
      }
    }, 0);
  });
  return {
    requestId: id,
    result,
    cancel: () => { cancelled = true; },
  };
}

export function startRound5Miner(
  chunks: readonly Round5MinerChunk[],
  onProgress: (progress: MinerProgress) => void,
): MinerOperation {
  const id = requestId();
  if (typeof Worker === 'undefined') return fallbackMining(id, chunks, onProgress);

  const worker = new Worker(new URL('./miner.worker.ts', import.meta.url), {
    type: 'module',
    name: 'infinite-stellar-round5-miner',
  });
  let found = 0;
  let settled = false;
  let rejectResult: (reason?: unknown) => void = () => undefined;
  const result = new Promise<MinerResult>((resolve, reject) => {
    rejectResult = reject;
    worker.addEventListener('message', (event: MessageEvent<Round5MinerMessage>) => {
      const message = event.data;
      if (message.version !== ROUND5_MINER_PROTOCOL_VERSION || message.requestId !== id) return;
      if (message.type === 'progress') {
        found += message.locations.length;
        onProgress({ checked: message.checked, total: message.total, found });
        return;
      }
      settled = true;
      worker.terminate();
      if (message.type === 'complete') {
        resolve({
          checked: message.checked,
          total: message.total,
          found: message.locations.length,
          locations: message.locations,
          elapsedMs: message.elapsedMs,
        });
      } else if (message.type === 'cancelled') {
        reject(new DOMException('Mining cancelled.', 'AbortError'));
      } else {
        reject(new Error(message.message));
      }
    });
    worker.addEventListener('error', (event) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error(event.message || 'The local mining Worker crashed.'));
    });
  });
  const request: Round5MinerRequest = {
    type: 'start',
    version: ROUND5_MINER_PROTOCOL_VERSION,
    requestId: id,
    chunks: [...chunks],
    progressEvery: 256,
  };
  worker.postMessage(request);
  return {
    requestId: id,
    result,
    cancel: () => {
      if (settled) return;
      const cancel: Round5MinerRequest = {
        type: 'cancel',
        version: ROUND5_MINER_PROTOCOL_VERSION,
        requestId: id,
      };
      worker.postMessage(cancel);
      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        worker.terminate();
        rejectResult(new DOMException('Mining cancelled.', 'AbortError'));
      }, 1_000);
    },
  };
}
