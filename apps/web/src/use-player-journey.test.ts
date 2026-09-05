import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialSession, DEMO_CONTROLLER, enterDemo, selectSoul, type PlayerSession } from '@infinite-stellar/game-sdk';
import { enterLocalUniverse } from './demo-entry';
import { usePlayerJourney } from './use-player-journey';

const vault = vi.hoisted(() => ({
  protection: 'indexeddb-aes-gcm' as const,
  restore: vi.fn(), save: vi.fn(), clear: vi.fn(),
}));
vi.mock('./session-vault', () => ({ browserSessionVault: () => vault }));

function savedGame() {
  const session = enterDemo(createInitialSession(), DEMO_CONTROLLER);
  return enterLocalUniverse(selectSoul(session, session.souls[0]!.id));
}

beforeEach(() => {
  vi.clearAllMocks();
  vault.restore.mockResolvedValue(null);
  vault.save.mockResolvedValue(undefined);
});

describe('local entry persistence', () => {
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
