pragma circom 2.2.3;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mimcsponge.circom";
include "./signed_coordinate.circom";

/// Exact Round-5 MiMC location relation, canonical signed coordinates, and
/// manifest-committed radius/rarity predicates.
template Round5LocationV1(coordinateBits) {
    signal input x_magnitude;
    signal input x_sign;
    signal input y_magnitude;
    signal input y_sign;
    signal input world_radius;
    signal input planet_hash_threshold;
    signal input location_hash_key;
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

    component xBound = LessEqThan(coordinateBits);
    component yBound = LessEqThan(coordinateBits);
    xBound.in[0] <== x_magnitude;
    xBound.in[1] <== world_radius;
    yBound.in[0] <== y_magnitude;
    yBound.in[1] <== world_radius;
    xBound.out === 1;
    yBound.out === 1;

    signal x_squared;
    signal y_squared;
    signal radius_squared;
    x_squared <== x_magnitude * x_magnitude;
    y_squared <== y_magnitude * y_magnitude;
    radius_squared <== x_squared + y_squared;
    component radiusBound = LessEqThan(coordinateBits * 2);
    radiusBound.in[0] <== radius_squared;
    radiusBound.in[1] <== world_radius * world_radius;
    radiusBound.out === 1;

    component mimc = MiMCSponge(2, 220, 1);
    mimc.ins[0] <== x.value;
    mimc.ins[1] <== y.value;
    mimc.k <== location_hash_key;
    location_hash <== mimc.outs[0];

    // Every valid planet hash is below 2^252, which makes the circomlib
    // comparator domain explicit before applying the exact rarity threshold.
    component hashBits = Num2Bits(252);
    hashBits.in <== location_hash;
    component rare = LessThan(252);
    rare.in[0] <== location_hash;
    rare.in[1] <== planet_hash_threshold;
    rare.out === 1;
}
