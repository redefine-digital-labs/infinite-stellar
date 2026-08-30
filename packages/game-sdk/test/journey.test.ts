import { describe, expect, it } from 'vitest';
import {
  beginEnrollment,
  beginHomeClaim,
  completeSearch,
  createInitialSession,
  DEMO_CONTROLLER,
  enterDemo,
  finalizeEnrollment,
  finalizeHomeClaim,
  openDemoUniverse,
  rejectCandidate,
  selectSoul,
  submitEnrollment,
  submitHomeClaim,
  updateSearchProgress,
} from '../src';

function selectedDemoSession() {
  const entered = enterDemo(createInitialSession(), DEMO_CONTROLLER);
  const soul = entered.souls[0];
  if (!soul) throw new Error('Missing demo Soul fixture.');
  return selectSoul(entered, soul.id);
}

function enrolledDemoSession() {
  return finalizeEnrollment(submitEnrollment(beginEnrollment(selectedDemoSession())));
}

describe('player journey', () => {
  it('runs the complete AwaitingHome to Active demo flow', () => {
    const enrolling = beginEnrollment(selectedDemoSession());
    expect(enrolling.transaction.status).toBe('awaiting-signature');

    const submittedEnrollment = submitEnrollment(enrolling);
    expect(submittedEnrollment.transaction.status).toBe('finalizing');
    const seated = finalizeEnrollment(submittedEnrollment, new Date('2030-01-01T00:00:00Z'));
    expect(seated.stage).toBe('sealed-lobby');
    expect(seated.seat?.status).toBe('AwaitingHome');
    expect(seated.seat?.foundingPlanetId).toBeUndefined();

    const opened = openDemoUniverse(seated);
    expect(opened.runtime.universe).toBe('open');
    expect(opened.runtime.universeSeed).toMatch(/^0x[0-9a-f]{64}$/);

    const scanned = updateSearchProgress(opened, 67);
    expect(scanned.search.progress).toBe(67);
    const ready = completeSearch(scanned);
    expect(ready.stage).toBe('claim-ready');
    expect(ready.search.candidate?.commitment).toMatch(/^0x[0-9a-f]{64}$/);

    const submittedClaim = submitHomeClaim(beginHomeClaim(ready));
    expect(submittedClaim.transaction.status).toBe('finalizing');
    const active = finalizeHomeClaim(submittedClaim);
    expect(active.stage).toBe('active');
    expect(active.seat?.status).toBe('Active');
    expect(active.seat?.foundingPlanetId).toBe(active.search.candidate?.id);
  });

  it('can discard a candidate without creating a transaction', () => {
    const ready = completeSearch(
      openDemoUniverse(enrolledDemoSession()),
    );
    const searching = rejectCandidate(ready);
    expect(searching.stage).toBe('searching');
    expect(searching.search.candidate).toBeUndefined();
    expect(searching.search.attempt).toBe(1);
  });

  it('clamps local search progress', () => {
    const searching = openDemoUniverse(
      enrolledDemoSession(),
    );
    expect(updateSearchProgress(searching, -1).search.progress).toBe(0);
    expect(updateSearchProgress(searching, 111).search.progress).toBe(100);
  });
});
