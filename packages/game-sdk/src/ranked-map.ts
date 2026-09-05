import { bcs } from '@mysten/sui/bcs';
import { deriveObjectID, normalizeSuiAddress } from '@mysten/sui/utils';
import {
  PLANET_TYPES,
  ROUND5_RULESET_VERSION,
  SPACE_TYPES,
  round5HomeStats,
  round5PlanetLevel,
  round5PlanetStats,
  round5PlanetType,
  round5SpaceType,
  type Round5PlanetStats,
} from './round5-rules';
import {
  ROUND5_FIELD_MODULUS,
  ROUND5_BIOMEBASE_KEY,
  round5MimcSponge,
  round5Perlin,
} from './round5-universe';
import type {
  PlanetProjection,
  RankedUniverseProjection,
  VoyageProjection,
} from './ranked-projection';
import type { PlayerSeatBundle } from './sui-player-runtime';

const CANONICAL_ADDRESS = /^0x[0-9a-f]{64}$/;
const LOCATION_ID = /^[0-9a-f]{64}$/;
const MAX_U64 = 0xffff_ffff_ffff_ffffn;
const ZERO_ADDRESS = `0x${'0'.repeat(64)}`;
const PRIVATE_MAP_PREFIX = 'infinite-stellar:ranked-private-map:v1';
const PROOF_INTERFACE_VERSION = 1n;

const PlanetClaimKeyBcs = bcs.struct('PlanetClaimKey', {
  encoding_version: bcs.u64(),
  season_id: bcs.Address,
  location_commitment: bcs.vector(bcs.u8()),
});

export class RankedMapError extends Error {
  constructor(
    readonly code:
      | 'INVALID_IDENTITY'
      | 'INVALID_VAULT'
      | 'VAULT_MISMATCH'
      | 'INVALID_LOCATION'
      | 'CHAIN_MISMATCH',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'RankedMapError';
  }
}

export interface RankedMapIdentity {
  schemaVersion: 1;
  network: 'mainnet';
  chainIdentifier: string;
  packageId: string;
  typeOriginPackageId: string;
  seasonId: string;
  planetRegistryId: string;
  seatId: string;
  controllerAddress: string;
}

export interface RankedPrivateLocation {
  locationId: string;
  x: number;
  y: number;
  perlin: number;
  biomebase: number;
  discoveredAtMs: number;
}

export interface RankedPrivateMapRecord extends RankedMapIdentity {
  locations: RankedPrivateLocation[];
  updatedAtMs: number;
}

export interface RankedMapPlanet {
  objectId: string;
  locationId: string;
  x: number;
  y: number;
  perlin: number;
  biomebase: number;
  owner: 'player' | 'rival' | 'neutral';
  materialized: boolean;
  isHome: boolean;
  level: number;
  planetType: (typeof PLANET_TYPES)[number];
  spaceType: (typeof SPACE_TYPES)[number];
  energy: bigint;
  energyCapacity: bigint;
  energyGrowth: bigint;
  range: bigint;
  speed: bigint;
  defense: bigint;
  silver: bigint;
  silverCapacity: bigint;
  silverGrowth: bigint;
  spaceJunk: bigint;
  destroyed: boolean;
  proofNonce: bigint;
  artifactIds: string[];
  activeArtifactId: string | null;
  chain: PlanetProjection | null;
}

export interface RankedMapVoyage {
  id: string;
  fromPlanetId: string;
  toPlanetId: string;
  owner: 'player' | 'rival';
  energyArriving: bigint;
  silverMoved: bigint;
  departureAtSeconds: bigint;
  arrivalAtSeconds: bigint;
  carriedArtifactId: string | null;
  kind: 'fleet' | 'ship' | 'abandon';
  chain: VoyageProjection;
}

export interface RankedMapView {
  identity: RankedMapIdentity;
  worldRadius: number;
  snapshotFingerprint: string;
  maxEventCheckpoint: string | null;
  planets: RankedMapPlanet[];
  voyages: RankedMapVoyage[];
  hiddenChainPlanets: number;
  hiddenVoyages: number;
  unmaterializedPlanets: number;
}

function canonicalAddress(value: unknown, label: string, code: RankedMapError['code']): string {
  if (typeof value !== 'string') throw new RankedMapError(code, `${label} must be a Sui address.`);
  let normalized: string;
  try {
    normalized = normalizeSuiAddress(value);
  } catch (error) {
    throw new RankedMapError(code, `${label} must be a Sui address.`, { cause: error });
  }
  if (!CANONICAL_ADDRESS.test(normalized)) {
    throw new RankedMapError(code, `${label} must be a canonical Sui address.`);
  }
  return normalized;
}

function safeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RankedMapError('INVALID_LOCATION', `${label} must be a safe integer.`);
  }
  return value;
}

function finiteInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new RankedMapError('INVALID_LOCATION', `${label} must be a safe integer.`);
  }
  return value;
}

function bytesFromLocationId(locationId: string): Uint8Array {
  return Uint8Array.from(
    { length: 32 },
    (_, index) => Number.parseInt(locationId.slice(index * 2, index * 2 + 2), 16),
  );
}

function privateMapIdentity(value: RankedMapIdentity): RankedMapIdentity {
  if (value.schemaVersion !== 1 || value.network !== 'mainnet') {
    throw new RankedMapError('INVALID_IDENTITY', 'Ranked map identity must use schema v1 on Sui mainnet.');
  }
  if (typeof value.chainIdentifier !== 'string' || value.chainIdentifier.length < 32) {
    throw new RankedMapError('INVALID_IDENTITY', 'The Sui chain identifier is missing or malformed.');
  }
  return {
    schemaVersion: 1,
    network: 'mainnet',
    chainIdentifier: value.chainIdentifier,
    packageId: canonicalAddress(value.packageId, 'Package ID', 'INVALID_IDENTITY'),
    typeOriginPackageId: canonicalAddress(
      value.typeOriginPackageId,
      'Type-origin package ID',
      'INVALID_IDENTITY',
    ),
    seasonId: canonicalAddress(value.seasonId, 'Season ID', 'INVALID_IDENTITY'),
    planetRegistryId: canonicalAddress(
      value.planetRegistryId,
      'PlanetRegistry ID',
      'INVALID_IDENTITY',
    ),
    seatId: canonicalAddress(value.seatId, 'Season Seat ID', 'INVALID_IDENTITY'),
    controllerAddress: canonicalAddress(
      value.controllerAddress,
      'Controller address',
      'INVALID_IDENTITY',
    ),
  };
}

function sameIdentity(left: RankedMapIdentity, right: RankedMapIdentity): boolean {
  return left.schemaVersion === right.schemaVersion &&
    left.network === right.network &&
    left.chainIdentifier === right.chainIdentifier &&
    left.packageId === right.packageId &&
    left.typeOriginPackageId === right.typeOriginPackageId &&
    left.seasonId === right.seasonId &&
    left.planetRegistryId === right.planetRegistryId &&
    left.seatId === right.seatId &&
    left.controllerAddress === right.controllerAddress;
}

export function rankedPrivateMapStorageKey(rawIdentity: RankedMapIdentity): string {
  const identity = privateMapIdentity(rawIdentity);
  return [
    PRIVATE_MAP_PREFIX,
    identity.chainIdentifier,
    identity.packageId,
    identity.typeOriginPackageId,
    identity.seasonId,
    identity.planetRegistryId,
    identity.seatId,
    identity.controllerAddress,
  ].join(':');
}

export function createRankedPrivateMapRecord(identity: RankedMapIdentity): RankedPrivateMapRecord {
  return { ...privateMapIdentity(identity), locations: [], updatedAtMs: 0 };
}

export function parseRankedPrivateMapRecord(raw: string): RankedPrivateMapRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const value = parsed as Partial<RankedPrivateMapRecord>;
  try {
    const identity = privateMapIdentity(value as RankedMapIdentity);
    if (!Array.isArray(value.locations) || !Number.isSafeInteger(value.updatedAtMs) || value.updatedAtMs! < 0) {
      return null;
    }
    const locations = value.locations.map((candidate, index) => {
      if (typeof candidate !== 'object' || candidate === null) {
        throw new RankedMapError('INVALID_VAULT', `Private location ${index} is malformed.`);
      }
      const location = candidate as Partial<RankedPrivateLocation>;
      if (typeof location.locationId !== 'string' || !LOCATION_ID.test(location.locationId)) {
        throw new RankedMapError('INVALID_VAULT', `Private location ${index} has an invalid location ID.`);
      }
      return {
        locationId: location.locationId,
        x: safeInteger(location.x, `Private location ${index} x`),
        y: safeInteger(location.y, `Private location ${index} y`),
        perlin: finiteInteger(location.perlin, `Private location ${index} Perlin`),
        biomebase: finiteInteger(location.biomebase, `Private location ${index} biomebase`),
        discoveredAtMs: safeInteger(location.discoveredAtMs, `Private location ${index} discovery time`),
      };
    });
    if (new Set(locations.map((location) => location.locationId)).size !== locations.length) return null;
    return { ...identity, locations, updatedAtMs: value.updatedAtMs! };
  } catch {
    return null;
  }
}

export function appendRankedPrivateLocations(
  record: RankedPrivateMapRecord,
  locations: readonly RankedPrivateLocation[],
  updatedAtMs: number,
): RankedPrivateMapRecord {
  const parsed = parseRankedPrivateMapRecord(JSON.stringify(record));
  if (!parsed) throw new RankedMapError('INVALID_VAULT', 'The existing private map record is malformed.');
  if (!Number.isSafeInteger(updatedAtMs) || updatedAtMs < parsed.updatedAtMs) {
    throw new RankedMapError('INVALID_VAULT', 'The private map update time must be monotonic.');
  }
  const merged = new Map(parsed.locations.map((location) => [location.locationId, location]));
  for (const location of locations) {
    const validated = parseRankedPrivateMapRecord(JSON.stringify({
      ...parsed,
      locations: [location],
      updatedAtMs,
    }))?.locations[0];
    if (!validated) throw new RankedMapError('INVALID_LOCATION', 'A private map location is malformed.');
    const existing = merged.get(validated.locationId);
    if (existing && (
      existing.x !== validated.x || existing.y !== validated.y ||
      existing.perlin !== validated.perlin || existing.biomebase !== validated.biomebase
    )) {
      throw new RankedMapError('INVALID_LOCATION', `Location ${validated.locationId} has conflicting private material.`);
    }
    merged.set(validated.locationId, existing ?? validated);
  }
  return {
    ...parsed,
    locations: [...merged.values()].sort((left, right) => left.locationId.localeCompare(right.locationId)),
    updatedAtMs,
  };
}

export function deriveRankedPlanetObjectId(
  identity: Pick<RankedMapIdentity, 'typeOriginPackageId' | 'seasonId' | 'planetRegistryId'>,
  locationId: string,
): string {
  const typeOriginPackageId = canonicalAddress(
    identity.typeOriginPackageId,
    'Type-origin package ID',
    'INVALID_IDENTITY',
  );
  const seasonId = canonicalAddress(identity.seasonId, 'Season ID', 'INVALID_IDENTITY');
  const registryId = canonicalAddress(
    identity.planetRegistryId,
    'PlanetRegistry ID',
    'INVALID_IDENTITY',
  );
  if (!LOCATION_ID.test(locationId)) {
    throw new RankedMapError('INVALID_LOCATION', 'A ranked location ID must be 32-byte lowercase hex.');
  }
  const key = PlanetClaimKeyBcs.serialize({
    encoding_version: PROOF_INTERFACE_VERSION,
    season_id: seasonId,
    location_commitment: bytesFromLocationId(locationId),
  }).toBytes();
  return deriveObjectID(registryId, `${typeOriginPackageId}::planet::PlanetClaimKey`, key);
}

function expectedLocation(
  projection: RankedUniverseProjection,
  location: RankedPrivateLocation,
): { hash: bigint; perlin: number; biomebase: number } {
  const { manifest } = projection;
  if (
    manifest.locationHashKey > MAX_U64 || manifest.spaceTypeKey > BigInt(Number.MAX_SAFE_INTEGER) ||
    manifest.perlinScale > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new RankedMapError('CHAIN_MISMATCH', 'The Season geometry exceeds the supported exact client range.');
  }
  const hash = round5MimcSponge([location.x, location.y], manifest.locationHashKey);
  const perlin = round5Perlin(
    { x: location.x, y: location.y },
    {
      key: Number(manifest.spaceTypeKey),
      scale: Number(manifest.perlinScale),
      mirrorX: manifest.perlinMirrorX,
      mirrorY: manifest.perlinMirrorY,
    },
  );
  const biomebase = round5Perlin(
    { x: location.x, y: location.y },
    {
      key: ROUND5_BIOMEBASE_KEY,
      scale: Number(manifest.perlinScale),
      mirrorX: manifest.perlinMirrorX,
      mirrorY: manifest.perlinMirrorY,
    },
  );
  return { hash, perlin, biomebase };
}

function expectedStats(locationId: string, perlin: number, isHome: boolean): Round5PlanetStats {
  if (isHome) {
    return round5HomeStats();
  }
  const bytes = bytesFromLocationId(locationId);
  const selector = bytes[4]! * 65_536 + bytes[5]! * 256 + bytes[6]!;
  const spaceType = round5SpaceType(perlin);
  const level = round5PlanetLevel(selector, spaceType);
  return round5PlanetStats({
    level,
    planetType: round5PlanetType(bytes[8]!, level, spaceType),
    spaceType,
    capacityBonus: bytes[9]! < 16,
    growthBonus: bytes[10]! < 16,
    rangeBonus: bytes[11]! < 16,
    speedBonus: bytes[12]! < 16,
    defenseBonus: bytes[13]! < 16,
    halfJunk: bytes[14]! < 16,
  });
}

function mappedPlanet(
  identity: RankedMapIdentity,
  seat: PlayerSeatBundle,
  projection: RankedUniverseProjection,
  location: RankedPrivateLocation,
  chain: PlanetProjection | null,
): RankedMapPlanet {
  const expected = expectedLocation(projection, location);
  if (
    expected.hash >= ROUND5_FIELD_MODULUS || expected.hash >= projection.manifest.planetHashThreshold ||
    expected.hash.toString(16).padStart(64, '0') !== location.locationId ||
    expected.perlin !== location.perlin || expected.biomebase !== location.biomebase
  ) {
    throw new RankedMapError(
      'INVALID_LOCATION',
      `Private location ${location.locationId} does not satisfy the pinned Season geometry.`,
    );
  }
  const radiusSquared = projection.manifest.worldRadius * projection.manifest.worldRadius;
  const x = BigInt(location.x);
  const y = BigInt(location.y);
  if (x * x + y * y >= radiusSquared) {
    throw new RankedMapError('INVALID_LOCATION', `Private location ${location.locationId} is outside the world radius.`);
  }
  const objectId = deriveRankedPlanetObjectId(identity, location.locationId);
  if (chain && (
    chain.objectId !== objectId || chain.locationHash !== expected.hash ||
    chain.locationCommitment.length !== 32 ||
    chain.locationCommitment.some((byte, index) => byte !== Number.parseInt(
      location.locationId.slice(index * 2, index * 2 + 2),
      16,
    ))
  )) {
    throw new RankedMapError(
      'CHAIN_MISMATCH',
      `Planet ${chain.objectId} does not match its deterministic private location binding.`,
    );
  }
  const isHome = seat.civilization.initialHomePlanetId === objectId;
  // Founding provenance survives conquest; current ownership is chain state, not a vault invariant.
  if (isHome && (!chain || !chain.isFoundingPlanet)) {
    throw new RankedMapError(
      'CHAIN_MISMATCH',
      `The Seat's founding Planet ${objectId} is missing or has an invalid chain binding.`,
    );
  }
  if (chain && chain.rulesetVersion !== BigInt(ROUND5_RULESET_VERSION)) {
    throw new RankedMapError('CHAIN_MISMATCH', `Planet ${objectId} has an unsupported ruleset version.`);
  }
  const stats = expectedStats(location.locationId, location.perlin, isHome);
  const ownerSeatId = chain?.ownerSeatId ?? ZERO_ADDRESS;
  const owner = ownerSeatId === identity.seatId
    ? 'player'
    : ownerSeatId === ZERO_ADDRESS ? 'neutral' : 'rival';
  const planetType = chain ? PLANET_TYPES[chain.planetType] : stats.planetType;
  const spaceType = chain ? SPACE_TYPES[chain.spaceType] : stats.spaceType;
  if (!planetType || !spaceType) {
    throw new RankedMapError('CHAIN_MISMATCH', `Planet ${objectId} has an unknown type index.`);
  }
  return {
    objectId,
    locationId: location.locationId,
    x: location.x,
    y: location.y,
    perlin: location.perlin,
    biomebase: location.biomebase,
    owner,
    materialized: chain !== null,
    isHome,
    level: chain?.level ?? stats.level,
    planetType,
    spaceType,
    energy: chain?.energy ?? BigInt(stats.energy),
    energyCapacity: chain?.energyCapacity ?? BigInt(stats.energyCapacity),
    energyGrowth: chain?.energyGrowth ?? BigInt(stats.energyGrowth),
    range: chain?.range ?? BigInt(stats.range),
    speed: chain?.speed ?? BigInt(stats.speed),
    defense: chain?.defense ?? BigInt(stats.defense),
    silver: chain?.silver ?? BigInt(stats.silver),
    silverCapacity: chain?.silverCapacity ?? BigInt(stats.silverCapacity),
    silverGrowth: chain?.silverGrowth ?? BigInt(stats.silverGrowth),
    spaceJunk: chain?.spaceJunk ?? BigInt(stats.spaceJunk),
    destroyed: chain?.destroyed ?? false,
    proofNonce: chain?.proofNonce ?? 0n,
    artifactIds: chain ? [...chain.artifactIds] : [],
    activeArtifactId: chain?.activeArtifactId ?? null,
    chain,
  };
}

function mappedVoyage(voyage: VoyageProjection, seatId: string): RankedMapVoyage {
  return {
    id: voyage.objectId,
    fromPlanetId: voyage.fromPlanetId,
    toPlanetId: voyage.toPlanetId,
    owner: voyage.controllerSeatId === seatId ? 'player' : 'rival',
    energyArriving: voyage.energyArriving,
    silverMoved: voyage.silverMoved,
    departureAtSeconds: voyage.departureAtSeconds,
    arrivalAtSeconds: voyage.arrivalAtSeconds,
    carriedArtifactId: voyage.carriedArtifactId,
    kind: voyage.isShip ? 'ship' : voyage.isAbandon ? 'abandon' : 'fleet',
    chain: voyage,
  };
}

export function mergeRankedPrivateMap(
  rawIdentity: RankedMapIdentity,
  seat: PlayerSeatBundle,
  projection: RankedUniverseProjection,
  record: RankedPrivateMapRecord,
): RankedMapView {
  const identity = privateMapIdentity(rawIdentity);
  const parsed = parseRankedPrivateMapRecord(JSON.stringify(record));
  if (!parsed) throw new RankedMapError('INVALID_VAULT', 'The private ranked map failed schema validation.');
  if (!sameIdentity(identity, parsed)) {
    throw new RankedMapError('VAULT_MISMATCH', 'The private map belongs to another chain, package, Season, Seat, or controller.');
  }
  if (
    seat.seatId !== identity.seatId || seat.seat.controller !== identity.controllerAddress ||
    seat.seat.seasonId !== identity.seasonId || projection.manifest.objectId !== identity.seasonId ||
    projection.runtime.seasonId !== identity.seasonId ||
    projection.manifest.planetRegistryId !== identity.planetRegistryId
  ) {
    throw new RankedMapError('CHAIN_MISMATCH', 'Seat and projection do not match the private-map namespace.');
  }
  if (projection.manifest.worldRadius > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RankedMapError('CHAIN_MISMATCH', 'The Season world radius exceeds the exact map-rendering range.');
  }
  const byHash = new Map<string, PlanetProjection>();
  for (const planet of projection.planets) {
    const locationId = planet.locationHash.toString(16).padStart(64, '0');
    if (byHash.has(locationId)) {
      throw new RankedMapError('CHAIN_MISMATCH', `Multiple Planet objects share location ${locationId}.`);
    }
    byHash.set(locationId, planet);
  }
  const planets = parsed.locations.map((location) => mappedPlanet(
    identity,
    seat,
    projection,
    location,
    byHash.get(location.locationId) ?? null,
  ));
  const visiblePlanetIds = new Set(planets.map((planet) => planet.objectId));
  const voyages = projection.voyages
    .filter((voyage) => visiblePlanetIds.has(voyage.fromPlanetId) && visiblePlanetIds.has(voyage.toPlanetId))
    .map((voyage) => mappedVoyage(voyage, identity.seatId));
  return {
    identity,
    worldRadius: Number(projection.manifest.worldRadius),
    snapshotFingerprint: projection.snapshotFingerprint,
    maxEventCheckpoint: projection.maxEventCheckpoint,
    planets: planets.sort((left, right) => left.locationId.localeCompare(right.locationId)),
    voyages: voyages.sort((left, right) => left.id.localeCompare(right.id)),
    hiddenChainPlanets: projection.planets.length - planets.filter((planet) => planet.materialized).length,
    hiddenVoyages: projection.voyages.length - voyages.length,
    unmaterializedPlanets: planets.filter((planet) => !planet.materialized).length,
  };
}
