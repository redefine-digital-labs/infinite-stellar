pragma circom 2.2.3;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

/// Canonical sign/magnitude encoding for one private coordinate.
/// A zero magnitude may only use sign = 0, so the same coordinate cannot have
/// two witnesses. `value` is the corresponding BN254 field representation.
template SignedCoordinate(nBits) {
    signal input magnitude;
    signal input sign;
    signal output value;

    sign * (sign - 1) === 0;

    component bits = Num2Bits(nBits);
    bits.in <== magnitude;

    component zero = IsZero();
    zero.in <== magnitude;
    sign * zero.out === 0;

    value <== magnitude * (1 - 2 * sign);
}

template BoundedMagnitude(nBits, maximum) {
    signal input magnitude;

    component bits = Num2Bits(nBits);
    bits.in <== magnitude;

    component within = LessEqThan(nBits);
    within.in[0] <== magnitude;
    within.in[1] <== maximum;
    within.out === 1;
}
