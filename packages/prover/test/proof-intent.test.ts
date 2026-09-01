import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import {
  BN254_SCALAR_FIELD,
  createRulesGeometryCommitment,
  createMoveNewProofIntentCommitment,
  createProofIntentCommitment,
  PROOF_INTENT_DOMAIN_FIELD,
  proofNetworkField,
  ROUND5_RULES_GEOMETRY_COMMITMENT,
  ROUND5_RULES_GEOMETRY,
  RULES_GEOMETRY_DOMAIN_FIELD,
  serializeProofPublicSignals,
  splitSuiIdentifier,
  type ProofIntentV1,
} from '../src/proof-intent';

const GOLDEN_INTENT: ProofIntentV1 = {
  network: 'sui:mainnet',
  league: 1,
  actionKind: 'claim_home',
  seasonId: '0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
  seatId: '0x22223333444455556666777788889999aaaabbbbccccddddeeeeffff00001111',
  sender: '0xa11ce',
  sourceLocationHash: 0n,
  destinationLocationHash: 1_234_567_890_123_456_789_012_345_678_901_234_567_890n,
  amount: 0n,
  sourcePlanetNonce: 0n,
  deadlineMs: 1_800_000_000_000n,
  rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT,
};

describe('proof intent v1', () => {
  it('derives the Round-5 geometry commitment from every circuit parameter', () => {
    expect(RULES_GEOMETRY_DOMAIN_FIELD).toBe(
      6_053_036_279_538_949_956_273_599_243_158_082_485_469_979_069_117_808_157_047_738_621_272_655_476_926n,
    );
    expect(createRulesGeometryCommitment(ROUND5_RULES_GEOMETRY)).toBe(
      ROUND5_RULES_GEOMETRY_COMMITMENT,
    );
    for (const mutation of [
      { ...ROUND5_RULES_GEOMETRY, worldRadius: 12_001 },
      { ...ROUND5_RULES_GEOMETRY, planetHashThreshold: 1n },
      { ...ROUND5_RULES_GEOMETRY, locationHashKey: 114 },
      { ...ROUND5_RULES_GEOMETRY, spaceTypeKey: 117 },
      { ...ROUND5_RULES_GEOMETRY, perlinScale: 8192 },
      { ...ROUND5_RULES_GEOMETRY, perlinMirrorX: true },
      { ...ROUND5_RULES_GEOMETRY, perlinMirrorY: true },
      { ...ROUND5_RULES_GEOMETRY, homePerlinMinInclusive: 12 },
      { ...ROUND5_RULES_GEOMETRY, homePerlinMaxExclusive: 15 },
    ]) {
      expect(createRulesGeometryCommitment(mutation)).not.toBe(ROUND5_RULES_GEOMETRY_COMMITMENT);
    }
  });

  it('matches the machine-readable interface and pinned rules source', () => {
    const specification = JSON.parse(readFileSync(
      new URL('../../../config/proof-interface-v1.json', import.meta.url),
      'utf8',
    )) as {
      domain: { field: string };
      networkFields: Record<string, string>;
      publicSignals: { order: string[]; byteLength: number };
      rulesGeometry: { sourceSha256: string; field: string };
      goldenVector: { actionCommitment: string; publicInputSha256: string };
    };
    const rulesBytes = readFileSync(new URL('../../../config/dark-forest-v06-round5.json', import.meta.url));
    expect(specification.domain.field).toBe(PROOF_INTENT_DOMAIN_FIELD.toString());
    expect(specification.networkFields['sui:mainnet']).toBe(proofNetworkField('sui:mainnet').toString());
    expect(specification.publicSignals.order).toEqual([
      'source_location_hash',
      'destination_location_hash',
      'action_commitment',
      'rules_geometry_commitment',
    ]);
    expect(specification.publicSignals.byteLength).toBe(128);
    expect(specification.rulesGeometry.sourceSha256).toBe(bytesToHex(sha256(rulesBytes)));
    expect(specification.rulesGeometry.field).toBe(ROUND5_RULES_GEOMETRY_COMMITMENT.toString());
    const result = createProofIntentCommitment(GOLDEN_INTENT);
    expect(specification.goldenVector.actionCommitment).toBe(result.publicSignals[2].toString());
    expect(specification.goldenVector.publicInputSha256).toBe(result.publicInputDigest);
  });

  it('locks the cross-language claim-home golden vector', () => {
    const result = createProofIntentCommitment(GOLDEN_INTENT);

    expect(PROOF_INTENT_DOMAIN_FIELD).toBe(
      13_909_138_997_969_785_233_372_616_111_572_825_994_268_025_797_777_928_597_047_068_964_955_765_571_998n,
    );
    expect(result.networkField).toBe(
      135_562_284_393_187_496_412_304_656_295_821_855_871_151_406_243_072_554_287_673_956_922_558_459_083n,
    );
    expect(result.contextField).toBe(
      6_961_760_459_381_713_882_819_346_659_547_257_964_740_718_346_557_136_328_160_522_324_577_965_813_159n,
    );
    expect(result.publicSignals).toEqual([
      0n,
      GOLDEN_INTENT.destinationLocationHash,
      1_381_185_597_265_463_982_013_002_656_334_667_872_910_775_239_321_664_969_824_848_212_529_506_565_370n,
      ROUND5_RULES_GEOMETRY_COMMITMENT,
    ]);
    expect(result.publicInputBytes).toHaveLength(128);
    expect(result.publicInputDigest).toBe('e0ff0fb23b823242ea25172b54a36aaec4bb40aad7009e420b6ea4a1072da77b');
  });

  it('changes the commitment when any bound action field changes', () => {
    const original = createProofIntentCommitment(GOLDEN_INTENT).publicSignals[2];
    const mutations: ProofIntentV1[] = [
      { ...GOLDEN_INTENT, network: 'sui:testnet' },
      { ...GOLDEN_INTENT, league: 2 },
      { ...GOLDEN_INTENT, actionKind: 'move' },
      { ...GOLDEN_INTENT, seasonId: '0x2' },
      { ...GOLDEN_INTENT, seatId: '0x3' },
      { ...GOLDEN_INTENT, sender: '0xb0b' },
      { ...GOLDEN_INTENT, sourceLocationHash: 1n },
      { ...GOLDEN_INTENT, destinationLocationHash: 2n },
      { ...GOLDEN_INTENT, amount: 1n },
      { ...GOLDEN_INTENT, sourcePlanetNonce: 1n },
      { ...GOLDEN_INTENT, deadlineMs: 1_800_000_000_001n },
      { ...GOLDEN_INTENT, rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT + 1n },
    ];

    for (const mutation of mutations) {
      expect(createProofIntentCommitment(mutation).publicSignals[2]).not.toBe(original);
    }
  });

  it('serializes each public signal as an exact 32-byte little-endian scalar', () => {
    const bytes = serializeProofPublicSignals([1n, 256n, 65_535n, 0n]);
    expect(bytes).toHaveLength(128);
    expect([...bytes.slice(0, 4)]).toEqual([1, 0, 0, 0]);
    expect([...bytes.slice(32, 36)]).toEqual([0, 1, 0, 0]);
    expect([...bytes.slice(64, 68)]).toEqual([255, 255, 0, 0]);
    expect([...bytes.slice(96)]).toEqual(new Array<number>(32).fill(0));
  });

  it('adds proof-derived destination Perlin only for move-new statements', () => {
    const result = createMoveNewProofIntentCommitment(
      { ...GOLDEN_INTENT, actionKind: 'move_new', sourceLocationHash: 9n },
      14,
    );
    expect(result.publicSignals).toHaveLength(5);
    expect(result.publicSignals[2]).toBe(14n);
    expect(result.publicInputBytes).toHaveLength(160);
    expect(() => createMoveNewProofIntentCommitment(GOLDEN_INTENT, 14)).toThrow(/move_new/);
    expect(() => createMoveNewProofIntentCommitment(
      { ...GOLDEN_INTENT, actionKind: 'move_new' },
      32,
    )).toThrow(/destinationSpacePerlin/);
  });

  it('uses big-endian Sui IDs split into low then high 128-bit limbs', () => {
    expect(splitSuiIdentifier('0x100000000000000000000000000000002')).toEqual([2n, 1n]);
  });

  it('rejects non-canonical fields and malformed bounded values', () => {
    expect(() => createProofIntentCommitment({ ...GOLDEN_INTENT, league: 256 })).toThrow(/league/);
    expect(() => createProofIntentCommitment({ ...GOLDEN_INTENT, seasonId: 'not-hex' })).toThrow(/seasonId/);
    expect(() => createProofIntentCommitment({ ...GOLDEN_INTENT, amount: -1n })).toThrow(/amount/);
    expect(() => createProofIntentCommitment({
      ...GOLDEN_INTENT,
      destinationLocationHash: BN254_SCALAR_FIELD,
    })).toThrow(/destinationLocationHash/);
    expect(() => serializeProofPublicSignals([1n, 2n, 3n])).toThrow(/four or five/);
    expect(() => createRulesGeometryCommitment({
      ...ROUND5_RULES_GEOMETRY,
      planetHashThreshold: 0n,
    })).toThrow(/positive/);
  });

  it('pins the supported network domain fields', () => {
    expect(proofNetworkField('sui:testnet')).toBe(
      12_597_337_022_539_968_384_113_403_541_422_236_107_320_375_547_824_898_886_637_436_062_384_730_239_134n,
    );
    expect(proofNetworkField('sui:mainnet')).toBe(
      135_562_284_393_187_496_412_304_656_295_821_855_871_151_406_243_072_554_287_673_956_922_558_459_083n,
    );
  });
});
