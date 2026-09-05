import { round5MinerSpiralOffset, type Round5MinerChunk } from './miner';
import type { Round5Coordinates } from './round5-universe';

export const EXPLORATION_CHUNK_SIDE = 16;
const MAX_COVERAGE_SIDE = 2 ** 24;
const MAX_COVERAGE_RECORDS = 65_536;

/** Complete private search footprints, including chunks containing no planets. */
export interface ExploredChunk { x: number; y: number; side: number }

const key = ({ x, y, side }: ExploredChunk) => `${x}:${y}:${side}`;

function validateChunk(chunk: ExploredChunk): void {
  if (!chunk || !Number.isSafeInteger(chunk.x) || !Number.isSafeInteger(chunk.y) ||
      !Number.isSafeInteger(chunk.side) || chunk.side < EXPLORATION_CHUNK_SIDE ||
      chunk.side > MAX_COVERAGE_SIDE || !Number.isInteger(Math.log2(chunk.side)) ||
      chunk.x % chunk.side !== 0 || chunk.y % chunk.side !== 0 ||
      !Number.isSafeInteger(chunk.x + chunk.side) || !Number.isSafeInteger(chunk.y + chunk.side)) {
    throw new Error('Exploration coverage requires aligned power-of-two chunks of at least 16 units.');
  }
}

function ancestor(chunk: ExploredChunk, side: number): ExploredChunk {
  return { x: Math.floor(chunk.x / side) * side, y: Math.floor(chunk.y / side) * side, side };
}

function coverageIndex(chunks: readonly ExploredChunk[]) {
  return new Set(chunks.map(key));
}

function covered(index: ReadonlySet<string>, chunk: ExploredChunk): boolean {
  for (let side = chunk.side; side <= MAX_COVERAGE_SIDE; side *= 2) {
    if (index.has(key(ancestor(chunk, side)))) return true;
  }
  return false;
}

/** Canonical union. Four complete siblings compact to one parent, never a bounding box. */
export function mergeExploredChunks(...groups: readonly (readonly ExploredChunk[])[]): ExploredChunk[] {
  const input = groups.flat();
  if (input.length > MAX_COVERAGE_RECORDS * 2) throw new Error('Exploration coverage exceeds its storage bound.');
  input.forEach(validateChunk);
  // Process parents first so adding a saved parent cannot leave nested children.
  input.sort((a, b) => b.side - a.side || a.x - b.x || a.y - b.y);
  const chunks = new Map<string, ExploredChunk>();
  const index = new Set<string>();
  for (const original of input) {
    if (covered(index, original)) continue;
    let chunk = { ...original };
    chunks.set(key(chunk), chunk);
    index.add(key(chunk));
    while (chunk.side < MAX_COVERAGE_SIDE) {
      const parent = ancestor(chunk, chunk.side * 2);
      const siblings = [0, 1].flatMap((dx) => [0, 1].map((dy) => ({
        x: parent.x + dx * chunk.side, y: parent.y + dy * chunk.side, side: chunk.side,
      })));
      if (!siblings.every((sibling) => index.has(key(sibling)))) break;
      for (const sibling of siblings) { chunks.delete(key(sibling)); index.delete(key(sibling)); }
      chunk = parent;
      chunks.set(key(chunk), chunk);
      index.add(key(chunk));
    }
  }
  if (chunks.size > MAX_COVERAGE_RECORDS) throw new Error('Exploration coverage exceeds its storage bound.');
  return [...chunks.values()].sort((a, b) => a.x - b.x || a.y - b.y || a.side - b.side);
}

export function exploredChunkArea(chunks: readonly ExploredChunk[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.side ** 2, 0);
}

export function validateExplorationOrigin(origin: Round5Coordinates): Round5Coordinates {
  if (!origin || !Number.isSafeInteger(origin.x) || !Number.isSafeInteger(origin.y)) {
    throw new Error('The explorer origin must use integer world coordinates.');
  }
  return { x: origin.x, y: origin.y };
}

/** Bounded scheduling work, independent of camera and of discovered Planet count. */
export function nextExplorationBatch(
  origin: Round5Coordinates,
  worldRadius: number,
  explored: readonly ExploredChunk[],
  cursor = 0,
  worldCenter: Round5Coordinates = { x: 0, y: 0 },
  batchSize = 4,
): { chunks: Round5MinerChunk[]; cursor: number; exhausted: boolean } {
  validateExplorationOrigin(origin);
  validateExplorationOrigin(worldCenter);
  if (!Number.isSafeInteger(worldRadius) || worldRadius < 1 || worldRadius > 1_000_000_000 ||
      !Number.isSafeInteger(cursor) || cursor < 0 || !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 64 ||
      Math.hypot(origin.x - worldCenter.x, origin.y - worldCenter.y) >= worldRadius) {
    throw new Error('The explorer must start inside the finite world with a valid search cursor.');
  }
  const base = { x: Math.floor(origin.x / 16) * 16, y: Math.floor(origin.y / 16) * 16 };
  const ringLimit = Math.ceil((worldRadius + Math.max(Math.abs(base.x - worldCenter.x), Math.abs(base.y - worldCenter.y))) / 16) + 1;
  const end = (ringLimit * 2 + 1) ** 2;
  const index = coverageIndex(explored);
  const chunks: Round5MinerChunk[] = [];
  let checked = 0;
  while (cursor < end && checked++ < 4096 && chunks.length < batchSize) {
    const offset = round5MinerSpiralOffset(cursor);
    const chunk = { index: cursor++, x: base.x + offset.x * 16, y: base.y + offset.y * 16, side: 16 };
    const nearX = Math.max(chunk.x, Math.min(worldCenter.x, chunk.x + 15));
    const nearY = Math.max(chunk.y, Math.min(worldCenter.y, chunk.y + 15));
    if (Math.hypot(nearX - worldCenter.x, nearY - worldCenter.y) >= worldRadius || covered(index, chunk)) continue;
    chunks.push(chunk);
  }
  return { chunks, cursor, exhausted: cursor >= end };
}

export function locationInChunks(location: Round5Coordinates, chunks: readonly ExploredChunk[]): boolean {
  return chunks.some((chunk) => location.x >= chunk.x && location.x < chunk.x + chunk.side &&
    location.y >= chunk.y && location.y < chunk.y + chunk.side);
}
