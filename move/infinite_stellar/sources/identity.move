module infinite_stellar::identity;

use infinite_stellar::season::{Self as season, SeasonManifest};
use sui::derived_object;
use sui::event;

const ADAPTER_INTERFACE_VERSION: u64 = 1;
const STATUS_AWAITING_HOME: u8 = 0;
const STATUS_ACTIVE: u8 = 1;
const STATUS_ELIMINATED: u8 = 2;
const STATUS_SETTLED: u8 = 3;
const STATUS_CANCELLED: u8 = 4;

const ESeasonMismatch: u64 = 0;
const EEnrollmentClosed: u64 = 1;
const ESeasonFull: u64 = 2;
const EControllerAlreadyEnrolled: u64 = 3;
const ESoulAlreadyEnrolled: u64 = 4;
const EInvalidSoulBinding: u64 = 5;
const ENotSoulOwner: u64 = 6;
const ESoulListed: u64 = 7;
const ESeatMismatch: u64 = 8;
const ENotSeatController: u64 = 9;
const EWrongLifecycle: u64 = 10;
const EHomeAlreadyClaimed: u64 = 11;
const EHomeNotClaimed: u64 = 12;
const EHomeWindowResolutionPending: u64 = 13;

/// Shared only during enrollment. It is intentionally absent from ordinary
/// play transactions.
public struct EnrollmentRegistry has key {
    id: UID,
    season_id: ID,
    max_ranked_seats: u64,
    created_count: u64,
}

/// Exact typed key and field order are part of the P0 routing contract.
public struct ControllerSeatKey has copy, drop, store {
    encoding_version: u64,
    season_id: ID,
    league: u8,
    controller: address,
}

public struct SoulSeasonKey has copy, drop, store {
    encoding_version: u64,
    season_id: ID,
    soul_id: ID,
}

/// Package-internal proof that an adapter validated one canonical Soul state.
/// It has no `store` ability and cannot be persisted or constructed by callers
/// outside this package.
public struct VerifiedSoulBinding has drop {
    interface_version: u64,
    soulidity_package_id: ID,
    soul_state_id: ID,
    soul_id: ID,
    current_owner: address,
    ownership_epoch: u64,
    listed: bool,
    projection_commitment: vector<u8>,
}

public struct SeasonSeat has key {
    id: UID,
    season_id: ID,
    league: u8,
    controller: address,
    soul_id: ID,
    projection_id: ID,
    civilization_id: ID,
    score_card_id: ID,
}

public struct CommanderProjection has key {
    id: UID,
    season_id: ID,
    seat_id: ID,
    soulidity_package_id: ID,
    soul_state_id: ID,
    soul_id: ID,
    controller_at_enrollment: address,
    ownership_epoch_at_enrollment: u64,
    projection_commitment: vector<u8>,
}

public struct CivilizationState has key {
    id: UID,
    season_id: ID,
    seat_id: ID,
    status: u8,
    controlled_planet_count: u64,
    initial_home_planet_id: Option<ID>,
    home_claim_consumed: bool,
    activated_once: bool,
}

public struct ScoreCard has key {
    id: UID,
    season_id: ID,
    seat_id: ID,
    score: u64,
    pending_scored_arrival_count: u64,
}

public struct SeatEnrolled has copy, drop {
    season_id: ID,
    seat_id: ID,
    controller: address,
    soul_id: ID,
    projection_id: ID,
}

public(package) fun new_registry(
    season_id: ID,
    max_ranked_seats: u64,
    ctx: &mut TxContext,
): EnrollmentRegistry {
    EnrollmentRegistry { id: object::new(ctx), season_id, max_ranked_seats, created_count: 0 }
}

public(package) fun share_registry(registry: EnrollmentRegistry) {
    transfer::share_object(registry);
}

public(package) fun new_verified_soul_binding(
    interface_version: u64,
    soulidity_package_id: ID,
    soul_state_id: ID,
    soul_id: ID,
    current_owner: address,
    ownership_epoch: u64,
    listed: bool,
    projection_commitment: vector<u8>,
): VerifiedSoulBinding {
    VerifiedSoulBinding {
        interface_version,
        soulidity_package_id,
        soul_state_id,
        soul_id,
        current_owner,
        ownership_epoch,
        listed,
        projection_commitment,
    }
}

/// Stable core enrollment. Concrete Soul/SoulState types are deliberately not
/// imported here; only the adapter may construct `VerifiedSoulBinding`.
public(package) fun enroll_verified(
    manifest: &SeasonManifest,
    registry: &mut EnrollmentRegistry,
    binding: VerifiedSoulBinding,
    now_ms: u64,
    ctx: &mut TxContext,
): (SeasonSeat, CommanderProjection, CivilizationState, ScoreCard) {
    assert_registry(manifest, registry);
    assert!(now_ms < season::enrollment_close_at_ms(manifest), EEnrollmentClosed);
    assert!(registry.created_count < registry.max_ranked_seats, ESeasonFull);
    assert!(registry.max_ranked_seats == season::max_ranked_seats(manifest), ESeasonMismatch);

    let VerifiedSoulBinding {
        interface_version,
        soulidity_package_id,
        soul_state_id,
        soul_id,
        current_owner,
        ownership_epoch,
        listed,
        projection_commitment,
    } = binding;
    assert!(interface_version == ADAPTER_INTERFACE_VERSION, EInvalidSoulBinding);
    assert!(current_owner != @0x0, EInvalidSoulBinding);
    assert!(soul_id != @0x0.to_id() && soul_state_id != @0x0.to_id(), EInvalidSoulBinding);
    assert!(projection_commitment.length() == 32, EInvalidSoulBinding);
    assert!(ctx.sender() == current_owner, ENotSoulOwner);
    assert!(!listed, ESoulListed);

    let season_id = season::season_id(manifest);
    let controller = ctx.sender();
    let controller_key = ControllerSeatKey {
        encoding_version: ADAPTER_INTERFACE_VERSION,
        season_id,
        league: season::league(manifest),
        controller,
    };
    let soul_key = SoulSeasonKey {
        encoding_version: ADAPTER_INTERFACE_VERSION,
        season_id,
        soul_id,
    };
    assert!(!derived_object::exists(&registry.id, controller_key), EControllerAlreadyEnrolled);
    assert!(!derived_object::exists(&registry.id, soul_key), ESoulAlreadyEnrolled);

    // All abort-prone policy validation precedes the atomic claims/mutations.
    let seat_uid = derived_object::claim(&mut registry.id, controller_key);
    let soul_slot_uid = derived_object::claim(&mut registry.id, soul_key);
    object::delete(soul_slot_uid);
    let seat_id = seat_uid.to_inner();
    let projection_uid = object::new(ctx);
    let projection_id = projection_uid.to_inner();
    let civilization_uid = object::new(ctx);
    let civilization_id = civilization_uid.to_inner();
    let score_uid = object::new(ctx);
    let score_card_id = score_uid.to_inner();

    let seat = SeasonSeat {
        id: seat_uid,
        season_id,
        league: season::league(manifest),
        controller,
        soul_id,
        projection_id,
        civilization_id,
        score_card_id,
    };
    let projection = CommanderProjection {
        id: projection_uid,
        season_id,
        seat_id,
        soulidity_package_id,
        soul_state_id,
        soul_id,
        controller_at_enrollment: controller,
        ownership_epoch_at_enrollment: ownership_epoch,
        projection_commitment,
    };
    let civilization = CivilizationState {
        id: civilization_uid,
        season_id,
        seat_id,
        status: STATUS_AWAITING_HOME,
        controlled_planet_count: 0,
        initial_home_planet_id: option::none(),
        home_claim_consumed: false,
        activated_once: false,
    };
    let score = ScoreCard {
        id: score_uid,
        season_id,
        seat_id,
        score: 0,
        pending_scored_arrival_count: 0,
    };
    registry.created_count = registry.created_count + 1;
    event::emit(SeatEnrolled {
        season_id,
        seat_id,
        controller,
        soul_id,
        projection_id,
    });
    (seat, projection, civilization, score)
}

public(package) fun share_enrollment(
    seat: SeasonSeat,
    projection: CommanderProjection,
    civilization: CivilizationState,
    score: ScoreCard,
) {
    transfer::share_object(seat);
    transfer::share_object(projection);
    transfer::share_object(civilization);
    transfer::share_object(score);
}

public(package) fun assert_home_claim_objects(
    manifest: &SeasonManifest,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    score: &ScoreCard,
    sender: address,
) {
    let season_id = season::season_id(manifest);
    let seat_id = object::id(seat);
    assert!(seat.season_id == season_id, ESeatMismatch);
    assert!(civilization.season_id == season_id && score.season_id == season_id, ESeatMismatch);
    assert!(civilization.seat_id == seat_id && score.seat_id == seat_id, ESeatMismatch);
    assert!(object::id(civilization) == seat.civilization_id, ESeatMismatch);
    assert!(object::id(score) == seat.score_card_id, ESeatMismatch);
    assert!(seat.controller == sender, ENotSeatController);
    assert!(civilization.status == STATUS_AWAITING_HOME, EWrongLifecycle);
    assert!(!civilization.home_claim_consumed, EHomeAlreadyClaimed);
    assert!(civilization.initial_home_planet_id.is_none(), EHomeAlreadyClaimed);
    assert!(civilization.controlled_planet_count == 0, EWrongLifecycle);
}

public(package) fun activate_home(
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    planet_id: ID,
) {
    assert!(civilization.seat_id == object::id(seat), ESeatMismatch);
    assert!(civilization.status == STATUS_AWAITING_HOME, EWrongLifecycle);
    assert!(!civilization.home_claim_consumed, EHomeAlreadyClaimed);
    civilization.status = STATUS_ACTIVE;
    civilization.controlled_planet_count = 1;
    civilization.initial_home_planet_id = option::some(planet_id);
    civilization.home_claim_consumed = true;
    civilization.activated_once = true;
}

public(package) fun assert_can_settle(
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    home_window_resolution: u8,
) {
    assert!(civilization.seat_id == object::id(seat), ESeatMismatch);
    assert!(home_window_resolution != season::resolution_pending(), EHomeWindowResolutionPending);
    if (civilization.status == STATUS_AWAITING_HOME) {
        assert!(home_window_resolution == season::resolution_closed_available(), EHomeNotClaimed);
    };
}

fun assert_registry(manifest: &SeasonManifest, registry: &EnrollmentRegistry) {
    assert!(registry.season_id == season::season_id(manifest), ESeasonMismatch);
    assert!(object::id(registry) == season::enrollment_registry_id(manifest), ESeasonMismatch);
}

public fun derive_seat_address(
    manifest: &SeasonManifest,
    registry: &EnrollmentRegistry,
    controller: address,
): address {
    assert_registry(manifest, registry);
    derived_object::derive_address(
        object::id(registry),
        ControllerSeatKey {
            encoding_version: ADAPTER_INTERFACE_VERSION,
            season_id: season::season_id(manifest),
            league: season::league(manifest),
            controller,
        },
    )
}

public fun adapter_interface_version(): u64 { ADAPTER_INTERFACE_VERSION }
public fun created_count(self: &EnrollmentRegistry): u64 { self.created_count }
public fun seat_controller(self: &SeasonSeat): address { self.controller }
public fun seat_soul_id(self: &SeasonSeat): ID { self.soul_id }
public fun seat_id(self: &SeasonSeat): ID { object::id(self) }
public fun projection_epoch(self: &CommanderProjection): u64 { self.ownership_epoch_at_enrollment }
public fun projection_soul_id(self: &CommanderProjection): ID { self.soul_id }
public fun civilization_status(self: &CivilizationState): u8 { self.status }
public fun civilization_planet_count(self: &CivilizationState): u64 { self.controlled_planet_count }
public fun civilization_home_id(self: &CivilizationState): &Option<ID> { &self.initial_home_planet_id }
public fun status_awaiting_home(): u8 { STATUS_AWAITING_HOME }
public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_eliminated(): u8 { STATUS_ELIMINATED }
public fun status_settled(): u8 { STATUS_SETTLED }
public fun status_cancelled(): u8 { STATUS_CANCELLED }

#[test_only]
public fun new_registry_for_testing(
    season_id: ID,
    max_ranked_seats: u64,
    ctx: &mut TxContext,
): EnrollmentRegistry {
    new_registry(season_id, max_ranked_seats, ctx)
}

#[test_only]
public fun destroy_registry_for_testing(registry: EnrollmentRegistry) {
    let EnrollmentRegistry { id, season_id: _, max_ranked_seats: _, created_count: _ } = registry;
    // Derived-object claim markers are dynamic fields. Deleting the parent in a
    // unit test is sufficient for VM cleanup after all derived objects are gone.
    object::delete(id);
}

#[test_only]
public fun destroy_enrollment_for_testing(
    seat: SeasonSeat,
    projection: CommanderProjection,
    civilization: CivilizationState,
    score: ScoreCard,
) {
    let SeasonSeat { id, season_id: _, league: _, controller: _, soul_id: _, projection_id: _, civilization_id: _, score_card_id: _ } = seat;
    object::delete(id);
    let CommanderProjection { id, season_id: _, seat_id: _, soulidity_package_id: _, soul_state_id: _, soul_id: _, controller_at_enrollment: _, ownership_epoch_at_enrollment: _, projection_commitment: _ } = projection;
    object::delete(id);
    let CivilizationState { id, season_id: _, seat_id: _, status: _, controlled_planet_count: _, initial_home_planet_id: _, home_claim_consumed: _, activated_once: _ } = civilization;
    object::delete(id);
    let ScoreCard { id, season_id: _, seat_id: _, score: _, pending_scored_arrival_count: _ } = score;
    object::delete(id);
}
