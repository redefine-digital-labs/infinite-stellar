#[test_only]
module infinite_stellar::voyage_tests;

use infinite_stellar::artifact;
use infinite_stellar::capture;
use infinite_stellar::identity::{Self as identity, CivilizationState, CommanderProjection, EnrollmentRegistry, ScoreCard, SeasonSeat};
use infinite_stellar::planet::{Self as planet, Planet, PlanetRegistry};
use infinite_stellar::round5_rules as rules;
use infinite_stellar::reveal;
use infinite_stellar::season::{Self as season, SeasonAdminCap, SeasonManifest, SeasonRuntime};
use infinite_stellar::soul_adapter;
use infinite_stellar::voyage;

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
    ctx: &mut TxContext,
): (SeasonManifest, SeasonRuntime, EnrollmentRegistry, PlanetRegistry, SeasonAdminCap) {
    let (mut manifest, mut runtime, admin_cap) = season::new_season_for_testing(
        0,
        100,
        200,
        210,
        1000000000,
        2000000000,
        50,
        300,
        100,
        4,
        ctx,
    );
    let season_id = season::season_id(&manifest);
    let enrollment_registry = identity::new_registry_for_testing(season_id, 4, ctx);
    let planet_registry = planet::new_registry_for_testing(season_id, ctx);
    season::bind_registries(
        &mut manifest,
        object::id(&enrollment_registry),
        object::id(&planet_registry),
    );
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(4), 200);
    (manifest, runtime, enrollment_registry, planet_registry, admin_cap)
}

fun enroll_and_claim(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    enrollment_registry: &mut EnrollmentRegistry,
    planet_registry: &mut PlanetRegistry,
    state_id: ID,
    soul_id: ID,
    owner: address,
    commitment_byte: u8,
    ctx: &mut TxContext,
): (SeasonSeat, CommanderProjection, CivilizationState, ScoreCard, Planet) {
    let (seat, projection, mut civilization, score) =
        soul_adapter::enroll_fixture_for_testing(
            manifest,
            enrollment_registry,
            PACKAGE_ID.to_id(),
            state_id,
            soul_id,
            owner,
            1,
            false,
            bytes32(9),
            50,
            ctx,
        );
    let home = planet::claim_home_fixture_for_testing(
        manifest,
        runtime,
        planet_registry,
        &seat,
        &mut civilization,
        &score,
        bytes32(commitment_byte),
        bytes32(commitment_byte + 10),
        250,
        owner,
    );
    (seat, projection, civilization, score, home)
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

fun destroy_player(
    seat: SeasonSeat,
    projection: CommanderProjection,
    civilization: CivilizationState,
    score: ScoreCard,
) {
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score)
}

#[test]
fun two_controllers_rehearse_independent_routes_in_one_shared_season() {
    let mut alice_ctx = new_ctx(ALICE, 90);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut alice_ctx);
    let (alice_seat, alice_projection, mut alice_civilization, alice_score, mut alice_home) =
        enroll_and_claim(
            &manifest,
            &runtime,
            &mut enrollment_registry,
            &mut planet_registry,
            STATE_A.to_id(),
            SOUL_A.to_id(),
            ALICE,
            1,
            &mut alice_ctx,
        );

    let mut bob_ctx = new_ctx(BOB, 91);
    let (bob_seat, bob_projection, mut bob_civilization, bob_score, mut bob_home) =
        enroll_and_claim(
            &manifest,
            &runtime,
            &mut enrollment_registry,
            &mut planet_registry,
            STATE_B.to_id(),
            SOUL_B.to_id(),
            BOB,
            2,
            &mut bob_ctx,
        );

    assert!(identity::seat_controller(&alice_seat) == ALICE);
    assert!(identity::seat_controller(&bob_seat) == BOB);
    assert!(identity::seat_id(&alice_seat) != identity::seat_id(&bob_seat));
    assert!(identity::created_count(&enrollment_registry) == 2);

    let mut alice_target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut alice_ctx,
    );
    let mut bob_target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut bob_ctx,
    );

    let alice_voyage = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &alice_seat,
        &mut alice_civilization,
        &mut alice_home,
        &mut alice_target,
        1,
        40000,
        0,
        bytes32(30),
        1000,
        ALICE,
        &mut alice_ctx,
    );
    let bob_voyage = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &bob_seat,
        &mut bob_civilization,
        &mut bob_home,
        &mut bob_target,
        1,
        40000,
        0,
        bytes32(31),
        1000,
        BOB,
        &mut bob_ctx,
    );

    assert!(identity::civilization_pending_voyage_count(&alice_civilization) == 1);
    assert!(identity::civilization_pending_voyage_count(&bob_civilization) == 1);
    assert!(planet::pending_voyage_count(&alice_target) == 1);
    assert!(planet::pending_voyage_count(&bob_target) == 1);

    voyage::settle_neutral_or_friendly(
        alice_voyage,
        &mut alice_target,
        &alice_seat,
        &mut alice_civilization,
        2000,
    );
    voyage::settle_neutral_or_friendly(
        bob_voyage,
        &mut bob_target,
        &bob_seat,
        &mut bob_civilization,
        2000,
    );

    assert!(planet::owner_seat_id(&alice_target) == identity::seat_id(&alice_seat));
    assert!(planet::owner_seat_id(&bob_target) == identity::seat_id(&bob_seat));
    assert!(identity::civilization_planet_count(&alice_civilization) == 2);
    assert!(identity::civilization_planet_count(&bob_civilization) == 2);
    assert!(identity::civilization_pending_voyage_count(&alice_civilization) == 0);
    assert!(identity::civilization_pending_voyage_count(&bob_civilization) == 0);

    planet::destroy_planet_for_testing(alice_home);
    planet::destroy_planet_for_testing(bob_home);
    planet::destroy_planet_for_testing(alice_target);
    planet::destroy_planet_for_testing(bob_target);
    destroy_player(alice_seat, alice_projection, alice_civilization, alice_score);
    destroy_player(bob_seat, bob_projection, bob_civilization, bob_score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun neutral_conquest_is_a_one_shot_voyage_and_updates_exact_count() {
    let mut ctx = new_ctx(ALICE, 100);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, mut home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let source_before = planet::energy(&home);
    let queued = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut target,
        1,
        40000,
        0,
        bytes32(20),
        1000,
        ALICE,
        &mut ctx,
    );
    let expected_arrival_energy = voyage::energy_arriving(&queued);
    assert!(planet::energy(&home) < source_before);
    assert!(planet::pending_voyage_count(&target) == 1);
    assert!(identity::civilization_space_junk(&civilization) == 20);
    assert!(planet::space_junk(&target) == 0);
    assert!(voyage::arrival_at_seconds(&queued) == 2);
    voyage::settle_neutral_or_friendly(
        queued,
        &mut target,
        &seat,
        &mut civilization,
        2000,
    );
    assert!(planet::owner_seat_id(&target) == identity::seat_id(&seat));
    assert!(planet::energy(&target) == expected_arrival_energy);
    assert!(planet::pending_voyage_count(&target) == 0);
    assert!(identity::civilization_planet_count(&civilization) == 2);

    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun abandonment_sends_everything_resets_pirates_and_orders_junk_transfer() {
    let mut ctx = new_ctx(ALICE, 111);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut source = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        1,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    planet::set_owner_energy_and_silver_for_testing(
        &mut source,
        identity::seat_id(&seat),
        400000,
        100000,
    );
    identity::increment_controlled_planets(&seat, &mut civilization);
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let queued = voyage::dispatch_abandon_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut source,
        &mut target,
        1,
        bytes32(52),
        1000,
        ALICE,
        &mut ctx,
    );
    assert!(voyage::is_abandon_voyage(&queued));
    assert!(planet::is_neutral(&source));
    assert!(planet::energy(&source) == planet::default_energy(&source) * 2);
    assert!(planet::silver(&source) == 0);
    assert!(planet::space_junk(&source) == planet::default_space_junk(&source));
    assert!(voyage::silver_moved(&queued) == 100000);
    assert!(identity::civilization_planet_count(&civilization) == 1);
    // Source junk is returned first (flooring zero), then target junk is taken.
    assert!(identity::civilization_space_junk(&civilization) == 20);
    assert!(planet::space_junk(&target) == 0);
    voyage::settle_neutral_or_friendly(
        queued,
        &mut target,
        &seat,
        &mut civilization,
        2000,
    );
    assert!(identity::civilization_planet_count(&civilization) == 2);

    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(source);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun controlled_regular_planet_upgrade_spends_silver_and_mutates_exact_branch() {
    let mut ctx = new_ctx(ALICE, 106);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, civilization, score, home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut upgrade_target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        1,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    planet::set_owner_and_silver_for_testing(
        &mut upgrade_target,
        identity::seat_id(&seat),
        100000,
    );
    let old_capacity = planet::energy_capacity(&upgrade_target);
    let old_range = planet::range(&upgrade_target);
    planet::upgrade_at(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut upgrade_target,
        rules::branch_range(),
        1000,
        ALICE,
    );
    assert!(planet::silver(&upgrade_target) == 80000);
    assert!(planet::energy_capacity(&upgrade_target) == old_capacity * 120 / 100);
    assert!(planet::range(&upgrade_target) == old_range * 125 / 100);
    assert!(planet::upgrade_range(&upgrade_target) == 1);
    assert!(planet::upgrade_defense(&upgrade_target) == 0);
    assert!(planet::upgrade_speed(&upgrade_target) == 0);

    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(upgrade_target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun spacetime_rip_extraction_uses_reference_integer_score_precision() {
    let mut ctx = new_ctx(ALICE, 109);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, civilization, mut score, home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut spacetime_rip = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        2,
        rules::planet_spacetime_rip(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    planet::set_owner_and_silver_for_testing(
        &mut spacetime_rip,
        identity::seat_id(&seat),
        200000,
    );
    planet::withdraw_silver_at(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut score,
        &mut spacetime_rip,
        100000,
        1000,
        ALICE,
    );
    assert!(planet::silver(&spacetime_rip) == 100000);
    assert!(identity::score(&score) == 10);

    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(spacetime_rip);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun reveal_and_capture_use_typed_fail_closed_adapters_and_reference_score() {
    let mut ctx = new_ctx(ALICE, 110);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, mut score, home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        2,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    planet::set_owner_and_silver_for_testing(
        &mut target,
        identity::seat_id(&seat),
        0,
    );
    reveal::reveal_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut target,
        bytes32(123),
        bytes32(124),
        bytes32(50),
        1000,
        ALICE,
    );
    assert!(planet::is_revealed(&target));
    let epoch = capture::new_epoch_for_testing(&manifest, 1, 100, bytes32(51), &mut ctx);
    capture::invade_fixture_for_testing(
        &manifest,
        &runtime,
        &epoch,
        &seat,
        &civilization,
        &mut target,
        110,
        1000,
        ALICE,
    );
    capture::capture_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut score,
        &mut target,
        2158,
        2000,
        ALICE,
    );
    assert!(planet::is_captured(&target));
    assert!(identity::score(&score) == 250000);
    assert!(!capture::production_capture_adapter_ready());
    assert!(!reveal::production_reveal_verifier_ready());

    capture::destroy_epoch_for_testing(epoch);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun mothership_moves_at_zero_energy_and_applies_host_growth_without_conquest() {
    let mut ctx = new_ctx(ALICE, 107);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, mut home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        1,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let base_growth = planet::energy_growth(&target);
    let mut mothership = artifact::new_ship_for_testing(
        season::season_id(&manifest),
        artifact::type_ship_mothership(),
        ALICE,
        &mut home,
        &mut ctx,
    );
    let queued = voyage::dispatch_ship_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut target,
        &mut mothership,
        1,
        bytes32(30),
        1000,
        ALICE,
        &mut ctx,
    );
    assert!(voyage::is_ship_voyage(&queued));
    assert!(planet::artifact_count(&home) == 0);
    voyage::settle_ship(
        queued,
        &mut target,
        &mut mothership,
        &seat,
        &mut civilization,
        2000,
    );
    assert!(planet::is_neutral(&target));
    assert!(planet::artifact_count(&target) == 1);
    assert!(planet::energy_growth(&target) == base_growth * 2);
    assert!(artifact::location_id(&mothership) == object::id(&target));

    artifact::destroy_for_testing(mothership);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun crescent_converts_an_unowned_level_one_planet_once() {
    let mut ctx = new_ctx(ALICE, 108);
    let (manifest, runtime, enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        1,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let mut crescent = artifact::new_ship_for_testing(
        season::season_id(&manifest),
        artifact::type_ship_crescent(),
        ALICE,
        &mut target,
        &mut ctx,
    );
    artifact::activate_crescent_at_for_testing(
        &manifest,
        &runtime,
        &mut target,
        &mut crescent,
        1000,
    );
    assert!(planet::planet_type(&target) == rules::planet_silver_mine());
    assert!(planet::silver(&target) == 1);
    assert!(planet::silver_growth(&target) == 56);
    assert!(artifact::activations(&crescent) == 1);

    artifact::destroy_for_testing(crescent);
    planet::destroy_planet_for_testing(target);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun gear_prospect_entropy_find_and_artifact_activation_are_one_shot() {
    let mut ctx = new_ctx(ALICE, 112);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, civilization, mut score, home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut ruins = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        2,
        rules::planet_ruins(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    planet::set_owner_and_silver_for_testing(&mut ruins, identity::seat_id(&seat), 0);
    let gear = artifact::new_ship_for_testing(
        season::season_id(&manifest),
        artifact::type_ship_gear(),
        ALICE,
        &mut ruins,
        &mut ctx,
    );
    let checkpoint = artifact::new_verified_artifact_checkpoint(
        1,
        season::season_id(&manifest),
        100,
        bytes32(53),
    );
    artifact::prospect_verified(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut ruins,
        &gear,
        checkpoint,
        1000,
        ALICE,
    );
    assert!(*planet::prospected_checkpoint(&ruins).borrow() == 100);
    let entropy = artifact::new_verified_artifact_entropy(
        1,
        season::season_id(&manifest),
        object::id(&ruins),
        100,
        101,
        1,
        10,
        100,
        bytes32(54),
    );
    let mut found = artifact::find_verified(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut score,
        &mut ruins,
        &gear,
        entropy,
        2000,
        ALICE,
        &mut ctx,
    );
    assert!(artifact::artifact_type(&found) == artifact::type_monolith());
    assert!(artifact::rarity(&found) == 2);
    assert!(planet::artifact_found(&ruins));
    assert!(identity::score(&score) == 200000);
    let base_capacity = planet::energy_capacity(&ruins);
    artifact::activate_at_for_testing(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut ruins,
        &mut found,
        3000,
        ALICE,
    );
    assert!(artifact::is_active(&found));
    assert!(planet::energy_capacity(&ruins) == base_capacity * 110 / 100);
    artifact::deactivate_at_for_testing(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut ruins,
        &mut found,
        4000,
        ALICE,
    );
    assert!(!artifact::is_active(&found));
    assert!(planet::energy_capacity(&ruins) == base_capacity);
    assert!(!artifact::production_artifact_adapter_ready());

    artifact::destroy_for_testing(gear);
    artifact::destroy_for_testing(found);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(ruins);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun inactive_artifact_can_travel_with_a_fleet_and_arrive_once() {
    let mut ctx = new_ctx(ALICE, 113);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, mut home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let mut pyramid = artifact::new_artifact_for_testing(
        season::season_id(&manifest),
        artifact::type_pyramid(),
        1,
        1,
        &mut home,
        &mut ctx,
    );
    let queued = voyage::dispatch_artifact_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut target,
        &mut pyramid,
        1,
        40000,
        0,
        bytes32(55),
        1000,
        ALICE,
        &mut ctx,
    );
    assert!(planet::artifact_count(&home) == 0);
    voyage::settle_neutral_or_friendly_with_artifact(
        queued,
        &mut target,
        &mut pyramid,
        &seat,
        &mut civilization,
        2000,
    );
    assert!(planet::artifact_count(&target) == 1);
    assert!(artifact::location_id(&pyramid) == object::id(&target));

    artifact::destroy_for_testing(pyramid);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun wormhole_and_photoid_routes_preserve_exact_round5_integer_order() {
    let mut ctx = new_ctx(ALICE, 114);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, mut home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut endpoint = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    planet::set_owner_and_silver_for_testing(&mut endpoint, identity::seat_id(&seat), 0);
    let mut wormhole = artifact::new_artifact_for_testing(
        season::season_id(&manifest),
        artifact::type_wormhole(),
        1,
        1,
        &mut home,
        &mut ctx,
    );
    artifact::activate_wormhole_at_for_testing(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut home,
        &mut endpoint,
        &mut wormhole,
        20000000,
        ALICE,
    );
    // A Wormhole remains active if its endpoint is later lost. The original
    // Round-5 arrival then transfers no hostile energy and cannot conquer.
    planet::set_owner_and_silver_for_testing(&mut endpoint, @0x0.to_id(), 0);
    let wormhole_voyage = voyage::dispatch_wormhole_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut endpoint,
        &wormhole,
        100,
        50000,
        bytes32(56),
        20000000,
        ALICE,
        &mut ctx,
    );
    assert!(voyage::route_kind(&wormhole_voyage) == 3);
    assert!(voyage::arrival_at_seconds(&wormhole_voyage) == 20066);
    voyage::settle_neutral_or_friendly(
        wormhole_voyage,
        &mut endpoint,
        &seat,
        &mut civilization,
        20066000,
    );
    assert!(planet::is_neutral(&endpoint));
    assert!(planet::energy(&endpoint) == 0);

    let mut photoid = artifact::new_artifact_for_testing(
        season::season_id(&manifest),
        artifact::type_photoid_cannon(),
        1,
        1,
        &mut home,
        &mut ctx,
    );
    artifact::deactivate_at_for_testing(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut home,
        &mut wormhole,
        21000000,
        ALICE,
    );
    artifact::activate_at_for_testing(
        &manifest,
        &runtime,
        &seat,
        &civilization,
        &mut home,
        &mut photoid,
        90000000,
        ALICE,
    );
    assert!(planet::defense(&home) == 200);
    let mut photoid_target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let photoid_voyage = voyage::dispatch_photoid_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut photoid_target,
        &mut photoid,
        100,
        30000,
        bytes32(57),
        100800000,
        ALICE,
        &mut ctx,
    );
    assert!(voyage::route_kind(&photoid_voyage) == 2);
    assert!(voyage::arrival_at_seconds(&photoid_voyage) == 100826);
    assert!(artifact::is_burned(&photoid));
    assert!(planet::defense(&home) == 400);

    voyage::destroy_for_testing(photoid_voyage);
    artifact::destroy_for_testing(wormhole);
    artifact::destroy_for_testing(photoid);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(endpoint);
    planet::destroy_planet_for_testing(photoid_target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun last_light_freezes_score_only_after_all_player_voyages_settle() {
    let mut ctx = new_ctx(ALICE, 115);
    let (manifest, mut runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    assert!(identity::civilization_pending_voyage_count(&civilization) == 0);
    season::tick_home_availability_at_for_testing(&manifest, &mut runtime, 350);
    season::tick_home_availability_at_for_testing(&manifest, &mut runtime, 450);
    season::tick_home_availability_at_for_testing(&manifest, &mut runtime, 550);
    season::resolve_home_window_at_for_testing(&manifest, &mut runtime, 1000000000);
    season::begin_settlement_at_for_testing(&manifest, &mut runtime, 2000000000);
    identity::settle_score_at_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &score,
        2000000000,
        ALICE,
        &mut ctx,
    );
    assert!(identity::civilization_status(&civilization) == identity::status_settled());

    planet::destroy_planet_for_testing(home);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun hostile_conquest_updates_attacker_and_defender_atomically() {
    let mut ctx = new_ctx(ALICE, 101);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (alice_seat, alice_projection, mut alice_civilization, alice_score, mut alice_home) =
        enroll_and_claim(
            &manifest,
            &runtime,
            &mut enrollment_registry,
            &mut planet_registry,
            STATE_A.to_id(),
            SOUL_A.to_id(),
            ALICE,
            1,
            &mut ctx,
        );
    let mut bob_ctx = new_ctx(BOB, 102);
    let (bob_seat, bob_projection, mut bob_civilization, bob_score, mut bob_home) =
        enroll_and_claim(
            &manifest,
            &runtime,
            &mut enrollment_registry,
            &mut planet_registry,
            STATE_B.to_id(),
            SOUL_B.to_id(),
            BOB,
            2,
            &mut bob_ctx,
        );
    let mut drain_target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut bob_ctx,
    );
    let bob_drain = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &bob_seat,
        &mut bob_civilization,
        &mut bob_home,
        &mut drain_target,
        1,
        49000,
        0,
        bytes32(21),
        1000,
        BOB,
        &mut bob_ctx,
    );
    let attack = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &alice_seat,
        &mut alice_civilization,
        &mut alice_home,
        &mut bob_home,
        1,
        49000,
        0,
        bytes32(22),
        1000,
        ALICE,
        &mut ctx,
    );
    voyage::settle_hostile(
        attack,
        &mut bob_home,
        &alice_seat,
        &mut alice_civilization,
        &bob_seat,
        &mut bob_civilization,
        2000,
    );
    assert!(planet::owner_seat_id(&bob_home) == identity::seat_id(&alice_seat));
    assert!(identity::civilization_planet_count(&alice_civilization) == 2);
    assert!(identity::civilization_planet_count(&bob_civilization) == 0);

    voyage::destroy_for_testing(bob_drain);
    planet::destroy_planet_for_testing(alice_home);
    planet::destroy_planet_for_testing(bob_home);
    planet::destroy_planet_for_testing(drain_target);
    destroy_player(alice_seat, alice_projection, alice_civilization, alice_score);
    destroy_player(bob_seat, bob_projection, bob_civilization, bob_score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test]
fun production_verifier_remains_fail_closed() {
    assert!(!voyage::production_move_verifier_ready());
    assert!(voyage::required_proof_interface_version() == 1);
}

#[test, expected_failure(abort_code = 6, location = infinite_stellar::voyage)]
fun an_arrival_cannot_settle_early() {
    let mut ctx = new_ctx(ALICE, 103);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, mut home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let queued = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut target,
        1,
        40000,
        0,
        bytes32(20),
        1000,
        ALICE,
        &mut ctx,
    );
    voyage::settle_neutral_or_friendly(
        queued,
        &mut target,
        &seat,
        &mut civilization,
        1000,
    );
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 9, location = infinite_stellar::planet)]
fun pending_arrivals_must_settle_by_time_then_insertion_order() {
    let mut ctx = new_ctx(ALICE, 104);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, mut home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let later = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut target,
        2,
        7000,
        0,
        bytes32(20),
        1000,
        ALICE,
        &mut ctx,
    );
    let earlier = voyage::dispatch_fixture_for_testing(
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut target,
        1,
        7000,
        0,
        bytes32(21),
        1000,
        ALICE,
        &mut ctx,
    );
    voyage::destroy_for_testing(earlier);
    voyage::settle_neutral_or_friendly(
        later,
        &mut target,
        &seat,
        &mut civilization,
        3000,
    );
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}

#[test, expected_failure(abort_code = 8, location = infinite_stellar::planet)]
fun seventh_outsider_arrival_is_rejected_in_aggregate() {
    let mut ctx = new_ctx(ALICE, 105);
    let (manifest, runtime, mut enrollment_registry, mut planet_registry, admin_cap) =
        new_world(&mut ctx);
    let (seat, projection, mut civilization, score, mut home) = enroll_and_claim(
        &manifest,
        &runtime,
        &mut enrollment_registry,
        &mut planet_registry,
        STATE_A.to_id(),
        SOUL_A.to_id(),
        ALICE,
        1,
        &mut ctx,
    );
    let mut target = planet::new_neutral_fixture_for_testing(
        season::season_id(&manifest),
        0,
        rules::planet_regular(),
        rules::space_nebula(),
        1,
        &mut ctx,
    );
    let mut index = 0u8;
    while (index < 7) {
        let queued = voyage::dispatch_fixture_for_testing(
            &manifest,
            &runtime,
            &seat,
            &mut civilization,
            &mut home,
            &mut target,
            1,
            6000,
            0,
            bytes32(20 + index),
            1000,
            ALICE,
            &mut ctx,
        );
        voyage::destroy_for_testing(queued);
        index = index + 1;
    };
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    destroy_player(seat, projection, civilization, score);
    destroy_world(manifest, runtime, enrollment_registry, planet_registry, admin_cap);
}
