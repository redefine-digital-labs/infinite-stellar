import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  serializeSnarkjsGroth16ForSui,
  type SnarkjsGroth16Proof,
  type SnarkjsGroth16VerificationKey,
} from '../src/sui-groth16';

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/claim-home-sui-serialization.json', import.meta.url),
  'utf8',
)) as {
  proof: SnarkjsGroth16Proof;
  verificationKey: SnarkjsGroth16VerificationKey;
  publicSignals: string[];
};

const EXPECTED_VK = '2d2b80c95d9d91c253374307f856ecb9114534e123ffcaf8a2badd0eb069b50f81f532cedb110d8c48a3273a817e987cdd42e43f4028bf375f7621ad9ee5da23724fb36a6348d9c4500d6b8b406e5df08031264f5718a8a9ac34612072b3280bedf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19a1904b1d484a1f87c0f373821aee403b52152daf3a7e5c7f7eadf3527167932f82c62d0e8446c5876bf56992797cb745014bbad0f245cbe32a82bbcf7ed6da260500000000000000d9d8ae6601c037c3b403a68af89e64593440006b6a02d502baadbffb5914daa97106cac743c8011d79968958295c697ad4e60b408fd1a75a633257e4a2523f8aa08ef7fd3246689e4f8d6694c0fbd004da4643171358bd5b3b93da2a4d21ca093ef82fb0c3fdc28ab38e2da6a862706d127bcf30fb1ffc8ed56c236ef1233315ef9c602dd2ff478aec90dd343b867869987e0aad5886d2184d41d9a41c6ac11b';
const EXPECTED_PROOF = '78b4c1268aaf59bd07d145195ce26f3db8dded3c3061da12841349335144b81abf7a51e546a464acbced39601948666e79ca0f9fc5cacdf07abcb083d7ed7c2143ad6cb4b21397115383563027994428152060d8554dde8c4726ac5aa80e5aa9340287876746022710fa23073df3116624d99fb7b5bec164e75a65cac1b07794';

describe('snarkjs to Sui Groth16 serialization', () => {
  it('matches an independently generated Arkworks BN254 vector byte for byte', async () => {
    const bytes = await serializeSnarkjsGroth16ForSui(
      fixture.proof,
      fixture.verificationKey,
      fixture.publicSignals,
    );
    expect(bytes.verifyingKey).toHaveLength(392);
    expect(bytes.proofPoints).toHaveLength(128);
    expect(bytes.publicInputs).toHaveLength(128);
    expect([...bytes.verifyingKey.slice(224, 232)]).toEqual([5, 0, 0, 0, 0, 0, 0, 0]);
    expect(Buffer.from(bytes.verifyingKey).toString('hex')).toBe(EXPECTED_VK);
    expect(Buffer.from(bytes.proofPoints).toString('hex')).toBe(EXPECTED_PROOF);
    expect(Buffer.from(bytes.publicInputs).toString('hex')).toBe(
      '000000000000000000000000000000000000000000000000000000000000000092bf05a42cf2cffd4ac27543927ec8cd54865f0078d8fda34c932cb1fb3f00006fb755894082cd7565f8014343ac625ebee37164c8f1c14ba2c75ead05bac40664e22a15b195e8662395ba764adc373fb71c5ca3f2166e5e3156293f47fdce28',
    );
  });

  it('rejects mismatched curve and public-input metadata before point conversion', async () => {
    const proof = { protocol: 'groth16', curve: 'bls12381' } as SnarkjsGroth16Proof;
    const verificationKey = { protocol: 'groth16', curve: 'bn128', nPublic: 4, IC: [] } as unknown as SnarkjsGroth16VerificationKey;
    await expect(serializeSnarkjsGroth16ForSui(proof, verificationKey, ['0', '0', '0', '0']))
      .rejects.toThrow(/BN254/);
  });

  it('rejects non-affine snarkjs points before emitting bytes', async () => {
    const proof = { ...fixture.proof, pi_a: [...(fixture.proof.pi_a as unknown[]).slice(0, 2), '0'] };
    await expect(serializeSnarkjsGroth16ForSui(
      proof,
      fixture.verificationKey,
      fixture.publicSignals,
    )).rejects.toThrow(/finite affine/);
  });
});
