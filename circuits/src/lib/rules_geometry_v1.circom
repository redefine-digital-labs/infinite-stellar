pragma circom 2.2.3;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

/// Circuit-owned schema for every season parameter that changes private
/// location validity. The public commitment is recomputed by Sui Move from the
/// immutable SeasonManifest; none of these witness fields is free configuration.
template RulesGeometryV1() {
    var DOMAIN_FIELD =
        6053036279538949956273599243158082485469979069117808157047738621272655476926;

    signal input schema_version;
    signal input world_radius;
    signal input planet_hash_threshold;
    signal input location_hash_key;
    signal input space_type_key;
    signal input perlin_scale;
    signal input perlin_mirror_x;
    signal input perlin_mirror_y;
    signal input home_perlin_min;
    signal input home_perlin_max;
    signal output commitment;

    schema_version === 1;

    component worldBits = Num2Bits(32);
    worldBits.in <== world_radius;
    component worldMinimum = LessEqThan(32);
    worldMinimum.in[0] <== 12000;
    worldMinimum.in[1] <== world_radius;
    worldMinimum.out === 1;

    component thresholdBits = Num2Bits(252);
    thresholdBits.in <== planet_hash_threshold;
    component thresholdPositive = LessThan(252);
    thresholdPositive.in[0] <== 0;
    thresholdPositive.in[1] <== planet_hash_threshold;
    thresholdPositive.out === 1;
    component locationKeyBits = Num2Bits(64);
    locationKeyBits.in <== location_hash_key;
    component spaceKeyBits = Num2Bits(64);
    spaceKeyBits.in <== space_type_key;

    component scaleBits = Num2Bits(15);
    scaleBits.in <== perlin_scale;
    signal scaleBitCount[16];
    scaleBitCount[0] <== 0;
    for (var i = 0; i < 15; i++) {
        scaleBitCount[i + 1] <== scaleBitCount[i] + scaleBits.out[i];
    }
    scaleBitCount[15] === 1;

    perlin_mirror_x * (perlin_mirror_x - 1) === 0;
    perlin_mirror_y * (perlin_mirror_y - 1) === 0;
    component homeMinBits = Num2Bits(5);
    homeMinBits.in <== home_perlin_min;
    component homeMaxBits = Num2Bits(6);
    homeMaxBits.in <== home_perlin_max;
    component validHomeBand = LessThan(6);
    validHomeBand.in[0] <== home_perlin_min;
    validHomeBand.in[1] <== home_perlin_max;
    validHomeBand.out === 1;
    component homeUpperBound = LessEqThan(6);
    homeUpperBound.in[0] <== home_perlin_max;
    homeUpperBound.in[1] <== 32;
    homeUpperBound.out === 1;

    component hash = Poseidon(11);
    hash.inputs[0] <== DOMAIN_FIELD;
    hash.inputs[1] <== schema_version;
    hash.inputs[2] <== world_radius;
    hash.inputs[3] <== planet_hash_threshold;
    hash.inputs[4] <== location_hash_key;
    hash.inputs[5] <== space_type_key;
    hash.inputs[6] <== perlin_scale;
    hash.inputs[7] <== perlin_mirror_x;
    hash.inputs[8] <== perlin_mirror_y;
    hash.inputs[9] <== home_perlin_min;
    hash.inputs[10] <== home_perlin_max;
    commitment <== hash.out;
}
