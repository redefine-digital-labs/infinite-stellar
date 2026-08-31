import { describe, expect, it } from 'vitest';
import {
  createInitialSession,
  loadPlayerSession,
  savePlayerSession,
  type KeyValueStorage,
} from '@infinite-stellar/game-sdk';
import { EncryptedSessionVault, MemorySessionVaultStore } from './session-vault';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('encrypted controller session vault', () => {
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
