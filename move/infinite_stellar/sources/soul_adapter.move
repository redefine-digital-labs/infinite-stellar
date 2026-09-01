module infinite_stellar::soul_adapter;

use infinite_stellar::identity::{Self as identity, CommanderProjection, CivilizationState, EnrollmentRegistry, ScoreCard, SeasonSeat};
use infinite_stellar::season::SeasonManifest;
use soulidity::soul::{Self as soul, SoulState};
use sui::clock::{Self as clock, Clock};

const SOULIDITY_PROTOCOL_VERSION: u64 = 1;

const ESoulidityVersionMismatch: u64 = 0;

/// Infinite Stellar adapter ABI. The concrete dependency is pinned to the
/// canonical Soulidity package source and its mainnet type origin.
public fun required_interface_version(): u64 {
    identity::adapter_interface_version()
}

public fun required_soulidity_protocol_version(): u64 {
    SOULIDITY_PROTOCOL_VERSION
}

public fun canonical_soulidity_package_id(): ID {
    @soulidity.to_id()
}

/// The adapter is production-shaped because its concrete `SoulState` type and
/// accessors are compile-time pinned. Other independent production gates remain
/// fail-closed and this flag alone never enables a ranked Season.
public fun production_adapter_ready(): bool { true }

/// Enrolls the current canonical Soul holder into one ranked Season. The shared
/// `SoulState` is never taken into custody or mutated. Holder, ownership epoch,
/// and listing status are read from Soulidity in the same transaction that
/// claims the deterministic Seat and Soul-season uniqueness slots.
public fun enroll(
    manifest: &SeasonManifest,
    registry: &mut EnrollmentRegistry,
    soul_state: &SoulState,
    projection_commitment: vector<u8>,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    assert!(soul::protocol_version() == SOULIDITY_PROTOCOL_VERSION, ESoulidityVersionMismatch);
    assert!(soul::state_version(soul_state) == SOULIDITY_PROTOCOL_VERSION, ESoulidityVersionMismatch);
    let binding = identity::new_verified_soul_binding(
        identity::adapter_interface_version(),
        canonical_soulidity_package_id(),
        soul::state_id(soul_state),
        soul::soul_id(soul_state),
        soul::current_owner(soul_state),
        soul::ownership_epoch(soul_state),
        soul::is_listed(soul_state),
        projection_commitment,
    );
    let (seat, projection, civilization, score) = identity::enroll_verified(
        manifest,
        registry,
        binding,
        clock::timestamp_ms(clock_obj),
        ctx,
    );
    identity::share_enrollment(seat, projection, civilization, score);
}

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
