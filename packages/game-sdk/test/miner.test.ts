import { describe, expect, it } from 'vitest';
import {
  createStrategyGame,
  mergeMinedStrategyLocations,
  mineRound5Chunks,
  nextStrategyMinerBatch,
  round5MinerBatch,
  round5MinerSpiralOffset,
  round5WorldLocation,
  round5MinerTotal,
} from '../src';

describe('Round-5 Worker mining contracts', () => {
  it('rejects overflowing coordinates and unbounded batches before scanning', () => {
    expect(() => round5MinerTotal([{ index: 0, x: Number.MAX_SAFE_INTEGER, y: 0, side: 1 }])).toThrow();
    expect(() => round5MinerTotal([])).toThrow();
    expect(() => round5MinerTotal(Array.from({ length: 64 }, (_, index) => ({ index, x: 0, y: 0, side: 512 })))).toThrow(/work limit/);
  });
  it('walks deterministic non-overlapping chunks in a square spiral', () => {
    expect(Array.from({ length: 9 }, (_, index) => round5MinerSpiralOffset(index))).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ]);
    const batch = round5MinerBatch({ x: 73, y: 6421 }, 0);
    expect(batch.map((chunk) => chunk.index)).toEqual([0, 1, 2, 3]);
    expect(new Set(batch.map((chunk) => `${chunk.x}:${chunk.y}`)).size).toBe(4);
  });

  it('finds a pinned valid coordinate with the exact universe hash', () => {
    const locations = mineRound5Chunks([{ index: 0, x: 73, y: 6421, side: 1 }]);
    expect(locations).toHaveLength(1);
    expect(locations[0]).toMatchObject({ x: 73, y: 6421, perlin: 13 });
    expect(locations[0]?.locationId).toHaveLength(64);
  });

  it('revalidates Worker output before revealing the mined frontier', () => {
    const game = createStrategyGame({ universeSeed: 'miner-test', homeId: 'home', homeName: 'FIRST' });
    const hidden = game.planets.find((planet) => !planet.discovered)!;
    const world = round5WorldLocation({ x: hidden.x, y: hidden.y })!;
    const chunks = nextStrategyMinerBatch(game);
    const mined = mergeMinedStrategyLocations(game, [{
      x: world.x,
      y: world.y,
      locationId: world.locationId,
      perlin: world.perlin,
      biomebase: world.biomebase,
    }], chunks);
    expect(mined.planets.find((planet) => planet.id === hidden.id)?.discovered).toBe(true);
    expect(mined.scans).toBe(game.scans + 1);

    const rejected = mergeMinedStrategyLocations(game, [{
      x: world.x,
      y: world.y,
      locationId: `${world.locationId.slice(0, -1)}0`,
      perlin: world.perlin,
      biomebase: world.biomebase,
    }], chunks);
    expect(rejected.planets.find((planet) => planet.id === hidden.id)?.discovered).toBe(false);
  });
});
