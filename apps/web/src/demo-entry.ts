import {
  beginEnrollment, beginHomeClaim, completeSearch, finalizeEnrollment,
  finalizeHomeClaim, openDemoUniverse, submitEnrollment, submitHomeClaim,
  type PlayerSession, type MinedRound5Location,
} from '@infinite-stellar/game-sdk';

/** Local Seat setup only. Real Sui enrollment and finality never use this path. */
export function prepareLocalUniverse(session: PlayerSession, now = new Date()): PlayerSession {
  if (session.mode !== 'demo') throw new Error('Local entry cannot initialize a ranked Season.');
  let next = session;
  if (next.stage === 'active' && next.strategy) return next;
  if (next.stage === 'soul-selection') next = beginEnrollment(next);
  if (next.stage === 'enrolling') {
    if (next.transaction.status === 'awaiting-signature') next = submitEnrollment(next);
    next = finalizeEnrollment(next, now);
  }
  if (next.stage === 'sealed-lobby') next = openDemoUniverse(next);
  if (next.stage === 'claim-ready' || next.stage === 'claiming') {
    // Old FNV candidates were not actual planets. Never move an already active game.
    next = { ...next, stage: 'searching', lastStableStage: 'searching',
      transaction: { action: null, status: 'idle' },
      search: { ...next.search, candidate: undefined } };
  }
  if (next.stage !== 'searching' || !next.seat) throw new Error('Select a Soul before searching for a home.');
  return next;
}

export function enterLocalUniverse(session: PlayerSession, home: MinedRound5Location): PlayerSession {
  const next = prepareLocalUniverse(session);
  if (next.stage === 'active') return next;
  const candidate = completeSearch(next, home);
  const active = finalizeHomeClaim(submitHomeClaim(beginHomeClaim(candidate)));
  return { ...active, notice: 'Home found and verified locally. No wallet signature or Sui transaction was created.' };
}
