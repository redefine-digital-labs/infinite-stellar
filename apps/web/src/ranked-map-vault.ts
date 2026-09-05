import {
  appendRankedPrivateLocations,
  parseRankedPrivateMapRecord,
  rankedPrivateMapStorageKey,
  type RankedMapIdentity,
  type RankedPrivateMapRecord,
} from '@infinite-stellar/game-sdk';
import type { SessionVaultProtection } from './session-vault';

const DATABASE_NAME = 'infinite-stellar-ranked-map-vault';
const DATABASE_VERSION = 1;
const KEY_STORE = 'namespace-keys';
const MAP_STORE = 'ranked-maps';
const AAD_PREFIX = 'infinite-stellar:ranked-private-map-vault:v1';

export interface EncryptedRankedMapRecord {
  schemaVersion: 1;
  algorithm: 'AES-GCM';
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
  updatedAtMs: number;
}

export interface RankedMapVaultStore {
  withLock<T>(namespace: string, action: () => Promise<T>): Promise<T>;
  getKey(namespace: string): Promise<CryptoKey | undefined>;
  putKey(namespace: string, key: CryptoKey): Promise<void>;
  getRecord(namespace: string): Promise<EncryptedRankedMapRecord | undefined>;
  putRecord(namespace: string, record: EncryptedRankedMapRecord): Promise<void>;
  deleteNamespace(namespace: string): Promise<void>;
}

export interface RankedMapVault {
  protection: SessionVaultProtection;
  restore(identity: RankedMapIdentity): Promise<RankedPrivateMapRecord | null>;
  save(record: RankedPrivateMapRecord): Promise<void>;
  clear(identity: RankedMapIdentity): Promise<void>;
}

function utf8(value: string): Uint8Array<ArrayBuffer> {
  const source = new TextEncoder().encode(value);
  const bytes = new Uint8Array(new ArrayBuffer(source.byteLength));
  bytes.set(source);
  return bytes;
}

function associatedData(namespace: string): Uint8Array<ArrayBuffer> {
  return utf8(`${AAD_PREFIX}:${namespace}`);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')));
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')));
  });
}

export class IndexedDbRankedMapVaultStore implements RankedMapVaultStore {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(
    private readonly factory: IDBFactory,
    private readonly locks: LockManager | undefined = globalThis.navigator?.locks,
  ) {}

  async withLock<T>(namespace: string, action: () => Promise<T>): Promise<T> {
    if (!this.locks) throw new Error('This browser cannot safely coordinate ranked map saves across tabs. Use a browser with Web Locks support.');
    return this.locks.request(`${DATABASE_NAME}:${namespace}`, { mode: 'exclusive' }, action);
  }

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(KEY_STORE)) database.createObjectStore(KEY_STORE);
        if (!database.objectStoreNames.contains(MAP_STORE)) database.createObjectStore(MAP_STORE);
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Could not open the ranked map vault.')));
      request.addEventListener('blocked', () => reject(new Error('The ranked map vault is blocked by another tab.')));
    });
    return this.databasePromise;
  }

  async getKey(namespace: string): Promise<CryptoKey | undefined> {
    const database = await this.database();
    return requestResult(database.transaction(KEY_STORE, 'readonly').objectStore(KEY_STORE).get(namespace)) as
      Promise<CryptoKey | undefined>;
  }

  async putKey(namespace: string, key: CryptoKey): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(KEY_STORE, 'readwrite');
    transaction.objectStore(KEY_STORE).put(key, namespace);
    await transactionDone(transaction);
  }

  async getRecord(namespace: string): Promise<EncryptedRankedMapRecord | undefined> {
    const database = await this.database();
    return requestResult(database.transaction(MAP_STORE, 'readonly').objectStore(MAP_STORE).get(namespace)) as
      Promise<EncryptedRankedMapRecord | undefined>;
  }

  async putRecord(namespace: string, record: EncryptedRankedMapRecord): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(MAP_STORE, 'readwrite');
    transaction.objectStore(MAP_STORE).put(record, namespace);
    await transactionDone(transaction);
  }

  async deleteNamespace(namespace: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction([KEY_STORE, MAP_STORE], 'readwrite');
    transaction.objectStore(KEY_STORE).delete(namespace);
    transaction.objectStore(MAP_STORE).delete(namespace);
    await transactionDone(transaction);
  }
}

export class MemoryRankedMapVaultStore implements RankedMapVaultStore {
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly keys = new Map<string, CryptoKey>();
  private readonly records = new Map<string, EncryptedRankedMapRecord>();

  withLock<T>(namespace: string, action: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(namespace) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(action);
    this.locks.set(namespace, next);
    const cleanup = () => { if (this.locks.get(namespace) === next) this.locks.delete(namespace); };
    void next.then(cleanup, cleanup);
    return next;
  }

  async getKey(namespace: string) { return this.keys.get(namespace); }
  async putKey(namespace: string, key: CryptoKey) { this.keys.set(namespace, key); }
  async getRecord(namespace: string) { return this.records.get(namespace); }
  async putRecord(namespace: string, record: EncryptedRankedMapRecord) { this.records.set(namespace, record); }
  async deleteNamespace(namespace: string) {
    this.keys.delete(namespace);
    this.records.delete(namespace);
  }
}

export class EncryptedRankedMapVault implements RankedMapVault {
  constructor(
    private readonly store: RankedMapVaultStore,
    private readonly webCrypto: Crypto,
    readonly protection: SessionVaultProtection,
  ) {}

  private async key(namespace: string): Promise<CryptoKey> {
    const existing = await this.store.getKey(namespace);
    if (existing) return existing;
    const generated = await this.webCrypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    await this.store.putKey(namespace, generated);
    return generated;
  }

  async restore(identity: RankedMapIdentity): Promise<RankedPrivateMapRecord | null> {
    const namespace = rankedPrivateMapStorageKey(identity);
    return this.store.withLock(namespace, () => this.read(namespace));
  }

  private async read(namespace: string): Promise<RankedPrivateMapRecord | null> {
    const encrypted = await this.store.getRecord(namespace);
    if (!encrypted) return null;
    if (
      encrypted.schemaVersion !== 1 || encrypted.algorithm !== 'AES-GCM' ||
      encrypted.iv?.byteLength !== 12 || encrypted.ciphertext?.byteLength < 16
    ) {
      throw new Error('The encrypted ranked map uses an unsupported schema.');
    }
    const key = await this.store.getKey(namespace);
    if (!key) throw new Error('The encrypted ranked map exists, but its device key is missing.');
    let plaintext: ArrayBuffer;
    try {
      plaintext = await this.webCrypto.subtle.decrypt({
        name: 'AES-GCM',
        iv: encrypted.iv,
        additionalData: associatedData(namespace),
      }, key, encrypted.ciphertext);
    } catch {
      throw new Error('The encrypted ranked map could not be authenticated on this device.');
    }
    const record = parseRankedPrivateMapRecord(new TextDecoder().decode(plaintext));
    if (!record || rankedPrivateMapStorageKey(record) !== namespace) {
      throw new Error('The decrypted ranked map failed its chain and Seat namespace validation.');
    }
    return record;
  }

  save(record: RankedPrivateMapRecord): Promise<void> {
    const parsed = parseRankedPrivateMapRecord(JSON.stringify(record));
    if (!parsed) return Promise.reject(new Error('The ranked map failed schema validation before encryption.'));
    const namespace = rankedPrivateMapStorageKey(parsed);
    return this.store.withLock(namespace, async () => {
      // A late Worker or another tab may hold an older snapshot. Preserve every
      // existing discovery; reject conflicting preimages before touching disk.
      const existing = await this.read(namespace);
      const merged = existing ? appendRankedPrivateLocations(
        existing, parsed.locations, Math.max(existing.updatedAtMs, parsed.updatedAtMs),
      ) : parsed;
      const key = await this.key(namespace);
      const iv = this.webCrypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
      const ciphertext = await this.webCrypto.subtle.encrypt({
        name: 'AES-GCM',
        iv,
        additionalData: associatedData(namespace),
      }, key, utf8(JSON.stringify(merged)));
      await this.store.putRecord(namespace, {
        schemaVersion: 1,
        algorithm: 'AES-GCM',
        iv,
        ciphertext,
        updatedAtMs: merged.updatedAtMs,
      });
    });
  }

  clear(identity: RankedMapIdentity): Promise<void> {
    const namespace = rankedPrivateMapStorageKey(identity);
    return this.store.withLock(namespace, () => this.store.deleteNamespace(namespace));
  }
}

class UnavailableRankedMapVault implements RankedMapVault {
  readonly protection = 'unavailable' as const;
  async restore() { return null; }
  async save() { throw new Error('Web Crypto is unavailable; ranked map persistence is disabled.'); }
  async clear() { return undefined; }
}

let defaultVault: RankedMapVault | undefined;

export function browserRankedMapVault(): RankedMapVault {
  if (defaultVault) return defaultVault;
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) return new UnavailableRankedMapVault();
  if (globalThis.indexedDB) {
    defaultVault = new EncryptedRankedMapVault(
      new IndexedDbRankedMapVaultStore(globalThis.indexedDB),
      webCrypto,
      'indexeddb-aes-gcm',
    );
  } else {
    defaultVault = new EncryptedRankedMapVault(
      new MemoryRankedMapVaultStore(),
      webCrypto,
      'memory-aes-gcm',
    );
  }
  return defaultVault;
}
