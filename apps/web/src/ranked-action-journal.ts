import { rankedPrivateMapStorageKey, type PlayerActionExpectation, type RankedMapIdentity } from '@infinite-stellar/game-sdk';

type ActionExpectation = Exclude<PlayerActionExpectation, { kind: 'enroll' }>;
export interface PendingRankedAction {
  schemaVersion: 1;
  identity: RankedMapIdentity;
  digest: string;
  publicInputDigest: string;
  expectation: ActionExpectation;
  createdAtMs: number;
}
export type RankedJournalStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const ADDRESS = /^0x[0-9a-f]{64}$/;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export function rankedActionJournalKey(identity: RankedMapIdentity): string {
  return `infinite-stellar:ranked-action:v1:${rankedPrivateMapStorageKey(identity)}`;
}

function checked(value: PendingRankedAction, identity: RankedMapIdentity): PendingRankedAction {
  if (value.schemaVersion !== 1 || rankedPrivateMapStorageKey(value.identity) !== rankedPrivateMapStorageKey(identity) ||
    !DIGEST.test(value.digest) || !/^[0-9a-f]{64}$/.test(value.publicInputDigest) ||
    !Number.isSafeInteger(value.createdAtMs) || value.createdAtMs < 0) throw new Error('Invalid pending ranked action.');
  const expected = value.expectation;
  if (!expected || expected.seasonId !== identity.seasonId || expected.seatId !== identity.seatId ||
    !expected.requiredChangedObjectIds?.length || !expected.requiredChangedObjectIds.every((id) => ADDRESS.test(id))) {
    throw new Error('Pending action does not match the active Season and Seat.');
  }
  const common = { seasonId: identity.seasonId, seatId: identity.seatId,
    requiredChangedObjectIds: [...expected.requiredChangedObjectIds] };
  let expectation: ActionExpectation;
  if (expected.kind === 'claim_home' && expected.planetId && ADDRESS.test(expected.planetId)) {
    expectation = { ...common, kind: 'claim_home', planetId: expected.planetId };
  } else if ((expected.kind === 'move' || expected.kind === 'move_new') &&
    ADDRESS.test(expected.fromPlanetId) && ADDRESS.test(expected.toPlanetId)) {
    expectation = { ...common, kind: expected.kind, fromPlanetId: expected.fromPlanetId, toPlanetId: expected.toPlanetId };
  } else throw new Error('Invalid pending action expectation.');
  // Explicit allowlist: no witness, coordinates, signed bytes, signature or vault contents.
  return { schemaVersion: 1, identity: { schemaVersion: 1, network: identity.network,
    chainIdentifier: identity.chainIdentifier, packageId: identity.packageId,
    typeOriginPackageId: identity.typeOriginPackageId, seasonId: identity.seasonId,
    planetRegistryId: identity.planetRegistryId, seatId: identity.seatId, controllerAddress: identity.controllerAddress },
  digest: value.digest, publicInputDigest: value.publicInputDigest, expectation, createdAtMs: value.createdAtMs };
}

export function loadPendingRankedAction(storage: RankedJournalStorage, identity: RankedMapIdentity): PendingRankedAction | null {
  const raw = storage.getItem(rankedActionJournalKey(identity));
  if (!raw) return null;
  // Corrupt/unreadable journals block new sends; never silently discard uncertain submission.
  try { return checked(JSON.parse(raw) as PendingRankedAction, identity); }
  catch { throw new Error('The pending action journal is invalid. Preserve it and recover the transaction before sending again.'); }
}

export function savePendingRankedAction(storage: RankedJournalStorage, value: PendingRankedAction): void {
  const safe = checked(value, value.identity);
  const key = rankedActionJournalKey(safe.identity);
  const serialized = JSON.stringify(safe);
  storage.setItem(key, serialized);
  try {
    if (storage.getItem(key) !== serialized) throw new Error('Journal readback differed.');
  } catch {
    // Transmission has not started. Only remove the exact record written here;
    // an unreadable or replaced record stays fail-closed for manual recovery.
    try { if (storage.getItem(key) === serialized) storage.removeItem(key); } catch { /* Preserve uncertainty. */ }
    throw new Error('Cannot verify the recovery journal. No transaction was submitted; preserve any remaining journal for recovery.');
  }
}

export function clearPendingRankedAction(storage: RankedJournalStorage, identity: RankedMapIdentity, digest: string): void {
  // Never erase another tab's later attempt.
  if (loadPendingRankedAction(storage, identity)?.digest === digest) storage.removeItem(rankedActionJournalKey(identity));
}
