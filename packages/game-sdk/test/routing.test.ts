import { describe, expect, it } from 'vitest';
import { createDemoSouls, createDemoSeat, DEMO_CONTROLLER, resolvePlayerRoute } from '../src';

describe('Seat-first routing', () => {
  it('resumes an existing fixed-controller Seat before scanning current Souls', () => {
    const soul = createDemoSouls(DEMO_CONTROLLER)[0];
    if (!soul) throw new Error('Missing demo Soul fixture.');
    const seat = createDemoSeat(DEMO_CONTROLLER, soul);
    expect(
      resolvePlayerRoute({
        existingSeat: seat,
        eligibleSouls: [],
        productionAdapterReady: false,
      }),
    ).toBe('resume-seat');
  });

  it('fails closed when no production adapter exists', () => {
    expect(
      resolvePlayerRoute({
        eligibleSouls: createDemoSouls(DEMO_CONTROLLER),
        productionAdapterReady: false,
      }),
    ).toBe('integration-unavailable');
  });
});
