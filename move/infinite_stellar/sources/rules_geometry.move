module infinite_stellar::rules_geometry;

use sui::poseidon;

const DOMAIN_FIELD: u256 =
    6053036279538949956273599243158082485469979069117808157047738621272655476926u256;
const SCHEMA_VERSION: u64 = 1;
const MINIMUM_WORLD_RADIUS: u64 = 12000;
const MAXIMUM_WORLD_RADIUS: u64 = 0xffffffff;
const MAXIMUM_PERLIN_SCALE: u64 = 16384;
const TWO_TO_252: u256 =
    7237005577332262213973186563042994240829374041602535252466099000494570602496u256;
const ROUND5_PLANET_HASH_THRESHOLD: u256 =
    1824020239319939601853867145438106257379030366701336195308183682214650707u256;

const EInvalidGeometry: u64 = 0;

public fun schema_version(): u64 { SCHEMA_VERSION }
public fun round5_planet_hash_threshold(): u256 { ROUND5_PLANET_HASH_THRESHOLD }

public fun commitment(
    world_radius: u64,
    planet_hash_threshold: u256,
    location_hash_key: u64,
    space_type_key: u64,
    perlin_scale: u64,
    perlin_mirror_x: bool,
    perlin_mirror_y: bool,
    home_perlin_min: u8,
    home_perlin_max: u8,
): u256 {
    assert!(world_radius >= MINIMUM_WORLD_RADIUS, EInvalidGeometry);
    assert!(world_radius <= MAXIMUM_WORLD_RADIUS, EInvalidGeometry);
    assert!(planet_hash_threshold > 0 && planet_hash_threshold < TWO_TO_252, EInvalidGeometry);
    assert!(perlin_scale > 0, EInvalidGeometry);
    assert!(perlin_scale <= MAXIMUM_PERLIN_SCALE, EInvalidGeometry);
    assert!(perlin_scale & (perlin_scale - 1) == 0, EInvalidGeometry);
    assert!(home_perlin_min < home_perlin_max, EInvalidGeometry);
    assert!(home_perlin_max <= 32, EInvalidGeometry);
    let mirror_x = if (perlin_mirror_x) 1u256 else 0u256;
    let mirror_y = if (perlin_mirror_y) 1u256 else 0u256;
    poseidon::poseidon_bn254(&vector[
        DOMAIN_FIELD,
        SCHEMA_VERSION as u256,
        world_radius as u256,
        planet_hash_threshold,
        location_hash_key as u256,
        space_type_key as u256,
        perlin_scale as u256,
        mirror_x,
        mirror_y,
        home_perlin_min as u256,
        home_perlin_max as u256,
    ])
}

public fun round5_commitment(world_radius: u64): u256 {
    commitment(
        world_radius,
        ROUND5_PLANET_HASH_THRESHOLD,
        115,
        116,
        16384,
        false,
        false,
        13,
        14,
    )
}
