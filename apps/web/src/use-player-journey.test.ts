import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialSession, DEMO_CONTROLLER, enterDemo, selectSoul, round5WorldLocation, type PlayerSession } from '@infinite-stellar/game-sdk';
import { enterLocalUniverse } from './demo-entry';
import { usePlayerJourney } from './use-player-journey';
import { startLocalHomeSearch } from './home-search-client';

const vault = vi.hoisted(() => ({
  protection: 'indexeddb-aes-gcm' as const,
  restore: vi.fn(), save: vi.fn(), clear: vi.fn(),
}));
vi.mock('./session-vault', () => ({ browserSessionVault: () => vault }));
vi.mock('./home-search-client', () => ({ startLocalHomeSearch: vi.fn() }));

function savedGame() {
  const session = enterDemo(createInitialSession(), DEMO_CONTROLLER);
  return enterLocalUniverse(selectSoul(session, session.souls[0]!.id), round5WorldLocation({ x: 73, y: 6421 })!);
}

beforeEach(() => {
  vi.clearAllMocks();
  vault.restore.mockResolvedValue(null);
  vault.save.mockResolvedValue(undefined);
});

describe('local entry persistence', () => {
  it('saves real search checkpoints and ignores a late result after pause', async () => {
    let finish!: (value: Awaited<ReturnType<typeof startLocalHomeSearch>['result']>) => void;
    const cancel = vi.fn();
    vi.mocked(startLocalHomeSearch).mockReturnValue({cancel, result:new Promise(resolve => { finish=resolve; })});
    const { result, unmount } = renderHook(() => usePlayerJourney());
    await waitFor(() => expect(result.current.vault.status).toBe('sealed'));
    act(() => result.current.enterDemo());
    act(() => result.current.selectSoul(result.current.session.souls[0]!.id));
    act(() => { result.current.enterUniverse(); result.current.enterUniverse(); });
    expect(startLocalHomeSearch).toHaveBeenCalledOnce();
    const seatId = result.current.session.seat!.id;
    const checkpoint = { ...result.current.session.search, origin:{x:73,y:6421},
      checked:1024,cursor:4,chunks:[{x:64,y:6416,side:16}],locations:[] };
    act(() => vi.mocked(startLocalHomeSearch).mock.calls[0]![2](checkpoint));
    await waitFor(() => expect(vault.save).toHaveBeenLastCalledWith(DEMO_CONTROLLER,
      expect.objectContaining({ stage:'searching', search:checkpoint })));
    const saved = result.current.session;
    act(() => result.current.cancelHomeSearch());
    await act(async () => finish({home:round5WorldLocation({x:73,y:6421})!,search:checkpoint}));
    expect(result.current.session.stage).toBe('searching');
    expect(result.current.session.strategy).toBeUndefined();
    expect(cancel).toHaveBeenCalledOnce();
    unmount();
    vault.restore.mockResolvedValue(saved);
    const resumed = renderHook(() => usePlayerJourney());
    await waitFor(() => expect(resumed.result.current.session.stage).toBe('searching'));
    expect(resumed.result.current.session.seat!.id).toBe(seatId);
    expect(resumed.result.current.session.search.checked).toBe(1024);
  });

  it('waits for restoration rather than overwriting an unread save', async () => {
    let restore!: (session: PlayerSession) => void;
    vault.restore.mockImplementation(() => new Promise((resolve) => { restore = resolve; }));
    const { result } = renderHook(() => usePlayerJourney());
    act(() => result.current.enterDemo());
    expect(result.current.session.stage).toBe('welcome');
    expect(vault.save).not.toHaveBeenCalled();
    const saved = savedGame();
    await act(async () => restore(saved));
    expect(result.current.session.seat?.id).toBe(saved.seat?.id);
    expect(result.current.session.stage).toBe('active');
  });

  it('returns home and checks ranked readiness without clearing or overwriting the local record', async () => {
    const saved = savedGame();
    vault.restore.mockResolvedValue(saved);
    const { result, unmount } = renderHook(() => usePlayerJourney());
    await waitFor(() => expect(result.current.session.stage).toBe('active'));
    act(() => result.current.restart());
    expect(result.current.hasSavedDemo).toBe(true);
    act(() => result.current.enterOnchain());
    expect(result.current.session.mode).toBe('onchain');
    expect(vault.save.mock.calls.every(([, value]) => value.mode === 'demo')).toBe(true);
    act(() => result.current.restart());
    act(() => result.current.enterDemo());
    expect(result.current.session.seat?.id).toBe(saved.seat?.id);
    expect(result.current.session.strategy?.selectedPlanetId).toBe(saved.strategy?.selectedPlanetId);
    expect(vault.clear).not.toHaveBeenCalled();
    unmount();
    const reloaded = renderHook(() => usePlayerJourney());
    await waitFor(() => expect(reloaded.result.current.session.stage).toBe('active'));
    expect(reloaded.result.current.session.seat?.id).toBe(saved.seat?.id);
  });

  it('does not initialize or overwrite when vault authentication fails', async () => {
    vault.restore.mockRejectedValue(new Error('Authentication failed'));
    const { result } = renderHook(() => usePlayerJourney());
    await waitFor(() => expect(result.current.vault.status).toBe('error'));
    act(() => result.current.enterDemo());
    expect(result.current.session.stage).toBe('welcome');
    expect(vault.save).not.toHaveBeenCalled();
    expect(vault.clear).not.toHaveBeenCalled();
  });
});
