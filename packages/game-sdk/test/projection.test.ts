import { describe, expect, it } from 'vitest';
import {
  createNeutralCommanderProjectionCommitment,
  type CanonicalSoul,
} from '../src';

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;

const SOUL: CanonicalSoul = {
  soulId: id('11'),
  stateId: id('12'),
  name: 'Lyra',
  description: '',
  imageUrl: '',
  provenanceKind: 0,
  originRef: null,
  creator: id('13'),
  currentOwner: id('14'),
  currentKioskId: id('15'),
  ownershipEpoch: 3n,
  listed: false,
  stateObjectVersion: '7',
  stateObjectDigest: 'state-digest',
  soulObjectVersion: '9',
  soulObjectDigest: 'soul-digest',
};

describe('neutral Commander Projection commitment', () => {
  it('is deterministic, 32 bytes, and binds the exact enrollment snapshot', () => {
    const input = {
      seasonId: id('20'),
      soulidityOriginalPackageId: id('a4'),
      soul: SOUL,
    };
    const first = createNeutralCommanderProjectionCommitment(input);
    const second = createNeutralCommanderProjectionCommitment(input);
    const changedEpoch = createNeutralCommanderProjectionCommitment({
      ...input,
      soul: { ...SOUL, ownershipEpoch: 4n },
    });
    const changedDigest = createNeutralCommanderProjectionCommitment({
      ...input,
      soul: { ...SOUL, soulObjectDigest: 'another-digest' },
    });

    expect(first).toHaveLength(32);
    expect(second).toEqual(first);
    expect(changedEpoch).not.toEqual(first);
    expect(changedDigest).not.toEqual(first);
  });
});
