import {
  chooseHomeSearchOrigin, isRound5HomeLocation, LOCAL_WORLD_RADIUS, locationInChunks,
  mergeExploredChunks, nextExplorationBatch,
  type MinedRound5Location, type SearchSnapshot,
} from '@infinite-stellar/game-sdk';
import { startRound5Miner, type MinerOperation } from './miner-client';

export interface HomeSearchProgress { checked: number; found: number }
export interface HomeSearchOperation {
  result: Promise<{ home: MinedRound5Location; search: SearchSnapshot }>;
  cancel: () => void;
}

function secureRandom(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

/** Cancellable, resumable real MiMC search. All coordinates stay in the browser. */
export function startLocalHomeSearch(
  initial: SearchSnapshot,
  onProgress: (progress: HomeSearchProgress) => void,
  onCheckpoint: (search: SearchSnapshot) => void,
): HomeSearchOperation {
  let cancelled = false;
  let worker: MinerOperation | undefined;
  const checkCancelled = () => {
    if (cancelled) throw new DOMException('Home search paused.', 'AbortError');
  };
  const result = (async () => {
    // Defer expensive work one event turn so the search controls are visible.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    checkCancelled();
    let search: SearchSnapshot = {
      ...initial, candidate: undefined,
      origin: initial.origin ?? chooseHomeSearchOrigin(secureRandom),
      cursor: initial.cursor ?? 0, checked: initial.checked ?? 0,
      chunks: initial.chunks ?? [], locations: initial.locations ?? [],
    };
    onCheckpoint(search);
    while (true) {
      checkCancelled();
      const resumedHome = search.locations!.find(isRound5HomeLocation);
      if (resumedHome) return { home: resumedHome, search };
      const next = nextExplorationBatch(search.origin!, LOCAL_WORLD_RADIUS, search.chunks!, search.cursor!);
      if (!next.chunks.length) {
        if (next.exhausted) throw new Error('No eligible home found in this search. Choose a new search region.');
        search = { ...search, cursor: next.cursor };
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        continue;
      }
      const completedBeforeBatch = search.checked!;
      worker = startRound5Miner(next.chunks, progress => {
        if (!cancelled) onProgress({ checked: completedBeforeBatch + progress.checked,
          found: search.locations!.length + progress.found });
      });
      const mined = await worker.result;
      worker = undefined;
      checkCancelled();
      const expected = next.chunks.reduce((sum, chunk) => sum + chunk.side ** 2, 0);
      if (mined.checked !== expected || mined.total !== expected ||
          mined.locations.some(location => !locationInChunks(location, next.chunks))) {
        throw new Error('The home miner did not complete the requested search footprint.');
      }
      search = { ...search, cursor: next.cursor,
        checked: completedBeforeBatch + expected,
        chunks: mergeExploredChunks(search.chunks!, next.chunks),
        locations: [...search.locations!, ...mined.locations],
      };
      onCheckpoint(search);
      onProgress({ checked: search.checked!, found: search.locations!.length });
    }
  })();
  return { result, cancel: () => { cancelled = true; worker?.cancel(); } };
}
