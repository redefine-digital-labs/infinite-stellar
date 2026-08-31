/// <reference lib="webworker" />

import {
  ROUND5_MINER_PROTOCOL_VERSION,
  round5MinerTotal,
  round5WorldLocation,
  type MinedRound5Location,
  type Round5MinerRequest,
  type Round5MinerStartRequest,
  type Round5MinerMessage,
} from '@infinite-stellar/game-sdk';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<string>();
let activeRequestId: string | undefined;

function emit(message: Round5MinerMessage): void {
  scope.postMessage(message);
}

async function yieldToWorkerEvents(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function mine(request: Round5MinerStartRequest): Promise<void> {
  const startedAt = performance.now();
  const total = round5MinerTotal(request.chunks);
  const locations: MinedRound5Location[] = [];
  let progressLocations: MinedRound5Location[] = [];
  let checked = 0;

  try {
    for (const chunk of request.chunks) {
      for (let y = chunk.y; y < chunk.y + chunk.side; y += 1) {
        for (let x = chunk.x; x < chunk.x + chunk.side; x += 1) {
          if (cancelled.has(request.requestId) || activeRequestId !== request.requestId) {
            emit({
              type: 'cancelled',
              version: ROUND5_MINER_PROTOCOL_VERSION,
              requestId: request.requestId,
              checked,
              total,
            });
            cancelled.delete(request.requestId);
            return;
          }

          const world = round5WorldLocation({ x, y });
          checked += 1;
          if (world) {
            const location = {
              x,
              y,
              locationId: world.locationId,
              perlin: world.perlin,
              biomebase: world.biomebase,
            };
            locations.push(location);
            progressLocations.push(location);
          }

          if (checked % request.progressEvery === 0 || checked === total) {
            emit({
              type: 'progress',
              version: ROUND5_MINER_PROTOCOL_VERSION,
              requestId: request.requestId,
              checked,
              total,
              locations: progressLocations,
            });
            progressLocations = [];
            await yieldToWorkerEvents();
          }
        }
      }
    }

    emit({
      type: 'complete',
      version: ROUND5_MINER_PROTOCOL_VERSION,
      requestId: request.requestId,
      checked,
      total,
      locations,
      elapsedMs: Math.max(1, Math.round(performance.now() - startedAt)),
    });
  } catch (error) {
    emit({
      type: 'error',
      version: ROUND5_MINER_PROTOCOL_VERSION,
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'The local miner failed.',
    });
  } finally {
    if (activeRequestId === request.requestId) activeRequestId = undefined;
    cancelled.delete(request.requestId);
  }
}

scope.addEventListener('message', (event: MessageEvent<Round5MinerRequest>) => {
  const request = event.data;
  if (request.version !== ROUND5_MINER_PROTOCOL_VERSION) return;
  if (request.type === 'cancel') {
    cancelled.add(request.requestId);
    return;
  }
  if (activeRequestId) cancelled.add(activeRequestId);
  activeRequestId = request.requestId;
  void mine(request);
});

export {};
