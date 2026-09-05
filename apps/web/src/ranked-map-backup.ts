import {
  parseRankedPrivateMapRecord, rankedPrivateMapStorageKey,
  type RankedMapIdentity, type RankedPrivateMapRecord,
} from '@infinite-stellar/game-sdk';

// Format v1 is intentionally fixed: untrusted files cannot select a weaker KDF
// or force arbitrarily expensive work. This is not an independent security audit.
export const RANKED_BACKUP_MAX_BYTES = 6 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 4 * 1024 * 1024;
const ITERATIONS = 600_000;
const FORMAT = 'infinite-stellar-private-map';
const AAD = 'infinite-stellar:portable-ranked-map:v1:PBKDF2-SHA256-600000:AES256-GCM128';

interface BackupEnvelope {
  format: typeof FORMAT;
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: typeof ITERATIONS; salt: string };
  cipher: { name: 'AES-GCM'; keyBits: 256; tagBits: 128; iv: string };
  ciphertext: string;
}

function utf8(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(value));
}

function encode(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return btoa(chunks.join(''));
}

function decode(value: unknown, maximum: number): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || value.length > Math.ceil(maximum / 3) * 4 ||
      value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new Error('The backup contains malformed or oversized encoded data.');
  }
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  if (bytes.byteLength > maximum || encode(bytes) !== value) throw new Error('The backup encoding is not canonical.');
  return bytes;
}

function passphraseBytes(passphrase: string): Uint8Array<ArrayBuffer> {
  if (passphrase.length > 1024 || Array.from(passphrase).length < 16) {
    throw new Error('Use a backup passphrase of 16–1024 characters. Several random words are recommended; never use your wallet recovery phrase.');
  }
  return utf8(passphrase);
}

async function key(webCrypto: Crypto, passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  if (!webCrypto?.subtle) throw new Error('Web Crypto is required for encrypted map backups.');
  const bytes = passphraseBytes(passphrase);
  try {
    const material = await webCrypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
    return await webCrypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
      material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } finally {
    bytes.fill(0);
  }
}

function associatedData(identity: RankedMapIdentity): Uint8Array<ArrayBuffer> {
  return utf8(`${AAD}:${rankedPrivateMapStorageKey(identity)}`);
}

export async function encryptRankedMapBackup(
  record: RankedPrivateMapRecord, passphrase: string, webCrypto: Crypto = globalThis.crypto,
): Promise<string> {
  if (!webCrypto?.subtle) throw new Error('Web Crypto is required for encrypted map backups.');
  const parsed = parseRankedPrivateMapRecord(JSON.stringify(record));
  if (!parsed) throw new Error('The private map is malformed and cannot be backed up.');
  const plaintext = utf8(JSON.stringify(parsed));
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error('The private map exceeds this backup format’s size limit.');
  const salt = webCrypto.getRandomValues(new Uint8Array(32));
  const iv = webCrypto.getRandomValues(new Uint8Array(12));
  try {
    const derived = await key(webCrypto, passphrase, salt);
    const ciphertext = await webCrypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128,
      additionalData: associatedData(parsed) }, derived, plaintext);
    const envelope: BackupEnvelope = {
      format: FORMAT, version: 1,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: encode(salt) },
      cipher: { name: 'AES-GCM', keyBits: 256, tagBits: 128, iv: encode(iv) },
      ciphertext: encode(new Uint8Array(ciphertext)),
    };
    return JSON.stringify(envelope);
  } finally {
    plaintext.fill(0);
  }
}

export async function decryptRankedMapBackup(
  raw: string, passphrase: string, expectedIdentity: RankedMapIdentity, webCrypto: Crypto = globalThis.crypto,
): Promise<RankedPrivateMapRecord> {
  if (raw.length > RANKED_BACKUP_MAX_BYTES) throw new Error('This backup file is too large.');
  let value: Partial<BackupEnvelope>;
  try { value = JSON.parse(raw) as Partial<BackupEnvelope>; }
  catch { throw new Error('This is not a valid encrypted map backup.'); }
  if (!value || value.format !== FORMAT || value.version !== 1 ||
      value.kdf?.name !== 'PBKDF2' || value.kdf.hash !== 'SHA-256' || value.kdf.iterations !== ITERATIONS ||
      value.cipher?.name !== 'AES-GCM' || value.cipher.keyBits !== 256 || value.cipher.tagBits !== 128) {
    throw new Error('The backup format or cryptographic parameters are not supported.');
  }
  const salt = decode(value.kdf.salt, 32);
  const iv = decode(value.cipher.iv, 12);
  const ciphertext = decode(value.ciphertext, MAX_PLAINTEXT_BYTES + 16);
  if (salt.length !== 32 || iv.length !== 12 || ciphertext.length < 16) throw new Error('The backup encryption fields are malformed.');
  const aad = associatedData(expectedIdentity);
  const derived = await key(webCrypto, passphrase, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await webCrypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128, additionalData: aad }, derived, ciphertext);
  } catch {
    throw new Error('Backup authentication failed. Check the passphrase and the connected controller, chain and Season. The file may also be damaged.');
  }
  try {
    const parsed = parseRankedPrivateMapRecord(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    if (!parsed || rankedPrivateMapStorageKey(parsed) !== rankedPrivateMapStorageKey(expectedIdentity)) {
      throw new Error('The decrypted backup does not match this chain, Season and controller Seat.');
    }
    return parsed;
  } finally {
    new Uint8Array(plaintext).fill(0);
  }
}
