import { buildPreparedRankedActionTransaction, prepareRankedAction, type RankedActionRequest } from '@infinite-stellar/game-sdk';
import type { ProofArtifactManifestV1 } from '@infinite-stellar/prover';
import { rankedActionFixture } from '../../../packages/game-sdk/test/ranked-action-fixtures';
import { ProverWorkerClient } from '../src/prover-client';

// This harness has no production artifact selection override or transaction executor.
if (!import.meta.env.DEV || !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  throw new Error('Development proof QA is restricted to the local Vite development server.');
}
const output = document.querySelector<HTMLPreElement>('#results')!;
const run = document.querySelector<HTMLButtonElement>('#run')!;
const cancel = document.querySelector<HTMLButtonElement>('#cancel')!;
const directory = document.querySelector<HTMLInputElement>('#directory')!;
let client: ProverWorkerClient | undefined;
let cancelled = false;
const log = (message: string) => { output.textContent += `${message}\n`; };
cancel.onclick = () => { cancelled = true; client?.destroy(); };

run.onclick = () => {
  void (async () => {
    output.textContent = '';
    cancelled = false;
    run.disabled = true;
    cancel.disabled = false;
    const base = new URL(directory.value.endsWith('/') ? directory.value : `${directory.value}/`, location.href);
    if (base.origin !== location.origin || !base.pathname.endsWith('/circuits/build/dev/')) {
      throw new Error('Choose the local circuits/build/dev directory on this Vite origin.');
    }
    for (const mode of ['home', 'move', 'move_new'] as const) {
      if (cancelled) throw new DOMException('Cancelled', 'AbortError');
      const name = mode === 'home' ? 'claim_home_v1' : `${mode}_v1`;
      const manifestUrl = new URL(`${name}.manifest.json`, base).href;
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`Local manifest unavailable: HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      const manifest = JSON.parse(new TextDecoder().decode(bytes)) as ProofArtifactManifestV1;
      if (manifest.status !== 'development') throw new Error('This harness only accepts disposable development artifacts.');
      const manifestSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (cancelled) throw new DOMException('Cancelled', 'AbortError');
      const context = rankedActionFixture(mode);
      const config = mode === 'home' ? context.deployment.claimHomeCircuitConfig!
        : mode === 'move' ? context.deployment.moveCircuitConfig! : context.deployment.moveNewCircuitConfig!;
      config.circuitId = manifest.circuitId;
      config.artifactManifestSha256 = manifestSha256;
      const request: RankedActionRequest = mode === 'home'
        ? { kind: 'claim_home', destinationLocationId: context.record.locations[0]!.locationId }
        : { kind: 'move', sourceLocationId: context.record.locations[0]!.locationId,
          destinationLocationId: context.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n };
      const action = prepareRankedAction(context, request);
      client = new ProverWorkerClient();
      log(`${name}: integrity preflight...`);
      const start = performance.now();
      await client.preflight({ manifestUrl, manifestSha256, mode: 'development',
        expectedNetwork: manifest.network, expectedRulesetId: manifest.rulesetId,
        expectedCircuitId: config.circuitId, expectedCircuitVersion: config.circuitVersion,
        expectedPublicSignals: manifest.publicSignals }).result;
      if (cancelled) throw new DOMException('Cancelled', 'AbortError');
      log(`${name}: proving and verifying inside the Worker...`);
      const proof = await client.prove(manifestSha256, action.privateWitness, action.publicSignals).result;
      config.verifyingKeyDigest = proof.verifyingKeyDigest;
      const binding = mode === 'home' ? context.projection.manifest.claimHomeCircuit
        : mode === 'move' ? context.projection.manifest.moveCircuit : context.projection.manifest.moveNewCircuit;
      binding.verifyingKeyDigest = proof.verifyingKeyDigest;
      const fresh = prepareRankedAction(context, request);
      const tx = buildPreparedRankedActionTransaction(context.deployment, fresh, proof);
      if (tx.getData().commands.length !== 1) throw new Error('Unexpected transaction command count.');
      log(`${name}: PASS — ${proof.publicSignals.length} public signals, ${proof.proofBytes.length} proof bytes, ${Math.round(performance.now() - start)}ms including artifact preflight.`);
      client.destroy();
      client = undefined;
    }
    log('PASS: all three real browser Worker proofs built unsigned Sui transactions. No chain writes.');
  })().catch((error: unknown) => {
    log(cancelled ? 'Cancelled; no transaction submitted.' : `FAIL: ${error instanceof Error ? error.message : String(error)}`);
  }).finally(() => {
    client?.destroy(); client = undefined;
    run.disabled = false; cancel.disabled = true;
  });
};
