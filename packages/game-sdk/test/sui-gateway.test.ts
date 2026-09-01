import { describe, expect, it } from 'vitest';
import {
  buildEnrollmentTransaction,
  buildHomeClaimTransaction,
  buildMoveTransaction,
  buildMoveNewTransaction,
  buildOpenUniverseTransaction,
  UNCONFIGURED_TESTNET,
} from '../src';

describe('Sui gateway', () => {
  it('keeps real Soul enrollment fail-closed', () => {
    expect(() => buildEnrollmentTransaction(UNCONFIGURED_TESTNET, {
      soulStateId: '0x3',
      projectionCommitment: new Uint8Array(32),
    })).toThrowError(
      expect.objectContaining({
        code: 'SOUL_ADAPTER_UNAVAILABLE',
      }),
    );
  });

  it('builds canonical mainnet SoulState enrollment only from a complete deployment record', () => {
    const transaction = buildEnrollmentTransaction({
      network: 'mainnet',
      packageId: '0x10',
      manifestId: '0x11',
      runtimeId: '0x12',
      enrollmentRegistryId: '0x13',
      clockObjectId: '0x6',
      soulidityCallablePackageId: '0x60',
      soulidityOriginalPackageId: '0xa4',
      productionSoulAdapterReady: true,
      productionProofVerifierReady: false,
    }, {
      soulStateId: '0x14',
      projectionCommitment: new Uint8Array(32).fill(7),
    });

    expect(transaction.getData().commands).toEqual([
      expect.objectContaining({
        $kind: 'MoveCall',
        MoveCall: expect.objectContaining({
          package: '0x0000000000000000000000000000000000000000000000000000000000000010',
          module: 'soul_adapter',
          function: 'enroll',
        }),
      }),
    ]);
  });

  it('rejects malformed Commander Projection commitments before wallet signing', () => {
    expect(() => buildEnrollmentTransaction({
      network: 'mainnet',
      packageId: '0x10',
      manifestId: '0x11',
      runtimeId: '0x12',
      enrollmentRegistryId: '0x13',
      clockObjectId: '0x6',
      soulidityCallablePackageId: '0x60',
      soulidityOriginalPackageId: '0xa4',
      productionSoulAdapterReady: true,
      productionProofVerifierReady: false,
    }, {
      soulStateId: '0x14',
      projectionCommitment: new Uint8Array(31),
    })).toThrowError(expect.objectContaining({
      code: 'DEPLOYMENT_UNAVAILABLE',
      message: expect.stringMatching(/32 bytes/),
    }));
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

  it('keeps proof-derived natural Planet discovery fail-closed', () => {
    expect(() => buildMoveNewTransaction(UNCONFIGURED_TESTNET)).toThrowError(
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
