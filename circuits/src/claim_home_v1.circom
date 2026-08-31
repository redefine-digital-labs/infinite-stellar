pragma circom 2.2.3;

include "./lib/action_intent_v1.circom";
include "./lib/round5_location.circom";

/// Development candidate for the claim-home statement. It proves the frozen
/// intent, exact MiMC preimage, canonical coordinates, radius and rarity. It is
/// NOT production-complete until the independent Round-5 Perlin/home-band
/// relation is constrained and independently audited.
template ClaimHomeV1() {
    var ROUND5_RULES_GEOMETRY_COMMITMENT =
        6761147084378425910415724448274404356606413803680297929056799117911141148911;
    signal input source_location_hash;
    signal input destination_location_hash;
    signal input action_commitment;
    signal input rules_geometry_commitment;

    signal input network_field;
    signal input league;
    signal input season_id_low_128;
    signal input season_id_high_128;
    signal input seat_id_low_128;
    signal input seat_id_high_128;
    signal input sender_low_128;
    signal input sender_high_128;
    signal input deadline_ms;
    signal input x_magnitude;
    signal input x_sign;
    signal input y_magnitude;
    signal input y_sign;

    source_location_hash === 0;
    rules_geometry_commitment === ROUND5_RULES_GEOMETRY_COMMITMENT;

    component location = Round5LocationV1(32, 12000);
    location.x_magnitude <== x_magnitude;
    location.x_sign <== x_sign;
    location.y_magnitude <== y_magnitude;
    location.y_sign <== y_sign;
    destination_location_hash === location.location_hash;

    component intent = ActionIntentV1(1);
    intent.network_field <== network_field;
    intent.league <== league;
    intent.season_id_low_128 <== season_id_low_128;
    intent.season_id_high_128 <== season_id_high_128;
    intent.seat_id_low_128 <== seat_id_low_128;
    intent.seat_id_high_128 <== seat_id_high_128;
    intent.sender_low_128 <== sender_low_128;
    intent.sender_high_128 <== sender_high_128;
    intent.source_location_hash <== source_location_hash;
    intent.destination_location_hash <== destination_location_hash;
    intent.amount <== 0;
    intent.source_planet_nonce <== 0;
    intent.deadline_ms <== deadline_ms;
    intent.rules_geometry_commitment <== rules_geometry_commitment;
    action_commitment === intent.commitment;
}

component main {public [
    source_location_hash,
    destination_location_hash,
    action_commitment,
    rules_geometry_commitment
]} = ClaimHomeV1();
