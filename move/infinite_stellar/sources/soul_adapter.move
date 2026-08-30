module infinite_stellar::soul_adapter;

use infinite_stellar::identity::{Self as identity, CommanderProjection, CivilizationState, EnrollmentRegistry, ScoreCard, SeasonSeat};
use infinite_stellar::season::SeasonManifest;

/// The only production-facing promise currently frozen by Infinite Stellar.
/// A concrete Soulidity dependency will be added here after its package/type
/// identity and owner/epoch/listing semantics are finalized.
public fun required_interface_version(): u64 {
    identity::adapter_interface_version()
}

/// This function intentionally always returns false in the P0 foundation.
/// It prevents clients from mistaking test fixtures for a live Soul adapter.
public fun production_adapter_ready(): bool { false }

#[test_only]
public fun enroll_fixture_for_testing(
    manifest: &SeasonManifest,
    registry: &mut EnrollmentRegistry,
    soulidity_package_id: ID,
    soul_state_id: ID,
    soul_id: ID,
    current_owner: address,
    ownership_epoch: u64,
    listed: bool,
    projection_commitment: vector<u8>,
    now_ms: u64,
    ctx: &mut TxContext,
): (SeasonSeat, CommanderProjection, CivilizationState, ScoreCard) {
    let binding = identity::new_verified_soul_binding(
        identity::adapter_interface_version(),
        soulidity_package_id,
        soul_state_id,
        soul_id,
        current_owner,
        ownership_epoch,
        listed,
        projection_commitment,
    );
    identity::enroll_verified(manifest, registry, binding, now_ms, ctx)
}

#[test_only]
public fun enroll_fixture_with_interface_for_testing(
    manifest: &SeasonManifest,
    registry: &mut EnrollmentRegistry,
    interface_version: u64,
    soulidity_package_id: ID,
    soul_state_id: ID,
    soul_id: ID,
    current_owner: address,
    ownership_epoch: u64,
    listed: bool,
    projection_commitment: vector<u8>,
    now_ms: u64,
    ctx: &mut TxContext,
): (SeasonSeat, CommanderProjection, CivilizationState, ScoreCard) {
    let binding = identity::new_verified_soul_binding(
        interface_version,
        soulidity_package_id,
        soul_state_id,
        soul_id,
        current_owner,
        ownership_epoch,
        listed,
        projection_commitment,
    );
    identity::enroll_verified(manifest, registry, binding, now_ms, ctx)
}
