import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  beginEnrollment,
  beginHomeClaim,
  completeSearch,
  createInitialSession,
  DEMO_CONTROLLER,
  enterDemo,
  enterOnchainUnavailable,
  finalizeEnrollment,
  finalizeHomeClaim,
  failJourney,
  mergeMinedStrategyLocations,
  nextStrategyMinerBatch,
  openDemoUniverse,
  rejectCandidate,
  retryJourney,
  selectStrategyPlanet,
  setStrategyTarget,
  selectSoul,
  dispatchStrategyVoyage,
  dispatchStrategyArtifact,
  advanceStrategyToNextArrival,
  advanceStrategyTime,
  submitEnrollment,
  submitHomeClaim,
  upgradeStrategyPlanet,
  claimStrategyStartingShips,
  dispatchStrategyShip,
  activateStrategyCrescent,
  activateStrategyArtifact,
  deactivateStrategyArtifact,
  depositStrategyArtifact,
  prospectStrategyPlanet,
  findStrategyArtifact,
  invadeStrategyPlanet,
  captureStrategyPlanet,
  revealStrategyPlanet,
  withdrawStrategySilver,
  withdrawStrategyArtifact,
  abandonStrategyPlanet,
  settleStrategyGame,
  type Round5UpgradeBranch,
  type StrategyGame,
  type PlayerSession,
} from '@infinite-stellar/game-sdk';
import { startRound5Miner, type MinerOperation } from './miner-client';
import { browserSessionVault, type SessionVaultProtection } from './session-vault';

export interface StrategyMiningState {
  status: 'idle' | 'mining' | 'cancelling' | 'error';
  checked: number;
  total: number;
  found: number;
  hashesPerSecond?: number;
  error?: string;
}

export interface PlayerVaultState {
  status: 'restoring' | 'sealed' | 'ephemeral' | 'error';
  protection: SessionVaultProtection;
  error?: string;
}

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
  chooseStrategyPlanet: (planetId: string) => void;
  setStrategyTarget: (planetId: string) => void;
  scanStrategy: () => void;
  cancelStrategyScan: () => void;
  mining: StrategyMiningState;
  vault: PlayerVaultState;
  dispatchStrategy: (percentage: number, silverMoved?: number) => void;
  advanceStrategyArrival: () => void;
  advanceStrategyTime: (seconds: number) => void;
  upgradeStrategy: (branch: Round5UpgradeBranch) => void;
  claimStrategyShips: () => void;
  dispatchStrategyShip: (artifactId: string) => void;
  dispatchStrategyArtifact: (artifactId: string) => void;
  activateStrategyCrescent: (artifactId: string) => void;
  activateStrategyArtifact: (artifactId: string) => void;
  deactivateStrategyArtifact: (artifactId?: string) => void;
  withdrawStrategyArtifact: (artifactId: string) => void;
  depositStrategyArtifact: (artifactId: string) => void;
  prospectStrategy: () => void;
  findStrategyArtifact: () => void;
  invadeStrategy: () => void;
  captureStrategy: () => void;
  revealStrategy: () => void;
  withdrawStrategySilver: () => void;
  abandonStrategy: (artifactId?: string) => void;
  settleStrategy: () => void;
  simulateFailure: () => void;
  retry: () => void;
  restart: () => void;
}

export function usePlayerJourney(walletAddress?: string): PlayerJourneyController {
  const [session, setSession] = useState<PlayerSession>(() => createInitialSession());
  const vault = useMemo(browserSessionVault, []);
  const [vaultState, setVaultState] = useState<PlayerVaultState>({
    status: 'restoring',
    protection: vault.protection,
  });
  const [mining, setMining] = useState<StrategyMiningState>({
    status: 'idle',
    checked: 0,
    total: 0,
    found: 0,
  });
  const restoredAddresses = useRef(new Set<string>());
  const readyAddresses = useRef(new Set<string>());
  const miningOperation = useRef<MinerOperation | undefined>(undefined);
  const persistenceAddress = session.controllerAddress ?? walletAddress ?? DEMO_CONTROLLER;

  const mutate = useCallback((transition: (value: PlayerSession) => PlayerSession) => {
    setSession((current) => transition(current));
  }, []);

  const mutateStrategy = useCallback((transition: (value: StrategyGame) => StrategyGame) => {
    setSession((current) => {
      if (!current.strategy) return { ...current, notice: 'The local universe is not initialized.' };
      try {
        const strategy = transition(current.strategy);
        return { ...current, strategy, notice: strategy.log[0]?.message ?? current.notice };
      } catch (error) {
        return {
          ...current,
          notice: error instanceof Error ? error.message : 'The strategy action was rejected.',
        };
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (restoredAddresses.current.has(persistenceAddress)) return;
    let cancelled = false;
    setVaultState({ status: 'restoring', protection: vault.protection });
    void vault.restore(persistenceAddress, window.localStorage).then((restored) => {
      if (cancelled) return;
      restoredAddresses.current.add(persistenceAddress);
      readyAddresses.current.add(persistenceAddress);
      setVaultState({
        status: vault.protection === 'indexeddb-aes-gcm' ? 'sealed' : 'ephemeral',
        protection: vault.protection,
      });
      if (restored) setSession((current) => current.stage === 'welcome' ? restored : current);
    }).catch((error) => {
      if (cancelled) return;
      setVaultState({
        status: 'error',
        protection: vault.protection,
        error: error instanceof Error ? error.message : 'The private vault could not be restored.',
      });
    });
    return () => { cancelled = true; };
  }, [persistenceAddress, vault]);

  useEffect(() => {
    if (typeof window === 'undefined' || session.stage === 'welcome') return;
    if (!readyAddresses.current.has(persistenceAddress) || vaultState.status === 'error') return;
    void vault.save(persistenceAddress, session).catch((error) => {
      setVaultState({
        status: 'error',
        protection: vault.protection,
        error: error instanceof Error ? error.message : 'The private vault could not be saved.',
      });
    });
  }, [persistenceAddress, session, vault, vaultState.status]);

  useEffect(() => () => miningOperation.current?.cancel(), []);

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

  const cancelStrategyScan = useCallback(() => {
    if (!miningOperation.current) return;
    setMining((current) => ({ ...current, status: 'cancelling' }));
    miningOperation.current.cancel();
  }, []);

  const scanStrategy = useCallback(() => {
    if (!session.strategy || miningOperation.current) return;
    let chunks;
    try {
      chunks = nextStrategyMinerBatch(session.strategy);
    } catch (error) {
      setMining({
        status: 'error',
        checked: 0,
        total: 0,
        found: 0,
        error: error instanceof Error ? error.message : 'The mining frontier could not be derived.',
      });
      return;
    }
    const operation: MinerOperation = startRound5Miner(chunks, (progress) => {
      if (miningOperation.current?.requestId !== operation.requestId) return;
      setMining({ status: 'mining', ...progress });
    });
    miningOperation.current = operation;
    setMining({
      status: 'mining',
      checked: 0,
      total: chunks.reduce((total, chunk) => total + chunk.side * chunk.side, 0),
      found: 0,
    });
    void operation.result.then((result) => {
      if (miningOperation.current?.requestId !== operation.requestId) return;
      miningOperation.current = undefined;
      mutateStrategy((game) => mergeMinedStrategyLocations(game, result.locations, chunks));
      setMining({
        status: 'idle',
        checked: result.checked,
        total: result.total,
        found: result.found,
        hashesPerSecond: Math.round(result.checked / (result.elapsedMs / 1_000)),
      });
    }).catch((error) => {
      if (miningOperation.current?.requestId !== operation.requestId) return;
      miningOperation.current = undefined;
      if (error instanceof DOMException && error.name === 'AbortError') {
        setMining({ status: 'idle', checked: 0, total: 0, found: 0 });
        return;
      }
      setMining((current) => ({
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'The local miner failed.',
      }));
    });
  }, [mutateStrategy, session.strategy]);

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
      chooseStrategyPlanet: (planetId: string) => mutateStrategy((game) => selectStrategyPlanet(game, planetId)),
      setStrategyTarget: (planetId: string) => mutateStrategy((game) => setStrategyTarget(game, planetId)),
      scanStrategy,
      cancelStrategyScan,
      mining,
      vault: vaultState,
      dispatchStrategy: (percentage: number, silverMoved = 0) =>
        mutateStrategy((game) => dispatchStrategyVoyage(game, percentage, silverMoved)),
      advanceStrategyArrival: () => mutateStrategy(advanceStrategyToNextArrival),
      advanceStrategyTime: (seconds: number) => mutateStrategy((game) => advanceStrategyTime(game, seconds)),
      upgradeStrategy: (branch: Round5UpgradeBranch) => mutateStrategy((game) => upgradeStrategyPlanet(game, branch)),
      claimStrategyShips: () => mutateStrategy(claimStrategyStartingShips),
      dispatchStrategyShip: (artifactId: string) => mutateStrategy((game) => dispatchStrategyShip(game, artifactId)),
      dispatchStrategyArtifact: (artifactId: string) => mutateStrategy((game) => dispatchStrategyArtifact(game, artifactId)),
      activateStrategyCrescent: (artifactId: string) => mutateStrategy((game) => activateStrategyCrescent(game, artifactId)),
      activateStrategyArtifact: (artifactId: string) => mutateStrategy((game) => activateStrategyArtifact(game, artifactId)),
      deactivateStrategyArtifact: (artifactId?: string) => mutateStrategy((game) => deactivateStrategyArtifact(game, artifactId)),
      withdrawStrategyArtifact: (artifactId: string) => mutateStrategy((game) => withdrawStrategyArtifact(game, artifactId)),
      depositStrategyArtifact: (artifactId: string) => mutateStrategy((game) => depositStrategyArtifact(game, artifactId)),
      prospectStrategy: () => mutateStrategy(prospectStrategyPlanet),
      findStrategyArtifact: () => mutateStrategy(findStrategyArtifact),
      invadeStrategy: () => mutateStrategy(invadeStrategyPlanet),
      captureStrategy: () => mutateStrategy(captureStrategyPlanet),
      revealStrategy: () => mutateStrategy(revealStrategyPlanet),
      withdrawStrategySilver: () => mutateStrategy(withdrawStrategySilver),
      abandonStrategy: (artifactId?: string) => mutateStrategy((game) =>
        abandonStrategyPlanet(game, artifactId)),
      settleStrategy: () => mutateStrategy(settleStrategyGame),
      simulateFailure: () => mutate((current) => failJourney(current, 'The simulated wallet rejected this request.')),
      retry: () => mutate(retryJourney),
      restart: () => {
        miningOperation.current?.cancel();
        miningOperation.current = undefined;
        setMining({ status: 'idle', checked: 0, total: 0, found: 0 });
        if (typeof window !== 'undefined') {
          void vault.clear(persistenceAddress, window.localStorage).catch((error) => {
            setVaultState({
              status: 'error',
              protection: vault.protection,
              error: error instanceof Error ? error.message : 'The private vault could not be cleared.',
            });
          });
        }
        setSession(createInitialSession());
      },
    }),
    [
      cancelStrategyScan,
      mining,
      mutate,
      mutateStrategy,
      persistenceAddress,
      scanStrategy,
      session,
      vault,
      vaultState,
      walletAddress,
    ],
  );
}
