import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { bcs } from '@mysten/sui/bcs';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import type { SuiClientTypes } from '@mysten/sui/client';
import { prepareRankedAction, recoverPlayerTransactionByDigest, submitAndFinalizePlayerTransaction,
  type RankedActionRequest, type PlayerActionExpectation } from '@infinite-stellar/game-sdk';
import { rankedActionFixture } from '../../../packages/game-sdk/test/ranked-action-fixtures';
import { useRankedActions, type RankedActionsOptions, type RankedActionsDependencies } from './use-ranked-actions';
import { loadPendingRankedAction, rankedActionJournalKey } from './ranked-action-journal';

const fakeId = (byte: string) => `0x${byte.repeat(32)}`;
const fakeDigest = '1'.repeat(32);
const HomeEvent = bcs.struct('FoundingPlanetClaimed', { season_id: bcs.Address, seat_id: bcs.Address, planet_id: bcs.Address });
const MoveEvent = bcs.struct('VoyageDispatched', { season_id: bcs.Address, voyage_id: bcs.Address,
  player_seat_id: bcs.Address, from_planet_id: bcs.Address, to_planet_id: bcs.Address,
  arrival_at_seconds: bcs.u64(), is_abandon: bcs.bool() });

/** Transport responses are synthetic; lifecycle runs the actual simulation/finality reconciler. */
function transactionResult(digest: string, expected: PlayerActionExpectation, final: boolean): SuiClientTypes.TransactionResult<{ effects: true; events: true; objectTypes: true }> {
  if (expected.kind === 'enroll') throw new Error('Not an enrollment fixture.');
  const ids = [...expected.requiredChangedObjectIds!, ...(expected.kind === 'claim_home' ? [] : [fakeId('45')])];
  const packageId = fakeId('10');
  const event: SuiClientTypes.Event = {
    packageId, module: expected.kind === 'claim_home' ? 'planet' : 'voyage', sender: fakeId('aa'),
    eventType: `${packageId}::${expected.kind === 'claim_home' ? 'planet::FoundingPlanetClaimed' : 'voyage::VoyageDispatched'}`,
    bcs: expected.kind === 'claim_home'
      ? HomeEvent.serialize({ season_id: expected.seasonId, seat_id: expected.seatId, planet_id: expected.planetId! }).toBytes()
      : MoveEvent.serialize({ season_id: expected.seasonId, voyage_id: fakeId('45'), player_seat_id: expected.seatId,
        from_planet_id: expected.fromPlanetId, to_planet_id: expected.toPlanetId, arrival_at_seconds: 999, is_abandon: false }).toBytes(),
    json: null,
  };
  return { $kind: 'Transaction', Transaction: { digest, signatures: [], epoch: '1',
    timestampMs: final ? 1_900_000_000_000 : null, checkpoint: final ? '42' : null,
    status: { success: true, error: null }, balanceChanges: undefined, objectTypes: {}, transaction: undefined, bcs: undefined,
    events: final ? [event] : [], effects: { bcs: null, version: 2, status: { success: true, error: null },
      gasUsed: { computationCost: '10', storageCost: '20', storageRebate: '5', nonRefundableStorageFee: '2' },
      transactionDigest: digest, gasObject: null, eventsDigest: null, dependencies: [], lamportVersion: '1',
      unchangedConsensusObjects: [], auxiliaryDataDigest: null,
      changedObjects: ids.map((objectId) => ({ objectId, inputState: 'DoesNotExist', inputVersion: null,
        inputDigest: null, inputOwner: null, outputState: 'ObjectWrite', outputVersion: '1', outputDigest: fakeDigest,
        outputOwner: { $kind: 'Shared', Shared: { initialSharedVersion: '1' } }, idOperation: 'Created' })) } } };
}

function setup(mode: 'home' | 'move' | 'move_new' = 'move_new') {
  const context = rankedActionFixture(mode);
  const request: RankedActionRequest = mode === 'home'
    ? { kind: 'claim_home', destinationLocationId: context.record.locations[0]!.locationId }
    : { kind: 'move', sourceLocationId: context.record.locations[0]!.locationId,
      destinationLocationId: context.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n };
  const action = prepareRankedAction(context, request);
  const tx = new Transaction();
  tx.setSender(context.record.controllerAddress);
  tx.setGasOwner(context.record.controllerAddress); tx.setGasPrice(1); tx.setGasBudget(1_000_000);
  tx.setGasPayment([{ objectId: fakeId('55'), version: '1', digest: fakeDigest }]);
  // A fully resolved public test transaction tests byte identity/digest journaling;
  // actual proof-bound PTBs are covered by the real circuit integration suite.
  tx.moveCall({ target: `${fakeId('10')}::test_only::action`, arguments: [tx.pure.u64(25_000)] });
  const client = {
    getObjects: vi.fn(), getChainIdentifier: vi.fn().mockResolvedValue({ chainIdentifier: context.record.chainIdentifier }),
    simulateTransaction: vi.fn().mockResolvedValue({ ...transactionResult(fakeDigest, action.expectation, false), commandResults: [] }),
    waitForTransaction: vi.fn().mockImplementation(async ({ digest }: { digest: string }) => transactionResult(digest, action.expectation, true)),
  };
  const dependencies: RankedActionsDependencies = {
    vault: { protection: 'memory-aes-gcm', restore: vi.fn(async () => context.record), save: vi.fn(), clear: vi.fn() },
    storage: () => window.localStorage,
    withLock: async (_key, run) => run(),
    readContext: vi.fn(async () => structuredClone(context)),
    prepare: vi.fn(async (_request, options) => {
      await options.readContext(); options.onPhase?.('proving'); await options.readContext();
      return { transaction: tx, expectation: action.expectation, publicInputDigest: action.publicInputDigest };
    }),
    submit: submitAndFinalizePlayerTransaction, recover: recoverPlayerTransactionByDigest,
  };
  const options: RankedActionsOptions = {
    client, deployment: context.deployment, identity: context.record, controller: context.record.controllerAddress,
    network: 'mainnet', writesReady: true, manifestUrls: {},
    buildTransaction: vi.fn((transaction) => transaction.build()),
    signTransaction: vi.fn(async (transaction) => ({ bytes: toBase64(await transaction.build()), signature: 'test-only-not-a-real-signature' })),
    executeTransaction: vi.fn(async (bytes) => {
      const digest = await Transaction.from(bytes).getDigest();
      // This assertion runs at the transport boundary, BEFORE returning any outcome.
      expect(loadPendingRankedAction(window.localStorage, context.record)?.digest).toBe(digest);
      return transactionResult(digest, action.expectation, false);
    }),
    onFinalized: vi.fn(),
  };
  return { context, request, options, dependencies, client, action, tx };
}

async function mount(options: RankedActionsOptions, dependencies: RankedActionsDependencies) {
  const hook = renderHook((props) => useRankedActions(props, dependencies), { initialProps: options });
  await act(async () => {}); // finish initial journal check
  return hook;
}

describe('ranked map action lifecycle', () => {
  it.each(['home', 'move', 'move_new'] as const)('journals %s before sending and refreshes only after exact finality', async (mode) => {
    const f = setup(mode);
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(result.current.state.status).toBe('finalized');
    expect(f.options.signTransaction).toHaveBeenCalledOnce();
    expect(f.options.executeTransaction).toHaveBeenCalledOnce();
    expect(f.client.simulateTransaction).toHaveBeenCalledWith(expect.objectContaining({ checksEnabled: true }));
    expect(f.dependencies.readContext).toHaveBeenCalledTimes(4);
    expect(f.client.waitForTransaction).toHaveBeenCalledWith(expect.objectContaining({ digest: result.current.state.digest }));
    expect(loadPendingRankedAction(window.localStorage, f.context.record)).toBeNull();
    expect(f.options.onFinalized).toHaveBeenCalledOnce();
  });

  it('does not sign after a failed simulation', async () => {
    const f = setup();
    f.client.simulateTransaction.mockRejectedValue(new Error('Simulation rejected'));
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(result.current.state.status).toBe('error');
    expect(f.options.signTransaction).not.toHaveBeenCalled();
    expect(f.options.executeTransaction).not.toHaveBeenCalled();
  });

  it.each(['nonce', 'owner', 'expiry', 'deployment'] as const)('rejects %s changes while the wallet is open', async (change) => {
    const f = setup();
    const original = f.options.signTransaction;
    f.options.signTransaction = vi.fn(async (transaction) => {
      const signed = await original(transaction);
      if (change === 'nonce') f.context.projection.planets[0]!.proofNonce++;
      if (change === 'owner') f.context.projection.planets[0]!.ownerSeatId = fakeId('bb');
      if (change === 'expiry') f.context.nowMs = f.context.deadlineMs;
      if (change === 'deployment') f.context.deployment.clockObjectId = fakeId('77');
      return signed;
    });
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(result.current.state.status).toBe('error');
    expect(f.options.executeTransaction).not.toHaveBeenCalled();
    expect(loadPendingRankedAction(window.localStorage, f.context.record)).toBeNull();
  });

  it('refuses wallet-altered transaction bytes before submission', async () => {
    const f = setup();
    f.options.signTransaction = vi.fn(async (transaction) => {
      transaction.setGasBudget(2_000_000);
      return { bytes: toBase64(await transaction.build()), signature: 'fake' };
    });
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(result.current.state.error).toMatch(/changed.*bytes/);
    expect(f.options.executeTransaction).not.toHaveBeenCalled();
  });

  it('does not transmit if durable journal storage fails', async () => {
    const f = setup();
    f.dependencies.storage = () => ({ getItem: () => null, setItem: () => { throw new Error('Storage disabled'); }, removeItem: vi.fn() });
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(result.current.state.error).toMatch(/Storage disabled/);
    expect(result.current.state.digest).toBeUndefined();
    expect(f.options.executeTransaction).not.toHaveBeenCalled();
  });

  it('retains an ambiguous submitted digest across remount and recovers without re-signing or resending', async () => {
    const f = setup();
    f.options.executeTransaction = vi.fn().mockRejectedValue(new Error('RPC response lost'));
    const first = await mount(f.options, f.dependencies);
    await act(async () => first.result.current.submit(f.request));
    const digest = first.result.current.state.digest;
    expect(digest).toBeTruthy();
    const raw = window.localStorage.getItem(rankedActionJournalKey(f.context.record))!;
    expect(raw).not.toMatch(/signature|privateWitness|x_magnitude|"locations"|"x"|"y"/);
    await act(async () => first.result.current.submit(f.request));
    expect(f.options.signTransaction).toHaveBeenCalledOnce();
    first.unmount();
    const resumed = await mount(f.options, f.dependencies);
    await waitFor(() => expect(resumed.result.current.state.status).toBe('finalized'));
    expect(resumed.result.current.state.digest).toBe(digest);
    expect(f.options.signTransaction).toHaveBeenCalledOnce();
    expect(f.options.executeTransaction).toHaveBeenCalledOnce();
    expect(loadPendingRankedAction(window.localStorage, f.context.record)).toBeNull();
  });

  it('refreshes verified finality even if journal cleanup fails, retaining digest recovery', async () => {
    const f = setup();
    const removeItem = vi.fn<(key: string) => void>(() => { throw new Error('Storage became read-only'); });
    f.dependencies.storage = () => ({ getItem: window.localStorage.getItem.bind(window.localStorage),
      setItem: window.localStorage.setItem.bind(window.localStorage), removeItem });
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(result.current.state.error).toMatch(/Chain outcome verified/);
    expect(result.current.state.digest).toBeTruthy();
    expect(f.options.onFinalized).toHaveBeenCalledOnce();
    await act(async () => result.current.recover());
    expect(f.options.onFinalized).toHaveBeenCalledTimes(2);
    expect(f.options.executeTransaction).toHaveBeenCalledOnce();
    expect(loadPendingRankedAction(window.localStorage, f.context.record)).not.toBeNull();
    removeItem.mockImplementation((key?: string) => { window.localStorage.removeItem(key!); });
    await act(async () => result.current.recover());
    expect(result.current.state.status).toBe('finalized');
    expect(loadPendingRankedAction(window.localStorage, f.context.record)).toBeNull();
  });

  it('leaves a mismatched finality event pending and never refreshes optimistic ownership', async () => {
    const f = setup();
    f.client.waitForTransaction.mockImplementation(async ({ digest }) => {
      const result = transactionResult(digest, f.action.expectation, true);
      if (result.$kind === 'Transaction') result.Transaction.events = [];
      return result;
    });
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(result.current.state.status).toBe('error');
    expect(loadPendingRankedAction(window.localStorage, f.context.record)).not.toBeNull();
    expect(f.options.onFinalized).not.toHaveBeenCalled();
  });

  it('cancels before signing and prevents concurrent duplicate actions', async () => {
    const f = setup();
    let release!: () => void;
    const original = f.dependencies.prepare;
    f.dependencies.prepare = vi.fn(async (request, options, factory) => {
      await new Promise<void>((resolve) => { release = resolve; }); return original(request, options, factory);
    });
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => {
      const first = result.current.submit(f.request);
      await waitFor(() => expect(f.dependencies.prepare).toHaveBeenCalledOnce());
      await result.current.submit(f.request);
      result.current.cancel(); release(); await first;
    });
    expect(result.current.state.status).toBe('cancelled');
    expect(f.options.signTransaction).not.toHaveBeenCalled();
  });

  it('does not send an old wallet signature after the controller changes', async () => {
    const f = setup();
    let release!: () => Promise<void>;
    const original = f.options.signTransaction;
    f.options.signTransaction = vi.fn((transaction) => new Promise<{ bytes: string; signature: string }>((resolve) => {
      release = async () => resolve(await original(transaction));
    }));
    const hook = await mount(f.options, f.dependencies);
    let run!: Promise<void>;
    await act(async () => { run = hook.result.current.submit(f.request); });
    await waitFor(() => expect(f.options.signTransaction).toHaveBeenCalledOnce());
    hook.rerender({ ...f.options, controller: fakeId('cc') });
    await act(async () => { await release(); await run; });
    expect(f.options.executeTransaction).not.toHaveBeenCalled();
    expect(hook.result.current.state.status).toBe('idle');
  });

  it('cannot request proofs or signatures while release gates are false', async () => {
    const f = setup(); f.context.deployment.productionProofVerifierReady = false;
    const { result } = await mount(f.options, f.dependencies);
    await act(async () => result.current.submit(f.request));
    expect(f.dependencies.prepare).not.toHaveBeenCalled();
    expect(f.options.signTransaction).not.toHaveBeenCalled();
    expect(f.options.executeTransaction).not.toHaveBeenCalled();
  });
});
