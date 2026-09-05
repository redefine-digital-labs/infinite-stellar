import type { PlayerSession } from './types';
import { mergeExploredChunks, validateExplorationOrigin } from './exploration';
import { normalizeStrategyDiscovery } from './strategy';

export const SESSION_STORAGE_PREFIX = 'infinite-stellar:session:v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function playerSessionStorageKey(controllerAddress: string): string {
  return `${SESSION_STORAGE_PREFIX}:${controllerAddress.toLowerCase()}`;
}

export function parsePlayerSession(raw: string): PlayerSession | null {
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
    if (
      'strategy' in parsed &&
      parsed.strategy !== undefined &&
      (
        typeof parsed.strategy !== 'object' ||
        parsed.strategy === null ||
        !('schemaVersion' in parsed.strategy) ||
        parsed.strategy.schemaVersion !== 5 ||
        !('artifacts' in parsed.strategy) ||
        !Array.isArray(parsed.strategy.artifacts)
      )
    ) {
      return null;
    }
    const session = parsed as PlayerSession;
    if (session.strategy?.wallClockAtMs !== undefined &&
      (!Number.isSafeInteger(session.strategy.wallClockAtMs) || session.strategy.wallClockAtMs < 0)) return null;
    if (session.strategy?.exploredChunks !== undefined) {
      if (!Array.isArray(session.strategy.exploredChunks)) return null;
      session.strategy.exploredChunks = mergeExploredChunks(session.strategy.exploredChunks);
    }
    if (session.strategy?.explorationOrigin !== undefined) {
      session.strategy.explorationOrigin = validateExplorationOrigin(session.strategy.explorationOrigin);
    }
    if (session.mode === 'demo' && session.strategy) session.strategy = normalizeStrategyDiscovery(session.strategy);
    return session;
  } catch {
    return null;
  }
}

export function savePlayerSession(
  storage: KeyValueStorage,
  controllerAddress: string,
  session: PlayerSession,
): void {
  storage.setItem(playerSessionStorageKey(controllerAddress), JSON.stringify(session));
}

export function loadPlayerSession(
  storage: KeyValueStorage,
  controllerAddress: string,
): PlayerSession | null {
  const raw = storage.getItem(playerSessionStorageKey(controllerAddress));
  if (!raw) return null;
  return parsePlayerSession(raw);
}

export function clearPlayerSession(
  storage: KeyValueStorage,
  controllerAddress: string,
): void {
  storage.removeItem(playerSessionStorageKey(controllerAddress));
}
