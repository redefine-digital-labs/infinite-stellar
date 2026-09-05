import { describe, expect, it } from 'vitest';
import {
  beginEnrollment, beginHomeClaim, completeSearch, createInitialSession, DEMO_CONTROLLER,
  enterDemo, finalizeEnrollment, openDemoUniverse, selectSoul, submitEnrollment,
  submitHomeClaim,
} from '@infinite-stellar/game-sdk';
import { enterLocalUniverse } from './demo-entry';

function selected() {
  const session = enterDemo(createInitialSession(), DEMO_CONTROLLER);
  return selectSoul(session, session.souls[0]!.id);
}

describe('single-action local entry', () => {
  it('creates a playable home after Soul selection without wallet approval', () => {
    const result = enterLocalUniverse(selected());
    expect(result.stage).toBe('active');
    expect(result.strategy?.planets.filter((planet) => planet.discovered)).toHaveLength(1);
    expect(result.seat?.status).toBe('Active');
    expect(result.notice).toContain('No wallet signature');
  });

  it('never applies the local shortcut to ranked state', () => {
    expect(() => enterLocalUniverse({ ...selected(), mode: 'onchain' })).toThrow(/ranked/i);
    expect(() => enterLocalUniverse(enterDemo(createInitialSession(), DEMO_CONTROLLER))).toThrow(/select/i);
  });

  it('resumes every old setup boundary without replacing finalized identity or a home candidate', () => {
    const enrolling = beginEnrollment(selected());
    const pending = submitEnrollment(enrolling);
    const seated = finalizeEnrollment(pending);
    const searching = openDemoUniverse(seated);
    const candidate = completeSearch(searching);
    const claiming = beginHomeClaim(candidate);
    for (const saved of [enrolling, pending, seated, searching, candidate, claiming, submitHomeClaim(claiming)]) {
      const resumed = enterLocalUniverse(saved);
      expect(resumed.stage).toBe('active');
      expect(resumed.seat?.soulId).toBe(saved.selectedSoulId);
      if (saved.seat) expect(resumed.seat?.id).toBe(saved.seat.id);
      if (saved.search.candidate) expect(resumed.search.candidate).toBe(saved.search.candidate);
    }
  });

  it('does not reset a resumed active game', () => {
    const active = enterLocalUniverse(selected());
    const resumed = enterLocalUniverse(active);
    expect(resumed.strategy).toBe(active.strategy);
    expect(resumed.seat).toBe(active.seat);
  });
});
