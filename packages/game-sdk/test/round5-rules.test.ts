import { describe, expect, it } from 'vitest';
import {
  round5ArrivingEnergy,
  round5HomeStats,
  round5PlanetLevel,
  round5PlanetStats,
  round5PlanetType,
  round5ResolveHostileCombat,
  round5SpaceType,
  round5TravelTime,
  round5UpgradeCost,
} from '../src/round5-rules';

describe('Round 5 typed rules', () => {
  it('matches the Move boundary vectors', () => {
    expect(round5SpaceType(13)).toBe('Nebula');
    expect(round5SpaceType(14)).toBe('Space');
    expect(round5SpaceType(15)).toBe('DeepSpace');
    expect(round5SpaceType(19)).toBe('DeadSpace');
    expect(round5PlanetLevel(0, 'DeadSpace')).toBe(9);
    expect(round5PlanetLevel(48, 'DeadSpace')).toBe(8);
    expect(round5PlanetLevel(0, 'Nebula')).toBe(4);
    expect(round5PlanetType(255, 3, 'Space')).toBe('Regular');
    expect(round5PlanetType(0, 3, 'Space')).toBe('SilverBank');
    expect(round5PlanetType(16, 3, 'DeepSpace')).toBe('SpacetimeRip');
  });

  it('initializes bonuses and types in reference order', () => {
    const stats = round5PlanetStats({
      level: 2,
      planetType: 'SilverMine',
      spaceType: 'DeadSpace',
      capacityBonus: true,
      growthBonus: true,
      rangeBonus: true,
      speedBonus: true,
      defenseBonus: true,
      halfJunk: true,
    });
    expect(stats).toMatchObject({
      energyCapacity: 6_400_000,
      energyGrowth: 5_000,
      range: 1_260,
      speed: 300,
      defense: 45,
      silverCapacity: 2_000_000,
      silver: 1_000_000,
      silverGrowth: 334,
      spaceJunk: 15,
    });
    expect(round5HomeStats()).toMatchObject({ energy: 50_000, spaceJunk: 0 });
  });

  it('matches voyage, combat, and upgrade integer boundaries', () => {
    expect(round5TravelTime(0, 75)).toBe(1);
    expect(round5ArrivingEnergy(80_000, 50, 99, 100_000)).toBeGreaterThan(0);
    expect(round5ResolveHostileCombat(101, 200, 100)).toEqual({ conquered: false, energy: 51 });
    expect(round5ResolveHostileCombat(50, 200, 100)).toEqual({ conquered: true, energy: 1 });
    expect(round5UpgradeCost(100_000, 2)).toBe(60_000);
  });
});
