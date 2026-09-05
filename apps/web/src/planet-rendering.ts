import type { CSSProperties } from 'react';

// DF Round 5 level radii, normalized to its default rarity. Presentation only.
const LEVEL_RADII = [1, 3, 9, 27, 81, 243, 486, 729, 972, 1215] as const;
export const MIN_PLANET_CAMERA_RADIUS = 6;

export function planetWorldRadius(level: number, rarity = 12_000): number {
  const index = Math.min(9, Math.max(0, Math.floor(Number.isFinite(level) ? level : 0)));
  const density = Number.isFinite(rarity) && rarity > 0 ? rarity : 12_000;
  return LEVEL_RADII[index]! * Math.sqrt(Math.max(1, density) / 16_384);
}

export function planetDetail(level: number, pixelsPerWorld: number, important = false, rarity = 12_000) {
  const projectedRadius = planetWorldRadius(level, rarity) * Math.max(0, pixelsPerWorld);
  const visible = important || projectedRadius >= 1;
  const radius = important ? Math.max(2, projectedRadius) : projectedRadius;
  const bodyOpacity = important ? 1 : Math.min(1, Math.max(0, (projectedRadius - 0.7) / 3.3));
  const detailOpacity = important ? 1 : Math.min(1, Math.max(0, (projectedRadius - 3) / 5));
  return { visible, radius, projectedRadius, bodyOpacity, detailOpacity,
    showResources: projectedRadius >= 4,
    showFacility: projectedRadius >= 4,
    simplified: projectedRadius < 3,
    // Hit areas follow visible bodies; an invisible low-level Planet cannot intercept a pan.
    hitDiameter: Math.max(important ? 16 : 8, radius * 2.2),
  };
}

export function planetGlyphStyle(detail: ReturnType<typeof planetDetail>): CSSProperties {
  return { width: detail.hitDiameter, height: detail.hitDiameter,
    '--planet-diameter': `${detail.radius * 2}px`, '--planet-opacity': detail.bodyOpacity,
    '--planet-detail-opacity': detail.detailOpacity } as CSSProperties;
}

// Biome palette from MIT @darkforest_eth/procedural (0xPARC, 2022), pinned Round 5.
// Attribution and complete license: /third-party/df-procedural-LICENSE.txt.
const LAND = [[0, 0, 0], [213, 100, 50], [135, 96, 63], [82, 80, 76], [339, 95, 70],
  [44, 81, 33], [51, 78, 60], [198, 78, 77], [0, 0, 18], [19, 100, 50], [100, 80, 54]];
const OCEAN = [[0, 0, 0], [213, 89, 35], [193, 96, 43], [185, 78, 70], [201, 95, 70],
  [285, 81, 33], [27, 78, 60], [198, 90, 85], [0, 98, 42], [12, 92, 39], [128, 90, 63]];

export function biomeFromMap(spaceType: string, biomebase: number): number {
  if (spaceType === 'DeadSpace') return 10;
  return Math.max(0, ['Nebula', 'Space', 'DeepSpace'].indexOf(spaceType)) * 3 +
    (biomebase < 14 ? 1 : biomebase < 17 ? 2 : 3);
}

function rgb([h = 0, s = 0, l = 0]: number[]): [number, number, number] {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
}

export function planetCosmetic(locationId: string, biome: number, level: number) {
  const index = Math.min(10, Math.max(1, biome));
  const land = LAND[index]!;
  const color = rgb(land);
  return { land: color, ocean: rgb(OCEAN[index]!),
    beach: rgb([land[0]! + 10, land[1]! - 30, Math.min(land[2]! + 23, 100)]),
    seed: Number.parseInt(locationId.replace(/^0x/, '').slice(0, 9), 16) || 1,
    octaves: [1, 1, 2, 2, 2, 3, 3, 3, 3, 4][level] ?? 1,
    clouds: [0, 0, 1, 1, 1, 2, 2, 3, 3, 4][level] ?? 0,
    morph: biome === 9 || biome === 10 ? [0.8, 1, 1, 0.8, 0.6, 0.6, 0.4, 0.4, 0.3, 0.25][level] ?? 0 : 0,
    distort: biome === 10 ? [0.04, 0.06, 0.06, 0.08, 0.08, 0.1, 0.1, 0.12, 0.13, 0.14][level] ?? 0 : 0,
    beachMode: level >= 8 ? 2 : level >= 4 ? 1 : 0,
    fallbackColor: `rgb(${color.map((channel) => Math.round(channel * 255)).join(' ')})`,
  };
}
