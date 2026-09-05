import { describe, expect, it } from 'vitest';
import { ROUND5_RULES_GEOMETRY, createRulesGeometryCommitment } from '@infinite-stellar/prover';
import {
  createRankedLocationMiner, rankedMiningGeometry, round5MimcSponge, round5WorldLocation,
  type RankedMiningGeometry, type RankedUniverseProjection,
} from '../src';

function geometry(overrides: Partial<RankedMiningGeometry> = {}): RankedMiningGeometry {
  const value = { ...ROUND5_RULES_GEOMETRY, ...overrides };
  return { ...value, rulesGeometryCommitment: createRulesGeometryCommitment(value) };
}

describe('manifest-bound ranked mining', () => {
  it('matches the reference location and tests the inclusive/exclusive home interval', () => {
    const mine = createRankedLocationMiner(geometry());
    expect(mine({ x: 73, y: 6421 })).toEqual({ ...round5WorldLocation({ x: 73, y: 6421 }), homeEligible: true });
    expect(createRankedLocationMiner(geometry({ homePerlinMinInclusive: 12, homePerlinMaxExclusive: 13 }))({ x: 73, y: 6421 })?.homeEligible).toBe(false);
  });

  it('uses the actual season key and threshold, not the demo defaults', () => {
    const coordinates = { x: -41, y: 57 };
    const key = 919n;
    const hash = round5MimcSponge([coordinates.x, coordinates.y], key);
    // Find an exact 252-bit-compatible witness to exercise the configurable key.
    let x = coordinates.x;
    while (round5MimcSponge([x, coordinates.y], key) >= (1n << 252n) - 1n) x++;
    const expected = round5MimcSponge([x, coordinates.y], key);
    const params = geometry({ locationHashKey: key, planetHashThreshold: expected + 1n });
    expect(createRankedLocationMiner(params)({ x, y: coordinates.y })?.hash).toBe(expected);
    if (expected > 0n) expect(createRankedLocationMiner(geometry({ ...params, planetHashThreshold: expected }))({ x, y: coordinates.y })).toBeUndefined();
    expect(hash).not.toBe(round5MimcSponge([coordinates.x, coordinates.y], 115n));
  });

  it('rejects changed geometry, invalid coordinates and radius-boundary locations', () => {
    const params = geometry();
    expect(() => createRankedLocationMiner({ ...params, locationHashKey: 999n })).toThrow(/commitment/);
    const mine = createRankedLocationMiner(params);
    expect(() => mine({ x: 0.5, y: 0 })).toThrow(/exact integers/);
    expect(mine({ x: Number(params.worldRadius), y: 0 })).toBeUndefined();
    expect(mine({ x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER })).toBeUndefined();
  });

  it('blocks pre-seed/closed exploration but permits local work during an onchain pause', () => {
    const params = geometry();
    const projection = {
      manifest: { ...params, homePerlinMin: 13, homePerlinMax: 14 },
      runtime: { universeOpened: false, cancelled: false, settlementStarted: false, paused: true },
    } as unknown as RankedUniverseProjection;
    expect(() => rankedMiningGeometry(projection)).toThrow(/not open/);
    projection.runtime.universeOpened = true;
    expect(rankedMiningGeometry(projection)).toEqual(params);
    projection.runtime.cancelled = true;
    expect(() => rankedMiningGeometry(projection)).toThrow(/closed/);
  });
});
