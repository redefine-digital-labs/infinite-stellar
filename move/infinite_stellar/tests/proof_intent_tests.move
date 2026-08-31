#[test_only]
module infinite_stellar::proof_intent_tests;

use std::hash;
use infinite_stellar::proof_intent;
use sui::object;

const DESTINATION_LOCATION_HASH: u256 =
    1234567890123456789012345678901234567890u256;
const RULES_GEOMETRY_COMMITMENT: u256 =
    6761147084378425910415724448274404356606413803680297929056799117911141148911u256;
const EXPECTED_CONTEXT: u256 =
    6961760459381713882819346659547257964740718346557136328160522324577965813159u256;
const EXPECTED_ACTION: u256 =
    2712343140332930239315986322713648633368676698543859947156743257637574144809u256;
const CIRCUIT_HOME_HASH: u256 =
    441595625074136767652070888593187681073630156209416385716195429441716114u256;
const CIRCUIT_MOVE_DESTINATION_HASH: u256 =
    1759259153186726942209343294499159540235552521067839175742163671329318918u256;
const CIRCUIT_CLAIM_ACTION: u256 =
    8425658407005409507828535733907930165096153069250243613139661480793909096122u256;
const CIRCUIT_MOVE_ACTION: u256 =
    17395075854654555458091388405915641099643232716606430841599960025074972367771u256;

#[test]
fun mainnet_claim_home_matches_typescript_golden_vector() {
    let season_id = object::id_from_address(
        @0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000,
    );
    let seat_id = object::id_from_address(
        @0x22223333444455556666777788889999aaaabbbbccccddddeeeeffff00001111,
    );
    let network = proof_intent::mainnet_network_field();
    assert!(proof_intent::context_tag(network, 1) == EXPECTED_CONTEXT);

    let commitment = proof_intent::action_commitment(
        network,
        1,
        proof_intent::action_claim_home(),
        &season_id,
        &seat_id,
        @0xa11ce,
        0,
        DESTINATION_LOCATION_HASH,
        0,
        0,
        1800000000000,
        RULES_GEOMETRY_COMMITMENT,
    );
    assert!(commitment == EXPECTED_ACTION);

    let public_inputs = proof_intent::public_inputs_bytes(
        0,
        DESTINATION_LOCATION_HASH,
        commitment,
        RULES_GEOMETRY_COMMITMENT,
    );
    assert!(public_inputs.length() == 128);
    assert!(hash::sha2_256(public_inputs) == vector[
        204, 189, 233, 43, 246, 24, 46, 59,
        21, 243, 57, 103, 205, 131, 36, 119,
        232, 147, 140, 103, 111, 186, 5, 130,
        140, 182, 88, 162, 40, 132, 135, 37,
    ]);
}

#[test]
fun development_circuit_vectors_match_typescript_and_move() {
    let season_id = object::id_from_address(
        @0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000,
    );
    let seat_id = object::id_from_address(
        @0x22223333444455556666777788889999aaaabbbbccccddddeeeeffff00001111,
    );
    let network = proof_intent::mainnet_network_field();

    let claim = proof_intent::action_commitment(
        network,
        1,
        proof_intent::action_claim_home(),
        &season_id,
        &seat_id,
        @0xa11ce,
        0,
        CIRCUIT_HOME_HASH,
        0,
        0,
        1800000000000,
        RULES_GEOMETRY_COMMITMENT,
    );
    assert!(claim == CIRCUIT_CLAIM_ACTION);
    assert!(hash::sha2_256(proof_intent::public_inputs_bytes(
        0,
        CIRCUIT_HOME_HASH,
        claim,
        RULES_GEOMETRY_COMMITMENT,
    )) == x"29afc42476cf0d375b62f416dd47bb34b441a86182bc9336f8ba5fadcd2655d8");

    // For proof-intent v1 `move`, amount canonically means max route distance.
    let movement = proof_intent::action_commitment(
        network,
        1,
        proof_intent::action_move(),
        &season_id,
        &seat_id,
        @0xa11ce,
        CIRCUIT_HOME_HASH,
        CIRCUIT_MOVE_DESTINATION_HASH,
        198,
        7,
        1800000000000,
        RULES_GEOMETRY_COMMITMENT,
    );
    assert!(movement == CIRCUIT_MOVE_ACTION);
    assert!(hash::sha2_256(proof_intent::public_inputs_bytes(
        CIRCUIT_HOME_HASH,
        CIRCUIT_MOVE_DESTINATION_HASH,
        movement,
        RULES_GEOMETRY_COMMITMENT,
    )) == x"b47dcb03e87ba119d66c7f39eabb68a0551e4bd2beab5db18bdfd7654a6f2e3c");
}

#[test]
fun all_bound_fields_change_the_action_commitment() {
    let season_id = object::id_from_address(@0x1);
    let seat_id = object::id_from_address(@0x2);
    let network = proof_intent::mainnet_network_field();
    let base = proof_intent::action_commitment(
        network, 1, proof_intent::action_move(), &season_id, &seat_id, @0x3,
        4, 5, 6, 7, 8, RULES_GEOMETRY_COMMITMENT,
    );
    assert!(base != proof_intent::action_commitment(
        network, 1, proof_intent::action_move(), &season_id, &seat_id, @0x3,
        4, 5, 7, 7, 8, RULES_GEOMETRY_COMMITMENT,
    ));
    assert!(base != proof_intent::action_commitment(
        network, 1, proof_intent::action_move(), &season_id, &seat_id, @0x3,
        4, 5, 6, 8, 8, RULES_GEOMETRY_COMMITMENT,
    ));
    assert!(base != proof_intent::action_commitment(
        network, 1, proof_intent::action_move(), &season_id, &seat_id, @0x3,
        4, 5, 6, 7, 9, RULES_GEOMETRY_COMMITMENT,
    ));
}
