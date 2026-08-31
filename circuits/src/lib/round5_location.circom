pragma circom 2.2.3;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mimcsponge.circom";
include "./signed_coordinate.circom";

/// Exact Round-5 MiMC location relation, canonical signed coordinates, fixed
/// world radius and rarity predicate. Perlin is intentionally outside this
/// development candidate and remains a production release blocker.
template Round5LocationV1(coordinateBits, worldRadius) {
    var ROUND5_LOCATION_HASH_KEY = 115;
    var ROUND5_PLANET_HASH_THRESHOLD =
        1824020239319939601853867145438106257379030366701336195308183682214650707;
    signal input x_magnitude;
    signal input x_sign;
    signal input y_magnitude;
    signal input y_sign;
    signal output x_value;
    signal output y_value;
    signal output location_hash;

    component x = SignedCoordinate(coordinateBits);
    component y = SignedCoordinate(coordinateBits);
    x.magnitude <== x_magnitude;
    x.sign <== x_sign;
    y.magnitude <== y_magnitude;
    y.sign <== y_sign;
    x_value <== x.value;
    y_value <== y.value;

    component xBound = BoundedMagnitude(coordinateBits, worldRadius);
    component yBound = BoundedMagnitude(coordinateBits, worldRadius);
    xBound.magnitude <== x_magnitude;
    yBound.magnitude <== y_magnitude;

    signal x_squared;
    signal y_squared;
    signal radius_squared;
    x_squared <== x_magnitude * x_magnitude;
    y_squared <== y_magnitude * y_magnitude;
    radius_squared <== x_squared + y_squared;
    component radiusBound = LessEqThan(coordinateBits * 2);
    radiusBound.in[0] <== radius_squared;
    radiusBound.in[1] <== worldRadius * worldRadius;
    radiusBound.out === 1;

    component mimc = MiMCSponge(2, 220, 1);
    mimc.ins[0] <== x.value;
    mimc.ins[1] <== y.value;
    mimc.k <== ROUND5_LOCATION_HASH_KEY;
    location_hash <== mimc.outs[0];

    // Every valid planet hash is below 2^252, which makes the circomlib
    // comparator domain explicit before applying the exact rarity threshold.
    component hashBits = Num2Bits(252);
    hashBits.in <== location_hash;
    component rare = LessThan(252);
    rare.in[0] <== location_hash;
    rare.in[1] <== ROUND5_PLANET_HASH_THRESHOLD;
    rare.out === 1;
}
