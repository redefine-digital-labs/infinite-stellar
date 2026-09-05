import { describe, expect, it } from 'vitest';
import { prepareRankedAction } from '@infinite-stellar/game-sdk';
import { rankedActionFixture } from '../../../packages/game-sdk/test/ranked-action-fixtures';
import { clearPendingRankedAction, loadPendingRankedAction, rankedActionJournalKey, savePendingRankedAction,
  type PendingRankedAction } from './ranked-action-journal';

function pending(): PendingRankedAction {
  const context = rankedActionFixture('move_new');
  const action = prepareRankedAction(context, { kind: 'move', sourceLocationId: context.record.locations[0]!.locationId,
    destinationLocationId: context.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n });
  if (action.expectation.kind === 'enroll') throw new Error('Not an enrollment.');
  return { schemaVersion: 1, identity: context.record, digest: '1'.repeat(32),
    publicInputDigest: action.publicInputDigest, expectation: action.expectation, createdAtMs: 1 };
}

describe('public-only ranked action recovery journal', () => {
  it('writes only allowlisted public fields, even when the input contains extra private fields', () => {
    const value = { ...pending(), privateWitness: { x: 'private' }, signature: 'secret', signedBytes: 'secret' };
    savePendingRankedAction(window.localStorage, value);
    const raw = window.localStorage.getItem(rankedActionJournalKey(value.identity))!;
    expect(raw).not.toMatch(/private|secret|signature|signedBytes|locations/);
    expect(loadPendingRankedAction(window.localStorage, value.identity)?.digest).toBe(value.digest);
  });
  it.each(['controllerAddress', 'seasonId', 'seatId', 'packageId', 'planetRegistryId', 'typeOriginPackageId', 'chainIdentifier'] as const)(
    'isolates the %s namespace and never deletes another namespace', (field) => {
      const value = pending(); savePendingRankedAction(window.localStorage, value);
      const other = { ...value.identity, [field]: field === 'chainIdentifier' ? 'different-chain-'.repeat(3) : `0x${'b'.repeat(64)}` };
      expect(loadPendingRankedAction(window.localStorage, other)).toBeNull();
      clearPendingRankedAction(window.localStorage, other, value.digest);
      expect(loadPendingRankedAction(window.localStorage, value.identity)).not.toBeNull();
    },
  );
  it('rejects corrupt or mismatched journals instead of silently permitting another send', () => {
    const value = pending();
    const key = rankedActionJournalKey(value.identity);
    window.localStorage.setItem(key, '{broken');
    expect(() => loadPendingRankedAction(window.localStorage, value.identity)).toThrow(/journal is invalid/);
    window.localStorage.setItem(key, JSON.stringify({ ...value, expectation: { ...value.expectation, seatId: `0x${'b'.repeat(64)}` } }));
    expect(() => loadPendingRankedAction(window.localStorage, value.identity)).toThrow(/journal is invalid/);
  });
  it('does not clear a newer pending digest', () => {
    const value = pending(); savePendingRankedAction(window.localStorage, value);
    clearPendingRankedAction(window.localStorage, value.identity, '2'.repeat(32));
    expect(loadPendingRankedAction(window.localStorage, value.identity)).not.toBeNull();
  });
  it('cleans only its own unsent record after a transient readback error', () => {
    const value = pending();
    let stored: string | null = null;
    let reads = 0;
    const storage = { setItem: (_key: string, raw: string) => { stored = raw; },
      getItem: () => { if (++reads === 1) throw new Error('Transient read failure'); return stored; },
      removeItem: () => { stored = null; } };
    expect(() => savePendingRankedAction(storage, value)).toThrow(/No transaction was submitted/);
    expect(stored).toBeNull();
  });
  it('does not clear a replaced record after failed readback', () => {
    const value = pending();
    let stored = 'another record';
    const storage = { setItem: () => {}, getItem: () => stored, removeItem: () => { stored = ''; } };
    expect(() => savePendingRankedAction(storage, value)).toThrow(/No transaction was submitted/);
    expect(stored).toBe('another record');
  });
});
