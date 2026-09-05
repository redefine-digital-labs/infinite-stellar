import { describe, expect, it } from 'vitest';
import {
  beginEnrollment, beginHomeClaim, completeSearch, createInitialSession, DEMO_CONTROLLER,
  enterDemo, finalizeEnrollment, openDemoUniverse, selectSoul, submitEnrollment,
  submitHomeClaim, round5WorldLocation,
} from '@infinite-stellar/game-sdk';
import { enterLocalUniverse, prepareLocalUniverse } from './demo-entry';

const home = round5WorldLocation({ x: 73, y: 6421 })!;

function selected() {
  const session = enterDemo(createInitialSession(), DEMO_CONTROLLER);
  return selectSoul(session, session.souls[0]!.id);
}

describe('single-action local entry', () => {
  it('creates a playable home after Soul selection without wallet approval', () => {
    const result = enterLocalUniverse(selected(), home);
    expect(result.stage).toBe('active');
    expect(result.strategy?.planets.filter((planet) => planet.discovered)).toHaveLength(1);
    expect(result.seat?.status).toBe('Active');
    expect(result.notice).toContain('No wallet signature');
  });

  it('never applies the local shortcut to ranked state', () => {
    expect(() => enterLocalUniverse({ ...selected(), mode: 'onchain' }, home)).toThrow(/ranked/i);
    expect(() => enterLocalUniverse(enterDemo(createInitialSession(), DEMO_CONTROLLER), home)).toThrow(/select/i);
  });

  it('resumes every old setup boundary without replacing finalized identity', () => {
    const enrolling = beginEnrollment(selected());
    const pending = submitEnrollment(enrolling);
    const seated = finalizeEnrollment(pending);
    const searching = openDemoUniverse(seated);
    const candidate = completeSearch(searching, home);
    const claiming = beginHomeClaim(candidate);
    for (const saved of [enrolling, pending, seated, searching, candidate, claiming, submitHomeClaim(claiming)]) {
      const resumed = enterLocalUniverse(saved, home);
      expect(resumed.stage).toBe('active');
      expect(resumed.seat?.soulId).toBe(saved.selectedSoulId);
      if (saved.seat) expect(resumed.seat?.id).toBe(saved.seat.id);
      if (saved.search.candidate) expect(resumed.search.candidate).toEqual(saved.search.candidate);
    }
  });

  it('replaces an unclaimed legacy synthetic candidate but keeps the Seat', () => {
    const prepared = prepareLocalUniverse(selected());
    const old = { ...prepared, stage: 'claim-ready' as const,
      search: { attempt: 1, progress: 100, candidate: { id: 'old', sectorCode: 'old',
        planetClass: 'Cinder' as const, energy: 50_000, commitment: 'old',
        privateMaterial: { x: 1, y: 2, salt: 'old' } } } };
    const resumed = prepareLocalUniverse(old);
    expect(resumed.stage).toBe('searching');
    expect(resumed.search.candidate).toBeUndefined();
    expect(resumed.seat).toBe(old.seat);
  });

  it('does not reset a resumed active game', () => {
    const active = enterLocalUniverse(selected(), home);
    const resumed = enterLocalUniverse(active, home);
    expect(resumed.strategy).toBe(active.strategy);
    expect(resumed.seat).toBe(active.seat);
  });
});
