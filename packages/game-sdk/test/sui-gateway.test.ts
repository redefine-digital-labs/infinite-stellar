import { describe, expect, it } from 'vitest';
import {
  buildEnrollmentTransaction,
  buildHomeClaimTransaction,
  buildMoveTransaction,
  buildOpenUniverseTransaction,
  UNCONFIGURED_TESTNET,
} from '../src';

describe('Sui gateway', () => {
  it('keeps real Soul enrollment fail-closed', () => {
    expect(() => buildEnrollmentTransaction(UNCONFIGURED_TESTNET)).toThrowError(
      expect.objectContaining({
        code: 'SOUL_ADAPTER_UNAVAILABLE',
      }),
    );
  });

  it('keeps real home proving fail-closed', () => {
    expect(() => buildHomeClaimTransaction(UNCONFIGURED_TESTNET)).toThrowError(
      expect.objectContaining({
        code: 'PROOF_VERIFIER_UNAVAILABLE',
      }),
    );
  });

  it('keeps real movement proving fail-closed', () => {
    expect(() => buildMoveTransaction(UNCONFIGURED_TESTNET)).toThrowError(
      expect.objectContaining({
        code: 'PROOF_VERIFIER_UNAVAILABLE',
      }),
    );
  });

  it('does not treat a readiness flag as a substitute for an exact config pin', () => {
    expect(() => buildHomeClaimTransaction({
      ...UNCONFIGURED_TESTNET,
      productionProofVerifierReady: true,
    })).toThrowError(expect.objectContaining({
      code: 'DEPLOYMENT_UNAVAILABLE',
      message: expect.stringMatching(/CircuitConfig/),
    }));
  });

  it('requires a fully pinned deployment for public keeper transactions', () => {
    expect(() => buildOpenUniverseTransaction(UNCONFIGURED_TESTNET)).toThrowError(
      expect.objectContaining({
        code: 'DEPLOYMENT_UNAVAILABLE',
      }),
    );
  });
});
