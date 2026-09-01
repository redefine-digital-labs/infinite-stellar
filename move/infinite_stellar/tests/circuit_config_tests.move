#[test_only]
module infinite_stellar::circuit_config_tests;

use infinite_stellar::circuit_config;
use infinite_stellar::proof_intent;

const ALICE: address = @0xa11ce;

fun bytes32(value: u8): vector<u8> {
    let mut bytes = vector[];
    32u64.do!(|_| bytes.push_back(value));
    bytes
}

fun development_claim_config(ctx: &mut TxContext): circuit_config::CircuitConfig {
    circuit_config::new_development_for_testing(
        proof_intent::action_claim_home(),
        bytes32(1),
        bytes32(2),
        bytes32(3),
        bytes32(4),
        x"2d2b80c95d9d91c253374307f856ecb9114534e123ffcaf8a2badd0eb069b50f81f532cedb110d8c48a3273a817e987cdd42e43f4028bf375f7621ad9ee5da23724fb36a6348d9c4500d6b8b406e5df08031264f5718a8a9ac34612072b3280bedf692d95cbdde46ddda5ef7d422436779445c5e66006a42761e1f12efde0018c212f3aeb785e49712e7a9353349aaf1255dfb31b7bf60723a480d9293938e19a1904b1d484a1f87c0f373821aee403b52152daf3a7e5c7f7eadf3527167932f82c62d0e8446c5876bf56992797cb745014bbad0f245cbe32a82bbcf7ed6da260500000000000000d9d8ae6601c037c3b403a68af89e64593440006b6a02d502baadbffb5914daa97106cac743c8011d79968958295c697ad4e60b408fd1a75a633257e4a2523f8aa08ef7fd3246689e4f8d6694c0fbd004da4643171358bd5b3b93da2a4d21ca093ef82fb0c3fdc28ab38e2da6a862706d127bcf30fb1ffc8ed56c236ef1233315ef9c602dd2ff478aec90dd343b867869987e0aad5886d2184d41d9a41c6ac11b",
        ctx,
    )
}

#[test]
fun config_digest_matches_typescript_and_pins_key_bytes() {
    let mut ctx = tx_context::new_from_hint(ALICE, 701, 0, 0, 0);
    let config = development_claim_config(&mut ctx);
    assert!(circuit_config::schema_version(&config) == 1);
    assert!(circuit_config::action_kind(&config) == proof_intent::action_claim_home());
    assert!(circuit_config::proof_interface_version(&config) == 1);
    assert!(circuit_config::public_input_count(&config) == 4);
    assert!(!circuit_config::production_approved(&config));
    assert!(
        circuit_config::verifying_key_digest(&config) ==
            &x"dc72eca67cb9f6afa2f048b7d7e8f2e3d8531d764eb76e818f31b6a9af771a39",
    );
    assert!(
        circuit_config::config_digest(&config) ==
            &x"4656d9739ca529a66de155e879278e50bf8cb3606ebdeff30c2ea5e39a0131ef",
    );
    circuit_config::destroy_for_testing(config);
}

#[test, expected_failure(abort_code = 1, location = infinite_stellar::circuit_config)]
fun claim_config_cannot_substitute_for_move() {
    let mut ctx = tx_context::new_from_hint(ALICE, 702, 0, 0, 0);
    let config = development_claim_config(&mut ctx);
    circuit_config::assert_action(&config, proof_intent::action_move());
    circuit_config::destroy_for_testing(config);
}

#[test, expected_failure(abort_code = 3, location = infinite_stellar::circuit_config)]
fun development_config_cannot_enter_production_path() {
    let mut ctx = tx_context::new_from_hint(ALICE, 703, 0, 0, 0);
    let config = development_claim_config(&mut ctx);
    circuit_config::assert_production_approved(&config);
    circuit_config::destroy_for_testing(config);
}
