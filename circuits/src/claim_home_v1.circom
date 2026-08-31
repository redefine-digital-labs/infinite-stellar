pragma circom 2.2.3;

include "./lib/action_intent_v1.circom";
include "./lib/round5_location.circom";
include "./lib/round5_perlin.circom";
include "./lib/rules_geometry_v1.circom";

/// Complete claim-home relation for proof interface v1. Production use still
/// requires an independent circuit audit and a real multi-party setup.
template ClaimHomeV1() {
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
    signal input x_magnitude;
    signal input x_sign;
    signal input y_magnitude;
    signal input y_sign;

    source_location_hash === 0;

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

    component location = Round5LocationV1(32);
    location.x_magnitude <== x_magnitude;
    location.x_sign <== x_sign;
    location.y_magnitude <== y_magnitude;
    location.y_sign <== y_sign;
    location.world_radius <== world_radius;
    location.planet_hash_threshold <== planet_hash_threshold;
    location.location_hash_key <== location_hash_key;
    destination_location_hash === location.location_hash;

    component perlin = Round5PerlinV1();
    perlin.x_magnitude <== x_magnitude;
    perlin.x_sign <== x_sign;
    perlin.y_magnitude <== y_magnitude;
    perlin.y_sign <== y_sign;
    perlin.key <== space_type_key;
    perlin.scale <== perlin_scale;
    perlin.mirror_x <== perlin_mirror_x;
    perlin.mirror_y <== perlin_mirror_y;
    component homeLower = LessEqThan(6);
    homeLower.in[0] <== home_perlin_min;
    homeLower.in[1] <== perlin.perlin;
    homeLower.out === 1;
    component homeUpper = LessThan(6);
    homeUpper.in[0] <== perlin.perlin;
    homeUpper.in[1] <== home_perlin_max;
    homeUpper.out === 1;

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
