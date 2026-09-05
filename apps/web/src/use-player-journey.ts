import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createInitialSession,
  DEMO_CONTROLLER,
  enterDemo,
  enterOnchainUnavailable,
  failJourney,
  mergeMinedStrategyLocations,
  nextExplorationBatch,
  mergeExploredChunks,
  retryJourney,
  selectStrategyPlanet,
  setStrategyTarget,
  selectSoul,
  dispatchStrategyVoyage,
  dispatchStrategyArtifact,
  advanceStrategyToNextArrival,
  advanceStrategyTime,
  synchronizeStrategyClock,
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
  type Round5Coordinates,
  type ExploredChunk,
  executeStrategyMoveIntent,
  executeStrategyAbility,
  type StrategyMoveIntent,
  type StrategyAbility,
} from '@infinite-stellar/game-sdk';
import { enterLocalUniverse } from './demo-entry';
import { startRound5Miner, type MinerOperation } from './miner-client';
import { browserSessionVault, type SessionVaultProtection } from './session-vault';

export interface StrategyMiningState {
  status: 'idle' | 'mining' | 'cancelling' | 'error';
  checked: number;
  total: number;
  found: number;
  hashesPerSecond?: number;
  error?: string;
  origin?: Round5Coordinates;
  chunks?: ExploredChunk[];
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
  enterUniverse: () => void;
  hasSavedDemo: boolean;
  chooseStrategyPlanet: (planetId?: string) => void;
  setStrategyTarget: (planetId?: string) => void;
  scanStrategy: (center?: Round5Coordinates) => void;
  cancelStrategyScan: () => void;
  mining: StrategyMiningState;
  vault: PlayerVaultState;
  dispatchStrategy: (percentage: number, silverMoved?: number, sourceId?: string, targetId?: string) => void;
  executeMoveIntent: (intent: StrategyMoveIntent) => void;
  executeAbility: (sourceId: string, ability: StrategyAbility) => void;
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
  const savedDemos = useRef(new Map<string, PlayerSession>());
  const restoredAddresses = useRef(new Set<string>());
  const readyAddresses = useRef(new Set<string>());
  const miningOperation = useRef<MinerOperation | undefined>(undefined);
  const explorerEpoch = useRef(0);
  const explorerRunning = useRef(false);
  const currentStrategy = useRef(session.strategy);
  currentStrategy.current = session.strategy;
  const persistenceAddress = session.controllerAddress ?? walletAddress ?? DEMO_CONTROLLER;

  const mutate = useCallback((transition: (value: PlayerSession) => PlayerSession) => {
    setSession((current) => transition(current));
  }, []);

  const mutateStrategy = useCallback((transition: (value: StrategyGame) => StrategyGame) => {
    setSession((current) => {
      if (!current.strategy) return { ...current, notice: 'The local universe is not initialized.' };
      try {
        const strategy = transition(current.mode === 'demo'
          ? synchronizeStrategyClock(current.strategy, Date.now()) : current.strategy);
        return { ...current, strategy, notice: strategy.log[0]?.message ?? current.notice };
      } catch (error) {
        return {
          ...current,
          notice: error instanceof Error ? error.message : 'The strategy action was rejected.',
        };
      }
    });
  }, []);

  const clockActive = session.mode === 'demo' && session.stage === 'active' && Boolean(session.strategy && !session.strategy.settled);
  useEffect(() => {
    if (!clockActive) return;
    const tick = () => setSession((current) => {
      if (current.mode !== 'demo' || current.stage !== 'active' || !current.strategy || current.strategy.settled) return current;
      try {
        const strategy = synchronizeStrategyClock(current.strategy, Date.now());
        if (strategy === current.strategy) return current;
        return { ...current, strategy, notice: strategy.log[0]?.message ?? current.notice };
      } catch (error) {
        return { ...current, notice: error instanceof Error ? error.message : 'The local clock could not advance.' };
      }
    });
    tick();
    const timer = window.setInterval(tick, 250);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [clockActive, persistenceAddress]);

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
      if (restored?.mode === 'demo' && restored.controllerAddress === persistenceAddress) {
        savedDemos.current.set(persistenceAddress, restored);
        setSession((current) => current.stage === 'welcome' ? restored : current);
      }
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
    if (typeof window === 'undefined' || session.mode !== 'demo' || session.stage === 'welcome') return;
    if (!readyAddresses.current.has(persistenceAddress) || vaultState.status === 'error') return;
    savedDemos.current.set(persistenceAddress, session);
    void vault.save(persistenceAddress, session).catch((error) => {
      setVaultState({
        status: 'error',
        protection: vault.protection,
        error: error instanceof Error ? error.message : 'The private vault could not be saved.',
      });
    });
  }, [persistenceAddress, session, vault, vaultState.status]);

  useEffect(() => () => {
    explorerEpoch.current += 1;
    explorerRunning.current = false;
    miningOperation.current?.cancel();
    miningOperation.current = undefined;
  }, [persistenceAddress]);

  const cancelStrategyScan = useCallback(() => {
    explorerEpoch.current += 1;
    explorerRunning.current = false;
    miningOperation.current?.cancel();
    miningOperation.current = undefined;
    setMining((current) => ({ ...current, status: 'idle', chunks: [] }));
  }, []);

  const scanStrategy = useCallback((center?: Round5Coordinates) => {
    const initial = currentStrategy.current;
    const home = initial?.planets.find((planet) => planet.isHome);
    if (!initial || !home || explorerRunning.current || miningOperation.current) return;
    const origin = center ?? initial.explorationOrigin ?? { x: home.x, y: home.y };
    const epoch = ++explorerEpoch.current;
    explorerRunning.current = true;
    const current = () => epoch === explorerEpoch.current && explorerRunning.current;
    void (async () => {
      let cursor = 0;
      let coverage = initial.exploredChunks ?? [];
      while (current()) {
        const game = currentStrategy.current;
        if (!game || game.settled || game.universeSeed !== initial.universeSeed) break;
        coverage = mergeExploredChunks(coverage, game.exploredChunks ?? []);
        const next = nextExplorationBatch(origin, game.worldRadius, coverage, cursor, home);
        cursor = next.cursor;
        const chunks = next.chunks;
        if (!chunks.length) {
          if (next.exhausted) break;
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          continue;
        }
        const total = chunks.reduce((sum, chunk) => sum + chunk.side ** 2, 0);
        const operation = startRound5Miner(chunks, (progress) => {
          if (current()) setMining({ status: 'mining', ...progress, origin, chunks });
        });
        miningOperation.current = operation;
        setMining({ status: 'mining', checked: 0, total, found: 0, origin, chunks });
        const result = await operation.result;
        if (!current()) return;
        if (result.checked !== total || result.total !== total) throw new Error('The Worker did not finish every requested chunk.');
        coverage = mergeExploredChunks(coverage, chunks);
        mutateStrategy((latest) => ({ ...mergeMinedStrategyLocations(latest, result.locations, chunks), explorationOrigin: origin }));
        miningOperation.current = undefined;
        setMining({ status: 'mining', checked: result.checked, total, found: result.found,
          hashesPerSecond: Math.round(result.checked / (Math.max(1, result.elapsedMs) / 1000)), origin, chunks });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (current()) {
        explorerRunning.current = false;
        setMining((previous) => ({ ...previous, status: 'idle', chunks: [] }));
      }
    })().catch((error) => {
      if (!current()) return;
      explorerRunning.current = false;
      miningOperation.current = undefined;
      setMining((previous) => ({ ...previous, status: 'error', chunks: [],
        error: error instanceof Error ? error.message : 'The local miner failed.' }));
    });
  }, [mutateStrategy]);

  return useMemo(
    () => ({
      session,
      hasSavedDemo: savedDemos.current.has(walletAddress ?? DEMO_CONTROLLER),
      enterDemo: () => {
        if (vaultState.status === 'restoring' || vaultState.status === 'error') return;
        mutate((current) => savedDemos.current.get(walletAddress ?? DEMO_CONTROLLER)
          ?? enterDemo(current, walletAddress ?? DEMO_CONTROLLER));
      },
      enterOnchain: () => mutate((current) => enterOnchainUnavailable(current, walletAddress)),
      selectSoul: (soulId: string) => mutate((current) => selectSoul(current, soulId)),
      enterUniverse: () => {
        if (vaultState.status === 'restoring' || vaultState.status === 'error') return;
        mutate((current) => {
          try { return enterLocalUniverse(current); }
          catch (error) { return failJourney(current, error instanceof Error ? error.message : 'Local entry failed.'); }
        });
      },
      chooseStrategyPlanet: (planetId?: string) => mutateStrategy((game) => selectStrategyPlanet(game, planetId)),
      executeMoveIntent: (intent: StrategyMoveIntent) => mutateStrategy((game) => executeStrategyMoveIntent(game, intent)),
      executeAbility: (sourceId: string, ability: StrategyAbility) => mutateStrategy((game) => executeStrategyAbility(game, sourceId, ability)),
      setStrategyTarget: (planetId?: string) => mutateStrategy((game) => setStrategyTarget(game, planetId)),
      scanStrategy,
      cancelStrategyScan,
      mining,
      vault: vaultState,
      dispatchStrategy: (percentage: number, silverMoved = 0, sourceId?: string, targetId?: string) =>
        mutateStrategy((game) => {
          // Resolve both ends in one transition: drag-send must not depend on a
          // previous React selection update having committed already.
          const selected = sourceId ? selectStrategyPlanet(game, sourceId) : game;
          return dispatchStrategyVoyage(targetId ? setStrategyTarget(selected, targetId) : selected, percentage, silverMoved);
        }),
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
        explorerEpoch.current += 1;
        explorerRunning.current = false;
        miningOperation.current?.cancel();
        miningOperation.current = undefined;
        setMining({ status: 'idle', checked: 0, total: 0, found: 0 });
        // Navigation is not deletion. Keep both the encrypted record and in-tab resume state.
        if (session.mode === 'demo' && session.stage !== 'welcome' && session.controllerAddress) {
          savedDemos.current.set(session.controllerAddress, session);
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
