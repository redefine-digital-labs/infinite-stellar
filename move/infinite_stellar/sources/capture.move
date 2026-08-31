module infinite_stellar::capture;

use infinite_stellar::identity::{Self as identity, CivilizationState, ScoreCard, SeasonSeat};
use infinite_stellar::planet::{Self as planet, Planet};
use infinite_stellar::season::{Self as season, SeasonManifest, SeasonRuntime};
use sui::event;

const INTERFACE_VERSION: u64 = 1;

const EProductionAdapterUnavailable: u64 = 0;
const EInvalidAttestation: u64 = 1;
const EIntentMismatch: u64 = 2;
const EOutsideCaptureZone: u64 = 3;
const EWrongCaptureEpoch: u64 = 4;

/// Immutable centers for one canonical 255-checkpoint capture interval.
public struct CaptureEpoch has key {
    id: UID,
    season_id: ID,
    epoch_number: u64,
    start_checkpoint: u64,
    end_checkpoint: u64,
    zones_digest: vector<u8>,
}

/// Output of the future Sui checkpoint/zone adapter plus coordinate proof.
public struct VerifiedZoneProof has drop {
    interface_version: u64,
    season_id: ID,
    capture_epoch_id: ID,
    planet_id: ID,
    current_checkpoint: u64,
    inside_zone: bool,
    public_input_digest: vector<u8>,
}

/// Output of the future canonical checkpoint adapter used after the hold.
public struct VerifiedCheckpoint has drop {
    interface_version: u64,
    season_id: ID,
    current_checkpoint: u64,
    attestation_digest: vector<u8>,
}

public struct PlanetInvaded has copy, drop {
    season_id: ID,
    planet_id: ID,
    invader_seat_id: ID,
    start_checkpoint: u64,
}

public struct PlanetCaptured has copy, drop {
    season_id: ID,
    planet_id: ID,
    capturer_seat_id: ID,
    checkpoint: u64,
    score_gained: u64,
}

public fun production_capture_adapter_ready(): bool { false }
public fun required_interface_version(): u64 { INTERFACE_VERSION }

public fun assert_production_capture_adapter_ready() {
    abort EProductionAdapterUnavailable
}

public(package) fun new_epoch(
    manifest: &SeasonManifest,
    epoch_number: u64,
    start_checkpoint: u64,
    zones_digest: vector<u8>,
    ctx: &mut TxContext,
): CaptureEpoch {
    assert!(zones_digest.length() == 32, EInvalidAttestation);
    assert!(start_checkpoint <= 0xffffffffffffffff - 255, EInvalidAttestation);
    CaptureEpoch {
        id: object::new(ctx),
        season_id: season::season_id(manifest),
        epoch_number,
        start_checkpoint,
        end_checkpoint: start_checkpoint + 255,
        zones_digest,
    }
}

public(package) fun share_epoch(epoch: CaptureEpoch) {
    transfer::share_object(epoch);
}

public(package) fun new_verified_zone_proof(
    interface_version: u64,
    season_id: ID,
    capture_epoch_id: ID,
    planet_id: ID,
    current_checkpoint: u64,
    inside_zone: bool,
    public_input_digest: vector<u8>,
): VerifiedZoneProof {
    VerifiedZoneProof {
        interface_version,
        season_id,
        capture_epoch_id,
        planet_id,
        current_checkpoint,
        inside_zone,
        public_input_digest,
    }
}

public(package) fun new_verified_checkpoint(
    interface_version: u64,
    season_id: ID,
    current_checkpoint: u64,
    attestation_digest: vector<u8>,
): VerifiedCheckpoint {
    VerifiedCheckpoint {
        interface_version,
        season_id,
        current_checkpoint,
        attestation_digest,
    }
}

public(package) fun invade_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    epoch: &CaptureEpoch,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    target: &mut Planet,
    proof: VerifiedZoneProof,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    assert!(epoch.season_id == season_id, EWrongCaptureEpoch);
    planet::assert_planet_season(target, season_id);
    let VerifiedZoneProof {
        interface_version,
        season_id: proof_season_id,
        capture_epoch_id,
        planet_id,
        current_checkpoint,
        inside_zone,
        public_input_digest,
    } = proof;
    assert!(interface_version == INTERFACE_VERSION, EInvalidAttestation);
    assert!(public_input_digest.length() == 32, EInvalidAttestation);
    assert!(proof_season_id == season_id, EIntentMismatch);
    assert!(capture_epoch_id == object::id(epoch), EIntentMismatch);
    assert!(planet_id == object::id(target), EIntentMismatch);
    assert!(inside_zone, EOutsideCaptureZone);
    assert!(
        current_checkpoint >= epoch.start_checkpoint &&
            current_checkpoint < epoch.end_checkpoint,
        EWrongCaptureEpoch,
    );
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(target, now_seconds);
    planet::begin_capture_invasion(target, seat, current_checkpoint);
    event::emit(PlanetInvaded {
        season_id,
        planet_id,
        invader_seat_id: identity::seat_id(seat),
        start_checkpoint: current_checkpoint,
    });
}

public(package) fun capture_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    score: &mut ScoreCard,
    target: &mut Planet,
    checkpoint: VerifiedCheckpoint,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(target, season_id);
    let VerifiedCheckpoint {
        interface_version,
        season_id: proof_season_id,
        current_checkpoint,
        attestation_digest,
    } = checkpoint;
    assert!(interface_version == INTERFACE_VERSION, EInvalidAttestation);
    assert!(attestation_digest.length() == 32, EInvalidAttestation);
    assert!(proof_season_id == season_id, EIntentMismatch);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(target, now_seconds);
    planet::refresh(target, now_seconds);
    let score_gained = planet::complete_capture(target, seat, current_checkpoint);
    identity::add_score(seat, score, score_gained);
    event::emit(PlanetCaptured {
        season_id,
        planet_id: object::id(target),
        capturer_seat_id: identity::seat_id(seat),
        checkpoint: current_checkpoint,
        score_gained,
    });
}

public fun epoch_number(self: &CaptureEpoch): u64 { self.epoch_number }
public fun start_checkpoint(self: &CaptureEpoch): u64 { self.start_checkpoint }
public fun end_checkpoint(self: &CaptureEpoch): u64 { self.end_checkpoint }
public fun zones_digest(self: &CaptureEpoch): &vector<u8> { &self.zones_digest }

#[test_only]
public fun new_epoch_for_testing(
    manifest: &SeasonManifest,
    epoch_number: u64,
    start_checkpoint: u64,
    zones_digest: vector<u8>,
    ctx: &mut TxContext,
): CaptureEpoch {
    new_epoch(manifest, epoch_number, start_checkpoint, zones_digest, ctx)
}

#[test_only]
public fun invade_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    epoch: &CaptureEpoch,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    target: &mut Planet,
    current_checkpoint: u64,
    now_ms: u64,
    sender: address,
) {
    let proof = new_verified_zone_proof(
        INTERFACE_VERSION,
        season::season_id(manifest),
        object::id(epoch),
        object::id(target),
        current_checkpoint,
        true,
        bytes32(40),
    );
    invade_verified(
        manifest,
        runtime,
        epoch,
        seat,
        civilization,
        target,
        proof,
        now_ms,
        sender,
    )
}

#[test_only]
public fun capture_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    score: &mut ScoreCard,
    target: &mut Planet,
    current_checkpoint: u64,
    now_ms: u64,
    sender: address,
) {
    let checkpoint = new_verified_checkpoint(
        INTERFACE_VERSION,
        season::season_id(manifest),
        current_checkpoint,
        bytes32(41),
    );
    capture_verified(
        manifest,
        runtime,
        seat,
        civilization,
        score,
        target,
        checkpoint,
        now_ms,
        sender,
    )
}

#[test_only]
fun bytes32(value: u8): vector<u8> {
    let mut bytes = vector[];
    32u64.do!(|_| bytes.push_back(value));
    bytes
}

#[test_only]
public fun destroy_epoch_for_testing(epoch: CaptureEpoch) {
    let CaptureEpoch {
        id,
        season_id: _,
        epoch_number: _,
        start_checkpoint: _,
        end_checkpoint: _,
        zones_digest: _,
    } = epoch;
    object::delete(id);
}
