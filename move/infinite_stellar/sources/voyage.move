module infinite_stellar::voyage;

use infinite_stellar::artifact::{Self as artifact, Artifact};
use infinite_stellar::identity::{Self as identity, CivilizationState, SeasonSeat};
use infinite_stellar::planet::{Self as planet, Planet};
use infinite_stellar::round5_rules as rules;
use infinite_stellar::season::{Self as season, SeasonManifest, SeasonRuntime};
use sui::event;

const PROOF_INTERFACE_VERSION: u64 = 1;

const EProductionVerifierUnavailable: u64 = 0;
const EInvalidProof: u64 = 1;
const EProofIntentMismatch: u64 = 2;
const ESamePlanet: u64 = 3;
const EZeroArrival: u64 = 4;
const ETimeOverflow: u64 = 5;
const EArrivalNotReady: u64 = 6;
const EVoyageTargetMismatch: u64 = 7;
const EWrongSettlementPath: u64 = 8;

/// Package-internal output of the future pinned movement verifier. It binds
/// the private distance proof to one season and exact source/target objects.
public struct VerifiedMoveProof has drop {
    interface_version: u64,
    season_id: ID,
    from_planet_id: ID,
    to_planet_id: ID,
    max_distance: u64,
    public_input_digest: vector<u8>,
}

/// One delayed Round-5 arrival. It is consumed exactly once by settlement.
public struct Voyage has key {
    id: UID,
    season_id: ID,
    controller_seat_id: ID,
    player_seat_id: ID,
    from_planet_id: ID,
    to_planet_id: ID,
    energy_arriving: u64,
    silver_moved: u64,
    departure_at_seconds: u64,
    arrival_at_seconds: u64,
    max_distance: u64,
    public_input_digest: vector<u8>,
    carried_artifact_id: Option<ID>,
    is_ship: bool,
    is_abandon: bool,
    route_kind: u8,
}

public struct VoyageDispatched has copy, drop {
    season_id: ID,
    voyage_id: ID,
    player_seat_id: ID,
    from_planet_id: ID,
    to_planet_id: ID,
    arrival_at_seconds: u64,
    is_abandon: bool,
}

public struct VoyageSettled has copy, drop {
    season_id: ID,
    voyage_id: ID,
    player_seat_id: ID,
    to_planet_id: ID,
    conquered: bool,
}

/// Production movement stays fail-closed until the verifier key and canonical
/// public-input encoder are frozen and independently reviewed.
public fun production_move_verifier_ready(): bool { false }
public fun required_proof_interface_version(): u64 { PROOF_INTERFACE_VERSION }

/// Explicit fail-closed probe for deployment and client integration tests.
public fun assert_production_move_verifier_ready() {
    abort EProductionVerifierUnavailable
}

public(package) fun new_verified_move_proof(
    interface_version: u64,
    season_id: ID,
    from_planet_id: ID,
    to_planet_id: ID,
    max_distance: u64,
    public_input_digest: vector<u8>,
): VerifiedMoveProof {
    VerifiedMoveProof {
        interface_version,
        season_id,
        from_planet_id,
        to_planet_id,
        max_distance,
        public_input_digest,
    }
}

public(package) fun dispatch_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(source, season_id);
    planet::assert_planet_season(target, season_id);
    planet::assert_controlled_by(source, seat);
    planet::assert_intact(target);
    let from_planet_id = object::id(source);
    let to_planet_id = object::id(target);
    assert!(from_planet_id != to_planet_id, ESamePlanet);

    let VerifiedMoveProof {
        interface_version,
        season_id: proof_season_id,
        from_planet_id: proof_from_planet_id,
        to_planet_id: proof_to_planet_id,
        max_distance,
        public_input_digest,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    assert!(proof_season_id == season_id, EProofIntentMismatch);
    assert!(proof_from_planet_id == from_planet_id, EProofIntentMismatch);
    assert!(proof_to_planet_id == to_planet_id, EProofIntentMismatch);
    assert!(max_distance <= 0xffffffffffffffff / 100, EInvalidProof);

    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(source, now_seconds);
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(source, now_seconds);
    planet::refresh(target, now_seconds);
    let route_range = planet::range(source);
    let route_speed = planet::speed(source);
    queue_refreshed_fleet(
        seat,
        civilization,
        source,
        target,
        season_id,
        from_planet_id,
        to_planet_id,
        max_distance,
        max_distance * 100,
        route_range,
        route_speed,
        sent_energy,
        sent_silver,
        now_seconds,
        public_input_digest,
        1,
        ctx,
    )
}

fun queue_refreshed_fleet(
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    season_id: ID,
    from_planet_id: ID,
    to_planet_id: ID,
    max_distance: u64,
    effective_distance_times_hundred: u64,
    route_range: u64,
    route_speed: u64,
    sent_energy: u64,
    sent_silver: u64,
    now_seconds: u64,
    public_input_digest: vector<u8>,
    route_kind: u8,
    ctx: &mut TxContext,
): Voyage {
    let energy_arriving = rules::decayed_arrival_energy(
        sent_energy,
        effective_distance_times_hundred,
        route_range,
        planet::energy_capacity(source),
    );
    assert!(energy_arriving > 0, EZeroArrival);
    let travel_time = rules::travel_time_seconds(
        effective_distance_times_hundred,
        route_speed,
    );
    assert!(now_seconds <= 0xffffffffffffffff - travel_time, ETimeOverflow);
    let arrival_at_seconds = now_seconds + travel_time;

    let target_space_junk = planet::take_space_junk_for_dispatch(target);
    identity::take_space_junk(seat, civilization, target_space_junk);
    planet::debit_for_voyage(source, sent_energy, sent_silver);
    let voyage_uid = object::new(ctx);
    let voyage_id = voyage_uid.to_inner();
    let player_seat_id = identity::seat_id(seat);
    planet::register_pending_voyage(
        target,
        voyage_id,
        player_seat_id,
        arrival_at_seconds,
    );
    identity::increment_pending_voyages(seat, civilization);
    let voyage = Voyage {
        id: voyage_uid,
        season_id,
        controller_seat_id: player_seat_id,
        player_seat_id,
        from_planet_id,
        to_planet_id,
        energy_arriving,
        silver_moved: sent_silver,
        departure_at_seconds: now_seconds,
        arrival_at_seconds,
        max_distance,
        public_input_digest,
        carried_artifact_id: option::none(),
        is_ship: false,
        is_abandon: false,
        route_kind,
    };
    event::emit(VoyageDispatched {
        season_id,
        voyage_id,
        player_seat_id,
        from_planet_id,
        to_planet_id,
        arrival_at_seconds,
        is_abandon: false,
    });
    voyage
}

public(package) fun dispatch_artifact_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    carried_artifact: &mut Artifact,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let mut voyage = dispatch_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        proof,
        sent_energy,
        sent_silver,
        now_ms,
        sender,
        ctx,
    );
    let voyage_id = object::id(&voyage);
    artifact::depart_artifact(carried_artifact, source, target, voyage_id);
    voyage.carried_artifact_id = option::some(object::id(carried_artifact));
    voyage
}

fun bind_carried_artifact(
    voyage: &mut Voyage,
    source: &mut Planet,
    target: &Planet,
    carried_artifact: &mut Artifact,
) {
    let voyage_id = object::id(voyage);
    artifact::depart_artifact(carried_artifact, source, target, voyage_id);
    voyage.carried_artifact_id = option::some(object::id(carried_artifact));
}

public(package) fun dispatch_wormhole_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    wormhole: &Artifact,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(source, season_id);
    planet::assert_planet_season(target, season_id);
    planet::assert_controlled_by(source, seat);
    planet::assert_intact(target);
    let from_planet_id = object::id(source);
    let to_planet_id = object::id(target);
    assert!(from_planet_id != to_planet_id, ESamePlanet);
    let (max_distance, public_input_digest) =
        validate_move_proof(proof, season_id, from_planet_id, to_planet_id);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(source, now_seconds);
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(source, now_seconds);
    planet::refresh(target, now_seconds);
    let divisor = artifact::wormhole_divisor_for_route(wormhole, source, target);
    let route_range = planet::range(source);
    let route_speed = planet::speed(source);
    queue_refreshed_fleet(
        seat,
        civilization,
        source,
        target,
        season_id,
        from_planet_id,
        to_planet_id,
        max_distance,
        max_distance * 100 / divisor,
        route_range,
        route_speed,
        sent_energy,
        sent_silver,
        now_seconds,
        public_input_digest,
        3,
        ctx,
    )
}

public(package) fun dispatch_wormhole_artifact_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    wormhole: &Artifact,
    carried_artifact: &mut Artifact,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let mut voyage = dispatch_wormhole_verified(
        manifest, runtime, seat, civilization, source, target, wormhole,
        proof, sent_energy, sent_silver, now_ms, sender, ctx,
    );
    bind_carried_artifact(&mut voyage, source, target, carried_artifact);
    voyage
}

public(package) fun dispatch_photoid_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    photoid: &mut Artifact,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(source, season_id);
    planet::assert_planet_season(target, season_id);
    planet::assert_controlled_by(source, seat);
    planet::assert_intact(target);
    let from_planet_id = object::id(source);
    let to_planet_id = object::id(target);
    assert!(from_planet_id != to_planet_id, ESamePlanet);
    let (max_distance, public_input_digest) =
        validate_move_proof(proof, season_id, from_planet_id, to_planet_id);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(source, now_seconds);
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(source, now_seconds);
    planet::refresh(target, now_seconds);
    let (range_multiplier, speed_multiplier) =
        artifact::consume_photoid_for_departure(photoid, source, now_seconds);
    let route_range = ((planet::range(source) as u128) * (range_multiplier as u128) / 100) as u64;
    let route_speed = ((planet::speed(source) as u128) * (speed_multiplier as u128) / 100) as u64;
    queue_refreshed_fleet(
        seat,
        civilization,
        source,
        target,
        season_id,
        from_planet_id,
        to_planet_id,
        max_distance,
        max_distance * 100,
        route_range,
        route_speed,
        sent_energy,
        sent_silver,
        now_seconds,
        public_input_digest,
        2,
        ctx,
    )
}

public(package) fun dispatch_photoid_artifact_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    photoid: &mut Artifact,
    carried_artifact: &mut Artifact,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let mut voyage = dispatch_photoid_verified(
        manifest, runtime, seat, civilization, source, target, photoid,
        proof, sent_energy, sent_silver, now_ms, sender, ctx,
    );
    bind_carried_artifact(&mut voyage, source, target, carried_artifact);
    voyage
}

public(package) fun dispatch_photoid_wormhole_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    photoid: &mut Artifact,
    wormhole: &Artifact,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(source, season_id);
    planet::assert_planet_season(target, season_id);
    planet::assert_controlled_by(source, seat);
    planet::assert_intact(target);
    let from_planet_id = object::id(source);
    let to_planet_id = object::id(target);
    assert!(from_planet_id != to_planet_id, ESamePlanet);
    let (max_distance, public_input_digest) =
        validate_move_proof(proof, season_id, from_planet_id, to_planet_id);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(source, now_seconds);
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(source, now_seconds);
    planet::refresh(target, now_seconds);
    let divisor = artifact::wormhole_divisor_for_route(wormhole, source, target);
    let (range_multiplier, speed_multiplier) =
        artifact::consume_photoid_for_departure(photoid, source, now_seconds);
    let route_range = ((planet::range(source) as u128) * (range_multiplier as u128) / 100) as u64;
    let route_speed = ((planet::speed(source) as u128) * (speed_multiplier as u128) / 100) as u64;
    queue_refreshed_fleet(
        seat,
        civilization,
        source,
        target,
        season_id,
        from_planet_id,
        to_planet_id,
        max_distance,
        max_distance * 100 / divisor,
        route_range,
        route_speed,
        sent_energy,
        sent_silver,
        now_seconds,
        public_input_digest,
        2,
        ctx,
    )
}

public(package) fun dispatch_photoid_wormhole_artifact_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    photoid: &mut Artifact,
    wormhole: &Artifact,
    carried_artifact: &mut Artifact,
    proof: VerifiedMoveProof,
    sent_energy: u64,
    sent_silver: u64,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let mut voyage = dispatch_photoid_wormhole_verified(
        manifest, runtime, seat, civilization, source, target, photoid,
        wormhole, proof, sent_energy, sent_silver, now_ms, sender, ctx,
    );
    bind_carried_artifact(&mut voyage, source, target, carried_artifact);
    voyage
}

fun validate_move_proof(
    proof: VerifiedMoveProof,
    season_id: ID,
    from_planet_id: ID,
    to_planet_id: ID,
): (u64, vector<u8>) {
    let VerifiedMoveProof {
        interface_version,
        season_id: proof_season_id,
        from_planet_id: proof_from_planet_id,
        to_planet_id: proof_to_planet_id,
        max_distance,
        public_input_digest,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    assert!(proof_season_id == season_id, EProofIntentMismatch);
    assert!(proof_from_planet_id == from_planet_id, EProofIntentMismatch);
    assert!(proof_to_planet_id == to_planet_id, EProofIntentMismatch);
    assert!(max_distance <= 0xffffffffffffffff / 100, EInvalidProof);
    (max_distance, public_input_digest)
}

/// Round-5 abandonment is a normal arrival with a source-side ownership reset
/// and temporary 150% route range/speed. All refreshed energy and silver are
/// sent. Source junk is returned before target junk is charged.
public(package) fun dispatch_abandon_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    proof: VerifiedMoveProof,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(source, season_id);
    planet::assert_planet_season(target, season_id);
    planet::assert_controlled_by(source, seat);
    planet::assert_intact(target);
    let from_planet_id = object::id(source);
    let to_planet_id = object::id(target);
    assert!(from_planet_id != to_planet_id, ESamePlanet);

    let VerifiedMoveProof {
        interface_version,
        season_id: proof_season_id,
        from_planet_id: proof_from_planet_id,
        to_planet_id: proof_to_planet_id,
        max_distance,
        public_input_digest,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    assert!(proof_season_id == season_id, EProofIntentMismatch);
    assert!(proof_from_planet_id == from_planet_id, EProofIntentMismatch);
    assert!(proof_to_planet_id == to_planet_id, EProofIntentMismatch);
    assert!(max_distance <= 0xffffffffffffffff / 100, EInvalidProof);

    let now_seconds = now_ms / 1000;
    planet::assert_no_pending_voyage(source);
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(source, now_seconds);
    planet::refresh(target, now_seconds);
    let sent_energy = planet::energy(source);
    let sent_silver = planet::silver(source);
    let effective_distance_times_hundred = max_distance * 100;
    let energy_arriving = rules::decayed_arrival_energy(
        sent_energy,
        effective_distance_times_hundred,
        rules::abandoning_range(planet::range(source)),
        planet::energy_capacity(source),
    );
    assert!(energy_arriving > 0, EZeroArrival);
    let travel_time = rules::travel_time_seconds(
        effective_distance_times_hundred,
        rules::abandoning_speed(planet::speed(source)),
    );
    assert!(now_seconds <= 0xffffffffffffffff - travel_time, ETimeOverflow);
    let arrival_at_seconds = now_seconds + travel_time;

    let (actual_energy, actual_silver) =
        planet::abandon_for_voyage(source, seat, civilization);
    assert!(actual_energy == sent_energy && actual_silver == sent_silver, EInvalidProof);
    let target_space_junk = planet::take_space_junk_for_dispatch(target);
    identity::take_space_junk(seat, civilization, target_space_junk);
    let voyage_uid = object::new(ctx);
    let voyage_id = voyage_uid.to_inner();
    let player_seat_id = identity::seat_id(seat);
    planet::register_pending_voyage(target, voyage_id, player_seat_id, arrival_at_seconds);
    identity::increment_pending_voyages(seat, civilization);
    let voyage = Voyage {
        id: voyage_uid,
        season_id,
        controller_seat_id: player_seat_id,
        player_seat_id,
        from_planet_id,
        to_planet_id,
        energy_arriving,
        silver_moved: sent_silver,
        departure_at_seconds: now_seconds,
        arrival_at_seconds,
        max_distance,
        public_input_digest,
        carried_artifact_id: option::none(),
        is_ship: false,
        is_abandon: true,
        route_kind: 1,
    };
    event::emit(VoyageDispatched {
        season_id,
        voyage_id,
        player_seat_id,
        from_planet_id,
        to_planet_id,
        arrival_at_seconds,
        is_abandon: true,
    });
    voyage
}

public(package) fun dispatch_abandon_artifact_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    carried_artifact: &mut Artifact,
    proof: VerifiedMoveProof,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let mut voyage = dispatch_abandon_verified(
        manifest, runtime, seat, civilization, source, target,
        proof, now_ms, sender, ctx,
    );
    bind_carried_artifact(&mut voyage, source, target, carried_artifact);
    voyage
}

/// Ship movement uses the same verified route but zero energy and silver. The
/// immutable ship controller replaces source-planet ownership authority.
public(package) fun dispatch_ship_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    ship: &mut Artifact,
    proof: VerifiedMoveProof,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(source, season_id);
    planet::assert_planet_season(target, season_id);
    let from_planet_id = object::id(source);
    let to_planet_id = object::id(target);
    assert!(from_planet_id != to_planet_id, ESamePlanet);

    let VerifiedMoveProof {
        interface_version,
        season_id: proof_season_id,
        from_planet_id: proof_from_planet_id,
        to_planet_id: proof_to_planet_id,
        max_distance,
        public_input_digest,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    assert!(proof_season_id == season_id, EProofIntentMismatch);
    assert!(proof_from_planet_id == from_planet_id, EProofIntentMismatch);
    assert!(proof_to_planet_id == to_planet_id, EProofIntentMismatch);
    assert!(max_distance <= 0xffffffffffffffff / 100, EInvalidProof);

    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(source, now_seconds);
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(source, now_seconds);
    planet::refresh(target, now_seconds);
    let travel_time = rules::travel_time_seconds(max_distance * 100, planet::speed(source));
    assert!(now_seconds <= 0xffffffffffffffff - travel_time, ETimeOverflow);
    let arrival_at_seconds = now_seconds + travel_time;

    let voyage_uid = object::new(ctx);
    let voyage_id = voyage_uid.to_inner();
    let controller_seat_id = identity::seat_id(seat);
    let carried_artifact_id = object::id(ship);
    artifact::depart_ship(ship, source, target, voyage_id, sender);
    let arrival_player_seat_id = @0x0.to_id();
    planet::register_pending_voyage(
        target,
        voyage_id,
        arrival_player_seat_id,
        arrival_at_seconds,
    );
    identity::increment_pending_voyages(seat, civilization);
    let voyage = Voyage {
        id: voyage_uid,
        season_id,
        controller_seat_id,
        player_seat_id: arrival_player_seat_id,
        from_planet_id,
        to_planet_id,
        energy_arriving: 0,
        silver_moved: 0,
        departure_at_seconds: now_seconds,
        arrival_at_seconds,
        max_distance,
        public_input_digest,
        carried_artifact_id: option::some(carried_artifact_id),
        is_ship: true,
        is_abandon: false,
        route_kind: 1,
    };
    event::emit(VoyageDispatched {
        season_id,
        voyage_id,
        player_seat_id: arrival_player_seat_id,
        from_planet_id,
        to_planet_id,
        arrival_at_seconds,
        is_abandon: false,
    });
    voyage
}

/// Settles a friendly reinforcement or an arrival against an unowned planet.
/// Anyone may submit settlement once the arrival time is reached.
public(package) fun settle_neutral_or_friendly(
    voyage: Voyage,
    target: &mut Planet,
    attacker_seat: &SeasonSeat,
    attacker_civilization: &mut CivilizationState,
    now_ms: u64,
) {
    assert!(!voyage.is_ship, EWrongSettlementPath);
    assert!(voyage.carried_artifact_id.is_none(), EWrongSettlementPath);
    let attacker_id = identity::seat_id(attacker_seat);
    assert!(
        planet::is_neutral(target) || planet::owner_seat_id(target) == attacker_id,
        EWrongSettlementPath,
    );
    let was_neutral = planet::is_neutral(target);
    let (conquered, _) = apply_arrival(voyage, target, attacker_id, now_ms);
    identity::decrement_pending_voyages(attacker_seat, attacker_civilization);
    if (was_neutral && conquered) {
        identity::increment_controlled_planets(attacker_seat, attacker_civilization);
    };
}

public(package) fun settle_neutral_or_friendly_with_artifact(
    voyage: Voyage,
    target: &mut Planet,
    carried_artifact: &mut Artifact,
    attacker_seat: &SeasonSeat,
    attacker_civilization: &mut CivilizationState,
    now_ms: u64,
) {
    assert!(!voyage.is_ship, EWrongSettlementPath);
    assert!(voyage.carried_artifact_id.is_some(), EWrongSettlementPath);
    assert!(*voyage.carried_artifact_id.borrow() == object::id(carried_artifact), EProofIntentMismatch);
    let attacker_id = identity::seat_id(attacker_seat);
    assert!(
        planet::is_neutral(target) || planet::owner_seat_id(target) == attacker_id,
        EWrongSettlementPath,
    );
    let was_neutral = planet::is_neutral(target);
    let (conquered, voyage_id) = apply_arrival(voyage, target, attacker_id, now_ms);
    artifact::arrive_artifact(carried_artifact, target, voyage_id);
    identity::decrement_pending_voyages(attacker_seat, attacker_civilization);
    if (was_neutral && conquered) {
        identity::increment_controlled_planets(attacker_seat, attacker_civilization);
    };
}

/// Settles an attack against a currently owned planet and updates both exact
/// civilization aggregates atomically when ownership changes.
public(package) fun settle_hostile(
    voyage: Voyage,
    target: &mut Planet,
    attacker_seat: &SeasonSeat,
    attacker_civilization: &mut CivilizationState,
    defender_seat: &SeasonSeat,
    defender_civilization: &mut CivilizationState,
    now_ms: u64,
) {
    assert!(!voyage.is_ship, EWrongSettlementPath);
    assert!(voyage.carried_artifact_id.is_none(), EWrongSettlementPath);
    let attacker_id = identity::seat_id(attacker_seat);
    assert!(attacker_id != identity::seat_id(defender_seat), EWrongSettlementPath);
    assert!(voyage.player_seat_id == attacker_id, EProofIntentMismatch);
    planet::assert_controlled_by(target, defender_seat);
    let (conquered, _) = apply_arrival(voyage, target, attacker_id, now_ms);
    identity::decrement_pending_voyages(attacker_seat, attacker_civilization);
    if (conquered) {
        identity::increment_controlled_planets(attacker_seat, attacker_civilization);
        identity::decrement_controlled_planets(defender_seat, defender_civilization);
    };
}

public(package) fun settle_hostile_with_artifact(
    voyage: Voyage,
    target: &mut Planet,
    carried_artifact: &mut Artifact,
    attacker_seat: &SeasonSeat,
    attacker_civilization: &mut CivilizationState,
    defender_seat: &SeasonSeat,
    defender_civilization: &mut CivilizationState,
    now_ms: u64,
) {
    assert!(!voyage.is_ship, EWrongSettlementPath);
    assert!(voyage.carried_artifact_id.is_some(), EWrongSettlementPath);
    assert!(*voyage.carried_artifact_id.borrow() == object::id(carried_artifact), EProofIntentMismatch);
    let attacker_id = identity::seat_id(attacker_seat);
    assert!(attacker_id != identity::seat_id(defender_seat), EWrongSettlementPath);
    assert!(voyage.player_seat_id == attacker_id, EProofIntentMismatch);
    planet::assert_controlled_by(target, defender_seat);
    let (conquered, voyage_id) = apply_arrival(voyage, target, attacker_id, now_ms);
    artifact::arrive_artifact(carried_artifact, target, voyage_id);
    identity::decrement_pending_voyages(attacker_seat, attacker_civilization);
    if (conquered) {
        identity::increment_controlled_planets(attacker_seat, attacker_civilization);
        identity::decrement_controlled_planets(defender_seat, defender_civilization);
    };
}

public(package) fun settle_ship(
    voyage: Voyage,
    target: &mut Planet,
    ship: &mut Artifact,
    controller_seat: &SeasonSeat,
    controller_civilization: &mut CivilizationState,
    now_ms: u64,
) {
    assert!(voyage.is_ship, EWrongSettlementPath);
    assert!(voyage.player_seat_id == @0x0.to_id(), EWrongSettlementPath);
    assert!(voyage.carried_artifact_id.is_some(), EWrongSettlementPath);
    assert!(*voyage.carried_artifact_id.borrow() == object::id(ship), EProofIntentMismatch);
    assert!(voyage.controller_seat_id == identity::seat_id(controller_seat), EProofIntentMismatch);
    let (_, voyage_id) = apply_arrival(voyage, target, @0x0.to_id(), now_ms);
    artifact::arrive_ship(ship, target, voyage_id);
    identity::decrement_pending_voyages(controller_seat, controller_civilization);
}

fun apply_arrival(
    voyage: Voyage,
    target: &mut Planet,
    attacker_id: ID,
    now_ms: u64,
): (bool, ID) {
    let Voyage {
        id,
        season_id,
        controller_seat_id: _,
        player_seat_id,
        from_planet_id: _,
        to_planet_id,
        energy_arriving,
        silver_moved,
        departure_at_seconds: _,
        arrival_at_seconds,
        max_distance: _,
        public_input_digest: _,
        carried_artifact_id: _,
        is_ship: _,
        is_abandon: _,
        route_kind,
    } = voyage;
    let voyage_id = id.to_inner();
    assert!(player_seat_id == attacker_id, EProofIntentMismatch);
    assert!(object::id(target) == to_planet_id, EVoyageTargetMismatch);
    planet::assert_planet_season(target, season_id);
    assert!(now_ms / 1000 >= arrival_at_seconds, EArrivalNotReady);
    planet::remove_due_pending_voyage(target, voyage_id, arrival_at_seconds);
    planet::refresh(target, arrival_at_seconds);
    let conquered = if (route_kind == 3) {
        planet::apply_wormhole_energy_and_silver_arrival(
            target,
            player_seat_id,
            energy_arriving,
            silver_moved,
        );
        false
    } else {
        planet::apply_energy_and_silver_arrival(
            target,
            player_seat_id,
            energy_arriving,
            silver_moved,
        )
    };
    event::emit(VoyageSettled {
        season_id,
        voyage_id,
        player_seat_id,
        to_planet_id,
        conquered,
    });
    object::delete(id);
    (conquered, voyage_id)
}

public fun voyage_id(self: &Voyage): ID { object::id(self) }
public fun from_planet_id(self: &Voyage): ID { self.from_planet_id }
public fun to_planet_id(self: &Voyage): ID { self.to_planet_id }
public fun energy_arriving(self: &Voyage): u64 { self.energy_arriving }
public fun silver_moved(self: &Voyage): u64 { self.silver_moved }
public fun departure_at_seconds(self: &Voyage): u64 { self.departure_at_seconds }
public fun arrival_at_seconds(self: &Voyage): u64 { self.arrival_at_seconds }
public fun is_ship_voyage(self: &Voyage): bool { self.is_ship }
public fun is_abandon_voyage(self: &Voyage): bool { self.is_abandon }
public fun route_kind(self: &Voyage): u8 { self.route_kind }

#[test_only]
public fun dispatch_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let proof = new_verified_move_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(source),
        object::id(target),
        max_distance,
        public_input_digest,
    );
    dispatch_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        proof,
        sent_energy,
        sent_silver,
        now_ms,
        sender,
        ctx,
    )
}

#[test_only]
public fun dispatch_abandon_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    max_distance: u64,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let proof = new_verified_move_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(source),
        object::id(target),
        max_distance,
        public_input_digest,
    );
    dispatch_abandon_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        proof,
        now_ms,
        sender,
        ctx,
    )
}

#[test_only]
public fun dispatch_artifact_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    carried_artifact: &mut Artifact,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let proof = new_verified_move_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(source),
        object::id(target),
        max_distance,
        public_input_digest,
    );
    dispatch_artifact_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        carried_artifact,
        proof,
        sent_energy,
        sent_silver,
        now_ms,
        sender,
        ctx,
    )
}

#[test_only]
public fun dispatch_wormhole_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    wormhole: &Artifact,
    max_distance: u64,
    sent_energy: u64,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let proof = new_verified_move_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(source),
        object::id(target),
        max_distance,
        public_input_digest,
    );
    dispatch_wormhole_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        wormhole,
        proof,
        sent_energy,
        0,
        now_ms,
        sender,
        ctx,
    )
}

#[test_only]
public fun dispatch_photoid_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    photoid: &mut Artifact,
    max_distance: u64,
    sent_energy: u64,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let proof = new_verified_move_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(source),
        object::id(target),
        max_distance,
        public_input_digest,
    );
    dispatch_photoid_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        photoid,
        proof,
        sent_energy,
        0,
        now_ms,
        sender,
        ctx,
    )
}

#[test_only]
public fun dispatch_ship_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    ship: &mut Artifact,
    max_distance: u64,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    let proof = new_verified_move_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(source),
        object::id(target),
        max_distance,
        public_input_digest,
    );
    dispatch_ship_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        ship,
        proof,
        now_ms,
        sender,
        ctx,
    )
}

#[test_only]
public fun destroy_for_testing(voyage: Voyage) {
    let Voyage {
        id,
        season_id: _,
        controller_seat_id: _,
        player_seat_id: _,
        from_planet_id: _,
        to_planet_id: _,
        energy_arriving: _,
        silver_moved: _,
        departure_at_seconds: _,
        arrival_at_seconds: _,
        max_distance: _,
        public_input_digest: _,
        carried_artifact_id: _,
        is_ship: _,
        is_abandon: _,
        route_kind: _,
    } = voyage;
    object::delete(id);
}
