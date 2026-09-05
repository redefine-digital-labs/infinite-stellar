import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { serializeProofPublicSignals, type SuiProofSubmission } from '@infinite-stellar/prover';
import { buildPreparedRankedActionTransaction, prepareRankedAction,
  type PreparedRankedAction, type RankedActionContext, type RankedActionRequest } from '../src';
import { rankedActionFixture } from './ranked-action-fixtures';

function request(context: RankedActionContext): RankedActionRequest {
  return context.seat.civilization.lifecycle === 'AwaitingHome'
    ? { kind: 'claim_home', destinationLocationId: context.record.locations[0]!.locationId }
    : { kind: 'move', sourceLocationId: context.record.locations[0]!.locationId,
      destinationLocationId: context.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n };
}

function proof(action: PreparedRankedAction): SuiProofSubmission {
  return {
    network: 'sui:mainnet', rulesetId: 'dark-forest-v06-round5', circuitId: action.circuit.circuitId,
    circuitVersion: action.circuit.circuitVersion, artifactManifestSha256: action.circuit.artifactManifestSha256,
    verifyingKeyDigest: action.circuit.verifyingKeyDigest, publicSignals: action.publicSignals,
    publicInputs: serializeProofPublicSignals(action.publicSignals.map(BigInt)),
    publicInputDigest: action.publicInputDigest, proofBytes: new Uint8Array(128).fill(7),
  };
}

describe('chain-bound ranked action preparation', () => {
  it.each(['home', 'move', 'move_new'] as const)('builds the exact %s witness schema and transaction without private coordinates', (mode) => {
    const context = rankedActionFixture(mode);
    const action = prepareRankedAction(context, request(context));
    const circuit = mode === 'home' ? 'claim_home' : mode;
    const fixture = JSON.parse(readFileSync(new URL(`../../../circuits/fixtures/${circuit}_v1.input.json`, import.meta.url), 'utf8'));
    expect(Object.keys(action.privateWitness).sort()).toEqual(Object.keys(fixture).sort());
    for (const key of ['world_radius', 'location_hash_key', 'space_type_key', 'perlin_scale', 'destination_location_hash']) {
      expect(action.privateWitness[key]).toBe(fixture[key]);
    }
    expect(action.transaction.kind).toBe(circuit);
    expect(action.privateWitness.deadline_ms).toBe(context.deadlineMs.toString());
    if (mode !== 'home') {
      expect(action.privateWitness.max_distance).toBe('198');
      expect(action.privateWitness.source_planet_nonce).toBe('7');
      expect(action.privateWitness.source_x_magnitude).toBe('73');
      expect(action.privateWitness.destination_y_magnitude).toBe('6442');
    }
    expect(action.publicSignals).toHaveLength(mode === 'move_new' ? 5 : 4);
    const tx = buildPreparedRankedActionTransaction(context.deployment, action, proof(action)).getData();
    expect(tx.sender).toBe(context.record.controllerAddress);
    expect(tx.commands[0]?.MoveCall?.function).toBe(mode === 'home' ? 'claim_home' : `dispatch_${mode}`);
    expect(JSON.stringify(tx)).not.toContain('privateWitness');
    expect(Object.keys(action.transaction.input)).not.toContain('x_magnitude');
    expect(action.expectation.requiredChangedObjectIds).toContain(context.seat.civilization.objectId);
  });

  it('retains the complete immutable action intent after caller objects change', () => {
    const context = rankedActionFixture('move_new');
    const action = prepareRankedAction(context, request(context));
    const before = action.publicInputDigest;
    context.record.locations[0]!.x = 999;
    context.projection.planets[0]!.proofNonce = 88n;
    context.deployment.moveNewCircuitConfig!.configDigest = 'aa'.repeat(32);
    expect(action.publicInputDigest).toBe(before);
    expect(action.privateWitness.source_planet_nonce).toBe('7');
    expect(action.circuit.configDigest).toBe('cd'.repeat(32));
  });

  it('rejects a proof prepared before the source nonce changed', () => {
    const context = rankedActionFixture('move');
    const old = prepareRankedAction(context, request(context));
    context.projection.planets[0]!.proofNonce += 1n;
    const fresh = prepareRankedAction(context, request(context));
    expect(fresh.publicInputDigest).not.toBe(old.publicInputDigest);
    expect(() => buildPreparedRankedActionTransaction(context.deployment, fresh, proof(old))).toThrow(/exact player action/);
  });

  it('requires re-proving when another player materializes the destination', () => {
    const context = rankedActionFixture('move_new');
    const old = prepareRankedAction(context, request(context));
    const freshContext = rankedActionFixture('move');
    const fresh = prepareRankedAction(freshContext, request(freshContext));
    expect(() => buildPreparedRankedActionTransaction(freshContext.deployment, fresh, proof(old))).toThrow(/exact player action/);
  });

  it.each([
    ['release gates', (c: RankedActionContext) => { c.deployment.productionProofVerifierReady = false; }],
    ['controller', (c: RankedActionContext) => { c.record.controllerAddress = `0x${'bb'.repeat(32)}`; }],
    ['geometry', (c: RankedActionContext) => { c.projection.manifest.locationHashKey += 1n; }],
    ['network', (c: RankedActionContext) => { c.projection.manifest.proofNetworkField += 1n; }],
    ['circuit', (c: RankedActionContext) => { c.projection.manifest.moveNewCircuit.configId = `0x${'ff'.repeat(32)}`; }],
    ['forged coordinates', (c: RankedActionContext) => { c.record.locations[0]!.x += 1; }],
    ['source ownership', (c: RankedActionContext) => { c.projection.planets[0]!.ownerSeatId = `0x${'bb'.repeat(32)}`; }],
    ['source destroyed', (c: RankedActionContext) => { c.projection.planets[0]!.destroyed = true; }],
    ['missing exact read', (c: RankedActionContext) => { c.projection.requestedPlanetIds = []; }],
    ['ambiguous absence', (c: RankedActionContext) => { c.projection.missingPlanetIds = []; }],
    ['expired deadline', (c: RankedActionContext) => { c.deadlineMs = c.nowMs; }],
    ['season ended', (c: RankedActionContext) => { c.nowMs = c.projection.manifest.seasonEndAtMs; c.deadlineMs = c.nowMs + 1n; }],
    ['cancelled', (c: RankedActionContext) => { c.projection.runtime.cancelled = true; }],
    ['unresolved home close', (c: RankedActionContext) => { c.nowMs = 100_000n; c.deadlineMs = 110_000n; }],
    ['due arrival', (c: RankedActionContext) => { c.projection.planets[0]!.pendingVoyages.push({
      voyageId: `0x${'44'.repeat(32)}`, playerSeatId: c.seat.seatId, arrivalAtSeconds: 10n }); }],
  ])('rejects %s before proving', (_, mutate) => {
    const context = rankedActionFixture('move_new');
    mutate(context);
    expect(() => prepareRankedAction(context, request(context))).toThrow();
  });

  it.each([
    ['pause', (c: RankedActionContext) => { c.projection.runtime.paused = true; }],
    ['not-before', (c: RankedActionContext) => { c.projection.runtime.homeClaimNotBeforeAtMs = c.nowMs + 1n; }],
    ['deadline at close', (c: RankedActionContext) => { c.deadlineMs = c.projection.manifest.homeClaimCloseAtMs; }],
    ['consumed claim', (c: RankedActionContext) => { c.seat.civilization.homeClaimConsumed = true; }],
    ['activated once', (c: RankedActionContext) => { c.seat.civilization.activatedOnce = true; }],
  ])('rejects home %s', (_, mutate) => {
    const context = rankedActionFixture();
    mutate(context);
    expect(() => prepareRankedAction(context, request(context))).toThrow();
  });

  it('rejects a valid planet outside the home band', () => {
    const context = rankedActionFixture();
    expect(() => prepareRankedAction(context, { kind: 'claim_home',
      destinationLocationId: context.record.locations[1]!.locationId })).toThrow(/home Perlin/);
  });

  it('does not treat the home-claim pause as a pause of active fleet play', () => {
    const context = rankedActionFixture('move');
    context.projection.runtime.paused = true;
    expect(prepareRankedAction(context, request(context)).transaction.kind).toBe('move');
  });
});
