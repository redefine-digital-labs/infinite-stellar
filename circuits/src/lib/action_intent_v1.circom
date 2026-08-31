pragma circom 2.2.3;

include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/poseidon.circom";

/// Recomputes the frozen Infinite Stellar proof-intent v1 commitment. All
/// context fields remain private, while the resulting commitment is public.
template ActionIntentV1(actionKind) {
    var PROOF_INTENT_DOMAIN_FIELD =
        13909138997969785233372616111572825994268025797777928597047068964955765571998;
    signal input network_field;
    signal input league;
    signal input season_id_low_128;
    signal input season_id_high_128;
    signal input seat_id_low_128;
    signal input seat_id_high_128;
    signal input sender_low_128;
    signal input sender_high_128;
    signal input source_location_hash;
    signal input destination_location_hash;
    signal input amount;
    signal input source_planet_nonce;
    signal input deadline_ms;
    signal input rules_geometry_commitment;
    signal output commitment;

    component leagueBits = Num2Bits(8);
    leagueBits.in <== league;

    component seasonLowBits = Num2Bits(128);
    component seasonHighBits = Num2Bits(128);
    component seatLowBits = Num2Bits(128);
    component seatHighBits = Num2Bits(128);
    component senderLowBits = Num2Bits(128);
    component senderHighBits = Num2Bits(128);
    seasonLowBits.in <== season_id_low_128;
    seasonHighBits.in <== season_id_high_128;
    seatLowBits.in <== seat_id_low_128;
    seatHighBits.in <== seat_id_high_128;
    senderLowBits.in <== sender_low_128;
    senderHighBits.in <== sender_high_128;

    component amountBits = Num2Bits(64);
    component nonceBits = Num2Bits(64);
    component deadlineBits = Num2Bits(64);
    amountBits.in <== amount;
    nonceBits.in <== source_planet_nonce;
    deadlineBits.in <== deadline_ms;

    component context = Poseidon(2);
    context.inputs[0] <== network_field;
    context.inputs[1] <== league;

    component action = Poseidon(16);
    action.inputs[0] <== PROOF_INTENT_DOMAIN_FIELD;
    action.inputs[1] <== 1;
    action.inputs[2] <== actionKind;
    action.inputs[3] <== context.out;
    action.inputs[4] <== season_id_low_128;
    action.inputs[5] <== season_id_high_128;
    action.inputs[6] <== seat_id_low_128;
    action.inputs[7] <== seat_id_high_128;
    action.inputs[8] <== sender_low_128;
    action.inputs[9] <== sender_high_128;
    action.inputs[10] <== source_location_hash;
    action.inputs[11] <== destination_location_hash;
    action.inputs[12] <== amount;
    action.inputs[13] <== source_planet_nonce;
    action.inputs[14] <== deadline_ms;
    action.inputs[15] <== rules_geometry_commitment;

    commitment <== action.out;
}
