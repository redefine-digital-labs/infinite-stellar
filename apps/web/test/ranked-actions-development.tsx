import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mergeRankedPrivateMap } from '@infinite-stellar/game-sdk';
import { rankedActionFixture } from '../../../packages/game-sdk/test/ranked-action-fixtures';
import { RankedUniverseConsole } from '../src/RankedUniverseConsole';
import type { RankedActionState } from '../src/use-ranked-actions';
import '../src/styles.css';

// UI callbacks only: no wallet, RPC, Worker, production override or transmission.
if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  throw new Error('Ranked action UI QA is restricted to the local development server.');
}
const mode = new URLSearchParams(location.search).get('mode') === 'home' ? 'home' : 'move_new';
const fixture = rankedActionFixture(mode);
const map = mergeRankedPrivateMap(fixture.record, fixture.seat, fixture.projection, fixture.record);
function Qa() {
  const [state, setState] = useState<RankedActionState>({ status: 'idle' });
  return <>
    <div className="eyebrow">LOCAL UI FIXTURE · NO RPC / WALLET / PROOF / SUBMISSION</div>
    <RankedUniverseConsole map={map} hasPrivateRecord protection="public test fixture only"
      onRefresh={() => {}} onBack={() => {}} needsHome={mode === 'home'} actionsReady
      action={state} onSubmitAction={async (request) => {
        setState({ status: 'cancelled', error: `UI callback only: ${request.kind}${request.kind === 'move' ? `, energy ${request.sentEnergy}` : ''}. Nothing was proved, signed or submitted.` });
      }} />
  </>;
}
createRoot(document.getElementById('root')!).render(<Qa />);
