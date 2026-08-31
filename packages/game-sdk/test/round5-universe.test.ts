import { describe, expect, it } from 'vitest';

import {
  isRound5PlanetHash,
  round5LocationHash,
  round5LocationId,
  round5Perlin,
  ROUND5_BIOMEBASE_KEY,
  ROUND5_SPACE_TYPE_KEY,
} from '../src/round5-universe';

describe('Dark Forest v0.6 Round 5 universe compatibility', () => {
  const vectors = [
    {
      x: 0,
      y: 0,
      hash: '3594538714434684088814295968263233964499310394944376567764511722294360401873',
      perlin: 16,
      biomebase: 16,
    },
    {
      x: 1,
      y: 2,
      hash: '14646773436172144660257908309483355245740965797576224216293468680892788133461',
      perlin: 15,
      biomebase: 16,
    },
    {
      x: -17,
      y: 42,
      hash: '2635986728571778209836591538002533776565060368058619431018804540088073581351',
      perlin: 15,
      biomebase: 15,
    },
    {
      x: 1234,
      y: -5678,
      hash: '16033151439271819167041637927178902034222058964093791499006674680020908623743',
      perlin: 17,
      biomebase: 13,
    },
  ] as const;

  it.each(vectors)('matches the canonical hash and Perlin vector at ($x, $y)', (vector) => {
    expect(round5LocationHash(vector.x, vector.y).toString()).toBe(vector.hash);
    expect(round5LocationId(vector.x, vector.y)).toBe(BigInt(vector.hash).toString(16).padStart(64, '0'));
    expect(round5Perlin(vector, { key: ROUND5_SPACE_TYPE_KEY })).toBe(vector.perlin);
    expect(round5Perlin(vector, { key: ROUND5_BIOMEBASE_KEY })).toBe(vector.biomebase);
  });

  it('applies the exact Round 5 planet-rarity threshold', () => {
    expect(isRound5PlanetHash(0n)).toBe(true);
    expect(isRound5PlanetHash(round5LocationHash(0, 0))).toBe(false);
  });
});
