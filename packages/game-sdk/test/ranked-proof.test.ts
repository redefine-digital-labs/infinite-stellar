import { describe, expect, it, vi } from 'vitest';
import { serializeProofPublicSignals, type SuiProofSubmission } from '@infinite-stellar/prover';
import { proveRankedAction, type PreparedRankedAction, type RankedActionRequest } from '../src';
import { rankedActionFixture } from './ranked-action-fixtures';

/** Lifecycle tests only. Real WASM/zkey proofs run in circuits:test:ranked. */
function proof(action: PreparedRankedAction): SuiProofSubmission {
  return {
    network: 'sui:mainnet', rulesetId: 'dark-forest-v06-round5', circuitId: action.circuit.circuitId,
    circuitVersion: action.circuit.circuitVersion, artifactManifestSha256: action.circuit.artifactManifestSha256,
    verifyingKeyDigest: action.circuit.verifyingKeyDigest, publicSignals: [...action.publicSignals],
    publicInputs: serializeProofPublicSignals(action.publicSignals.map(BigInt)),
    publicInputDigest: action.publicInputDigest, proofBytes: new Uint8Array(128).fill(7),
  };
}

describe('ranked proof lifecycle', () => {
  function setup(mode: 'home' | 'move' | 'move_new' = 'move_new') {
    const context = rankedActionFixture(mode);
    const request: RankedActionRequest = mode === 'home'
      ? { kind: 'claim_home', destinationLocationId: context.record.locations[0]!.locationId }
      : { kind: 'move', sourceLocationId: context.record.locations[0]!.locationId,
        destinationLocationId: context.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n };
    const readContext = vi.fn(async () => context);
    return { context, request, readContext };
  }

  it.each(['home', 'move', 'move_new'] as const)('re-reads after proving %s and returns only an unsigned public transaction', async (mode) => {
    const { context, request, readContext } = setup(mode);
    const onPhase = vi.fn();
    const result = await proveRankedAction(request, { readContext, onPhase,
      prove: async (action) => {
        const result = proof(action);
        context.nowMs += 100n;
        context.deadlineMs += 100n; // reader must not silently extend the proved deadline
        return result;
      } });
    expect(readContext).toHaveBeenCalledTimes(2);
    expect(onPhase.mock.calls.flat()).toEqual(['reading', 'proving', 'revalidating']);
    expect(result.transaction.getData().commands).toHaveLength(1);
    expect(Object.keys(result).sort()).toEqual(['expectation', 'publicInputDigest', 'transaction']);
    expect(JSON.stringify(result.transaction.getData())).not.toMatch(/privateWitness|magnitude/);
  });

  it.each(['nonce', 'owner', 'occupied', 'expired', 'gates', 'controller', 'deployment'] as const)(
    'rejects %s changes during proving', async (change) => {
      const { context, request, readContext } = setup();
      await expect(proveRankedAction(request, { readContext, prove: async (action) => {
        const result = proof(action);
        if (change === 'nonce') context.projection.planets[0]!.proofNonce += 1n;
        if (change === 'owner') context.projection.planets[0]!.ownerSeatId = `0x${'bb'.repeat(32)}`;
        if (change === 'occupied') Object.assign(context, rankedActionFixture('move'));
        if (change === 'expired') context.nowMs = context.deadlineMs;
        if (change === 'gates') context.deployment.productionProofVerifierReady = false;
        if (change === 'controller') context.record.controllerAddress = `0x${'bb'.repeat(32)}`;
        if (change === 'deployment') context.deployment.clockObjectId = `0x${'bb'.repeat(32)}`;
        return result;
      } })).rejects.toThrow();
      expect(readContext).toHaveBeenCalledTimes(2);
    },
  );

  it('does not silently change fleet amounts while proving', async () => {
    const { request, readContext } = setup();
    let sentEnergy: bigint | undefined;
    await proveRankedAction(request, { readContext, prove: async (action) => {
      if (request.kind === 'move') request.sentEnergy = 1n;
      if (action.transaction.kind !== 'claim_home') sentEnergy = BigInt(action.transaction.input.sentEnergy);
      return proof(action);
    } });
    expect(sentEnergy).toBe(25_000n);
  });

  it.each(['before', 'read', 'prove', 'revalidate'] as const)('cancels at %s without a usable transaction', async (stage) => {
    const { request, readContext } = setup();
    const controller = new AbortController();
    if (stage === 'before') controller.abort();
    const prove = vi.fn(async (action: PreparedRankedAction) => {
      if (stage === 'prove') controller.abort();
      return proof(action);
    });
    await expect(proveRankedAction(request, { signal: controller.signal, prove,
      readContext: async () => {
        const context = await readContext();
        if (stage === 'read' || (stage === 'revalidate' && readContext.mock.calls.length === 2)) controller.abort();
        return context;
      } })).rejects.toMatchObject({ name: 'AbortError' });
    if (stage === 'before') expect(readContext).not.toHaveBeenCalled();
    if (stage === 'before' || stage === 'read') expect(prove).not.toHaveBeenCalled();
  });
});
