import { bcs } from '@mysten/sui/bcs';
import type { SuiClientTypes } from '@mysten/sui/client';
import { describe, expect, it, vi } from 'vitest';
import {
  readRankedUniverseProjection,
  type InfiniteStellarDeployment,
  type RankedProjectionClient,
} from '../src';

const id = (byte: string) => `0x${byte.repeat(32)}`;
const PACKAGE = id('10');
const ORIGIN = id('11');
const SEASON = id('12');
const RUNTIME = id('13');
const ENROLLMENT = id('14');
const PLANET_REGISTRY = id('15');
const HOME = id('21');
const TARGET = id('22');
const VOYAGE = id('23');
const SEAT = id('24');
const DIGEST = '11111111111111111111111111111111';

const CircuitBindingBcs = bcs.struct('CircuitBinding', {
  config_id: bcs.Address,
  config_digest: bcs.vector(bcs.u8()),
  verifying_key_digest: bcs.vector(bcs.u8()),
});
const SeasonManifestBcs = bcs.struct('SeasonManifest', {
  id: bcs.Address,
  version: bcs.u64(),
  league: bcs.u8(),
  enrollment_close_at_ms: bcs.u64(),
  universe_open_at_ms: bcs.u64(),
  home_claim_open_at_ms: bcs.u64(),
  home_claim_close_at_ms: bcs.u64(),
  season_end_at_ms: bcs.u64(),
  seed_observation_delay_ms: bcs.u64(),
  minimum_home_claim_window_ms: bcs.u64(),
  max_home_availability_tick_gap_ms: bcs.u64(),
  max_ranked_seats: bcs.u64(),
  world_radius: bcs.u64(),
  planet_hash_threshold: bcs.u256(),
  location_hash_key: bcs.u64(),
  space_type_key: bcs.u64(),
  perlin_scale: bcs.u64(),
  perlin_mirror_x: bcs.bool(),
  perlin_mirror_y: bcs.bool(),
  home_perlin_min: bcs.u8(),
  home_perlin_max: bcs.u8(),
  rules_geometry_commitment: bcs.u256(),
  proof_network_field: bcs.u256(),
  claim_home_circuit: CircuitBindingBcs,
  move_circuit: CircuitBindingBcs,
  move_new_circuit: CircuitBindingBcs,
  enrollment_registry_id: bcs.Address,
  runtime_id: bcs.Address,
  planet_registry_id: bcs.Address,
});
const SeasonRuntimeBcs = bcs.struct('SeasonRuntime', {
  id: bcs.Address,
  season_id: bcs.Address,
  universe_opened: bcs.bool(),
  universe_opened_at_ms: bcs.u64(),
  universe_seed: bcs.vector(bcs.u8()),
  home_claim_not_before_at_ms: bcs.u64(),
  paused: bcs.bool(),
  home_availability_last_tick_at_ms: bcs.u64(),
  accumulated_home_claimable_ms: bcs.u64(),
  home_window_resolution: bcs.u8(),
  cancelled: bcs.bool(),
  settlement_started: bcs.bool(),
});
const PendingVoyageBcs = bcs.struct('PendingVoyage', {
  voyage_id: bcs.Address,
  player_seat_id: bcs.Address,
  arrival_at_seconds: bcs.u64(),
});
const PlanetBcs = bcs.struct('Planet', {
  id: bcs.Address,
  season_id: bcs.Address,
  owner_seat_id: bcs.Address,
  location_hash: bcs.u256(),
  location_commitment: bcs.vector(bcs.u8()),
  public_input_digest: bcs.vector(bcs.u8()),
  proof_nonce: bcs.u64(),
  is_founding_planet: bcs.bool(),
  ruleset_version: bcs.u64(),
  level: bcs.u8(),
  planet_type: bcs.u8(),
  space_type: bcs.u8(),
  energy: bcs.u64(),
  energy_capacity: bcs.u64(),
  energy_growth: bcs.u64(),
  range: bcs.u64(),
  speed: bcs.u64(),
  defense: bcs.u64(),
  silver: bcs.u64(),
  silver_capacity: bcs.u64(),
  silver_growth: bcs.u64(),
  space_junk: bcs.u64(),
  defaults: bcs.struct('PlanetDefaults', { energy: bcs.u64(), space_junk: bcs.u64() }),
  last_updated_at_seconds: bcs.u64(),
  destroyed: bcs.bool(),
  pausers: bcs.u64(),
  upgrades: bcs.struct('UpgradeLevels', { defense: bcs.u8(), range: bcs.u8(), speed: bcs.u8() }),
  pending_voyages: bcs.vector(PendingVoyageBcs),
  artifacts: bcs.struct('PlanetArtifactState', {
    ids: bcs.vector(bcs.Address),
    active_id: bcs.option(bcs.Address),
    prospected_checkpoint: bcs.option(bcs.u64()),
    found: bcs.bool(),
  }),
  capture: bcs.struct('PlanetCaptureState', {
    invader_seat_id: bcs.option(bcs.Address),
    invade_start_checkpoint: bcs.u64(),
    capturer_seat_id: bcs.option(bcs.Address),
  }),
  reveal: bcs.struct('PlanetRevealState', {
    x: bcs.option(bcs.vector(bcs.u8())),
    y: bcs.option(bcs.vector(bcs.u8())),
    revealer_seat_id: bcs.option(bcs.Address),
  }),
});
const VoyageBcs = bcs.struct('Voyage', {
  id: bcs.Address,
  season_id: bcs.Address,
  controller_seat_id: bcs.Address,
  player_seat_id: bcs.Address,
  from_planet_id: bcs.Address,
  to_planet_id: bcs.Address,
  energy_arriving: bcs.u64(),
  silver_moved: bcs.u64(),
  departure_at_seconds: bcs.u64(),
  arrival_at_seconds: bcs.u64(),
  max_distance: bcs.u64(),
  public_input_digest: bcs.vector(bcs.u8()),
  carried_artifact_id: bcs.option(bcs.Address),
  is_ship: bcs.bool(),
  is_abandon: bcs.bool(),
  route_kind: bcs.u8(),
});
const FoundingEventBcs = bcs.struct('FoundingPlanetClaimed', {
  season_id: bcs.Address, seat_id: bcs.Address, planet_id: bcs.Address,
});
const NeutralEventBcs = bcs.struct('NeutralPlanetInitialized', {
  season_id: bcs.Address, planet_id: bcs.Address,
  level: bcs.u8(), planet_type: bcs.u8(), space_type: bcs.u8(),
});
const DispatchedEventBcs = bcs.struct('VoyageDispatched', {
  season_id: bcs.Address, voyage_id: bcs.Address, player_seat_id: bcs.Address,
  from_planet_id: bcs.Address, to_planet_id: bcs.Address,
  arrival_at_seconds: bcs.u64(), is_abandon: bcs.bool(),
});
const SettledEventBcs = bcs.struct('VoyageSettled', {
  season_id: bcs.Address, voyage_id: bcs.Address, player_seat_id: bcs.Address,
  to_planet_id: bcs.Address, conquered: bcs.bool(),
});

const digestBytes = (value: number) => new Uint8Array(32).fill(value);
const circuit = (byte: string, value: number) => ({
  objectId: id(byte),
  circuitId: `circuit-${byte}`,
  circuitVersion: 1,
  artifactManifestSha256: 'aa'.repeat(32),
  configDigest: value.toString(16).padStart(2, '0').repeat(32),
  verifyingKeyDigest: (value + 1).toString(16).padStart(2, '0').repeat(32),
});
const CLAIM = circuit('31', 1);
const MOVE = circuit('32', 3);
const MOVE_NEW = circuit('33', 5);
const DEPLOYMENT: InfiniteStellarDeployment = {
  network: 'mainnet',
  packageId: PACKAGE,
  manifestId: SEASON,
  runtimeId: RUNTIME,
  enrollmentRegistryId: ENROLLMENT,
  planetRegistryId: PLANET_REGISTRY,
  randomObjectId: id('08'),
  clockObjectId: id('06'),
  soulidityCallablePackageId: id('60'),
  soulidityOriginalPackageId: id('a4'),
  claimHomeCircuitConfig: CLAIM,
  moveCircuitConfig: MOVE,
  moveNewCircuitConfig: MOVE_NEW,
  proofIntent: {
    network: 'sui:mainnet', rulesetId: 'round5', league: 1,
    rulesGeometryCommitment: '4444',
  },
  seatRouting: { keyTypeOriginPackageId: ORIGIN, keyEncodingVersion: 1, league: 1 },
  productionSoulAdapterReady: false,
  productionProofVerifierReady: false,
};

function object(
  objectId: string,
  type: string,
  content: Uint8Array,
  objectDigest = DIGEST,
): SuiClientTypes.Object<{ content: true; previousTransaction: true }> {
  return {
    objectId, version: '7', digest: objectDigest,
    owner: { $kind: 'Shared', Shared: { initialSharedVersion: '1' } },
    type, content: Uint8Array.from(content), previousTransaction: DIGEST,
    objectBcs: undefined, json: undefined, display: undefined,
  };
}

function manifestObject() {
  const binding = (pin: typeof CLAIM, config: number, key: number) => ({
    config_id: pin.objectId,
    config_digest: digestBytes(config),
    verifying_key_digest: digestBytes(key),
  });
  return object(SEASON, `${ORIGIN}::season::SeasonManifest`, SeasonManifestBcs.serialize({
    id: SEASON, version: 1, league: 1,
    enrollment_close_at_ms: 10, universe_open_at_ms: 20,
    home_claim_open_at_ms: 30, home_claim_close_at_ms: 100,
    season_end_at_ms: 200, seed_observation_delay_ms: 5,
    minimum_home_claim_window_ms: 50, max_home_availability_tick_gap_ms: 10,
    max_ranked_seats: 300, world_radius: 1000, planet_hash_threshold: 9999,
    location_hash_key: 1, space_type_key: 2, perlin_scale: 16,
    perlin_mirror_x: false, perlin_mirror_y: true,
    home_perlin_min: 12, home_perlin_max: 14,
    rules_geometry_commitment: 4444, proof_network_field: 5,
    claim_home_circuit: binding(CLAIM, 1, 2),
    move_circuit: binding(MOVE, 3, 4),
    move_new_circuit: binding(MOVE_NEW, 5, 6),
    enrollment_registry_id: ENROLLMENT, runtime_id: RUNTIME,
    planet_registry_id: PLANET_REGISTRY,
  }).toBytes());
}

function runtimeObject(objectDigest = DIGEST) {
  return object(RUNTIME, `${ORIGIN}::season::SeasonRuntime`, SeasonRuntimeBcs.serialize({
    id: RUNTIME, season_id: SEASON, universe_opened: true,
    universe_opened_at_ms: 20, universe_seed: digestBytes(9),
    home_claim_not_before_at_ms: 30, paused: false,
    home_availability_last_tick_at_ms: 40, accumulated_home_claimable_ms: 10,
    home_window_resolution: 0, cancelled: false, settlement_started: false,
  }).toBytes(), objectDigest);
}

function planetObject(planetId: string, pending: boolean, seasonId = SEASON) {
  return object(planetId, `${ORIGIN}::planet::Planet`, PlanetBcs.serialize({
    id: planetId, season_id: seasonId, owner_seat_id: pending ? id('00') : SEAT,
    location_hash: pending ? 222 : 111,
    location_commitment: digestBytes(pending ? 2 : 1),
    public_input_digest: digestBytes(8), proof_nonce: 1,
    is_founding_planet: !pending, ruleset_version: 1,
    level: pending ? 1 : 0, planet_type: 0, space_type: 1,
    energy: 100, energy_capacity: 1000, energy_growth: 10,
    range: 99, speed: 75, defense: 100,
    silver: 0, silver_capacity: 0, silver_growth: 0, space_junk: 0,
    defaults: { energy: 100, space_junk: 0 }, last_updated_at_seconds: 10,
    destroyed: false, pausers: 0,
    upgrades: { defense: 0, range: 0, speed: 0 },
    pending_voyages: pending
      ? [{ voyage_id: VOYAGE, player_seat_id: SEAT, arrival_at_seconds: 20 }]
      : [],
    artifacts: { ids: [], active_id: null, prospected_checkpoint: null, found: false },
    capture: { invader_seat_id: null, invade_start_checkpoint: 0, capturer_seat_id: null },
    reveal: { x: null, y: null, revealer_seat_id: null },
  }).toBytes());
}

function voyageObject() {
  return object(VOYAGE, `${ORIGIN}::voyage::Voyage`, VoyageBcs.serialize({
    id: VOYAGE, season_id: SEASON, controller_seat_id: SEAT, player_seat_id: SEAT,
    from_planet_id: HOME, to_planet_id: TARGET, energy_arriving: 25,
    silver_moved: 0, departure_at_seconds: 10, arrival_at_seconds: 20,
    max_distance: 100, public_input_digest: digestBytes(7), carried_artifact_id: null,
    is_ship: false, is_abandon: false, route_kind: 0,
  }).toBytes());
}

function event(
  module: 'planet' | 'voyage',
  name: string,
  content: Uint8Array,
  checkpoint: string | null,
): SuiClientTypes.EventEntry {
  return {
    packageId: PACKAGE, module, sender: SEAT,
    eventType: `${ORIGIN}::${module}::${name}`,
    bcs: content, json: null, checkpoint,
    transactionDigest: DIGEST, eventIndex: 0,
  };
}

function client(options: {
  incomplete?: boolean;
  crossSeason?: boolean;
  race?: boolean;
  nullCheckpoint?: boolean;
  settled?: boolean;
  mismatchedSettlement?: boolean;
} = {}) {
  let coreReads = 0;
  const manifest = manifestObject();
  const runtime = runtimeObject();
  const getObjects = vi.fn(async ({ objectIds }: { objectIds: string[] }) => {
    if (objectIds[0] === SEASON) {
      coreReads += 1;
      return { objects: [manifest, options.race && coreReads > 1 ? runtimeObject('22222222222222222222222222222222') : runtime] };
    }
    return { objects: objectIds.map((objectId) => {
      if (objectId === HOME) return planetObject(HOME, false, options.crossSeason ? id('ff') : SEASON);
      if (objectId === TARGET) return planetObject(TARGET, !options.settled && !options.mismatchedSettlement);
      return voyageObject();
    }) };
  });
  const listEvents = vi.fn(async ({ filter }: { filter: { emitModule: string } }) => {
    const checkpoint = options.nullCheckpoint ? null : '42';
    const events = filter.emitModule.endsWith('::planet')
      ? [
          event('planet', 'FoundingPlanetClaimed', FoundingEventBcs.serialize({
            season_id: SEASON, seat_id: SEAT, planet_id: HOME,
          }).toBytes(), checkpoint),
          event('planet', 'NeutralPlanetInitialized', NeutralEventBcs.serialize({
            season_id: SEASON, planet_id: TARGET, level: 1, planet_type: 0, space_type: 1,
          }).toBytes(), checkpoint),
        ]
      : [
          event('voyage', 'VoyageDispatched', DispatchedEventBcs.serialize({
            season_id: SEASON, voyage_id: VOYAGE, player_seat_id: SEAT,
            from_planet_id: HOME, to_planet_id: TARGET,
            arrival_at_seconds: 20, is_abandon: false,
          }).toBytes(), options.nullCheckpoint ? null : '43'),
          ...((options.settled || options.mismatchedSettlement)
            ? [event('voyage', 'VoyageSettled', SettledEventBcs.serialize({
                season_id: SEASON, voyage_id: VOYAGE,
                player_seat_id: options.mismatchedSettlement ? id('ff') : SEAT,
                to_planet_id: TARGET, conquered: true,
              }).toBytes(), options.nullCheckpoint ? null : '44')]
            : []),
        ];
    return {
      events,
      hasNextPage: options.incomplete ?? false,
      startCursor: 'start',
      endCursor: 'end',
    };
  });
  return { client: { getObjects, listEvents } as unknown as RankedProjectionClient, getObjects };
}

describe('ranked universe projection', () => {
  it('builds a digest-anchored projection from checkpointed creation and voyage history', async () => {
    const fixture = client();
    const projection = await readRankedUniverseProjection(fixture.client, DEPLOYMENT);

    expect(projection).toMatchObject({
      maxEventCheckpoint: '43',
      scannedEvents: 3,
      manifest: { objectId: SEASON, league: 1, worldRadius: 1000n },
      runtime: { universeOpened: true, homeWindowResolution: 'Pending' },
    });
    expect(projection.planets.map(({ objectId }) => objectId)).toEqual([HOME, TARGET]);
    expect(projection.voyages[0]).toMatchObject({
      objectId: VOYAGE, fromPlanetId: HOME, toPlanetId: TARGET,
      playerSeatId: SEAT, arrivalAtSeconds: 20n,
    });
    expect(projection.snapshotFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fixture.getObjects).toHaveBeenCalledTimes(4);
  });

  it('never labels a bounded partial event scan as a complete universe', async () => {
    const fixture = client({ incomplete: true });
    await expect(readRankedUniverseProjection(fixture.client, DEPLOYMENT, {
      maxPagesPerModule: 1,
    })).rejects.toMatchObject({ code: 'PROJECTION_INCOMPLETE' });
    expect(fixture.getObjects).not.toHaveBeenCalled();
  });

  it('removes a settled Voyage only when its terminal event matches the dispatch', async () => {
    const projection = await readRankedUniverseProjection(client({ settled: true }).client, DEPLOYMENT);
    expect(projection.voyages).toEqual([]);
    expect(projection.planets.find(({ objectId }) => objectId === TARGET)?.pendingVoyages).toEqual([]);

    await expect(readRankedUniverseProjection(client({ mismatchedSettlement: true }).client, DEPLOYMENT))
      .rejects.toMatchObject({ code: 'EVENT_SCAN_FAILED' });
  });

  it('requires checkpoint-bearing event transport and exact cross-season bindings', async () => {
    await expect(readRankedUniverseProjection(client({ nullCheckpoint: true }).client, DEPLOYMENT))
      .rejects.toMatchObject({ code: 'EVENT_SCAN_FAILED' });
    await expect(readRankedUniverseProjection(client({ crossSeason: true }).client, DEPLOYMENT))
      .rejects.toMatchObject({ code: 'OBJECT_INVALID' });
  });

  it('rejects a snapshot when the core changes during the aggregate read', async () => {
    await expect(readRankedUniverseProjection(client({ race: true }).client, DEPLOYMENT))
      .rejects.toMatchObject({ code: 'PROJECTION_RACE' });
  });
});
