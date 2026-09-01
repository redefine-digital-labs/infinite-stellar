import { sha256 } from '@noble/hashes/sha2.js';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { CanonicalSoul } from './soulidity-reader';

const PROJECTION_DOMAIN = 'infinite-stellar/commander-projection/neutral-v1';

export interface NeutralCommanderProjectionInput {
  seasonId: string;
  soulidityOriginalPackageId: string;
  soul: CanonicalSoul;
}

/**
 * Commits the neutral fallback presentation to the exact canonical Soul and
 * object versions used at enrollment. This does not grant display rights to
 * external Animacraft material; a later visual adapter must define and audit a
 * separate commitment domain.
 */
export function createNeutralCommanderProjectionCommitment(
  input: NeutralCommanderProjectionInput,
): Uint8Array {
  const payload = [
    PROJECTION_DOMAIN,
    'sui:mainnet',
    normalizeSuiAddress(input.seasonId),
    normalizeSuiAddress(input.soulidityOriginalPackageId),
    normalizeSuiAddress(input.soul.stateId),
    normalizeSuiAddress(input.soul.soulId),
    input.soul.ownershipEpoch.toString(),
    input.soul.stateObjectVersion,
    input.soul.stateObjectDigest,
    input.soul.soulObjectVersion,
    input.soul.soulObjectDigest,
  ].join('\0');
  return sha256(new TextEncoder().encode(payload));
}
