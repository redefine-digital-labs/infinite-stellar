import {
  createDemoSeat,
  createDemoSouls,
  demoDigest,
  findDemoHomeCandidate,
} from './demo';
import type { JourneyStage, PlayerSession } from './types';

export class JourneyTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JourneyTransitionError';
  }
}

function requireStage(session: PlayerSession, ...stages: JourneyStage[]): void {
  if (!stages.includes(session.stage)) {
    throw new JourneyTransitionError(
      `Action is unavailable from ${session.stage}; expected ${stages.join(' or ')}.`,
    );
  }
}

function selectedSoul(session: PlayerSession) {
  const soul = session.souls.find((candidate) => candidate.id === session.selectedSoulId);
  if (!soul) throw new JourneyTransitionError('Select an eligible Soul first.');
  return soul;
}

export function enterDemo(
  session: PlayerSession,
  controllerAddress: string,
): PlayerSession {
  requireStage(session, 'welcome', 'unavailable');
  return {
    ...session,
    mode: 'demo',
    controllerAddress,
    souls: createDemoSouls(controllerAddress),
    stage: 'soul-selection',
    lastStableStage: 'soul-selection',
    notice: 'Local simulation. Nothing here is submitted to Sui.',
  };
}

export function enterOnchainUnavailable(
  session: PlayerSession,
  controllerAddress?: string,
): PlayerSession {
  requireStage(session, 'welcome', 'soul-selection');
  return {
    ...session,
    mode: 'onchain',
    controllerAddress,
    stage: 'unavailable',
    lastStableStage: 'unavailable',
    notice:
      'Live Soul enrollment is fail-closed until the production Soul adapter and proof verifier are pinned.',
  };
}

export function selectSoul(session: PlayerSession, soulId: string): PlayerSession {
  requireStage(session, 'soul-selection');
  const soul = session.souls.find((candidate) => candidate.id === soulId);
  if (!soul || soul.listed || soul.owner !== session.controllerAddress) {
    throw new JourneyTransitionError('That Soul is not eligible for this controller.');
  }
  return { ...session, selectedSoulId: soulId };
}

export function beginEnrollment(session: PlayerSession): PlayerSession {
  requireStage(session, 'soul-selection');
  selectedSoul(session);
  return {
    ...session,
    stage: 'enrolling',
    transaction: { action: 'enroll', status: 'awaiting-signature' },
  };
}

export function submitEnrollment(session: PlayerSession): PlayerSession {
  requireStage(session, 'enrolling');
  if (session.transaction.status !== 'awaiting-signature') {
    throw new JourneyTransitionError('Enrollment is not awaiting approval.');
  }
  return {
    ...session,
    transaction: { action: 'enroll', status: 'finalizing' },
    notice: 'Simulated enrollment submitted. Waiting for checkpoint finality.',
  };
}

export function finalizeEnrollment(
  session: PlayerSession,
  now = new Date(0),
): PlayerSession {
  requireStage(session, 'enrolling');
  if (session.transaction.status !== 'finalizing') {
    throw new JourneyTransitionError('Enrollment must be submitted before finalization.');
  }
  if (!session.controllerAddress) {
    throw new JourneyTransitionError('A controller address is required.');
  }
  const soul = selectedSoul(session);
  const seat = createDemoSeat(session.controllerAddress, soul, now);
  return {
    ...session,
    seat,
    stage: 'sealed-lobby',
    lastStableStage: 'sealed-lobby',
    transaction: {
      action: 'enroll',
      status: 'finalized',
      digest: demoDigest('enroll', seat.id),
    },
    notice: 'Seat created. No Planet exists until the universe opens and a home is claimed.',
  };
}

export function openDemoUniverse(session: PlayerSession): PlayerSession {
  requireStage(session, 'sealed-lobby');
  if (!session.seat) throw new JourneyTransitionError('A Season Seat is required.');
  const universeSeed = demoDigest('universe', session.runtime.seasonLabel);
  return {
    ...session,
    stage: 'searching',
    lastStableStage: 'searching',
    runtime: {
      ...session.runtime,
      universe: 'open',
      universeSeed,
      homeClaimNotBeforeAt: 'Observation gate satisfied',
    },
    search: { attempt: 0, progress: 0 },
    transaction: {
      action: 'open-universe',
      status: 'finalized',
      digest: demoDigest('open-universe', universeSeed),
    },
    notice: 'The seed is public. Coordinate search and proof material stay on this device.',
  };
}

export function updateSearchProgress(
  session: PlayerSession,
  progress: number,
): PlayerSession {
  requireStage(session, 'searching');
  return {
    ...session,
    search: {
      ...session.search,
      progress: Math.max(0, Math.min(100, Math.round(progress))),
    },
  };
}

export function completeSearch(session: PlayerSession): PlayerSession {
  requireStage(session, 'searching');
  if (!session.runtime.universeSeed || !session.seat) {
    throw new JourneyTransitionError('The finalized universe seed and Seat are required.');
  }
  const attempt = session.search.attempt + 1;
  const candidate = findDemoHomeCandidate(
    session.runtime.universeSeed,
    session.seat.soulId,
    attempt,
  );
  return {
    ...session,
    stage: 'claim-ready',
    lastStableStage: 'claim-ready',
    search: { attempt, progress: 100, candidate },
    notice: 'Candidate and proof fixture prepared locally. Coordinates remain private.',
  };
}

export function rejectCandidate(session: PlayerSession): PlayerSession {
  requireStage(session, 'claim-ready');
  return {
    ...session,
    stage: 'searching',
    lastStableStage: 'searching',
    search: { attempt: session.search.attempt, progress: 0 },
    notice: 'Candidate discarded locally. No transaction was created.',
  };
}

export function beginHomeClaim(session: PlayerSession): PlayerSession {
  requireStage(session, 'claim-ready');
  if (!session.search.candidate) {
    throw new JourneyTransitionError('A local home candidate is required.');
  }
  return {
    ...session,
    stage: 'claiming',
    transaction: { action: 'claim-home', status: 'awaiting-signature' },
  };
}

export function submitHomeClaim(session: PlayerSession): PlayerSession {
  requireStage(session, 'claiming');
  if (session.transaction.status !== 'awaiting-signature') {
    throw new JourneyTransitionError('Home claim is not awaiting approval.');
  }
  return {
    ...session,
    transaction: { action: 'claim-home', status: 'finalizing' },
    notice: 'Simulated home claim submitted. Waiting for checkpoint finality.',
  };
}

export function finalizeHomeClaim(session: PlayerSession): PlayerSession {
  requireStage(session, 'claiming');
  if (session.transaction.status !== 'finalizing') {
    throw new JourneyTransitionError('Home claim must be submitted before finalization.');
  }
  const candidate = session.search.candidate;
  if (!candidate || !session.seat) {
    throw new JourneyTransitionError('Candidate and Seat are required.');
  }
  const seat = {
    ...session.seat,
    status: 'Active' as const,
    foundingPlanetId: candidate.id,
  };
  return {
    ...session,
    seat,
    stage: 'active',
    lastStableStage: 'active',
    transaction: {
      action: 'claim-home',
      status: 'finalized',
      digest: demoDigest('claim-home', candidate.commitment),
    },
    notice: 'Civilization activated. The Season Seat—not the Soul—owns this Planet.',
  };
}

export function failJourney(session: PlayerSession, message: string): PlayerSession {
  return {
    ...session,
    stage: 'error',
    transaction: {
      ...session.transaction,
      status: 'failed',
      error: message,
    },
  };
}

export function retryJourney(session: PlayerSession): PlayerSession {
  requireStage(session, 'error');
  return {
    ...session,
    stage: session.lastStableStage,
    transaction: { action: null, status: 'idle' },
    notice: 'Previous failure cleared. No finalized state was rolled back.',
  };
}
