import { describe, expect, it } from 'vitest';
import {
  createDemoSouls,
  DEMO_CONTROLLER,
  createLocalHomeCandidate,
  round5WorldLocation,
} from '../src';

describe('local demo fixtures', () => {
  it('are deterministic and explicitly marked as demo data', () => {
    const first = createDemoSouls(DEMO_CONTROLLER);
    const second = createDemoSouls(DEMO_CONTROLLER);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first.every((soul) => soul.source === 'demo')).toBe(true);
  });

  it('derives stable private candidate material without exposing it in the sector code', () => {
    const a = createLocalHomeCandidate(round5WorldLocation({ x: 73, y: 6421 })!);
    const b = createLocalHomeCandidate(round5WorldLocation({ x: 73, y: 6421 })!);
    expect(a).toEqual(b);
    expect(a.energy).toBe(50_000);
    expect(a.sectorCode).not.toContain(String(a.privateMaterial.x));
    expect(a.proofDigest).toBeUndefined();
    expect(a.privateMaterial).toEqual({ x: 73, y: 6421 });
    expect(() => JSON.stringify(a)).not.toThrow();
  });
});
