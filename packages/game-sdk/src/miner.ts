import { round5WorldLocation, type Round5Coordinates } from './round5-universe';
import { createRankedLocationMiner, type RankedMiningGeometry } from './ranked-miner';

export const ROUND5_MINER_PROTOCOL_VERSION = 2 as const;
export const ROUND5_MINER_CHUNK_SIDE = 16;
export const ROUND5_MINER_CHUNKS_PER_BATCH = 4;

export interface Round5MinerChunk {
  index: number;
  x: number;
  y: number;
  side: number;
}

export interface MinedRound5Location extends Round5Coordinates {
  locationId: string;
  perlin: number;
  biomebase: number;
}

export interface Round5MinerStartRequest {
  type: 'start';
  version: typeof ROUND5_MINER_PROTOCOL_VERSION;
  requestId: string;
  chunks: Round5MinerChunk[];
  progressEvery: number;
  rankedGeometry?: RankedMiningGeometry;
}

export interface Round5MinerCancelRequest {
  type: 'cancel';
  version: typeof ROUND5_MINER_PROTOCOL_VERSION;
  requestId: string;
}

export type Round5MinerRequest = Round5MinerStartRequest | Round5MinerCancelRequest;

export interface Round5MinerProgressMessage {
  type: 'progress';
  version: typeof ROUND5_MINER_PROTOCOL_VERSION;
  requestId: string;
  checked: number;
  total: number;
  locations: MinedRound5Location[];
}

export interface Round5MinerCompleteMessage {
  type: 'complete';
  version: typeof ROUND5_MINER_PROTOCOL_VERSION;
  requestId: string;
  checked: number;
  total: number;
  locations: MinedRound5Location[];
  elapsedMs: number;
}

export interface Round5MinerCancelledMessage {
  type: 'cancelled';
  version: typeof ROUND5_MINER_PROTOCOL_VERSION;
  requestId: string;
  checked: number;
  total: number;
}

export interface Round5MinerErrorMessage {
  type: 'error';
  version: typeof ROUND5_MINER_PROTOCOL_VERSION;
  requestId: string;
  message: string;
}

export type Round5MinerMessage =
  | Round5MinerProgressMessage
  | Round5MinerCompleteMessage
  | Round5MinerCancelledMessage
  | Round5MinerErrorMessage;

function assertChunk(chunk: Round5MinerChunk): void {
  if (
    !Number.isSafeInteger(chunk.index) || chunk.index < 0 ||
    !Number.isSafeInteger(chunk.x) ||
    !Number.isSafeInteger(chunk.y) ||
    !Number.isSafeInteger(chunk.side) || chunk.side < 1 || chunk.side > 512 ||
    !Number.isSafeInteger(chunk.x + chunk.side) || !Number.isSafeInteger(chunk.y + chunk.side)
  ) {
    throw new RangeError('Miner chunks require safe integer coordinates and a side from 1 through 512.');
  }
}

/** Integer square spiral: origin, east, north-east, north, north-west, ... */
export function round5MinerSpiralOffset(index: number): Round5Coordinates {
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('A miner spiral index must be a non-negative safe integer.');
  }
  if (index === 0) return { x: 0, y: 0 };

  const ring = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
  const sideLength = ring * 2;
  const ringMaximum = (ring * 2 + 1) ** 2 - 1;
  const offset = ringMaximum - index;
  if (offset < sideLength) return { x: ring - offset, y: -ring };
  if (offset < sideLength * 2) return { x: -ring, y: -ring + (offset - sideLength) };
  if (offset < sideLength * 3) return { x: -ring + (offset - sideLength * 2), y: ring };
  return { x: ring, y: ring - (offset - sideLength * 3) };
}

export function round5MinerChunk(
  center: Round5Coordinates,
  index: number,
  side = ROUND5_MINER_CHUNK_SIDE,
): Round5MinerChunk {
  if (!Number.isSafeInteger(center.x) || !Number.isSafeInteger(center.y)) {
    throw new RangeError('A miner center must use safe integer coordinates.');
  }
  if (!Number.isSafeInteger(side) || side < 1 || side > 512) {
    throw new RangeError('A miner chunk side must be an integer from 1 through 512.');
  }
  const offset = round5MinerSpiralOffset(index);
  const half = Math.floor(side / 2);
  return {
    index,
    x: center.x - half + offset.x * side,
    y: center.y - half + offset.y * side,
    side,
  };
}

export function round5MinerBatch(
  center: Round5Coordinates,
  batchIndex: number,
  chunksPerBatch = ROUND5_MINER_CHUNKS_PER_BATCH,
  side = ROUND5_MINER_CHUNK_SIDE,
): Round5MinerChunk[] {
  if (!Number.isSafeInteger(batchIndex) || batchIndex < 0) {
    throw new RangeError('A miner batch index must be a non-negative safe integer.');
  }
  if (!Number.isSafeInteger(chunksPerBatch) || chunksPerBatch < 1 || chunksPerBatch > 64) {
    throw new RangeError('A miner batch must contain from 1 through 64 chunks.');
  }
  const start = batchIndex * chunksPerBatch;
  return Array.from({ length: chunksPerBatch }, (_, offset) =>
    round5MinerChunk(center, start + offset, side));
}

export function round5MinerTotal(chunks: readonly Round5MinerChunk[]): number {
  if (chunks.length < 1 || chunks.length > 64) throw new RangeError('A mining request requires 1–64 chunks.');
  const total = chunks.reduce((total, chunk) => {
    assertChunk(chunk);
    return total + chunk.side * chunk.side;
  }, 0);
  if (total > 262_144) throw new RangeError('A mining request exceeds the bounded work limit.');
  return total;
}

/** Synchronous reference path used by tests and non-Worker environments. */
export function mineRound5Chunks(chunks: readonly Round5MinerChunk[], rankedGeometry?: RankedMiningGeometry): MinedRound5Location[] {
  round5MinerTotal(chunks);
  const mine = rankedGeometry ? createRankedLocationMiner(rankedGeometry) : round5WorldLocation;
  const locations: MinedRound5Location[] = [];
  for (const chunk of chunks) {
    assertChunk(chunk);
    for (let y = chunk.y; y < chunk.y + chunk.side; y += 1) {
      for (let x = chunk.x; x < chunk.x + chunk.side; x += 1) {
        const world = mine({ x, y });
        if (!world) continue;
        locations.push({
          x,
          y,
          locationId: world.locationId,
          perlin: world.perlin,
          biomebase: world.biomebase,
        });
      }
    }
  }
  return locations;
}
