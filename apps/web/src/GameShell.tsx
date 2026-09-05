import { useEffect, type ReactNode } from 'react';
import type { InfiniteStellarDeployment } from '@infinite-stellar/game-sdk';
import { usePlayerJourney } from './use-player-journey';
import {
  MAINNET_DEPLOYMENT,
  TESTNET_DEPLOYMENT,
  TESTNET_DEPLOYMENT_EVIDENCE,
} from './deployment';
import {
  BrandMark,
  Eyebrow,
  ShortAddress,
  SoulSigil,
  StatusPill,
} from './components';
import { StrategyConsole } from './StrategyConsole';
import { useProofReadiness } from './use-proof-readiness';
import type { RankedGatewaySnapshot } from './use-ranked-gateway';
import type { CanonicalSoul } from '@infinite-stellar/game-sdk';
import type { RankedEnrollmentState } from './use-ranked-enrollment';
import type { RankedProjectionSnapshot } from './use-ranked-projection';
import type { RankedMapSnapshot } from './use-ranked-map';
import { RankedUniverseConsole } from './RankedUniverseConsole';
import type { RankedMiningSnapshot, RankedBackupDownload, RankedBackupSnapshot } from './use-ranked-map';

export interface GameShellProps {
  walletAddress?: string;
  network?: string;
  walletControl?: ReactNode;
  deployment?: InfiniteStellarDeployment;
  rankedGateway?: RankedGatewaySnapshot;
  onRefreshRanked?: () => void;
  rankedEnrollment?: RankedEnrollmentState;
  onEnrollRanked?: (soul: CanonicalSoul) => void;
  rankedProjection?: RankedProjectionSnapshot;
  onRefreshProjection?: () => void;
  rankedMap?: RankedMapSnapshot;
  onRefreshRankedMap?: () => void;
  rankedMining?: RankedMiningSnapshot;
  onMineRankedMap?: (center: { x: number; y: number }) => void;
  onCancelRankedMining?: () => void;
  rankedBackup?: RankedBackupSnapshot;
  onExportRankedBackup?: (passphrase: string) => Promise<RankedBackupDownload>;
  onImportRankedBackup?: (raw: string, passphrase: string) => Promise<void>;
}

const DISCONNECTED_RANKED_GATEWAY: RankedGatewaySnapshot = {
  phase: 'disconnected',
  souls: [],
  discoveryComplete: false,
  scannedSoulEvents: 0,
  blockers: [],
  writesReady: false,
};

export function GameShell({
  walletAddress,
  network = 'mainnet',
  walletControl,
  deployment = MAINNET_DEPLOYMENT,
  rankedGateway = DISCONNECTED_RANKED_GATEWAY,
  onRefreshRanked,
  rankedEnrollment = { status: 'idle' },
  onEnrollRanked,
  rankedProjection = { phase: 'disabled' },
  onRefreshProjection,
  rankedMap = { phase: 'disabled' },
  onRefreshRankedMap,
  rankedMining,
  onMineRankedMap,
  onCancelRankedMining,
  rankedBackup,
  onExportRankedBackup,
  onImportRankedBackup,
}: GameShellProps) {
  const journey = usePlayerJourney(walletAddress);
  const { session } = journey;
  const proofReadiness = useProofReadiness();
  const rankedMapActive = Boolean(
    session.stage === 'unavailable' && rankedGateway.seat &&
    rankedMap.phase === 'loaded' && rankedMap.map,
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [session.stage]);

  return (
    <div className={`app-frame ${session.stage === 'active' || rankedMapActive ? 'is-strategy-active' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to mission control</a>
      <div className="stellar-noise" aria-hidden="true" />
      <header className="topbar">
        <button className="brand" type="button" onClick={journey.restart} aria-label="Return to Infinite Stellar home">
          <BrandMark />
          <span className="brand-copy">
            <strong>INFINITE STELLAR</strong>
            <small>ONE SOUL · MANY FINITE WORLDS</small>
          </span>
        </button>
        <div className="topbar-actions">
          <StatusPill tone={session.mode === 'demo' && session.stage !== 'welcome' ? 'warn' : 'neutral'}>
            {session.mode === 'demo' && session.stage !== 'welcome' ? 'LOCAL SIMULATION' : network.toUpperCase()}
          </StatusPill>
          <div className="wallet-summary">
            <span className="wallet-dot" aria-hidden="true" />
            <ShortAddress address={walletAddress} />
          </div>
          {walletControl}
        </div>
      </header>

      <main id="main-content" className={`main-stage stage-${rankedMapActive ? 'active' : session.stage}`}>
        {session.stage !== 'welcome' && session.stage !== 'unavailable' && (
          <div className="mission-meta">
            <div>
              <span>SEASON</span>
              <strong>{session.runtime.seasonLabel}</strong>
            </div>
            <div>
              <span>CONTROLLER</span>
              <strong><ShortAddress address={session.controllerAddress} /></strong>
            </div>
            <div>
              <span>UNIVERSE</span>
              <strong>{session.runtime.universe.toUpperCase()}</strong>
            </div>
          </div>
        )}

        {session.stage === 'welcome' && (
          <section className="welcome-grid" aria-labelledby="welcome-title">
            <div className="welcome-copy">
              <Eyebrow>SUI-NATIVE · PRIVATE DISCOVERY · VERIFIABLE OUTCOMES</Eyebrow>
              <h1 id="welcome-title">Carry one Soul<br />into an unknown sky.</h1>
              <p className="hero-lede">
                Enter a finite stellar world. Search in private. Claim a first home onchain.
                When the universe ends, the civilization disappears—but the Soul remembers.
              </p>
              <div className="hero-actions">
                <button className="button button-primary" type="button" onClick={journey.enterDemo}
                  disabled={journey.vault.status === 'restoring' || journey.vault.status === 'error'}>
                  {journey.vault.status === 'restoring' ? 'Checking local save…'
                    : journey.hasSavedDemo ? 'Continue local game' : 'Explore local demo'} <span aria-hidden="true">↗</span>
                </button>
                <button className="button button-secondary" type="button" onClick={journey.enterOnchain}>
                  Check mainnet readiness
                </button>
              </div>
              {journey.vault.status === 'error' && <p role="alert">Could not restore the local save. Reload to retry; existing data has not been cleared.</p>}
              <p className="truth-note">
                The demo is local and creates no Sui transaction or Soul history.
              </p>
            </div>
            <div className="observatory-card" aria-label="First Light season preview">
              <div className="observatory-sky" aria-hidden="true">
                <span className="large-orbit" />
                <span className="horizon" />
                <span className="signal signal-one" />
                <span className="signal signal-two" />
                <span className="signal signal-three" />
              </div>
              <div className="observatory-footer">
                <span>FIRST LIGHT</span>
                <strong>A civilization begins with no Planet.</strong>
                <small>Find one before the home window closes.</small>
              </div>
            </div>
          </section>
        )}

        {rankedMapActive && rankedMap.map && rankedGateway.seat && (
          <RankedUniverseConsole
            map={rankedMap.map}
            hasPrivateRecord={rankedMap.hasPrivateRecord ?? false}
            protection={rankedMap.protection}
            mining={rankedMining}
            canMine={rankedMap.canMine}
            miningBlocker={rankedMap.miningBlocker}
            needsHome={!rankedGateway.seat.civilization.initialHomePlanetId}
            onMine={onMineRankedMap}
            onCancelMining={onCancelRankedMining}
            backup={rankedBackup}
            onExportBackup={onExportRankedBackup}
            onImportBackup={onImportRankedBackup}
            refreshing={rankedMap.refreshing}
            soulId={rankedGateway.seat.seat.soulId}
            onRefresh={onRefreshRankedMap ?? onRefreshRanked ?? (() => undefined)}
            onBack={journey.restart}
          />
        )}

        {session.stage === 'unavailable' && !rankedMapActive && (
          <section className="center-panel narrow-panel" aria-labelledby="unavailable-title">
            <StatusPill tone="warn">FAIL-CLOSED</StatusPill>
            <Eyebrow>SUI MAINNET PRODUCTION GATE</Eyebrow>
            <h1 id="unavailable-title">
              {rankedGateway.seat
                ? 'Your Season Seat is visible, but writes remain sealed.'
                : 'The mainnet season is not open yet.'}
            </h1>
            <p>
              The client reads canonical Soulidity v1 directly from Sui mainnet. Ranked signing
              stays unreachable until the Infinite Stellar package, audited production keys,
              operations approval, and multisig policy are all pinned together.
            </p>
            <div className="gate-list">
              <span className="gate-ok">✓ Canonical Soulidity v1 package and ABI pinned</span>
              <span className={walletAddress ? 'gate-ok' : 'gate-wait'}>
                {walletAddress ? '✓ Mainnet wallet connected' : '○ Connect a mainnet wallet to resolve Souls and Seat'}
              </span>
              {rankedGateway.phase === 'loading' && (
                <span className="gate-wait">○ Reading deterministic Seat before Soul candidates…</span>
              )}
              {rankedGateway.phase === 'error' && (
                <span className="gate-wait">○ Chain read failed: {rankedGateway.error}</span>
              )}
              {rankedGateway.phase === 'loaded' && rankedGateway.seat && (
                <span className="gate-ok">
                  ✓ Season Seat {rankedGateway.seat.seatId.slice(0, 10)}… verified from BCS
                </span>
              )}
              {rankedGateway.seat && rankedProjection.phase === 'loading' && (
                <span className="gate-wait">○ Reconstructing checkpointed Planet and Voyage state…</span>
              )}
              {rankedGateway.seat && rankedProjection.phase === 'loaded' && rankedProjection.projection && (
                <span className="gate-ok">
                  ✓ {rankedProjection.projection.planets.length} Planets ·{' '}
                  {rankedProjection.projection.voyages.length} active Voyages · checkpoint{' '}
                  {rankedProjection.projection.maxEventCheckpoint ?? 'genesis'} · snapshot{' '}
                  {rankedProjection.projection.snapshotFingerprint.slice(0, 10)}…
                </span>
              )}
              {rankedGateway.seat && rankedProjection.phase === 'error' && (
                <div className="gate-soul">
                  <span className="gate-wait">○ Universe read rejected: {rankedProjection.error}</span>
                  {onRefreshProjection && (
                    <button className="button button-secondary" type="button" onClick={onRefreshProjection}>
                      Retry universe read
                    </button>
                  )}
                </div>
              )}
              {rankedGateway.seat && rankedMap.phase === 'restoring' && (
                <span className="gate-wait">○ Authenticating the Seat-scoped encrypted private map…</span>
              )}
              {rankedGateway.seat && rankedMap.phase === 'loading' && (
                <span className="gate-wait">○ Point-reading privately known Planet and Voyage objects…</span>
              )}
              {rankedGateway.seat && rankedMap.phase === 'error' && (
                <div className="gate-soul">
                  <span className="gate-wait">○ Private map rejected: {rankedMap.error}</span>
                  {onRefreshRankedMap && (
                    <button className="button button-secondary" type="button" onClick={onRefreshRankedMap}>
                      Retry private map
                    </button>
                  )}
                </div>
              )}
              {rankedGateway.phase === 'loaded' && !rankedGateway.seat && (
                <span className={rankedGateway.discoveryComplete ? 'gate-ok' : 'gate-wait'}>
                  {rankedGateway.discoveryComplete ? '✓' : '○'} {rankedGateway.souls.length} eligible
                  {' '}canonical Soul{rankedGateway.souls.length === 1 ? '' : 's'} found for this address
                </span>
              )}
              {rankedGateway.souls.map((soul) => (
                <div className="gate-soul" key={soul.stateId}>
                  <span className="gate-proof">
                    {soul.name} · epoch {soul.ownershipEpoch.toString()} · state {soul.stateId.slice(0, 10)}…
                  </span>
                  {rankedGateway.writesReady && onEnrollRanked && (
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={rankedEnrollment.status === 'simulating'
                        || rankedEnrollment.status === 'recovering'
                        || rankedEnrollment.status === 'awaiting-signature'
                        || rankedEnrollment.status === 'finalizing'}
                      onClick={() => onEnrollRanked(soul)}
                    >
                      {rankedEnrollment.soulStateId === soul.stateId
                        ? rankedEnrollment.status === 'recovering'
                          ? 'Recovering finality…'
                          : rankedEnrollment.status === 'simulating'
                          ? 'Checking transaction…'
                          : rankedEnrollment.status === 'awaiting-signature'
                            ? 'Approve in wallet…'
                            : rankedEnrollment.status === 'finalizing'
                              ? 'Waiting for finality…'
                              : 'Enroll this Soul'
                        : 'Enroll this Soul'}
                    </button>
                  )}
                </div>
              ))}
              {rankedEnrollment.status === 'error' && (
                <span className="gate-wait">○ Enrollment failed: {rankedEnrollment.error}</span>
              )}
              {rankedEnrollment.status === 'finalized' && (
                <span className="gate-ok">✓ Enrollment finalized: {rankedEnrollment.digest?.slice(0, 12)}…</span>
              )}
              <span className={deployment.packageId ? 'gate-ok' : 'gate-wait'}>
                {deployment.packageId ? '✓ Infinite Stellar mainnet package pinned' : '○ Infinite Stellar mainnet package not deployed'}
              </span>
              <span className={deployment.productionSoulAdapterReady ? 'gate-ok' : 'gate-wait'}>
                {deployment.productionSoulAdapterReady ? '✓ Ranked Soul adapter activated' : '○ Ranked Soul adapter activation pending'}
              </span>
              <span className={deployment.productionProofVerifierReady ? 'gate-ok' : 'gate-wait'}>
                {deployment.productionProofVerifierReady ? '✓ Production proof verifiers activated' : `○ ${proofReadiness.label}`}
              </span>
              <span className={deployment.productionReleaseEvidence ? 'gate-ok' : 'gate-wait'}>
                {deployment.productionReleaseEvidence
                  ? '✓ Ceremony, audits, operations, and multisig evidence pinned'
                  : '○ Ceremony, audits, operations, and multisig evidence pending'}
              </span>
              <a
                className="gate-proof"
                href={TESTNET_DEPLOYMENT_EVIDENCE.packageExplorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                Inspect sealed testnet package {TESTNET_DEPLOYMENT.packageId?.slice(0, 10)}… ↗
              </a>
            </div>
            <div className="hero-actions centered-actions">
              <button className="button button-primary" type="button" onClick={journey.enterDemo}>Run local demo</button>
              {walletAddress && onRefreshRanked && (
                <button className="button button-secondary" type="button" onClick={onRefreshRanked}>Refresh mainnet state</button>
              )}
              <button className="button button-secondary" type="button" onClick={journey.restart}>Back</button>
            </div>
          </section>
        )}

        {session.stage === 'soul-selection' && (
          <section className="journey-layout" aria-labelledby="soul-title">
            <aside className="journey-aside">
              <Eyebrow>01 · CHOOSE THE ACTOR</Eyebrow>
              <h1 id="soul-title">Who crosses<br />this world?</h1>
              <p>
                Your Soul gives the Commander a persistent identity and visible form. It grants no
                ranked power, and selling it later will not transfer this civilization.
              </p>
            </aside>
            <div className="journey-content">
              <div className="section-heading">
                <div>
                  <span>ELIGIBLE SOULS</span>
                  <strong>{session.souls.length} local fixtures</strong>
                </div>
                <StatusPill tone="warn">DEMO DATA</StatusPill>
              </div>
              <div className="soul-grid">
                {session.souls.map((soul) => {
                  const selected = soul.id === session.selectedSoulId;
                  return (
                    <button
                      className={`soul-card ${selected ? 'is-selected' : ''}`}
                      type="button"
                      key={soul.id}
                      onClick={() => journey.selectSoul(soul.id)}
                      aria-pressed={selected}
                    >
                      <SoulSigil soul={soul} selected={selected} />
                      <span className="soul-card-copy">
                        <small>SOUL · EPOCH {soul.ownershipEpoch}</small>
                        <strong>{soul.name}</strong>
                        <em>{soul.epithet}</em>
                        <span>{soul.signal}</span>
                      </span>
                      <span className="selection-mark" aria-hidden="true">{selected ? '✓' : '＋'}</span>
                    </button>
                  );
                })}
              </div>
              <p className="fine-print">This preview uses a fixture home. No wallet approval or Sui transaction; exploration after entry runs locally.</p>
              <div className="action-dock">
                <div>
                  <span>LOCAL FIRST LIGHT</span>
                  <strong>Choose your Soul, then enter the star map.</strong>
                </div>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={!session.selectedSoulId || journey.vault.status === 'restoring' || journey.vault.status === 'error'}
                  onClick={journey.enterUniverse}
                >
                  Enter universe
                </button>
              </div>
            </div>
          </section>
        )}

        {session.mode === 'demo' &&
          ['enrolling', 'sealed-lobby', 'searching', 'claim-ready', 'claiming'].includes(session.stage) && (
          <section className="center-panel narrow-panel" aria-labelledby="resume-title">
            <Eyebrow>LOCAL FIRST LIGHT · SAVED SESSION</Eyebrow>
            <h1 id="resume-title">Continue into the universe.</h1>
            <p>Your saved Soul and Season Seat are preserved. Finish local setup and open the star map.</p>
            <p className="fine-print">Local fixtures only. No wallet approval, proof generation or Sui transaction.</p>
            <button className="button button-primary" type="button" onClick={journey.enterUniverse}
              disabled={journey.vault.status === 'restoring' || journey.vault.status === 'error'}>
              Enter universe
            </button>
          </section>
        )}

        {session.stage === 'active' && session.strategy && (
          <StrategyConsole
            game={session.strategy}
            commanderName={session.seat?.soulName}
            onChoosePlanet={journey.chooseStrategyPlanet}
            onSetTarget={journey.setStrategyTarget}
            onScan={journey.scanStrategy}
            onCancelScan={journey.cancelStrategyScan}
            mining={journey.mining}
            vault={journey.vault}
            proofReadiness={proofReadiness}
            onMoveIntent={journey.executeMoveIntent}
            onAbility={journey.executeAbility}
            onAdvanceArrival={journey.advanceStrategyArrival}
            onAdvanceTime={journey.advanceStrategyTime}
            onSettle={journey.settleStrategy}
          />
        )}

        {session.stage === 'error' && (
          <section className="center-panel narrow-panel" aria-labelledby="error-title">
            <StatusPill tone="warn">TRANSACTION INTERRUPTED</StatusPill>
            <h1 id="error-title">Nothing finalized.</h1>
            <p>{session.transaction.error ?? 'The previous action could not complete.'}</p>
            <button className="button button-primary" type="button" onClick={journey.retry}>Retry from safe state</button>
          </section>
        )}
      </main>

      <div className="live-region" role="status" aria-live="polite" aria-atomic="true">
        {session.notice}
      </div>
      {session.stage !== 'active' && (
        <footer className="footer">
          <span>MAINNET TARGET · RANKED WRITES FAIL-CLOSED</span>
          <span>BUILT ON SUI · POWERED BY SOULIDITY</span>
          <a href="/third-party/df-renderer-LICENSE.txt" target="_blank" rel="noreferrer">DF RENDERER · MIT</a>
        </footer>
      )}
    </div>
  );
}
