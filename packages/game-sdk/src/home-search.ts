import { round5PlanetLevel, round5PlanetType, round5SpaceType } from './round5-rules';
import { round5Perlin, round5WorldLocation, ROUND5_SPACE_TYPE_KEY, type Round5Coordinates } from './round5-universe';
import type { MinedRound5Location } from './miner';

// Pinned Round-5 darkforest.toml: INIT_PERLIN_MIN=13, MAX=14, SPAWN_RIM_AREA=0.
export const LOCAL_WORLD_RADIUS = 12_000;
export const ROUND5_HOME_PERLIN_MIN = 13;
export const ROUND5_HOME_PERLIN_MAX = 14;

export function isRound5HomeLocation(location: MinedRound5Location): boolean {
  if (!location || !Number.isSafeInteger(location.x) || !Number.isSafeInteger(location.y) ||
      Math.hypot(location.x, location.y) >= LOCAL_WORLD_RADIUS ||
      Math.hypot(location.x, location.y) === 0 ||
      location.perlin < ROUND5_HOME_PERLIN_MIN || location.perlin >= ROUND5_HOME_PERLIN_MAX ||
      !/^[0-9a-f]{64}$/.test(location.locationId)) return false;
  const actual = round5WorldLocation(location);
  if (!actual || actual.locationId !== location.locationId ||
      actual.perlin !== location.perlin || actual.biomebase !== location.biomebase) return false;
  const space = round5SpaceType(location.perlin);
  const level = round5PlanetLevel(Number.parseInt(location.locationId.slice(8, 14), 16), space);
  return level === 0 && round5PlanetType(Number.parseInt(location.locationId.slice(16, 18), 16), level, space) === 'Regular';
}

/** Uniform rejection sampling in the valid public Perlin band, never a known-planet lookup. */
export function chooseHomeSearchOrigin(random: () => number): Round5Coordinates {
  for (let attempt = 0; attempt < 4096; attempt += 1) {
    const rx = random();
    const ry = random();
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx < 0 || rx >= 1 || ry < 0 || ry >= 1) {
      throw new Error('Home search requires random samples in [0, 1).');
    }
    const point = { x: Math.floor((rx * 2 - 1) * LOCAL_WORLD_RADIUS), y: Math.floor((ry * 2 - 1) * LOCAL_WORLD_RADIUS) };
    const radius = Math.hypot(point.x, point.y);
    if (radius <= 0 || radius >= LOCAL_WORLD_RADIUS) continue;
    const perlin = round5Perlin(point, { key: ROUND5_SPACE_TYPE_KEY });
    if (perlin >= ROUND5_HOME_PERLIN_MIN && perlin < ROUND5_HOME_PERLIN_MAX) return point;
  }
  throw new Error('Could not find a home-search region. Retry with fresh local randomness.');
}
