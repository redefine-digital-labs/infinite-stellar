#[test_only]
module infinite_stellar::proof_intent_tests;

use std::hash;
use infinite_stellar::proof_intent;
use sui::object;

const DESTINATION_LOCATION_HASH: u256 =
    1234567890123456789012345678901234567890u256;
const RULES_GEOMETRY_COMMITMENT: u256 =
    18458232501308633390557626324462719473351388298275374257305522239595784888932u256;
const EXPECTED_CONTEXT: u256 =
    6961760459381713882819346659547257964740718346557136328160522324577965813159u256;
const EXPECTED_ACTION: u256 =
    1381185597265463982013002656334667872910775239321664969824848212529506565370u256;
const CIRCUIT_HOME_HASH: u256 =
    441595625074136767652070888593187681073630156209416385716195429441716114u256;
const CIRCUIT_MOVE_DESTINATION_HASH: u256 =
    1759259153186726942209343294499159540235552521067839175742163671329318918u256;
const CIRCUIT_CLAIM_ACTION: u256 =
    3061462994074414654632234259829315536673679399742702261024041757068735395695u256;
const CIRCUIT_MOVE_ACTION: u256 =
    5944891567764051431126369871904075300148615979378029950410975332507680934758u256;
const CIRCUIT_MOVE_NEW_ACTION: u256 =
    15641729311414852921669845935476921168532267999925470042850747303705248792148u256;

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
    assert!(hash::sha2_256(public_inputs) == x"e0ff0fb23b823242ea25172b54a36aaec4bb40aad7009e420b6ea4a1072da77b");
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
    )) == x"d010b83711c3574feb9eeb8fa8abdf3ba645164fd90271318982e2e76beef3a5");

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
    )) == x"09759e8d66e82e99bb1de56e9ffb067f5d35c928c7a635a1d329b1ec1ad86c41");

    let move_new = proof_intent::action_commitment(
        network,
        1,
        proof_intent::action_move_new(),
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
    assert!(move_new == CIRCUIT_MOVE_NEW_ACTION);
    let move_new_inputs = proof_intent::move_new_public_inputs_bytes(
        CIRCUIT_HOME_HASH,
        CIRCUIT_MOVE_DESTINATION_HASH,
        14,
        move_new,
        RULES_GEOMETRY_COMMITMENT,
    );
    assert!(move_new_inputs.length() == 160);
    assert!(hash::sha2_256(move_new_inputs) == x"8ecc4519c5993ce6703eeb407f2996e94ea41b7c6c733b30595347b5b4a71bed");
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
