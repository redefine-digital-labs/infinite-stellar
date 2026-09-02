import { bcs } from '@mysten/sui/bcs';
import { ObjectError, type SuiClientTypes } from '@mysten/sui/client';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { normalizeSuiAddress } from '@mysten/sui/utils';
import type { InfiniteStellarDeployment } from './sui-gateway';

const CANONICAL_ADDRESS = /^0x[0-9a-f]{64}$/;
const MAX_PAGE_SIZE = 50;

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

const PlanetDefaultsBcs = bcs.struct('PlanetDefaults', {
  energy: bcs.u64(),
  space_junk: bcs.u64(),
});

const UpgradeLevelsBcs = bcs.struct('UpgradeLevels', {
  defense: bcs.u8(),
  range: bcs.u8(),
  speed: bcs.u8(),
});

const PlanetArtifactStateBcs = bcs.struct('PlanetArtifactState', {
  ids: bcs.vector(bcs.Address),
  active_id: bcs.option(bcs.Address),
  prospected_checkpoint: bcs.option(bcs.u64()),
  found: bcs.bool(),
});

const PlanetCaptureStateBcs = bcs.struct('PlanetCaptureState', {
  invader_seat_id: bcs.option(bcs.Address),
  invade_start_checkpoint: bcs.u64(),
  capturer_seat_id: bcs.option(bcs.Address),
});

const PlanetRevealStateBcs = bcs.struct('PlanetRevealState', {
  x: bcs.option(bcs.vector(bcs.u8())),
  y: bcs.option(bcs.vector(bcs.u8())),
  revealer_seat_id: bcs.option(bcs.Address),
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
  defaults: PlanetDefaultsBcs,
  last_updated_at_seconds: bcs.u64(),
  destroyed: bcs.bool(),
  pausers: bcs.u64(),
  upgrades: UpgradeLevelsBcs,
  pending_voyages: bcs.vector(PendingVoyageBcs),
  artifacts: PlanetArtifactStateBcs,
  capture: PlanetCaptureStateBcs,
  reveal: PlanetRevealStateBcs,
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

const FoundingPlanetClaimedEventBcs = bcs.struct('FoundingPlanetClaimed', {
  season_id: bcs.Address,
  seat_id: bcs.Address,
  planet_id: bcs.Address,
});

const NeutralPlanetInitializedEventBcs = bcs.struct('NeutralPlanetInitialized', {
  season_id: bcs.Address,
  planet_id: bcs.Address,
  level: bcs.u8(),
  planet_type: bcs.u8(),
  space_type: bcs.u8(),
});

const VoyageDispatchedEventBcs = bcs.struct('VoyageDispatched', {
  season_id: bcs.Address,
  voyage_id: bcs.Address,
  player_seat_id: bcs.Address,
  from_planet_id: bcs.Address,
  to_planet_id: bcs.Address,
  arrival_at_seconds: bcs.u64(),
  is_abandon: bcs.bool(),
});

const VoyageSettledEventBcs = bcs.struct('VoyageSettled', {
  season_id: bcs.Address,
  voyage_id: bcs.Address,
  player_seat_id: bcs.Address,
  to_planet_id: bcs.Address,
  conquered: bcs.bool(),
});

export type RankedProjectionClient = Pick<SuiGrpcClient, 'getObjects' | 'listEvents'>;

export class RankedProjectionError extends Error {
  constructor(
    readonly code:
      | 'INVALID_DEPLOYMENT'
      | 'EVENT_SCAN_FAILED'
      | 'PROJECTION_INCOMPLETE'
      | 'OBJECT_READ_FAILED'
      | 'OBJECT_INVALID'
      | 'PROJECTION_RACE',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'RankedProjectionError';
  }
}

export interface ChainVersionRef {
  objectId: string;
  version: string;
  digest: string;
  previousTransaction: string | null;
}

export interface CircuitBindingProjection {
  configId: string;
  configDigest: string;
  verifyingKeyDigest: string;
}

export interface SeasonManifestProjection extends ChainVersionRef {
  versionNumber: bigint;
  league: number;
  enrollmentCloseAtMs: bigint;
  universeOpenAtMs: bigint;
  homeClaimOpenAtMs: bigint;
  homeClaimCloseAtMs: bigint;
  seasonEndAtMs: bigint;
  seedObservationDelayMs: bigint;
  minimumHomeClaimWindowMs: bigint;
  maxHomeAvailabilityTickGapMs: bigint;
  maxRankedSeats: bigint;
  worldRadius: bigint;
  planetHashThreshold: bigint;
  locationHashKey: bigint;
  spaceTypeKey: bigint;
  perlinScale: bigint;
  perlinMirrorX: boolean;
  perlinMirrorY: boolean;
  homePerlinMin: number;
  homePerlinMax: number;
  rulesGeometryCommitment: bigint;
  proofNetworkField: bigint;
  claimHomeCircuit: CircuitBindingProjection;
  moveCircuit: CircuitBindingProjection;
  moveNewCircuit: CircuitBindingProjection;
  enrollmentRegistryId: string;
  runtimeId: string;
  planetRegistryId: string;
}

export interface SeasonRuntimeProjection extends ChainVersionRef {
  seasonId: string;
  universeOpened: boolean;
  universeOpenedAtMs: bigint;
  universeSeed: Uint8Array;
  homeClaimNotBeforeAtMs: bigint;
  paused: boolean;
  homeAvailabilityLastTickAtMs: bigint;
  accumulatedHomeClaimableMs: bigint;
  homeWindowResolution: 'Pending' | 'ClosedAvailable' | 'CancelledUnavailable';
  cancelled: boolean;
  settlementStarted: boolean;
}

export interface PendingVoyageProjection {
  voyageId: string;
  playerSeatId: string;
  arrivalAtSeconds: bigint;
}

export interface PlanetProjection extends ChainVersionRef {
  seasonId: string;
  ownerSeatId: string;
  locationHash: bigint;
  locationCommitment: Uint8Array;
  publicInputDigest: Uint8Array;
  proofNonce: bigint;
  isFoundingPlanet: boolean;
  rulesetVersion: bigint;
  level: number;
  planetType: number;
  spaceType: number;
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
  defaultEnergy: bigint;
  defaultSpaceJunk: bigint;
  lastUpdatedAtSeconds: bigint;
  destroyed: boolean;
  pausers: bigint;
  upgrades: { defense: number; range: number; speed: number };
  pendingVoyages: PendingVoyageProjection[];
  artifactIds: string[];
  activeArtifactId: string | null;
  prospectedCheckpoint: bigint | null;
  artifactFound: boolean;
  invaderSeatId: string | null;
  invadeStartCheckpoint: bigint;
  capturerSeatId: string | null;
  revealedX: Uint8Array | null;
  revealedY: Uint8Array | null;
  revealerSeatId: string | null;
}

export interface VoyageProjection extends ChainVersionRef {
  seasonId: string;
  controllerSeatId: string;
  playerSeatId: string;
  fromPlanetId: string;
  toPlanetId: string;
  energyArriving: bigint;
  silverMoved: bigint;
  departureAtSeconds: bigint;
  arrivalAtSeconds: bigint;
  maxDistance: bigint;
  publicInputDigest: Uint8Array;
  carriedArtifactId: string | null;
  isShip: boolean;
  isAbandon: boolean;
  routeKind: number;
}

export interface RankedProjectionDiscovery {
  complete: boolean;
  planetIds: string[];
  activeVoyageIds: string[];
  scannedEvents: number;
  maxEventCheckpoint: string | null;
  nextCursors: { planet: string | null; voyage: string | null };
}

export interface RankedUniverseProjection {
  manifest: SeasonManifestProjection;
  runtime: SeasonRuntimeProjection;
  planets: PlanetProjection[];
  voyages: VoyageProjection[];
  maxEventCheckpoint: string | null;
  scannedEvents: number;
  snapshotFingerprint: string;
}

export interface RankedKnownUniverseProjection extends RankedUniverseProjection {
  coverage: 'known-private-locations';
  requestedPlanetIds: string[];
  missingPlanetIds: string[];
}

export interface RankedProjectionOptions {
  pageSize?: number;
  maxPagesPerModule?: number;
  signal?: AbortSignal;
}

export interface RankedKnownProjectionOptions {
  signal?: AbortSignal;
  maxPlanetIds?: number;
}

interface DispatchEvent {
  voyageId: string;
  playerSeatId: string;
  fromPlanetId: string;
  toPlanetId: string;
  arrivalAtSeconds: bigint;
  isAbandon: boolean;
}

interface ProjectionPins {
  packageId: string;
  typeOrigin: string;
  seasonId: string;
  runtimeId: string;
  enrollmentRegistryId: string;
  planetRegistryId: string;
}

function canonical(value: string | undefined, label: string): string {
  if (!value) throw new RankedProjectionError('INVALID_DEPLOYMENT', `${label} is not pinned.`);
  const normalized = normalizeSuiAddress(value);
  if (!CANONICAL_ADDRESS.test(normalized)) {
    throw new RankedProjectionError('INVALID_DEPLOYMENT', `${label} is not a canonical Sui address.`);
  }
  return normalized;
}

function projectionPins(deployment: InfiniteStellarDeployment): ProjectionPins {
  if (deployment.network !== 'mainnet' || !deployment.seatRouting) {
    throw new RankedProjectionError(
      'INVALID_DEPLOYMENT',
      'Ranked projection requires a mainnet deployment and deterministic Seat routing.',
    );
  }
  return {
    packageId: canonical(deployment.packageId, 'Infinite Stellar package ID'),
    typeOrigin: canonical(deployment.seatRouting.keyTypeOriginPackageId, 'Type-origin package ID'),
    seasonId: canonical(deployment.manifestId, 'SeasonManifest ID'),
    runtimeId: canonical(deployment.runtimeId, 'SeasonRuntime ID'),
    enrollmentRegistryId: canonical(deployment.enrollmentRegistryId, 'EnrollmentRegistry ID'),
    planetRegistryId: canonical(deployment.planetRegistryId, 'PlanetRegistry ID'),
  };
}

function versionRef(object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>): ChainVersionRef {
  return {
    objectId: normalizeSuiAddress(object.objectId),
    version: object.version,
    digest: object.digest,
    previousTransaction: object.previousTransaction,
  };
}

function sharedObject(
  value: SuiClientTypes.Object<{ content: true; previousTransaction: true }> | Error | undefined,
  objectId: string,
  type: string,
): SuiClientTypes.Object<{ content: true; previousTransaction: true }> {
  if (!value || value instanceof Error) {
    const detail = value instanceof ObjectError && value.reason === 'notFound'
      ? 'was not found'
      : value?.message ?? 'could not be read';
    throw new RankedProjectionError('OBJECT_READ_FAILED', `${type} ${objectId} ${detail}.`, { cause: value });
  }
  if (
    normalizeSuiAddress(value.objectId) !== objectId ||
    value.type !== type || value.owner.$kind !== 'Shared' ||
    !(value.content instanceof Uint8Array)
  ) {
    throw new RankedProjectionError('OBJECT_INVALID', `${objectId} is not the pinned shared ${type}.`);
  }
  return value;
}

async function objects(
  client: Pick<SuiGrpcClient, 'getObjects'>,
  ids: string[],
  signal?: AbortSignal,
): Promise<(SuiClientTypes.Object<{ content: true; previousTransaction: true }> | Error)[]> {
  if (ids.length === 0) return [];
  try {
    const response = await client.getObjects({
      objectIds: ids,
      include: { content: true, previousTransaction: true },
      signal,
    });
    return response.objects;
  } catch (error) {
    throw new RankedProjectionError(
      'OBJECT_READ_FAILED',
      error instanceof Error ? error.message : 'Ranked objects could not be read.',
      { cause: error },
    );
  }
}

function digest(bytes: number[] | Uint8Array, label: string): string {
  const value = Uint8Array.from(bytes);
  if (value.length !== 32) throw new RankedProjectionError('OBJECT_INVALID', `${label} must be 32 bytes.`);
  return bytesToHex(value);
}

function circuit(value: {
  config_id: string;
  config_digest: number[];
  verifying_key_digest: number[];
}, label: string): CircuitBindingProjection {
  return {
    configId: normalizeSuiAddress(value.config_id),
    configDigest: digest(value.config_digest, `${label} config digest`),
    verifyingKeyDigest: digest(value.verifying_key_digest, `${label} verifying-key digest`),
  };
}

function parseManifest(
  object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  pins: ProjectionPins,
  deployment: InfiniteStellarDeployment,
): SeasonManifestProjection {
  let value;
  try {
    value = SeasonManifestBcs.parse(object.content);
  } catch (error) {
    throw new RankedProjectionError('OBJECT_INVALID', 'SeasonManifest has invalid BCS content.', { cause: error });
  }
  const manifest: SeasonManifestProjection = {
    ...versionRef(object),
    versionNumber: BigInt(value.version),
    league: value.league,
    enrollmentCloseAtMs: BigInt(value.enrollment_close_at_ms),
    universeOpenAtMs: BigInt(value.universe_open_at_ms),
    homeClaimOpenAtMs: BigInt(value.home_claim_open_at_ms),
    homeClaimCloseAtMs: BigInt(value.home_claim_close_at_ms),
    seasonEndAtMs: BigInt(value.season_end_at_ms),
    seedObservationDelayMs: BigInt(value.seed_observation_delay_ms),
    minimumHomeClaimWindowMs: BigInt(value.minimum_home_claim_window_ms),
    maxHomeAvailabilityTickGapMs: BigInt(value.max_home_availability_tick_gap_ms),
    maxRankedSeats: BigInt(value.max_ranked_seats),
    worldRadius: BigInt(value.world_radius),
    planetHashThreshold: BigInt(value.planet_hash_threshold),
    locationHashKey: BigInt(value.location_hash_key),
    spaceTypeKey: BigInt(value.space_type_key),
    perlinScale: BigInt(value.perlin_scale),
    perlinMirrorX: value.perlin_mirror_x,
    perlinMirrorY: value.perlin_mirror_y,
    homePerlinMin: value.home_perlin_min,
    homePerlinMax: value.home_perlin_max,
    rulesGeometryCommitment: BigInt(value.rules_geometry_commitment),
    proofNetworkField: BigInt(value.proof_network_field),
    claimHomeCircuit: circuit(value.claim_home_circuit, 'claim-home'),
    moveCircuit: circuit(value.move_circuit, 'move'),
    moveNewCircuit: circuit(value.move_new_circuit, 'move-new'),
    enrollmentRegistryId: normalizeSuiAddress(value.enrollment_registry_id),
    runtimeId: normalizeSuiAddress(value.runtime_id),
    planetRegistryId: normalizeSuiAddress(value.planet_registry_id),
  };
  const routing = deployment.seatRouting!;
  if (
    normalizeSuiAddress(value.id) !== pins.seasonId || manifest.versionNumber !== 1n ||
    manifest.league !== routing.league || manifest.runtimeId !== pins.runtimeId ||
    manifest.enrollmentRegistryId !== pins.enrollmentRegistryId ||
    manifest.planetRegistryId !== pins.planetRegistryId ||
    (deployment.proofIntent &&
      manifest.rulesGeometryCommitment.toString() !== deployment.proofIntent.rulesGeometryCommitment) ||
    (deployment.claimHomeCircuitConfig &&
      (manifest.claimHomeCircuit.configId !== deployment.claimHomeCircuitConfig.objectId ||
        manifest.claimHomeCircuit.configDigest !== deployment.claimHomeCircuitConfig.configDigest ||
        manifest.claimHomeCircuit.verifyingKeyDigest !== deployment.claimHomeCircuitConfig.verifyingKeyDigest)) ||
    (deployment.moveCircuitConfig &&
      (manifest.moveCircuit.configId !== deployment.moveCircuitConfig.objectId ||
        manifest.moveCircuit.configDigest !== deployment.moveCircuitConfig.configDigest ||
        manifest.moveCircuit.verifyingKeyDigest !== deployment.moveCircuitConfig.verifyingKeyDigest)) ||
    (deployment.moveNewCircuitConfig &&
      (manifest.moveNewCircuit.configId !== deployment.moveNewCircuitConfig.objectId ||
        manifest.moveNewCircuit.configDigest !== deployment.moveNewCircuitConfig.configDigest ||
        manifest.moveNewCircuit.verifyingKeyDigest !== deployment.moveNewCircuitConfig.verifyingKeyDigest))
  ) {
    throw new RankedProjectionError('OBJECT_INVALID', 'SeasonManifest does not match the deployment release pins.');
  }
  return manifest;
}

function resolution(value: number): SeasonRuntimeProjection['homeWindowResolution'] {
  const values = ['Pending', 'ClosedAvailable', 'CancelledUnavailable'] as const;
  const result = values[value];
  if (!result) throw new RankedProjectionError('OBJECT_INVALID', `Unknown home-window resolution ${value}.`);
  return result;
}

function parseRuntime(
  object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  pins: ProjectionPins,
): SeasonRuntimeProjection {
  let value;
  try {
    value = SeasonRuntimeBcs.parse(object.content);
  } catch (error) {
    throw new RankedProjectionError('OBJECT_INVALID', 'SeasonRuntime has invalid BCS content.', { cause: error });
  }
  const seed = Uint8Array.from(value.universe_seed);
  if (
    normalizeSuiAddress(value.id) !== pins.runtimeId ||
    normalizeSuiAddress(value.season_id) !== pins.seasonId ||
    (value.universe_opened ? seed.length !== 32 : seed.length !== 0)
  ) {
    throw new RankedProjectionError('OBJECT_INVALID', 'SeasonRuntime does not match the Season or seed invariant.');
  }
  return {
    ...versionRef(object),
    seasonId: pins.seasonId,
    universeOpened: value.universe_opened,
    universeOpenedAtMs: BigInt(value.universe_opened_at_ms),
    universeSeed: seed,
    homeClaimNotBeforeAtMs: BigInt(value.home_claim_not_before_at_ms),
    paused: value.paused,
    homeAvailabilityLastTickAtMs: BigInt(value.home_availability_last_tick_at_ms),
    accumulatedHomeClaimableMs: BigInt(value.accumulated_home_claimable_ms),
    homeWindowResolution: resolution(value.home_window_resolution),
    cancelled: value.cancelled,
    settlementStarted: value.settlement_started,
  };
}

function optionalAddress(value: string | null): string | null {
  return value ? normalizeSuiAddress(value) : null;
}

function parsePlanet(
  object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  id: string,
  seasonId: string,
): PlanetProjection {
  let value;
  try {
    value = PlanetBcs.parse(object.content);
  } catch (error) {
    throw new RankedProjectionError('OBJECT_INVALID', `Planet ${id} has invalid BCS content.`, { cause: error });
  }
  if (normalizeSuiAddress(value.id) !== id || normalizeSuiAddress(value.season_id) !== seasonId) {
    throw new RankedProjectionError('OBJECT_INVALID', `Planet ${id} has a mismatched object or Season identity.`);
  }
  const locationCommitment = Uint8Array.from(value.location_commitment);
  const publicInputDigest = Uint8Array.from(value.public_input_digest);
  if (locationCommitment.length !== 32 || publicInputDigest.length !== 32) {
    throw new RankedProjectionError('OBJECT_INVALID', `Planet ${id} has a malformed commitment or proof digest.`);
  }
  const artifactIds = value.artifacts.ids.map((artifactId) => normalizeSuiAddress(artifactId));
  if (new Set(artifactIds).size !== artifactIds.length) {
    throw new RankedProjectionError('OBJECT_INVALID', `Planet ${id} contains duplicate Artifact IDs.`);
  }
  return {
    ...versionRef(object),
    seasonId,
    ownerSeatId: normalizeSuiAddress(value.owner_seat_id),
    locationHash: BigInt(value.location_hash),
    locationCommitment,
    publicInputDigest,
    proofNonce: BigInt(value.proof_nonce),
    isFoundingPlanet: value.is_founding_planet,
    rulesetVersion: BigInt(value.ruleset_version),
    level: value.level,
    planetType: value.planet_type,
    spaceType: value.space_type,
    energy: BigInt(value.energy),
    energyCapacity: BigInt(value.energy_capacity),
    energyGrowth: BigInt(value.energy_growth),
    range: BigInt(value.range),
    speed: BigInt(value.speed),
    defense: BigInt(value.defense),
    silver: BigInt(value.silver),
    silverCapacity: BigInt(value.silver_capacity),
    silverGrowth: BigInt(value.silver_growth),
    spaceJunk: BigInt(value.space_junk),
    defaultEnergy: BigInt(value.defaults.energy),
    defaultSpaceJunk: BigInt(value.defaults.space_junk),
    lastUpdatedAtSeconds: BigInt(value.last_updated_at_seconds),
    destroyed: value.destroyed,
    pausers: BigInt(value.pausers),
    upgrades: {
      defense: value.upgrades.defense,
      range: value.upgrades.range,
      speed: value.upgrades.speed,
    },
    pendingVoyages: value.pending_voyages.map((pending) => ({
      voyageId: normalizeSuiAddress(pending.voyage_id),
      playerSeatId: normalizeSuiAddress(pending.player_seat_id),
      arrivalAtSeconds: BigInt(pending.arrival_at_seconds),
    })),
    artifactIds,
    activeArtifactId: optionalAddress(value.artifacts.active_id),
    prospectedCheckpoint: value.artifacts.prospected_checkpoint === null
      ? null : BigInt(value.artifacts.prospected_checkpoint),
    artifactFound: value.artifacts.found,
    invaderSeatId: optionalAddress(value.capture.invader_seat_id),
    invadeStartCheckpoint: BigInt(value.capture.invade_start_checkpoint),
    capturerSeatId: optionalAddress(value.capture.capturer_seat_id),
    revealedX: value.reveal.x === null ? null : Uint8Array.from(value.reveal.x),
    revealedY: value.reveal.y === null ? null : Uint8Array.from(value.reveal.y),
    revealerSeatId: optionalAddress(value.reveal.revealer_seat_id),
  };
}

function parseVoyage(
  object: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  id: string,
  seasonId: string,
  dispatch?: DispatchEvent,
): VoyageProjection {
  let value;
  try {
    value = VoyageBcs.parse(object.content);
  } catch (error) {
    throw new RankedProjectionError('OBJECT_INVALID', `Voyage ${id} has invalid BCS content.`, { cause: error });
  }
  const result: VoyageProjection = {
    ...versionRef(object),
    seasonId: normalizeSuiAddress(value.season_id),
    controllerSeatId: normalizeSuiAddress(value.controller_seat_id),
    playerSeatId: normalizeSuiAddress(value.player_seat_id),
    fromPlanetId: normalizeSuiAddress(value.from_planet_id),
    toPlanetId: normalizeSuiAddress(value.to_planet_id),
    energyArriving: BigInt(value.energy_arriving),
    silverMoved: BigInt(value.silver_moved),
    departureAtSeconds: BigInt(value.departure_at_seconds),
    arrivalAtSeconds: BigInt(value.arrival_at_seconds),
    maxDistance: BigInt(value.max_distance),
    publicInputDigest: Uint8Array.from(value.public_input_digest),
    carriedArtifactId: optionalAddress(value.carried_artifact_id),
    isShip: value.is_ship,
    isAbandon: value.is_abandon,
    routeKind: value.route_kind,
  };
  if (
    normalizeSuiAddress(value.id) !== id || result.seasonId !== seasonId ||
    result.publicInputDigest.length !== 32 || result.arrivalAtSeconds < result.departureAtSeconds ||
    (dispatch !== undefined && (
      result.playerSeatId !== dispatch.playerSeatId || result.fromPlanetId !== dispatch.fromPlanetId ||
      result.toPlanetId !== dispatch.toPlanetId || result.arrivalAtSeconds !== dispatch.arrivalAtSeconds ||
      result.isAbandon !== dispatch.isAbandon
    ))
  ) {
    throw new RankedProjectionError('OBJECT_INVALID', `Voyage ${id} does not match its dispatch event or Season.`);
  }
  return result;
}

function optionalSharedObject(
  value: SuiClientTypes.Object<{ content: true; previousTransaction: true }> | Error | undefined,
  id: string,
  type: string,
): SuiClientTypes.Object<{ content: true; previousTransaction: true }> | null {
  if (value instanceof ObjectError && value.reason === 'notFound') return null;
  return sharedObject(value, id, type);
}

async function scanModule(
  client: Pick<SuiGrpcClient, 'listEvents'>,
  emitModule: string,
  options: RankedProjectionOptions,
): Promise<{
  events: SuiClientTypes.EventEntry[];
  complete: boolean;
  nextCursor: string | null;
}> {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize ?? MAX_PAGE_SIZE));
  const maxPages = Math.max(1, options.maxPagesPerModule ?? 40);
  const events: SuiClientTypes.EventEntry[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < maxPages; page += 1) {
    let response;
    try {
      response = await client.listEvents({
        filter: { emitModule },
        limit,
        after: cursor,
        order: 'ascending',
        signal: options.signal,
      });
    } catch (error) {
      throw new RankedProjectionError(
        'EVENT_SCAN_FAILED',
        error instanceof Error ? error.message : `${emitModule} events could not be read.`,
        { cause: error },
      );
    }
    events.push(...response.events);
    cursor = response.endCursor;
    if (!response.hasNextPage) return { events, complete: true, nextCursor: null };
    if (!cursor) {
      throw new RankedProjectionError(
        'EVENT_SCAN_FAILED',
        `${emitModule} pagination reported another page without a continuation cursor.`,
      );
    }
  }
  return { events, complete: false, nextCursor: cursor };
}

function checkpointMax(current: bigint | null, event: SuiClientTypes.EventEntry): bigint {
  if (event.checkpoint === null) {
    throw new RankedProjectionError(
      'EVENT_SCAN_FAILED',
      'Checkpoint-derived projection requires a transport that returns event checkpoints.',
    );
  }
  const checkpoint = BigInt(event.checkpoint);
  return current === null || checkpoint > current ? checkpoint : current;
}

export async function discoverRankedUniverseObjectIds(
  client: Pick<SuiGrpcClient, 'listEvents'>,
  deployment: InfiniteStellarDeployment,
  options: RankedProjectionOptions = {},
): Promise<RankedProjectionDiscovery & { dispatches: Map<string, DispatchEvent> }> {
  const pins = projectionPins(deployment);
  const [planetStream, voyageStream] = await Promise.all([
    scanModule(client, `${pins.packageId}::planet`, options),
    scanModule(client, `${pins.packageId}::voyage`, options),
  ]);
  const planetIds = new Set<string>();
  const dispatches = new Map<string, DispatchEvent>();
  const settled = new Map<string, { playerSeatId: string; toPlanetId: string }>();
  let maxCheckpoint: bigint | null = null;
  const eventType = (module: string, name: string) => `${pins.typeOrigin}::${module}::${name}`;

  for (const event of planetStream.events) {
    maxCheckpoint = checkpointMax(maxCheckpoint, event);
    if (normalizeSuiAddress(event.packageId) !== pins.packageId || event.module !== 'planet') {
      throw new RankedProjectionError('EVENT_SCAN_FAILED', 'Planet stream returned an event from another emitter.');
    }
    try {
      if (event.eventType === eventType('planet', 'FoundingPlanetClaimed')) {
        const value = FoundingPlanetClaimedEventBcs.parse(event.bcs);
        if (normalizeSuiAddress(value.season_id) === pins.seasonId) {
          planetIds.add(normalizeSuiAddress(value.planet_id));
        }
      } else if (event.eventType === eventType('planet', 'NeutralPlanetInitialized')) {
        const value = NeutralPlanetInitializedEventBcs.parse(event.bcs);
        if (normalizeSuiAddress(value.season_id) === pins.seasonId) {
          planetIds.add(normalizeSuiAddress(value.planet_id));
        }
      }
    } catch (error) {
      throw new RankedProjectionError('EVENT_SCAN_FAILED', 'A Planet event has invalid BCS content.', { cause: error });
    }
  }

  for (const event of voyageStream.events) {
    maxCheckpoint = checkpointMax(maxCheckpoint, event);
    if (normalizeSuiAddress(event.packageId) !== pins.packageId || event.module !== 'voyage') {
      throw new RankedProjectionError('EVENT_SCAN_FAILED', 'Voyage stream returned an event from another emitter.');
    }
    try {
      if (event.eventType === eventType('voyage', 'VoyageDispatched')) {
        const value = VoyageDispatchedEventBcs.parse(event.bcs);
        if (normalizeSuiAddress(value.season_id) !== pins.seasonId) continue;
        const voyageId = normalizeSuiAddress(value.voyage_id);
        if (dispatches.has(voyageId)) {
          throw new RankedProjectionError('EVENT_SCAN_FAILED', `Voyage ${voyageId} was dispatched more than once.`);
        }
        dispatches.set(voyageId, {
          voyageId,
          playerSeatId: normalizeSuiAddress(value.player_seat_id),
          fromPlanetId: normalizeSuiAddress(value.from_planet_id),
          toPlanetId: normalizeSuiAddress(value.to_planet_id),
          arrivalAtSeconds: BigInt(value.arrival_at_seconds),
          isAbandon: value.is_abandon,
        });
      } else if (event.eventType === eventType('voyage', 'VoyageSettled')) {
        const value = VoyageSettledEventBcs.parse(event.bcs);
        if (normalizeSuiAddress(value.season_id) === pins.seasonId) {
          const voyageId = normalizeSuiAddress(value.voyage_id);
          if (settled.has(voyageId)) {
            throw new RankedProjectionError('EVENT_SCAN_FAILED', `Voyage ${voyageId} was settled more than once.`);
          }
          settled.set(voyageId, {
            playerSeatId: normalizeSuiAddress(value.player_seat_id),
            toPlanetId: normalizeSuiAddress(value.to_planet_id),
          });
        }
      }
    } catch (error) {
      if (error instanceof RankedProjectionError) throw error;
      throw new RankedProjectionError('EVENT_SCAN_FAILED', 'A Voyage event has invalid BCS content.', { cause: error });
    }
  }
  for (const [voyageId, settlement] of settled) {
    const dispatch = dispatches.get(voyageId);
    if (!dispatch) {
      throw new RankedProjectionError('EVENT_SCAN_FAILED', `Settled Voyage ${voyageId} has no dispatch event.`);
    }
    if (
      settlement.playerSeatId !== dispatch.playerSeatId ||
      settlement.toPlanetId !== dispatch.toPlanetId
    ) {
      throw new RankedProjectionError(
        'EVENT_SCAN_FAILED',
        `Settled Voyage ${voyageId} does not match its dispatch binding.`,
      );
    }
  }
  const activeVoyageIds = [...dispatches.keys()].filter((id) => !settled.has(id)).sort();
  return {
    complete: planetStream.complete && voyageStream.complete,
    planetIds: [...planetIds].sort(),
    activeVoyageIds,
    scannedEvents: planetStream.events.length + voyageStream.events.length,
    maxEventCheckpoint: maxCheckpoint?.toString() ?? null,
    nextCursors: {
      planet: planetStream.nextCursor,
      voyage: voyageStream.nextCursor,
    },
    dispatches,
  };
}

function sameVersion(
  left: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
  right: SuiClientTypes.Object<{ content: true; previousTransaction: true }>,
): boolean {
  return left.objectId === right.objectId && left.version === right.version && left.digest === right.digest;
}

export async function readRankedUniverseProjection(
  client: RankedProjectionClient,
  deployment: InfiniteStellarDeployment,
  options: RankedProjectionOptions = {},
): Promise<RankedUniverseProjection> {
  const pins = projectionPins(deployment);
  const discovery = await discoverRankedUniverseObjectIds(client, deployment, options);
  if (!discovery.complete) {
    throw new RankedProjectionError(
      'PROJECTION_INCOMPLETE',
      `Event history exceeded the bounded scan; continue from ${JSON.stringify(discovery.nextCursors)} or use the checkpoint indexer.`,
    );
  }
  const coreValues = await objects(client, [pins.seasonId, pins.runtimeId], options.signal);
  const manifestObject = sharedObject(
    coreValues[0], pins.seasonId, `${pins.typeOrigin}::season::SeasonManifest`,
  );
  const runtimeObject = sharedObject(
    coreValues[1], pins.runtimeId, `${pins.typeOrigin}::season::SeasonRuntime`,
  );
  const manifest = parseManifest(manifestObject, pins, deployment);
  const runtime = parseRuntime(runtimeObject, pins);

  const planets: PlanetProjection[] = [];
  for (let offset = 0; offset < discovery.planetIds.length; offset += MAX_PAGE_SIZE) {
    const ids = discovery.planetIds.slice(offset, offset + MAX_PAGE_SIZE);
    const values = await objects(client, ids, options.signal);
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index]!;
      const object = sharedObject(values[index], id, `${pins.typeOrigin}::planet::Planet`);
      planets.push(parsePlanet(object, id, pins.seasonId));
    }
  }

  const voyages: VoyageProjection[] = [];
  for (let offset = 0; offset < discovery.activeVoyageIds.length; offset += MAX_PAGE_SIZE) {
    const ids = discovery.activeVoyageIds.slice(offset, offset + MAX_PAGE_SIZE);
    const values = await objects(client, ids, options.signal);
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index]!;
      const object = sharedObject(values[index], id, `${pins.typeOrigin}::voyage::Voyage`);
      voyages.push(parseVoyage(object, id, pins.seasonId, discovery.dispatches.get(id)!));
    }
  }

  const planetIds = new Set(planets.map((planet) => planet.objectId));
  const pendingByVoyage = new Map<string, PendingVoyageProjection>();
  for (const planet of planets) {
    for (const pending of planet.pendingVoyages) {
      if (pendingByVoyage.has(pending.voyageId)) {
        throw new RankedProjectionError('OBJECT_INVALID', `Voyage ${pending.voyageId} is pending on multiple Planets.`);
      }
      pendingByVoyage.set(pending.voyageId, pending);
    }
  }
  for (const voyage of voyages) {
    const pending = pendingByVoyage.get(voyage.objectId);
    if (
      !planetIds.has(voyage.fromPlanetId) || !planetIds.has(voyage.toPlanetId) ||
      !pending || pending.playerSeatId !== voyage.playerSeatId ||
      pending.arrivalAtSeconds !== voyage.arrivalAtSeconds
    ) {
      throw new RankedProjectionError(
        'OBJECT_INVALID',
        `Voyage ${voyage.objectId} is not bound to its discovered Planets and pending-arrival record.`,
      );
    }
  }
  if ([...pendingByVoyage.keys()].some((id) => !discovery.activeVoyageIds.includes(id))) {
    throw new RankedProjectionError('OBJECT_INVALID', 'A Planet references a Voyage absent from active event history.');
  }

  const finalCoreValues = await objects(client, [pins.seasonId, pins.runtimeId], options.signal);
  const finalManifest = sharedObject(
    finalCoreValues[0], pins.seasonId, `${pins.typeOrigin}::season::SeasonManifest`,
  );
  const finalRuntime = sharedObject(
    finalCoreValues[1], pins.runtimeId, `${pins.typeOrigin}::season::SeasonRuntime`,
  );
  if (!sameVersion(manifestObject, finalManifest) || !sameVersion(runtimeObject, finalRuntime)) {
    throw new RankedProjectionError(
      'PROJECTION_RACE',
      'Season core changed during projection; discard this snapshot and retry.',
    );
  }

  const refs = [manifest, runtime, ...planets, ...voyages]
    .map((value) => `${value.objectId}:${value.version}:${value.digest}:${value.previousTransaction ?? ''}`)
    .sort();
  const snapshotFingerprint = bytesToHex(sha256(new TextEncoder().encode([
    'infinite-stellar/ranked-projection/v1',
    discovery.maxEventCheckpoint ?? '',
    ...refs,
  ].join('\0'))));

  return {
    manifest,
    runtime,
    planets: planets.sort((left, right) => left.objectId.localeCompare(right.objectId)),
    voyages: voyages.sort((left, right) => left.objectId.localeCompare(right.objectId)),
    maxEventCheckpoint: discovery.maxEventCheckpoint,
    scannedEvents: discovery.scannedEvents,
    snapshotFingerprint,
  };
}

/**
 * Reads only deterministic Planet IDs derived from the controller's private
 * coordinate vault. This is the scalable player-map path: it does not enumerate
 * or upload private coordinates and does not replay global event history.
 */
export async function readRankedKnownUniverseProjection(
  client: Pick<SuiGrpcClient, 'getObjects'>,
  deployment: InfiniteStellarDeployment,
  rawPlanetIds: readonly string[],
  options: RankedKnownProjectionOptions = {},
): Promise<RankedKnownUniverseProjection> {
  const pins = projectionPins(deployment);
  const maximum = options.maxPlanetIds ?? 5_000;
  if (!Number.isSafeInteger(maximum) || maximum < 1) {
    throw new RankedProjectionError('INVALID_DEPLOYMENT', 'The known-Planet read bound must be a positive safe integer.');
  }
  if (rawPlanetIds.length > maximum) {
    throw new RankedProjectionError(
      'PROJECTION_INCOMPLETE',
      `The private map contains ${rawPlanetIds.length} Planet IDs; the configured bound is ${maximum}.`,
    );
  }
  const requestedPlanetIds = [...new Set(rawPlanetIds.map((id) => canonical(id, 'Known Planet ID')))].sort();
  if (requestedPlanetIds.length !== rawPlanetIds.length) {
    throw new RankedProjectionError('OBJECT_INVALID', 'The private map contains duplicate Planet IDs.');
  }

  const coreValues = await objects(client, [pins.seasonId, pins.runtimeId], options.signal);
  const manifestObject = sharedObject(
    coreValues[0], pins.seasonId, `${pins.typeOrigin}::season::SeasonManifest`,
  );
  const runtimeObject = sharedObject(
    coreValues[1], pins.runtimeId, `${pins.typeOrigin}::season::SeasonRuntime`,
  );
  const manifest = parseManifest(manifestObject, pins, deployment);
  const runtime = parseRuntime(runtimeObject, pins);

  const initialPlanetObjects = new Map<string, SuiClientTypes.Object<{ content: true; previousTransaction: true }> | null>();
  const planets: PlanetProjection[] = [];
  const missingPlanetIds: string[] = [];
  for (let offset = 0; offset < requestedPlanetIds.length; offset += MAX_PAGE_SIZE) {
    const ids = requestedPlanetIds.slice(offset, offset + MAX_PAGE_SIZE);
    const values = await objects(client, ids, options.signal);
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index]!;
      const object = optionalSharedObject(values[index], id, `${pins.typeOrigin}::planet::Planet`);
      initialPlanetObjects.set(id, object);
      if (!object) {
        missingPlanetIds.push(id);
      } else {
        planets.push(parsePlanet(object, id, pins.seasonId));
      }
    }
  }

  const pendingByVoyage = new Map<string, { targetPlanetId: string; pending: PendingVoyageProjection }>();
  for (const planet of planets) {
    for (const pending of planet.pendingVoyages) {
      if (pendingByVoyage.has(pending.voyageId)) {
        throw new RankedProjectionError('OBJECT_INVALID', `Voyage ${pending.voyageId} is pending on multiple known Planets.`);
      }
      pendingByVoyage.set(pending.voyageId, { targetPlanetId: planet.objectId, pending });
    }
  }
  const voyageIds = [...pendingByVoyage.keys()].sort();
  const initialVoyageObjects = new Map<string, SuiClientTypes.Object<{ content: true; previousTransaction: true }>>();
  const voyages: VoyageProjection[] = [];
  for (let offset = 0; offset < voyageIds.length; offset += MAX_PAGE_SIZE) {
    const ids = voyageIds.slice(offset, offset + MAX_PAGE_SIZE);
    const values = await objects(client, ids, options.signal);
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index]!;
      const object = sharedObject(values[index], id, `${pins.typeOrigin}::voyage::Voyage`);
      const voyage = parseVoyage(object, id, pins.seasonId);
      const target = pendingByVoyage.get(id)!;
      if (
        voyage.toPlanetId !== target.targetPlanetId ||
        voyage.playerSeatId !== target.pending.playerSeatId ||
        voyage.arrivalAtSeconds !== target.pending.arrivalAtSeconds
      ) {
        throw new RankedProjectionError(
          'OBJECT_INVALID',
          `Voyage ${id} does not match its known target Planet pending-arrival record.`,
        );
      }
      initialVoyageObjects.set(id, object);
      voyages.push(voyage);
    }
  }

  const rereadIds = [pins.seasonId, pins.runtimeId, ...requestedPlanetIds, ...voyageIds];
  const finalValues: (SuiClientTypes.Object<{ content: true; previousTransaction: true }> | Error)[] = [];
  for (let offset = 0; offset < rereadIds.length; offset += MAX_PAGE_SIZE) {
    finalValues.push(...await objects(client, rereadIds.slice(offset, offset + MAX_PAGE_SIZE), options.signal));
  }
  const finalManifest = sharedObject(
    finalValues[0], pins.seasonId, `${pins.typeOrigin}::season::SeasonManifest`,
  );
  const finalRuntime = sharedObject(
    finalValues[1], pins.runtimeId, `${pins.typeOrigin}::season::SeasonRuntime`,
  );
  if (!sameVersion(manifestObject, finalManifest) || !sameVersion(runtimeObject, finalRuntime)) {
    throw new RankedProjectionError('PROJECTION_RACE', 'Season core changed during the private-map read.');
  }
  let finalIndex = 2;
  for (const id of requestedPlanetIds) {
    const finalObject = optionalSharedObject(
      finalValues[finalIndex], id, `${pins.typeOrigin}::planet::Planet`,
    );
    finalIndex += 1;
    const initialObject = initialPlanetObjects.get(id) ?? null;
    if (
      (initialObject === null) !== (finalObject === null) ||
      (initialObject !== null && finalObject !== null && !sameVersion(initialObject, finalObject))
    ) {
      throw new RankedProjectionError('PROJECTION_RACE', `Planet ${id} changed during the private-map read.`);
    }
  }
  for (const id of voyageIds) {
    const finalObject = sharedObject(
      finalValues[finalIndex], id, `${pins.typeOrigin}::voyage::Voyage`,
    );
    finalIndex += 1;
    if (!sameVersion(initialVoyageObjects.get(id)!, finalObject)) {
      throw new RankedProjectionError('PROJECTION_RACE', `Voyage ${id} changed during the private-map read.`);
    }
  }

  const refs = [manifest, runtime, ...planets, ...voyages]
    .map((value) => `${value.objectId}:${value.version}:${value.digest}:${value.previousTransaction ?? ''}`)
    .sort();
  const snapshotFingerprint = bytesToHex(sha256(new TextEncoder().encode([
    'infinite-stellar/ranked-known-projection/v1',
    ...requestedPlanetIds,
    ...missingPlanetIds.map((id) => `missing:${id}`),
    ...refs,
  ].join('\0'))));

  return {
    coverage: 'known-private-locations',
    manifest,
    runtime,
    planets: planets.sort((left, right) => left.objectId.localeCompare(right.objectId)),
    voyages: voyages.sort((left, right) => left.objectId.localeCompare(right.objectId)),
    maxEventCheckpoint: null,
    scannedEvents: 0,
    snapshotFingerprint,
    requestedPlanetIds,
    missingPlanetIds: missingPlanetIds.sort(),
  };
}
