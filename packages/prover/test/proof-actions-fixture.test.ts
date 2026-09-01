import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCircuitConfigDigest } from '../src/proof-intent';

interface DevelopmentActionFixture {
  actionKind: 'claim_home' | 'move';
  publicSignals: string[];
  proofBytesHex: string;
  publicInputBytesHex: string;
  verifyingKeyBytesHex: string;
  circuitConfig: {
    circuitSourceDigestHex: string;
    provingKeyDigestHex: string;
    verifyingKeyDigestHex: string;
    ceremonyTranscriptDigestHex: string;
    artifactManifestDigestHex: string;
    configDigestHex: string;
    productionApproved: false;
  };
}

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/proof-actions-development.json', import.meta.url),
  'utf8',
)) as {
  schemaVersion: number;
  status: string;
  claimHome: DevelopmentActionFixture;
  move: DevelopmentActionFixture;
  seasonId: string;
  seatId: string;
};

const moveTestSource = readFileSync(
  new URL('../../../move/infinite_stellar/tests/proof_actions_tests.move', import.meta.url),
  'utf8',
);

const bytes = (value: string) => Uint8Array.from(Buffer.from(value, 'hex'));

describe('Move proof-action development fixture', () => {
  it('is explicitly non-production and carries exact Sui byte lengths', () => {
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.status).toBe('development-only-never-production');
    for (const action of [fixture.claimHome, fixture.move]) {
      expect(bytes(action.verifyingKeyBytesHex)).toHaveLength(392);
      expect(bytes(action.proofBytesHex)).toHaveLength(128);
      expect(bytes(action.publicInputBytesHex)).toHaveLength(128);
      expect(action.publicSignals).toHaveLength(4);
      expect(action.circuitConfig.productionApproved).toBe(false);
    }
  });

  it('recomputes every immutable CircuitConfig digest from tracked bytes', () => {
    for (const action of [fixture.claimHome, fixture.move]) {
      const digest = createCircuitConfigDigest({
        actionKind: action.actionKind,
        circuitSourceDigest: bytes(action.circuitConfig.circuitSourceDigestHex),
        provingKeyDigest: bytes(action.circuitConfig.provingKeyDigestHex),
        ceremonyTranscriptDigest: bytes(action.circuitConfig.ceremonyTranscriptDigestHex),
        artifactManifestDigest: bytes(action.circuitConfig.artifactManifestDigestHex),
        verifyingKeyBytes: bytes(action.verifyingKeyBytesHex),
      });
      expect(Buffer.from(digest.verifyingKeyDigest).toString('hex'))
        .toBe(action.circuitConfig.verifyingKeyDigestHex);
      expect(Buffer.from(digest.configDigest).toString('hex'))
        .toBe(action.circuitConfig.configDigestHex);
    }
  });

  it('keeps the tracked JSON and Move-native proof vector synchronized', () => {
    expect(moveTestSource).toContain(fixture.seasonId.slice(2));
    expect(moveTestSource).toContain(fixture.seatId.slice(2));
    for (const action of [fixture.claimHome, fixture.move]) {
      expect(moveTestSource).toContain(action.proofBytesHex);
      expect(moveTestSource).toContain(action.verifyingKeyBytesHex);
      expect(moveTestSource).toContain(action.circuitConfig.configDigestHex);
    }
  });
});
