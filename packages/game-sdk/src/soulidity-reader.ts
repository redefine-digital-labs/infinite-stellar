import { bcs } from '@mysten/sui/bcs';
import { ObjectError, type SuiClientTypes } from '@mysten/sui/client';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { normalizeSuiAddress } from '@mysten/sui/utils';

const CANONICAL_ADDRESS = /^0x[0-9a-f]{64}$/;
const MAX_DISCOVERY_PAGE_SIZE = 50;

const MoveTableBcs = bcs.struct('MoveTable', {
  id: bcs.Address,
  size: bcs.u64(),
});

const SoulStateBcs = bcs.struct('SoulState', {
  id: bcs.Address,
  version: bcs.u64(),
  soul_id: bcs.Address,
  creator: bcs.Address,
  creator_royalty_bps: bcs.u16(),
  current_owner: bcs.Address,
  current_kiosk_id: bcs.Address,
  ownership_epoch: bcs.u64(),
  grant_capacity: bcs.u64(),
  active_grants: MoveTableBcs,
  active_grant_ids: MoveTableBcs,
  active_grant_count: bcs.u64(),
  content_id: bcs.option(bcs.Address),
  config_ext: MoveTableBcs,
  collection_id: bcs.option(bcs.Address),
  access_list_id: bcs.option(bcs.Address),
  is_listed: bcs.bool(),
});

const SoulBcs = bcs.struct('Soul', {
  id: bcs.Address,
  version: bcs.u64(),
  name: bcs.string(),
  description: bcs.string(),
  image_url: bcs.string(),
  provenance_kind: bcs.u8(),
  origin_ref: bcs.option(bcs.string()),
  creator: bcs.Address,
});

const SoulCreatedEventBcs = bcs.struct('SoulCreated', {
  soul_id: bcs.Address,
  state_id: bcs.Address,
  content_id: bcs.Address,
  creator: bcs.Address,
  owner: bcs.Address,
  provenance_kind: bcs.u8(),
});

export interface SoulidityMainnetPin {
  network: 'mainnet';
  chainIdentifier: string;
  callablePackageId: string;
  originalPackageId: string;
  soulStateType: string;
  protocolVersion: number;
  stateVersion: number;
}

export type SoulidityReadClient = Pick<
  SuiGrpcClient,
  'getChainIdentifier' | 'getObjects' | 'listEvents'
>;

export class SoulidityReadError extends Error {
  constructor(
    readonly code:
      | 'INVALID_CONFIG'
      | 'WRONG_CHAIN'
      | 'CHAIN_READ_FAILED'
      | 'INVALID_SOUL_STATE'
      | 'INVALID_SOUL',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'SoulidityReadError';
  }
}

export interface CanonicalSoulState {
  stateId: string;
  soulId: string;
  version: bigint;
  creator: string;
  creatorRoyaltyBps: number;
  currentOwner: string;
  currentKioskId: string;
  ownershipEpoch: bigint;
  grantCapacity: bigint;
  activeGrantCount: bigint;
  contentId: string | null;
  collectionId: string | null;
  accessListId: string | null;
  listed: boolean;
  objectVersion: string;
  objectDigest: string;
  previousTransaction: string | null;
}

export interface CanonicalSoul {
  soulId: string;
  stateId: string;
  name: string;
  description: string;
  imageUrl: string;
  provenanceKind: number;
  originRef: string | null;
  creator: string;
  currentOwner: string;
  currentKioskId: string;
  ownershipEpoch: bigint;
  listed: boolean;
  stateObjectVersion: string;
  stateObjectDigest: string;
  soulObjectVersion: string;
  soulObjectDigest: string;
}

export interface SoulidityDiscoveryOptions {
  pageSize?: number;
  maxPages?: number;
  signal?: AbortSignal;
}

export interface SoulidityDiscoveryResult {
  souls: CanonicalSoul[];
  complete: boolean;
  scannedEvents: number;
  discoveredStateIds: number;
  nextCursor: string | null;
}

function canonicalAddress(value: string, label: string): string {
  const normalized = normalizeSuiAddress(value);
  if (!CANONICAL_ADDRESS.test(normalized)) {
    throw new SoulidityReadError('INVALID_CONFIG', `${label} must be a canonical Sui address.`);
  }
  return normalized;
}

function validatePin(pin: SoulidityMainnetPin): {
  callablePackageId: string;
  originalPackageId: string;
  soulStateType: string;
} {
  if (
    pin.network !== 'mainnet' ||
    typeof pin.chainIdentifier !== 'string' || pin.chainIdentifier.length === 0 ||
    pin.protocolVersion !== 1 || pin.stateVersion !== 1
  ) {
    throw new SoulidityReadError(
      'INVALID_CONFIG',
      'Soulidity discovery requires the exact mainnet chain and v1 protocol/state pins.',
    );
  }
  const callablePackageId = canonicalAddress(pin.callablePackageId, 'Soulidity callable package');
  const originalPackageId = canonicalAddress(pin.originalPackageId, 'Soulidity original package');
  const soulStateType = `${originalPackageId}::soul::SoulState`;
  if (pin.soulStateType !== soulStateType) {
    throw new SoulidityReadError(
      'INVALID_CONFIG',
      'The pinned SoulState type must use the canonical Soulidity type-origin package.',
    );
  }
  return { callablePackageId, originalPackageId, soulStateType };
}

async function assertPinnedChain(
  client: Pick<SuiGrpcClient, 'getChainIdentifier'>,
  pin: SoulidityMainnetPin,
): Promise<void> {
  let response;
  try {
    response = await client.getChainIdentifier();
  } catch (error) {
    throw new SoulidityReadError(
      'CHAIN_READ_FAILED',
      error instanceof Error ? error.message : 'The Sui chain identifier could not be read.',
      { cause: error },
    );
  }
  if (response.chainIdentifier !== pin.chainIdentifier) {
    throw new SoulidityReadError(
      'WRONG_CHAIN',
      `Expected Sui mainnet chain ${pin.chainIdentifier}, received ${response.chainIdentifier}.`,
    );
  }
}

function requireObject(
  value: SuiClientTypes.Object<{ content: true; previousTransaction: true }> | Error | undefined,
  objectId: string,
  label: string,
): SuiClientTypes.Object<{ content: true; previousTransaction: true }> {
  if (!value || value instanceof Error) {
    const detail = value instanceof ObjectError && value.reason === 'notFound'
      ? 'was not found'
      : value?.message ?? 'could not be read';
    throw new SoulidityReadError(
      'CHAIN_READ_FAILED',
      `${label} ${objectId} ${detail}.`,
      { cause: value },
    );
  }
  return value;
}

function parseSoulStateObject(
  object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  expectedStateId: string,
  pin: SoulidityMainnetPin,
): CanonicalSoulState {
  const { soulStateType } = validatePin(pin);
  if (
    normalizeSuiAddress(object.objectId) !== expectedStateId ||
    object.type !== soulStateType ||
    object.owner.$kind !== 'Shared' ||
    !(object.content instanceof Uint8Array)
  ) {
    throw new SoulidityReadError(
      'INVALID_SOUL_STATE',
      `Object ${expectedStateId} is not the pinned shared ${soulStateType}.`,
    );
  }
  let decoded;
  try {
    decoded = SoulStateBcs.parse(object.content);
  } catch (error) {
    throw new SoulidityReadError(
      'INVALID_SOUL_STATE',
      `SoulState ${expectedStateId} has invalid canonical v1 BCS content.`,
      { cause: error },
    );
  }
  if (
    normalizeSuiAddress(decoded.id) !== expectedStateId ||
    BigInt(decoded.version) !== BigInt(pin.stateVersion)
  ) {
    throw new SoulidityReadError(
      'INVALID_SOUL_STATE',
      `SoulState ${expectedStateId} does not match its object ID and pinned state version.`,
    );
  }
  return {
    stateId: expectedStateId,
    soulId: normalizeSuiAddress(decoded.soul_id),
    version: BigInt(decoded.version),
    creator: normalizeSuiAddress(decoded.creator),
    creatorRoyaltyBps: decoded.creator_royalty_bps,
    currentOwner: normalizeSuiAddress(decoded.current_owner),
    currentKioskId: normalizeSuiAddress(decoded.current_kiosk_id),
    ownershipEpoch: BigInt(decoded.ownership_epoch),
    grantCapacity: BigInt(decoded.grant_capacity),
    activeGrantCount: BigInt(decoded.active_grant_count),
    contentId: decoded.content_id ? normalizeSuiAddress(decoded.content_id) : null,
    collectionId: decoded.collection_id ? normalizeSuiAddress(decoded.collection_id) : null,
    accessListId: decoded.access_list_id ? normalizeSuiAddress(decoded.access_list_id) : null,
    listed: decoded.is_listed,
    objectVersion: object.version,
    objectDigest: object.digest,
    previousTransaction: object.previousTransaction,
  };
}

function parseSoulObject(
  object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  state: CanonicalSoulState,
  pin: SoulidityMainnetPin,
): CanonicalSoul {
  const { originalPackageId } = validatePin(pin);
  const soulType = `${originalPackageId}::soul::Soul`;
  if (
    normalizeSuiAddress(object.objectId) !== state.soulId ||
    object.type !== soulType ||
    !(object.content instanceof Uint8Array)
  ) {
    throw new SoulidityReadError(
      'INVALID_SOUL',
      `Object ${state.soulId} is not the Soul bound by canonical SoulState ${state.stateId}.`,
    );
  }
  let decoded;
  try {
    decoded = SoulBcs.parse(object.content);
  } catch (error) {
    throw new SoulidityReadError(
      'INVALID_SOUL',
      `Soul ${state.soulId} has invalid canonical v1 BCS content.`,
      { cause: error },
    );
  }
  if (
    normalizeSuiAddress(decoded.id) !== state.soulId ||
    BigInt(decoded.version) !== BigInt(pin.stateVersion)
  ) {
    throw new SoulidityReadError(
      'INVALID_SOUL',
      `Soul ${state.soulId} does not match its object ID and pinned state version.`,
    );
  }
  return {
    soulId: state.soulId,
    stateId: state.stateId,
    name: decoded.name,
    description: decoded.description,
    imageUrl: decoded.image_url,
    provenanceKind: decoded.provenance_kind,
    originRef: decoded.origin_ref,
    creator: normalizeSuiAddress(decoded.creator),
    currentOwner: state.currentOwner,
    currentKioskId: state.currentKioskId,
    ownershipEpoch: state.ownershipEpoch,
    listed: state.listed,
    stateObjectVersion: state.objectVersion,
    stateObjectDigest: state.objectDigest,
    soulObjectVersion: object.version,
    soulObjectDigest: object.digest,
  };
}

async function getObjects(
  client: Pick<SuiGrpcClient, 'getObjects'>,
  objectIds: string[],
): Promise<(SuiClientTypes.Object<{ content: true; previousTransaction: true }> | Error)[]> {
  if (objectIds.length === 0) return [];
  try {
    const response = await client.getObjects({
      objectIds,
      include: { content: true, previousTransaction: true },
    });
    return response.objects;
  } catch (error) {
    throw new SoulidityReadError(
      'CHAIN_READ_FAILED',
      error instanceof Error ? error.message : 'Soulidity objects could not be read.',
      { cause: error },
    );
  }
}

export async function readCanonicalSoul(
  client: Pick<SuiGrpcClient, 'getObjects' | 'getChainIdentifier'>,
  pin: SoulidityMainnetPin,
  stateId: string,
): Promise<CanonicalSoul> {
  validatePin(pin);
  await assertPinnedChain(client, pin);
  const canonicalStateId = canonicalAddress(stateId, 'SoulState ID');
  const [stateValue] = await getObjects(client, [canonicalStateId]);
  const stateObject = requireObject(stateValue, canonicalStateId, 'SoulState');
  const state = parseSoulStateObject(stateObject, canonicalStateId, pin);
  const [soulValue] = await getObjects(client, [state.soulId]);
  const soulObject = requireObject(soulValue, state.soulId, 'Soul');
  return parseSoulObject(soulObject, state, pin);
}

export async function discoverCanonicalSoulsForOwner(
  client: SoulidityReadClient,
  pin: SoulidityMainnetPin,
  owner: string,
  options: SoulidityDiscoveryOptions = {},
): Promise<SoulidityDiscoveryResult> {
  const { callablePackageId, originalPackageId } = validatePin(pin);
  await assertPinnedChain(client, pin);
  const canonicalOwner = canonicalAddress(owner, 'Soul owner');
  const pageSize = Math.min(
    MAX_DISCOVERY_PAGE_SIZE,
    Math.max(1, options.pageSize ?? MAX_DISCOVERY_PAGE_SIZE),
  );
  const maxPages = Math.max(1, options.maxPages ?? 20);
  const eventType = `${originalPackageId}::soul::SoulCreated`;
  const allowedEmitters = new Set([originalPackageId, callablePackageId]);
  const stateIds = new Set<string>();
  let scannedEvents = 0;
  let cursor: string | null = null;
  let complete = false;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    let page;
    try {
      page = await client.listEvents({
        filter: { eventType },
        limit: pageSize,
        after: cursor,
        signal: options.signal,
      });
    } catch (error) {
      throw new SoulidityReadError(
        'CHAIN_READ_FAILED',
        error instanceof Error ? error.message : 'SoulCreated events could not be read.',
        { cause: error },
      );
    }
    scannedEvents += page.events.length;
    for (const event of page.events) {
      if (
        event.eventType !== eventType ||
        event.module !== 'soul' ||
        !allowedEmitters.has(normalizeSuiAddress(event.packageId))
      ) {
        throw new SoulidityReadError(
          'CHAIN_READ_FAILED',
          'Soul discovery returned an event outside the pinned Soulidity package and event type.',
        );
      }
      let decoded;
      try {
        decoded = SoulCreatedEventBcs.parse(event.bcs);
      } catch (error) {
        throw new SoulidityReadError(
          'CHAIN_READ_FAILED',
          'A canonical SoulCreated event has invalid BCS content.',
          { cause: error },
        );
      }
      stateIds.add(normalizeSuiAddress(decoded.state_id));
    }
    cursor = page.endCursor;
    if (!page.hasNextPage) {
      complete = true;
      break;
    }
    if (!cursor) {
      throw new SoulidityReadError(
        'CHAIN_READ_FAILED',
        'SoulCreated pagination reported another page without a continuation cursor.',
      );
    }
  }

  const states: CanonicalSoulState[] = [];
  const allStateIds = [...stateIds];
  for (let offset = 0; offset < allStateIds.length; offset += MAX_DISCOVERY_PAGE_SIZE) {
    const batch = allStateIds.slice(offset, offset + MAX_DISCOVERY_PAGE_SIZE);
    const values = await getObjects(client, batch);
    for (let index = 0; index < batch.length; index += 1) {
      const stateId = batch[index]!;
      const stateObject = requireObject(values[index], stateId, 'SoulState');
      const state = parseSoulStateObject(stateObject, stateId, pin);
      if (state.currentOwner === canonicalOwner && !state.listed) states.push(state);
    }
  }

  const soulValues = await getObjects(client, states.map((state) => state.soulId));
  const souls = states.map((state, index) => {
    const soulObject = requireObject(soulValues[index], state.soulId, 'Soul');
    return parseSoulObject(soulObject, state, pin);
  });
  souls.sort((left, right) => left.soulId.localeCompare(right.soulId));

  return {
    souls,
    complete,
    scannedEvents,
    discoveredStateIds: stateIds.size,
    nextCursor: complete ? null : cursor,
  };
}
