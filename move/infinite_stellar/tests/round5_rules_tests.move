#[test_only]
module infinite_stellar::round5_rules_tests;

use infinite_stellar::round5_rules as rules;

#[test]
fun space_and_level_boundaries_match_round5() {
    assert!(rules::space_type_from_perlin(13) == rules::space_nebula());
    assert!(rules::space_type_from_perlin(14) == rules::space_space());
    assert!(rules::space_type_from_perlin(15) == rules::space_deep());
    assert!(rules::space_type_from_perlin(19) == rules::space_dead());
    assert!(rules::level_from_selector(0, rules::space_dead()) == 9);
    assert!(rules::level_from_selector(47, rules::space_dead()) == 9);
    assert!(rules::level_from_selector(48, rules::space_dead()) == 8);
    assert!(rules::level_from_selector(0, rules::space_nebula()) == 4);
    assert!(rules::level_from_selector(0, rules::space_space()) == 5);
    assert!(rules::level_from_selector(16777215, rules::space_dead()) == 0);
}

#[test]
fun type_selection_uses_descending_weight_thresholds() {
    assert!(rules::planet_type_from_byte(rules::space_nebula(), 0, 0) == rules::planet_regular());
    assert!(rules::planet_type_from_byte(rules::space_space(), 3, 255) == rules::planet_regular());
    assert!(rules::planet_type_from_byte(rules::space_space(), 3, 0) == rules::planet_silver_bank());
    assert!(rules::planet_type_from_byte(rules::space_deep(), 3, 16) == rules::planet_spacetime_rip());
    assert!(rules::planet_spacetime_rip() == rules::planet_trading_post());
}

#[test]
fun canonical_default_and_home_stats_match() {
    let regular = rules::initialize_planet_stats(
        1,
        rules::planet_regular(),
        rules::space_nebula(),
        false,
        false,
        false,
        false,
        false,
        false,
    );
    assert!(rules::stats_energy_capacity(&regular) == 400000);
    assert!(rules::stats_energy(&regular) == 4000);
    assert!(rules::stats_silver(&regular) == 0);
    assert!(rules::stats_space_junk(&regular) == 25);

    let home = rules::initialize_home_stats();
    assert!(rules::stats_energy(&home) == 50000);
    assert!(rules::stats_energy_capacity(&home) == 100000);
    assert!(rules::stats_space_junk(&home) == 0);
}

#[test]
fun location_bytes_drive_level_type_bonuses_and_junk() {
    let mut location = vector[];
    32u64.do!(|_| location.push_back(255));
    *location.borrow_mut(4) = 0;
    *location.borrow_mut(5) = 0;
    *location.borrow_mut(6) = 0;
    *location.borrow_mut(8) = 255;
    *location.borrow_mut(9) = 0;
    *location.borrow_mut(14) = 0;
    let stats = rules::initialize_planet_from_location(&location, 19);
    assert!(rules::stats_level(&stats) == 9);
    assert!(rules::stats_planet_type(&stats) == rules::planet_regular());
    assert!(rules::stats_space_type(&stats) == rules::space_dead());
    assert!(rules::stats_energy_capacity(&stats) == 3200000000);
    assert!(rules::stats_space_junk(&stats) == 32);
}

#[test]
fun bonuses_space_and_silver_mine_apply_in_reference_order() {
    let stats = rules::initialize_planet_stats(
        2,
        rules::planet_silver_mine(),
        rules::space_dead(),
        true,
        true,
        true,
        true,
        true,
        true,
    );
    assert!(rules::stats_energy_capacity(&stats) == 6400000);
    assert!(rules::stats_energy_growth(&stats) == 5000);
    assert!(rules::stats_range(&stats) == 1260);
    assert!(rules::stats_speed(&stats) == 300);
    assert!(rules::stats_defense(&stats) == 45);
    assert!(rules::stats_silver_capacity(&stats) == 2000000);
    assert!(rules::stats_silver(&stats) == 1000000);
    assert!(rules::stats_silver_growth(&stats) == 334);
    assert!(rules::stats_space_junk(&stats) == 15);
}

#[test]
fun hostile_combat_preserves_rounding_and_exact_zero_rule() {
    let defended = rules::resolve_hostile_combat(101, 200, 100);
    assert!(!rules::combat_conquered(&defended));
    assert!(rules::combat_energy(&defended) == 51);

    let conquered = rules::resolve_hostile_combat(50, 200, 100);
    assert!(rules::combat_conquered(&conquered));
    assert!(rules::combat_energy(&conquered) == 1);
}

#[test]
fun silver_travel_upgrade_and_score_boundaries_match() {
    assert!(rules::travel_time_seconds(0, 75) == 1);
    assert!(rules::travel_time_seconds(750, 75) == 10);
    assert!(rules::capped_silver_after_arrival(90, 20, 100) == 100);
    assert!(rules::silver_after_growth(true, true, 10, 3, 20, 100) == 70);
    assert!(rules::silver_after_growth(false, true, 10, 3, 20, 100) == 10);
    assert!(rules::upgrade_cost(100000, 0) == 20000);
    assert!(rules::upgrade_cost(100000, 2) == 60000);
    assert!(rules::silver_withdrawal_score(9999) == 0);
    assert!(rules::silver_withdrawal_score(10000) == 1);
}

#[test]
fun fixed_point_voyage_decay_matches_reference_boundaries() {
    assert!(rules::decayed_arrival_energy(80000, 0, 99, 100000) == 75000);
    assert!(rules::decayed_arrival_energy(80000, 9900, 99, 100000) == 35000);
    assert!(rules::decayed_arrival_energy(5000, 0, 99, 100000) == 0);
}

#[test]
fun fixed_point_logistic_refresh_grows_decays_and_respects_titan() {
    let grown = rules::refreshed_energy(true, 50000, 100000, 417, 60, 0, false);
    assert!(grown > 50000 && grown < 100000);
    let decayed = rules::refreshed_energy(true, 150000, 100000, 417, 60, 0, false);
    assert!(decayed < 150000 && decayed > 100000);
    assert!(rules::refreshed_energy(true, 50000, 100000, 417, 60, 1, false) == 50000);
    assert!(rules::refreshed_energy(true, 150000, 100000, 417, 60, 1, false) == 100000);
    assert!(rules::refreshed_energy(true, 50000, 100000, 417, 1000000, 0, false) == 100000);
}

#[test]
fun upgrade_mutates_only_the_specialized_stat() {
    let mut stats = rules::initialize_planet_stats(
        1,
        rules::planet_regular(),
        rules::space_nebula(),
        false,
        false,
        false,
        false,
        false,
        false,
    );
    rules::apply_upgrade(&mut stats, rules::branch_speed());
    assert!(rules::stats_energy_capacity(&stats) == 480000);
    assert!(rules::stats_energy_growth(&stats) == 999);
    assert!(rules::stats_speed(&stats) == 131);
    assert!(rules::stats_range(&stats) == 177);
    assert!(rules::stats_defense(&stats) == 400);
}

#[test]
fun artifact_quirk_capture_and_junk_are_locked() {
    let (type_a, bonus_a) = rules::artifact_type_and_bonus(230, 3);
    assert!(type_a == 9 && bonus_a == 2);
    let (type_b, bonus_b) = rules::artifact_type_and_bonus(231, 16);
    assert!(type_b == 7 && bonus_b == 0);
    assert!(rules::artifact_rarity_from_level(7) == 4);
    assert!(rules::artifact_rarity_from_level(8) == 5);
    assert!(!rules::capture_energy_eligible(12, 1000));
    assert!(rules::capture_energy_eligible(13, 1000));
    assert!(rules::capture_score(9) == 100000000);
    assert!(rules::level_junk(9) == 65);
}
