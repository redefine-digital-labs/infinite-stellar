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
const DEADLINE_MS: u64 = 1800000000000;

fun bytes32(value: u8): vector<u8> {
    let mut bytes = vector[];
    32u64.do!(|_| bytes.push_back(value));
    bytes
}

fun claim_proof(): vector<u8> {
    x"1d2ed5377a3e0e53ec71a5e66eb2cfbe69438a8054c36e5f8bea663ca712f5a4804e7ae9497bfb5693fffec0006e7e4fa6b35c071d2520741f719072225975224ee2bf647e6d56beaefec14a8757977dc3bb5fe95e3d802a3fa16c64efe441118cb0b66b79905698880f2023b69bc56cd24e4710d4ea254dbb9a9fa558def92a"
}

fun move_proof(): vector<u8> {
    x"7f163db2f1d49108c1cc01e70193f9da316bbbb9c48dcbb01d4f1310da39f9234e8841b8f641e9efeae3f6590c0dd7e4287db8cc8c475118223ca5a5dddc51116afaf60c7dfe49bf021f26a3e4961388b7d11bdd8186c4e73944d2f0a2ac27a8c85c402f071e5a0a348772b0f676466f6d9afe4effadfc35ddb690a87842032c"
}

fun new_claim_config(ctx: &mut TxContext): CircuitConfig {
    circuit_config::new_development_for_testing(
        proof_intent::action_claim_home(),
        x"e47d906df1da0d33c2691ce899d083f2cee88a59c71990fc89c0b0a8c751e4ef",
        x"642b8371f1a0010fd88679a73f57fa7a92024cbe350b4b708173ca9f573affa2",
        x"352a20091a6b3d04d856be53d60c8640e57bbf53708f86347e2e6aa0f952abd9",
        x"f447785ed3749effb7e554012f36199271b506dbf6aa649ebfba7d9545571e75",
        x"13ccb2bc11bb1d6f36fcb1b5b2c51bc036def519d550577263c83f7f0e7250973dc8bef967ed53d4b5a305beb39eeffe0db529de6bcb443fa21457eea8d61e02046252d50fbc61616af04188c66d289a25cbc012d4016bc3aa0a603048cc7789edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e192e00ffb08d7a41d962cdbf70c4552bf879ebdfcfd0d7652aa61cb2617f03c404ac23742ad2ecafe019d2d61c08d3fb0f0fea6bfc6ba73c5295a9e576f8cf982305000000000000001a81076a702f20dab7510c1d16c2475178d497752f690072ef5d03da3ec9a59fefd72e48c78460a1ab174ee7005d0ab09fe202cab639810cc089b5d11a4b2a18d8f1655299b070ec97a9d8c8a94e9071d425deb3c4ddbdd1b9a03ed80ec603b02f63d178f1f1500b0b1fca2b811ac9aee96d06b884dae22b79e46d0c1427080b1474c7e8857f112a2e1de62470dca42fa10627ab9960baef66e0ecbf7edbe6a1",
        ctx,
    )
}

fun new_move_config(ctx: &mut TxContext): CircuitConfig {
    circuit_config::new_development_for_testing(
        proof_intent::action_move(),
        x"e47d906df1da0d33c2691ce899d083f2cee88a59c71990fc89c0b0a8c751e4ef",
        x"2b4e2947fd7a21a878c5927298dfbdca7765973b079f67f69f5f0cf8b7859ee4",
        x"352a20091a6b3d04d856be53d60c8640e57bbf53708f86347e2e6aa0f952abd9",
        x"ab82a3f5ca84286db613f4773a21033c6e490f37291c7e5336cf8f90e46c4148",
        x"13ccb2bc11bb1d6f36fcb1b5b2c51bc036def519d550577263c83f7f0e7250973dc8bef967ed53d4b5a305beb39eeffe0db529de6bcb443fa21457eea8d61e02046252d50fbc61616af04188c66d289a25cbc012d4016bc3aa0a603048cc7789edf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19132fd08875664cd9d9a448faf6d2423769fa61dd6fb1ac09a4d0fc364b9550118b69150460444bcc5dd60e5378781bdb6dede32eb9fcc5334699a57f620123000500000000000000b05f552ed76d31e9051d698c074f994e4662b18767ebe00dad3155d646f2f9873cbb6d9dc126ce4ca9442057f4d606a172dc2b9dc2630d5574be97c06d24d819377b97af4a71d140cc31cc89ace7d37a89dd574e03fd5f7f4f291472b925452ea302bebeec2acc2b8326647787d3d9699d46e2cc9e442ae8d85422ddfa04011b15b70404bc481551105db003f701cab89337bd2e483d010df2868d17b5d56081",
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
    assert!(*circuit_config::config_digest(&claim_config) == x"e32bf5c1ef97a41541f25480d1d9e5cb7950f6d5bb8b63e0411834dcdee874f3");
    assert!(*circuit_config::config_digest(&move_config) == x"f739b6ee89b4bb48e792fb48d57f8790b9a45802b19be45bf6e658ed95f10914");

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
