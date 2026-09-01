module infinite_stellar::circuit_config;

use std::bcs;
use std::hash;
use infinite_stellar::proof_intent;

const SCHEMA_VERSION: u64 = 1;
const STANDARD_PUBLIC_INPUT_COUNT: u8 = 4;
const MOVE_NEW_PUBLIC_INPUT_COUNT: u8 = 5;
const BN254_STANDARD_VERIFYING_KEY_BYTES: u64 = 392;
const BN254_MOVE_NEW_VERIFYING_KEY_BYTES: u64 = 424;
const DIGEST_BYTES: u64 = 32;
const DOMAIN: vector<u8> = b"INFINITE_STELLAR_CIRCUIT_CONFIG_V1";

const EInvalidConfig: u64 = 0;
const EWrongAction: u64 = 1;
const EConfigMismatch: u64 = 2;
const EProductionConfigUnavailable: u64 = 3;

/// Immutable identity of one circuit and ceremony result. Production values
/// are frozen Sui objects; a Season additionally pins the exact object ID,
/// config digest, and verifying-key digest so callers cannot substitute a key.
public struct CircuitConfig has key {
    id: UID,
    schema_version: u64,
    action_kind: u8,
    proof_interface_version: u64,
    public_input_count: u8,
    circuit_source_digest: vector<u8>,
    proving_key_digest: vector<u8>,
    verifying_key_digest: vector<u8>,
    ceremony_transcript_digest: vector<u8>,
    artifact_manifest_digest: vector<u8>,
    config_digest: vector<u8>,
    verifying_key_bytes: vector<u8>,
    production_approved: bool,
}

fun calculate_digest(
    action_kind: u8,
    proof_interface_version: u64,
    public_input_count: u8,
    circuit_source_digest: &vector<u8>,
    proving_key_digest: &vector<u8>,
    verifying_key_digest: &vector<u8>,
    ceremony_transcript_digest: &vector<u8>,
    artifact_manifest_digest: &vector<u8>,
): vector<u8> {
    let mut bytes = DOMAIN;
    let schema_version = SCHEMA_VERSION;
    bytes.append(bcs::to_bytes(&schema_version));
    bytes.push_back(action_kind);
    bytes.append(bcs::to_bytes(&proof_interface_version));
    bytes.push_back(public_input_count);
    bytes.append(*circuit_source_digest);
    bytes.append(*proving_key_digest);
    bytes.append(*verifying_key_digest);
    bytes.append(*ceremony_transcript_digest);
    bytes.append(*artifact_manifest_digest);
    hash::sha2_256(bytes)
}

#[allow(unused_function)]
fun new_config(
    action_kind: u8,
    circuit_source_digest: vector<u8>,
    proving_key_digest: vector<u8>,
    ceremony_transcript_digest: vector<u8>,
    artifact_manifest_digest: vector<u8>,
    verifying_key_bytes: vector<u8>,
    production_approved: bool,
    ctx: &mut TxContext,
): CircuitConfig {
    assert!(
        action_kind == proof_intent::action_claim_home() ||
            action_kind == proof_intent::action_move() ||
            action_kind == proof_intent::action_move_new(),
        EInvalidConfig,
    );
    assert!(circuit_source_digest.length() == DIGEST_BYTES, EInvalidConfig);
    assert!(proving_key_digest.length() == DIGEST_BYTES, EInvalidConfig);
    assert!(ceremony_transcript_digest.length() == DIGEST_BYTES, EInvalidConfig);
    assert!(artifact_manifest_digest.length() == DIGEST_BYTES, EInvalidConfig);
    let public_input_count = expected_public_input_count(action_kind);
    let expected_verifying_key_bytes = if (action_kind == proof_intent::action_move_new()) {
        BN254_MOVE_NEW_VERIFYING_KEY_BYTES
    } else {
        BN254_STANDARD_VERIFYING_KEY_BYTES
    };
    assert!(verifying_key_bytes.length() == expected_verifying_key_bytes, EInvalidConfig);
    let verifying_key_digest = hash::sha2_256(verifying_key_bytes);
    let proof_interface_version = proof_intent::interface_version();
    let config_digest = calculate_digest(
        action_kind,
        proof_interface_version,
        public_input_count,
        &circuit_source_digest,
        &proving_key_digest,
        &verifying_key_digest,
        &ceremony_transcript_digest,
        &artifact_manifest_digest,
    );
    CircuitConfig {
        id: object::new(ctx),
        schema_version: SCHEMA_VERSION,
        action_kind,
        proof_interface_version,
        public_input_count,
        circuit_source_digest,
        proving_key_digest,
        verifying_key_digest,
        ceremony_transcript_digest,
        artifact_manifest_digest,
        config_digest,
        verifying_key_bytes,
        production_approved,
    }
}

public(package) fun assert_action(config: &CircuitConfig, expected_action: u8) {
    assert!(config.schema_version == SCHEMA_VERSION, EInvalidConfig);
    assert!(config.proof_interface_version == proof_intent::interface_version(), EInvalidConfig);
    assert!(config.public_input_count == expected_public_input_count(expected_action), EInvalidConfig);
    assert!(config.action_kind == expected_action, EWrongAction);
}

fun expected_public_input_count(action_kind: u8): u8 {
    if (action_kind == proof_intent::action_move_new()) {
        MOVE_NEW_PUBLIC_INPUT_COUNT
    } else {
        assert!(
            action_kind == proof_intent::action_claim_home() ||
                action_kind == proof_intent::action_move(),
            EInvalidConfig,
        );
        STANDARD_PUBLIC_INPUT_COUNT
    }
}

public(package) fun assert_bound(
    config: &CircuitConfig,
    expected_id: ID,
    expected_config_digest: &vector<u8>,
    expected_verifying_key_digest: &vector<u8>,
) {
    assert!(object::id(config) == expected_id, EConfigMismatch);
    assert!(&config.config_digest == expected_config_digest, EConfigMismatch);
    assert!(&config.verifying_key_digest == expected_verifying_key_digest, EConfigMismatch);
}

public(package) fun assert_production_approved(config: &CircuitConfig) {
    // No runtime constructor can currently create an approved value. A later
    // audited package revision must add only code-pinned ceremony constants.
    assert!(config.production_approved, EProductionConfigUnavailable);
}

public fun schema_version(config: &CircuitConfig): u64 { config.schema_version }
public fun action_kind(config: &CircuitConfig): u8 { config.action_kind }
public fun proof_interface_version(config: &CircuitConfig): u64 {
    config.proof_interface_version
}
public fun public_input_count(config: &CircuitConfig): u8 { config.public_input_count }
public fun circuit_source_digest(config: &CircuitConfig): &vector<u8> {
    &config.circuit_source_digest
}
public fun proving_key_digest(config: &CircuitConfig): &vector<u8> {
    &config.proving_key_digest
}
public fun verifying_key_digest(config: &CircuitConfig): &vector<u8> {
    &config.verifying_key_digest
}
public fun ceremony_transcript_digest(config: &CircuitConfig): &vector<u8> {
    &config.ceremony_transcript_digest
}
public fun artifact_manifest_digest(config: &CircuitConfig): &vector<u8> {
    &config.artifact_manifest_digest
}
public fun config_digest(config: &CircuitConfig): &vector<u8> { &config.config_digest }
public fun production_approved(config: &CircuitConfig): bool { config.production_approved }

public(package) fun verifying_key_bytes(config: &CircuitConfig): &vector<u8> {
    &config.verifying_key_bytes
}

#[test_only]
public fun new_development_for_testing(
    action_kind: u8,
    circuit_source_digest: vector<u8>,
    proving_key_digest: vector<u8>,
    ceremony_transcript_digest: vector<u8>,
    artifact_manifest_digest: vector<u8>,
    verifying_key_bytes: vector<u8>,
    ctx: &mut TxContext,
): CircuitConfig {
    new_config(
        action_kind,
        circuit_source_digest,
        proving_key_digest,
        ceremony_transcript_digest,
        artifact_manifest_digest,
        verifying_key_bytes,
        false,
        ctx,
    )
}

#[test_only]
public fun destroy_for_testing(config: CircuitConfig) {
    let CircuitConfig {
        id,
        schema_version: _,
        action_kind: _,
        proof_interface_version: _,
        public_input_count: _,
        circuit_source_digest: _,
        proving_key_digest: _,
        verifying_key_digest: _,
        ceremony_transcript_digest: _,
        artifact_manifest_digest: _,
        config_digest: _,
        verifying_key_bytes: _,
        production_approved: _,
    } = config;
    object::delete(id);
}
