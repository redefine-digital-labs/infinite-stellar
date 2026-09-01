module infinite_stellar::proof_actions;

use std::hash;
use infinite_stellar::circuit_config::{Self as circuit_config, CircuitConfig};
use infinite_stellar::identity::{Self as identity, CivilizationState, ScoreCard, SeasonSeat};
use infinite_stellar::planet::{Self as planet, Planet, PlanetRegistry};
use infinite_stellar::proof_intent;
use infinite_stellar::season::{Self as season, SeasonManifest, SeasonRuntime};
use infinite_stellar::voyage::{Self as voyage, Voyage};
use infinite_stellar::zk_verifier;
use sui::clock::{Self as clock, Clock};

const EProofExpired: u64 = 0;
const EInvalidProof: u64 = 1;
const EInvalidDistance: u64 = 2;

fun assert_config_bound(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    action_kind: u8,
    require_production: bool,
) {
    circuit_config::assert_action(config, action_kind);
    if (action_kind == proof_intent::action_claim_home()) {
        circuit_config::assert_bound(
            config,
            season::claim_home_circuit_config_id(manifest),
            season::claim_home_circuit_config_digest(manifest),
            season::claim_home_verifying_key_digest(manifest),
        );
        if (require_production) {
            circuit_config::assert_production_approved(config);
            zk_verifier::assert_production_claim_home_verifier_ready();
        };
    } else if (action_kind == proof_intent::action_move()) {
        circuit_config::assert_bound(
            config,
            season::move_circuit_config_id(manifest),
            season::move_circuit_config_digest(manifest),
            season::move_verifying_key_digest(manifest),
        );
        if (require_production) {
            circuit_config::assert_production_approved(config);
            zk_verifier::assert_production_move_verifier_ready();
        };
    } else {
        assert!(action_kind == proof_intent::action_move_new(), EInvalidProof);
        circuit_config::assert_bound(
            config,
            season::move_new_circuit_config_id(manifest),
            season::move_new_circuit_config_digest(manifest),
            season::move_new_verifying_key_digest(manifest),
        );
        if (require_production) {
            circuit_config::assert_production_approved(config);
            zk_verifier::assert_production_move_new_verifier_ready();
        };
    };
}

fun claim_home_at(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    destination_location_hash: u256,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    now_ms: u64,
    sender: address,
    require_production: bool,
): Planet {
    assert!(now_ms <= deadline_ms, EProofExpired);
    assert_config_bound(
        config,
        manifest,
        proof_intent::action_claim_home(),
        require_production,
    );
    let action_commitment = proof_intent::action_commitment(
        season::proof_network_field(manifest),
        season::league(manifest),
        proof_intent::action_claim_home(),
        &season::season_id(manifest),
        &identity::seat_id(seat),
        sender,
        0,
        destination_location_hash,
        0,
        0,
        deadline_ms,
        season::rules_geometry_commitment(manifest),
    );
    let public_input_bytes = proof_intent::public_inputs_bytes(
        0,
        destination_location_hash,
        action_commitment,
        season::rules_geometry_commitment(manifest),
    );
    let public_input_digest = hash::sha2_256(public_input_bytes);
    assert!(
        zk_verifier::verify_with_config(config, public_input_bytes, proof_bytes),
        EInvalidProof,
    );
    let verified = planet::new_verified_home_proof(
        proof_intent::interface_version(),
        season::season_id(manifest),
        identity::seat_id(seat),
        destination_location_hash,
        public_input_digest,
    );
    planet::claim_home_verified(
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        score,
        verified,
        now_ms,
        sender,
    )
}

/// Production action. It is intentionally unreachable until a later package
/// revision code-pins audited ceremony material and enables both readiness
/// gates; development configs can never pass this function.
public fun claim_home(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    destination_location_hash: u256,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let home = claim_home_at(
        config,
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        score,
        destination_location_hash,
        deadline_ms,
        proof_bytes,
        clock::timestamp_ms(clock_obj),
        ctx.sender(),
        true,
    );
    planet::share_planet(home);
}

fun dispatch_move_at(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    now_ms: u64,
    sender: address,
    require_production: bool,
    ctx: &mut TxContext,
): Voyage {
    assert!(now_ms <= deadline_ms, EProofExpired);
    assert!(max_distance <= 0xffffffffffffffff / 100, EInvalidDistance);
    assert_config_bound(
        config,
        manifest,
        proof_intent::action_move(),
        require_production,
    );
    let source_location_hash = planet::location_hash(source);
    let destination_location_hash = planet::location_hash(target);
    let source_planet_nonce = planet::proof_nonce(source);
    let action_commitment = proof_intent::action_commitment(
        season::proof_network_field(manifest),
        season::league(manifest),
        proof_intent::action_move(),
        &season::season_id(manifest),
        &identity::seat_id(seat),
        sender,
        source_location_hash,
        destination_location_hash,
        max_distance,
        source_planet_nonce,
        deadline_ms,
        season::rules_geometry_commitment(manifest),
    );
    let public_input_bytes = proof_intent::public_inputs_bytes(
        source_location_hash,
        destination_location_hash,
        action_commitment,
        season::rules_geometry_commitment(manifest),
    );
    let public_input_digest = hash::sha2_256(public_input_bytes);
    assert!(
        zk_verifier::verify_with_config(config, public_input_bytes, proof_bytes),
        EInvalidProof,
    );
    let verified = voyage::new_verified_move_proof(
        proof_intent::interface_version(),
        season::season_id(manifest),
        object::id(source),
        object::id(target),
        max_distance,
        source_planet_nonce,
        public_input_digest,
    );
    voyage::dispatch_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        verified,
        sent_energy,
        sent_silver,
        now_ms,
        sender,
        ctx,
    )
}

/// Production normal-fleet dispatch. Artifact and ship adapters remain a
/// separate review surface even though they reuse the same route relation.
public fun dispatch_move(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let flight = dispatch_move_at(
        config,
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        max_distance,
        sent_energy,
        sent_silver,
        deadline_ms,
        proof_bytes,
        clock::timestamp_ms(clock_obj),
        ctx.sender(),
        true,
        ctx,
    );
    voyage::share_voyage(flight);
}

fun dispatch_move_new_at(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    destination_location_hash: u256,
    destination_space_perlin: u8,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    now_ms: u64,
    sender: address,
    require_production: bool,
    ctx: &mut TxContext,
): (Planet, Voyage) {
    assert!(now_ms <= deadline_ms, EProofExpired);
    assert!(max_distance <= 0xffffffffffffffff / 100, EInvalidDistance);
    assert_config_bound(
        config,
        manifest,
        proof_intent::action_move_new(),
        require_production,
    );
    let source_location_hash = planet::location_hash(source);
    let source_planet_nonce = planet::proof_nonce(source);
    let action_commitment = proof_intent::action_commitment(
        season::proof_network_field(manifest),
        season::league(manifest),
        proof_intent::action_move_new(),
        &season::season_id(manifest),
        &identity::seat_id(seat),
        sender,
        source_location_hash,
        destination_location_hash,
        max_distance,
        source_planet_nonce,
        deadline_ms,
        season::rules_geometry_commitment(manifest),
    );
    let public_input_bytes = proof_intent::move_new_public_inputs_bytes(
        source_location_hash,
        destination_location_hash,
        destination_space_perlin,
        action_commitment,
        season::rules_geometry_commitment(manifest),
    );
    let public_input_digest = hash::sha2_256(public_input_bytes);
    assert!(
        zk_verifier::verify_with_config(config, public_input_bytes, proof_bytes),
        EInvalidProof,
    );
    let planet_proof = planet::new_verified_planet_proof(
        proof_intent::interface_version(),
        season::season_id(manifest),
        destination_location_hash,
        public_input_digest,
        destination_space_perlin as u64,
    );
    let mut target = planet::initialize_planet_verified(
        manifest,
        registry,
        planet_proof,
        now_ms,
    );
    let target_id = object::id(&target);
    let move_proof = voyage::new_verified_move_proof(
        proof_intent::interface_version(),
        season::season_id(manifest),
        object::id(source),
        target_id,
        max_distance,
        source_planet_nonce,
        public_input_digest,
    );
    let flight = voyage::dispatch_verified(
        manifest,
        runtime,
        seat,
        civilization,
        source,
        &mut target,
        move_proof,
        sent_energy,
        sent_silver,
        now_ms,
        sender,
        ctx,
    );
    (target, flight)
}

/// Production discovery-and-dispatch action. The target Planet and Voyage are
/// published together only after proof verification and every gameplay check
/// succeeds; any abort rolls back the registry claim and source mutation.
public fun dispatch_move_new(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    destination_location_hash: u256,
    destination_space_perlin: u8,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let (target, flight) = dispatch_move_new_at(
        config,
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        source,
        destination_location_hash,
        destination_space_perlin,
        max_distance,
        sent_energy,
        sent_silver,
        deadline_ms,
        proof_bytes,
        clock::timestamp_ms(clock_obj),
        ctx.sender(),
        true,
        ctx,
    );
    planet::share_planet(target);
    voyage::share_voyage(flight);
}

#[test_only]
public fun claim_home_development_at_for_testing(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    destination_location_hash: u256,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    now_ms: u64,
    sender: address,
): Planet {
    claim_home_at(
        config,
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        score,
        destination_location_hash,
        deadline_ms,
        proof_bytes,
        now_ms,
        sender,
        false,
    )
}

#[test_only]
public fun dispatch_move_development_at_for_testing(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    target: &mut Planet,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Voyage {
    dispatch_move_at(
        config,
        manifest,
        runtime,
        seat,
        civilization,
        source,
        target,
        max_distance,
        sent_energy,
        sent_silver,
        deadline_ms,
        proof_bytes,
        now_ms,
        sender,
        false,
        ctx,
    )
}

#[test_only]
public fun dispatch_move_new_development_at_for_testing(
    config: &CircuitConfig,
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    source: &mut Planet,
    destination_location_hash: u256,
    destination_space_perlin: u8,
    max_distance: u64,
    sent_energy: u64,
    sent_silver: u64,
    deadline_ms: u64,
    proof_bytes: vector<u8>,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): (Planet, Voyage) {
    dispatch_move_new_at(
        config,
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        source,
        destination_location_hash,
        destination_space_perlin,
        max_distance,
        sent_energy,
        sent_silver,
        deadline_ms,
        proof_bytes,
        now_ms,
        sender,
        false,
        ctx,
    )
}
