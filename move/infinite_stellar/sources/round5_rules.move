module infinite_stellar::round5_rules;

const RULESET_VERSION: u64 = 1;
const Q64: u128 = 18446744073709551616;
const LOG2_E_Q64: u128 = 26613026195688644983;

const PLANET_REGULAR: u8 = 0;
const PLANET_SILVER_MINE: u8 = 1;
const PLANET_RUINS: u8 = 2;
const PLANET_SPACETIME_RIP: u8 = 3;
const PLANET_SILVER_BANK: u8 = 4;

const SPACE_NEBULA: u8 = 0;
const SPACE_SPACE: u8 = 1;
const SPACE_DEEP: u8 = 2;
const SPACE_DEAD: u8 = 3;

const BRANCH_DEFENSE: u8 = 0;
const BRANCH_RANGE: u8 = 1;
const BRANCH_SPEED: u8 = 2;
const SPACE_JUNK_LIMIT: u64 = 2000;

const EInvalidLevel: u64 = 0;
const EInvalidSpaceType: u64 = 1;
const EInvalidPlanetType: u64 = 2;
const EInvalidBranch: u64 = 3;
const EInvalidDefense: u64 = 4;
const EInvalidScale: u64 = 5;
const EInvalidArtifact: u64 = 6;
const EInvalidLocation: u64 = 7;

/// The fixed, observable state derived when a Round-5 planet is initialized.
/// It deliberately contains no owner or hidden coordinate material.
public struct PlanetStats has copy, drop, store {
    level: u8,
    planet_type: u8,
    space_type: u8,
    energy: u64,
    energy_capacity: u64,
    energy_growth: u64,
    range: u64,
    speed: u64,
    defense: u64,
    silver: u64,
    silver_capacity: u64,
    silver_growth: u64,
    space_junk: u64,
}

public struct CombatResult has copy, drop, store {
    conquered: bool,
    energy: u64,
}

public fun ruleset_version(): u64 { RULESET_VERSION }

public fun planet_regular(): u8 { PLANET_REGULAR }
public fun planet_silver_mine(): u8 { PLANET_SILVER_MINE }
public fun planet_ruins(): u8 { PLANET_RUINS }
public fun planet_spacetime_rip(): u8 { PLANET_SPACETIME_RIP }
/// Compatibility alias for the pre-parity-correction local API.
public fun planet_trading_post(): u8 { PLANET_SPACETIME_RIP }
public fun planet_silver_bank(): u8 { PLANET_SILVER_BANK }

public fun space_nebula(): u8 { SPACE_NEBULA }
public fun space_space(): u8 { SPACE_SPACE }
public fun space_deep(): u8 { SPACE_DEEP }
public fun space_dead(): u8 { SPACE_DEAD }

public fun branch_defense(): u8 { BRANCH_DEFENSE }
public fun branch_range(): u8 { BRANCH_RANGE }
public fun branch_speed(): u8 { BRANCH_SPEED }
public fun space_junk_limit(): u64 { SPACE_JUNK_LIMIT }

public fun space_type_from_perlin(perlin: u64): u8 {
    if (perlin >= 19) {
        SPACE_DEAD
    } else if (perlin >= 15) {
        SPACE_DEEP
    } else if (perlin >= 14) {
        SPACE_SPACE
    } else {
        SPACE_NEBULA
    }
}

public fun level_from_selector(selector: u64, space_type: u8): u8 {
    assert_space_type(space_type);
    assert!(selector < 16777216, EInvalidLevel);
    let mut level = 9u8;
    while (level > 0 && selector >= level_threshold(level)) {
        level = level - 1;
    };
    if (space_type == SPACE_NEBULA && level > 4) {
        4
    } else if (space_type == SPACE_SPACE && level > 5) {
        5
    } else {
        level
    }
}

/// Selects a planet type using the exact descending-threshold construction.
public fun planet_type_from_byte(space_type: u8, level: u8, type_byte: u8): u8 {
    assert_space_type(space_type);
    assert_level(level);
    let weights = type_weights(space_type, level);
    let mut weight_sum = 0u64;
    let mut i = 0u64;
    while (i < 5) {
        weight_sum = weight_sum + *weights.borrow(i);
        i = i + 1;
    };
    let mut remaining = weight_sum;
    i = 0;
    while (i < 5) {
        remaining = remaining - *weights.borrow(i);
        let threshold = remaining * 256 / weight_sum;
        if ((type_byte as u64) >= threshold) {
            return i as u8
        };
        i = i + 1;
    };
    PLANET_REGULAR
}

/// Bonus flags correspond to location bytes 9 through 13 being below 16.
public fun initialize_planet_stats(
    level: u8,
    planet_type: u8,
    space_type: u8,
    capacity_bonus: bool,
    growth_bonus: bool,
    range_bonus: bool,
    speed_bonus: bool,
    defense_bonus: bool,
    half_junk: bool,
): PlanetStats {
    assert_level(level);
    assert_planet_type(planet_type);
    assert_space_type(space_type);
    let (
        mut energy_capacity,
        mut energy_growth,
        mut range,
        mut speed,
        mut defense,
        base_silver_growth,
        mut silver_capacity,
        barbarian_percentage,
    ) = defaults(level);
    let mut silver_growth = if (planet_type == PLANET_SILVER_MINE) {
        base_silver_growth
    } else {
        0
    };

    if (capacity_bonus) energy_capacity = energy_capacity * 2;
    if (growth_bonus) energy_growth = energy_growth * 2;
    if (range_bonus) range = range * 2;
    if (speed_bonus) speed = speed * 2;
    if (defense_bonus) defense = defense * 2;

    if (space_type == SPACE_DEAD) {
        range = range * 2;
        speed = speed * 2;
        energy_capacity = energy_capacity * 2;
        energy_growth = energy_growth * 2;
        silver_capacity = silver_capacity * 2;
        silver_growth = silver_growth * 2;
        defense = defense * 3 / 20;
    } else if (space_type == SPACE_DEEP) {
        range = range * 3 / 2;
        speed = speed * 3 / 2;
        energy_capacity = energy_capacity * 3 / 2;
        energy_growth = energy_growth * 3 / 2;
        silver_capacity = silver_capacity * 3 / 2;
        silver_growth = silver_growth * 3 / 2;
        defense = defense / 4;
    } else if (space_type == SPACE_SPACE) {
        range = range * 5 / 4;
        speed = speed * 5 / 4;
        energy_capacity = energy_capacity * 5 / 4;
        energy_growth = energy_growth * 5 / 4;
        silver_capacity = silver_capacity * 5 / 4;
        silver_growth = silver_growth * 5 / 4;
        defense = defense / 2;
    };

    if (planet_type == PLANET_SILVER_MINE) {
        silver_capacity = silver_capacity * 2;
        defense = defense / 2;
    } else if (planet_type == PLANET_SILVER_BANK) {
        speed = speed / 2;
        silver_capacity = silver_capacity * 10;
        energy_growth = 0;
        energy_capacity = energy_capacity * 5;
    } else if (planet_type == PLANET_SPACETIME_RIP) {
        defense = defense / 2;
        silver_capacity = silver_capacity * 2;
    };

    let mut energy = energy_capacity * barbarian_percentage / 100;
    if (space_type == SPACE_DEAD) {
        energy = energy * 20;
    } else if (space_type == SPACE_DEEP) {
        energy = energy * 10;
    } else if (space_type == SPACE_SPACE) {
        energy = energy * 4;
    };
    if (planet_type == PLANET_SILVER_BANK) energy = energy / 2;
    let silver = if (planet_type == PLANET_SILVER_MINE) {
        silver_capacity / 2
    } else {
        0
    };
    let mut space_junk = level_junk(level);
    if (half_junk) space_junk = space_junk / 2;

    PlanetStats {
        level,
        planet_type,
        space_type,
        energy,
        energy_capacity,
        energy_growth,
        range,
        speed,
        defense,
        silver,
        silver_capacity,
        silver_growth,
        space_junk,
    }
}

public fun initialize_home_stats(): PlanetStats {
    let mut stats = initialize_planet_stats(
        0,
        PLANET_REGULAR,
        SPACE_NEBULA,
        false,
        false,
        false,
        false,
        false,
        false,
    );
    stats.energy = 50000;
    stats.space_junk = 0;
    stats
}

/// Reconstructs every public default from the canonical 32-byte MiMC location
/// identifier and the verified space-type Perlin output. Bytes use the same
/// big-endian positions as the v0.6 Round 5 reference implementation.
public fun initialize_planet_from_location(
    location_id: &vector<u8>,
    space_perlin: u64,
): PlanetStats {
    assert!(location_id.length() == 32, EInvalidLocation);
    assert!(space_perlin <= 32, EInvalidLocation);
    let selector =
        (*location_id.borrow(4) as u64) * 65536 +
        (*location_id.borrow(5) as u64) * 256 +
        (*location_id.borrow(6) as u64);
    let space_type = space_type_from_perlin(space_perlin);
    let level = level_from_selector(selector, space_type);
    let planet_type = planet_type_from_byte(space_type, level, *location_id.borrow(8));
    initialize_planet_stats(
        level,
        planet_type,
        space_type,
        *location_id.borrow(9) < 16,
        *location_id.borrow(10) < 16,
        *location_id.borrow(11) < 16,
        *location_id.borrow(12) < 16,
        *location_id.borrow(13) < 16,
        *location_id.borrow(14) < 16,
    )
}

public fun travel_time_seconds(effective_distance_times_hundred: u64, speed: u64): u64 {
    assert!(speed > 0, EInvalidScale);
    let travel_time = effective_distance_times_hundred / speed;
    if (travel_time == 0) 1 else travel_time
}

public fun abandoning_range(range: u64): u64 {
    ((range as u128) * 150 / 100) as u64
}

public fun abandoning_speed(speed: u64): u64 {
    ((speed as u128) * 150 / 100) as u64
}

/// Contract-compatible 64.64 binary decay used by a normal voyage.
public fun decayed_arrival_energy(
    sent_energy: u64,
    effective_distance_times_hundred: u64,
    range: u64,
    origin_capacity: u64,
): u64 {
    assert!(range > 0, EInvalidScale);
    if (sent_energy == 0) return 0;
    let exponent_q64_u256 =
        ((effective_distance_times_hundred as u256) << 64) /
        (((range as u256) * 100));
    if (exponent_q64_u256 >= ((64u256) << 64)) return 0;
    let scale_q64 = exp2_positive_q64(exponent_q64_u256 as u128);
    let before_debuff_q64 =
        (((sent_energy as u256) << 128) / (scale_q64 as u256));
    let flat_debuff_q64 = ((origin_capacity as u256) << 64) / 20;
    if (before_debuff_q64 <= flat_debuff_q64) {
        0
    } else {
        ((before_debuff_q64 - flat_debuff_q64) >> 64) as u64
    }
}

/// Lazy logistic refresh with the same 64.64 operation order as the reference.
public fun refreshed_energy(
    owned: bool,
    current: u64,
    capacity: u64,
    growth_per_second: u64,
    elapsed_seconds: u64,
    pausers: u64,
    is_silver_bank: bool,
): u64 {
    assert!(capacity > 0, EInvalidScale);
    if (!owned || elapsed_seconds == 0 || current == 0) return current;
    if (growth_per_second == 0) {
        return if ((is_silver_bank || pausers > 0) && current > capacity) capacity else current
    };
    let natural_exponent_q64 =
        (((growth_per_second as u256) * (elapsed_seconds as u256) * 4) << 64) /
        (capacity as u256);
    let binary_exponent_q64 =
        natural_exponent_q64 * (LOG2_E_Q64 as u256) >> 64;
    let exp_negative_q64 = if (binary_exponent_q64 >= ((64u256) << 64)) {
        0u128
    } else {
        let positive = exp2_positive_q64(binary_exponent_q64 as u128);
        (((1u256) << 128) / (positive as u256)) as u128
    };
    let capacity_over_current_q64 =
        (((capacity as u256) << 64) / (current as u256)) as u128;
    let denominator_q64 = if (current <= capacity) {
        let ratio_q64 = capacity_over_current_q64 - Q64;
        Q64 + mul_q64(exp_negative_q64, ratio_q64)
    } else {
        let ratio_q64 = Q64 - capacity_over_current_q64;
        Q64 - mul_q64_ceil(exp_negative_q64, ratio_q64)
    };
    let refreshed_q64 =
        (((capacity as u256) << 128) / (denominator_q64 as u256));
    let refreshed = (refreshed_q64 >> 64) as u64;
    if (pausers > 0 && refreshed > current) {
        current
    } else if ((is_silver_bank || pausers > 0) && refreshed > capacity) {
        capacity
    } else {
        refreshed
    }
}

/// Applies the original hostile-arrival integer order. A caller handles the
/// friendly-owner and Wormhole no-energy cases before calling this function.
public fun resolve_hostile_combat(
    defender_energy: u64,
    defender_defense: u64,
    arriving_energy: u64,
): CombatResult {
    assert!(defender_defense > 0, EInvalidDefense);
    let absorbed = mul_div(arriving_energy, 100, defender_defense);
    if (defender_energy > absorbed) {
        CombatResult {
            conquered: false,
            energy: defender_energy - absorbed,
        }
    } else {
        let defender_cost = mul_div(defender_energy, defender_defense, 100);
        let remaining = arriving_energy - defender_cost;
        CombatResult {
            conquered: true,
            energy: if (remaining == 0) 1 else remaining,
        }
    }
}

public fun capped_silver_after_arrival(current: u64, arriving: u64, capacity: u64): u64 {
    let total = (current as u128) + (arriving as u128);
    if (total > (capacity as u128)) capacity else total as u64
}

public fun silver_after_growth(
    owned: bool,
    is_silver_mine: bool,
    current: u64,
    growth_per_second: u64,
    elapsed_seconds: u64,
    capacity: u64,
): u64 {
    if (!owned || !is_silver_mine || current >= capacity) return current;
    capped_silver_after_arrival(
        current,
        mul_saturating_to_u64(growth_per_second, elapsed_seconds),
        capacity,
    )
}

public fun upgrade_cost(silver_capacity: u64, total_upgrade_level: u8): u64 {
    mul_div(silver_capacity, 20 * ((total_upgrade_level as u64) + 1), 100)
}

public fun max_total_upgrade_level(space_type: u8): u8 {
    assert_space_type(space_type);
    if (space_type == SPACE_NEBULA) 3
    else if (space_type == SPACE_SPACE) 4
    else 5
}

public fun apply_upgrade(stats: &mut PlanetStats, branch: u8) {
    assert!(branch <= BRANCH_SPEED, EInvalidBranch);
    let (energy_capacity, energy_growth, defense, range, speed) = upgraded_values(
        stats.energy_capacity,
        stats.energy_growth,
        stats.defense,
        stats.range,
        stats.speed,
        branch,
    );
    stats.energy_capacity = energy_capacity;
    stats.energy_growth = energy_growth;
    stats.defense = defense;
    stats.range = range;
    stats.speed = speed;
}

public fun upgraded_values(
    energy_capacity: u64,
    energy_growth: u64,
    defense: u64,
    range: u64,
    speed: u64,
    branch: u8,
): (u64, u64, u64, u64, u64) {
    assert!(branch <= BRANCH_SPEED, EInvalidBranch);
    (
        mul_div(energy_capacity, 120, 100),
        mul_div(energy_growth, 120, 100),
        if (branch == BRANCH_DEFENSE) mul_div(defense, 120, 100) else defense,
        if (branch == BRANCH_RANGE) mul_div(range, 125, 100) else range,
        if (branch == BRANCH_SPEED) mul_div(speed, 175, 100) else speed,
    )
}

public fun artifact_type_and_bonus(last_byte_mod_255: u8, second_last_mod_255: u8): (u8, u8) {
    let artifact_type = if (last_byte_mod_255 < 39) 1
    else if (last_byte_mod_255 < 78) 2
    else if (last_byte_mod_255 < 156) 4
    else if (last_byte_mod_255 < 171) 5
    else if (last_byte_mod_255 < 186) 6
    else if (last_byte_mod_255 < 201) 7
    else if (last_byte_mod_255 < 216) 8
    else if (last_byte_mod_255 < 231) 9
    else 7;
    let bonus = if (second_last_mod_255 < 4) 2
    else if (second_last_mod_255 < 16) 1
    else 0;
    (artifact_type, bonus)
}

public fun artifact_rarity_from_level(level_with_bonus: u8): u8 {
    if (level_with_bonus <= 1) 1
    else if (level_with_bonus <= 3) 2
    else if (level_with_bonus <= 5) 3
    else if (level_with_bonus <= 7) 4
    else 5
}

public fun capture_energy_eligible(energy: u64, capacity: u64): bool {
    (energy as u128) * 100 >= ((capacity as u128) * 100) / 78
}

public fun capture_score(level: u8): u64 {
    assert_level(level);
    if (level < 2) 0
    else if (level == 2) 250000
    else if (level == 3) 500000
    else if (level == 4) 750000
    else if (level == 5) 1000000
    else if (level == 6) 10000000
    else if (level == 7) 20000000
    else if (level == 8) 50000000
    else 100000000
}

public fun silver_withdrawal_score(silver: u64): u64 {
    (silver / 1000) * 10 / 100
}

public fun level_junk(level: u8): u64 {
    assert_level(level);
    20 + (level as u64) * 5
}

public fun silver_mine_growth(level: u8, space_type: u8): u64 {
    assert_level(level);
    assert_space_type(space_type);
    let (_, _, _, _, _, base, _, _) = defaults(level);
    if (space_type == SPACE_SPACE) base * 5 / 4
    else if (space_type == SPACE_DEEP) base * 3 / 2
    else if (space_type == SPACE_DEAD) base * 2
    else base
}

/// Returns population-cap, population-growth, range, speed, and defense
/// multipliers in integer percent, preserving the original artifact order.
public fun artifact_upgrade(
    artifact_type: u8,
    rarity: u8,
    biome: u8,
): (u64, u64, u64, u64, u64) {
    assert!(artifact_type >= 1 && artifact_type <= 9, EInvalidArtifact);
    assert!(rarity >= 1 && rarity <= 5, EInvalidArtifact);
    assert!(biome <= 10, EInvalidArtifact);
    if (artifact_type == 6) {
        let defense = if (rarity == 1) 150
        else if (rarity == 2) 200
        else if (rarity == 3) 300
        else if (rarity == 4) 450
        else 650;
        return (100, 100, 20, 20, defense)
    };
    if (artifact_type == 7) {
        let defense = if (rarity == 1) 50
        else if (rarity == 2) 40
        else if (rarity == 3) 30
        else if (rarity == 4) 20
        else 10;
        return (100, 100, 100, 100, defense)
    };
    if (artifact_type >= 5) return (100, 100, 100, 100, 100);

    let mut capacity = 100u64;
    let mut growth = 100u64;
    let mut range = 100u64;
    let mut speed = 100u64;
    let mut defense = 100u64;
    if (artifact_type == 1) {
        capacity = capacity + 5;
        growth = growth + 5;
    } else if (artifact_type == 2) {
        speed = speed + 5;
    } else if (artifact_type == 3) {
        range = range + 5;
    } else {
        defense = defense + 5;
    };
    if (biome == 1) {
        speed = speed + 5;
        defense = defense + 5;
    } else if (biome == 2) {
        defense = defense + 5;
        capacity = capacity + 5;
        growth = growth + 5;
    } else if (biome == 3) {
        capacity = capacity + 5;
        growth = growth + 5;
        range = range + 5;
    } else if (biome == 4) {
        defense = defense + 5;
        range = range + 5;
    } else if (biome == 5) {
        speed = speed + 5;
        range = range + 5;
    } else if (biome == 6) {
        speed = speed + 10;
    } else if (biome == 7) {
        range = range + 10;
    } else if (biome == 8) {
        defense = defense + 10;
    } else if (biome == 9) {
        capacity = capacity + 10;
        growth = growth + 10;
    } else if (biome == 10) {
        range = range + 5;
        speed = speed + 5;
        capacity = capacity + 5;
        growth = growth + 5;
    };
    let scale = 1 + (rarity as u64) / 2;
    (
        scale * capacity - (scale - 1) * 100,
        scale * growth - (scale - 1) * 100,
        scale * range - (scale - 1) * 100,
        scale * speed - (scale - 1) * 100,
        scale * defense - (scale - 1) * 100,
    )
}

public fun artifact_cooldown_seconds(artifact_type: u8): u64 {
    assert!(artifact_type >= 1 && artifact_type <= 9, EInvalidArtifact);
    if (artifact_type == 5 || artifact_type == 6) 14400
    else if (artifact_type >= 7) 86400
    else 0
}

public fun wormhole_distance_divisor(rarity: u8): u64 {
    assert!(rarity >= 1 && rarity <= 5, EInvalidArtifact);
    1u64 << rarity
}

public fun photoid_range_multiplier(rarity: u8): u64 {
    assert!(rarity >= 1 && rarity <= 5, EInvalidArtifact);
    200
}

public fun photoid_speed_multiplier(rarity: u8): u64 {
    assert!(rarity >= 1 && rarity <= 5, EInvalidArtifact);
    (rarity as u64) * 500
}

public fun artifact_score(rarity: u8): u64 {
    assert!(rarity >= 1 && rarity <= 5, EInvalidArtifact);
    if (rarity == 1) 100000
    else if (rarity == 2) 200000
    else if (rarity == 3) 500000
    else if (rarity == 4) 20000000
    else 50000000
}

public fun stats_level(stats: &PlanetStats): u8 { stats.level }
public fun stats_planet_type(stats: &PlanetStats): u8 { stats.planet_type }
public fun stats_space_type(stats: &PlanetStats): u8 { stats.space_type }
public fun stats_energy(stats: &PlanetStats): u64 { stats.energy }
public fun stats_energy_capacity(stats: &PlanetStats): u64 { stats.energy_capacity }
public fun stats_energy_growth(stats: &PlanetStats): u64 { stats.energy_growth }
public fun stats_range(stats: &PlanetStats): u64 { stats.range }
public fun stats_speed(stats: &PlanetStats): u64 { stats.speed }
public fun stats_defense(stats: &PlanetStats): u64 { stats.defense }
public fun stats_silver(stats: &PlanetStats): u64 { stats.silver }
public fun stats_silver_capacity(stats: &PlanetStats): u64 { stats.silver_capacity }
public fun stats_silver_growth(stats: &PlanetStats): u64 { stats.silver_growth }
public fun stats_space_junk(stats: &PlanetStats): u64 { stats.space_junk }
public fun combat_conquered(result: &CombatResult): bool { result.conquered }
public fun combat_energy(result: &CombatResult): u64 { result.energy }

fun level_threshold(level: u8): u64 {
    if (level == 0) 16777216
    else if (level == 1) 4194292
    else if (level == 2) 1048561
    else if (level == 3) 262128
    else if (level == 4) 65520
    else if (level == 5) 16368
    else if (level == 6) 4080
    else if (level == 7) 1008
    else if (level == 8) 240
    else if (level == 9) 48
    else abort EInvalidLevel
}

fun defaults(level: u8): (u64, u64, u64, u64, u64, u64, u64, u64) {
    if (level == 0) (100000, 417, 99, 75, 400, 0, 0, 0)
    else if (level == 1) (400000, 833, 177, 75, 400, 56, 100000, 1)
    else if (level == 2) (1600000, 1250, 315, 75, 300, 167, 500000, 2)
    else if (level == 3) (6000000, 1667, 591, 75, 300, 417, 2500000, 3)
    else if (level == 4) (25000000, 2083, 1025, 75, 300, 833, 12000000, 4)
    else if (level == 5) (100000000, 2500, 1734, 75, 200, 1667, 50000000, 5)
    else if (level == 6) (300000000, 2917, 2838, 75, 200, 2778, 100000000, 7)
    else if (level == 7) (500000000, 3333, 4414, 75, 200, 2778, 200000000, 10)
    else if (level == 8) (700000000, 3750, 6306, 75, 200, 2778, 300000000, 20)
    else if (level == 9) (800000000, 4167, 8829, 75, 200, 2778, 400000000, 25)
    else abort EInvalidLevel
}

fun type_weights(space_type: u8, level: u8): vector<u64> {
    if (space_type == SPACE_NEBULA) {
        if (level == 0) vector[1, 0, 0, 0, 0]
        else if (level <= 2) vector[13, 2, 0, 1, 0]
        else vector[13, 2, 0, 0, 1]
    } else if (space_type == SPACE_SPACE) {
        if (level == 0) vector[1, 0, 0, 0, 0]
        else if (level == 1) vector[13, 2, 1, 0, 0]
        else if (level == 2) vector[12, 2, 1, 1, 0]
        else if (level == 3) vector[11, 2, 1, 1, 1]
        else vector[12, 2, 1, 0, 1]
    } else if (space_type == SPACE_DEEP) {
        if (level == 0) vector[1, 0, 0, 0, 0]
        else if (level == 1) vector[10, 4, 2, 0, 0]
        else if (level == 2) vector[10, 4, 1, 1, 0]
        else vector[8, 4, 1, 2, 1]
    } else if (space_type == SPACE_DEAD) {
        if (level == 0) vector[1, 0, 0, 0, 0]
        else if (level <= 2) vector[11, 4, 1, 0, 0]
        else vector[7, 4, 2, 2, 1]
    } else {
        abort EInvalidSpaceType
    }
}

fun assert_level(level: u8) {
    assert!(level <= 9, EInvalidLevel);
}

fun assert_space_type(space_type: u8) {
    assert!(space_type <= SPACE_DEAD, EInvalidSpaceType);
}

fun assert_planet_type(planet_type: u8) {
    assert!(planet_type <= PLANET_SILVER_BANK, EInvalidPlanetType);
}

fun mul_div(value: u64, multiplier: u64, divisor: u64): u64 {
    assert!(divisor > 0, EInvalidScale);
    (((value as u128) * (multiplier as u128)) / (divisor as u128)) as u64
}

fun mul_saturating_to_u64(left: u64, right: u64): u64 {
    let product = (left as u128) * (right as u128);
    if (product > 0xffffffffffffffff) 0xffffffffffffffff else product as u64
}

fun mul_q64(left: u128, right: u128): u128 {
    (((left as u256) * (right as u256)) >> 64) as u128
}

fun mul_q64_ceil(left: u128, right: u128): u128 {
    let product = (left as u256) * (right as u256);
    ((product + ((Q64 as u256) - 1)) >> 64) as u128
}

fun exp2_positive_q64(exponent_q64: u128): u128 {
    assert!(exponent_q64 < (64u128 << 64), EInvalidScale);
    let integer_part = (exponent_q64 >> 64) as u8;
    let fraction = exponent_q64 & (Q64 - 1);
    let multipliers = exp2_fraction_multipliers();
    let mut result = Q64;
    let mut index = 0u64;
    while (index < 64) {
        let bit = 1u128 << (63 - (index as u8));
        if ((fraction & bit) != 0) {
            result = mul_q64(result, *multipliers.borrow(index));
        };
        index = index + 1;
    };
    result << integer_part
}

/// floor(2^(2^-i) * 2^64), independently generated from the mathematical
/// definition for i=1..64. Keeping this table local makes rounding auditable.
fun exp2_fraction_multipliers(): vector<u128> {
    vector[
        26087635650665564424, 21936999301089678046, 20116317054877281741,
        19263451207323153961, 18850675170876015534, 18647615946650685158,
        18546908069882975960, 18496758270674070881, 18471734244850835105,
        18459234930309000272, 18452988445124272033, 18449865995240371898,
        18448304968436414829, 18447524504564044945, 18447134285009651015,
        18446939178327825412, 18446841625760745902, 18446792849670663276,
        18446768461673986097, 18446756267687738521, 18446750170697637485,
        18446747122203342655, 18446745597956384161, 18446744835832952145,
        18446744454771247944, 18446744264240398796, 18446744168974974960,
        18446744121342263226, 18446744097525907405, 18446744085617729507,
        18446744079663640560, 18446744076686596088, 18446744075198073851,
        18446744074453812733, 18446744074081682174, 18446744073895616895,
        18446744073802584255, 18446744073756067935, 18446744073732809775,
        18446744073721180695, 18446744073715366155, 18446744073712458885,
        18446744073711005250, 18446744073710278433, 18446744073709915024,
        18446744073709733320, 18446744073709642468, 18446744073709597042,
        18446744073709574329, 18446744073709562972, 18446744073709557294,
        18446744073709554455, 18446744073709553035, 18446744073709552325,
        18446744073709551970, 18446744073709551793, 18446744073709551704,
        18446744073709551660, 18446744073709551638, 18446744073709551627,
        18446744073709551621, 18446744073709551618, 18446744073709551617,
        18446744073709551616,
    ]
}
