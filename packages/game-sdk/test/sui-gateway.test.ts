import { describe, expect, it } from 'vitest';
import {
  createMoveNewProofIntentCommitment,
  createProofIntentCommitment,
  ROUND5_RULES_GEOMETRY_COMMITMENT,
  type SuiProofSubmission,
} from '@infinite-stellar/prover';
import {
  buildEnrollmentTransaction,
  buildHomeClaimTransaction,
  buildMoveTransaction,
  buildMoveNewTransaction,
  buildOpenUniverseTransaction,
  type CircuitConfigPin,
  type InfiniteStellarDeployment,
  type MoveTransactionInput,
  UNCONFIGURED_TESTNET,
} from '../src';

const id = (byte: string) => `0x${byte.repeat(32)}`;
const NETWORK = 'sui:mainnet' as const;
const RULESET = 'dark-forest-v06-round5';
const MANIFEST_ID = id('11');
const SEAT_ID = id('22');
const SENDER = id('aa');
const SOURCE_HASH = 441595625074136767652070888593187681073630156209416385716195429441716114n;
const DESTINATION_HASH = 1759259153186726942209343294499159540235552521067839175742163671329318918n;
const DEADLINE_MS = 1_800_000_000_000n;

function circuitPin(action: 'claim-home' | 'move' | 'move-new', byte: string): CircuitConfigPin {
  return {
    objectId: id(byte),
    circuitId: `round5-${action}`,
    circuitVersion: 1,
    artifactManifestSha256: byte.repeat(32),
    configDigest: 'cd'.repeat(32),
    verifyingKeyDigest: 'ef'.repeat(32),
  };
}

const CLAIM_CONFIG = circuitPin('claim-home', '31');
const MOVE_CONFIG = circuitPin('move', '32');
const MOVE_NEW_CONFIG = circuitPin('move-new', '33');

const PRODUCTION_DEPLOYMENT: InfiniteStellarDeployment = {
  network: 'mainnet',
  packageId: id('10'),
  manifestId: MANIFEST_ID,
  runtimeId: id('12'),
  enrollmentRegistryId: id('13'),
  planetRegistryId: id('14'),
  randomObjectId: id('08'),
  clockObjectId: id('06'),
  soulidityCallablePackageId: id('60'),
  soulidityOriginalPackageId: id('a4'),
  claimHomeCircuitConfig: CLAIM_CONFIG,
  moveCircuitConfig: MOVE_CONFIG,
  moveNewCircuitConfig: MOVE_NEW_CONFIG,
  proofIntent: {
    network: NETWORK,
    rulesetId: RULESET,
    league: 1,
    rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT.toString(),
  },
  seatRouting: {
    keyTypeOriginPackageId: id('10'),
    keyEncodingVersion: 1,
    league: 1,
  },
  productionReleaseEvidence: {
    schemaVersion: 1,
    ceremonyTranscriptSha256: 'a1'.repeat(32),
    circuitAuditSha256: 'a2'.repeat(32),
    moveAuditSha256: 'a3'.repeat(32),
    clientAuditSha256: 'a4'.repeat(32),
    operationsApprovalSha256: 'a5'.repeat(32),
    multisigPolicySha256: 'a6'.repeat(32),
  },
  productionSoulAdapterReady: true,
  productionProofVerifierReady: true,
};

interface Statement {
  publicSignals: readonly bigint[];
  publicInputBytes: Uint8Array;
  publicInputDigest: string;
}

function submission(config: CircuitConfigPin, statement: Statement): SuiProofSubmission {
  return {
    network: NETWORK,
    rulesetId: RULESET,
    circuitId: config.circuitId,
    circuitVersion: config.circuitVersion,
    artifactManifestSha256: config.artifactManifestSha256,
    verifyingKeyDigest: config.verifyingKeyDigest,
    publicSignals: statement.publicSignals.map((signal) => signal.toString()),
    publicInputs: statement.publicInputBytes,
    publicInputDigest: statement.publicInputDigest,
    proofBytes: new Uint8Array(128).fill(7),
  };
}

const BASE_MOVE_INPUT = {
  seatId: SEAT_ID,
  civilizationId: id('23'),
  sender: SENDER,
  deadlineMs: DEADLINE_MS,
  sourcePlanetId: id('24'),
  sourceLocationHash: SOURCE_HASH,
  destinationLocationHash: DESTINATION_HASH,
  sourcePlanetNonce: 7n,
  maxDistance: 198n,
  sentEnergy: 1_000n,
  sentSilver: 25n,
} as const;

function moveStatement(actionKind: 'move' | 'move_new') {
  return createProofIntentCommitment({
    network: NETWORK,
    league: 1,
    actionKind,
    seasonId: MANIFEST_ID,
    seatId: SEAT_ID,
    sender: SENDER,
    sourceLocationHash: SOURCE_HASH,
    destinationLocationHash: DESTINATION_HASH,
    amount: 198n,
    sourcePlanetNonce: 7n,
    deadlineMs: DEADLINE_MS,
    rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT,
  });
}

const FAIL_CLOSED_INPUT = {
  seatId: SEAT_ID,
  civilizationId: id('23'),
  scoreCardId: id('25'),
  sender: SENDER,
  destinationLocationHash: DESTINATION_HASH,
  deadlineMs: DEADLINE_MS,
  proof: {} as SuiProofSubmission,
};

describe('Sui gateway', () => {
  it('keeps real Soul enrollment fail-closed without a production deployment', () => {
    expect(() => buildEnrollmentTransaction(UNCONFIGURED_TESTNET, {
      soulStateId: id('03'),
      sender: SENDER,
      projectionCommitment: new Uint8Array(32),
    })).toThrowError(expect.objectContaining({ code: 'SOUL_ADAPTER_UNAVAILABLE' }));
  });

  it('builds canonical mainnet SoulState enrollment only from a complete deployment record', () => {
    const transaction = buildEnrollmentTransaction(PRODUCTION_DEPLOYMENT, {
      soulStateId: id('15'),
      sender: SENDER,
      projectionCommitment: new Uint8Array(32).fill(7),
    });

    expect(transaction.getData().commands).toEqual([
      expect.objectContaining({
        $kind: 'MoveCall',
        MoveCall: expect.objectContaining({
          package: id('10'),
          module: 'soul_adapter',
          function: 'enroll',
        }),
      }),
    ]);
  });

  it('rejects malformed Commander Projection commitments before wallet signing', () => {
    expect(() => buildEnrollmentTransaction(PRODUCTION_DEPLOYMENT, {
      soulStateId: id('15'),
      sender: SENDER,
      projectionCommitment: new Uint8Array(31),
    })).toThrowError(expect.objectContaining({
      code: 'DEPLOYMENT_UNAVAILABLE',
      message: expect.stringMatching(/32 bytes/),
    }));
  });

  it('keeps enrollment closed without exact ceremony, audit, operations, and multisig evidence', () => {
    expect(() => buildEnrollmentTransaction({
      ...PRODUCTION_DEPLOYMENT,
      productionReleaseEvidence: undefined,
    }, {
      soulStateId: id('15'),
      sender: SENDER,
      projectionCommitment: new Uint8Array(32),
    })).toThrowError(expect.objectContaining({
      code: 'DEPLOYMENT_UNAVAILABLE',
      message: expect.stringMatching(/ceremony, audit, operations, and multisig evidence/i),
    }));
  });

  it('keeps proof actions fail-closed until production verifier activation', () => {
    expect(() => buildHomeClaimTransaction(UNCONFIGURED_TESTNET, FAIL_CLOSED_INPUT)).toThrowError(
      expect.objectContaining({ code: 'PROOF_VERIFIER_UNAVAILABLE' }),
    );
    expect(() => buildMoveTransaction(UNCONFIGURED_TESTNET, {
      ...BASE_MOVE_INPUT,
      targetPlanetId: id('26'),
      proof: {} as SuiProofSubmission,
    })).toThrowError(expect.objectContaining({ code: 'PROOF_VERIFIER_UNAVAILABLE' }));
    expect(() => buildMoveNewTransaction(UNCONFIGURED_TESTNET, {
      ...BASE_MOVE_INPUT,
      destinationSpacePerlin: 14,
      proof: {} as SuiProofSubmission,
    })).toThrowError(expect.objectContaining({ code: 'PROOF_VERIFIER_UNAVAILABLE' }));
  });

  it('does not treat readiness as a substitute for an exact CircuitConfig pin', () => {
    expect(() => buildHomeClaimTransaction({
      ...PRODUCTION_DEPLOYMENT,
      claimHomeCircuitConfig: undefined,
    }, FAIL_CLOSED_INPUT)).toThrowError(expect.objectContaining({
      code: 'DEPLOYMENT_UNAVAILABLE',
      message: expect.stringMatching(/CircuitConfig/),
    }));
  });

  it('builds a proof-bound production home claim', () => {
    const statement = createProofIntentCommitment({
      network: NETWORK,
      league: 1,
      actionKind: 'claim_home',
      seasonId: MANIFEST_ID,
      seatId: SEAT_ID,
      sender: SENDER,
      sourceLocationHash: 0n,
      destinationLocationHash: DESTINATION_HASH,
      amount: 0n,
      sourcePlanetNonce: 0n,
      deadlineMs: DEADLINE_MS,
      rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT,
    });
    const transaction = buildHomeClaimTransaction(PRODUCTION_DEPLOYMENT, {
      ...FAIL_CLOSED_INPUT,
      proof: submission(CLAIM_CONFIG, statement),
    });
    expect(transaction.getData()).toMatchObject({
      sender: SENDER,
      commands: [expect.objectContaining({
        MoveCall: expect.objectContaining({ module: 'proof_actions', function: 'claim_home' }),
      })],
    });
    expect(transaction.getData().inputs).toHaveLength(11);
  });

  it('builds proof-bound move and move-new PTBs with exact Move argument order', () => {
    const move = moveStatement('move');
    const moveInput: MoveTransactionInput = {
      ...BASE_MOVE_INPUT,
      targetPlanetId: id('26'),
      proof: submission(MOVE_CONFIG, move),
    };
    const moveTransaction = buildMoveTransaction(PRODUCTION_DEPLOYMENT, moveInput);
    expect(moveTransaction.getData().commands[0]).toMatchObject({
      MoveCall: expect.objectContaining({ module: 'proof_actions', function: 'dispatch_move' }),
    });
    expect(moveTransaction.getData().inputs).toHaveLength(13);

    const moveNew = createMoveNewProofIntentCommitment({
      network: NETWORK,
      league: 1,
      actionKind: 'move_new',
      seasonId: MANIFEST_ID,
      seatId: SEAT_ID,
      sender: SENDER,
      sourceLocationHash: SOURCE_HASH,
      destinationLocationHash: DESTINATION_HASH,
      amount: 198n,
      sourcePlanetNonce: 7n,
      deadlineMs: DEADLINE_MS,
      rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT,
    }, 14);
    const moveNewTransaction = buildMoveNewTransaction(PRODUCTION_DEPLOYMENT, {
      ...BASE_MOVE_INPUT,
      destinationSpacePerlin: 14,
      proof: submission(MOVE_NEW_CONFIG, moveNew),
    });
    expect(moveNewTransaction.getData().commands[0]).toMatchObject({
      MoveCall: expect.objectContaining({ module: 'proof_actions', function: 'dispatch_move_new' }),
    });
    expect(moveNewTransaction.getData().inputs).toHaveLength(15);
  });

  it('rejects sender, nonce, artifact-manifest, and proof-byte substitution before signing', () => {
    const statement = moveStatement('move');
    const proof = submission(MOVE_CONFIG, statement);
    const validInput: MoveTransactionInput = {
      ...BASE_MOVE_INPUT,
      targetPlanetId: id('26'),
      proof,
    };
    for (const mutation of [
      { sender: id('ab') },
      { sourcePlanetNonce: 8n },
      { proof: { ...proof, artifactManifestSha256: '00'.repeat(32) } },
      { proof: { ...proof, proofBytes: new Uint8Array(127) } },
    ]) {
      expect(() => buildMoveTransaction(PRODUCTION_DEPLOYMENT, {
        ...validInput,
        ...mutation,
      })).toThrowError(expect.objectContaining({ code: 'PROOF_STATEMENT_MISMATCH' }));
    }
  });

  it('requires a fully pinned deployment for public keeper transactions', () => {
    expect(() => buildOpenUniverseTransaction(UNCONFIGURED_TESTNET)).toThrowError(
      expect.objectContaining({ code: 'DEPLOYMENT_UNAVAILABLE' }),
    );
  });
});
