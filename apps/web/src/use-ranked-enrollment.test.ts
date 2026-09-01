import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanonicalSoul, PlayerSuiClient } from '@infinite-stellar/game-sdk';
import { MAINNET_DEPLOYMENT } from './deployment';
import { loadPendingEnrollment, submitRankedEnrollment } from './use-ranked-enrollment';

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;
const CONTROLLER = id('a1');

afterEach(() => window.localStorage.clear());

function soul(owner = CONTROLLER, listed = false): CanonicalSoul {
  return {
    soulId: id('b1'),
    stateId: id('b2'),
    name: 'Lyra Mainnet',
    description: 'Canonical fixture',
    imageUrl: '',
    provenanceKind: 1,
    originRef: null,
    creator: id('b3'),
    currentOwner: owner,
    currentKioskId: id('b4'),
    ownershipEpoch: 7n,
    listed,
    stateObjectVersion: '9',
    stateObjectDigest: 'state-digest',
    soulObjectVersion: '4',
    soulObjectDigest: 'soul-digest',
  };
}

describe('ranked enrollment submission guard', () => {
  it('rejects stale or listed Soul authority before preparing or signing', async () => {
    const execute = vi.fn();
    const client = {} as PlayerSuiClient;

    await expect(submitRankedEnrollment({
      client,
      deployment: { ...MAINNET_DEPLOYMENT, manifestId: id('c1') },
      controller: CONTROLLER,
      soul: soul(id('ff')),
      execute,
    })).rejects.toThrow(/not an unlisted canonical Soul/i);
    await expect(submitRankedEnrollment({
      client,
      deployment: { ...MAINNET_DEPLOYMENT, manifestId: id('c1') },
      controller: CONTROLLER,
      soul: soul(CONTROLLER, true),
      execute,
    })).rejects.toThrow(/not an unlisted canonical Soul/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it('cannot reach the wallet while the mainnet deployment gates are closed', async () => {
    const execute = vi.fn();
    await expect(submitRankedEnrollment({
      client: {} as PlayerSuiClient,
      deployment: { ...MAINNET_DEPLOYMENT, manifestId: id('c1') },
      controller: CONTROLLER,
      soul: soul(),
      execute,
    })).rejects.toMatchObject({ code: 'SOUL_ADAPTER_UNAVAILABLE' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not recover a malformed or cross-controller pending record', () => {
    const key = `infinite-stellar:ranked-pending:v1:mainnet:${CONTROLLER}`;
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      kind: 'enroll',
      digest: 'not-base58',
      seasonId: id('c1'),
      controller: id('ff'),
      soulId: id('b1'),
      soulStateId: id('b2'),
      createdAtMs: Date.now(),
    }));
    expect(loadPendingEnrollment(CONTROLLER)).toBeNull();
  });
});
