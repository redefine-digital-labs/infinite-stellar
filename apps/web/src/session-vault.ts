import {
  clearPlayerSession,
  loadPlayerSession,
  parsePlayerSession,
  type KeyValueStorage,
  type PlayerSession,
} from '@infinite-stellar/game-sdk';
import { LOCAL_DEMO_RELEASE } from './local-demo-release';

const VAULT_DATABASE = 'infinite-stellar-private-vault';
const VAULT_DATABASE_VERSION = 1;
const KEY_STORE = 'controller-keys';
const SESSION_STORE = 'sessions';
const AAD_PREFIX = 'infinite-stellar:session-vault:v1';

export type SessionVaultProtection = 'indexeddb-aes-gcm' | 'memory-aes-gcm' | 'unavailable';

export interface EncryptedSessionRecord {
  schemaVersion: 1;
  algorithm: 'AES-GCM';
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
  updatedAt: number;
}

export interface SessionVaultStore {
  getKey(controllerAddress: string): Promise<CryptoKey | undefined>;
  putKey(controllerAddress: string, key: CryptoKey): Promise<void>;
  getRecord(controllerAddress: string): Promise<EncryptedSessionRecord | undefined>;
  putRecord(controllerAddress: string, record: EncryptedSessionRecord): Promise<void>;
  deleteController(controllerAddress: string): Promise<void>;
}

export interface SessionVault {
  protection: SessionVaultProtection;
  restore(controllerAddress: string, legacyStorage?: KeyValueStorage): Promise<PlayerSession | null>;
  save(controllerAddress: string, session: PlayerSession): Promise<void>;
  clear(controllerAddress: string, legacyStorage?: KeyValueStorage): Promise<void>;
}

function normalizeAddress(controllerAddress: string): string {
  return controllerAddress.toLowerCase();
}

function utf8(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const bytes = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  bytes.set(encoded);
  return bytes;
}

function associatedData(controllerAddress: string): Uint8Array<ArrayBuffer> {
  return utf8(`${AAD_PREFIX}:${normalizeAddress(controllerAddress)}`);
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

export class IndexedDbSessionVaultStore implements SessionVaultStore {
  private databasePromise?: Promise<IDBDatabase>;

  constructor(private readonly factory: IDBFactory) {}

  private database(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.factory.open(VAULT_DATABASE, VAULT_DATABASE_VERSION);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(KEY_STORE)) database.createObjectStore(KEY_STORE);
        if (!database.objectStoreNames.contains(SESSION_STORE)) database.createObjectStore(SESSION_STORE);
      });
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error ?? new Error('Could not open the private vault.')));
      request.addEventListener('blocked', () => reject(new Error('The private vault upgrade is blocked by another tab.')));
    });
    return this.databasePromise;
  }

  async getKey(controllerAddress: string): Promise<CryptoKey | undefined> {
    const database = await this.database();
    const transaction = database.transaction(KEY_STORE, 'readonly');
    return requestResult(transaction.objectStore(KEY_STORE).get(normalizeAddress(controllerAddress))) as Promise<CryptoKey | undefined>;
  }

  async putKey(controllerAddress: string, key: CryptoKey): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(KEY_STORE, 'readwrite');
    transaction.objectStore(KEY_STORE).put(key, normalizeAddress(controllerAddress));
    await transactionDone(transaction);
  }

  async getRecord(controllerAddress: string): Promise<EncryptedSessionRecord | undefined> {
    const database = await this.database();
    const transaction = database.transaction(SESSION_STORE, 'readonly');
    return requestResult(transaction.objectStore(SESSION_STORE).get(normalizeAddress(controllerAddress))) as
      Promise<EncryptedSessionRecord | undefined>;
  }

  async putRecord(controllerAddress: string, record: EncryptedSessionRecord): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction(SESSION_STORE, 'readwrite');
    transaction.objectStore(SESSION_STORE).put(record, normalizeAddress(controllerAddress));
    await transactionDone(transaction);
  }

  async deleteController(controllerAddress: string): Promise<void> {
    const database = await this.database();
    const transaction = database.transaction([KEY_STORE, SESSION_STORE], 'readwrite');
    const key = normalizeAddress(controllerAddress);
    transaction.objectStore(KEY_STORE).delete(key);
    transaction.objectStore(SESSION_STORE).delete(key);
    await transactionDone(transaction);
  }
}

export class MemorySessionVaultStore implements SessionVaultStore {
  private readonly keys = new Map<string, CryptoKey>();
  private readonly records = new Map<string, EncryptedSessionRecord>();

  async getKey(controllerAddress: string) { return this.keys.get(normalizeAddress(controllerAddress)); }
  async putKey(controllerAddress: string, key: CryptoKey) { this.keys.set(normalizeAddress(controllerAddress), key); }
  async getRecord(controllerAddress: string) { return this.records.get(normalizeAddress(controllerAddress)); }
  async putRecord(controllerAddress: string, record: EncryptedSessionRecord) {
    this.records.set(normalizeAddress(controllerAddress), record);
  }
  async deleteController(controllerAddress: string) {
    const key = normalizeAddress(controllerAddress);
    this.keys.delete(key);
    this.records.delete(key);
  }
}

export class EncryptedSessionVault implements SessionVault {
  private readonly writes = new Map<string, Promise<void>>();

  constructor(
    private readonly store: SessionVaultStore,
    private readonly webCrypto: Crypto,
    readonly protection: SessionVaultProtection,
  ) {}

  private async key(controllerAddress: string): Promise<CryptoKey> {
    const existing = await this.store.getKey(controllerAddress);
    if (existing) return existing;
    const generated = await this.webCrypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    await this.store.putKey(controllerAddress, generated);
    return generated;
  }

  private enqueue(controllerAddress: string, action: () => Promise<void>): Promise<void> {
    const address = normalizeAddress(controllerAddress);
    const previous = this.writes.get(address) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(action);
    this.writes.set(address, next);
    const cleanup = () => {
      if (this.writes.get(address) === next) this.writes.delete(address);
    };
    void next.then(cleanup, cleanup);
    return next;
  }

  async restore(controllerAddress: string, legacyStorage?: KeyValueStorage): Promise<PlayerSession | null> {
    await (this.writes.get(normalizeAddress(controllerAddress)) ?? Promise.resolve());
    const record = await this.store.getRecord(controllerAddress);
    if (record) {
      if (record.schemaVersion !== 1 || record.algorithm !== 'AES-GCM') {
        throw new Error('The private vault uses an unsupported schema.');
      }
      const key = await this.store.getKey(controllerAddress);
      if (!key) throw new Error('The encrypted session exists, but its device key is missing.');
      let plaintext: ArrayBuffer;
      try {
        plaintext = await this.webCrypto.subtle.decrypt({
          name: 'AES-GCM',
          iv: record.iv,
          additionalData: associatedData(controllerAddress),
        }, key, record.ciphertext);
      } catch {
        throw new Error('The encrypted session could not be authenticated on this device.');
      }
      const session = parsePlayerSession(new TextDecoder().decode(plaintext));
      if (!session) throw new Error('The decrypted session failed schema validation.');
      return session;
    }

    if (!legacyStorage) return null;
    const legacy = loadPlayerSession(legacyStorage, controllerAddress);
    if (!legacy) return null;
    await this.save(controllerAddress, legacy);
    clearPlayerSession(legacyStorage, controllerAddress);
    return legacy;
  }

  save(controllerAddress: string, session: PlayerSession): Promise<void> {
    return this.enqueue(controllerAddress, async () => {
      const key = await this.key(controllerAddress);
      const iv = this.webCrypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
      const ciphertext = await this.webCrypto.subtle.encrypt({
        name: 'AES-GCM',
        iv,
        additionalData: associatedData(controllerAddress),
      }, key, utf8(JSON.stringify(session)));
      await this.store.putRecord(controllerAddress, {
        schemaVersion: 1,
        algorithm: 'AES-GCM',
        iv,
        ciphertext,
        updatedAt: Date.now(),
      });
    });
  }

  clear(controllerAddress: string, legacyStorage?: KeyValueStorage): Promise<void> {
    if (legacyStorage) clearPlayerSession(legacyStorage, controllerAddress);
    return this.enqueue(controllerAddress, () => this.store.deleteController(controllerAddress));
  }
}

class UnavailableSessionVault implements SessionVault {
  readonly protection = 'unavailable' as const;
  async restore(_controllerAddress: string, legacyStorage?: KeyValueStorage) {
    return legacyStorage ? null : null;
  }
  async save() { throw new Error('Web Crypto is unavailable; private session persistence is disabled.'); }
  async clear(controllerAddress: string, legacyStorage?: KeyValueStorage) {
    if (legacyStorage) clearPlayerSession(legacyStorage, controllerAddress);
  }
}

let defaultVault: SessionVault | undefined;

/** A deployment starts a fresh playtest without touching wallet, Soul, or ranked map storage. */
export function scopeLocalDemoVault(vault: SessionVault, release: string): SessionVault {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(release)) throw new Error('Invalid local playtest release identifier.');
  const key = (controller: string) => `local-demo:${release}:${controller}`;
  return {
    protection: vault.protection,
    // Do not import old address-only or previous-release saves into a new deployment.
    restore: controller => vault.restore(key(controller)),
    save: (controller, session) => vault.save(key(controller), session),
    clear: controller => vault.clear(key(controller)),
  };
}

export function browserSessionVault(): SessionVault {
  if (defaultVault) return defaultVault;
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle) {
    return new UnavailableSessionVault();
  } else if (globalThis.indexedDB) {
    defaultVault = scopeLocalDemoVault(new EncryptedSessionVault(
      new IndexedDbSessionVaultStore(globalThis.indexedDB),
      webCrypto,
      'indexeddb-aes-gcm',
    ), LOCAL_DEMO_RELEASE);
    return defaultVault;
  } else {
    return scopeLocalDemoVault(new EncryptedSessionVault(
      new MemorySessionVaultStore(),
      webCrypto,
      'memory-aes-gcm',
    ), LOCAL_DEMO_RELEASE);
  }
}
