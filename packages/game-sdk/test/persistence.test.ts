import { describe, expect, it } from 'vitest';
import {
  clearPlayerSession,
  createInitialSession,
  loadPlayerSession,
  savePlayerSession,
  type KeyValueStorage,
} from '../src';

class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe('player session persistence', () => {
  it('round-trips a versioned controller-scoped session', () => {
    const storage = new MemoryStorage();
    const session = createInitialSession();
    savePlayerSession(storage, '0xABC', session);
    expect(loadPlayerSession(storage, '0xabc')).toEqual(session);
    clearPlayerSession(storage, '0xabc');
    expect(loadPlayerSession(storage, '0xabc')).toBeNull();
  });

  it('rejects corrupt or unknown schemas', () => {
    const storage = new MemoryStorage();
    storage.setItem('infinite-stellar:session:v1:0xabc', '{broken');
    expect(loadPlayerSession(storage, '0xabc')).toBeNull();
    storage.setItem(
      'infinite-stellar:session:v1:0xabc',
      JSON.stringify({ schemaVersion: 99, stage: 'active' }),
    );
    expect(loadPlayerSession(storage, '0xabc')).toBeNull();
  });
});
