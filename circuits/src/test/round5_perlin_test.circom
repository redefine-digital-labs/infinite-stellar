pragma circom 2.2.3;

include "../lib/round5_perlin.circom";
include "../lib/signed_coordinate.circom";

template Round5PerlinTest() {
    signal input x_magnitude;
    signal input x_sign;
    signal input y_magnitude;
    signal input y_sign;
    signal input key;
    signal input scale;
    signal input mirror_x;
    signal input mirror_y;
    signal output perlin;

    component x = SignedCoordinate(32);
    component y = SignedCoordinate(32);
    x.magnitude <== x_magnitude;
    x.sign <== x_sign;
    y.magnitude <== y_magnitude;
    y.sign <== y_sign;
    mirror_x * (mirror_x - 1) === 0;
    mirror_y * (mirror_y - 1) === 0;

    component relation = Round5PerlinV1();
    relation.x_magnitude <== x_magnitude;
    relation.x_sign <== x_sign;
    relation.y_magnitude <== y_magnitude;
    relation.y_sign <== y_sign;
    relation.key <== key;
    relation.scale <== scale;
    relation.mirror_x <== mirror_x;
    relation.mirror_y <== mirror_y;
    perlin <== relation.perlin;
}

component main = Round5PerlinTest();
