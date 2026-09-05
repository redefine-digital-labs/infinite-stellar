import { describe, expect, it } from 'vitest';
import {
  ROUND5_BIOMEBASE_KEY,
  ROUND5_FIELD_MODULUS,
  ROUND5_PERLIN_SCALE,
  ROUND5_PLANET_HASH_KEY,
  ROUND5_SPACE_TYPE_KEY,
  appendRankedPrivateLocations,
  createRankedPrivateMapRecord,
  deriveRankedPlanetObjectId,
  mergeRankedPrivateMap,
  parseRankedPrivateMapRecord,
  rankedPrivateMapStorageKey,
  round5WorldLocation,
  type PlanetProjection,
  type PlayerSeatBundle,
  type RankedMapIdentity,
  type RankedUniverseProjection,
} from '../src/index';

const address = (value: string) => `0x${value.padStart(64, '0')}`;

const identity: RankedMapIdentity = {
  schemaVersion: 1,
  network: 'mainnet',
  chainIdentifier: '4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S',
  packageId: address('10'),
  typeOriginPackageId: address('11'),
  seasonId: address('12'),
  planetRegistryId: address('13'),
  seatId: address('14'),
  controllerAddress: address('15'),
};

function seat(initialHomePlanetId: string | null = null): PlayerSeatBundle {
  const version = (objectId: string) => ({
    objectId,
    version: '1',
    digest: `digest-${objectId}`,
    previousTransaction: 'tx',
  });
  return {
    status: 'enrolled',
    seatId: identity.seatId,
    seat: {
      ...version(identity.seatId),
      seasonId: identity.seasonId,
      league: 0,
      controller: identity.controllerAddress,
      soulId: address('20'),
      projectionId: address('21'),
      civilizationId: address('22'),
      scoreCardId: address('23'),
    },
    projection: {
      ...version(address('21')),
      soulidityPackageId: address('24'),
      soulStateId: address('25'),
      soulId: address('20'),
      controllerAtEnrollment: identity.controllerAddress,
      ownershipEpochAtEnrollment: 1n,
      projectionCommitment: new Uint8Array(32),
    },
    civilization: {
      ...version(address('22')),
      lifecycle: initialHomePlanetId ? 'Active' : 'AwaitingHome',
      controlledPlanetCount: initialHomePlanetId ? 1n : 0n,
      pendingVoyageCount: 0n,
      spaceJunk: 0n,
      spaceJunkLimit: 100n,
      shipsClaimed: false,
      lastRevealAtSeconds: null,
      initialHomePlanetId,
      homeClaimConsumed: Boolean(initialHomePlanetId),
      activatedOnce: Boolean(initialHomePlanetId),
    },
    scoreCard: {
      ...version(address('23')),
      score: 0n,
      pendingScoredArrivalCount: 0n,
    },
  };
}

function projection(planets: PlanetProjection[] = []): RankedUniverseProjection {
  return {
    manifest: {
      objectId: identity.seasonId,
      version: '1',
      digest: 'manifest-digest',
      previousTransaction: 'manifest-tx',
      versionNumber: 1n,
      league: 0,
      enrollmentCloseAtMs: 1n,
      universeOpenAtMs: 2n,
      homeClaimOpenAtMs: 3n,
      homeClaimCloseAtMs: 4n,
      seasonEndAtMs: 5n,
      seedObservationDelayMs: 1n,
      minimumHomeClaimWindowMs: 1n,
      maxHomeAvailabilityTickGapMs: 1n,
      maxRankedSeats: 100n,
      worldRadius: 10_000n,
      planetHashThreshold: ROUND5_FIELD_MODULUS / 12_000n,
      locationHashKey: BigInt(ROUND5_PLANET_HASH_KEY),
      spaceTypeKey: BigInt(ROUND5_SPACE_TYPE_KEY),
      perlinScale: BigInt(ROUND5_PERLIN_SCALE),
      perlinMirrorX: false,
      perlinMirrorY: false,
      homePerlinMin: 12,
      homePerlinMax: 13,
      rulesGeometryCommitment: 1n,
      proofNetworkField: 1n,
      claimHomeCircuit: { configId: address('30'), configDigest: 'a'.repeat(64), verifyingKeyDigest: 'b'.repeat(64) },
      moveCircuit: { configId: address('31'), configDigest: 'c'.repeat(64), verifyingKeyDigest: 'd'.repeat(64) },
      moveNewCircuit: { configId: address('32'), configDigest: 'e'.repeat(64), verifyingKeyDigest: 'f'.repeat(64) },
      enrollmentRegistryId: address('33'),
      runtimeId: address('34'),
      planetRegistryId: identity.planetRegistryId,
    },
    runtime: {
      objectId: address('34'),
      version: '1',
      digest: 'runtime-digest',
      previousTransaction: 'runtime-tx',
      seasonId: identity.seasonId,
      universeOpened: true,
      universeOpenedAtMs: 2n,
      universeSeed: new Uint8Array(32),
      homeClaimNotBeforeAtMs: 3n,
      paused: false,
      homeAvailabilityLastTickAtMs: 3n,
      accumulatedHomeClaimableMs: 1n,
      homeWindowResolution: 'Pending',
      cancelled: false,
      settlementStarted: false,
    },
    planets,
    voyages: [],
    maxEventCheckpoint: '77',
    scannedEvents: 2,
    snapshotFingerprint: '1'.repeat(64),
  };
}

function firstLocation() {
  const world = round5WorldLocation({ x: 73, y: 6421 });
  if (!world) throw new Error('Pinned test location is not a planet.');
  return {
    locationId: world.locationId,
    x: world.x,
    y: world.y,
    perlin: world.perlin,
    biomebase: world.biomebase,
    discoveredAtMs: 100,
  };
}

function chainPlanet(locationId: string, objectId: string): PlanetProjection {
  return {
    objectId,
    version: '9',
    digest: 'planet-digest',
    previousTransaction: 'planet-tx',
    seasonId: identity.seasonId,
    ownerSeatId: identity.seatId,
    locationHash: BigInt(`0x${locationId}`),
    locationCommitment: Uint8Array.from(
      { length: 32 },
      (_, index) => Number.parseInt(locationId.slice(index * 2, index * 2 + 2), 16),
    ),
    publicInputDigest: new Uint8Array(32),
    proofNonce: 2n,
    isFoundingPlanet: true,
    rulesetVersion: 1n,
    level: 0,
    planetType: 0,
    spaceType: 0,
    energy: 50_000n,
    energyCapacity: 100_000n,
    energyGrowth: 417n,
    range: 99n,
    speed: 75n,
    defense: 400n,
    silver: 0n,
    silverCapacity: 0n,
    silverGrowth: 0n,
    spaceJunk: 0n,
    defaultEnergy: 50_000n,
    defaultSpaceJunk: 0n,
    lastUpdatedAtSeconds: 10n,
    destroyed: false,
    pausers: 0n,
    upgrades: { defense: 0, range: 0, speed: 0 },
    pendingVoyages: [],
    artifactIds: [],
    activeArtifactId: null,
    prospectedCheckpoint: null,
    artifactFound: false,
    invaderSeatId: null,
    invadeStartCheckpoint: 0n,
    capturerSeatId: null,
    revealedX: null,
    revealedY: null,
    revealerSeatId: null,
  };
}

describe('ranked private map', () => {
  it('keeps a conquered founding planet visible with the chain-authoritative rival owner', () => {
    const location = firstLocation();
    const objectId = deriveRankedPlanetObjectId(identity, location.locationId);
    const record = appendRankedPrivateLocations(createRankedPrivateMapRecord(identity), [location], 100);
    const planet = { ...chainPlanet(location.locationId, objectId), ownerSeatId: `0x${'99'.padStart(64, '0')}` };
    const view = mergeRankedPrivateMap(identity, seat(objectId), projection([planet]), record);
    expect(view.planets[0]).toMatchObject({ isHome: true, owner: 'rival', materialized: true });
  });
  it('namespaces, parses, and appends private coordinates deterministically', () => {
    const empty = createRankedPrivateMapRecord(identity);
    const record = appendRankedPrivateLocations(empty, [firstLocation()], 100);
    expect(record.locations).toHaveLength(1);
    expect(parseRankedPrivateMapRecord(JSON.stringify(record))).toEqual(record);
    expect(rankedPrivateMapStorageKey(identity)).toContain(identity.seatId);
    expect(ROUND5_BIOMEBASE_KEY).toBe(117);
  });

  it('derives the claimed Planet address and merges exact chain state', () => {
    const location = firstLocation();
    const objectId = deriveRankedPlanetObjectId(identity, location.locationId);
    const record = appendRankedPrivateLocations(createRankedPrivateMapRecord(identity), [location], 100);
    const view = mergeRankedPrivateMap(
      identity,
      seat(objectId),
      projection([chainPlanet(location.locationId, objectId)]),
      record,
    );
    expect(view.planets).toMatchObject([{
      objectId,
      owner: 'player',
      materialized: true,
      isHome: true,
      energy: 50_000n,
      proofNonce: 2n,
    }]);
    expect(view.hiddenChainPlanets).toBe(0);
    expect(view.unmaterializedPlanets).toBe(0);
  });

  it('keeps locally discovered but unmaterialized planets explicitly non-authoritative', () => {
    const record = appendRankedPrivateLocations(
      createRankedPrivateMapRecord(identity),
      [firstLocation()],
      100,
    );
    const view = mergeRankedPrivateMap(identity, seat(), projection(), record);
    expect(view.planets[0]).toMatchObject({ materialized: false, owner: 'neutral', chain: null });
    expect(view.unmaterializedPlanets).toBe(1);
  });

  it('rejects cross-Seat records, coordinate tampering, and object substitution', () => {
    const location = firstLocation();
    const record = appendRankedPrivateLocations(createRankedPrivateMapRecord(identity), [location], 100);
    expect(() => mergeRankedPrivateMap(
      { ...identity, seatId: address('99') },
      seat(),
      projection(),
      record,
    )).toThrow(/another chain, package, Season, Seat, or controller/);

    expect(() => mergeRankedPrivateMap(
      identity,
      seat(),
      projection(),
      { ...record, locations: [{ ...location, x: location.x + 1 }] },
    )).toThrow(/does not satisfy the pinned Season geometry/);

    expect(() => mergeRankedPrivateMap(
      identity,
      seat(address('88')),
      projection([chainPlanet(location.locationId, address('88'))]),
      record,
    )).toThrow(/deterministic private location binding/);
  });
});
