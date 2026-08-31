export const ROUND5_RULESET_ID = 'infinite-stellar.dark-forest-v06-round5';
export const ROUND5_RULESET_VERSION = 1;

export const PLANET_TYPES = [
  'Regular',
  'SilverMine',
  'Ruins',
  'SpacetimeRip',
  'SilverBank',
] as const;

export const SPACE_TYPES = ['Nebula', 'Space', 'DeepSpace', 'DeadSpace'] as const;

export type Round5PlanetType = (typeof PLANET_TYPES)[number];
export type Round5SpaceType = (typeof SPACE_TYPES)[number];
export type Round5UpgradeBranch = 'defense' | 'range' | 'speed';

export interface Round5PlanetStats {
  level: number;
  planetType: Round5PlanetType;
  spaceType: Round5SpaceType;
  energy: number;
  energyCapacity: number;
  energyGrowth: number;
  range: number;
  speed: number;
  defense: number;
  silver: number;
  silverCapacity: number;
  silverGrowth: number;
  spaceJunk: number;
}

const LEVEL_THRESHOLDS = [
  16_777_216,
  4_194_292,
  1_048_561,
  262_128,
  65_520,
  16_368,
  4_080,
  1_008,
  240,
  48,
] as const;

const DEFAULTS = [
  [100_000, 417, 99, 75, 400, 0, 0, 0],
  [400_000, 833, 177, 75, 400, 56, 100_000, 1],
  [1_600_000, 1_250, 315, 75, 300, 167, 500_000, 2],
  [6_000_000, 1_667, 591, 75, 300, 417, 2_500_000, 3],
  [25_000_000, 2_083, 1_025, 75, 300, 833, 12_000_000, 4],
  [100_000_000, 2_500, 1_734, 75, 200, 1_667, 50_000_000, 5],
  [300_000_000, 2_917, 2_838, 75, 200, 2_778, 100_000_000, 7],
  [500_000_000, 3_333, 4_414, 75, 200, 2_778, 200_000_000, 10],
  [700_000_000, 3_750, 6_306, 75, 200, 2_778, 300_000_000, 20],
  [800_000_000, 4_167, 8_829, 75, 200, 2_778, 400_000_000, 25],
] as const;

const TYPE_WEIGHTS: readonly (readonly (readonly number[])[])[] = [
  [
    [1, 0, 0, 0, 0], [13, 2, 0, 1, 0], [13, 2, 0, 1, 0],
    [13, 2, 0, 0, 1], [13, 2, 0, 0, 1], [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1], [13, 2, 0, 0, 1], [13, 2, 0, 0, 1],
    [13, 2, 0, 0, 1],
  ],
  [
    [1, 0, 0, 0, 0], [13, 2, 1, 0, 0], [12, 2, 1, 1, 0],
    [11, 2, 1, 1, 1], [12, 2, 1, 0, 1], [12, 2, 1, 0, 1],
    [12, 2, 1, 0, 1], [12, 2, 1, 0, 1], [12, 2, 1, 0, 1],
    [12, 2, 1, 0, 1],
  ],
  [
    [1, 0, 0, 0, 0], [10, 4, 2, 0, 0], [10, 4, 1, 1, 0],
    [8, 4, 1, 2, 1], [8, 4, 1, 2, 1], [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1], [8, 4, 1, 2, 1], [8, 4, 1, 2, 1],
    [8, 4, 1, 2, 1],
  ],
  [
    [1, 0, 0, 0, 0], [11, 4, 1, 0, 0], [11, 4, 1, 0, 0],
    [7, 4, 2, 2, 1], [7, 4, 2, 2, 1], [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1], [7, 4, 2, 2, 1], [7, 4, 2, 2, 1],
    [7, 4, 2, 2, 1],
  ],
] as const;

function requireIndex<T>(items: readonly T[], index: number, label: string): T {
  const value = items[index];
  if (value === undefined) throw new RangeError(`Invalid ${label}: ${index}.`);
  return value;
}

export function round5SpaceType(perlin: number): Round5SpaceType {
  if (perlin >= 19) return 'DeadSpace';
  if (perlin >= 15) return 'DeepSpace';
  if (perlin >= 14) return 'Space';
  return 'Nebula';
}

export function round5PlanetLevel(selector: number, spaceType: Round5SpaceType): number {
  if (!Number.isInteger(selector) || selector < 0 || selector >= 2 ** 24) {
    throw new RangeError('The level selector must be an unsigned 24-bit integer.');
  }
  let level = 9;
  while (level > 0 && selector >= requireIndex(LEVEL_THRESHOLDS, level, 'level')) {
    level -= 1;
  }
  if (spaceType === 'Nebula') return Math.min(level, 4);
  if (spaceType === 'Space') return Math.min(level, 5);
  return level;
}

export function round5PlanetType(
  typeByte: number,
  level: number,
  spaceType: Round5SpaceType,
): Round5PlanetType {
  const spaceIndex = SPACE_TYPES.indexOf(spaceType);
  const byLevel = requireIndex(TYPE_WEIGHTS, spaceIndex, 'space type');
  const weights = requireIndex(byLevel, level, 'level');
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = weightSum;
  for (let index = 0; index < weights.length; index += 1) {
    remaining -= requireIndex(weights, index, 'planet type weight');
    if (typeByte >= Math.floor((remaining * 256) / weightSum)) {
      return requireIndex(PLANET_TYPES, index, 'planet type');
    }
  }
  return 'Regular';
}

export function round5PlanetStats(input: {
  level: number;
  planetType: Round5PlanetType;
  spaceType: Round5SpaceType;
  capacityBonus?: boolean;
  growthBonus?: boolean;
  rangeBonus?: boolean;
  speedBonus?: boolean;
  defenseBonus?: boolean;
  halfJunk?: boolean;
}): Round5PlanetStats {
  const row = requireIndex(DEFAULTS, input.level, 'level');
  let energyCapacity: number = row[0];
  let energyGrowth: number = row[1];
  let range: number = row[2];
  let speed: number = row[3];
  let defense: number = row[4];
  const silverGrowthBase: number = row[5];
  let silverCapacity: number = row[6];
  const barbarianPercentage: number = row[7];
  let silverGrowth = input.planetType === 'SilverMine' ? silverGrowthBase : 0;

  if (input.capacityBonus) energyCapacity *= 2;
  if (input.growthBonus) energyGrowth *= 2;
  if (input.rangeBonus) range *= 2;
  if (input.speedBonus) speed *= 2;
  if (input.defenseBonus) defense *= 2;

  const productiveMultiplier = input.spaceType === 'Space' ? 1.25
    : input.spaceType === 'DeepSpace' ? 1.5
      : input.spaceType === 'DeadSpace' ? 2
        : 1;
  const defenseMultiplier = input.spaceType === 'Space' ? 0.5
    : input.spaceType === 'DeepSpace' ? 0.25
      : input.spaceType === 'DeadSpace' ? 0.15
        : 1;
  const productive = (value: number) => Math.floor(value * productiveMultiplier);
  energyCapacity = productive(energyCapacity);
  energyGrowth = productive(energyGrowth);
  range = productive(range);
  speed = productive(speed);
  silverCapacity = productive(silverCapacity);
  silverGrowth = productive(silverGrowth);
  defense = Math.floor(defense * defenseMultiplier);

  if (input.planetType === 'SilverMine') {
    silverCapacity *= 2;
    defense = Math.floor(defense / 2);
  } else if (input.planetType === 'SilverBank') {
    speed = Math.floor(speed / 2);
    silverCapacity *= 10;
    energyGrowth = 0;
    energyCapacity *= 5;
  } else if (input.planetType === 'SpacetimeRip') {
    defense = Math.floor(defense / 2);
    silverCapacity *= 2;
  }

  let energy = Math.floor((energyCapacity * barbarianPercentage) / 100);
  if (input.spaceType === 'Space') energy *= 4;
  if (input.spaceType === 'DeepSpace') energy *= 10;
  if (input.spaceType === 'DeadSpace') energy *= 20;
  if (input.planetType === 'SilverBank') energy = Math.floor(energy / 2);

  const silver = input.planetType === 'SilverMine' ? Math.floor(silverCapacity / 2) : 0;
  const spaceJunk = Math.floor((20 + input.level * 5) / (input.halfJunk ? 2 : 1));
  return {
    level: input.level,
    planetType: input.planetType,
    spaceType: input.spaceType,
    energy,
    energyCapacity,
    energyGrowth,
    range,
    speed,
    defense,
    silver,
    silverCapacity,
    silverGrowth,
    spaceJunk,
  };
}

export function round5HomeStats(): Round5PlanetStats {
  return {
    ...round5PlanetStats({ level: 0, planetType: 'Regular', spaceType: 'Nebula' }),
    energy: 50_000,
    spaceJunk: 0,
  };
}

export function round5TravelTime(distance: number, speed: number): number {
  return Math.max(1, Math.floor((distance * 100) / speed));
}

export function round5ArrivingEnergy(
  sent: number,
  effectiveDistance: number,
  range: number,
  originCapacity: number,
): number {
  return Math.max(
    0,
    Math.floor(sent / 2 ** (effectiveDistance / range) - originCapacity / 20),
  );
}

export function round5ResolveHostileCombat(
  defenderEnergy: number,
  defenderDefense: number,
  arrivingEnergy: number,
): { conquered: boolean; energy: number } {
  const absorbed = Math.floor((arrivingEnergy * 100) / defenderDefense);
  if (defenderEnergy > absorbed) {
    return { conquered: false, energy: defenderEnergy - absorbed };
  }
  const remaining = arrivingEnergy - Math.floor((defenderEnergy * defenderDefense) / 100);
  return { conquered: true, energy: remaining === 0 ? 1 : remaining };
}

export function round5RefreshEnergy(
  current: number,
  capacity: number,
  growth: number,
  elapsedSeconds: number,
): number {
  if (current <= 0 || growth <= 0 || elapsedSeconds <= 0) return current;
  const exponent = (-4 * growth * elapsedSeconds) / capacity;
  const denominator = 1 + Math.exp(exponent) * (capacity / current - 1);
  return Math.max(0, Math.floor(capacity / denominator));
}

export function round5UpgradeCost(silverCapacity: number, totalLevel: number): number {
  return Math.floor((silverCapacity * 20 * (totalLevel + 1)) / 100);
}

export function round5SilverScore(silver: number): number {
  return Math.floor(Math.floor(silver / 1_000) * 10 / 100);
}

export function round5ArtifactTypeAndBonus(
  lastByteMod255: number,
  secondLastByteMod255: number,
): { artifactType: number; levelBonus: number } {
  const artifactType = lastByteMod255 < 39 ? 1
    : lastByteMod255 < 78 ? 2
      : lastByteMod255 < 156 ? 4
        : lastByteMod255 < 171 ? 5
          : lastByteMod255 < 186 ? 6
            : lastByteMod255 < 201 ? 7
              : lastByteMod255 < 216 ? 8
                : lastByteMod255 < 231 ? 9
                  : 7;
  const levelBonus = secondLastByteMod255 < 4 ? 2 : secondLastByteMod255 < 16 ? 1 : 0;
  return { artifactType, levelBonus };
}

export function round5ArtifactRarity(levelWithBonus: number): number {
  if (levelWithBonus <= 1) return 1;
  if (levelWithBonus <= 3) return 2;
  if (levelWithBonus <= 5) return 3;
  if (levelWithBonus <= 7) return 4;
  return 5;
}

export function round5CaptureScore(level: number): number {
  return requireIndex(
    [0, 0, 250_000, 500_000, 750_000, 1_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000],
    level,
    'capture level',
  );
}

export function round5CaptureEnergyEligible(energy: number, capacity: number): boolean {
  return energy * 100 >= Math.floor((capacity * 100) / 78);
}
