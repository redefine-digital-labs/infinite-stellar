import { bcs } from '@mysten/sui/bcs';
import type { SuiClientTypes } from '@mysten/sui/client';
import { describe, expect, it, vi } from 'vitest';
import {
  discoverCanonicalSoulsForOwner,
  readCanonicalSoul,
  type SoulidityMainnetPin,
  type SoulidityReadClient,
} from '../src';

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;
const ORIGINAL_PACKAGE = id('a4');
const CALLABLE_PACKAGE = id('60');
const STATE_ID = id('11');
const SOUL_ID = id('12');
const OWNER = id('13');
const OTHER_OWNER = id('14');
const KIOSK_ID = id('15');
const DIGEST = '11111111111111111111111111111111';
const CHAIN = 'mainnet-chain-id';

const PIN: SoulidityMainnetPin = {
  network: 'mainnet',
  chainIdentifier: CHAIN,
  callablePackageId: CALLABLE_PACKAGE,
  originalPackageId: ORIGINAL_PACKAGE,
  soulStateType: `${ORIGINAL_PACKAGE}::soul::SoulState`,
  protocolVersion: 1,
  stateVersion: 1,
};

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

function stateObject(
  owner = OWNER,
  listed = false,
): SuiClientTypes.Object<{ content: true; previousTransaction: true }> {
  const table = { id: id('20'), size: 0 };
  return {
    objectId: STATE_ID,
    version: '9',
    digest: DIGEST,
    owner: { $kind: 'Shared', Shared: { initialSharedVersion: '1' } },
    type: PIN.soulStateType,
    content: SoulStateBcs.serialize({
      id: STATE_ID,
      version: 1,
      soul_id: SOUL_ID,
      creator: id('21'),
      creator_royalty_bps: 250,
      current_owner: owner,
      current_kiosk_id: KIOSK_ID,
      ownership_epoch: 7,
      grant_capacity: 64,
      active_grants: table,
      active_grant_ids: { ...table, id: id('22') },
      active_grant_count: 0,
      content_id: id('23'),
      config_ext: { ...table, id: id('24') },
      collection_id: null,
      access_list_id: null,
      is_listed: listed,
    }).toBytes(),
    previousTransaction: DIGEST,
    objectBcs: undefined,
    json: undefined,
    display: undefined,
  };
}

function soulObject(): SuiClientTypes.Object<{ content: true; previousTransaction: true }> {
  return {
    objectId: SOUL_ID,
    version: '4',
    digest: DIGEST,
    owner: { $kind: 'ObjectOwner', ObjectOwner: KIOSK_ID },
    type: `${ORIGINAL_PACKAGE}::soul::Soul`,
    content: SoulBcs.serialize({
      id: SOUL_ID,
      version: 1,
      name: 'Lyra Mainnet',
      description: 'Canonical fixture',
      image_url: 'https://example.invalid/lyra.png',
      provenance_kind: 1,
      origin_ref: null,
      creator: id('21'),
    }).toBytes(),
    previousTransaction: DIGEST,
    objectBcs: undefined,
    json: undefined,
    display: undefined,
  };
}

function createdEvent(): SuiClientTypes.EventEntry {
  return {
    packageId: CALLABLE_PACKAGE,
    module: 'soul',
    sender: id('21'),
    eventType: `${ORIGINAL_PACKAGE}::soul::SoulCreated`,
    bcs: SoulCreatedEventBcs.serialize({
      soul_id: SOUL_ID,
      state_id: STATE_ID,
      content_id: id('23'),
      creator: id('21'),
      owner: OWNER,
      provenance_kind: 1,
    }).toBytes(),
    json: null,
    checkpoint: '42',
    transactionDigest: DIGEST,
    eventIndex: 0,
  };
}

function client(
  state: SuiClientTypes.Object<{ content: true; previousTransaction: true }> = stateObject(),
  options: { hasNextPage?: boolean; chainIdentifier?: string } = {},
): SoulidityReadClient {
  return {
    getChainIdentifier: vi.fn(async () => ({
      chainIdentifier: options.chainIdentifier ?? CHAIN,
    })),
    listEvents: vi.fn(async () => ({
      events: [createdEvent()],
      hasNextPage: options.hasNextPage ?? false,
      startCursor: 'cursor-0',
      endCursor: 'cursor-1',
    })),
    getObjects: vi.fn(async ({ objectIds }) => ({
      objects: objectIds.map((objectId: string) => objectId === STATE_ID ? state : soulObject()),
    })),
  } as SoulidityReadClient;
}

describe('canonical Soulidity reader', () => {
  it('discovers shared SoulState through canonical events and validates live BCS ownership', async () => {
    const result = await discoverCanonicalSoulsForOwner(client(), PIN, OWNER);

    expect(result).toMatchObject({
      complete: true,
      scannedEvents: 1,
      discoveredStateIds: 1,
    });
    expect(result.souls).toEqual([
      expect.objectContaining({
        soulId: SOUL_ID,
        stateId: STATE_ID,
        name: 'Lyra Mainnet',
        currentOwner: OWNER,
        currentKioskId: KIOSK_ID,
        ownershipEpoch: 7n,
        listed: false,
      }),
    ]);
  });

  it('never treats the historical creation owner as current authority', async () => {
    const result = await discoverCanonicalSoulsForOwner(client(stateObject(OTHER_OWNER)), PIN, OWNER);
    expect(result.souls).toEqual([]);
  });

  it('excludes a currently listed Soul even when the connected address is current_owner', async () => {
    const result = await discoverCanonicalSoulsForOwner(client(stateObject(OWNER, true)), PIN, OWNER);
    expect(result.souls).toEqual([]);
  });

  it('reports bounded event replay as incomplete instead of claiming a complete empty set', async () => {
    const result = await discoverCanonicalSoulsForOwner(
      client(stateObject(), { hasNextPage: true }),
      PIN,
      OWNER,
      { maxPages: 1 },
    );
    expect(result.complete).toBe(false);
    expect(result.nextCursor).toBe('cursor-1');
  });

  it('reads a caller-supplied shared SoulState ID with the same canonical validation', async () => {
    await expect(readCanonicalSoul(client(), PIN, STATE_ID)).resolves.toEqual(
      expect.objectContaining({ stateId: STATE_ID, soulId: SOUL_ID, currentOwner: OWNER }),
    );
  });

  it('rejects the wrong chain before reading identity objects', async () => {
    await expect(discoverCanonicalSoulsForOwner(
      client(stateObject(), { chainIdentifier: 'testnet-chain' }),
      PIN,
      OWNER,
    )).rejects.toMatchObject({ code: 'WRONG_CHAIN' });
  });

  it('rejects a forged SoulState type even when its BCS bytes parse', async () => {
    await expect(readCanonicalSoul(client({
      ...stateObject(),
      type: `${id('ff')}::soul::SoulState`,
    }), PIN, STATE_ID)).rejects.toMatchObject({ code: 'INVALID_SOUL_STATE' });
  });
});
