import { createStrategyGame } from '../../../packages/game-sdk/test/strategy-fixture';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialSession, DEMO_CONTROLLER, dispatchStrategyVoyage, scanStrategyUniverse,
  setStrategyTarget, type PlayerSession } from '@infinite-stellar/game-sdk';
import { usePlayerJourney } from './use-player-journey';

const vault = vi.hoisted(() => ({ protection: 'indexeddb-aes-gcm', restore: vi.fn(), save: vi.fn(), clear: vi.fn() }));
vi.mock('./session-vault', () => ({ browserSessionVault: () => vault }));

function savedSession(): PlayerSession {
  const game = scanStrategyUniverse(createStrategyGame({ universeSeed: 'clock', homeId: 'home', homeName: 'HOME' }));
  const target = game.planets.find((planet) => planet.discovered && !planet.isHome && planet.level === 0)!;
  const strategy = dispatchStrategyVoyage(setStrategyTarget(game, target.id), 90);
  return { ...createInitialSession(), controllerAddress: DEMO_CONTROLLER, stage: 'active', mode: 'demo', strategy: { ...strategy, wallClockAtMs: 100_000 } };
}

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('player simulation clock wiring', () => {
  it('ticks without a button and reconciles time away before displaying the resumed result', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const saved = savedSession();
    vault.restore.mockResolvedValue(saved);
    vault.save.mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => usePlayerJourney());
    await act(async () => { await Promise.resolve(); });
    expect(result.current.session.strategy?.now).toBe(0);
    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(result.current.session.strategy?.now).toBe(1);
    expect(result.current.session.strategy?.voyages).toHaveLength(1);
    act(() => {
      vi.setSystemTime(100_000 + saved.strategy!.voyages[0]!.arrivalAt * 1000);
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.session.strategy?.voyages).toHaveLength(0);
    const targetId = saved.strategy!.voyages[0]!.toPlanetId;
    expect(result.current.session.strategy?.planets.find((planet) => planet.id === targetId)?.owner).toBe('player');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('never applies the local wall clock to ranked/onchain state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(500_000);
    const saved = { ...savedSession(), mode: 'onchain' as const };
    vault.restore.mockResolvedValue(saved);
    vault.save.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlayerJourney());
    await act(async () => { await Promise.resolve(); });
    await act(() => vi.advanceTimersByTimeAsync(3000));
    // A local record cannot supply ranked state at all; it must be read from Sui.
    expect(result.current.session.stage).toBe('welcome');
    expect(result.current.session.strategy).toBeUndefined();
    expect(saved.strategy?.now).toBe(0);
    expect(saved.strategy?.voyages).toHaveLength(1);
    expect(vault.save).not.toHaveBeenCalled();
  });
});
