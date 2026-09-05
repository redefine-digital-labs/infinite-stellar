import { describe, expect, it } from 'vitest';
import {
  createInitialSession,
  loadPlayerSession,
  savePlayerSession,
  type KeyValueStorage,
} from '@infinite-stellar/game-sdk';
import { EncryptedSessionVault, MemorySessionVaultStore, scopeLocalDemoVault } from './session-vault';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('encrypted controller session vault', () => {
  it('starts fresh on a new deployment while same-release reloads resume', async () => {
    const raw = new EncryptedSessionVault(new MemorySessionVaultStore(), globalThis.crypto, 'memory-aes-gcm');
    const first = scopeLocalDemoVault(raw, 'release-one');
    const second = scopeLocalDemoVault(raw, 'release-two');
    const session = { ...createInitialSession(), notice: 'existing local game' };
    await first.save('0xabc', session);
    expect(await scopeLocalDemoVault(raw, 'release-one').restore('0xABC')).toEqual(session);
    expect(await second.restore('0xabc')).toBeNull();
    const newGame = { ...session, notice: 'new local game' };
    await second.save('0xabc', newGame);
    expect(await second.restore('0xabc')).toEqual(newGame);
    expect(await first.restore('0xabc')).toEqual(session);
  });

  it('does not migrate old address-only saves or delete unrelated data', async () => {
    const store = new MemorySessionVaultStore();
    const raw = new EncryptedSessionVault(store, globalThis.crypto, 'memory-aes-gcm');
    const session = createInitialSession();
    const legacy = new MemoryStorage();
    await raw.save('0xabc', session);
    savePlayerSession(legacy, '0xabc', session);
    const current = scopeLocalDemoVault(raw, 'current');
    expect(await current.restore('0xabc', legacy)).toBeNull();
    await current.save('0xabc', session);
    await current.clear('0xabc', legacy);
    expect(await current.restore('0xabc')).toBeNull();
    expect(await raw.restore('0xabc')).toEqual(session);
    expect(loadPlayerSession(legacy, '0xabc')).toEqual(session);
  });

  it('round-trips authenticated ciphertext without storing session JSON', async () => {
    const store = new MemorySessionVaultStore();
    const vault = new EncryptedSessionVault(store, globalThis.crypto, 'memory-aes-gcm');
    const session = createInitialSession();
    await vault.save('0xABC', session);

    const record = await store.getRecord('0xabc');
    expect(record).toBeDefined();
    expect(new TextDecoder().decode(record?.ciphertext)).not.toContain('welcome');
    expect(await vault.restore('0xabc')).toEqual(session);
  });

  it('binds ciphertext authentication to the normalized controller address', async () => {
    const store = new MemorySessionVaultStore();
    const vault = new EncryptedSessionVault(store, globalThis.crypto, 'memory-aes-gcm');
    await vault.save('0xabc', createInitialSession());
    const key = await store.getKey('0xabc');
    const record = await store.getRecord('0xabc');
    await store.putKey('0xdef', key!);
    await store.putRecord('0xdef', record!);
    await expect(vault.restore('0xdef')).rejects.toThrow(/authenticated/i);
  });

  it('migrates a valid legacy localStorage session once and removes plaintext', async () => {
    const legacy = new MemoryStorage();
    const session = createInitialSession();
    savePlayerSession(legacy, '0xabc', session);
    const vault = new EncryptedSessionVault(
      new MemorySessionVaultStore(),
      globalThis.crypto,
      'memory-aes-gcm',
    );

    expect(await vault.restore('0xabc', legacy)).toEqual(session);
    expect(loadPlayerSession(legacy, '0xabc')).toBeNull();
    expect(await vault.restore('0xabc')).toEqual(session);
  });
});
