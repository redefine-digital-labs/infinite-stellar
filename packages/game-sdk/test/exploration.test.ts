import { createStrategyGame } from './strategy-fixture';
import { describe, expect, it } from 'vitest';
import { mergeExploredChunks, nextExplorationBatch, exploredChunkArea, locationInChunks,
  createInitialSession, parsePlayerSession } from '../src';

describe('private completed search coverage', () => {
  it('restores validated local coverage while accepting older sessions with no coverage field', () => {
    const strategy = createStrategyGame({ universeSeed: 'coverage', homeId: 'home', homeName: 'HOME' });
    const session = { ...createInitialSession(), strategy };
    const chunk = { x: 0, y: 0, side: 16 };
    expect(parsePlayerSession(JSON.stringify({ ...session, strategy: { ...strategy, exploredChunks: [chunk, chunk] } }))
      ?.strategy?.exploredChunks).toEqual([chunk]);
    expect(parsePlayerSession(JSON.stringify({ ...session, strategy: { ...strategy, exploredChunks: undefined } }))).not.toBeNull();
    expect(parsePlayerSession(JSON.stringify({ ...session, strategy: { ...strategy, exploredChunks: [{ ...chunk, x: 1 }] } }))).toBeNull();
    expect(parsePlayerSession(JSON.stringify({ ...session, strategy: { ...strategy, explorationOrigin: { x: 0.5, y: 0 } } }))).toBeNull();
  });
  it('compacts complete siblings without filling holes or losing negative coordinates', () => {
    const cells = [0, 16].flatMap((x) => [0, 16].map((y) => ({ x, y, side: 16 })));
    expect(mergeExploredChunks(cells)).toEqual([{ x: 0, y: 0, side: 32 }]);
    expect(exploredChunkArea(mergeExploredChunks(cells.slice(1)))).toBe(768);
    expect(locationInChunks({ x: 0, y: 0 }, mergeExploredChunks(cells.slice(1)))).toBe(false);
    const negative = cells.map((cell) => ({ ...cell, x: cell.x - 32, y: cell.y - 32 }));
    expect(mergeExploredChunks(negative, negative)).toEqual([{ x: -32, y: -32, side: 32 }]);
  });

  it('skips completed footprints across restart and relocation but retains unfinished work', () => {
    const origin = { x: 73, y: 6421 };
    const first = nextExplorationBatch(origin, 12000, []);
    expect(first.chunks).toHaveLength(4);
    expect(nextExplorationBatch(origin, 12000, []).chunks).toEqual(first.chunks);
    const coverage = mergeExploredChunks(first.chunks);
    const resumed = nextExplorationBatch(origin, 12000, coverage);
    expect(resumed.chunks.every((cell) => !locationInChunks(cell, coverage))).toBe(true);
    const relocated = nextExplorationBatch({ x: 75, y: 6422 }, 12000, coverage);
    expect(relocated.chunks).toEqual(resumed.chunks);
  });

  it('searches the finite world to exhaustion with no duplicate cells', () => {
    let coverage = mergeExploredChunks([]);
    let cursor = 0;
    for (let turn = 0; turn < 100; turn++) {
      const batch = nextExplorationBatch({ x: 0, y: 0 }, 33, coverage, cursor);
      expect(batch.chunks.every((cell) => !locationInChunks(cell, coverage))).toBe(true);
      coverage = mergeExploredChunks(coverage, batch.chunks);
      cursor = batch.cursor;
      if (batch.exhausted) break;
      if (turn === 99) throw new Error('Search failed to exhaust a small world.');
    }
    for (let x = -32; x <= 32; x++) for (let y = -32; y <= 32; y++) {
      if (Math.hypot(x, y) < 33) expect(locationInChunks({ x, y }, coverage)).toBe(true);
    }
  });

  it('rejects unaligned coverage and invalid search centers', () => {
    expect(() => mergeExploredChunks([{ x: 1, y: 0, side: 16 }])).toThrow(/aligned/);
    expect(() => nextExplorationBatch({ x: 100, y: 0 }, 100, [])).toThrow(/inside/);
    expect(() => nextExplorationBatch({ x: NaN, y: 0 }, 100, [])).toThrow(/integer/);
  });
});
