pragma circom 2.2.3;

include "circomlib/circuits/comparators.circom";
include "./lib/action_intent_v1.circom";
include "./lib/round5_location.circom";
include "./lib/round5_perlin.circom";
include "./lib/rules_geometry_v1.circom";

/// Development candidate for one normal Round-5 movement statement. For the
/// move action, proof-intent `amount` is canonically the route's max distance;
/// sent energy and silver remain independently checked by the Move transition.
template MoveV1() {
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
    signal input max_distance;
    signal input source_planet_nonce;
    signal input deadline_ms;
    signal input geometry_schema_version;
    signal input world_radius;
    signal input planet_hash_threshold;
    signal input location_hash_key;
    signal input space_type_key;
    signal input perlin_scale;
    signal input perlin_mirror_x;
    signal input perlin_mirror_y;
    signal input home_perlin_min;
    signal input home_perlin_max;
    signal input source_x_magnitude;
    signal input source_x_sign;
    signal input source_y_magnitude;
    signal input source_y_sign;
    signal input destination_x_magnitude;
    signal input destination_x_sign;
    signal input destination_y_magnitude;
    signal input destination_y_sign;

    component geometry = RulesGeometryV1();
    geometry.schema_version <== geometry_schema_version;
    geometry.world_radius <== world_radius;
    geometry.planet_hash_threshold <== planet_hash_threshold;
    geometry.location_hash_key <== location_hash_key;
    geometry.space_type_key <== space_type_key;
    geometry.perlin_scale <== perlin_scale;
    geometry.perlin_mirror_x <== perlin_mirror_x;
    geometry.perlin_mirror_y <== perlin_mirror_y;
    geometry.home_perlin_min <== home_perlin_min;
    geometry.home_perlin_max <== home_perlin_max;
    rules_geometry_commitment === geometry.commitment;

    component source = Round5LocationV1(32);
    source.x_magnitude <== source_x_magnitude;
    source.x_sign <== source_x_sign;
    source.y_magnitude <== source_y_magnitude;
    source.y_sign <== source_y_sign;
    source.world_radius <== world_radius;
    source.planet_hash_threshold <== planet_hash_threshold;
    source.location_hash_key <== location_hash_key;
    source_location_hash === source.location_hash;

    component destination = Round5LocationV1(32);
    destination.x_magnitude <== destination_x_magnitude;
    destination.x_sign <== destination_x_sign;
    destination.y_magnitude <== destination_y_magnitude;
    destination.y_sign <== destination_y_sign;
    destination.world_radius <== world_radius;
    destination.planet_hash_threshold <== planet_hash_threshold;
    destination.location_hash_key <== location_hash_key;
    destination_location_hash === destination.location_hash;

    // Interface v1 moves only to an already materialized Planet. Recomputing
    // destination Perlin here keeps the private geometry relation complete;
    // onchain Planet initialization remains a separate proof-gated action.
    component destinationPerlin = Round5PerlinV1();
    destinationPerlin.x_magnitude <== destination_x_magnitude;
    destinationPerlin.x_sign <== destination_x_sign;
    destinationPerlin.y_magnitude <== destination_y_magnitude;
    destinationPerlin.y_sign <== destination_y_sign;
    destinationPerlin.key <== space_type_key;
    destinationPerlin.scale <== perlin_scale;
    destinationPerlin.mirror_x <== perlin_mirror_x;
    destinationPerlin.mirror_y <== perlin_mirror_y;

    component maxDistanceBits = Num2Bits(33);
    maxDistanceBits.in <== max_distance;
    component maxDistanceBound = LessEqThan(33);
    maxDistanceBound.in[0] <== max_distance;
    maxDistanceBound.in[1] <== 2 * world_radius;
    maxDistanceBound.out === 1;

    signal delta_x;
    signal delta_y;
    signal delta_x_squared;
    signal delta_y_squared;
    signal distance_squared;
    delta_x <== destination.x_value - source.x_value;
    delta_y <== destination.y_value - source.y_value;
    delta_x_squared <== delta_x * delta_x;
    delta_y_squared <== delta_y * delta_y;
    distance_squared <== delta_x_squared + delta_y_squared;

    signal max_distance_squared;
    max_distance_squared <== max_distance * max_distance;

    // Two u32 coordinates can differ by almost 2^33, so squared distance uses
    // the full non-wrapping 66-bit domain rather than the old fixed-radius 64.
    component routeBound = LessEqThan(66);
    routeBound.in[0] <== distance_squared;
    routeBound.in[1] <== max_distance_squared;
    routeBound.out === 1;

    component intent = ActionIntentV1(2);
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
    intent.amount <== max_distance;
    intent.source_planet_nonce <== source_planet_nonce;
    intent.deadline_ms <== deadline_ms;
    intent.rules_geometry_commitment <== rules_geometry_commitment;
    action_commitment === intent.commitment;
}

component main {public [
    source_location_hash,
    destination_location_hash,
    action_commitment,
    rules_geometry_commitment
]} = MoveV1();
