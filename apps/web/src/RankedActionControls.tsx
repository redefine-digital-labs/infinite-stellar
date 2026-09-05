import { useState } from 'react';
import type { RankedActionRequest, RankedMapPlanet } from '@infinite-stellar/game-sdk';
import type { RankedActionState } from './use-ranked-actions';

export interface RankedActionControlsProps {
  selected?: RankedMapPlanet;
  target?: RankedMapPlanet;
  needsHome: boolean;
  ready: boolean;
  blocked: boolean;
  state: RankedActionState;
  onAim: () => void;
  onSubmit?: (request: RankedActionRequest) => Promise<void>;
  onCancel?: () => void;
  onRecover?: () => Promise<void>;
}

export function RankedActionControls({ selected, target, needsHome, ready, blocked, state,
  onAim, onSubmit, onCancel, onRecover }: RankedActionControlsProps) {
  const [energyPercent, setEnergyPercent] = useState(50);
  const [silverPercent, setSilverPercent] = useState(0);
  const busy = !['idle', 'error', 'cancelled', 'finalized'].includes(state.status);
  const pending = Boolean(state.digest) && state.status !== 'finalized';
  const disabled = !ready || blocked || busy || pending || !onSubmit;
  const homeCandidate = selected && !selected.materialized && !selected.destroyed &&
    selected.level === 0 && selected.planetType === 'Regular';
  const source = selected?.owner === 'player' && selected.materialized && !selected.destroyed ? selected : undefined;
  const energy = source ? source.energy * BigInt(energyPercent) / 100n : 0n;
  const silver = source ? source.silver * BigInt(silverPercent) / 100n : 0n;
  const validRoute = source && target && source.objectId !== target.objectId && !target.destroyed && energy > 0n;
  return <section className="command-section ranked-action-controls" aria-label="Ranked action controls">
    {!ready && <div className="ranked-command-lock"><strong>Ranked writes remain sealed</strong>
      <span>Audited production proof keys, action manifests and release evidence must all be pinned. No signature is requested while sealed.</span></div>}
    {needsHome ? <>
      <p>Select an unmaterialized level-0 Regular planet. Its home band and eligibility are checked against fresh chain state before proving.</p>
      <button className="button button-primary" disabled={disabled || !homeCandidate} onClick={() => {
        if (selected) void onSubmit?.({ kind: 'claim_home', destinationLocationId: selected.locationId });
      }}>Prove and claim home</button>
    </> : <>
      <button className="button button-secondary compact-button" disabled={!source || busy || pending || blocked}
        onClick={onAim}>Choose fleet target</button>
      <label className="command-label">ENERGY {energyPercent}% · {energy.toString()}
        <input aria-label="Ranked fleet energy percentage" type="range" min="1" max="98" value={energyPercent}
          disabled={!source || busy || pending} onChange={(event) => setEnergyPercent(Number(event.target.value))} /></label>
      <label className="command-label">SILVER {silverPercent}% · {silver.toString()}
        <input aria-label="Ranked fleet silver percentage" type="range" min="0" max="100" value={silverPercent}
          disabled={!source || source.silver === 0n || busy || pending} onChange={(event) => setSilverPercent(Number(event.target.value))} /></label>
      <p>{target ? `Target IS-${target.locationId.slice(-5).toUpperCase()} · ${target.materialized ? 'onchain Planet' : 'new private discovery'}` : 'Choose a controlled source and a different target.'}</p>
      <button className="button button-primary" disabled={disabled || !validRoute} onClick={() => {
        if (source && target) void onSubmit?.({ kind: 'move', sourceLocationId: source.locationId,
          destinationLocationId: target.locationId, sentEnergy: energy, sentSilver: silver });
      }}>Prove and send fleet</button>
      <p>Amounts use the displayed chain snapshot. Simulation rechecks resources; normal fleets leave energy behind.</p>
    </>}
    <div role="status" aria-live="polite">
      {busy && <p>{state.status.replaceAll('-', ' ')}…</p>}
      {state.status === 'finalized' && <p>Chain finality verified. Refreshing ownership and resources.</p>}
      {state.status === 'cancelled' && <p>Preparation cancelled. No transaction was submitted.</p>}
      {state.error && <p>{state.error}</p>}
      {state.digest && <p>Transaction: <code>{state.digest}</code></p>}
      {pending && <p>A submitted transaction cannot be cancelled by leaving this screen. Recovery checks this digest without sending again.</p>}
    </div>
    {busy && !pending && <button className="button button-secondary compact-button" onClick={onCancel}>Cancel before submission</button>}
    {pending && !busy && <button className="button button-secondary compact-button" disabled={!onRecover}
      onClick={() => { void onRecover?.(); }}>Recover pending transaction</button>}
  </section>;
}
