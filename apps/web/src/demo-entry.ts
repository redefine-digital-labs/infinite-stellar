import {
  beginEnrollment, beginHomeClaim, completeSearch, finalizeEnrollment,
  finalizeHomeClaim, openDemoUniverse, submitEnrollment, submitHomeClaim,
  type PlayerSession,
} from '@infinite-stellar/game-sdk';

/** Local fixtures only. Real enrollment, proof work and wallet finality never use this path. */
export function enterLocalUniverse(session: PlayerSession, now = new Date()): PlayerSession {
  if (session.mode !== 'demo') throw new Error('Local entry cannot initialize a ranked Season.');
  let next = session;
  // Keep finalized Seats/candidates when resuming saves from the former step-by-step demo.
  if (next.stage === 'soul-selection') next = beginEnrollment(next);
  if (next.stage === 'enrolling') {
    if (next.transaction.status === 'awaiting-signature') next = submitEnrollment(next);
    next = finalizeEnrollment(next, now);
  }
  if (next.stage === 'sealed-lobby') next = openDemoUniverse(next);
  if (next.stage === 'searching') next = completeSearch(next);
  if (next.stage === 'claim-ready') next = beginHomeClaim(next);
  if (next.stage === 'claiming') {
    if (next.transaction.status === 'awaiting-signature') next = submitHomeClaim(next);
    next = finalizeHomeClaim(next);
  }
  if (next.stage !== 'active' || !next.strategy) throw new Error('The local universe is not ready to enter.');
  return { ...next, notice: 'Local universe ready. No wallet signature or Sui transaction was created.' };
}
