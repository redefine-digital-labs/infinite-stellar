module infinite_stellar::artifact;

use infinite_stellar::identity::{Self as identity, CivilizationState, SeasonSeat};
use infinite_stellar::identity::ScoreCard;
use infinite_stellar::planet::{Self as planet, Planet};
use infinite_stellar::round5_rules as rules;
use infinite_stellar::season::{Self as season, SeasonManifest, SeasonRuntime};
use sui::clock::{Self as clock, Clock};
use sui::event;

const TYPE_SHIP_MOTHERSHIP: u8 = 10;
const TYPE_SHIP_CRESCENT: u8 = 11;
const TYPE_SHIP_WHALE: u8 = 12;
const TYPE_SHIP_GEAR: u8 = 13;
const TYPE_SHIP_TITAN: u8 = 14;

const TYPE_MONOLITH: u8 = 1;
const TYPE_COLOSSUS: u8 = 2;
const TYPE_SPACESHIP: u8 = 3;
const TYPE_PYRAMID: u8 = 4;
const TYPE_WORMHOLE: u8 = 5;
const TYPE_PLANETARY_SHIELD: u8 = 6;
const TYPE_PHOTOID_CANNON: u8 = 7;
const TYPE_BLOOM_FILTER: u8 = 8;
const TYPE_BLACK_DOMAIN: u8 = 9;

const LOCATION_EXTERNAL: u8 = 0;
const LOCATION_PLANET: u8 = 1;
const LOCATION_VOYAGE: u8 = 2;
const LOCATION_BURNED: u8 = 3;
const INTERFACE_VERSION: u64 = 1;
const PHOTOID_ACTIVATION_DELAY: u64 = 10800;

const ENotShip: u64 = 0;
const EArtifactLocationMismatch: u64 = 1;
const ENotShipController: u64 = 2;
const EInvalidActivation: u64 = 3;
const ESeasonMismatch: u64 = 4;
const EProductionAdapterUnavailable: u64 = 5;
const EInvalidAttestation: u64 = 6;
const EIntentMismatch: u64 = 7;
const EArtifactCooldown: u64 = 8;
const ENotArtifactController: u64 = 9;
const ESpacetimeRipRequired: u64 = 10;

/// Shared in-universe artifact state. External custody is represented by the
/// same identity with `LOCATION_EXTERNAL`; ships may never enter that state.
public struct Artifact has key {
    id: UID,
    season_id: ID,
    planet_discovered_on: ID,
    rarity: u8,
    biome: u8,
    minted_at_seconds: u64,
    discoverer: address,
    artifact_type: u8,
    activations: u64,
    last_activated_at_seconds: u64,
    last_deactivated_at_seconds: u64,
    wormhole_to: Option<ID>,
    controller: address,
    external_owner: Option<address>,
    location_kind: u8,
    location_id: ID,
    burned: bool,
}

/// Output of the future checkpoint/entropy adapter. It binds the Sui
/// checkpoint analogue of Round 5's prospect-block hash to one planet.
public struct VerifiedArtifactEntropy has drop {
    interface_version: u64,
    season_id: ID,
    planet_id: ID,
    prospected_checkpoint: u64,
    current_checkpoint: u64,
    biome: u8,
    last_byte_mod_255: u8,
    second_last_mod_255: u8,
    attestation_digest: vector<u8>,
}

public struct VerifiedArtifactCheckpoint has drop {
    interface_version: u64,
    season_id: ID,
    current_checkpoint: u64,
    attestation_digest: vector<u8>,
}

public struct StartingShipsClaimed has copy, drop {
    season_id: ID,
    seat_id: ID,
    home_planet_id: ID,
}

public struct ShipCreated has copy, drop {
    season_id: ID,
    ship_id: ID,
    ship_type: u8,
    controller: address,
    planet_id: ID,
}

public struct ArtifactActivated has copy, drop {
    season_id: ID,
    artifact_id: ID,
    planet_id: ID,
    artifact_type: u8,
}

public struct ArtifactDeactivated has copy, drop {
    season_id: ID,
    artifact_id: ID,
    planet_id: ID,
    burned: bool,
}

public struct PlanetProspected has copy, drop {
    season_id: ID,
    planet_id: ID,
    checkpoint: u64,
}

public struct ArtifactFound has copy, drop {
    season_id: ID,
    artifact_id: ID,
    planet_id: ID,
    artifact_type: u8,
    rarity: u8,
    score_gained: u64,
}

public fun type_ship_mothership(): u8 { TYPE_SHIP_MOTHERSHIP }
public fun type_ship_crescent(): u8 { TYPE_SHIP_CRESCENT }
public fun type_ship_whale(): u8 { TYPE_SHIP_WHALE }
public fun type_ship_gear(): u8 { TYPE_SHIP_GEAR }
public fun type_ship_titan(): u8 { TYPE_SHIP_TITAN }
public fun type_monolith(): u8 { TYPE_MONOLITH }
public fun type_colossus(): u8 { TYPE_COLOSSUS }
public fun type_spaceship(): u8 { TYPE_SPACESHIP }
public fun type_pyramid(): u8 { TYPE_PYRAMID }
public fun type_wormhole(): u8 { TYPE_WORMHOLE }
public fun type_planetary_shield(): u8 { TYPE_PLANETARY_SHIELD }
public fun type_photoid_cannon(): u8 { TYPE_PHOTOID_CANNON }
public fun type_bloom_filter(): u8 { TYPE_BLOOM_FILTER }
public fun type_black_domain(): u8 { TYPE_BLACK_DOMAIN }

public fun artifact_type(self: &Artifact): u8 { self.artifact_type }
public fun controller(self: &Artifact): address { self.controller }
public fun location_kind(self: &Artifact): u8 { self.location_kind }
public fun location_id(self: &Artifact): ID { self.location_id }
public fun activations(self: &Artifact): u64 { self.activations }
public fun is_ship(self: &Artifact): bool { is_ship_type(self.artifact_type) }
public fun rarity(self: &Artifact): u8 { self.rarity }
public fun biome(self: &Artifact): u8 { self.biome }
public fun is_active(self: &Artifact): bool {
    self.last_activated_at_seconds > self.last_deactivated_at_seconds
}
public fun is_burned(self: &Artifact): bool { self.burned }
public fun external_owner(self: &Artifact): &Option<address> { &self.external_owner }
public fun production_artifact_adapter_ready(): bool { false }
public fun required_artifact_interface_version(): u64 { INTERFACE_VERSION }

public fun assert_production_artifact_adapter_ready() {
    abort EProductionAdapterUnavailable
}

/// Mirrors the Round-5 one-time `giveSpaceShips` action.
public fun claim_starting_ships(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    home: &mut Planet,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, ctx.sender());
    planet::assert_planet_season(home, season::season_id(manifest));
    planet::assert_controlled_by(home, seat);
    assert!(planet::is_founding_planet(home), EInvalidActivation);
    planet::assert_no_due_pending_voyage(home, now_ms / 1000);
    planet::refresh(home, now_ms / 1000);
    identity::consume_starting_ship_claim(seat, civilization);
    create_and_share_ship(manifest, seat, home, TYPE_SHIP_MOTHERSHIP, now_ms / 1000, ctx);
    create_and_share_ship(manifest, seat, home, TYPE_SHIP_CRESCENT, now_ms / 1000, ctx);
    create_and_share_ship(manifest, seat, home, TYPE_SHIP_WHALE, now_ms / 1000, ctx);
    create_and_share_ship(manifest, seat, home, TYPE_SHIP_GEAR, now_ms / 1000, ctx);
    create_and_share_ship(manifest, seat, home, TYPE_SHIP_TITAN, now_ms / 1000, ctx);
    event::emit(StartingShipsClaimed {
        season_id: season::season_id(manifest),
        seat_id: identity::seat_id(seat),
        home_planet_id: object::id(home),
    });
}

fun create_and_share_ship(
    manifest: &SeasonManifest,
    seat: &SeasonSeat,
    home: &mut Planet,
    ship_type: u8,
    now_seconds: u64,
    ctx: &mut TxContext,
) {
    assert!(is_ship_type(ship_type), ENotShip);
    let uid = object::new(ctx);
    let ship_id = uid.to_inner();
    let season_id = season::season_id(manifest);
    let controller = identity::seat_controller(seat);
    let home_id = object::id(home);
    let ship = Artifact {
        id: uid,
        season_id,
        planet_discovered_on: home_id,
        rarity: 0,
        biome: 0,
        minted_at_seconds: now_seconds,
        discoverer: controller,
        artifact_type: ship_type,
        activations: 0,
        last_activated_at_seconds: 0,
        last_deactivated_at_seconds: 0,
        wormhole_to: option::none(),
        controller,
        external_owner: option::none(),
        location_kind: LOCATION_PLANET,
        location_id: home_id,
        burned: false,
    };
    planet::attach_ship(home, ship_id, ship_type);
    event::emit(ShipCreated {
        season_id,
        ship_id,
        ship_type,
        controller,
        planet_id: home_id,
    });
    transfer::share_object(ship);
}

/// Crescent activation intentionally does not require the ship controller,
/// matching the observable Round-5 contract behavior.
public fun activate_crescent(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    planet: &mut Planet,
    crescent: &mut Artifact,
    clock_obj: &Clock,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    assert_artifact_season(crescent, season::season_id(manifest));
    planet::assert_planet_season(planet, season::season_id(manifest));
    assert!(crescent.artifact_type == TYPE_SHIP_CRESCENT, EInvalidActivation);
    assert!(crescent.activations == 0, EInvalidActivation);
    assert_planet_location(crescent, planet);
    planet::assert_no_due_pending_voyage(planet, now_ms / 1000);
    planet::refresh(planet, now_ms / 1000);
    planet::activate_crescent(planet);
    crescent.activations = 1;
    crescent.last_activated_at_seconds = now_ms / 1000;
    crescent.last_deactivated_at_seconds = now_ms / 1000;
    event::emit(ArtifactActivated {
        season_id: crescent.season_id,
        artifact_id: object::id(crescent),
        planet_id: object::id(planet),
        artifact_type: TYPE_SHIP_CRESCENT,
    });
}

public(package) fun new_verified_artifact_checkpoint(
    interface_version: u64,
    season_id: ID,
    current_checkpoint: u64,
    attestation_digest: vector<u8>,
): VerifiedArtifactCheckpoint {
    VerifiedArtifactCheckpoint {
        interface_version,
        season_id,
        current_checkpoint,
        attestation_digest,
    }
}

public(package) fun new_verified_artifact_entropy(
    interface_version: u64,
    season_id: ID,
    planet_id: ID,
    prospected_checkpoint: u64,
    current_checkpoint: u64,
    biome: u8,
    last_byte_mod_255: u8,
    second_last_mod_255: u8,
    attestation_digest: vector<u8>,
): VerifiedArtifactEntropy {
    VerifiedArtifactEntropy {
        interface_version,
        season_id,
        planet_id,
        prospected_checkpoint,
        current_checkpoint,
        biome,
        last_byte_mod_255,
        second_last_mod_255,
        attestation_digest,
    }
}

public(package) fun prospect_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    ruins: &mut Planet,
    gear: &Artifact,
    checkpoint: VerifiedArtifactCheckpoint,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(ruins, season_id);
    planet::assert_controlled_by(ruins, seat);
    assert_controlled_gear(gear, ruins, season_id, sender);
    let VerifiedArtifactCheckpoint {
        interface_version,
        season_id: proof_season_id,
        current_checkpoint,
        attestation_digest,
    } = checkpoint;
    assert!(interface_version == INTERFACE_VERSION, EInvalidAttestation);
    assert!(proof_season_id == season_id, EIntentMismatch);
    assert!(attestation_digest.length() == 32, EInvalidAttestation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(ruins, now_seconds);
    planet::refresh(ruins, now_seconds);
    planet::prospect(ruins, current_checkpoint);
    event::emit(PlanetProspected {
        season_id,
        planet_id: object::id(ruins),
        checkpoint: current_checkpoint,
    });
}

public(package) fun find_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    score: &mut ScoreCard,
    ruins: &mut Planet,
    gear: &Artifact,
    proof: VerifiedArtifactEntropy,
    now_ms: u64,
    sender: address,
    ctx: &mut TxContext,
): Artifact {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(ruins, season_id);
    planet::assert_controlled_by(ruins, seat);
    assert_controlled_gear(gear, ruins, season_id, sender);
    let VerifiedArtifactEntropy {
        interface_version,
        season_id: proof_season_id,
        planet_id,
        prospected_checkpoint,
        current_checkpoint,
        biome,
        last_byte_mod_255,
        second_last_mod_255,
        attestation_digest,
    } = proof;
    assert!(interface_version == INTERFACE_VERSION, EInvalidAttestation);
    assert!(proof_season_id == season_id, EIntentMismatch);
    assert!(planet_id == object::id(ruins), EIntentMismatch);
    assert!(biome >= 1 && biome <= 10, EInvalidAttestation);
    assert!(last_byte_mod_255 < 255, EInvalidAttestation);
    assert!(second_last_mod_255 < 255, EInvalidAttestation);
    assert!(attestation_digest.length() == 32, EInvalidAttestation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(ruins, now_seconds);
    planet::refresh(ruins, now_seconds);
    planet::consume_artifact_find(ruins, prospected_checkpoint, current_checkpoint);
    planet::assert_artifact_capacity_for_dispatch(ruins);
    let (artifact_type, level_bonus) =
        rules::artifact_type_and_bonus(last_byte_mod_255, second_last_mod_255);
    let rarity = rules::artifact_rarity_from_level(planet::level(ruins) + level_bonus);
    let uid = object::new(ctx);
    let artifact_id = uid.to_inner();
    let ruins_id = object::id(ruins);
    let artifact = Artifact {
        id: uid,
        season_id,
        planet_discovered_on: ruins_id,
        rarity,
        biome,
        minted_at_seconds: now_seconds,
        discoverer: sender,
        artifact_type,
        activations: 0,
        last_activated_at_seconds: 0,
        last_deactivated_at_seconds: 0,
        wormhole_to: option::none(),
        controller: @0x0,
        external_owner: option::none(),
        location_kind: LOCATION_PLANET,
        location_id: ruins_id,
        burned: false,
    };
    planet::attach_artifact(ruins, artifact_id);
    let score_gained = rules::artifact_score(rarity);
    identity::add_score(seat, score, score_gained);
    event::emit(ArtifactFound {
        season_id,
        artifact_id,
        planet_id: ruins_id,
        artifact_type,
        rarity,
        score_gained,
    });
    artifact
}

public fun activate(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    artifact: &mut Artifact,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    assert!(artifact.artifact_type != TYPE_WORMHOLE, EInvalidActivation);
    activate_common(
        manifest,
        runtime,
        seat,
        civilization,
        planet,
        artifact,
        option::none(),
        now_ms,
        ctx.sender(),
    )
}

public fun activate_wormhole(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    endpoint: &mut Planet,
    artifact: &mut Artifact,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(endpoint, season_id);
    planet::assert_intact(endpoint);
    assert!(planet::owner_seat_id(endpoint) == identity::seat_id(seat), EInvalidActivation);
    assert!(object::id(endpoint) != object::id(planet), EInvalidActivation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(endpoint, now_seconds);
    planet::refresh(endpoint, now_seconds);
    assert!(artifact.artifact_type == TYPE_WORMHOLE, EInvalidActivation);
    activate_common(
        manifest,
        runtime,
        seat,
        civilization,
        planet,
        artifact,
        option::some(object::id(endpoint)),
        now_ms,
        ctx.sender(),
    )
}

fun activate_common(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    artifact: &mut Artifact,
    wormhole_to: Option<ID>,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(planet, season_id);
    planet::assert_controlled_by(planet, seat);
    assert_artifact_season(artifact, season_id);
    assert_planet_location(artifact, planet);
    assert!(!artifact.burned, EInvalidActivation);
    assert!(artifact.artifact_type >= TYPE_MONOLITH && artifact.artifact_type <= TYPE_BLACK_DOMAIN, EInvalidActivation);
    assert!(!planet::has_active_artifact(planet), EInvalidActivation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(planet, now_seconds);
    planet::refresh(planet, now_seconds);
    let cooldown = rules::artifact_cooldown_seconds(artifact.artifact_type);
    assert!(
        artifact.last_deactivated_at_seconds <= 0xffffffffffffffff - cooldown &&
            artifact.last_deactivated_at_seconds + cooldown < now_seconds,
        EArtifactCooldown,
    );
    if (artifact.artifact_type == TYPE_WORMHOLE) {
        assert!(wormhole_to.is_some(), EInvalidActivation);
        artifact.wormhole_to = wormhole_to;
    } else {
        assert!(wormhole_to.is_none(), EInvalidActivation);
    };
    artifact.activations = artifact.activations + 1;
    artifact.last_activated_at_seconds = now_seconds;
    let artifact_id = object::id(artifact);
    event::emit(ArtifactActivated {
        season_id,
        artifact_id,
        planet_id: object::id(planet),
        artifact_type: artifact.artifact_type,
    });
    if (artifact.artifact_type == TYPE_BLOOM_FILTER || artifact.artifact_type == TYPE_BLACK_DOMAIN) {
        assert!((artifact.rarity as u64) * 2 >= (planet::level(planet) as u64), EInvalidActivation);
        if (artifact.artifact_type == TYPE_BLOOM_FILTER) {
            planet::bloom(planet);
        } else {
            planet::destroy_with_black_domain(planet);
        };
        artifact.last_deactivated_at_seconds = now_seconds;
        artifact.location_kind = LOCATION_BURNED;
        artifact.location_id = @0x0.to_id();
        artifact.burned = true;
        planet::detach_artifact(planet, artifact_id);
        event::emit(ArtifactDeactivated {
            season_id,
            artifact_id,
            planet_id: object::id(planet),
            burned: true,
        });
    } else {
        planet::activate_artifact_stats(
            planet,
            artifact_id,
            artifact.artifact_type,
            artifact.rarity,
            artifact.biome,
        );
    };
}

public fun deactivate(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    artifact: &mut Artifact,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, ctx.sender());
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(planet, season_id);
    planet::assert_controlled_by(planet, seat);
    assert_artifact_season(artifact, season_id);
    assert_planet_location(artifact, planet);
    assert!(is_active_internal(artifact), EInvalidActivation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(planet, now_seconds);
    planet::refresh(planet, now_seconds);
    deactivate_at(artifact, planet, now_seconds);
}

fun deactivate_at(artifact: &mut Artifact, planet: &mut Planet, now_seconds: u64) {
    let artifact_id = object::id(artifact);
    planet::deactivate_artifact_stats(
        planet,
        artifact_id,
        artifact.artifact_type,
        artifact.rarity,
        artifact.biome,
    );
    artifact.last_deactivated_at_seconds = now_seconds;
    artifact.wormhole_to = option::none();
    let burn = artifact.artifact_type == TYPE_PLANETARY_SHIELD ||
        artifact.artifact_type == TYPE_PHOTOID_CANNON;
    if (burn) {
        planet::detach_artifact(planet, artifact_id);
        artifact.location_kind = LOCATION_BURNED;
        artifact.location_id = @0x0.to_id();
        artifact.burned = true;
    };
    event::emit(ArtifactDeactivated {
        season_id: artifact.season_id,
        artifact_id,
        planet_id: object::id(planet),
        burned: burn,
    });
}

public(package) fun depart_ship(
    ship: &mut Artifact,
    source: &mut Planet,
    target: &Planet,
    voyage_id: ID,
    sender: address,
) {
    assert!(is_ship_type(ship.artifact_type), ENotShip);
    assert!(!ship.burned, EArtifactLocationMismatch);
    assert!(ship.controller == sender, ENotShipController);
    assert_planet_location(ship, source);
    planet::assert_artifact_capacity_for_dispatch(target);
    planet::detach_ship(source, object::id(ship), ship.artifact_type);
    ship.location_kind = LOCATION_VOYAGE;
    ship.location_id = voyage_id;
}

public(package) fun arrive_ship(
    ship: &mut Artifact,
    target: &mut Planet,
    voyage_id: ID,
) {
    assert!(is_ship_type(ship.artifact_type), ENotShip);
    assert!(!ship.burned, EArtifactLocationMismatch);
    assert!(ship.location_kind == LOCATION_VOYAGE, EArtifactLocationMismatch);
    assert!(ship.location_id == voyage_id, EArtifactLocationMismatch);
    planet::attach_ship(target, object::id(ship), ship.artifact_type);
    ship.location_kind = LOCATION_PLANET;
    ship.location_id = object::id(target);
}

public(package) fun depart_artifact(
    artifact: &mut Artifact,
    source: &mut Planet,
    target: &Planet,
    voyage_id: ID,
) {
    assert!(!is_ship_type(artifact.artifact_type), ENotShip);
    assert!(!artifact.burned, EArtifactLocationMismatch);
    assert!(!is_active_internal(artifact), EInvalidActivation);
    assert_planet_location(artifact, source);
    planet::assert_artifact_capacity_for_dispatch(target);
    planet::detach_artifact(source, object::id(artifact));
    artifact.location_kind = LOCATION_VOYAGE;
    artifact.location_id = voyage_id;
}

public(package) fun arrive_artifact(
    artifact: &mut Artifact,
    target: &mut Planet,
    voyage_id: ID,
) {
    assert!(!is_ship_type(artifact.artifact_type), ENotShip);
    assert!(!artifact.burned, EArtifactLocationMismatch);
    assert!(artifact.location_kind == LOCATION_VOYAGE, EArtifactLocationMismatch);
    assert!(artifact.location_id == voyage_id, EArtifactLocationMismatch);
    planet::attach_artifact(target, object::id(artifact));
    artifact.location_kind = LOCATION_PLANET;
    artifact.location_id = object::id(target);
}

public(package) fun wormhole_divisor_for_route(
    artifact: &Artifact,
    source: &Planet,
    target: &Planet,
): u64 {
    assert!(artifact.artifact_type == TYPE_WORMHOLE, EInvalidActivation);
    assert!(is_active_internal(artifact), EInvalidActivation);
    assert!(!artifact.burned, EInvalidActivation);
    assert!(artifact.location_kind == LOCATION_PLANET, EArtifactLocationMismatch);
    assert!(artifact.wormhole_to.is_some(), EInvalidActivation);
    let source_id = object::id(source);
    let target_id = object::id(target);
    let valid = (artifact.location_id == source_id && *artifact.wormhole_to.borrow() == target_id) ||
        (artifact.location_id == target_id && *artifact.wormhole_to.borrow() == source_id);
    assert!(valid, EInvalidActivation);
    rules::wormhole_distance_divisor(artifact.rarity)
}

public(package) fun consume_photoid_for_departure(
    photoid: &mut Artifact,
    source: &mut Planet,
    now_seconds: u64,
): (u64, u64) {
    assert!(photoid.artifact_type == TYPE_PHOTOID_CANNON, EInvalidActivation);
    assert!(is_active_internal(photoid), EInvalidActivation);
    assert_planet_location(photoid, source);
    assert!(
        now_seconds >= photoid.last_activated_at_seconds &&
            now_seconds - photoid.last_activated_at_seconds >= PHOTOID_ACTIVATION_DELAY,
        EInvalidActivation,
    );
    let range_multiplier = rules::photoid_range_multiplier(photoid.rarity);
    let speed_multiplier = rules::photoid_speed_multiplier(photoid.rarity);
    deactivate_at(photoid, source, now_seconds);
    (range_multiplier, speed_multiplier)
}

public fun withdraw(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    spacetime_rip: &mut Planet,
    artifact: &mut Artifact,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, ctx.sender());
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(spacetime_rip, season_id);
    planet::assert_controlled_by(spacetime_rip, seat);
    assert_artifact_season(artifact, season_id);
    assert_planet_location(artifact, spacetime_rip);
    assert!(planet::planet_type(spacetime_rip) == rules::planet_spacetime_rip(), ESpacetimeRipRequired);
    assert!(!is_ship_type(artifact.artifact_type), ENotShip);
    assert!(!is_active_internal(artifact), EInvalidActivation);
    assert!(planet::level(spacetime_rip) > artifact.rarity, EInvalidActivation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(spacetime_rip, now_seconds);
    planet::refresh(spacetime_rip, now_seconds);
    planet::detach_artifact(spacetime_rip, object::id(artifact));
    artifact.location_kind = LOCATION_EXTERNAL;
    artifact.location_id = @0x0.to_id();
    artifact.external_owner = option::some(ctx.sender());
}

public fun deposit(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    spacetime_rip: &mut Planet,
    artifact: &mut Artifact,
    clock_obj: &Clock,
    ctx: &mut TxContext,
) {
    let now_ms = clock::timestamp_ms(clock_obj);
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, ctx.sender());
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(spacetime_rip, season_id);
    planet::assert_controlled_by(spacetime_rip, seat);
    assert_artifact_season(artifact, season_id);
    assert!(planet::planet_type(spacetime_rip) == rules::planet_spacetime_rip(), ESpacetimeRipRequired);
    assert!(!artifact.burned, EInvalidActivation);
    assert!(!is_ship_type(artifact.artifact_type), ENotShip);
    assert!(artifact.location_kind == LOCATION_EXTERNAL, EArtifactLocationMismatch);
    assert!(artifact.external_owner.is_some(), ENotArtifactController);
    assert!(*artifact.external_owner.borrow() == ctx.sender(), ENotArtifactController);
    assert!(planet::level(spacetime_rip) > artifact.rarity, EInvalidActivation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(spacetime_rip, now_seconds);
    planet::refresh(spacetime_rip, now_seconds);
    planet::attach_artifact(spacetime_rip, object::id(artifact));
    artifact.location_kind = LOCATION_PLANET;
    artifact.location_id = object::id(spacetime_rip);
    artifact.external_owner = option::none();
}

fun assert_controlled_gear(
    gear: &Artifact,
    planet: &Planet,
    season_id: ID,
    sender: address,
) {
    assert_artifact_season(gear, season_id);
    assert!(gear.artifact_type == TYPE_SHIP_GEAR, EInvalidActivation);
    assert!(gear.controller == sender, ENotShipController);
    assert_planet_location(gear, planet);
}

fun assert_planet_location(artifact: &Artifact, planet: &Planet) {
    assert!(artifact.location_kind == LOCATION_PLANET, EArtifactLocationMismatch);
    assert!(artifact.location_id == object::id(planet), EArtifactLocationMismatch);
    assert!(planet::contains_artifact(planet, object::id(artifact)), EArtifactLocationMismatch);
}

fun assert_artifact_season(artifact: &Artifact, season_id: ID) {
    assert!(artifact.season_id == season_id, ESeasonMismatch);
}

fun is_active_internal(artifact: &Artifact): bool {
    artifact.last_activated_at_seconds > artifact.last_deactivated_at_seconds
}

fun is_ship_type(artifact_type: u8): bool {
    artifact_type >= TYPE_SHIP_MOTHERSHIP && artifact_type <= TYPE_SHIP_TITAN
}

#[test_only]
public fun new_ship_for_testing(
    season_id: ID,
    ship_type: u8,
    controller: address,
    planet: &mut Planet,
    ctx: &mut TxContext,
): Artifact {
    assert!(is_ship_type(ship_type), ENotShip);
    let uid = object::new(ctx);
    let ship_id = uid.to_inner();
    let planet_id = object::id(planet);
    let ship = Artifact {
        id: uid,
        season_id,
        planet_discovered_on: planet_id,
        rarity: 0,
        biome: 0,
        minted_at_seconds: 0,
        discoverer: controller,
        artifact_type: ship_type,
        activations: 0,
        last_activated_at_seconds: 0,
        last_deactivated_at_seconds: 0,
        wormhole_to: option::none(),
        controller,
        external_owner: option::none(),
        location_kind: LOCATION_PLANET,
        location_id: planet_id,
        burned: false,
    };
    planet::attach_ship(planet, ship_id, ship_type);
    ship
}

#[test_only]
public fun activate_crescent_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    planet: &mut Planet,
    crescent: &mut Artifact,
    now_ms: u64,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    assert_artifact_season(crescent, season::season_id(manifest));
    assert!(crescent.artifact_type == TYPE_SHIP_CRESCENT, EInvalidActivation);
    assert!(crescent.activations == 0, EInvalidActivation);
    assert_planet_location(crescent, planet);
    planet::assert_no_due_pending_voyage(planet, now_ms / 1000);
    planet::refresh(planet, now_ms / 1000);
    planet::activate_crescent(planet);
    crescent.activations = 1;
    crescent.last_activated_at_seconds = now_ms / 1000;
    crescent.last_deactivated_at_seconds = now_ms / 1000;
}

#[test_only]
public fun new_artifact_for_testing(
    season_id: ID,
    artifact_type: u8,
    rarity: u8,
    biome: u8,
    planet: &mut Planet,
    ctx: &mut TxContext,
): Artifact {
    assert!(artifact_type >= TYPE_MONOLITH && artifact_type <= TYPE_BLACK_DOMAIN, EInvalidActivation);
    let uid = object::new(ctx);
    let artifact_id = uid.to_inner();
    let planet_id = object::id(planet);
    let artifact = Artifact {
        id: uid,
        season_id,
        planet_discovered_on: planet_id,
        rarity,
        biome,
        minted_at_seconds: 1,
        discoverer: @0xa11ce,
        artifact_type,
        activations: 0,
        last_activated_at_seconds: 0,
        last_deactivated_at_seconds: 0,
        wormhole_to: option::none(),
        controller: @0x0,
        external_owner: option::none(),
        location_kind: LOCATION_PLANET,
        location_id: planet_id,
        burned: false,
    };
    planet::attach_artifact(planet, artifact_id);
    artifact
}

#[test_only]
public fun activate_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    artifact: &mut Artifact,
    now_ms: u64,
    sender: address,
) {
    assert!(artifact.artifact_type != TYPE_WORMHOLE, EInvalidActivation);
    activate_common(
        manifest,
        runtime,
        seat,
        civilization,
        planet,
        artifact,
        option::none(),
        now_ms,
        sender,
    )
}

#[test_only]
public fun activate_wormhole_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    endpoint: &mut Planet,
    artifact: &mut Artifact,
    now_ms: u64,
    sender: address,
) {
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(endpoint, season_id);
    planet::assert_intact(endpoint);
    assert!(planet::owner_seat_id(endpoint) == identity::seat_id(seat), EInvalidActivation);
    assert!(object::id(endpoint) != object::id(planet), EInvalidActivation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(endpoint, now_seconds);
    planet::refresh(endpoint, now_seconds);
    assert!(artifact.artifact_type == TYPE_WORMHOLE, EInvalidActivation);
    activate_common(
        manifest,
        runtime,
        seat,
        civilization,
        planet,
        artifact,
        option::some(object::id(endpoint)),
        now_ms,
        sender,
    )
}

#[test_only]
public fun deactivate_at_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    artifact: &mut Artifact,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    let season_id = season::season_id(manifest);
    planet::assert_planet_season(planet, season_id);
    planet::assert_controlled_by(planet, seat);
    assert_artifact_season(artifact, season_id);
    assert_planet_location(artifact, planet);
    assert!(is_active_internal(artifact), EInvalidActivation);
    let now_seconds = now_ms / 1000;
    planet::assert_no_due_pending_voyage(planet, now_seconds);
    planet::refresh(planet, now_seconds);
    deactivate_at(artifact, planet, now_seconds);
}

#[test_only]
public fun destroy_for_testing(artifact: Artifact) {
    let Artifact {
        id,
        season_id: _,
        planet_discovered_on: _,
        rarity: _,
        biome: _,
        minted_at_seconds: _,
        discoverer: _,
        artifact_type: _,
        activations: _,
        last_activated_at_seconds: _,
        last_deactivated_at_seconds: _,
        wormhole_to: _,
        controller: _,
        external_owner: _,
        location_kind: _,
        location_id: _,
        burned: _,
    } = artifact;
    object::delete(id);
}
