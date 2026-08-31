module infinite_stellar::bootstrap;

use infinite_stellar::identity;
use infinite_stellar::planet;
use infinite_stellar::season;

/// Creates the immutable season authority and the three bounded shared roots.
/// Soul enrollment and home claiming remain closed until their production
/// adapter/verifier modules are pinned.
public fun create_season(
    league: u8,
    enrollment_close_at_ms: u64,
    universe_open_at_ms: u64,
    home_claim_open_at_ms: u64,
    home_claim_close_at_ms: u64,
    season_end_at_ms: u64,
    seed_observation_delay_ms: u64,
    minimum_home_claim_window_ms: u64,
    max_home_availability_tick_gap_ms: u64,
    max_ranked_seats: u64,
    world_radius: u64,
    planet_hash_threshold: u256,
    location_hash_key: u64,
    space_type_key: u64,
    perlin_scale: u64,
    perlin_mirror_x: bool,
    perlin_mirror_y: bool,
    home_perlin_min: u8,
    home_perlin_max: u8,
    ctx: &mut TxContext,
): season::SeasonAdminCap {
    let (mut manifest, runtime, admin_cap) = season::new_season(
        league,
        enrollment_close_at_ms,
        universe_open_at_ms,
        home_claim_open_at_ms,
        home_claim_close_at_ms,
        season_end_at_ms,
        seed_observation_delay_ms,
        minimum_home_claim_window_ms,
        max_home_availability_tick_gap_ms,
        max_ranked_seats,
        world_radius,
        planet_hash_threshold,
        location_hash_key,
        space_type_key,
        perlin_scale,
        perlin_mirror_x,
        perlin_mirror_y,
        home_perlin_min,
        home_perlin_max,
        ctx,
    );
    let season_id = season::season_id(&manifest);
    let enrollment_registry = identity::new_registry(season_id, max_ranked_seats, ctx);
    let planet_registry = planet::new_registry(season_id, ctx);
    season::bind_registries(
        &mut manifest,
        object::id(&enrollment_registry),
        object::id(&planet_registry),
    );
    season::emit_season_created(&manifest, max_ranked_seats);
    season::share_season(manifest, runtime);
    identity::share_registry(enrollment_registry);
    planet::share_registry(planet_registry);
    admin_cap
}
