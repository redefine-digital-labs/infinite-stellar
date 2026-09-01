module infinite_stellar::season;

use sui::clock::{Self as clock, Clock};
use sui::event;
use sui::random::{Self as random, Random};
use infinite_stellar::proof_intent;
use infinite_stellar::rules_geometry;

const VERSION: u64 = 1;

const RESOLUTION_PENDING: u8 = 0;
const RESOLUTION_CLOSED_AVAILABLE: u8 = 1;
const RESOLUTION_CANCELLED_UNAVAILABLE: u8 = 2;

const EInvalidManifest: u64 = 0;
const ESeasonMismatch: u64 = 1;
const EUniverseAlreadyOpened: u64 = 2;
const EUniverseNotReady: u64 = 3;
const ESeasonCancelled: u64 = 4;
const EHomeWindowNotClosed: u64 = 6;
const EHomeWindowAlreadyResolved: u64 = 7;
const EHomeWindowResolutionPending: u64 = 8;
const EAlreadyPaused: u64 = 9;
const ENotPaused: u64 = 10;
const EHomeWindowClosed: u64 = 11;
const ESettlementAlreadyStarted: u64 = 12;
const ESettlementTooEarly: u64 = 13;
const EClockOverflow: u64 = 14;
const ESeasonEnded: u64 = 15;

public struct SeasonAdminCap has key, store {
    id: UID,
    season_id: ID,
}

/// One immutable action-specific proof configuration. Grouping the three
/// fields keeps `SeasonManifest` below Sui's protocol-level 32-field limit.
public struct CircuitBinding has copy, drop, store {
    config_id: ID,
    config_digest: vector<u8>,
    verifying_key_digest: vector<u8>,
}

/// Immutable authority for one ranked P0 season. Runtime facts live in the
/// separate `SeasonRuntime` shared object.
public struct SeasonManifest has key {
    id: UID,
    version: u64,
    league: u8,
    enrollment_close_at_ms: u64,
    universe_open_at_ms: u64,
    home_claim_open_at_ms: u64,
    home_claim_close_at_ms: u64,
    season_end_at_ms: u64,
    seed_observation_delay_ms: u64,
    minimum_home_claim_window_ms: u64,
    max_home_availability_tick_gap_ms: u64,
    max_ranked_seats: u64,
    world_radius: u64,
    planet_hash_threshold: u256,
    location_hash_key: u64,
    space_type_key: u64,
    perlin_scale: u64,
    perlin_mirror_x: bool,
    perlin_mirror_y: bool,
    home_perlin_min: u8,
    home_perlin_max: u8,
    rules_geometry_commitment: u256,
    proof_network_field: u256,
    claim_home_circuit: CircuitBinding,
    move_circuit: CircuitBinding,
    move_new_circuit: CircuitBinding,
    enrollment_registry_id: ID,
    runtime_id: ID,
    planet_registry_id: ID,
}

/// Bounded, shared runtime facts. No private coordinate or growing action
/// history is stored here.
public struct SeasonRuntime has key {
    id: UID,
    season_id: ID,
    universe_opened: bool,
    universe_opened_at_ms: u64,
    universe_seed: vector<u8>,
    home_claim_not_before_at_ms: u64,
    paused: bool,
    home_availability_last_tick_at_ms: u64,
    accumulated_home_claimable_ms: u64,
    home_window_resolution: u8,
    cancelled: bool,
    settlement_started: bool,
}

public struct SeasonCreated has copy, drop {
    season_id: ID,
    enrollment_registry_id: ID,
    runtime_id: ID,
    planet_registry_id: ID,
    max_ranked_seats: u64,
    world_radius: u64,
    rules_geometry_commitment: u256,
    proof_network_field: u256,
    claim_home_circuit_config_id: ID,
    claim_home_circuit_config_digest: vector<u8>,
    claim_home_verifying_key_digest: vector<u8>,
    move_circuit_config_id: ID,
    move_circuit_config_digest: vector<u8>,
    move_verifying_key_digest: vector<u8>,
    move_new_circuit_config_id: ID,
    move_new_circuit_config_digest: vector<u8>,
    move_new_verifying_key_digest: vector<u8>,
}

public struct UniverseOpened has copy, drop {
    season_id: ID,
    opened_at_ms: u64,
    home_claim_not_before_at_ms: u64,
}

public struct HomeWindowResolved has copy, drop {
    season_id: ID,
    resolution: u8,
    accumulated_claimable_ms: u64,
}

public(package) fun new_season(
    league: u8,
    enrollment_close_at_ms: u64,
    universe_open_at_ms: u64,
    home_claim_open_at_ms: u64,
    home_claim_close_at_ms: u64,
    season_end_at_ms: u64,
    seed_observation_delay_ms: u64,
    minimum_home_claim_window_ms: u64,
    max_home_availability_tick_gap_ms: u64,
    max_ranked_seats: u64,
    world_radius: u64,
    planet_hash_threshold: u256,
    location_hash_key: u64,
    space_type_key: u64,
    perlin_scale: u64,
    perlin_mirror_x: bool,
    perlin_mirror_y: bool,
    home_perlin_min: u8,
    home_perlin_max: u8,
    proof_network_field: u256,
    claim_home_circuit_config_id: ID,
    claim_home_circuit_config_digest: vector<u8>,
    claim_home_verifying_key_digest: vector<u8>,
    move_circuit_config_id: ID,
    move_circuit_config_digest: vector<u8>,
    move_verifying_key_digest: vector<u8>,
    move_new_circuit_config_id: ID,
    move_new_circuit_config_digest: vector<u8>,
    move_new_verifying_key_digest: vector<u8>,
    ctx: &mut TxContext,
): (SeasonManifest, SeasonRuntime, SeasonAdminCap) {
    assert!(max_ranked_seats > 0, EInvalidManifest);
    assert!(seed_observation_delay_ms > 0, EInvalidManifest);
    assert!(minimum_home_claim_window_ms > 0, EInvalidManifest);
    assert!(max_home_availability_tick_gap_ms > 0, EInvalidManifest);
    assert!(max_home_availability_tick_gap_ms < minimum_home_claim_window_ms, EInvalidManifest);
    assert!(enrollment_close_at_ms <= universe_open_at_ms, EInvalidManifest);
    assert!(universe_open_at_ms <= home_claim_open_at_ms, EInvalidManifest);
    assert!(home_claim_open_at_ms < home_claim_close_at_ms, EInvalidManifest);
    assert!(home_claim_close_at_ms <= season_end_at_ms, EInvalidManifest);
    assert!(universe_open_at_ms <= 0xffffffffffffffff - seed_observation_delay_ms, EInvalidManifest);
    let scheduled_observation_at_ms = universe_open_at_ms + seed_observation_delay_ms;
    let scheduled_not_before_at_ms = if (scheduled_observation_at_ms > home_claim_open_at_ms) {
        scheduled_observation_at_ms
    } else {
        home_claim_open_at_ms
    };
    assert!(scheduled_not_before_at_ms < home_claim_close_at_ms, EInvalidManifest);
    assert!(
        home_claim_close_at_ms - scheduled_not_before_at_ms >= minimum_home_claim_window_ms,
        EInvalidManifest,
    );
    proof_intent::assert_supported_network(proof_network_field);
    let unbound_configs = claim_home_circuit_config_id == @0x0.to_id() &&
        move_circuit_config_id == @0x0.to_id() &&
        move_new_circuit_config_id == @0x0.to_id();
    if (unbound_configs) {
        assert!(claim_home_circuit_config_digest.is_empty(), EInvalidManifest);
        assert!(claim_home_verifying_key_digest.is_empty(), EInvalidManifest);
        assert!(move_circuit_config_digest.is_empty(), EInvalidManifest);
        assert!(move_verifying_key_digest.is_empty(), EInvalidManifest);
        assert!(move_new_circuit_config_digest.is_empty(), EInvalidManifest);
        assert!(move_new_verifying_key_digest.is_empty(), EInvalidManifest);
    } else {
        assert!(claim_home_circuit_config_id != @0x0.to_id(), EInvalidManifest);
        assert!(move_circuit_config_id != @0x0.to_id(), EInvalidManifest);
        assert!(move_new_circuit_config_id != @0x0.to_id(), EInvalidManifest);
        assert!(claim_home_circuit_config_id != move_circuit_config_id, EInvalidManifest);
        assert!(claim_home_circuit_config_id != move_new_circuit_config_id, EInvalidManifest);
        assert!(move_circuit_config_id != move_new_circuit_config_id, EInvalidManifest);
        assert!(claim_home_circuit_config_digest.length() == 32, EInvalidManifest);
        assert!(claim_home_verifying_key_digest.length() == 32, EInvalidManifest);
        assert!(move_circuit_config_digest.length() == 32, EInvalidManifest);
        assert!(move_verifying_key_digest.length() == 32, EInvalidManifest);
        assert!(move_new_circuit_config_digest.length() == 32, EInvalidManifest);
        assert!(move_new_verifying_key_digest.length() == 32, EInvalidManifest);
    };
    let geometry_commitment = rules_geometry::commitment(
        world_radius,
        planet_hash_threshold,
        location_hash_key,
        space_type_key,
        perlin_scale,
        perlin_mirror_x,
        perlin_mirror_y,
        home_perlin_min,
        home_perlin_max,
    );

    let manifest_uid = object::new(ctx);
    let season_id = manifest_uid.to_inner();
    let runtime_uid = object::new(ctx);
    let manifest = SeasonManifest {
        id: manifest_uid,
        version: VERSION,
        league,
        enrollment_close_at_ms,
        universe_open_at_ms,
        home_claim_open_at_ms,
        home_claim_close_at_ms,
        season_end_at_ms,
        seed_observation_delay_ms,
        minimum_home_claim_window_ms,
        max_home_availability_tick_gap_ms,
        max_ranked_seats,
        world_radius,
        planet_hash_threshold,
        location_hash_key,
        space_type_key,
        perlin_scale,
        perlin_mirror_x,
        perlin_mirror_y,
        home_perlin_min,
        home_perlin_max,
        rules_geometry_commitment: geometry_commitment,
        proof_network_field,
        claim_home_circuit: CircuitBinding {
            config_id: claim_home_circuit_config_id,
            config_digest: claim_home_circuit_config_digest,
            verifying_key_digest: claim_home_verifying_key_digest,
        },
        move_circuit: CircuitBinding {
            config_id: move_circuit_config_id,
            config_digest: move_circuit_config_digest,
            verifying_key_digest: move_verifying_key_digest,
        },
        move_new_circuit: CircuitBinding {
            config_id: move_new_circuit_config_id,
            config_digest: move_new_circuit_config_digest,
            verifying_key_digest: move_new_verifying_key_digest,
        },
        enrollment_registry_id: @0x0.to_id(),
        runtime_id: runtime_uid.to_inner(),
        planet_registry_id: @0x0.to_id(),
    };
    let runtime = SeasonRuntime {
        id: runtime_uid,
        season_id,
        universe_opened: false,
        universe_opened_at_ms: 0,
        universe_seed: vector[],
        home_claim_not_before_at_ms: 0,
        paused: false,
        home_availability_last_tick_at_ms: 0,
        accumulated_home_claimable_ms: 0,
        home_window_resolution: RESOLUTION_PENDING,
        cancelled: false,
        settlement_started: false,
    };
    let admin_cap = SeasonAdminCap { id: object::new(ctx), season_id };
    (manifest, runtime, admin_cap)
}

public(package) fun bind_registries(
    manifest: &mut SeasonManifest,
    enrollment_registry_id: ID,
    planet_registry_id: ID,
) {
    assert!(manifest.enrollment_registry_id == @0x0.to_id(), EInvalidManifest);
    assert!(manifest.planet_registry_id == @0x0.to_id(), EInvalidManifest);
    assert!(enrollment_registry_id != @0x0.to_id(), EInvalidManifest);
    assert!(planet_registry_id != @0x0.to_id(), EInvalidManifest);
    manifest.enrollment_registry_id = enrollment_registry_id;
    manifest.planet_registry_id = planet_registry_id;
}

public(package) fun share_season(manifest: SeasonManifest, runtime: SeasonRuntime) {
    transfer::share_object(manifest);
    transfer::share_object(runtime);
}

public(package) fun emit_season_created(
    manifest: &SeasonManifest,
    max_ranked_seats: u64,
) {
    event::emit(SeasonCreated {
        season_id: object::id(manifest),
        enrollment_registry_id: manifest.enrollment_registry_id,
        runtime_id: manifest.runtime_id,
        planet_registry_id: manifest.planet_registry_id,
        max_ranked_seats,
        world_radius: manifest.world_radius,
        rules_geometry_commitment: manifest.rules_geometry_commitment,
        proof_network_field: manifest.proof_network_field,
        claim_home_circuit_config_id: manifest.claim_home_circuit.config_id,
        claim_home_circuit_config_digest: manifest.claim_home_circuit.config_digest,
        claim_home_verifying_key_digest: manifest.claim_home_circuit.verifying_key_digest,
        move_circuit_config_id: manifest.move_circuit.config_id,
        move_circuit_config_digest: manifest.move_circuit.config_digest,
        move_verifying_key_digest: manifest.move_circuit.verifying_key_digest,
        move_new_circuit_config_id: manifest.move_new_circuit.config_id,
        move_new_circuit_config_digest: manifest.move_new_circuit.config_digest,
        move_new_verifying_key_digest: manifest.move_new_circuit.verifying_key_digest,
    });
}

/// Permissionless one-way universe opening. All aborting validation occurs
/// before native randomness is sampled; the post-draw path is fixed-shape.
#[allow(lint(public_random))]
public fun open_universe(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    random_obj: &Random,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    assert_open_preconditions(manifest, runtime, now_ms);
    let not_before = home_claim_not_before(manifest, now_ms);
    let mut generator = random::new_generator(random_obj, ctx);
    let seed = random::generate_bytes(&mut generator, 32);
    // No input-dependent assertions or branches after this point.
    commit_universe_open(runtime, seed, now_ms, not_before);
    event::emit(UniverseOpened {
        season_id: runtime.season_id,
        opened_at_ms: now_ms,
        home_claim_not_before_at_ms: not_before,
    });
}

public fun tick_home_availability(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    clock_obj: &Clock,
) {
    assert_runtime(manifest, runtime);
    assert!(!runtime.cancelled, ESeasonCancelled);
    assert!(runtime.home_window_resolution == RESOLUTION_PENDING, EHomeWindowAlreadyResolved);
    settle_availability(manifest, runtime, clock::timestamp_ms(clock_obj));
}

public fun pause_home_claims(
    cap: &SeasonAdminCap,
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    clock_obj: &Clock,
) {
    assert_cap(cap, manifest);
    assert_runtime(manifest, runtime);
    assert!(!runtime.paused, EAlreadyPaused);
    assert!(runtime.home_window_resolution == RESOLUTION_PENDING, EHomeWindowAlreadyResolved);
    let now_ms = clock::timestamp_ms(clock_obj);
    assert!(now_ms < manifest.home_claim_close_at_ms, EHomeWindowClosed);
    settle_availability(manifest, runtime, now_ms);
    runtime.paused = true;
}

public fun resume_home_claims(
    cap: &SeasonAdminCap,
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    clock_obj: &Clock,
) {
    assert_cap(cap, manifest);
    assert_runtime(manifest, runtime);
    assert!(runtime.paused, ENotPaused);
    assert!(runtime.home_window_resolution == RESOLUTION_PENDING, EHomeWindowAlreadyResolved);
    let now_ms = clock::timestamp_ms(clock_obj);
    assert!(now_ms < manifest.home_claim_close_at_ms, EHomeWindowClosed);
    runtime.paused = false;
    advance_last_tick_without_credit(manifest, runtime, now_ms);
}

/// Resolves the entire season, never an individual Seat. Missing timely tick
/// evidence conservatively cancels the home window.
public fun resolve_home_window(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    clock_obj: &Clock,
) {
    assert_runtime(manifest, runtime);
    assert!(runtime.home_window_resolution == RESOLUTION_PENDING, EHomeWindowAlreadyResolved);
    let now_ms = clock::timestamp_ms(clock_obj);
    assert!(now_ms >= manifest.home_claim_close_at_ms, EHomeWindowNotClosed);
    if (runtime.universe_opened) {
        settle_availability(manifest, runtime, now_ms);
    };
    if (
        runtime.universe_opened &&
        runtime.accumulated_home_claimable_ms >= manifest.minimum_home_claim_window_ms
    ) {
        runtime.home_window_resolution = RESOLUTION_CLOSED_AVAILABLE;
    } else {
        runtime.home_window_resolution = RESOLUTION_CANCELLED_UNAVAILABLE;
        runtime.cancelled = true;
    };
    event::emit(HomeWindowResolved {
        season_id: runtime.season_id,
        resolution: runtime.home_window_resolution,
        accumulated_claimable_ms: runtime.accumulated_home_claimable_ms,
    });
}

public fun begin_settlement(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    clock_obj: &Clock,
) {
    assert_runtime(manifest, runtime);
    assert!(clock::timestamp_ms(clock_obj) >= manifest.season_end_at_ms, ESettlementTooEarly);
    assert!(runtime.home_window_resolution != RESOLUTION_PENDING, EHomeWindowResolutionPending);
    assert!(!runtime.settlement_started, ESettlementAlreadyStarted);
    runtime.settlement_started = true;
}

public(package) fun assert_claim_open(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    now_ms: u64,
) {
    assert_runtime(manifest, runtime);
    assert!(!runtime.cancelled, ESeasonCancelled);
    assert!(runtime.universe_opened, EUniverseNotReady);
    assert!(!runtime.paused, EUniverseNotReady);
    assert!(runtime.home_window_resolution == RESOLUTION_PENDING, EHomeWindowAlreadyResolved);
    assert!(now_ms >= runtime.home_claim_not_before_at_ms, EUniverseNotReady);
    assert!(now_ms < manifest.home_claim_close_at_ms, EHomeWindowClosed);
}

public(package) fun assert_action_allowed_after_home_close(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    now_ms: u64,
) {
    assert_runtime(manifest, runtime);
    if (now_ms >= manifest.home_claim_close_at_ms) {
        assert!(runtime.home_window_resolution != RESOLUTION_PENDING, EHomeWindowResolutionPending);
    };
    assert!(!runtime.cancelled, ESeasonCancelled);
    assert!(now_ms < manifest.season_end_at_ms, ESeasonEnded);
}

fun assert_open_preconditions(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    now_ms: u64,
) {
    assert_runtime(manifest, runtime);
    assert!(!runtime.universe_opened, EUniverseAlreadyOpened);
    assert!(!runtime.cancelled, ESeasonCancelled);
    assert!(now_ms >= manifest.universe_open_at_ms, EUniverseNotReady);
    assert!(now_ms < manifest.home_claim_close_at_ms, EHomeWindowClosed);
    assert!(now_ms <= 0xffffffffffffffff - manifest.seed_observation_delay_ms, EClockOverflow);
}

fun home_claim_not_before(manifest: &SeasonManifest, opened_at_ms: u64): u64 {
    let observed_at = opened_at_ms + manifest.seed_observation_delay_ms;
    if (observed_at > manifest.home_claim_open_at_ms) observed_at else manifest.home_claim_open_at_ms
}

fun commit_universe_open(
    runtime: &mut SeasonRuntime,
    seed: vector<u8>,
    opened_at_ms: u64,
    not_before_at_ms: u64,
) {
    runtime.universe_opened = true;
    runtime.universe_opened_at_ms = opened_at_ms;
    runtime.universe_seed = seed;
    runtime.home_claim_not_before_at_ms = not_before_at_ms;
    runtime.home_availability_last_tick_at_ms = not_before_at_ms;
}

fun settle_availability(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    now_ms: u64,
) {
    if (!runtime.universe_opened) return;
    let close_at = manifest.home_claim_close_at_ms;
    let bounded_now = if (now_ms < close_at) now_ms else close_at;
    let last = runtime.home_availability_last_tick_at_ms;
    if (bounded_now <= last) return;
    if (!runtime.paused && bounded_now > runtime.home_claim_not_before_at_ms) {
        let start = if (last > runtime.home_claim_not_before_at_ms) {
            last
        } else {
            runtime.home_claim_not_before_at_ms
        };
        if (bounded_now > start) {
            let elapsed = bounded_now - start;
            let credit = if (elapsed > manifest.max_home_availability_tick_gap_ms) {
                manifest.max_home_availability_tick_gap_ms
            } else {
                elapsed
            };
            runtime.accumulated_home_claimable_ms =
                runtime.accumulated_home_claimable_ms + credit;
        };
    };
    runtime.home_availability_last_tick_at_ms = bounded_now;
}

fun advance_last_tick_without_credit(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    now_ms: u64,
) {
    let bounded_now = if (now_ms < manifest.home_claim_close_at_ms) {
        now_ms
    } else {
        manifest.home_claim_close_at_ms
    };
    if (bounded_now > runtime.home_availability_last_tick_at_ms) {
        runtime.home_availability_last_tick_at_ms = bounded_now;
    };
}

fun assert_runtime(manifest: &SeasonManifest, runtime: &SeasonRuntime) {
    assert!(runtime.season_id == object::id(manifest), ESeasonMismatch);
    assert!(object::id(runtime) == manifest.runtime_id, ESeasonMismatch);
}

fun assert_cap(cap: &SeasonAdminCap, manifest: &SeasonManifest) {
    assert!(cap.season_id == object::id(manifest), ESeasonMismatch);
}

public fun season_id(self: &SeasonManifest): ID { object::id(self) }
public fun league(self: &SeasonManifest): u8 { self.league }
public fun enrollment_close_at_ms(self: &SeasonManifest): u64 { self.enrollment_close_at_ms }
public fun home_claim_close_at_ms(self: &SeasonManifest): u64 { self.home_claim_close_at_ms }
public fun max_ranked_seats(self: &SeasonManifest): u64 { self.max_ranked_seats }
public fun world_radius(self: &SeasonManifest): u64 { self.world_radius }
public fun planet_hash_threshold(self: &SeasonManifest): u256 { self.planet_hash_threshold }
public fun location_hash_key(self: &SeasonManifest): u64 { self.location_hash_key }
public fun space_type_key(self: &SeasonManifest): u64 { self.space_type_key }
public fun perlin_scale(self: &SeasonManifest): u64 { self.perlin_scale }
public fun perlin_mirror_x(self: &SeasonManifest): bool { self.perlin_mirror_x }
public fun perlin_mirror_y(self: &SeasonManifest): bool { self.perlin_mirror_y }
public fun home_perlin_min(self: &SeasonManifest): u8 { self.home_perlin_min }
public fun home_perlin_max(self: &SeasonManifest): u8 { self.home_perlin_max }
public fun rules_geometry_commitment(self: &SeasonManifest): u256 { self.rules_geometry_commitment }
public fun proof_network_field(self: &SeasonManifest): u256 { self.proof_network_field }
public fun claim_home_circuit_config_id(self: &SeasonManifest): ID {
    self.claim_home_circuit.config_id
}
public fun claim_home_circuit_config_digest(self: &SeasonManifest): &vector<u8> {
    &self.claim_home_circuit.config_digest
}
public fun claim_home_verifying_key_digest(self: &SeasonManifest): &vector<u8> {
    &self.claim_home_circuit.verifying_key_digest
}
public fun move_circuit_config_id(self: &SeasonManifest): ID {
    self.move_circuit.config_id
}
public fun move_circuit_config_digest(self: &SeasonManifest): &vector<u8> {
    &self.move_circuit.config_digest
}
public fun move_verifying_key_digest(self: &SeasonManifest): &vector<u8> {
    &self.move_circuit.verifying_key_digest
}
public fun move_new_circuit_config_id(self: &SeasonManifest): ID {
    self.move_new_circuit.config_id
}
public fun move_new_circuit_config_digest(self: &SeasonManifest): &vector<u8> {
    &self.move_new_circuit.config_digest
}
public fun move_new_verifying_key_digest(self: &SeasonManifest): &vector<u8> {
    &self.move_new_circuit.verifying_key_digest
}
public fun enrollment_registry_id(self: &SeasonManifest): ID { self.enrollment_registry_id }
public fun planet_registry_id(self: &SeasonManifest): ID { self.planet_registry_id }
public fun universe_opened(self: &SeasonRuntime): bool { self.universe_opened }
public fun universe_seed(self: &SeasonRuntime): &vector<u8> { &self.universe_seed }
public fun home_claim_not_before_at_ms(self: &SeasonRuntime): u64 { self.home_claim_not_before_at_ms }
public fun accumulated_home_claimable_ms(self: &SeasonRuntime): u64 { self.accumulated_home_claimable_ms }
public fun home_window_resolution(self: &SeasonRuntime): u8 { self.home_window_resolution }
public fun is_cancelled(self: &SeasonRuntime): bool { self.cancelled }
public fun settlement_started(self: &SeasonRuntime): bool { self.settlement_started }
public fun resolution_pending(): u8 { RESOLUTION_PENDING }
public fun resolution_closed_available(): u8 { RESOLUTION_CLOSED_AVAILABLE }
public fun resolution_cancelled_unavailable(): u8 { RESOLUTION_CANCELLED_UNAVAILABLE }

#[test_only]
public fun new_season_for_testing(
    league: u8,
    enrollment_close_at_ms: u64,
    universe_open_at_ms: u64,
    home_claim_open_at_ms: u64,
    home_claim_close_at_ms: u64,
    season_end_at_ms: u64,
    seed_observation_delay_ms: u64,
    minimum_home_claim_window_ms: u64,
    max_home_availability_tick_gap_ms: u64,
    max_ranked_seats: u64,
    ctx: &mut TxContext,
): (SeasonManifest, SeasonRuntime, SeasonAdminCap) {
    new_season(
        league,
        enrollment_close_at_ms,
        universe_open_at_ms,
        home_claim_open_at_ms,
        home_claim_close_at_ms,
        season_end_at_ms,
        seed_observation_delay_ms,
        minimum_home_claim_window_ms,
        max_home_availability_tick_gap_ms,
        max_ranked_seats,
        12000,
        rules_geometry::round5_planet_hash_threshold(),
        115,
        116,
        16384,
        false,
        false,
        13,
        14,
        proof_intent::mainnet_network_field(),
        @0x0.to_id(),
        vector[],
        vector[],
        @0x0.to_id(),
        vector[],
        vector[],
        @0x0.to_id(),
        vector[],
        vector[],
        ctx,
    )
}

#[test_only]
public fun bind_circuit_configs_for_testing(
    manifest: &mut SeasonManifest,
    claim_home_circuit_config_id: ID,
    claim_home_circuit_config_digest: vector<u8>,
    claim_home_verifying_key_digest: vector<u8>,
    move_circuit_config_id: ID,
    move_circuit_config_digest: vector<u8>,
    move_verifying_key_digest: vector<u8>,
) {
    assert!(manifest.claim_home_circuit.config_id == @0x0.to_id(), EInvalidManifest);
    assert!(manifest.move_circuit.config_id == @0x0.to_id(), EInvalidManifest);
    assert!(claim_home_circuit_config_id != @0x0.to_id(), EInvalidManifest);
    assert!(move_circuit_config_id != @0x0.to_id(), EInvalidManifest);
    assert!(claim_home_circuit_config_id != move_circuit_config_id, EInvalidManifest);
    assert!(claim_home_circuit_config_digest.length() == 32, EInvalidManifest);
    assert!(claim_home_verifying_key_digest.length() == 32, EInvalidManifest);
    assert!(move_circuit_config_digest.length() == 32, EInvalidManifest);
    assert!(move_verifying_key_digest.length() == 32, EInvalidManifest);
    manifest.claim_home_circuit.config_id = claim_home_circuit_config_id;
    manifest.claim_home_circuit.config_digest = claim_home_circuit_config_digest;
    manifest.claim_home_circuit.verifying_key_digest = claim_home_verifying_key_digest;
    manifest.move_circuit.config_id = move_circuit_config_id;
    manifest.move_circuit.config_digest = move_circuit_config_digest;
    manifest.move_circuit.verifying_key_digest = move_verifying_key_digest;
}

#[test_only]
public fun bind_move_new_config_for_testing(
    manifest: &mut SeasonManifest,
    move_new_circuit_config_id: ID,
    move_new_circuit_config_digest: vector<u8>,
    move_new_verifying_key_digest: vector<u8>,
) {
    assert!(manifest.claim_home_circuit.config_id != @0x0.to_id(), EInvalidManifest);
    assert!(manifest.move_circuit.config_id != @0x0.to_id(), EInvalidManifest);
    assert!(manifest.move_new_circuit.config_id == @0x0.to_id(), EInvalidManifest);
    assert!(move_new_circuit_config_id != @0x0.to_id(), EInvalidManifest);
    assert!(move_new_circuit_config_id != manifest.claim_home_circuit.config_id, EInvalidManifest);
    assert!(move_new_circuit_config_id != manifest.move_circuit.config_id, EInvalidManifest);
    assert!(move_new_circuit_config_digest.length() == 32, EInvalidManifest);
    assert!(move_new_verifying_key_digest.length() == 32, EInvalidManifest);
    manifest.move_new_circuit.config_id = move_new_circuit_config_id;
    manifest.move_new_circuit.config_digest = move_new_circuit_config_digest;
    manifest.move_new_circuit.verifying_key_digest = move_new_verifying_key_digest;
}

#[test_only]
public fun open_universe_for_testing(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    seed: vector<u8>,
    now_ms: u64,
) {
    assert_open_preconditions(manifest, runtime, now_ms);
    assert!(seed.length() == 32, EInvalidManifest);
    let not_before = home_claim_not_before(manifest, now_ms);
    commit_universe_open(runtime, seed, now_ms, not_before);
}

#[test_only]
public fun tick_home_availability_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    now_ms: u64,
) {
    assert_runtime(manifest, runtime);
    assert!(runtime.home_window_resolution == RESOLUTION_PENDING, EHomeWindowAlreadyResolved);
    settle_availability(manifest, runtime, now_ms);
}

#[test_only]
public fun resolve_home_window_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    now_ms: u64,
) {
    assert_runtime(manifest, runtime);
    assert!(runtime.home_window_resolution == RESOLUTION_PENDING, EHomeWindowAlreadyResolved);
    assert!(now_ms >= manifest.home_claim_close_at_ms, EHomeWindowNotClosed);
    if (runtime.universe_opened) settle_availability(manifest, runtime, now_ms);
    if (
        runtime.universe_opened &&
        runtime.accumulated_home_claimable_ms >= manifest.minimum_home_claim_window_ms
    ) {
        runtime.home_window_resolution = RESOLUTION_CLOSED_AVAILABLE;
    } else {
        runtime.home_window_resolution = RESOLUTION_CANCELLED_UNAVAILABLE;
        runtime.cancelled = true;
    };
}

#[test_only]
public fun pause_at_for_testing(
    cap: &SeasonAdminCap,
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    now_ms: u64,
) {
    assert_cap(cap, manifest);
    assert_runtime(manifest, runtime);
    assert!(!runtime.paused, EAlreadyPaused);
    assert!(now_ms < manifest.home_claim_close_at_ms, EHomeWindowClosed);
    settle_availability(manifest, runtime, now_ms);
    runtime.paused = true;
}

#[test_only]
public fun resume_at_for_testing(
    cap: &SeasonAdminCap,
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    now_ms: u64,
) {
    assert_cap(cap, manifest);
    assert_runtime(manifest, runtime);
    assert!(runtime.paused, ENotPaused);
    assert!(now_ms < manifest.home_claim_close_at_ms, EHomeWindowClosed);
    runtime.paused = false;
    advance_last_tick_without_credit(manifest, runtime, now_ms);
}

#[test_only]
public fun begin_settlement_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &mut SeasonRuntime,
    now_ms: u64,
) {
    assert_runtime(manifest, runtime);
    assert!(now_ms >= manifest.season_end_at_ms, ESettlementTooEarly);
    assert!(runtime.home_window_resolution != RESOLUTION_PENDING, EHomeWindowResolutionPending);
    assert!(!runtime.settlement_started, ESettlementAlreadyStarted);
    runtime.settlement_started = true;
}

#[test_only]
public fun assert_action_allowed_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    now_ms: u64,
) {
    assert_action_allowed_after_home_close(manifest, runtime, now_ms)
}

#[test_only]
public fun destroy_for_testing(
    manifest: SeasonManifest,
    runtime: SeasonRuntime,
    admin_cap: SeasonAdminCap,
) {
    let SeasonManifest { id, version: _, league: _, enrollment_close_at_ms: _, universe_open_at_ms: _, home_claim_open_at_ms: _, home_claim_close_at_ms: _, season_end_at_ms: _, seed_observation_delay_ms: _, minimum_home_claim_window_ms: _, max_home_availability_tick_gap_ms: _, max_ranked_seats: _, world_radius: _, planet_hash_threshold: _, location_hash_key: _, space_type_key: _, perlin_scale: _, perlin_mirror_x: _, perlin_mirror_y: _, home_perlin_min: _, home_perlin_max: _, rules_geometry_commitment: _, proof_network_field: _, claim_home_circuit: _, move_circuit: _, move_new_circuit: _, enrollment_registry_id: _, runtime_id: _, planet_registry_id: _ } = manifest;
    object::delete(id);
    let SeasonRuntime { id, season_id: _, universe_opened: _, universe_opened_at_ms: _, universe_seed: _, home_claim_not_before_at_ms: _, paused: _, home_availability_last_tick_at_ms: _, accumulated_home_claimable_ms: _, home_window_resolution: _, cancelled: _, settlement_started: _ } = runtime;
    object::delete(id);
    let SeasonAdminCap { id, season_id: _ } = admin_cap;
    object::delete(id);
}
