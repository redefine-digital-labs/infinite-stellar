module infinite_stellar::zk_verifier;

use infinite_stellar::circuit_config::{Self as circuit_config, CircuitConfig};
use sui::groth16;

const EProductionVerifierNotPinned: u64 = 0;
const EInvalidProofEncoding: u64 = 1;

/// Ranked writes remain closed until an audited verification key from the
/// production ceremony is pinned in this package version.
public fun production_claim_home_verifier_ready(): bool { false }
public fun production_move_verifier_ready(): bool { false }

public fun assert_production_claim_home_verifier_ready() {
    assert!(production_claim_home_verifier_ready(), EProductionVerifierNotPinned)
}

public fun assert_production_move_verifier_ready() {
    assert!(production_move_verifier_ready(), EProductionVerifierNotPinned)
}

public(package) fun verify_with_config(
    config: &CircuitConfig,
    public_input_bytes: vector<u8>,
    proof_bytes: vector<u8>,
): bool {
    assert!(public_input_bytes.length() == 128, EInvalidProofEncoding);
    assert!(proof_bytes.length() == 128, EInvalidProofEncoding);
    let curve = groth16::bn254();
    let pvk = groth16::prepare_verifying_key(
        &curve,
        circuit_config::verifying_key_bytes(config),
    );
    let inputs = groth16::public_proof_inputs_from_bytes(public_input_bytes);
    let proof = groth16::proof_points_from_bytes(proof_bytes);
    groth16::verify_groth16_proof(&curve, &pvk, &inputs, &proof)
}

/// Native bridge used only by deterministic development-vector tests. It is
/// deliberately unavailable to package runtime code and pins no development
/// key into a production entry point.
#[test_only]
public fun verify_development_bn254_fixture(
    verifying_key: vector<u8>,
    public_input_bytes: vector<u8>,
    proof_bytes: vector<u8>,
): bool {
    assert!(public_input_bytes.length() == 128, EInvalidProofEncoding);
    assert!(proof_bytes.length() == 128, EInvalidProofEncoding);
    let curve = groth16::bn254();
    let pvk = groth16::prepare_verifying_key(&curve, &verifying_key);
    let inputs = groth16::public_proof_inputs_from_bytes(public_input_bytes);
    let proof = groth16::proof_points_from_bytes(proof_bytes);
    groth16::verify_groth16_proof(&curve, &pvk, &inputs, &proof)
}
