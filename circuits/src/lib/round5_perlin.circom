pragma circom 2.2.3;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mimcsponge.circom";

/// Euclidean remainder for a canonical sign/magnitude coordinate and a
/// positive scale no greater than 2^16. The quotient and raw remainder are
/// range-constrained so the field equation has one integer interpretation.
template CoordinateRemainder() {
    signal input magnitude;
    signal input sign;
    signal input scale;
    signal output remainder;
    signal output value;

    signal quotient;
    signal raw_remainder;
    raw_remainder <-- magnitude % scale;
    quotient <-- (magnitude - raw_remainder) / scale;
    magnitude === quotient * scale + raw_remainder;
    component quotientBits = Num2Bits(32);
    quotientBits.in <== quotient;
    component rawBits = Num2Bits(16);
    rawBits.in <== raw_remainder;
    component rawBound = LessThan(17);
    rawBound.in[0] <== raw_remainder;
    rawBound.in[1] <== scale;
    rawBound.out === 1;

    component rawZero = IsZero();
    rawZero.in <== raw_remainder;
    signal negative_remainder;
    signal positive_branch;
    signal negative_branch;
    negative_remainder <== (1 - rawZero.out) * (scale - raw_remainder);
    positive_branch <== (1 - sign) * raw_remainder;
    negative_branch <== sign * negative_remainder;
    remainder <== positive_branch + negative_branch;
    value <== magnitude * (1 - 2 * sign);
}

template SelectGradient() {
    var gx[16] = [1000,923,707,382,0,-383,-708,-924,-1000,-924,-708,-383,-1,382,707,923];
    var gy[16] = [0,382,707,923,1000,923,707,382,0,-383,-708,-924,-1000,-924,-708,-383];
    signal input bits[4];
    signal output x;
    signal output y;
    signal x0[8];
    signal x1[4];
    signal x2[2];
    signal y0[8];
    signal y1[4];
    signal y2[2];
    for (var i = 0; i < 8; i++) {
        x0[i] <== gx[2*i] + bits[0] * (gx[2*i+1] - gx[2*i]);
        y0[i] <== gy[2*i] + bits[0] * (gy[2*i+1] - gy[2*i]);
    }
    for (var j = 0; j < 4; j++) {
        x1[j] <== x0[2*j] + bits[1] * (x0[2*j+1] - x0[2*j]);
        y1[j] <== y0[2*j] + bits[1] * (y0[2*j+1] - y0[2*j]);
    }
    for (var k = 0; k < 2; k++) {
        x2[k] <== x1[2*k] + bits[2] * (x1[2*k+1] - x1[2*k]);
        y2[k] <== y1[2*k] + bits[2] * (y1[2*k+1] - y1[2*k]);
    }
    x <== x2[0] + bits[3] * (x2[1] - x2[0]);
    y <== y2[0] + bits[3] * (y2[1] - y2[0]);
}

template GradientAt() {
    signal input x;
    signal input y;
    signal input scale;
    signal input key;
    signal output gradient_x;
    signal output gradient_y;
    component random = MiMCSponge(3, 4, 1);
    random.ins[0] <== x;
    random.ins[1] <== y;
    random.ins[2] <== scale;
    random.k <== key;
    component randomBits = Num2Bits(254);
    randomBits.in <== random.outs[0];
    component selected = SelectGradient();
    for (var i = 0; i < 4; i++) selected.bits[i] <== randomBits.out[i];
    gradient_x <== selected.x;
    gradient_y <== selected.y;
}

/// One octave, represented as an exact integer numerator over the common
/// denominator 2^50 * 1000. The denominator is divisible by 1000*scale^3 for
/// every allowed Round-5 octave, avoiding unconstrained field division.
template Round5PerlinOctave() {
    var DENOMINATOR = 1125899906842624000;
    signal input x_magnitude;
    signal input x_sign;
    signal input y_magnitude;
    signal input y_sign;
    signal input scale;
    signal input key;
    signal output value;

    component xr = CoordinateRemainder();
    component yr = CoordinateRemainder();
    xr.magnitude <== x_magnitude;
    xr.sign <== x_sign;
    xr.scale <== scale;
    yr.magnitude <== y_magnitude;
    yr.sign <== y_sign;
    yr.scale <== scale;

    signal left;
    signal bottom;
    left <== xr.value - xr.remainder;
    bottom <== yr.value - yr.remainder;

    component gradients[4];
    signal corner_x[4];
    signal corner_y[4];
    corner_x[0] <== left;
    corner_y[0] <== bottom;
    corner_x[1] <== left + scale;
    corner_y[1] <== bottom;
    corner_x[2] <== left;
    corner_y[2] <== bottom + scale;
    corner_x[3] <== left + scale;
    corner_y[3] <== bottom + scale;
    for (var i = 0; i < 4; i++) {
        gradients[i] = GradientAt();
        gradients[i].x <== corner_x[i];
        gradients[i].y <== corner_y[i];
        gradients[i].scale <== scale;
        gradients[i].key <== key;
    }

    signal scale_squared;
    signal scale_cubed;
    signal exact_factor;
    scale_squared <== scale * scale;
    scale_cubed <== scale_squared * scale;
    exact_factor <-- DENOMINATOR / (1000 * scale_cubed);
    exact_factor * 1000 * scale_cubed === DENOMINATOR;

    signal dx[4];
    signal dy[4];
    signal abs_dx[4];
    signal abs_dy[4];
    signal dot_x[4];
    signal dot_y[4];
    signal dot_base[4];
    signal weight_base[4];
    signal weighted_dot[4];
    signal contribution[4];
    for (var j = 0; j < 4; j++) {
        if (j == 0 || j == 2) {
            dx[j] <== xr.remainder;
            abs_dx[j] <== xr.remainder;
        } else {
            dx[j] <== xr.remainder - scale;
            abs_dx[j] <== scale - xr.remainder;
        }
        if (j == 0 || j == 1) {
            dy[j] <== yr.remainder;
            abs_dy[j] <== yr.remainder;
        } else {
            dy[j] <== yr.remainder - scale;
            abs_dy[j] <== scale - yr.remainder;
        }
        dot_x[j] <== gradients[j].gradient_x * dx[j];
        dot_y[j] <== gradients[j].gradient_y * dy[j];
        dot_base[j] <== dot_x[j] + dot_y[j];
        weight_base[j] <== (scale - abs_dx[j]) * (scale - abs_dy[j]);
        weighted_dot[j] <== dot_base[j] * weight_base[j];
        contribution[j] <== weighted_dot[j] * exact_factor;
    }
    value <== contribution[0] + contribution[1] + contribution[2] + contribution[3];
}

template Round5PerlinV1() {
    var DENOMINATOR = 1125899906842624000;
    var SHIFT = 1152921504606846976000;
    var DIVISOR = 4503599627370496000;
    signal input x_magnitude;
    signal input x_sign;
    signal input y_magnitude;
    signal input y_sign;
    signal input key;
    signal input scale;
    signal input mirror_x;
    signal input mirror_y;
    signal output perlin;

    signal effective_x_sign;
    signal effective_y_sign;
    effective_x_sign <== x_sign * (1 - mirror_y);
    effective_y_sign <== y_sign * (1 - mirror_x);

    component octaves[3];
    for (var i = 0; i < 3; i++) {
        octaves[i] = Round5PerlinOctave();
        octaves[i].x_magnitude <== x_magnitude;
        octaves[i].x_sign <== effective_x_sign;
        octaves[i].y_magnitude <== y_magnitude;
        octaves[i].y_sign <== effective_y_sign;
        octaves[i].scale <== scale * (1 << i);
        octaves[i].key <== key;
    }

    signal weighted;
    signal shifted_dividend;
    signal quotient;
    signal remainder;
    weighted <== 2 * octaves[0].value + octaves[1].value + octaves[2].value;
    shifted_dividend <== weighted * 16 + SHIFT;
    remainder <-- shifted_dividend % DIVISOR;
    quotient <-- (shifted_dividend - remainder) / DIVISOR;
    shifted_dividend === quotient * DIVISOR + remainder;
    component quotientBits = Num2Bits(10);
    quotientBits.in <== quotient;
    component remainderBits = Num2Bits(63);
    remainderBits.in <== remainder;
    component remainderBound = LessThan(63);
    remainderBound.in[0] <== remainder;
    remainderBound.in[1] <== DIVISOR;
    remainderBound.out === 1;
    perlin <== quotient - 240;
    component perlinBits = Num2Bits(6);
    perlinBits.in <== perlin;
}
