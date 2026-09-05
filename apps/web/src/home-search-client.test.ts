import { describe, expect, it, vi, beforeEach } from 'vitest';
import { round5WorldLocation, type SearchSnapshot } from '@infinite-stellar/game-sdk';
import { startRound5Miner } from './miner-client';
import { startLocalHomeSearch } from './home-search-client';

vi.mock('./miner-client', () => ({ startRound5Miner: vi.fn() }));
const home = round5WorldLocation({x:73,y:6421})!;
const initial = (): SearchSnapshot => ({ attempt:0, progress:0, origin:{x:73,y:6421} });
beforeEach(() => vi.resetAllMocks());

describe('real home-search orchestration', () => {
  it('validates a finished footprint and reports actual work without a fake percentage', async () => {
    vi.mocked(startRound5Miner).mockImplementation((chunks, progress) => {
      const total = chunks.reduce((sum, chunk) => sum + chunk.side ** 2, 0);
      progress({ checked:256,total,found:0 });
      return {requestId:'home',cancel:vi.fn(),result:Promise.resolve({checked:total,total,found:1,locations:[home],elapsedMs:1})};
    });
    const progress = vi.fn();
    const checkpoint = vi.fn();
    const { home: found, search } = await startLocalHomeSearch(initial(), progress, checkpoint).result;
    expect(found.locationId).toBe(home.locationId);
    expect(search.checked).toBe(1024);
    expect(search.cursor).toBe(4);
    expect(search.chunks?.length).toBeGreaterThan(0);
    expect(progress).toHaveBeenCalledWith({checked:256,found:0});
    expect(checkpoint).toHaveBeenLastCalledWith(search);
  });

  it('reuses completed private search coverage after a reload', async () => {
    const saved = { ...initial(), checked:1024,cursor:4,
      chunks:[{x:64,y:6416,side:16}],locations:[home] };
    const result = await startLocalHomeSearch(saved, vi.fn(), vi.fn()).result;
    expect(result.home.locationId).toBe(home.locationId);
    expect(result.search.checked).toBe(1024);
    expect(startRound5Miner).not.toHaveBeenCalled();
  });

  it('cancels in-flight work without committing a partial footprint or a late home', async () => {
    let finish!: (value: Awaited<ReturnType<typeof startRound5Miner>['result']>) => void;
    const cancel = vi.fn();
    vi.mocked(startRound5Miner).mockReturnValue({requestId:'pending',cancel,
      result:new Promise(resolve => {finish=resolve;})});
    const checkpoint = vi.fn();
    const operation = startLocalHomeSearch(initial(),vi.fn(),checkpoint);
    await vi.waitFor(() => expect(startRound5Miner).toHaveBeenCalled());
    operation.cancel();
    finish({checked:1024,total:1024,found:1,locations:[home],elapsedMs:1});
    await expect(operation.result).rejects.toMatchObject({name:'AbortError'});
    expect(cancel).toHaveBeenCalledOnce();
    expect(checkpoint).toHaveBeenCalledTimes(1); // origin only, no completed chunk
    expect(checkpoint.mock.calls[0]![0].checked).toBe(0);
  });

  it('rejects incomplete batches and locations outside the requested footprint', async () => {
    for (const result of [
      {checked:1,total:1024,found:0,locations:[],elapsedMs:1},
      {checked:1024,total:1024,found:1,locations:[{...home,x:5000}],elapsedMs:1},
    ]) {
      vi.mocked(startRound5Miner).mockReturnValue({requestId:'invalid',cancel:vi.fn(),result:Promise.resolve(result)});
      await expect(startLocalHomeSearch(initial(),vi.fn(),vi.fn()).result).rejects.toThrow(/footprint/);
    }
  });
});
