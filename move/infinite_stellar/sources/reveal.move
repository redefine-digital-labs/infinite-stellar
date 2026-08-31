module infinite_stellar::reveal;

use infinite_stellar::identity::{Self as identity, CivilizationState, SeasonSeat};
use infinite_stellar::planet::{Self as planet, Planet};
use infinite_stellar::season::{Self as season, SeasonManifest, SeasonRuntime};
use sui::event;

const PROOF_INTERFACE_VERSION: u64 = 1;

const EProductionVerifierUnavailable: u64 = 0;
const EInvalidProof: u64 = 1;
const EProofIntentMismatch: u64 = 2;

public struct VerifiedRevealProof has drop {
    interface_version: u64,
    season_id: ID,
    planet_id: ID,
    location_commitment: vector<u8>,
    x: vector<u8>,
    y: vector<u8>,
    public_input_digest: vector<u8>,
}

public struct LocationRevealed has copy, drop {
    season_id: ID,
    planet_id: ID,
    revealer_seat_id: ID,
    x: vector<u8>,
    y: vector<u8>,
}

public fun production_reveal_verifier_ready(): bool { false }
public fun required_proof_interface_version(): u64 { PROOF_INTERFACE_VERSION }

public fun assert_production_reveal_verifier_ready() {
    abort EProductionVerifierUnavailable
}

public(package) fun new_verified_reveal_proof(
    interface_version: u64,
    season_id: ID,
    planet_id: ID,
    location_commitment: vector<u8>,
    x: vector<u8>,
    y: vector<u8>,
    public_input_digest: vector<u8>,
): VerifiedRevealProof {
    VerifiedRevealProof {
        interface_version,
        season_id,
        planet_id,
        location_commitment,
        x,
        y,
        public_input_digest,
    }
}

public(package) fun reveal_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    target: &mut Planet,
    proof: VerifiedRevealProof,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(target, season_id);
    let VerifiedRevealProof {
        interface_version,
        season_id: proof_season_id,
        planet_id,
        location_commitment,
        x,
        y,
        public_input_digest,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(location_commitment.length() == 32, EInvalidProof);
    assert!(x.length() == 32 && y.length() == 32, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    assert!(proof_season_id == season_id, EProofIntentMismatch);
    assert!(planet_id == object::id(target), EProofIntentMismatch);
    assert!(location_commitment == *planet::location_commitment(target), EProofIntentMismatch);
    identity::consume_reveal_cooldown(seat, civilization, now_ms / 1000);
    let revealer_seat_id = identity::seat_id(seat);
    planet::reveal(target, revealer_seat_id, copy x, copy y);
    event::emit(LocationRevealed { season_id, planet_id, revealer_seat_id, x, y });
}

#[test_only]
public fun reveal_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    target: &mut Planet,
    x: vector<u8>,
    y: vector<u8>,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
) {
    let proof = new_verified_reveal_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(target),
        *planet::location_commitment(target),
        x,
        y,
        public_input_digest,
    );
    reveal_verified(
        manifest,
        runtime,
        seat,
        civilization,
        target,
        proof,
        now_ms,
        sender,
    )
}
