module infinite_stellar::planet;

use infinite_stellar::identity::{Self as identity, CivilizationState, ScoreCard, SeasonSeat};
use infinite_stellar::season::{Self as season, SeasonManifest, SeasonRuntime};
use sui::derived_object;
use sui::event;

const PROOF_INTERFACE_VERSION: u64 = 1;

const ESeasonMismatch: u64 = 0;
const EInvalidProof: u64 = 1;
const EProofIntentMismatch: u64 = 2;
const EPlanetAlreadyClaimed: u64 = 3;

public struct PlanetRegistry has key {
    id: UID,
    season_id: ID,
}

public struct PlanetClaimKey has copy, drop, store {
    encoding_version: u64,
    season_id: ID,
    location_commitment: vector<u8>,
}

/// Package-internal output of the future pinned ZK verifier. No caller can
/// construct or persist this witness directly.
public struct VerifiedHomeProof has drop {
    interface_version: u64,
    season_id: ID,
    seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
}

public struct Planet has key {
    id: UID,
    season_id: ID,
    owner_seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    is_founding_planet: bool,
}

public struct FoundingPlanetClaimed has copy, drop {
    season_id: ID,
    seat_id: ID,
    planet_id: ID,
}

public(package) fun new_registry(season_id: ID, ctx: &mut TxContext): PlanetRegistry {
    PlanetRegistry { id: object::new(ctx), season_id }
}

public(package) fun share_registry(registry: PlanetRegistry) {
    transfer::share_object(registry);
}

public(package) fun new_verified_home_proof(
    interface_version: u64,
    season_id: ID,
    seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
): VerifiedHomeProof {
    VerifiedHomeProof {
        interface_version,
        season_id,
        seat_id,
        location_commitment,
        public_input_digest,
    }
}

public(package) fun claim_home_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    proof: VerifiedHomeProof,
    now_ms: u64,
    sender: address,
): Planet {
    assert_registry(manifest, registry);
    season::assert_claim_open(manifest, runtime, now_ms);
    identity::assert_home_claim_objects(manifest, seat, civilization, score, sender);
    let VerifiedHomeProof {
        interface_version,
        season_id,
        seat_id,
        location_commitment,
        public_input_digest,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(season_id == season::season_id(manifest), EProofIntentMismatch);
    assert!(seat_id == identity::seat_id(seat), EProofIntentMismatch);
    assert!(location_commitment.length() == 32, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    let key = PlanetClaimKey {
        encoding_version: PROOF_INTERFACE_VERSION,
        season_id,
        location_commitment,
    };
    assert!(!derived_object::exists(&registry.id, key), EPlanetAlreadyClaimed);

    let planet_uid = derived_object::claim(&mut registry.id, key);
    let planet_id = planet_uid.to_inner();
    // Verification and caller-controlled policy checks are complete. The
    // remaining invariant assertion and writes are one atomic Move transaction.
    identity::activate_home(seat, civilization, planet_id);
    let planet = Planet {
        id: planet_uid,
        season_id,
        owner_seat_id: seat_id,
        location_commitment,
        public_input_digest,
        is_founding_planet: true,
    };
    event::emit(FoundingPlanetClaimed { season_id, seat_id, planet_id });
    planet
}

public(package) fun share_planet(planet: Planet) {
    transfer::share_object(planet);
}

fun assert_registry(manifest: &SeasonManifest, registry: &PlanetRegistry) {
    assert!(registry.season_id == season::season_id(manifest), ESeasonMismatch);
    assert!(object::id(registry) == season::planet_registry_id(manifest), ESeasonMismatch);
}

public fun derive_planet_address(
    manifest: &SeasonManifest,
    registry: &PlanetRegistry,
    location_commitment: vector<u8>,
): address {
    assert_registry(manifest, registry);
    derived_object::derive_address(
        object::id(registry),
        PlanetClaimKey {
            encoding_version: PROOF_INTERFACE_VERSION,
            season_id: season::season_id(manifest),
            location_commitment,
        },
    )
}

public fun proof_interface_version(): u64 { PROOF_INTERFACE_VERSION }
public fun owner_seat_id(self: &Planet): ID { self.owner_seat_id }
public fun location_commitment(self: &Planet): &vector<u8> { &self.location_commitment }
public fun is_founding_planet(self: &Planet): bool { self.is_founding_planet }

#[test_only]
public fun new_registry_for_testing(season_id: ID, ctx: &mut TxContext): PlanetRegistry {
    new_registry(season_id, ctx)
}

#[test_only]
public fun claim_home_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
): Planet {
    let proof = new_verified_home_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        identity::seat_id(seat),
        location_commitment,
        public_input_digest,
    );
    claim_home_verified(
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        score,
        proof,
        now_ms,
        sender,
    )
}

#[test_only]
public fun claim_home_fixture_with_intent_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    proof_season_id: ID,
    proof_seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
): Planet {
    let proof = new_verified_home_proof(
        PROOF_INTERFACE_VERSION,
        proof_season_id,
        proof_seat_id,
        location_commitment,
        public_input_digest,
    );
    claim_home_verified(
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        score,
        proof,
        now_ms,
        sender,
    )
}

#[test_only]
public fun destroy_registry_for_testing(registry: PlanetRegistry) {
    let PlanetRegistry { id, season_id: _ } = registry;
    object::delete(id);
}

#[test_only]
public fun destroy_planet_for_testing(planet: Planet) {
    let Planet { id, season_id: _, owner_seat_id: _, location_commitment: _, public_input_digest: _, is_founding_planet: _ } = planet;
    object::delete(id);
}
