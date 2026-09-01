#[test_only]
module infinite_stellar::proof_actions_tests;

use infinite_stellar::circuit_config::{Self as circuit_config, CircuitConfig};
use infinite_stellar::identity::{Self as identity, CivilizationState, CommanderProjection, EnrollmentRegistry, ScoreCard, SeasonSeat};
use infinite_stellar::planet::{Self as planet, PlanetRegistry};
use infinite_stellar::proof_actions;
use infinite_stellar::proof_intent;
use infinite_stellar::season::{Self as season, SeasonAdminCap, SeasonManifest, SeasonRuntime};
use infinite_stellar::soul_adapter;
use infinite_stellar::voyage;

const ALICE: address = @0xa11ce;
const BOB: address = @0xb0b;
const HOME_LOCATION_HASH: u256 = 441595625074136767652070888593187681073630156209416385716195429441716114;
const NATURAL_LOCATION_HASH: u256 = 1759259153186726942209343294499159540235552521067839175742163671329318918;
const DEADLINE_MS: u64 = 1800000000000;

fun bytes32(value: u8): vector<u8> {
    let mut bytes = vector[];
    32u64.do!(|_| bytes.push_back(value));
    bytes
}

fun claim_proof(): vector<u8> {
    x"146ab363ea28c2dc2f9c4a849402d565e579a0b9da2fc1e2494f82a57720f516958ce531c680f3521527530608e25de2edb1e752f721c53817a5c58992ee921cbfdcdb9434d4cbd08d99039397f03339b300e998369a9121c450a24d03070c06c877e7fc5d7969392207205e5b0845f717faa32ea833c5750d7c83a1c82ebe99"
}

fun move_proof(): vector<u8> {
    x"4373182eb3ff72b252c19a57ab06eda1adda39f781245f3419f94921225432aa796e7b052cb1e85b2e914cab02eed22dda4824b081257bd1733f70e12dda6704d5dff00ebdaf25389e780a3fcb5352877d0fc58e68a8aca483778db370c43fa5b3c881ed1114c6093c1d5a820ed1e921c57ac67b40222a4c20bd2dbf0b155eb0"
}

fun move_new_proof(): vector<u8> {
    x"f27763cde5c7e1f05783d3a134259aeb13f5e826d2a5e82a9b4e5b7e85c47d2a4db960fc51d3f5ba3bcf3bddb5f0d9abbe3f5a5be236376c5246404c169e3629e23fb8153a0d2ae4d4b9c5708591962beeb898d504a07504322189b5deb467a81586381a77777c63758c421741efdaa9017c6f5ed7888bb70d17681d8445ef96"
}

fun new_claim_config(ctx: &mut TxContext): CircuitConfig {
    circuit_config::new_development_for_testing(
        proof_intent::action_claim_home(),
        x"f3f249c1e7c73e5d84a61a12a47f2311983cc68dfed087dfc42faca3e82f6225",
        x"ddd02e740d00d5a0f9b9d6cbe6e60ff131a44c57bef08a26b5be90a72ee6c7b0",
        x"352a20091a6b3d04d856be53d60c8640e57bbf53708f86347e2e6aa0f952abd9",
        x"c464302abc341fbe77e0dfdf2b54e6c9f72e726e17a7e33e3127b7dc946e490c",
        x"e3c4c1b0b713ac60991d9104b036f7a123b6984cf117d4d494194a55d380e1077b362a3a98cc9bd495fab52fb782713d7ef726938c4d8772150261b4c9c9b5237f8d98119bbcfad08573d243af71cc9aebecafcbd11163deb30c5533404f06a4edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19efb4aecb50b5963705217307234ab7327c6a4afa4561c056dbdd04e7ca9c6d2a3282dde23fb020057c834f4c5cf27e364ff4a53320911c5d2ce4edf8e77be68c0500000000000000187f5c0b0da4e1ceb591d2adb9af7398c6b6a03fa11ee9e1e36ae3423df68e14e9724b30fac829424b510d37598504e202eb446907086c09a124a25f7d40220b4ae45d6f421ab9ba56fdf2a9ebcd1326354aea143cf11a2d9ad9dcd2698a6593e7f5e0ac50b75f36aa572bab87017d9c2afe37b2be6712d33cfb16f44f29ec925cdaab6ea2f607f064cfd0586fa353d57d5c807d76b9e5ae4ebc1499af518412",
        ctx,
    )
}

fun new_move_config(ctx: &mut TxContext): CircuitConfig {
    circuit_config::new_development_for_testing(
        proof_intent::action_move(),
        x"f3f249c1e7c73e5d84a61a12a47f2311983cc68dfed087dfc42faca3e82f6225",
        x"c81d170a2c435924786611b704aedff4ac8ca20b1e8155dbd7b9fd2fd8536a46",
        x"352a20091a6b3d04d856be53d60c8640e57bbf53708f86347e2e6aa0f952abd9",
        x"53568067050e8e8a9e9737e2ffd0baea2f830526861e00be66ae6c50ed8b7e69",
        x"e3c4c1b0b713ac60991d9104b036f7a123b6984cf117d4d494194a55d380e1077b362a3a98cc9bd495fab52fb782713d7ef726938c4d8772150261b4c9c9b5237f8d98119bbcfad08573d243af71cc9aebecafcbd11163deb30c5533404f06a4edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e195b24dc757523ef8c2aba78057aecfbecf74d02029bc9841a620c6fc9d8545d104a3500c4e10469943e683044100317972263729347dd233fac767015f964c71a0500000000000000afe6868f4556bf4efce3b45eddae0c3f9136366594d08f10c3e0b650e32e91a8d82f0984c45a5f9e8eafaa5411fc99a5ffe19399603cb63280c9f7c01889d2913cded71a4dcdfa1ce4e18c87dcaca16c8c631dcba3b0bbc6db071dcf46b65596bfbdb49e7e9cdd48c3f87796b90672ef7d2c5ee31fcd5724d5532da72a7b7d296a4f91dcdb2aab82423f017ee88e8b73c08974c67f3136838d68c552d2f3060f",
        ctx,
    )
}

fun new_move_new_config(ctx: &mut TxContext): CircuitConfig {
    circuit_config::new_development_for_testing(
        proof_intent::action_move_new(),
        x"f3f249c1e7c73e5d84a61a12a47f2311983cc68dfed087dfc42faca3e82f6225",
        x"550bbcea753b07fb818f16eb3d0e1edc4a0c32c575d9cb17e538354182781c12",
        x"352a20091a6b3d04d856be53d60c8640e57bbf53708f86347e2e6aa0f952abd9",
        x"5ec62bb25985c7904291040a0eeb82bf28fee50d3a8a8daa0044456c0f5bd572",
        x"e3c4c1b0b713ac60991d9104b036f7a123b6984cf117d4d494194a55d380e1077b362a3a98cc9bd495fab52fb782713d7ef726938c4d8772150261b4c9c9b5237f8d98119bbcfad08573d243af71cc9aebecafcbd11163deb30c5533404f06a4edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19d49f7935ba1290f60f4eca88bef860c0583b921bdb59476d4002339088d2a41f3376e6a48fc1b52a4bf56245758fccf7fbfa3f0019ece593099528c5e854c525060000000000000017d43577c01686ddd283abe96d36c31f579d57b4a86e71a6cc7a0fba9d42d1acd82f0984c45a5f9e8eafaa5411fc99a5ffe19399603cb63280c9f7c01889d2913cded71a4dcdfa1ce4e18c87dcaca16c8c631dcba3b0bbc6db071dcf46b6559649e827c2e1d22ac09c09f51538d74dbc23fc4024ec137ca86de61ca0b06dbe81dbfffa7e0f33e5f6ad0fecd9ac794fab5f859a267264fe04cbbb536cab1ab9a15acc67c3158ab7e55c3808bdfd5b2e5649b7723c9defc255f2674e530d08b484",
        ctx,
    )
}

fun setup(): (
    CircuitConfig,
    CircuitConfig,
    SeasonManifest,
    SeasonRuntime,
    EnrollmentRegistry,
    PlanetRegistry,
    SeasonAdminCap,
    SeasonSeat,
    CommanderProjection,
    CivilizationState,
    ScoreCard,
    TxContext,
) {
    let mut ctx = tx_context::new_from_hint(ALICE, 800, 0, 0, 0);
    let claim_config = new_claim_config(&mut ctx);
    let move_config = new_move_config(&mut ctx);
    assert!(*circuit_config::config_digest(&claim_config) == x"845b39c4f5164fb5159619bef34969182a51f099d06b88379b5475f7f30f2738");
    assert!(*circuit_config::config_digest(&move_config) == x"300903ffd58a146f2e830115222813d02c361812c2c11520b1f97295d639fd31");

    let (mut manifest, mut runtime, admin_cap) = season::new_season_for_testing(
        1, 100, 200, 210, 600, 2000000000, 50, 300, 100, 4, &mut ctx,
    );
    season::bind_circuit_configs_for_testing(
        &mut manifest,
        object::id(&claim_config),
        *circuit_config::config_digest(&claim_config),
        *circuit_config::verifying_key_digest(&claim_config),
        object::id(&move_config),
        *circuit_config::config_digest(&move_config),
        *circuit_config::verifying_key_digest(&move_config),
    );
    let season_id = season::season_id(&manifest);
    assert!(season_id == @0xaa6c0d93139bf53665db0a89b79e6ef5d6d109f26cf497145acfb07d5fdf1d23.to_id());
    let mut enrollment_registry = identity::new_registry_for_testing(season_id, 4, &mut ctx);
    let planet_registry = planet::new_registry_for_testing(season_id, &mut ctx);
    season::bind_registries(
        &mut manifest,
        object::id(&enrollment_registry),
        object::id(&planet_registry),
    );
    let (seat, projection, civilization, score) = soul_adapter::enroll_fixture_for_testing(
        &manifest,
        &mut enrollment_registry,
        @0x51d.to_id(),
        @0x1001.to_id(),
        @0x2001.to_id(),
        ALICE,
        1,
        false,
        bytes32(9),
        50,
        &mut ctx,
    );
    assert!(identity::seat_id(&seat) == @0xca496bc8c86ec7a792681f16f93afb7ee0411f8e4a79ed04fd81e652b5293568.to_id());
    season::open_universe_for_testing(&manifest, &mut runtime, bytes32(8), 200);
    (
        claim_config,
        move_config,
        manifest,
        runtime,
        enrollment_registry,
        planet_registry,
        admin_cap,
        seat,
        projection,
        civilization,
        score,
        ctx,
    )
}

fun close_home_window(manifest: &SeasonManifest, runtime: &mut SeasonRuntime) {
    season::tick_home_availability_at_for_testing(manifest, runtime, 300);
    season::tick_home_availability_at_for_testing(manifest, runtime, 400);
    season::tick_home_availability_at_for_testing(manifest, runtime, 500);
    season::resolve_home_window_at_for_testing(manifest, runtime, 600);
}

#[test]
fun real_groth16_proofs_create_home_then_dispatch_nonce_bound_move() {
    let (
        claim_config,
        move_config,
        manifest,
        mut runtime,
        enrollment_registry,
        mut planet_registry,
        admin_cap,
        seat,
        projection,
        mut civilization,
        score,
        mut ctx,
    ) = setup();
    let mut home = proof_actions::claim_home_development_at_for_testing(
        &claim_config,
        &manifest,
        &runtime,
        &mut planet_registry,
        &seat,
        &mut civilization,
        &score,
        HOME_LOCATION_HASH,
        DEADLINE_MS,
        claim_proof(),
        250,
        ALICE,
    );
    assert!(planet::location_hash(&home) == HOME_LOCATION_HASH);
    assert!(*planet::location_commitment(&home) == x"00003ffbb12c934ca3fdd878005f8654cdc87e924375c24afdcff22ca405bf92");
    assert!(planet::proof_nonce(&home) == 0);
    let mut target = planet::initialize_planet_fixture_for_testing(
        &manifest,
        &mut planet_registry,
        x"0000fee68c78afce3e970c0ba6385a3e82c99bef7cb01adf7fe4b6e6a184a806",
        bytes32(7),
        14,
        250,
    );
    close_home_window(&manifest, &mut runtime);
    let flight = proof_actions::dispatch_move_development_at_for_testing(
        &move_config,
        &manifest,
        &runtime,
        &seat,
        &mut civilization,
        &mut home,
        &mut target,
        198,
        40000,
        0,
        DEADLINE_MS,
        move_proof(),
        1000,
        ALICE,
        &mut ctx,
    );
    assert!(planet::proof_nonce(&home) == 1);
    assert!(planet::pending_voyage_count(&target) == 1);
    assert!(voyage::departure_at_seconds(&flight) == 1);
    assert!(voyage::energy_arriving(&flight) > 0);

    voyage::destroy_for_testing(flight);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
}

#[test]
fun real_move_new_proof_atomically_initializes_target_and_dispatches() {
    let (
        claim_config,
        move_config,
        mut manifest,
        mut runtime,
        enrollment_registry,
        mut planet_registry,
        admin_cap,
        seat,
        projection,
        mut civilization,
        score,
        mut ctx,
    ) = setup();
    let move_new_config = new_move_new_config(&mut ctx);
    assert!(circuit_config::public_input_count(&move_new_config) == 5);
    assert!(*circuit_config::config_digest(&move_new_config) == x"5adc44a90ff48deafc853343bcf321d5beb03a05141be9044ec31f0b26e32a11");
    season::bind_move_new_config_for_testing(
        &mut manifest,
        object::id(&move_new_config),
        *circuit_config::config_digest(&move_new_config),
        *circuit_config::verifying_key_digest(&move_new_config),
    );
    let mut home = proof_actions::claim_home_development_at_for_testing(
        &claim_config,
        &manifest,
        &runtime,
        &mut planet_registry,
        &seat,
        &mut civilization,
        &score,
        HOME_LOCATION_HASH,
        DEADLINE_MS,
        claim_proof(),
        250,
        ALICE,
    );
    close_home_window(&manifest, &mut runtime);
    let (target, flight) = proof_actions::dispatch_move_new_development_at_for_testing(
        &move_new_config,
        &manifest,
        &runtime,
        &mut planet_registry,
        &seat,
        &mut civilization,
        &mut home,
        NATURAL_LOCATION_HASH,
        14,
        198,
        40000,
        0,
        DEADLINE_MS,
        move_new_proof(),
        1000,
        ALICE,
        &mut ctx,
    );
    assert!(planet::location_hash(&target) == NATURAL_LOCATION_HASH);
    assert!(planet::is_neutral(&target));
    assert!(!planet::is_founding_planet(&target));
    assert!(planet::pending_voyage_count(&target) == 1);
    assert!(planet::proof_nonce(&home) == 1);
    assert!(voyage::energy_arriving(&flight) > 0);

    voyage::destroy_for_testing(flight);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
    circuit_config::destroy_for_testing(move_new_config);
}

#[test, expected_failure(abort_code = 1, location = infinite_stellar::proof_actions)]
fun move_new_rejects_caller_substituted_space_perlin_before_initialization() {
    let (
        claim_config, move_config, mut manifest, mut runtime, enrollment_registry,
        mut planet_registry, admin_cap, seat, projection, mut civilization,
        score, mut ctx,
    ) = setup();
    let move_new_config = new_move_new_config(&mut ctx);
    season::bind_move_new_config_for_testing(
        &mut manifest,
        object::id(&move_new_config),
        *circuit_config::config_digest(&move_new_config),
        *circuit_config::verifying_key_digest(&move_new_config),
    );
    let mut home = proof_actions::claim_home_development_at_for_testing(
        &claim_config, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &score, HOME_LOCATION_HASH, DEADLINE_MS,
        claim_proof(), 250, ALICE,
    );
    close_home_window(&manifest, &mut runtime);
    let (target, flight) = proof_actions::dispatch_move_new_development_at_for_testing(
        &move_new_config, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &mut home, NATURAL_LOCATION_HASH, 15, 198, 40000,
        0, DEADLINE_MS, move_new_proof(), 1000, ALICE, &mut ctx,
    );
    voyage::destroy_for_testing(flight);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
    circuit_config::destroy_for_testing(move_new_config);
}

#[test, expected_failure(abort_code = 3, location = infinite_stellar::planet)]
fun move_new_loser_cannot_reclaim_an_initialized_coordinate() {
    let (
        claim_config, move_config, mut manifest, mut runtime, enrollment_registry,
        mut planet_registry, admin_cap, seat, projection, mut civilization,
        score, mut ctx,
    ) = setup();
    let move_new_config = new_move_new_config(&mut ctx);
    season::bind_move_new_config_for_testing(
        &mut manifest,
        object::id(&move_new_config),
        *circuit_config::config_digest(&move_new_config),
        *circuit_config::verifying_key_digest(&move_new_config),
    );
    let mut home = proof_actions::claim_home_development_at_for_testing(
        &claim_config, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &score, HOME_LOCATION_HASH, DEADLINE_MS,
        claim_proof(), 250, ALICE,
    );
    let occupied = planet::initialize_planet_fixture_for_testing(
        &manifest,
        &mut planet_registry,
        x"0000fee68c78afce3e970c0ba6385a3e82c99bef7cb01adf7fe4b6e6a184a806",
        bytes32(7),
        14,
        250,
    );
    close_home_window(&manifest, &mut runtime);
    let (target, flight) = proof_actions::dispatch_move_new_development_at_for_testing(
        &move_new_config, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &mut home, NATURAL_LOCATION_HASH, 14, 198, 40000,
        0, DEADLINE_MS, move_new_proof(), 1000, ALICE, &mut ctx,
    );
    voyage::destroy_for_testing(flight);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(occupied);
    planet::destroy_planet_for_testing(target);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
    circuit_config::destroy_for_testing(move_new_config);
}

#[test, expected_failure(abort_code = 1, location = infinite_stellar::proof_actions)]
fun claim_proof_is_bound_to_sender() {
    let (
        claim_config, move_config, manifest, runtime, enrollment_registry,
        mut planet_registry, admin_cap, seat, projection, mut civilization,
        score, ctx,
    ) = setup();
    let home = proof_actions::claim_home_development_at_for_testing(
        &claim_config, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &score, HOME_LOCATION_HASH, DEADLINE_MS,
        claim_proof(), 250, BOB,
    );
    planet::destroy_planet_for_testing(home);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
    ctx;
}

#[test, expected_failure(abort_code = 0, location = infinite_stellar::proof_actions)]
fun expired_claim_proof_is_rejected_before_verification() {
    let (
        claim_config, move_config, manifest, runtime, enrollment_registry,
        mut planet_registry, admin_cap, seat, projection, mut civilization,
        score, ctx,
    ) = setup();
    let home = proof_actions::claim_home_development_at_for_testing(
        &claim_config, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &score, HOME_LOCATION_HASH, DEADLINE_MS,
        claim_proof(), DEADLINE_MS + 1, ALICE,
    );
    planet::destroy_planet_for_testing(home);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
    ctx;
}

#[test, expected_failure(abort_code = 2, location = infinite_stellar::circuit_config)]
fun season_rejects_same_action_config_substitution() {
    let (
        claim_config, move_config, manifest, runtime, enrollment_registry,
        mut planet_registry, admin_cap, seat, projection, mut civilization,
        score, mut ctx,
    ) = setup();
    let substituted = new_claim_config(&mut ctx);
    let home = proof_actions::claim_home_development_at_for_testing(
        &substituted, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &score, HOME_LOCATION_HASH, DEADLINE_MS,
        claim_proof(), 250, ALICE,
    );
    planet::destroy_planet_for_testing(home);
    circuit_config::destroy_for_testing(substituted);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
}

#[test, expected_failure(abort_code = 1, location = infinite_stellar::proof_actions)]
fun move_proof_cannot_be_replayed_after_source_nonce_advances() {
    let (
        claim_config,
        move_config,
        manifest,
        mut runtime,
        enrollment_registry,
        mut planet_registry,
        admin_cap,
        seat,
        projection,
        mut civilization,
        score,
        mut ctx,
    ) = setup();
    let mut home = proof_actions::claim_home_development_at_for_testing(
        &claim_config, &manifest, &runtime, &mut planet_registry, &seat,
        &mut civilization, &score, HOME_LOCATION_HASH, DEADLINE_MS,
        claim_proof(), 250, ALICE,
    );
    let mut target = planet::initialize_planet_fixture_for_testing(
        &manifest, &mut planet_registry,
        x"0000fee68c78afce3e970c0ba6385a3e82c99bef7cb01adf7fe4b6e6a184a806",
        bytes32(7), 14, 250,
    );
    close_home_window(&manifest, &mut runtime);
    let first = proof_actions::dispatch_move_development_at_for_testing(
        &move_config, &manifest, &runtime, &seat, &mut civilization,
        &mut home, &mut target, 198, 40000, 0, DEADLINE_MS,
        move_proof(), 1000, ALICE, &mut ctx,
    );
    assert!(planet::proof_nonce(&home) == 1);
    let replay = proof_actions::dispatch_move_development_at_for_testing(
        &move_config, &manifest, &runtime, &seat, &mut civilization,
        &mut home, &mut target, 198, 1000, 0, DEADLINE_MS,
        move_proof(), 1000, ALICE, &mut ctx,
    );
    voyage::destroy_for_testing(first);
    voyage::destroy_for_testing(replay);
    planet::destroy_planet_for_testing(home);
    planet::destroy_planet_for_testing(target);
    identity::destroy_enrollment_for_testing(seat, projection, civilization, score);
    identity::destroy_registry_for_testing(enrollment_registry);
    planet::destroy_registry_for_testing(planet_registry);
    season::destroy_for_testing(manifest, runtime, admin_cap);
    circuit_config::destroy_for_testing(claim_config);
    circuit_config::destroy_for_testing(move_config);
}
