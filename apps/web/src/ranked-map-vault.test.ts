import { describe, expect, it } from 'vitest';
import {
  appendRankedPrivateLocations,
  createRankedPrivateMapRecord,
  round5WorldLocation,
  type RankedMapIdentity,
} from '@infinite-stellar/game-sdk';
import {
  EncryptedRankedMapVault,
  MemoryRankedMapVaultStore,
} from './ranked-map-vault';

const address = (value: string) => `0x${value.padStart(64, '0')}`;
const identity: RankedMapIdentity = {
  schemaVersion: 1,
  network: 'mainnet',
  chainIdentifier: '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S',
  packageId: address('10'),
  typeOriginPackageId: address('11'),
  seasonId: address('12'),
  planetRegistryId: address('13'),
  seatId: address('14'),
  controllerAddress: address('15'),
};

function record() {
  const world = round5WorldLocation({ x: 73, y: 6421 });
  if (!world) throw new Error('Pinned location is not a planet.');
  return appendRankedPrivateLocations(createRankedPrivateMapRecord(identity), [{
    locationId: world.locationId,
    x: world.x,
    y: world.y,
    perlin: world.perlin,
    biomebase: world.biomebase,
    discoveredAtMs: 100,
  }], 100);
}

describe('ranked map vault', () => {
  it('encrypts and restores the exact chain/Season/Seat namespace', async () => {
    const store = new MemoryRankedMapVaultStore();
    const vault = new EncryptedRankedMapVault(store, globalThis.crypto, 'memory-aes-gcm');
    await vault.save(record());
    await expect(vault.restore(identity)).resolves.toEqual(record());
    await expect(vault.restore({ ...identity, seatId: address('99') })).resolves.toBeNull();
  });

  it('rejects ciphertext substitution across controller namespaces', async () => {
    const store = new MemoryRankedMapVaultStore();
    const vault = new EncryptedRankedMapVault(store, globalThis.crypto, 'memory-aes-gcm');
    await vault.save(record());
    const originalNamespace = [
      'infinite-stellar:ranked-private-map:v1', identity.chainIdentifier, identity.packageId,
      identity.typeOriginPackageId, identity.seasonId, identity.planetRegistryId,
      identity.seatId, identity.controllerAddress,
    ].join(':');
    const otherIdentity = { ...identity, controllerAddress: address('88') };
    const otherNamespace = [
      'infinite-stellar:ranked-private-map:v1', otherIdentity.chainIdentifier, otherIdentity.packageId,
      otherIdentity.typeOriginPackageId, otherIdentity.seasonId, otherIdentity.planetRegistryId,
      otherIdentity.seatId, otherIdentity.controllerAddress,
    ].join(':');
    const encrypted = await store.getRecord(originalNamespace);
    const key = await store.getKey(originalNamespace);
    if (!encrypted || !key) throw new Error('Expected encrypted fixture.');
    await store.putRecord(otherNamespace, encrypted);
    await store.putKey(otherNamespace, key);
    await expect(vault.restore(otherIdentity)).rejects.toThrow(/could not be authenticated/);
  });

  it('serializes writes and clears both ciphertext and the namespace key', async () => {
    const store = new MemoryRankedMapVaultStore();
    const vault = new EncryptedRankedMapVault(store, globalThis.crypto, 'memory-aes-gcm');
    const first = record();
    const second = { ...first, updatedAtMs: 200 };
    await Promise.all([vault.save(first), vault.save(second)]);
    await expect(vault.restore(identity)).resolves.toEqual(second);
    await vault.clear(identity);
    await expect(vault.restore(identity)).resolves.toBeNull();
  });

  it('merges concurrent independent vault instances without rotating away the first key or dropping discoveries', async () => {
    const store = new MemoryRankedMapVaultStore();
    const firstTab = new EncryptedRankedMapVault(store, globalThis.crypto, 'memory-aes-gcm');
    const secondTab = new EncryptedRankedMapVault(store, globalThis.crypto, 'memory-aes-gcm');
    const first = record();
    const second = { ...first, locations: [{ ...first.locations[0]!, locationId: 'a'.repeat(64), x: 100 }], updatedAtMs: 200 };
    await Promise.all([firstTab.save(first), secondTab.save(second)]);
    await firstTab.save({ ...first, updatedAtMs: 50 });
    const restored = await secondTab.restore(identity);
    expect(restored?.locations).toHaveLength(2);
    expect(restored?.locations.map((location) => location.locationId)).toContain(first.locations[0]!.locationId);
    expect(restored?.updatedAtMs).toBe(200);
  });

  it('preserves existing secrets when a new write conflicts or existing ciphertext is corrupt', async () => {
    const store = new MemoryRankedMapVaultStore();
    const vault = new EncryptedRankedMapVault(store, globalThis.crypto, 'memory-aes-gcm');
    const first = record();
    await vault.save(first);
    await expect(vault.save({ ...first, locations: [{ ...first.locations[0]!, x: 0 }] })).rejects.toThrow(/conflicting/);
    await expect(vault.restore(identity)).resolves.toEqual(first);
    const { rankedPrivateMapStorageKey } = await import('@infinite-stellar/game-sdk');
    const namespace = rankedPrivateMapStorageKey(identity);
    const encrypted = (await store.getRecord(namespace))!;
    const badBytes = encrypted.ciphertext.slice(0);
    const view = new Uint8Array(badBytes);
    view[0] = view[0]! ^ 1;
    const corrupt = { ...encrypted, ciphertext: badBytes };
    await store.putRecord(namespace, corrupt);
    await expect(vault.save(first)).rejects.toThrow(/authenticated/);
    expect(await store.getRecord(namespace)).toBe(corrupt);
  });
});
