import type { ReactNode } from 'react';
import type { InfiniteStellarDeployment } from '@infinite-stellar/game-sdk';
import { usePlayerJourney } from './use-player-journey';
import { TESTNET_DEPLOYMENT, TESTNET_DEPLOYMENT_EVIDENCE } from './deployment';
import {
  BrandMark,
  Eyebrow,
  PlanetVisual,
  ShortAddress,
  SoulSigil,
  StatusPill,
  StepRail,
} from './components';

export interface GameShellProps {
  walletAddress?: string;
  network?: string;
  walletControl?: ReactNode;
  deployment?: InfiniteStellarDeployment;
}

export function GameShell({
  walletAddress,
  network = 'testnet',
  walletControl,
  deployment = TESTNET_DEPLOYMENT,
}: GameShellProps) {
  const journey = usePlayerJourney(walletAddress);
  const { session } = journey;
  const selectedSoul = session.souls.find((soul) => soul.id === session.selectedSoulId);
  const candidate = session.search.candidate;

  return (
    <div className="app-frame">
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

      <main id="main-content" className={`main-stage stage-${session.stage}`}>
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
                <button className="button button-primary" type="button" onClick={journey.enterDemo}>
                  Explore local demo <span aria-hidden="true">↗</span>
                </button>
                <button className="button button-secondary" type="button" onClick={journey.enterOnchain}>
                  Check live testnet
                </button>
              </div>
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

        {session.stage === 'unavailable' && (
          <section className="center-panel narrow-panel" aria-labelledby="unavailable-title">
            <StatusPill tone="warn">FAIL-CLOSED</StatusPill>
            <Eyebrow>LIVE TESTNET GATE</Eyebrow>
            <h1 id="unavailable-title">The bridge to Soulidity is not pinned yet.</h1>
            <p>
              The Move foundation and a sealed interface canary are pinned on Sui testnet. Wallet
              connection is available, but ranked enrollment cannot be built or signed until the
              exact Soul package, ownership epoch rules, and proof verifier are frozen.
            </p>
            <div className="gate-list">
              <span className="gate-ok">✓ Move foundation verified</span>
              <span className="gate-ok">✓ Testnet package deployed</span>
              <span className="gate-ok">✓ Sealed interface canary created</span>
              <span className="gate-wait">○ Production Soul adapter pending</span>
              <span className="gate-wait">○ Production proof verifier pending</span>
              <a
                className="gate-proof"
                href={TESTNET_DEPLOYMENT_EVIDENCE.packageExplorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                Inspect package {deployment.packageId?.slice(0, 10)}… on Sui Explorer ↗
              </a>
            </div>
            <div className="hero-actions centered-actions">
              <button className="button button-primary" type="button" onClick={journey.enterDemo}>Run local demo</button>
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
              <StepRail active={0} />
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
              <div className="action-dock">
                <div>
                  <span>SEASON EFFECT</span>
                  <strong>Creates a fixed-controller Seat. Creates no Planet.</strong>
                </div>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={!session.selectedSoulId}
                  onClick={journey.beginEnrollment}
                >
                  Create Season Seat
                </button>
              </div>
            </div>
          </section>
        )}

        {session.stage === 'enrolling' && (
          <section className="center-panel transaction-panel" aria-labelledby="enroll-title">
            {selectedSoul && <SoulSigil soul={selectedSoul} selected />}
            <Eyebrow>ENROLLMENT · AWAITING APPROVAL</Eyebrow>
            <h1 id="enroll-title">Bind {selectedSoul?.name} to this Season Seat?</h1>
            <p>
              The controller remains <ShortAddress address={session.controllerAddress} /> for the
              whole season. Soul transfer will detach attribution, never transfer control.
            </p>
            <div className="transaction-facts">
              <div><span>WRITE</span><strong>Seat + Projection + AwaitingHome</strong></div>
              <div><span>PLANETS CREATED</span><strong>0</strong></div>
              <div><span>MODE</span><strong>Local simulation</strong></div>
            </div>
            <button
              className="button button-primary wide-button"
              type="button"
              disabled={session.transaction.status === 'finalizing'}
              onClick={journey.finalizeEnrollment}
            >
              {session.transaction.status === 'finalizing'
                ? 'Waiting for simulated finality…'
                : 'Approve simulated transaction'}
            </button>
            {session.transaction.status === 'awaiting-signature' && (
              <button className="text-button" type="button" onClick={journey.simulateFailure}>
                Simulate wallet rejection
              </button>
            )}
            <small className="fine-print">
              {session.transaction.status === 'finalizing'
                ? 'The demo waits for a checkpoint-shaped finality boundary before routing.'
                : 'No wallet signature is requested in demo mode.'}
            </small>
          </section>
        )}

        {session.stage === 'sealed-lobby' && (
          <section className="journey-layout" aria-labelledby="lobby-title">
            <aside className="journey-aside">
              <Eyebrow>02 · THE SEALED SKY</Eyebrow>
              <h1 id="lobby-title">Your Seat exists.<br />Your world does not.</h1>
              <p>
                Enrollment is final, but the universe seed is still sealed. Your Civilization is
                <code> AwaitingHome</code> and cannot move, score, recover, or own a Planet.
              </p>
              <StepRail active={1} />
            </aside>
            <div className="lobby-console">
              <div className="sealed-sphere" aria-hidden="true"><span>SEALED</span></div>
              <div className="console-readout">
                <div><span>SEAT</span><strong>{session.seat?.id.slice(0, 12)}…</strong></div>
                <div><span>COMMANDER</span><strong>{session.seat?.soulName}</strong></div>
                <div><span>LIFECYCLE</span><strong className="amber-text">AwaitingHome</strong></div>
                <div><span>CONTROLLED PLANETS</span><strong>0</strong></div>
              </div>
              <button className="button button-primary wide-button" type="button" onClick={journey.openUniverse}>
                Open the simulated universe
              </button>
              <p className="fine-print">Production opening is permissionless and uses Sui Random exactly once.</p>
            </div>
          </section>
        )}

        {session.stage === 'searching' && (
          <section className="search-layout" aria-labelledby="search-title">
            <div className="search-copy">
              <Eyebrow>03 · FIND FIRST LIGHT</Eyebrow>
              <h1 id="search-title">The map is yours<br />before it is the chain's.</h1>
              <p>
                Search happens locally. Coordinates, salt, and witness material stay in this
                browser. Only a commitment and proof-shaped digest enter the demo claim.
              </p>
              <StepRail active={2} />
              <button className="button button-primary" type="button" onClick={journey.search}>
                Run local search
              </button>
              <small className="fine-print">Private material is stored only in the controller-scoped local session.</small>
            </div>
            <div className="radar-panel" aria-label="Private local search visualization">
              <div className="radar-grid" aria-hidden="true">
                <span className="radar-sweep" />
                <span className="radar-origin" />
                <span className="radar-blip blip-one" />
                <span className="radar-blip blip-two" />
                <span className="radar-blip blip-three" />
              </div>
              <div className="radar-footer">
                <span>LOCAL WORKER</span>
                <strong>Seed finalized · proof artifacts warmed</strong>
                <small>NETWORK EGRESS: NONE</small>
              </div>
            </div>
          </section>
        )}

        {session.stage === 'claim-ready' && candidate && (
          <section className="claim-layout" aria-labelledby="claim-title">
            <div className="planet-stage"><PlanetVisual candidate={candidate} /></div>
            <div className="claim-copy">
              <Eyebrow>CANDIDATE FOUND · LOCAL ONLY</Eyebrow>
              <h1 id="claim-title">A place to begin.</h1>
              <p>
                Sector <strong>{candidate.sectorCode}</strong> satisfies the home predicate. Exact
                coordinates remain sealed in your local vault.
              </p>
              <div className="candidate-stats">
                <div><span>CLASS</span><strong>{candidate.planetClass}</strong></div>
                <div><span>RESONANCE</span><strong>{candidate.resonance}%</strong></div>
                <div><span>INITIAL ENERGY</span><strong>{candidate.energy}</strong></div>
              </div>
              <div className="privacy-callout">
                <span aria-hidden="true">⌁</span>
                <div><strong>Private by construction</strong><small>Preimage and salt stay on this device.</small></div>
              </div>
              <div className="hero-actions">
                <button className="button button-primary" type="button" onClick={journey.beginClaim}>Claim Founding Planet</button>
                <button className="button button-secondary" type="button" onClick={journey.rejectCandidate}>Search again</button>
              </div>
            </div>
          </section>
        )}

        {session.stage === 'claiming' && candidate && (
          <section className="center-panel transaction-panel" aria-labelledby="claiming-title">
            <PlanetVisual candidate={candidate} />
            <Eyebrow>HOME CLAIM · AWAITING APPROVAL</Eyebrow>
            <h1 id="claiming-title">Make {candidate.sectorCode} your First Light?</h1>
            <p>
              This atomic transition creates one Planet owned by the Season Seat and changes the
              Civilization from <code>AwaitingHome</code> to <code>Active</code>.
            </p>
            <div className="transaction-facts">
              <div><span>PUBLIC</span><strong>Commitment + proof digest</strong></div>
              <div><span>PRIVATE</span><strong>Coordinates + salt</strong></div>
              <div><span>OWNER</span><strong>Season Seat</strong></div>
            </div>
            <button
              className="button button-primary wide-button"
              type="button"
              disabled={session.transaction.status === 'finalizing'}
              onClick={journey.finalizeClaim}
            >
              {session.transaction.status === 'finalizing'
                ? 'Waiting for simulated finality…'
                : 'Approve simulated claim'}
            </button>
            {session.transaction.status === 'awaiting-signature' && (
              <button className="text-button" type="button" onClick={journey.simulateFailure}>
                Simulate wallet rejection
              </button>
            )}
          </section>
        )}

        {session.stage === 'active' && candidate && (
          <section className="active-layout" aria-labelledby="active-title">
            <div className="active-hero">
              <div className="active-copy">
                <StatusPill tone="live">CIVILIZATION ACTIVE</StatusPill>
                <Eyebrow>04 · FIRST LIGHT ESTABLISHED</Eyebrow>
                <h1 id="active-title">The dark has<br />an address now.</h1>
                <p>
                  {session.seat?.soulName} commands a new civilization from {candidate.sectorCode}.
                  The Soul carries the story; the fixed Season Seat carries control.
                </p>
              </div>
              <PlanetVisual candidate={candidate} active />
            </div>
            <div className="dashboard-grid">
              <article className="dashboard-card primary-card">
                <span>FOUNDING PLANET</span>
                <h2>{candidate.sectorCode}</h2>
                <div className="energy-meter"><span style={{ width: `${Math.min(100, candidate.energy / 6)}%` }} /></div>
                <div className="card-stats"><span>ENERGY <strong>{candidate.energy}</strong></span><span>PLANETS <strong>1</strong></span></div>
              </article>
              <article className="dashboard-card">
                <span>COMMAND AUTHORITY</span>
                <h3>Fixed Season Seat</h3>
                <p><ShortAddress address={session.controllerAddress} /></p>
                <small>Soul transfer cannot move this authority.</small>
              </article>
              <article className="dashboard-card">
                <span>PRIVATE VAULT</span>
                <h3>Local and controller-scoped</h3>
                <p className="green-text">● Candidate material secured</p>
                <small>Demo storage only; encrypted export is a later gate.</small>
              </article>
              <article className="dashboard-card locked-card">
                <span>NEXT SYSTEM</span>
                <h3>Movement and arrivals</h3>
                <p>Not implemented in this vertical slice.</p>
                <small>Requires proof-bound energy and queue settlement.</small>
              </article>
            </div>
          </section>
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
      <footer className="footer">
        <span>EXPERIMENTAL · UNAUDITED · TESTNET CANARY</span>
        <span>BUILT ON SUI · POWERED BY SOULIDITY</span>
      </footer>
    </div>
  );
}
