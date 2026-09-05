import {
  ROUND5_RULESET_ID,
  ROUND5_RULESET_VERSION,
  round5ArrivingEnergy,
  round5ArtifactRarity,
  round5ArtifactTypeAndBonus,
  round5CaptureEnergyEligible,
  round5CaptureScore,
  round5PlanetLevel,
  round5PlanetStats,
  round5PlanetType,
  round5RefreshEnergy,
  round5ResolveHostileCombat,
  round5SpaceType,
  round5SilverScore,
  round5TravelTime,
  round5UpgradeCost,
  type Round5PlanetStats,
  type Round5UpgradeBranch,
} from './round5-rules';
import { isRound5HomeLocation, LOCAL_WORLD_RADIUS } from './home-search';
import { round5WorldLocation } from './round5-universe';
import {
  round5MinerTotal,
  type MinedRound5Location,
  type Round5MinerChunk,
} from './miner';
import { nextExplorationBatch, mergeExploredChunks, locationInChunks, type ExploredChunk } from './exploration';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { routeDistanceBound } from './routing';

export type StrategyOwner = 'player' | 'rival' | 'neutral';
export type StrategyShipType = 'Mothership' | 'Crescent' | 'Whale' | 'Gear' | 'Titan';
export type StrategyArtifactType =
  | 'Monolith'
  | 'Colossus'
  | 'Spaceship'
  | 'Pyramid'
  | 'Wormhole'
  | 'PlanetaryShield'
  | 'PhotoidCannon'
  | 'BloomFilter'
  | 'BlackDomain'
  | StrategyShipType;

export interface StrategyArtifact {
  id: string;
  type: StrategyArtifactType;
  rarity: number;
  controller?: 'player';
  planetId?: string;
  voyageId?: string;
  activations: number;
  active: boolean;
  biome: number;
  mintedAt: number;
  lastActivatedAt?: number;
  lastDeactivatedAt?: number;
  wormholeToPlanetId?: string;
  externalOwner?: 'player';
  burned: boolean;
}

export interface StrategyCaptureZone {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface StrategyPlanet extends Round5PlanetStats {
  id: string;
  locationId: string;
  name: string;
  x: number;
  y: number;
  biome: number;
  biomebase: number;
  owner: StrategyOwner;
  isHome: boolean;
  discovered: boolean;
  destroyed: boolean;
  lastUpdatedAt: number;
  upgrades: Record<Round5UpgradeBranch, number>;
  artifactIds: string[];
  activeArtifactId?: string;
  prospectedAt?: number;
  artifactFound: boolean;
  revealed: boolean;
  invadedAt?: number;
  captured: boolean;
  titanCount: number;
  defaultEnergy: number;
  defaultSpaceJunk: number;
}

export interface StrategyVoyage {
  id: string;
  player: StrategyOwner;
  fromPlanetId: string;
  toPlanetId: string;
  energySent: number;
  energyArriving: number;
  silverMoved: number;
  departureAt: number;
  arrivalAt: number;
  distance: number;
  kind: 'fleet' | 'ship' | 'abandon';
  arrivalType?: 'Normal' | 'Photoid' | 'Wormhole';
  carriedArtifactId?: string;
}

export interface StrategyLogEntry {
  id: string;
  at: number;
  tone: 'info' | 'success' | 'danger';
  message: string;
}

export interface StrategyGame {
  schemaVersion: 5;
  rulesetId: typeof ROUND5_RULESET_ID;
  rulesetVersion: typeof ROUND5_RULESET_VERSION;
  universeSeed: string;
  now: number;
  /** Local-demo wall-clock anchor; never used by ranked chain projections. */
  wallClockAtMs?: number;
  checkpoint: number;
  worldRadius: number;
  scanRadius: number;
  selectedPlanetId?: string;
  targetPlanetId?: string;
  planets: StrategyPlanet[];
  voyages: StrategyVoyage[];
  artifacts: StrategyArtifact[];
  shipsClaimed: boolean;
  captureZones: StrategyCaptureZone[];
  captureEpoch: number;
  lastRevealAt?: number;
  score: number;
  spaceJunk: number;
  spaceJunkLimit: number;
  scans: number;
  exploredChunks?: ExploredChunk[];
  discoveryModel?: 'mined-chunks-v1';
  explorationOrigin?: { x: number; y: number };
  settled: boolean;
  settledAt?: number;
  finalScore?: number;
  log: StrategyLogEntry[];
}

export class StrategyRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StrategyRuleError';
  }
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function copyPlanet(planet: StrategyPlanet): StrategyPlanet {
  return { ...planet, upgrades: { ...planet.upgrades }, artifactIds: [...planet.artifactIds] };
}

function copyArtifact(artifact: StrategyArtifact): StrategyArtifact {
  return { ...artifact };
}

function artifactOnPlanet(game: StrategyGame, planet: StrategyPlanet, artifactId?: string): StrategyArtifact | undefined {
  if (!artifactId) return undefined;
  const artifact = game.artifacts.find((candidate) => candidate.id === artifactId);
  return artifact?.planetId === planet.id ? artifact : undefined;
}

function deactivateArtifactState(
  planet: StrategyPlanet,
  artifact: StrategyArtifact,
  now: number,
  burn: boolean,
): { planet: StrategyPlanet; artifact: StrategyArtifact } {
  const nextPlanet = removeArtifactUpgrade(planet, artifact);
  nextPlanet.activeArtifactId = undefined;
  const nextArtifact: StrategyArtifact = {
    ...copyArtifact(artifact),
    active: false,
    lastDeactivatedAt: now,
    wormholeToPlanetId: undefined,
  };
  if (burn) {
    nextPlanet.artifactIds = nextPlanet.artifactIds.filter((id) => id !== artifact.id);
    nextArtifact.planetId = undefined;
    nextArtifact.burned = true;
  }
  return { planet: nextPlanet, artifact: nextArtifact };
}

const SHIP_TYPES: readonly StrategyShipType[] = [
  'Mothership',
  'Crescent',
  'Whale',
  'Gear',
  'Titan',
];

const ARTIFACT_SCORE = [0, 100_000, 200_000, 500_000, 20_000_000, 50_000_000] as const;
const PHOTOID_ACTIVATION_DELAY = 10_800;

interface ArtifactUpgrade {
  energyCapacity: number;
  energyGrowth: number;
  range: number;
  speed: number;
  defense: number;
}

function artifactUpgrade(artifact: StrategyArtifact): ArtifactUpgrade {
  if (artifact.type === 'PlanetaryShield') {
    const defense = [100, 150, 200, 300, 450, 650][artifact.rarity] ?? 100;
    return { energyCapacity: 100, energyGrowth: 100, range: 20, speed: 20, defense };
  }
  if (artifact.type === 'PhotoidCannon') {
    const defense = [100, 50, 40, 30, 20, 10][artifact.rarity] ?? 100;
    return { energyCapacity: 100, energyGrowth: 100, range: 100, speed: 100, defense };
  }
  const upgrade: ArtifactUpgrade = {
    energyCapacity: 100,
    energyGrowth: 100,
    range: 100,
    speed: 100,
    defense: 100,
  };
  if (artifact.type === 'Monolith') {
    upgrade.energyCapacity += 5;
    upgrade.energyGrowth += 5;
  } else if (artifact.type === 'Colossus') {
    upgrade.speed += 5;
  } else if (artifact.type === 'Spaceship') {
    upgrade.range += 5;
  } else if (artifact.type === 'Pyramid') {
    upgrade.defense += 5;
  } else {
    return upgrade;
  }
  if (artifact.biome === 1) {
    upgrade.speed += 5; upgrade.defense += 5;
  } else if (artifact.biome === 2) {
    upgrade.defense += 5; upgrade.energyCapacity += 5; upgrade.energyGrowth += 5;
  } else if (artifact.biome === 3) {
    upgrade.energyCapacity += 5; upgrade.energyGrowth += 5; upgrade.range += 5;
  } else if (artifact.biome === 4) {
    upgrade.defense += 5; upgrade.range += 5;
  } else if (artifact.biome === 5) {
    upgrade.speed += 5; upgrade.range += 5;
  } else if (artifact.biome === 6) {
    upgrade.speed += 10;
  } else if (artifact.biome === 7) {
    upgrade.range += 10;
  } else if (artifact.biome === 8) {
    upgrade.defense += 10;
  } else if (artifact.biome === 9) {
    upgrade.energyCapacity += 10; upgrade.energyGrowth += 10;
  } else if (artifact.biome === 10) {
    upgrade.range += 5; upgrade.speed += 5; upgrade.energyCapacity += 5; upgrade.energyGrowth += 5;
  }
  const scale = 1 + Math.floor(artifact.rarity / 2);
  for (const key of Object.keys(upgrade) as (keyof ArtifactUpgrade)[]) {
    upgrade[key] = scale * upgrade[key] - (scale - 1) * 100;
  }
  return upgrade;
}

function applyArtifactUpgrade(planet: StrategyPlanet, artifact: StrategyArtifact): StrategyPlanet {
  const upgrade = artifactUpgrade(artifact);
  return {
    ...copyPlanet(planet),
    energyCapacity: Math.floor((planet.energyCapacity * upgrade.energyCapacity) / 100),
    energyGrowth: Math.floor((planet.energyGrowth * upgrade.energyGrowth) / 100),
    range: Math.floor((planet.range * upgrade.range) / 100),
    speed: Math.floor((planet.speed * upgrade.speed) / 100),
    defense: Math.floor((planet.defense * upgrade.defense) / 100),
  };
}

function removeArtifactUpgrade(planet: StrategyPlanet, artifact: StrategyArtifact): StrategyPlanet {
  const upgrade = artifactUpgrade(artifact);
  return {
    ...copyPlanet(planet),
    energyCapacity: Math.floor((planet.energyCapacity * 100) / upgrade.energyCapacity),
    energyGrowth: Math.floor((planet.energyGrowth * 100) / upgrade.energyGrowth),
    range: Math.floor((planet.range * 100) / upgrade.range),
    speed: Math.floor((planet.speed * 100) / upgrade.speed),
    defense: Math.floor((planet.defense * 100) / upgrade.defense),
  };
}

function isShip(type: StrategyArtifactType): type is StrategyShipType {
  return SHIP_TYPES.includes(type as StrategyShipType);
}

function attachArtifactEffects(
  planet: StrategyPlanet,
  artifact: StrategyArtifact,
): StrategyPlanet {
  const next = copyPlanet(planet);
  if (!next.artifactIds.includes(artifact.id)) next.artifactIds.push(artifact.id);
  if (next.isHome) return next;
  if (artifact.type === 'Mothership') next.energyGrowth *= 2;
  if (artifact.type === 'Whale') next.silverGrowth *= 2;
  if (artifact.type === 'Titan') next.titanCount += 1;
  return next;
}

function detachArtifactEffects(
  planet: StrategyPlanet,
  artifact: StrategyArtifact,
): StrategyPlanet {
  const next = copyPlanet(planet);
  next.artifactIds = next.artifactIds.filter((id) => id !== artifact.id);
  if (next.isHome) return next;
  if (artifact.type === 'Mothership') next.energyGrowth = Math.floor(next.energyGrowth / 2);
  if (artifact.type === 'Whale') next.silverGrowth = Math.floor(next.silverGrowth / 2);
  if (artifact.type === 'Titan') next.titanCount = Math.max(0, next.titanCount - 1);
  return next;
}

function captureZonesFor(seed: string, epoch: number, worldRadius: number): StrategyCaptureZone[] {
  const ringCount = Math.floor(worldRadius / 5_000);
  const generationBlockHash = keccak_256(
    new TextEncoder().encode(`${seed}:capture-checkpoint:${epoch * 255}`),
  );
  return Array.from({ length: ringCount * 3 }, (_, index) => {
    const ring = Math.floor(index / 3);
    const nonce = new Uint8Array(32);
    let nonceValue = BigInt(index);
    for (let byte = 31; byte >= 0 && nonceValue > 0n; byte -= 1) {
      nonce[byte] = Number(nonceValue & 0xffn);
      nonceValue >>= 8n;
    }
    const packed = new Uint8Array(64);
    packed.set(generationBlockHash);
    packed.set(nonce, 32);
    let pointSeed = 0n;
    for (const value of keccak_256(packed)) pointSeed = (pointSeed << 8n) | BigInt(value);
    const angleSeed = Number(pointSeed % 0xfffn);
    const angle = angleSeed / 651;
    const distanceSeed = Number((pointSeed / 4_096n) % 0xff_ffffn);
    const distance = Math.floor(distanceSeed / 3_355) + ring * 5_000;
    return {
      id: `zone-${epoch}-${index}`,
      x: Math.trunc(Math.cos(angle) * distance),
      y: Math.trunc(Math.sin(angle) * distance),
      radius: 1_000,
    };
  });
}

function refreshCaptureEpoch(game: StrategyGame): StrategyGame {
  const captureEpoch = Math.floor(game.checkpoint / 255);
  if (captureEpoch === game.captureEpoch) return game;
  return {
    ...game,
    captureEpoch,
    captureZones: captureZonesFor(game.universeSeed, captureEpoch, game.worldRadius),
  };
}

function distanceBetween(left: StrategyPlanet, right: StrategyPlanet): number {
  const bound = routeDistanceBound(left, right);
  if (bound > BigInt(Number.MAX_SAFE_INTEGER)) throw new StrategyRuleError('The route exceeds the exact local range.');
  return Number(bound);
}

function pendingArrivalClassCount(
  game: StrategyGame,
  target: StrategyPlanet,
  arrivingPlayer: StrategyOwner,
): number {
  const fromCurrentOwner = arrivingPlayer === target.owner;
  return game.voyages.filter((voyage) =>
    voyage.toPlanetId === target.id &&
    ((voyage.player === target.owner) === fromCurrentOwner)).length;
}

function refreshPlanet(planet: StrategyPlanet, now: number): StrategyPlanet {
  if (now <= planet.lastUpdatedAt) return copyPlanet(planet);
  const elapsed = now - planet.lastUpdatedAt;
  const owned = planet.owner !== 'neutral';
  const next = copyPlanet(planet);
  if (owned) {
    next.energy = planet.titanCount > 0
      ? Math.min(planet.energy, planet.energyCapacity)
      : round5RefreshEnergy(
        planet.energy,
        planet.energyCapacity,
        planet.energyGrowth,
        elapsed,
      );
    if (planet.planetType === 'SilverMine') {
      next.silver = Math.min(
        planet.silverCapacity,
        planet.silver + planet.silverGrowth * elapsed,
      );
    }
  }
  next.lastUpdatedAt = now;
  return next;
}

function addLog(
  game: StrategyGame,
  tone: StrategyLogEntry['tone'],
  message: string,
): StrategyGame {
  const entry = { id: `${game.now}:${game.log.length}:${message}`, at: game.now, tone, message };
  return { ...game, log: [entry, ...game.log].slice(0, 12) };
}

function requirePlanet(game: StrategyGame, id: string | undefined): StrategyPlanet {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  const planet = game.planets.find((candidate) => candidate.id === id);
  if (!planet) throw new StrategyRuleError(`Unknown planet ${id}.`);
  return planet;
}

function generatePlanet(
  coordinates: readonly [number, number],
  now: number,
  homeCoordinates: readonly [number, number],
  discovered?: boolean,
): StrategyPlanet {
  const world = round5WorldLocation({ x: coordinates[0], y: coordinates[1] });
  if (!world) throw new StrategyRuleError('The coordinates do not identify a Round-5 planet.');
  const locationBytes = Array.from({ length: 32 }, (_, byteIndex) =>
    Number.parseInt(world.locationId.slice(byteIndex * 2, byteIndex * 2 + 2), 16));
  const spaceType = round5SpaceType(world.perlin);
  const selector = locationBytes[4]! * 65_536 + locationBytes[5]! * 256 + locationBytes[6]!;
  const level = round5PlanetLevel(selector, spaceType);
  const typeByte = locationBytes[8]!;
  const planetType = round5PlanetType(typeByte, level, spaceType);
  const stats = round5PlanetStats({
    level,
    planetType,
    spaceType,
    capacityBonus: locationBytes[9]! < 16,
    growthBonus: locationBytes[10]! < 16,
    rangeBonus: locationBytes[11]! < 16,
    speedBonus: locationBytes[12]! < 16,
    defenseBonus: locationBytes[13]! < 16,
    halfJunk: locationBytes[14]! < 16,
  });
  const spaceIndex = ['Nebula', 'Space', 'DeepSpace', 'DeadSpace'].indexOf(spaceType);
  const biome = spaceType === 'DeadSpace'
    ? 10
    : spaceIndex * 3 + (world.biomebase < 14 ? 1 : world.biomebase < 17 ? 2 : 3);
  const distanceFromHome = Math.hypot(
    coordinates[0] - homeCoordinates[0],
    coordinates[1] - homeCoordinates[1],
  );
  return {
    ...stats,
    id: world.locationId,
    locationId: world.locationId,
    name: `IS-${world.locationId.slice(-5).toUpperCase()}`,
    x: coordinates[0],
    y: coordinates[1],
    biome,
    biomebase: world.biomebase,
    owner: 'neutral',
    isHome: false,
    discovered: discovered ?? distanceFromHome <= 220,
    destroyed: false,
    lastUpdatedAt: now,
    upgrades: { defense: 0, range: 0, speed: 0 },
    artifactIds: [],
    artifactFound: false,
    revealed: false,
    captured: false,
    titanCount: 0,
    defaultEnergy: stats.energy,
    defaultSpaceJunk: stats.spaceJunk,
  };
}

export function createStrategyGame(input: {
  universeSeed: string;
  homeId: string;
  homeName: string;
  homeLocation: MinedRound5Location;
}): StrategyGame {
  if (!isRound5HomeLocation(input.homeLocation)) {
    throw new StrategyRuleError('Home must be a verified level-0 Regular planet in the Round-5 home band.');
  }
  const coordinates = [input.homeLocation.x, input.homeLocation.y] as const;
  const home: StrategyPlanet = {
    ...generatePlanet(coordinates, 0, coordinates, true),
    id: input.homeId,
    name: input.homeName,
    owner: 'player',
    isHome: true,
    energy: 50_000,
    spaceJunk: 0,
    defaultEnergy: 0,
    defaultSpaceJunk: 0,
  };
  const planets = [home];
  const captureEpoch = 0;
  return {
    schemaVersion: 5,
    rulesetId: ROUND5_RULESET_ID,
    rulesetVersion: ROUND5_RULESET_VERSION,
    universeSeed: input.universeSeed,
    now: 0,
    checkpoint: 0,
    worldRadius: LOCAL_WORLD_RADIUS,
    scanRadius: 220,
    selectedPlanetId: home.id,
    planets,
    voyages: [],
    artifacts: [],
    shipsClaimed: false,
    captureZones: captureZonesFor(input.universeSeed, captureEpoch, LOCAL_WORLD_RADIUS),
    captureEpoch,
    score: 0,
    spaceJunk: 0,
    spaceJunkLimit: 2_000,
    scans: 0,
    exploredChunks: [],
    discoveryModel: 'mined-chunks-v1',
    explorationOrigin: { x: home.x, y: home.y },
    settled: false,
    log: [{
      id: 'genesis',
      at: 0,
      tone: 'success',
      message: `${input.homeName} established. Start the explorer to uncover the surrounding fog.`,
    }],
  };
}

export function selectStrategyPlanet(game: StrategyGame, planetId?: string): StrategyGame {
  if (planetId === undefined) return { ...game, selectedPlanetId: undefined, targetPlanetId: undefined };
  const planet = requirePlanet(game, planetId);
  if (!planet.discovered) throw new StrategyRuleError('That location is still unknown.');
  return { ...game, selectedPlanetId: planetId, targetPlanetId: undefined };
}

/** Hide legacy pre-revealed bootstrap neighbors without deleting any Planet data.
 * Preserve explored/visited locations and old explicit radial-demo scan results.
 */
export function normalizeStrategyDiscovery(game: StrategyGame): StrategyGame {
  if (game.discoveryModel === 'mined-chunks-v1') return game;
  const chunks = game.exploredChunks ?? [];
  const legacyRadialScan = chunks.length === 0 && game.scans > 1;
  const visited = new Set(game.voyages.flatMap((voyage) => [voyage.fromPlanetId, voyage.toPlanetId]));
  const planets = game.planets.map((planet) => ({ ...planet, discovered: planet.discovered && (
    planet.isHome || planet.owner !== 'neutral' || planet.revealed || planet.captured ||
    planet.artifactIds.length > 0 || visited.has(planet.id) || legacyRadialScan || locationInChunks(planet, chunks) ||
    game.log.some((entry) => entry.id !== 'genesis' && entry.message.includes(planet.name))
  ) }));
  const known = new Set(planets.filter((planet) => planet.discovered).map((planet) => planet.id));
  return { ...game, planets, discoveryModel: 'mined-chunks-v1',
    selectedPlanetId: game.selectedPlanetId && known.has(game.selectedPlanetId) ? game.selectedPlanetId : undefined,
    targetPlanetId: game.targetPlanetId && known.has(game.targetPlanetId) ? game.targetPlanetId : undefined };
}

export function setStrategyTarget(game: StrategyGame, planetId?: string): StrategyGame {
  if (planetId === undefined) return { ...game, targetPlanetId: undefined };
  const planet = requirePlanet(game, planetId);
  if (!planet.discovered) throw new StrategyRuleError('That location is still unknown.');
  if (planetId === game.selectedPlanetId) return { ...game, targetPlanetId: undefined };
  return { ...game, targetPlanetId: planetId };
}

export function scanStrategyUniverse(game: StrategyGame): StrategyGame {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  const nextRadius = Math.min(game.worldRadius, game.scanRadius + 350);
  const home = game.planets.find((planet) => planet.isHome);
  if (!home) throw new StrategyRuleError('The local universe has no founding planet.');
  const planets = game.planets.map((planet) => ({
    ...copyPlanet(planet),
    discovered: planet.discovered || Math.hypot(planet.x - home.x, planet.y - home.y) <= nextRadius,
  }));
  const discovered = planets.filter((planet) => planet.discovered).length
    - game.planets.filter((planet) => planet.discovered).length;
  return addLog(
    { ...game, planets, scanRadius: nextRadius, scans: game.scans + 1 },
    'info',
    discovered > 0 ? `Private scan resolved ${discovered} new planets.` : 'No new planets in this scan band.',
  );
}

/**
 * Returns the next deterministic square-spiral batch. `scans` starts at one
 * for the pinned bootstrap slice, so batch zero is the first Worker request.
 */
export function nextStrategyMinerBatch(game: StrategyGame): Round5MinerChunk[] {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  const home = game.planets.find((planet) => planet.isHome);
  if (!home) throw new StrategyRuleError('The local universe has no founding planet.');
  return nextExplorationBatch(game.explorationOrigin ?? home, game.worldRadius,
    game.exploredChunks ?? [], 0).chunks;
}

/**
 * Revalidates Worker output on the main thread, then reveals cached locations
 * or adds newly mined Round-5 planets. No private coordinate is published.
 */
export function mergeMinedStrategyLocations(
  game: StrategyGame,
  locations: readonly MinedRound5Location[],
  chunks: readonly Round5MinerChunk[],
): StrategyGame {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  const home = game.planets.find((planet) => planet.isHome);
  if (!home) throw new StrategyRuleError('The local universe has no founding planet.');

  round5MinerTotal(chunks);
  const exploredChunks = mergeExploredChunks(game.exploredChunks ?? [], chunks);
  const byLocationId = new Map(game.planets.map((planet) => [planet.locationId, copyPlanet(planet)]));
  let discovered = 0;
  let added = 0;
  for (const candidate of locations) {
    const world = round5WorldLocation({ x: candidate.x, y: candidate.y });
    if (
      !world || !locationInChunks(candidate, chunks) ||
      world.locationId !== candidate.locationId ||
      world.perlin !== candidate.perlin ||
      world.biomebase !== candidate.biomebase ||
      Math.hypot(candidate.x, candidate.y) >= game.worldRadius
    ) {
      continue;
    }
    const existing = byLocationId.get(candidate.locationId);
    if (existing) {
      if (!existing.discovered) discovered += 1;
      existing.discovered = true;
      byLocationId.set(existing.locationId, existing);
      continue;
    }
    const planet = generatePlanet(
      [candidate.x, candidate.y],
      game.now,
      [home.x, home.y],
      true,
    );
    byLocationId.set(planet.locationId, planet);
    discovered += 1;
    added += 1;
  }

  const frontier = chunks.reduce((radius, chunk) => {
    const corners = [
      [chunk.x, chunk.y],
      [chunk.x + chunk.side - 1, chunk.y],
      [chunk.x, chunk.y + chunk.side - 1],
      [chunk.x + chunk.side - 1, chunk.y + chunk.side - 1],
    ] as const;
    return corners.reduce((value, [x, y]) =>
      Math.max(value, Math.hypot(x - home.x, y - home.y)), radius);
  }, game.scanRadius);
  const next = {
    ...game,
    planets: [...byLocationId.values()],
    scanRadius: Math.min(game.worldRadius, Math.max(game.scanRadius, Math.ceil(frontier))),
    scans: game.scans + 1,
    exploredChunks,
  };
  if (discovered === 0) return next;
  return addLog(
    next,
    'success',
    `Explorer discovered ${discovered} planet${discovered === 1 ? '' : 's'}${added > 0 ? ` (${added} new locations)` : ''}.`,
  );
}

function prepareStrategyRoute(game: StrategyGame, sourceId: string, targetId: string) {
  let source = refreshPlanet(requirePlanet(game, sourceId), game.now);
  const target = refreshPlanet(requirePlanet(game, targetId), game.now);
  const distance = distanceBetween(source, target);
  let artifacts = game.artifacts.map(copyArtifact);
  const sourceActive = artifactOnPlanet(game, source, source.activeArtifactId);
  const targetActive = artifactOnPlanet(game, target, target.activeArtifactId);
  const wormhole = sourceActive?.type === 'Wormhole' && sourceActive.wormholeToPlanetId === target.id
    ? sourceActive
    : targetActive?.type === 'Wormhole' && targetActive.wormholeToPlanetId === source.id
      ? targetActive
      : undefined;
  const wormholeBoost = wormhole ? ([1, 2, 4, 8, 16, 32][wormhole.rarity] ?? 1) : 1;
  const effectiveDistanceTimesHundred = Math.floor((distance * 100) / wormholeBoost);
  let routeRange = source.range;
  let routeSpeed = source.speed;
  let routeLabel = wormhole ? ` via R${wormhole.rarity} Wormhole` : '';
  let arrivalType: StrategyVoyage['arrivalType'] = wormhole ? 'Wormhole' : 'Normal';
  if (
    sourceActive?.type === 'PhotoidCannon' &&
    sourceActive.lastActivatedAt !== undefined &&
    game.now - sourceActive.lastActivatedAt >= PHOTOID_ACTIVATION_DELAY
  ) {
    const deactivated = deactivateArtifactState(source, sourceActive, game.now, true);
    source = deactivated.planet;
    artifacts = artifacts.map((artifact) => artifact.id === sourceActive.id
      ? deactivated.artifact
      : artifact);
    routeRange *= 2;
    routeSpeed *= [1, 5, 10, 15, 20, 25][sourceActive.rarity] ?? 1;
    arrivalType = 'Photoid';
    routeLabel += ` with R${sourceActive.rarity} Photoid`;
  }
  return { source, target, artifacts, distance, effectiveDistanceTimesHundred, routeRange, routeSpeed, routeLabel, arrivalType };
}

export function strategySendingEnergy(energy: number, percentage: number): number {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return 0;
  return Math.max(0, Math.min(Math.floor(energy) - 1, Math.floor(energy * Math.min(98, percentage) / 100)));
}

/** Direct-space guidance only. Wormholes are endpoint-specific and use the full target quote. */
export function previewStrategyFreeSpace(
  game: StrategyGame, sourceId: string, point: { x: number; y: number }, energyPercentage = 50, abandon = false,
) {
  const route = prepareStrategyRoute(game, sourceId, sourceId);
  const sent = abandon ? route.source.energy : strategySendingEnergy(route.source.energy, energyPercentage);
  const range = abandon ? Math.floor(route.source.range * 1.5) : route.routeRange;
  const speed = abandon ? Math.floor(route.source.speed * 1.5) : route.routeSpeed;
  const capacity = route.source.energyCapacity;
  if (![sent, range, speed, capacity].every(Number.isFinite) || range <= 0 || speed <= 0 || capacity < 0) {
    throw new StrategyRuleError('The source has invalid route statistics.');
  }
  const arriving = (distance: number) => round5ArrivingEnergy(sent, distance, range, capacity);
  let maxDistance = Math.max(0, Math.floor(range * Math.log2(sent / (capacity / 20 + 1))));
  if (!Number.isFinite(maxDistance)) maxDistance = 0;
  // The ring ends at the last integer proof bound with at least one arriving energy.
  if (!Number.isSafeInteger(maxDistance)) throw new StrategyRuleError('The source exceeds exact route range limits.');
  if (arriving(maxDistance + 1) > 0) maxDistance += 1;
  if (maxDistance > 0 && arriving(maxDistance) <= 0) maxDistance -= 1;
  const distance = Number(routeDistanceBound(route.source, point));
  return { distance, energySent: sent, energyArriving: arriving(distance),
    travelTime: round5TravelTime(distance, speed), maxDistance };
}

function quoteStrategyRoute(
  game: StrategyGame,
  route: ReturnType<typeof prepareStrategyRoute>,
  energyPercentage: number,
  silverMoved: number,
) {
  const { source, target, distance, effectiveDistanceTimesHundred, routeRange, routeSpeed, arrivalType } = route;
  const energySent = strategySendingEnergy(source.energy, energyPercentage);
  const energyArriving = round5ArrivingEnergy(energySent, effectiveDistanceTimesHundred / 100, routeRange, source.energyCapacity);
  const travelTime = Math.max(1, Math.floor(effectiveDistanceTimesHundred / routeSpeed));
  const friendly = target.owner === 'player';
  // Hostile Wormhole arrivals transfer no energy, matching settlement.
  const defenseDamage = friendly || arrivalType === 'Wormhole' ? 0 : Math.floor(energyArriving * 100 / target.defense);
  let error: string | undefined;
  if (source.id === target.id) error = 'Choose a different destination.';
  else if (source.owner !== 'player') error = 'Only controlled planets can send a fleet.';
  else if (source.destroyed || target.destroyed) error = 'Destroyed planets cannot route voyages.';
  else if (!Number.isFinite(energyPercentage) || energyPercentage < 0 || energyPercentage > 100) error = 'Energy percentage must be between 0 and 100.';
  else if (energySent <= 0 || energySent >= source.energy) error = 'A normal voyage must leave positive energy behind.';
  else if (!Number.isFinite(silverMoved) || silverMoved < 0 || silverMoved > source.silver) error = 'The source does not hold that much silver.';
  else if (energyArriving <= 0) error = 'Not enough energy survives this route.';
  else if (pendingArrivalClassCount(game, target, 'player') >= 6) error = 'The target already has six pending arrivals in this class.';
  else if (game.spaceJunk + target.spaceJunk > game.spaceJunkLimit) error = 'The route exceeds the commander space-junk limit.';
  return { distance, energySent, energyArriving, travelTime, friendly, defenseDamage, spaceJunk: target.spaceJunk, arrivalType, error };
}

/** Read-only normal-fleet prediction, using the exact dispatch route and rounding. */
export function previewStrategyVoyage(game: StrategyGame, sourceId: string, targetId: string, energyPercentage = 50, silverMoved = 0) {
  return quoteStrategyRoute(game, prepareStrategyRoute(game, sourceId, targetId), energyPercentage, silverMoved);
}

export function dispatchStrategyVoyage(
  game: StrategyGame,
  energyPercentage = 50,
  silverMoved = 0,
  carriedArtifactId?: string,
): StrategyGame {
  if (!game.targetPlanetId) throw new StrategyRuleError('Select a target planet first.');
  const route = prepareStrategyRoute(game, requirePlanet(game, game.selectedPlanetId).id, game.targetPlanetId);
  let { source, target, artifacts } = route;
  const { distance, routeLabel, arrivalType } = route;
  const { energySent, energyArriving, travelTime, error } = quoteStrategyRoute(game, route, energyPercentage, silverMoved);
  if (error) throw new StrategyRuleError(error);
  let carriedArtifact = carriedArtifactId
    ? artifacts.find((artifact) => artifact.id === carriedArtifactId)
    : undefined;
  if (carriedArtifact) {
    if (isShip(carriedArtifact.type)) throw new StrategyRuleError('Spaceships use their zero-energy route.');
    if (carriedArtifact.planetId !== source.id || !source.artifactIds.includes(carriedArtifact.id)) {
      throw new StrategyRuleError('The carried artifact is not on the source planet.');
    }
    if (carriedArtifact.active || source.activeArtifactId === carriedArtifact.id) {
      throw new StrategyRuleError('Deactivate an artifact before moving it.');
    }
    if (target.artifactIds.length >= 5) throw new StrategyRuleError('The target already holds five artifacts.');
  } else if (carriedArtifactId) {
    throw new StrategyRuleError('Unknown carried artifact.');
  }
  source = { ...source, energy: source.energy - energySent, silver: source.silver - silverMoved };
  let spaceJunk = game.spaceJunk;
  if (target.spaceJunk > 0) {
    if (spaceJunk + target.spaceJunk > game.spaceJunkLimit) {
      throw new StrategyRuleError('The route exceeds the commander space-junk limit.');
    }
    spaceJunk += target.spaceJunk;
    target = { ...target, spaceJunk: 0 };
  }
  const voyage: StrategyVoyage = {
    id: `voyage-${game.now}-${game.voyages.length}-${source.id}-${target.id}`,
    player: 'player',
    fromPlanetId: source.id,
    toPlanetId: target.id,
    energySent,
    energyArriving,
    silverMoved,
    departureAt: game.now,
    arrivalAt: game.now + travelTime,
    distance,
    kind: 'fleet',
    arrivalType,
    carriedArtifactId: carriedArtifact?.id,
  };
  if (carriedArtifact) {
    source = { ...source, artifactIds: source.artifactIds.filter((id) => id !== carriedArtifact!.id) };
    carriedArtifact = { ...carriedArtifact, planetId: undefined, voyageId: voyage.id };
    artifacts = artifacts.map((artifact) => artifact.id === carriedArtifact!.id
      ? carriedArtifact!
      : artifact);
  }
  const planets = game.planets.map((planet) =>
    planet.id === source.id ? source : planet.id === target.id ? target : copyPlanet(planet));
  return addLog(
    { ...game, planets, artifacts, voyages: [...game.voyages, voyage], spaceJunk },
    'info',
    `Fleet launched from ${source.name} to ${target.name}${routeLabel}; arrival in ${travelTime}s.`,
  );
}

export function dispatchStrategyArtifact(
  game: StrategyGame,
  artifactId: string,
  energyPercentage = 50,
  silverMoved = 0,
): StrategyGame {
  return dispatchStrategyVoyage(game, energyPercentage, silverMoved, artifactId);
}

function applyArrival(game: StrategyGame, voyage: StrategyVoyage): StrategyGame {
  const target = refreshPlanet(requirePlanet(game, voyage.toPlanetId), voyage.arrivalAt);
  if (voyage.kind === 'ship') {
    const artifact = game.artifacts.find((candidate) => candidate.id === voyage.carriedArtifactId);
    if (!artifact) throw new StrategyRuleError('The ship voyage has no matching artifact.');
    const nextTarget = attachArtifactEffects(target, artifact);
    const artifacts = game.artifacts.map((candidate) => candidate.id === artifact.id
      ? { ...copyArtifact(candidate), planetId: target.id, voyageId: undefined }
      : copyArtifact(candidate));
    const planets = game.planets.map((planet) => planet.id === target.id ? nextTarget : copyPlanet(planet));
    return addLog(
      { ...game, planets, artifacts },
      'success',
      `${artifact.type} arrived at ${target.name} without changing control.`,
    );
  }
  const nextTarget = copyPlanet(target);
  let tone: StrategyLogEntry['tone'] = 'info';
  let message: string;
  if (target.owner === voyage.player) {
    nextTarget.energy += voyage.energyArriving;
    message = `${target.name} reinforced by ${voyage.energyArriving.toLocaleString()} energy.`;
  } else if (voyage.arrivalType === 'Wormhole') {
    message = `${target.name} rejected hostile Wormhole energy; cargo still arrived.`;
  } else {
    const combat = round5ResolveHostileCombat(target.energy, target.defense, voyage.energyArriving);
    nextTarget.energy = combat.energy;
    if (combat.conquered) {
      nextTarget.owner = voyage.player;
      tone = 'success';
      message = `${target.name} conquered with ${combat.energy.toLocaleString()} energy remaining.`;
    } else {
      tone = voyage.player === 'player' ? 'danger' : 'info';
      message = `${target.name} held with ${combat.energy.toLocaleString()} energy.`;
    }
  }
  if (nextTarget.planetType === 'SilverBank' || nextTarget.titanCount > 0) {
    nextTarget.energy = Math.min(nextTarget.energy, nextTarget.energyCapacity);
  }
  nextTarget.silver = Math.min(nextTarget.silverCapacity, nextTarget.silver + voyage.silverMoved);
  let artifacts = game.artifacts.map(copyArtifact);
  if (voyage.carriedArtifactId) {
    const carried = artifacts.find((artifact) => artifact.id === voyage.carriedArtifactId);
    if (!carried || carried.voyageId !== voyage.id || carried.burned) {
      throw new StrategyRuleError('The fleet artifact location is inconsistent.');
    }
    nextTarget.artifactIds.push(carried.id);
    artifacts = artifacts.map((artifact) => artifact.id === carried.id
      ? { ...artifact, planetId: nextTarget.id, voyageId: undefined }
      : artifact);
  }
  const planets = game.planets.map((planet) => planet.id === nextTarget.id ? nextTarget : copyPlanet(planet));
  return addLog({ ...game, planets, artifacts }, tone, message);
}

export function advanceStrategyToNextArrival(game: StrategyGame): StrategyGame {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  const arrivalAt = game.voyages.reduce<number | undefined>(
    (earliest, voyage) => earliest === undefined ? voyage.arrivalAt : Math.min(earliest, voyage.arrivalAt),
    undefined,
  );
  if (arrivalAt === undefined) throw new StrategyRuleError('There is no pending voyage.');
  let next: StrategyGame = {
    ...game,
    now: arrivalAt,
    checkpoint: game.checkpoint + (arrivalAt - game.now),
    planets: game.planets.map((planet) => refreshPlanet(planet, arrivalAt)),
  };
  next = refreshCaptureEpoch(next);
  const arrivals = next.voyages
    .filter((voyage) => voyage.arrivalAt <= arrivalAt)
    .sort((left, right) => left.arrivalAt - right.arrivalAt || left.id.localeCompare(right.id));
  next = { ...next, voyages: next.voyages.filter((voyage) => voyage.arrivalAt > arrivalAt) };
  for (const arrival of arrivals) next = applyArrival(next, arrival);
  return next;
}

export function advanceStrategyTime(game: StrategyGame, seconds: number): StrategyGame {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  if (!Number.isInteger(seconds) || seconds <= 0) throw new StrategyRuleError('Time advance must be positive.');
  const targetTime = game.now + seconds;
  let next = game;
  while (next.voyages.some((voyage) => voyage.arrivalAt <= targetTime)) {
    next = advanceStrategyToNextArrival(next);
  }
  const checkpointDelta = targetTime - next.now;
  return refreshCaptureEpoch({
    ...next,
    now: targetTime,
    checkpoint: next.checkpoint + checkpointDelta,
    planets: next.planets.map((planet) => refreshPlanet(planet, targetTime)),
  });
}

/** Advance the local simulation by elapsed real seconds, including time away.
 * Existing saves start their clock now; they are not interpreted as Unix time.
 */
export function synchronizeStrategyClock(game: StrategyGame, observedAtMs: number): StrategyGame {
  if (!Number.isSafeInteger(observedAtMs) || observedAtMs < 0) throw new StrategyRuleError('Invalid local clock observation.');
  if (game.settled) return game;
  if (game.wallClockAtMs === undefined) return { ...game, wallClockAtMs: observedAtMs };
  if (!Number.isSafeInteger(game.wallClockAtMs) || game.wallClockAtMs < 0) throw new StrategyRuleError('Invalid saved local clock.');
  const seconds = Math.floor((observedAtMs - game.wallClockAtMs) / 1000);
  if (seconds <= 0) return game;
  if (!Number.isSafeInteger(game.now + seconds) || !Number.isSafeInteger(game.checkpoint + seconds)) {
    throw new StrategyRuleError('Local clock exceeds the exact simulation range.');
  }
  return { ...advanceStrategyTime(game, seconds), wallClockAtMs: game.wallClockAtMs + seconds * 1000 };
}

export function upgradeStrategyPlanet(
  game: StrategyGame,
  branch: Round5UpgradeBranch,
): StrategyGame {
  let planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  if (planet.owner !== 'player' || planet.destroyed) throw new StrategyRuleError('Only an intact controlled planet may upgrade.');
  if (planet.planetType !== 'Regular' || planet.level === 0) {
    throw new StrategyRuleError('Only regular planets above level zero may upgrade.');
  }
  const total = planet.upgrades.defense + planet.upgrades.range + planet.upgrades.speed;
  const maxTotal = planet.spaceType === 'Nebula' ? 3 : planet.spaceType === 'Space' ? 4 : 5;
  if (total >= maxTotal || planet.upgrades[branch] >= 4) {
    throw new StrategyRuleError('This upgrade limit has been reached.');
  }
  const cost = round5UpgradeCost(planet.silverCapacity, total);
  if (planet.silver < cost) throw new StrategyRuleError(`Upgrade requires ${cost.toLocaleString()} silver.`);
  planet = {
    ...planet,
    silver: planet.silver - cost,
    energyCapacity: Math.floor(planet.energyCapacity * 1.2),
    energyGrowth: Math.floor(planet.energyGrowth * 1.2),
    defense: branch === 'defense' ? Math.floor(planet.defense * 1.2) : planet.defense,
    range: branch === 'range' ? Math.floor(planet.range * 1.25) : planet.range,
    speed: branch === 'speed' ? Math.floor(planet.speed * 1.75) : planet.speed,
    upgrades: { ...planet.upgrades, [branch]: planet.upgrades[branch] + 1 },
  };
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? planet : copyPlanet(candidate));
  return addLog({ ...game, planets }, 'success', `${planet.name} upgraded ${branch} for ${cost.toLocaleString()} silver.`);
}

export function controlledPlanetCount(game: StrategyGame): number {
  return game.planets.filter((planet) => planet.owner === 'player').length;
}

export function claimStrategyStartingShips(game: StrategyGame): StrategyGame {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  if (game.shipsClaimed) throw new StrategyRuleError('The five starting ships were already claimed.');
  const home = game.planets.find((planet) => planet.isHome && planet.owner === 'player');
  if (!home) throw new StrategyRuleError('A controlled home planet is required.');
  let nextHome = copyPlanet(home);
  const ships = SHIP_TYPES.map<StrategyArtifact>((type, index) => ({
    id: `ship-${fnv1a(`${game.universeSeed}:${home.id}:${type}:${index}`).toString(16)}`,
    type,
    rarity: 0,
    controller: 'player',
    planetId: home.id,
    activations: 0,
    active: false,
    biome: 0,
    mintedAt: game.now,
    burned: false,
  }));
  for (const ship of ships) nextHome = attachArtifactEffects(nextHome, ship);
  const planets = game.planets.map((planet) => planet.id === home.id ? nextHome : copyPlanet(planet));
  return addLog(
    { ...game, planets, artifacts: [...game.artifacts.map(copyArtifact), ...ships], shipsClaimed: true },
    'success',
    'Five Round 5 ships deployed at the home planet.',
  );
}

export function dispatchStrategyShip(game: StrategyGame, artifactId: string): StrategyGame {
  if (!game.targetPlanetId) throw new StrategyRuleError('Select a target planet first.');
  const artifact = game.artifacts.find((candidate) => candidate.id === artifactId);
  if (!artifact || !isShip(artifact.type) || artifact.controller !== 'player') {
    throw new StrategyRuleError('Only your spaceship can use a ship route.');
  }
  if (artifact.planetId !== game.selectedPlanetId) {
    throw new StrategyRuleError('Select the planet currently hosting that ship.');
  }
  let source = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  const target = refreshPlanet(requirePlanet(game, game.targetPlanetId), game.now);
  if (source.id === target.id || target.destroyed) throw new StrategyRuleError('Choose another intact destination.');
  if (!source.artifactIds.includes(artifact.id)) throw new StrategyRuleError('Ship location is inconsistent.');
  if (target.artifactIds.length >= 5) throw new StrategyRuleError('The target already holds five artifacts.');
  const pendingClass = pendingArrivalClassCount(game, target, 'neutral');
  if (pendingClass >= 6) throw new StrategyRuleError('The target already has six pending arrivals in this class.');
  source = detachArtifactEffects(source, artifact);
  const distance = distanceBetween(source, target);
  const fromActive = artifactOnPlanet(game, source, source.activeArtifactId);
  const toActive = artifactOnPlanet(game, target, target.activeArtifactId);
  const wormhole = fromActive?.type === 'Wormhole' && fromActive.wormholeToPlanetId === target.id
    ? fromActive : toActive?.type === 'Wormhole' && toActive.wormholeToPlanetId === source.id ? toActive : undefined;
  const divisor = wormhole ? ([1, 2, 4, 8, 16, 32][wormhole.rarity] ?? 1) : 1;
  const travelTime = Math.max(1, Math.floor(Math.floor(distance * 100 / divisor) / source.speed));
  const voyageId = `ship-voyage-${game.now}-${game.voyages.length}-${artifact.id}`;
  const voyage: StrategyVoyage = {
    id: voyageId,
    player: 'neutral',
    fromPlanetId: source.id,
    toPlanetId: target.id,
    energySent: 0,
    energyArriving: 0,
    silverMoved: 0,
    departureAt: game.now,
    arrivalAt: game.now + travelTime,
    distance,
    kind: 'ship',
    carriedArtifactId: artifact.id,
  };
  const planets = game.planets.map((planet) =>
    planet.id === source.id ? source : planet.id === target.id ? target : copyPlanet(planet));
  const artifacts = game.artifacts.map((candidate) => candidate.id === artifact.id
    ? { ...copyArtifact(candidate), planetId: undefined, voyageId }
    : copyArtifact(candidate));
  return addLog(
    { ...game, planets, artifacts, voyages: [...game.voyages, voyage] },
    'info',
    `${artifact.type} launched toward ${target.name} with zero energy and silver.`,
  );
}

export function activateStrategyCrescent(game: StrategyGame, artifactId: string): StrategyGame {
  const artifact = game.artifacts.find((candidate) => candidate.id === artifactId);
  if (!artifact || artifact.type !== 'Crescent' || !artifact.planetId) {
    throw new StrategyRuleError('Choose a Crescent currently resting on a planet.');
  }
  if (artifact.controller !== 'player') throw new StrategyRuleError('Only your Crescent may activate.');
  const planet = refreshPlanet(requirePlanet(game, artifact.planetId), game.now);
  if (artifact.activations !== 0) throw new StrategyRuleError('Crescent activates only once.');
  if (planet.owner !== 'neutral' || planet.level < 1 || planet.planetType === 'SilverMine') {
    throw new StrategyRuleError('Crescent requires an unowned level-one-or-higher non-mine.');
  }
  const mineDefaults = round5PlanetStats({
    level: planet.level,
    planetType: 'SilverMine',
    spaceType: planet.spaceType,
  });
  const nextPlanet: StrategyPlanet = {
    ...copyPlanet(planet),
    planetType: 'SilverMine',
    silver: planet.silver === 0 ? 1 : planet.silver,
    silverGrowth: planet.silverGrowth === 0 ? mineDefaults.silverGrowth : planet.silverGrowth,
  };
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  const artifacts = game.artifacts.map((candidate) => candidate.id === artifact.id
    ? { ...copyArtifact(candidate), activations: 1, active: false }
    : copyArtifact(candidate));
  return addLog(
    { ...game, planets, artifacts },
    'success',
    `${planet.name} was permanently converted into a Silver Mine by Crescent.`,
  );
}

function artifactCooldownSeconds(type: StrategyArtifactType): number {
  if (type === 'Wormhole' || type === 'PlanetaryShield') return 4 * 3600;
  if (type === 'PhotoidCannon' || type === 'BloomFilter' || type === 'BlackDomain') return 24 * 3600;
  return 0;
}

export function activateStrategyArtifact(
  game: StrategyGame,
  artifactId: string,
  wormholeToPlanetId = game.targetPlanetId,
): StrategyGame {
  const artifact = game.artifacts.find((candidate) => candidate.id === artifactId);
  if (!artifact || isShip(artifact.type) || artifact.burned || !artifact.planetId) {
    throw new StrategyRuleError('Choose an intact non-ship artifact on a planet.');
  }
  let planet = refreshPlanet(requirePlanet(game, artifact.planetId), game.now);
  if (planet.owner !== 'player' || planet.destroyed) {
    throw new StrategyRuleError('Only an intact controlled planet may activate an artifact.');
  }
  if (planet.activeArtifactId) throw new StrategyRuleError('This planet already has an active artifact.');
  if (artifact.lastDeactivatedAt !== undefined) {
    const readyAfter = artifact.lastDeactivatedAt + artifactCooldownSeconds(artifact.type);
    if (game.now <= readyAfter) throw new StrategyRuleError(`Artifact cooldown ends after ${readyAfter}s.`);
  }
  if (artifact.type === 'Wormhole') {
    if (!wormholeToPlanetId || wormholeToPlanetId === planet.id) {
      throw new StrategyRuleError('Choose another controlled planet as the Wormhole endpoint.');
    }
    const endpoint = requirePlanet(game, wormholeToPlanetId);
    if (endpoint.owner !== 'player' || endpoint.destroyed) {
      throw new StrategyRuleError('A Wormhole endpoint must be another intact controlled planet.');
    }
  }
  if ((artifact.type === 'BloomFilter' || artifact.type === 'BlackDomain') && artifact.rarity * 2 < planet.level) {
    throw new StrategyRuleError('This artifact is not powerful enough for the planet level.');
  }
  let nextArtifact: StrategyArtifact = {
    ...copyArtifact(artifact),
    activations: artifact.activations + 1,
    active: true,
    lastActivatedAt: game.now,
    wormholeToPlanetId: artifact.type === 'Wormhole' ? wormholeToPlanetId : undefined,
  };
  if (artifact.type === 'BloomFilter') {
    planet = { ...planet, energy: planet.energyCapacity, silver: planet.silverCapacity };
    const burned = deactivateArtifactState(planet, nextArtifact, game.now, true);
    planet = burned.planet;
    nextArtifact = burned.artifact;
  } else if (artifact.type === 'BlackDomain') {
    planet = { ...planet, destroyed: true };
    const burned = deactivateArtifactState(planet, nextArtifact, game.now, true);
    planet = burned.planet;
    nextArtifact = burned.artifact;
  } else {
    planet = applyArtifactUpgrade(planet, nextArtifact);
    planet.activeArtifactId = nextArtifact.id;
  }
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? planet : copyPlanet(candidate));
  const artifacts = game.artifacts.map((candidate) => candidate.id === artifact.id
    ? nextArtifact
    : copyArtifact(candidate));
  const suffix = nextArtifact.burned ? ' and burned on use' : '';
  return addLog({ ...game, planets, artifacts }, 'success', `${artifact.type} activated on ${planet.name}${suffix}.`);
}

export function deactivateStrategyArtifact(
  game: StrategyGame,
  artifactId?: string,
): StrategyGame {
  let planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  const selectedArtifactId = artifactId ?? planet.activeArtifactId;
  const artifact = artifactOnPlanet(game, planet, selectedArtifactId);
  if (planet.owner !== 'player' || planet.destroyed || !artifact?.active) {
    throw new StrategyRuleError('Select a controlled planet with an active artifact.');
  }
  const burn = artifact.type === 'PlanetaryShield' || artifact.type === 'PhotoidCannon';
  const deactivated = deactivateArtifactState(planet, artifact, game.now, burn);
  planet = deactivated.planet;
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? planet : copyPlanet(candidate));
  const artifacts = game.artifacts.map((candidate) => candidate.id === artifact.id
    ? deactivated.artifact
    : copyArtifact(candidate));
  return addLog(
    { ...game, planets, artifacts },
    'info',
    `${artifact.type} deactivated on ${planet.name}${burn ? ' and burned' : ''}.`,
  );
}

export function withdrawStrategyArtifact(game: StrategyGame, artifactId: string): StrategyGame {
  const planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  const artifact = artifactOnPlanet(game, planet, artifactId);
  if (planet.owner !== 'player' || planet.planetType !== 'SpacetimeRip' || planet.destroyed) {
    throw new StrategyRuleError('Artifact warp-out requires a controlled intact Spacetime Rip.');
  }
  if (!artifact || isShip(artifact.type) || artifact.active || planet.level <= artifact.rarity) {
    throw new StrategyRuleError('The Spacetime Rip cannot warp out this artifact.');
  }
  const nextPlanet = { ...copyPlanet(planet), artifactIds: planet.artifactIds.filter((id) => id !== artifact.id) };
  const artifacts = game.artifacts.map((candidate) => candidate.id === artifact.id
    ? { ...copyArtifact(candidate), planetId: undefined, externalOwner: 'player' as const }
    : copyArtifact(candidate));
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog({ ...game, planets, artifacts }, 'success', `${artifact.type} warped into wallet custody.`);
}

export function depositStrategyArtifact(game: StrategyGame, artifactId: string): StrategyGame {
  const planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  const artifact = game.artifacts.find((candidate) => candidate.id === artifactId);
  if (planet.owner !== 'player' || planet.planetType !== 'SpacetimeRip' || planet.destroyed) {
    throw new StrategyRuleError('Artifact warp-in requires a controlled intact Spacetime Rip.');
  }
  if (!artifact || artifact.externalOwner !== 'player' || isShip(artifact.type) || planet.level <= artifact.rarity) {
    throw new StrategyRuleError('The Spacetime Rip cannot warp in this wallet artifact.');
  }
  if (planet.artifactIds.length >= 5) throw new StrategyRuleError('The Spacetime Rip already holds five artifacts.');
  const nextPlanet = copyPlanet(planet);
  nextPlanet.artifactIds.push(artifact.id);
  const artifacts = game.artifacts.map((candidate) => candidate.id === artifact.id
    ? { ...copyArtifact(candidate), planetId: planet.id, externalOwner: undefined }
    : copyArtifact(candidate));
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog({ ...game, planets, artifacts }, 'success', `${artifact.type} warped into ${planet.name}.`);
}

export function prospectStrategyPlanet(game: StrategyGame): StrategyGame {
  const planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  if (planet.owner !== 'player' || planet.planetType !== 'Ruins' || planet.destroyed) {
    throw new StrategyRuleError('Prospecting requires a controlled, intact Ruins planet.');
  }
  if (planet.prospectedAt !== undefined || planet.artifactFound) {
    throw new StrategyRuleError('This Ruins planet was already prospected.');
  }
  const gearPresent = planet.artifactIds.some((id) => game.artifacts.some((artifact) =>
    artifact.id === id && artifact.type === 'Gear' && artifact.controller === 'player'));
  if (!gearPresent) throw new StrategyRuleError('Move your Gear ship here before prospecting.');
  const nextPlanet = { ...copyPlanet(planet), prospectedAt: game.checkpoint };
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog({ ...game, planets }, 'info', `${planet.name} committed a prospect seed.`);
}

export function findStrategyArtifact(game: StrategyGame): StrategyGame {
  const planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  if (planet.owner !== 'player' || planet.planetType !== 'Ruins' || planet.destroyed) {
    throw new StrategyRuleError('Artifact discovery requires a controlled Ruins planet.');
  }
  if (planet.prospectedAt === undefined || game.checkpoint <= planet.prospectedAt) {
    throw new StrategyRuleError('Advance at least one time unit after prospecting.');
  }
  if (game.checkpoint - planet.prospectedAt >= 256) throw new StrategyRuleError('The 256-block prospect window expired.');
  if (planet.artifactFound) throw new StrategyRuleError('This planet already yielded an artifact.');
  if (planet.artifactIds.length >= 5) throw new StrategyRuleError('The planet already holds five artifacts.');
  const gearPresent = planet.artifactIds.some((id) => game.artifacts.some((artifact) =>
    artifact.id === id && artifact.type === 'Gear' && artifact.controller === 'player'));
  if (!gearPresent) throw new StrategyRuleError('Gear must remain present through discovery.');
  const roll = fnv1a(`${game.universeSeed}:${planet.id}:${planet.prospectedAt}`);
  const { artifactType, levelBonus } = round5ArtifactTypeAndBonus(roll % 255, Math.floor(roll / 256) % 255);
  const namesByCode: Record<number, StrategyArtifactType> = {
    1: 'Monolith', 2: 'Colossus', 4: 'Pyramid', 5: 'Wormhole', 6: 'PlanetaryShield',
    7: 'PhotoidCannon', 8: 'BloomFilter', 9: 'BlackDomain',
  };
  const type: StrategyArtifactType = namesByCode[artifactType] ?? 'Monolith';
  const rarity = round5ArtifactRarity(planet.level + levelBonus);
  const artifact: StrategyArtifact = {
    id: `artifact-${roll.toString(16)}-${planet.id}`,
    type,
    rarity,
    planetId: planet.id,
    activations: 0,
    active: false,
    biome: 1 + (Math.floor(roll / 65_536) % 10),
    mintedAt: game.now,
    burned: false,
  };
  const nextPlanet = copyPlanet(planet);
  nextPlanet.artifactFound = true;
  nextPlanet.artifactIds.push(artifact.id);
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog(
    {
      ...game,
      planets,
      artifacts: [...game.artifacts.map(copyArtifact), artifact],
      score: game.score + (ARTIFACT_SCORE[rarity] ?? 0),
    },
    'success',
    `${type} (${['Unknown', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythic'][rarity]}) discovered.`,
  );
}

function planetInsideCurrentCaptureZone(game: StrategyGame, planet: StrategyPlanet): boolean {
  return game.captureZones.some((zone) => Math.hypot(planet.x - zone.x, planet.y - zone.y) <= zone.radius);
}

export function invadeStrategyPlanet(game: StrategyGame): StrategyGame {
  const planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  if (planet.owner !== 'player' || planet.destroyed) {
    throw new StrategyRuleError('Only a controlled, intact planet may invade a capture zone.');
  }
  if (!planetInsideCurrentCaptureZone(game, planet)) throw new StrategyRuleError('This planet is outside every current capture zone.');
  if (planet.invadedAt !== undefined || planet.captured) throw new StrategyRuleError('This planet was already invaded or captured.');
  const nextPlanet = { ...copyPlanet(planet), invadedAt: game.checkpoint };
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog({ ...game, planets }, 'info', `${planet.name} began the 2,048-block capture hold.`);
}

export function captureStrategyPlanet(game: StrategyGame): StrategyGame {
  const planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  if (planet.owner !== 'player' || planet.destroyed || planet.invadedAt === undefined) {
    throw new StrategyRuleError('A currently controlled invaded planet is required.');
  }
  if (planet.captured) throw new StrategyRuleError('This planet was already captured.');
  if (game.checkpoint < planet.invadedAt + 2_048) throw new StrategyRuleError('The 2,048-block hold is not complete.');
  if (!round5CaptureEnergyEligible(planet.energy, planet.energyCapacity)) {
    throw new StrategyRuleError('The contract energy predicate is not satisfied.');
  }
  const nextPlanet = { ...copyPlanet(planet), captured: true };
  const score = round5CaptureScore(planet.level);
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog({ ...game, planets, score: game.score + score }, 'success', `${planet.name} captured for ${score.toLocaleString()} points.`);
}

export function revealStrategyPlanet(game: StrategyGame, planetId = game.selectedPlanetId): StrategyGame {
  const planet = requirePlanet(game, planetId);
  if (!planet.discovered) throw new StrategyRuleError('Only a locally discovered planet can be revealed.');
  if (planet.revealed) throw new StrategyRuleError('That location is already globally revealed.');
  if (game.lastRevealAt !== undefined && game.now - game.lastRevealAt <= 10_800) {
    throw new StrategyRuleError('Public reveal has a strict three-hour cooldown.');
  }
  const nextPlanet = { ...copyPlanet(planet), revealed: true };
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog({ ...game, planets, lastRevealAt: game.now }, 'info', `${planet.name} coordinates were publicly revealed.`);
}

export function withdrawStrategySilver(game: StrategyGame, amount?: number): StrategyGame {
  const planet = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  if (planet.owner !== 'player' || planet.planetType !== 'SpacetimeRip' || planet.destroyed) {
    throw new StrategyRuleError('Silver may be extracted only through a controlled Spacetime Rip.');
  }
  const withdrawn = amount ?? Math.floor(planet.silver);
  if (!Number.isInteger(withdrawn) || withdrawn <= 0 || withdrawn > planet.silver) {
    throw new StrategyRuleError('Choose a positive silver amount held by the Spacetime Rip.');
  }
  const nextPlanet = { ...copyPlanet(planet), silver: planet.silver - withdrawn };
  const score = round5SilverScore(withdrawn);
  const planets = game.planets.map((candidate) => candidate.id === planet.id ? nextPlanet : copyPlanet(candidate));
  return addLog({ ...game, planets, score: game.score + score }, 'success', `${withdrawn.toLocaleString()} silver extracted through the Rip for ${score.toLocaleString()} points.`);
}

export function abandonStrategyPlanet(game: StrategyGame, carriedArtifactId?: string): StrategyGame {
  if (!game.targetPlanetId) throw new StrategyRuleError('Select an abandonment target first.');
  let source = refreshPlanet(requirePlanet(game, game.selectedPlanetId), game.now);
  let target = refreshPlanet(requirePlanet(game, game.targetPlanetId), game.now);
  if (source.owner !== 'player' || source.isHome) throw new StrategyRuleError('A controlled non-home planet is required.');
  if (source.destroyed || target.destroyed || source.id === target.id) throw new StrategyRuleError('Abandonment requires two distinct intact planets.');
  if (game.voyages.some((voyage) => voyage.toPlanetId === source.id)) {
    throw new StrategyRuleError('A planet with incoming voyages cannot be abandoned.');
  }
  if (pendingArrivalClassCount(game, target, 'player') >= 6) {
    throw new StrategyRuleError('The target already has six pending arrivals in this class.');
  }
  const distance = distanceBetween(source, target);
  let artifacts = game.artifacts.map(copyArtifact);
  const sourceActive = artifactOnPlanet(game, source, source.activeArtifactId);
  const targetActive = artifactOnPlanet(game, target, target.activeArtifactId);
  const wormhole = sourceActive?.type === 'Wormhole' && sourceActive.wormholeToPlanetId === target.id
    ? sourceActive
    : targetActive?.type === 'Wormhole' && targetActive.wormholeToPlanetId === source.id
      ? targetActive
      : undefined;
  const wormholeDivisor = wormhole ? ([1, 2, 4, 8, 16, 32][wormhole.rarity] ?? 1) : 1;
  let arrivalType: StrategyVoyage['arrivalType'] = wormhole ? 'Wormhole' : 'Normal';
  if (
    sourceActive?.type === 'PhotoidCannon' &&
    sourceActive.lastActivatedAt !== undefined &&
    game.now - sourceActive.lastActivatedAt >= PHOTOID_ACTIVATION_DELAY
  ) {
    const deactivated = deactivateArtifactState(source, sourceActive, game.now, true);
    source = deactivated.planet;
    artifacts = artifacts.map((artifact) => artifact.id === sourceActive.id
      ? deactivated.artifact
      : artifact);
    // Round 5 consumes the Photoid, then abandonment replaces its temporary
    // stat upgrade. Its arrival-type precedence remains observable.
    arrivalType = 'Photoid';
  }
  let carriedArtifact = carriedArtifactId
    ? artifacts.find((artifact) => artifact.id === carriedArtifactId)
    : undefined;
  if (carriedArtifact) {
    if (isShip(carriedArtifact.type)) throw new StrategyRuleError('Spaceships use their zero-energy route.');
    if (carriedArtifact.planetId !== source.id || !source.artifactIds.includes(carriedArtifact.id)) {
      throw new StrategyRuleError('The carried artifact is not on the abandoned planet.');
    }
    if (carriedArtifact.active || source.activeArtifactId === carriedArtifact.id) {
      throw new StrategyRuleError('Deactivate an artifact before moving it.');
    }
    if (target.artifactIds.length >= 5) throw new StrategyRuleError('The target already holds five artifacts.');
  } else if (carriedArtifactId) {
    throw new StrategyRuleError('Unknown carried artifact.');
  }
  const sentEnergy = source.energy;
  const sentSilver = source.silver;
  const effectiveDistance = distance / wormholeDivisor;
  const arriving = round5ArrivingEnergy(
    sentEnergy,
    effectiveDistance,
    Math.floor(source.range * 1.5),
    source.energyCapacity,
  );
  if (arriving <= 0) throw new StrategyRuleError('Not enough energy survives the abandonment route.');
  const junkAfterReturn = Math.max(0, game.spaceJunk - source.defaultSpaceJunk);
  if (junkAfterReturn + target.spaceJunk > game.spaceJunkLimit) {
    throw new StrategyRuleError('The target junk would exceed the commander limit.');
  }
  const spaceJunk = junkAfterReturn + target.spaceJunk;
  target = { ...target, spaceJunk: 0 };
  source = {
    ...source,
    owner: 'neutral',
    energy: source.defaultEnergy * 2,
    silver: 0,
    spaceJunk: source.defaultSpaceJunk,
  };
  const travelTime = round5TravelTime(effectiveDistance, Math.floor(source.speed * 1.5));
  const voyage: StrategyVoyage = {
    id: `abandon-${game.now}-${source.id}-${target.id}`,
    player: 'player',
    fromPlanetId: source.id,
    toPlanetId: target.id,
    energySent: sentEnergy,
    energyArriving: arriving,
    silverMoved: sentSilver,
    departureAt: game.now,
    arrivalAt: game.now + travelTime,
    distance,
    kind: 'abandon',
    arrivalType,
    carriedArtifactId: carriedArtifact?.id,
  };
  if (carriedArtifact) {
    source = { ...source, artifactIds: source.artifactIds.filter((id) => id !== carriedArtifact!.id) };
    carriedArtifact = { ...carriedArtifact, planetId: undefined, voyageId: voyage.id };
    artifacts = artifacts.map((artifact) => artifact.id === carriedArtifact!.id
      ? carriedArtifact!
      : artifact);
  }
  const planets = game.planets.map((planet) =>
    planet.id === source.id ? source : planet.id === target.id ? target : copyPlanet(planet));
  return addLog(
    { ...game, planets, artifacts, voyages: [...game.voyages, voyage], spaceJunk },
    'danger',
    `${source.name} abandoned; all energy and silver are in flight.`,
  );
}

export function settleStrategyGame(game: StrategyGame): StrategyGame {
  if (game.settled) throw new StrategyRuleError('This local round is already settled.');
  if (game.voyages.length > 0) {
    throw new StrategyRuleError('Resolve every pending voyage before Last Light settlement.');
  }
  return addLog(
    { ...game, settled: true, settledAt: game.now, finalScore: game.score },
    'success',
    `Last Light finalized with ${game.score.toLocaleString()} points.`,
  );
}
