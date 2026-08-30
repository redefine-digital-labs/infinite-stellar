#[test_only]
module infinite_stellar::protocol_tests;

use infinite_stellar::identity::{Self as identity, CivilizationState, CommanderProjection, EnrollmentRegistry, ScoreCard, SeasonSeat};
use infinite_stellar::planet::{Self as planet, Planet, PlanetRegistry};
use infinite_stellar::season::{Self as season, SeasonAdminCap, SeasonManifest, SeasonRuntime};
use infinite_stellar::soul_adapter;

const ALICE: address = @0xa11ce;
const BOB: address = @0xb0b;
const PACKAGE_ID: address = @0x51d;
const STATE_A: address = @0x1001;
const STATE_B: address = @0x1002;
const SOUL_A: address = @0x2001;
const SOUL_B: address = @0x2002;

fun bytes32(value: u8): vector<u8> {
    let mut bytes = vector[];
    32u64.do!(|_| bytes.push_back(value));
    bytes
}

fun new_ctx(sender: address, hint: u64): TxContext {
    tx_context::new_from_hint(sender, hint, 0, 0, 0)
}

fun new_world(
    max_ranked_seats: u64,
    ctx: &mut TxContext,
): (SeasonManifest, SeasonRuntime, EnrollmentRegistry, PlanetRegistry, SeasonAdminCap) {
    let (mut manifest, runtime, admin_cap) = season::new_season_for_testing(
        0,
        100,
        200,
        210,
        1000,
        1100,
        50,
        300,
        100,
        max_ranked_seats,
        ctx,
    );
    let season_id = season::season_id(&manifest);
    let enrollment_registry = identity::new_registry_for_testing(
        season_id,
        max_ranked_seats,
        ctx,
    );
    let planet_registry = planet::new_registry_for_testing(season_id, ctx);
    season::bind_registries(
        &mut manifest,
        object::id(&enrollment_registry),
        object::id(&planet_registry),
    );
    (manifest, runtime, enrollment_registry, planet_registry, admin_cap)
}

fun enroll(
    manifest: &SeasonManifest,
    registry: &mut EnrollmentRegistry,
    state_id: ID,
    soul_id: ID,
    owner: address,
    epoch: u64,
    ctx: &mut TxContext,
): (SeasonSeat, CommanderProjection, CivilizationState, ScoreCard) {
    soul_adapter::enroll_fixture_for_testing(
        manifest,
        registry,
        PACKAGE_ID.to_id(),
        state_id,
        soul_id,
        owner,
        epoch,
        false,
        bytes32(9),
        50,
        ctx,
    )
}

fun destroy_world(
    manifest: SeasonManifest,
    runtime: SeasonRuntime,
    enrollment_registry: EnrollmentRegistry,
    planet_registry: PlanetRegistry,
    admin_cap: SeasonAdminCap,
) {
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
}

fun destroy_enrollment(
    seat: SeasonSeat,
    projection: CommanderProjection,
    civilization: CivilizationState,
    score: ScoreCard,
) {
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score)
}

#[test]
fun deterministic_enrollment_creates_one_awaiting_home_seat() {
    let mut ctx = new_ctx(ALICE, 1);
    let (manifest, runtime, mut enrollment_registry, planet_registry, admin_cap) =
        new_world(2, &mut ctx);
    let expected = identity::derive_seat_address(&manifest, &enrollment_registry, ALICE);
    let (seat, projection, civilization, score) = enroll(
        &manifest,
        &mut enrollment_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        7,
        &mut ctx,
    );
    assert!(identity::seat_id(&seat).to_address() == expected);
    assert!(identity::seat_controller(&seat) == ALICE);
    assert!(identity::seat_soul_id(&seat) == SOUL_A.to_id());
    assert!(identity::projection_epoch(&projection) == 7);
    assert!(identity::civilization_status(&civilization) == identity::status_awaiting_home());
    assert!(identity::civilization_planet_count(&civilization) == 0);
    assert!(identity::created_count(&enrollment_registry) == 1);
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun production_soul_adapter_is_fail_closed() {
    assert!(!soul_adapter::production_adapter_ready());
    assert!(soul_adapter::required_interface_version() == 1);
}

#[test, expected_failure(abort_code = 0, location = infinite_stellar::season)]
fun manifest_rejects_window_shortened_by_observation_delay() {
    let mut ctx = new_ctx(ALICE, 24);
    let (manifest, runtime, admin_cap) = season::new_season_for_testing(
        0,
        100,
        200,
        210,
        520,
        600,
        50,
        300,
        100,
        1,
        &mut ctx,
    );
    season::destroy_for_testing(manifest, runtime, admin_cap);
}

#[test, expected_failure(abort_code = 3, location = infinite_stellar::identity)]
fun duplicate_controller_is_rejected() {
    let mut ctx = new_ctx(ALICE, 2);
    let (manifest, runtime, mut enrollment_registry, planet_registry, admin_cap) =
        new_world(2, &mut ctx);
    let (seat_a, projection_a, civilization_a, score_a) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut ctx);
    let (seat_b, projection_b, civilization_b, score_b) = enroll(&manifest, &mut enrollment_registry, STATE_B.to_id(), SOUL_B.to_id(), ALICE, 1, &mut ctx);
    destroy_enrollment(seat_a, projection_a, civilization_a, score_a);
    destroy_enrollment(seat_b, projection_b, civilization_b, score_b);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 4, location = infinite_stellar::identity)]
fun duplicate_soul_is_rejected_for_another_controller() {
    let mut alice_ctx = new_ctx(ALICE, 3);
    let (manifest, runtime, mut enrollment_registry, planet_registry, admin_cap) =
        new_world(2, &mut alice_ctx);
    let (seat_a, projection_a, civilization_a, score_a) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut alice_ctx);
    let mut bob_ctx = new_ctx(BOB, 4);
    let (seat_b, projection_b, civilization_b, score_b) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), BOB, 2, &mut bob_ctx);
    destroy_enrollment(seat_a, projection_a, civilization_a, score_a);
    destroy_enrollment(seat_b, projection_b, civilization_b, score_b);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 6, location = infinite_stellar::identity)]
fun spoofed_current_owner_is_rejected() {
    let mut ctx = new_ctx(BOB, 5);
    let (manifest, runtime, mut enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    let (seat, projection, civilization, score) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut ctx);
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 7, location = infinite_stellar::identity)]
fun listed_soul_is_rejected() {
    let mut ctx = new_ctx(ALICE, 6);
    let (manifest, runtime, mut enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    let (seat, projection, civilization, score) = soul_adapter::enroll_fixture_for_testing(
        &manifest,
        &mut enrollment_registry,
        PACKAGE_ID.to_id(),
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        true,
        bytes32(1),
        50,
        &mut ctx,
    );
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 5, location = infinite_stellar::identity)]
fun wrong_adapter_version_is_rejected() {
    let mut ctx = new_ctx(ALICE, 7);
    let (manifest, runtime, mut enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    let (seat, projection, civilization, score) = soul_adapter::enroll_fixture_with_interface_for_testing(
        &manifest,
        &mut enrollment_registry,
        99,
        PACKAGE_ID.to_id(),
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        false,
        bytes32(1),
        50,
        &mut ctx,
    );
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 2, location = infinite_stellar::identity)]
fun final_capacity_slot_is_atomic() {
    let mut alice_ctx = new_ctx(ALICE, 8);
    let (manifest, runtime, mut enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut alice_ctx);
    let (seat_a, projection_a, civilization_a, score_a) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut alice_ctx);
    let mut bob_ctx = new_ctx(BOB, 9);
    let (seat_b, projection_b, civilization_b, score_b) = enroll(&manifest, &mut enrollment_registry, STATE_B.to_id(), SOUL_B.to_id(), BOB, 1, &mut bob_ctx);
    destroy_enrollment(seat_a, projection_a, civilization_a, score_a);
    destroy_enrollment(seat_b, projection_b, civilization_b, score_b);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun opening_is_one_way_and_sets_observation_gate() {
    let mut ctx = new_ctx(ALICE, 10);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(8), 200);
    assert!(season::universe_opened(&runtime));
    assert!(*season::universe_seed(&runtime) == bytes32(8));
    assert!(season::home_claim_not_before_at_ms(&runtime) == 250);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 2, location = infinite_stellar::season)]
fun universe_cannot_open_twice() {
    let mut ctx = new_ctx(ALICE, 11);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(8), 200);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(9), 201);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun exact_gate_claim_activates_seat_without_live_soul_recheck() {
    let mut ctx = new_ctx(ALICE, 12);
    let (manifest, mut runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    let (seat, projection, mut civilization, score) = enroll(
        &manifest,
        &mut enrollment_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        7,
        &mut ctx,
    );
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(4), 200);
    let commitment = bytes32(3);
    let expected_planet = planet::derive_planet_address(&manifest, &planet_registry, commitment);
    // No Soul object/state/epoch is supplied here. A later transfer detaches
    // attribution but does not transfer or freeze this fixed-controller Seat.
    let home = planet::claim_home_fixture_for_testing(
        &manifest,
        &runtime,
        &mut planet_registry,
        &seat,
        &mut civilization,
        &score,
        commitment,
        bytes32(5),
        250,
        ALICE,
    );
    assert!(object::id(&home).to_address() == expected_planet);
    assert!(planet::owner_seat_id(&home) == identity::seat_id(&seat));
    assert!(identity::civilization_status(&civilization) == identity::status_active());
    assert!(identity::civilization_planet_count(&civilization) == 1);
    assert!(identity::projection_epoch(&projection) == 7);
    planet::destroy_planet_for_testing(home);
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 3, location = infinite_stellar::season)]
fun claim_before_observation_gate_is_rejected() {
    let mut ctx = new_ctx(ALICE, 13);
    let (manifest, mut runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    let (seat, projection, mut civilization, score) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(4), 200);
    let home = planet::claim_home_fixture_for_testing(&manifest, &runtime, &mut planet_registry, &seat, &mut civilization, &score, bytes32(3), bytes32(5), 249, ALICE);
    planet::destroy_planet_for_testing(home);
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 11, location = infinite_stellar::season)]
fun claim_at_exact_close_is_rejected() {
    let mut ctx = new_ctx(ALICE, 25);
    let (manifest, mut runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    let (seat, projection, mut civilization, score) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(4), 200);
    let home = planet::claim_home_fixture_for_testing(&manifest, &runtime, &mut planet_registry, &seat, &mut civilization, &score, bytes32(3), bytes32(5), 1000, ALICE);
    planet::destroy_planet_for_testing(home);
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 9, location = infinite_stellar::identity)]
fun soul_buyer_cannot_control_sellers_seat() {
    let mut alice_ctx = new_ctx(ALICE, 14);
    let (manifest, mut runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(1, &mut alice_ctx);
    let (seat, projection, mut civilization, score) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 7, &mut alice_ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(4), 200);
    let home = planet::claim_home_fixture_for_testing(&manifest, &runtime, &mut planet_registry, &seat, &mut civilization, &score, bytes32(3), bytes32(5), 250, BOB);
    planet::destroy_planet_for_testing(home);
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 2, location = infinite_stellar::planet)]
fun proof_intent_cannot_substitute_another_seat() {
    let mut ctx = new_ctx(ALICE, 15);
    let (manifest, mut runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    let (seat, projection, mut civilization, score) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(4), 200);
    let home = planet::claim_home_fixture_with_intent_for_testing(&manifest, &runtime, &mut planet_registry, &seat, &mut civilization, &score, season::season_id(&manifest), BOB.to_id(), bytes32(3), bytes32(5), 250, ALICE);
    planet::destroy_planet_for_testing(home);
    destroy_enrollment(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 3, location = infinite_stellar::planet)]
fun two_seats_cannot_claim_same_planet_commitment() {
    let mut alice_ctx = new_ctx(ALICE, 16);
    let (manifest, mut runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(2, &mut alice_ctx);
    let (seat_a, projection_a, mut civilization_a, score_a) = enroll(&manifest, &mut enrollment_registry, STATE_A.to_id(), SOUL_A.to_id(), ALICE, 1, &mut alice_ctx);
    let mut bob_ctx = new_ctx(BOB, 17);
    let (seat_b, projection_b, mut civilization_b, score_b) = enroll(&manifest, &mut enrollment_registry, STATE_B.to_id(), SOUL_B.to_id(), BOB, 1, &mut bob_ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(4), 200);
    let home_a = planet::claim_home_fixture_for_testing(&manifest, &runtime, &mut planet_registry, &seat_a, &mut civilization_a, &score_a, bytes32(3), bytes32(5), 250, ALICE);
    let home_b = planet::claim_home_fixture_for_testing(&manifest, &runtime, &mut planet_registry, &seat_b, &mut civilization_b, &score_b, bytes32(3), bytes32(6), 250, BOB);
    planet::destroy_planet_for_testing(home_a);
    planet::destroy_planet_for_testing(home_b);
    destroy_enrollment(seat_a, projection_a, civilization_a, score_a);
    destroy_enrollment(seat_b, projection_b, civilization_b, score_b);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun timely_ticks_reach_global_closed_available_resolution() {
    let mut ctx = new_ctx(ALICE, 18);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(1), 200);
    season::tick_home_availability_at_for_testing(&manifest, &mut runtime, 350);
    season::tick_home_availability_at_for_testing(&manifest, &mut runtime, 450);
    season::tick_home_availability_at_for_testing(&manifest, &mut runtime, 550);
    season::resolve_home_window_at_for_testing(&manifest, &mut runtime, 1000);
    assert!(season::accumulated_home_claimable_ms(&runtime) == 400);
    assert!(season::home_window_resolution(&runtime) == season::resolution_closed_available());
    assert!(!season::is_cancelled(&runtime));
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun long_unevidenced_gap_conservatively_cancels_globally() {
    let mut ctx = new_ctx(ALICE, 19);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(1), 200);
    season::resolve_home_window_at_for_testing(&manifest, &mut runtime, 1000);
    assert!(season::accumulated_home_claimable_ms(&runtime) == 100);
    assert!(season::home_window_resolution(&runtime) == season::resolution_cancelled_unavailable());
    assert!(season::is_cancelled(&runtime));
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun delayed_universe_opening_cannot_blame_waiting_players() {
    let mut ctx = new_ctx(ALICE, 26);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(1), 900);
    assert!(season::home_claim_not_before_at_ms(&runtime) == 950);
    season::resolve_home_window_at_for_testing(&manifest, &mut runtime, 1000);
    assert!(season::accumulated_home_claimable_ms(&runtime) == 50);
    assert!(season::home_window_resolution(&runtime) == season::resolution_cancelled_unavailable());
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun repeated_pause_never_credits_blocked_intervals() {
    let mut ctx = new_ctx(ALICE, 20);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(1), 200);
    season::pause_at_for_testing(&admin_cap, &manifest, &mut runtime, 300);
    season::resume_at_for_testing(&admin_cap, &manifest, &mut runtime, 600);
    season::pause_at_for_testing(&admin_cap, &manifest, &mut runtime, 650);
    season::resume_at_for_testing(&admin_cap, &manifest, &mut runtime, 800);
    season::resolve_home_window_at_for_testing(&manifest, &mut runtime, 1000);
    assert!(season::accumulated_home_claimable_ms(&runtime) == 200);
    assert!(season::home_window_resolution(&runtime) == season::resolution_cancelled_unavailable());
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 8, location = infinite_stellar::season)]
fun active_first_action_cannot_bypass_pending_close_resolution() {
    let mut ctx = new_ctx(ALICE, 21);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(1), 200);
    season::assert_action_allowed_at_for_testing(&manifest, &runtime, 1000);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 8, location = infinite_stellar::season)]
fun settlement_cannot_start_before_global_home_resolution() {
    let mut ctx = new_ctx(ALICE, 22);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(1), 200);
    season::begin_settlement_at_for_testing(&manifest, &mut runtime, 1100);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun cancelled_season_can_enter_refund_settlement_only_after_resolution() {
    let mut ctx = new_ctx(ALICE, 23);
    let (manifest, mut runtime, enrollment_registry, planet_registry, admin_cap) =
        new_world(1, &mut ctx);
    season::resolve_home_window_at_for_testing(&manifest, &mut runtime, 1000);
    season::begin_settlement_at_for_testing(&manifest, &mut runtime, 1100);
    assert!(season::home_window_resolution(&runtime) == season::resolution_cancelled_unavailable());
    assert!(season::settlement_started(&runtime));
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}
