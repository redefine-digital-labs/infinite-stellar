import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  beginEnrollment,
  beginHomeClaim,
  clearPlayerSession,
  completeSearch,
  createInitialSession,
  DEMO_CONTROLLER,
  enterDemo,
  enterOnchainUnavailable,
  finalizeEnrollment,
  finalizeHomeClaim,
  failJourney,
  loadPlayerSession,
  openDemoUniverse,
  rejectCandidate,
  retryJourney,
  savePlayerSession,
  selectSoul,
  submitEnrollment,
  submitHomeClaim,
  type PlayerSession,
} from '@infinite-stellar/game-sdk';

export interface PlayerJourneyController {
  session: PlayerSession;
  enterDemo: () => void;
  enterOnchain: () => void;
  selectSoul: (soulId: string) => void;
  beginEnrollment: () => void;
  finalizeEnrollment: () => void;
  openUniverse: () => void;
  search: () => void;
  rejectCandidate: () => void;
  beginClaim: () => void;
  finalizeClaim: () => void;
  simulateFailure: () => void;
  retry: () => void;
  restart: () => void;
}

export function usePlayerJourney(walletAddress?: string): PlayerJourneyController {
  const [session, setSession] = useState<PlayerSession>(() => createInitialSession());
  const restoredAddresses = useRef(new Set<string>());
  const persistenceAddress = session.controllerAddress ?? walletAddress ?? DEMO_CONTROLLER;

  const mutate = useCallback((transition: (value: PlayerSession) => PlayerSession) => {
    setSession((current) => transition(current));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (restoredAddresses.current.has(persistenceAddress)) return;
    restoredAddresses.current.add(persistenceAddress);
    const restored = loadPlayerSession(window.localStorage, persistenceAddress);
    if (restored && session.stage === 'welcome') setSession(restored);
  }, [persistenceAddress, session.stage]);

  useEffect(() => {
    if (typeof window === 'undefined' || session.stage === 'welcome') return;
    savePlayerSession(window.localStorage, persistenceAddress, session);
  }, [persistenceAddress, session]);

  useEffect(() => {
    if (session.transaction.status !== 'finalizing') return;
    const timer = window.setTimeout(() => {
      if (session.stage === 'enrolling') {
        mutate((current) => finalizeEnrollment(current, new Date()));
      } else if (session.stage === 'claiming') {
        mutate(finalizeHomeClaim);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [mutate, session.stage, session.transaction.status]);

  return useMemo(
    () => ({
      session,
      enterDemo: () => mutate((current) => enterDemo(current, walletAddress ?? DEMO_CONTROLLER)),
      enterOnchain: () => mutate((current) => enterOnchainUnavailable(current, walletAddress)),
      selectSoul: (soulId: string) => mutate((current) => selectSoul(current, soulId)),
      beginEnrollment: () => mutate(beginEnrollment),
      finalizeEnrollment: () => mutate(submitEnrollment),
      openUniverse: () => mutate(openDemoUniverse),
      search: () => mutate(completeSearch),
      rejectCandidate: () => mutate(rejectCandidate),
      beginClaim: () => mutate(beginHomeClaim),
      finalizeClaim: () => mutate(submitHomeClaim),
      simulateFailure: () => mutate((current) => failJourney(current, 'The simulated wallet rejected this request.')),
      retry: () => mutate(retryJourney),
      restart: () => {
        if (typeof window !== 'undefined') {
          clearPlayerSession(window.localStorage, persistenceAddress);
        }
        setSession(createInitialSession());
      },
    }),
    [mutate, persistenceAddress, session, walletAddress],
  );
}
