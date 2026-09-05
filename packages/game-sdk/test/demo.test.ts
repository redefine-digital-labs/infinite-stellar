import { describe, expect, it } from 'vitest';
import {
  createDemoSouls,
  DEMO_CONTROLLER,
  findDemoHomeCandidate,
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
    const a = findDemoHomeCandidate('seed', 'soul', 1);
    const b = findDemoHomeCandidate('seed', 'soul', 1);
    expect(a).toEqual(b);
    expect(a.energy).toBe(50_000);
    expect(a.sectorCode).not.toContain(String(a.privateMaterial.x));
    expect(a.sectorCode).not.toContain(a.privateMaterial.salt);
  });
});
