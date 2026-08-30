import { describe, expect, it } from 'vitest';
import {
  buildEnrollmentTransaction,
  buildHomeClaimTransaction,
  buildOpenUniverseTransaction,
  UNDEPLOYED_TESTNET,
} from '../src';

describe('Sui gateway', () => {
  it('keeps real Soul enrollment fail-closed', () => {
    expect(() => buildEnrollmentTransaction(UNDEPLOYED_TESTNET)).toThrowError(
      expect.objectContaining({
        code: 'SOUL_ADAPTER_UNAVAILABLE',
      }),
    );
  });

  it('keeps real home proving fail-closed', () => {
    expect(() => buildHomeClaimTransaction(UNDEPLOYED_TESTNET)).toThrowError(
      expect.objectContaining({
        code: 'PROOF_VERIFIER_UNAVAILABLE',
      }),
    );
  });

  it('requires a fully pinned deployment for public keeper transactions', () => {
    expect(() => buildOpenUniverseTransaction(UNDEPLOYED_TESTNET)).toThrowError(
      expect.objectContaining({
        code: 'DEPLOYMENT_UNAVAILABLE',
      }),
    );
  });
});
