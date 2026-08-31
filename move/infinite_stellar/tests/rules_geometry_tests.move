#[test_only]
module infinite_stellar::rules_geometry_tests;

use infinite_stellar::rules_geometry;

const ROUND5_GEOMETRY_COMMITMENT: u256 =
    18458232501308633390557626324462719473351388298275374257305522239595784888932u256;

#[test]
fun round5_geometry_matches_typescript_and_circom() {
    assert!(rules_geometry::round5_commitment(12000) == ROUND5_GEOMETRY_COMMITMENT);
}

#[test, expected_failure(abort_code = 0, location = infinite_stellar::rules_geometry)]
fun invalid_non_power_of_two_scale_is_rejected() {
    rules_geometry::commitment(
        12000,
        rules_geometry::round5_planet_hash_threshold(),
        115,
        116,
        12000,
        false,
        false,
        13,
        14,
    );
}
