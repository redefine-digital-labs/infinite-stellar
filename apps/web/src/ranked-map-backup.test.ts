import { beforeAll, describe, expect, it } from 'vitest';
import { appendRankedPrivateLocations, createRankedPrivateMapRecord, round5WorldLocation,
  type RankedMapIdentity } from '@infinite-stellar/game-sdk';
import { decryptRankedMapBackup, encryptRankedMapBackup, RANKED_BACKUP_MAX_BYTES } from './ranked-map-backup';

const id = (value: string) => `0x${value.padStart(64, '0')}`;
const identity: RankedMapIdentity = {
  schemaVersion: 1, network: 'mainnet', chainIdentifier: '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S',
  packageId: id('10'), typeOriginPackageId: id('11'), seasonId: id('12'), planetRegistryId: id('13'),
  seatId: id('14'), controllerAddress: id('15'),
};
const passphrase = 'test-only orchard glacier lantern';
const world = round5WorldLocation({ x: 73, y: 6421 })!;
const record = { ...appendRankedPrivateLocations(createRankedPrivateMapRecord(identity), [{
  x: world.x, y: world.y, locationId: world.locationId, perlin: world.perlin,
  biomebase: world.biomebase, discoveredAtMs: 100,
}], 100), exploredChunks: [{ x: 64, y: 6416, side: 16 }], explorationOrigin: { x: 73, y: 6421 } };
let encrypted: string;
beforeAll(async () => { encrypted = await encryptRankedMapBackup(record, passphrase); });

describe('portable private map authentication', () => {
  it('round-trips private coverage and coordinates without exposing them in the envelope', async () => {
    const result = await decryptRankedMapBackup(encrypted, passphrase, identity);
    expect(result.locations[0]).toMatchObject({ locationId: world.locationId, x: 73, y: 6421 });
    expect(result.exploredChunks).toEqual(record.exploredChunks);
    expect(result.explorationOrigin).toEqual(record.explorationOrigin);
    expect(encrypted).not.toContain(world.locationId);
    expect(encrypted).not.toContain(identity.controllerAddress);
    expect(encrypted).not.toContain('"x"');
    expect(encrypted).not.toContain(passphrase);
  });

  it('uses fresh salt and IV on every export and excludes client ownership/resource fields', async () => {
    const other = await encryptRankedMapBackup({ ...record, owner: 'player', energy: 999999 } as typeof record, passphrase);
    const firstEnvelope = JSON.parse(encrypted);
    const otherEnvelope = JSON.parse(other);
    expect(otherEnvelope.kdf.salt).not.toBe(firstEnvelope.kdf.salt);
    expect(otherEnvelope.cipher.iv).not.toBe(firstEnvelope.cipher.iv);
    expect(otherEnvelope.ciphertext).not.toBe(firstEnvelope.ciphertext);
    const restored = await decryptRankedMapBackup(other, passphrase, identity);
    expect(restored).not.toHaveProperty('owner');
    expect(restored).not.toHaveProperty('energy');
  });

  it('rejects a wrong passphrase and modified authenticated ciphertext', async () => {
    await expect(decryptRankedMapBackup(encrypted, 'test-only incorrect backup password', identity)).rejects.toThrow(/authentication failed/);
    const modified = JSON.parse(encrypted);
    modified.ciphertext = `${modified.ciphertext[0] === 'A' ? 'B' : 'A'}${modified.ciphertext.slice(1)}`;
    await expect(decryptRankedMapBackup(JSON.stringify(modified), passphrase, identity)).rejects.toThrow(/authentication failed/);
  });

  it.each(['packageId', 'typeOriginPackageId', 'seasonId', 'planetRegistryId', 'seatId', 'controllerAddress'] as const)(
    'binds authentication to the expected %s', async (field) => {
    await expect(decryptRankedMapBackup(encrypted, passphrase, { ...identity, [field]: id('99') })).rejects.toThrow(/authentication failed/);
  });

  it('rejects a different chain even with the same address and package', async () => {
    await expect(decryptRankedMapBackup(encrypted, passphrase, { ...identity, chainIdentifier: 'z'.repeat(44) })).rejects.toThrow(/authentication failed/);
  });

  it.each(['version', 'iterations', 'hash', 'cipher', 'salt', 'iv', 'encoding'] as const)(
    'rejects malformed %s before expensive derivation', async (field) => {
    const value = JSON.parse(encrypted);
    if (field === 'version') value.version = 2;
    if (field === 'iterations') value.kdf.iterations = 1;
    if (field === 'hash') value.kdf.hash = 'SHA-1';
    if (field === 'cipher') value.cipher.tagBits = 32;
    if (field === 'salt') value.kdf.salt = btoa('short');
    if (field === 'iv') value.cipher.iv = btoa('short');
    if (field === 'encoding') value.ciphertext = '!!!!';
    await expect(decryptRankedMapBackup(JSON.stringify(value), passphrase, identity,
      { subtle: undefined } as unknown as Crypto)).rejects.toThrow(/supported|malformed|encoded/);
  });

  it('bounds files, passphrases and malformed records before encryption', async () => {
    await expect(decryptRankedMapBackup(' '.repeat(RANKED_BACKUP_MAX_BYTES + 1), passphrase, identity)).rejects.toThrow(/too large/);
    await expect(decryptRankedMapBackup('not-json', passphrase, identity)).rejects.toThrow(/valid/);
    await expect(encryptRankedMapBackup(record, 'short')).rejects.toThrow(/16/);
    await expect(encryptRankedMapBackup(record, 'a'.repeat(1025))).rejects.toThrow(/1024/);
    await expect(encryptRankedMapBackup({ ...record, exploredChunks: [{ x: 1, y: 0, side: 16 }] }, passphrase)).rejects.toThrow(/malformed/);
  });
});
