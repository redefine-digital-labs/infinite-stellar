import type { PlayerSession } from './types';

export const SESSION_STORAGE_PREFIX = 'infinite-stellar:session:v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storageKey(controllerAddress: string): string {
  return `${SESSION_STORAGE_PREFIX}:${controllerAddress.toLowerCase()}`;
}

export function savePlayerSession(
  storage: KeyValueStorage,
  controllerAddress: string,
  session: PlayerSession,
): void {
  storage.setItem(storageKey(controllerAddress), JSON.stringify(session));
}

export function loadPlayerSession(
  storage: KeyValueStorage,
  controllerAddress: string,
): PlayerSession | null {
  const raw = storage.getItem(storageKey(controllerAddress));
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('schemaVersion' in parsed) ||
      parsed.schemaVersion !== 1 ||
      !('stage' in parsed) ||
      typeof parsed.stage !== 'string'
    ) {
      return null;
    }
    return parsed as PlayerSession;
  } catch {
    return null;
  }
}

export function clearPlayerSession(
  storage: KeyValueStorage,
  controllerAddress: string,
): void {
  storage.removeItem(storageKey(controllerAddress));
}
