module infinite_stellar::proof_intent;

use sui::address;
use sui::bcs;
use sui::object::{Self, ID};
use sui::poseidon;

const INTERFACE_VERSION: u64 = 1;
const ACTION_CLAIM_HOME: u8 = 1;
const ACTION_MOVE: u8 = 2;
const ACTION_REVEAL: u8 = 3;
const ACTION_CAPTURE: u8 = 4;

const DOMAIN_FIELD: u256 =
    13909138997969785233372616111572825994268025797777928597047068964955765571998u256;
const MAINNET_NETWORK_FIELD: u256 =
    135562284393187496412304656295821855871151406243072554287673956922558459083u256;
const TESTNET_NETWORK_FIELD: u256 =
    12597337022539968384113403541422236107320375547824898886637436062384730239134u256;
const BN254_SCALAR_FIELD: u256 =
    21888242871839275222246405745257275088548364400416034343698204186575808495617u256;
const LIMB_BASE: u256 = 340282366920938463463374607431768211456u256;

const EInvalidActionKind: u64 = 0;
const EInvalidNetwork: u64 = 1;
const ENonCanonicalField: u64 = 2;

public fun interface_version(): u64 { INTERFACE_VERSION }
public fun domain_field(): u256 { DOMAIN_FIELD }
public fun mainnet_network_field(): u256 { MAINNET_NETWORK_FIELD }
public fun testnet_network_field(): u256 { TESTNET_NETWORK_FIELD }
public fun action_claim_home(): u8 { ACTION_CLAIM_HOME }
public fun action_move(): u8 { ACTION_MOVE }
public fun action_reveal(): u8 { ACTION_REVEAL }
public fun action_capture(): u8 { ACTION_CAPTURE }

public fun assert_supported_network(network_tag: u256) {
    assert!(
        network_tag == MAINNET_NETWORK_FIELD || network_tag == TESTNET_NETWORK_FIELD,
        EInvalidNetwork,
    )
}

public fun assert_canonical_field(value: u256) {
    assert!(value < BN254_SCALAR_FIELD, ENonCanonicalField)
}

/// Binds a network tag and league without spending another action-intent field.
public fun context_tag(network_tag: u256, league: u8): u256 {
    poseidon::poseidon_bn254(&vector[network_tag, league as u256])
}

/// Proof intent v1. The field order is a stable cross-language protocol surface.
public fun action_commitment(
    network_tag: u256,
    league: u8,
    action_kind: u8,
    season_id: &ID,
    seat_id: &ID,
    sender: address,
    source_location_hash: u256,
    destination_location_hash: u256,
    amount: u64,
    source_planet_nonce: u64,
    deadline_ms: u64,
    rules_geometry_commitment: u256,
): u256 {
    assert_supported_network(network_tag);
    assert_canonical_field(source_location_hash);
    assert_canonical_field(destination_location_hash);
    assert_canonical_field(rules_geometry_commitment);
    assert!(
        action_kind == ACTION_CLAIM_HOME ||
            action_kind == ACTION_MOVE ||
            action_kind == ACTION_REVEAL ||
            action_kind == ACTION_CAPTURE,
        EInvalidActionKind,
    );
    let (season_low, season_high) = split_identifier(object::id_to_address(season_id));
    let (seat_low, seat_high) = split_identifier(object::id_to_address(seat_id));
    let (sender_low, sender_high) = split_identifier(sender);
    let context = context_tag(network_tag, league);
    poseidon::poseidon_bn254(&vector[
        DOMAIN_FIELD,
        INTERFACE_VERSION as u256,
        action_kind as u256,
        context,
        season_low,
        season_high,
        seat_low,
        seat_high,
        sender_low,
        sender_high,
        source_location_hash,
        destination_location_hash,
        amount as u256,
        source_planet_nonce as u256,
        deadline_ms as u256,
        rules_geometry_commitment,
    ])
}

/// Sui Groth16 expects concatenated 32-byte little-endian scalar elements.
public fun public_inputs_bytes(
    source_location_hash: u256,
    destination_location_hash: u256,
    action_commitment: u256,
    rules_geometry_commitment: u256,
): vector<u8> {
    assert_canonical_field(source_location_hash);
    assert_canonical_field(destination_location_hash);
    assert_canonical_field(action_commitment);
    assert_canonical_field(rules_geometry_commitment);
    let mut bytes = bcs::to_bytes(&source_location_hash);
    bytes.append(bcs::to_bytes(&destination_location_hash));
    bytes.append(bcs::to_bytes(&action_commitment));
    bytes.append(bcs::to_bytes(&rules_geometry_commitment));
    bytes
}

fun split_identifier(identifier: address): (u256, u256) {
    let encoded = address::to_u256(identifier);
    (encoded % LIMB_BASE, encoded / LIMB_BASE)
}
