import { createStrategyGame } from './strategy-fixture';
import { describe, expect, it } from 'vitest';
import {
  normalizeStrategyDiscovery, synchronizeStrategyClock, scanStrategyUniverse,
  mergeMinedStrategyLocations, dispatchStrategyVoyage, setStrategyTarget, advanceStrategyTime,
  round5WorldLocation,
} from '../src';

const game = () => createStrategyGame({ universeSeed: 'clock-fog', homeId: 'home', homeName: 'HOME' });

describe('fog-first local discovery', () => {
  it('shows only home at genesis and rejects an unexplored target', () => {
    const initial = game();
    expect(initial.planets.filter((planet) => planet.discovered).map((planet) => planet.id)).toEqual(['home']);
    expect(initial.exploredChunks).toEqual([]);
    expect(initial.scans).toBe(0);
    const hidden = initial.planets.find((planet) => !planet.isHome)!;
    expect(() => setStrategyTarget(initial, hidden.id)).toThrow(/unknown/);
  });

  it('reveals a planet only after its validated mined chunk and does not log empty batches', () => {
    const initial = game();
    const hidden = initial.planets.find((planet) => !planet.isHome)!;
    const chunk = { index: 0, x: Math.floor(hidden.x / 16) * 16, y: Math.floor(hidden.y / 16) * 16, side: 16 };
    const empty = mergeMinedStrategyLocations(initial, [], [chunk]);
    expect(empty.log).toBe(initial.log);
    expect(empty.planets.find((planet) => planet.id === hidden.id)?.discovered).toBe(false);
    const found = mergeMinedStrategyLocations(initial, [{ x: hidden.x, y: hidden.y, locationId: hidden.locationId,
      perlin: round5WorldLocation(hidden)!.perlin, biomebase: hidden.biomebase }], [chunk]);
    expect(found.exploredChunks).toContainEqual(chunk);
    expect(found.planets.find((planet) => planet.id === hidden.id)?.discovered).toBe(true);
    expect(found.planets.filter((planet) => planet.discovered)).toHaveLength(2);
  });

  it('hides only unearned legacy bootstrap visibility and keeps observed or visited locations', () => {
    const initial = game();
    const old = { ...initial, discoveryModel: undefined, scans: 1,
      planets: initial.planets.map((planet) => ({ ...planet, discovered: true })) };
    const migrated = normalizeStrategyDiscovery(old);
    expect(migrated.planets.filter((planet) => planet.discovered)).toHaveLength(1);
    expect(migrated.planets).toHaveLength(old.planets.length);
    const visible = old.planets[1]!;
    const withScan = normalizeStrategyDiscovery({ ...old, exploredChunks: [{
      x: Math.floor(visible.x / 16) * 16, y: Math.floor(visible.y / 16) * 16, side: 16 }] });
    expect(withScan.planets[1]!.discovered).toBe(true);
    const legacyScan = normalizeStrategyDiscovery({ ...old, scans: 2 });
    expect(legacyScan.planets.every((planet) => planet.discovered)).toBe(true);
    expect(normalizeStrategyDiscovery(withScan)).toBe(withScan);
  });
});

describe('local real-time voyage clock', () => {
  it('starts legacy saves now, retains fractional time and ignores a backward wall clock', () => {
    const initial = { ...game(), now: 500, checkpoint: 500 };
    const anchored = synchronizeStrategyClock(initial, 10_000);
    expect(anchored.now).toBe(500);
    expect(synchronizeStrategyClock(anchored, 10_999)).toBe(anchored);
    const advanced = synchronizeStrategyClock(anchored, 12_750);
    expect(advanced.now).toBe(502);
    expect(advanced.wallClockAtMs).toBe(12_000);
    expect(synchronizeStrategyClock(advanced, 11_000)).toBe(advanced);
    expect(synchronizeStrategyClock(advanced, 13_000).now).toBe(503);
  });

  it('resolves arrivals exactly once as real time passes and after reload', () => {
    const initial = synchronizeStrategyClock(scanStrategyUniverse(game()), 10_000);
    const target = initial.planets.find((planet) => !planet.isHome && planet.discovered && planet.level === 0)!;
    const sent = dispatchStrategyVoyage(setStrategyTarget(initial, target.id), 90);
    const voyage = sent.voyages[0]!;
    const before = synchronizeStrategyClock(sent, 10_000 + (voyage.arrivalAt - 1) * 1000);
    expect(before.voyages).toHaveLength(1);
    expect(before.planets.find((planet) => planet.id === target.id)?.owner).toBe('neutral');
    const restored = JSON.parse(JSON.stringify(before));
    const after = synchronizeStrategyClock(restored, 10_000 + voyage.arrivalAt * 1000);
    expect(after.voyages).toHaveLength(0);
    expect(after.planets.find((planet) => planet.id === target.id)?.owner).toBe('player');
    expect(synchronizeStrategyClock(after, 10_000 + voyage.arrivalAt * 1000)).toBe(after);
  });

  it('preserves explicit fast-forward without subsequently applying the same seconds twice', () => {
    const initial = synchronizeStrategyClock(game(), 10_000);
    const manual = advanceStrategyTime(initial, 300);
    expect(synchronizeStrategyClock(manual, 11_000).now).toBe(301);
    expect(() => synchronizeStrategyClock(initial, NaN)).toThrow(/clock/);
    expect(synchronizeStrategyClock({ ...initial, settled: true }, 99_000).now).toBe(0);
  });
});
