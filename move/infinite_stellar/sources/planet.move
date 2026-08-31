module infinite_stellar::planet;

use infinite_stellar::identity::{Self as identity, CivilizationState, ScoreCard, SeasonSeat};
use infinite_stellar::round5_rules as rules;
use infinite_stellar::season::{Self as season, SeasonManifest, SeasonRuntime};
use sui::derived_object;
use sui::clock::{Self as clock, Clock};
use sui::event;

const PROOF_INTERFACE_VERSION: u64 = 1;

const ESeasonMismatch: u64 = 0;
const EInvalidProof: u64 = 1;
const EProofIntentMismatch: u64 = 2;
const EPlanetAlreadyClaimed: u64 = 3;
const EPlanetMismatch: u64 = 4;
const ENotPlanetController: u64 = 5;
const EInsufficientEnergy: u64 = 6;
const EInsufficientSilver: u64 = 7;
const EArrivalRateLimited: u64 = 8;
const EVoyageMissing: u64 = 9;
const EDestroyed: u64 = 10;
const EPendingVoyageDue: u64 = 11;
const EInvalidUpgrade: u64 = 12;
const EArtifactCapacity: u64 = 13;
const EArtifactMissing: u64 = 14;
const EInvalidShipAction: u64 = 15;
const EInvalidWithdrawal: u64 = 16;
const EInvalidCaptureState: u64 = 17;
const ECaptureEnergyTooLow: u64 = 18;
const ECaptureHoldIncomplete: u64 = 19;
const EAlreadyRevealed: u64 = 20;

public struct PendingVoyage has copy, drop, store {
    voyage_id: ID,
    player_seat_id: ID,
    arrival_at_seconds: u64,
}

public struct PlanetRegistry has key {
    id: UID,
    season_id: ID,
}

public struct PlanetClaimKey has copy, drop, store {
    encoding_version: u64,
    season_id: ID,
    location_commitment: vector<u8>,
}

/// Package-internal output of the future pinned ZK verifier. No caller can
/// construct or persist this witness directly.
public struct VerifiedHomeProof has drop {
    interface_version: u64,
    season_id: ID,
    seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
}

/// Verifier-only witness for a non-home planet. The proof adapter must bind
/// the MiMC location identifier, space Perlin output, season/ruleset flags,
/// world radius, and public-input digest before constructing this value.
public struct VerifiedPlanetProof has drop {
    interface_version: u64,
    season_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    space_perlin: u64,
}

public struct Planet has key {
    id: UID,
    season_id: ID,
    owner_seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    is_founding_planet: bool,
    ruleset_version: u64,
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
    default_energy: u64,
    default_space_junk: u64,
    last_updated_at_seconds: u64,
    destroyed: bool,
    pausers: u64,
    upgrade_defense: u8,
    upgrade_range: u8,
    upgrade_speed: u8,
    pending_voyages: vector<PendingVoyage>,
    artifact_ids: vector<ID>,
    active_artifact_id: Option<ID>,
    prospected_checkpoint: Option<u64>,
    artifact_found: bool,
    invader_seat_id: Option<ID>,
    invade_start_checkpoint: u64,
    capturer_seat_id: Option<ID>,
    revealed_x: Option<vector<u8>>,
    revealed_y: Option<vector<u8>>,
    revealer_seat_id: Option<ID>,
}

public struct FoundingPlanetClaimed has copy, drop {
    season_id: ID,
    seat_id: ID,
    planet_id: ID,
}

public struct NeutralPlanetInitialized has copy, drop {
    season_id: ID,
    planet_id: ID,
    level: u8,
    planet_type: u8,
    space_type: u8,
}

public struct PlanetUpgraded has copy, drop {
    season_id: ID,
    seat_id: ID,
    planet_id: ID,
    branch: u8,
    branch_level: u8,
    silver_spent: u64,
}

public struct PlanetSilverWithdrawn has copy, drop {
    season_id: ID,
    seat_id: ID,
    planet_id: ID,
    silver_withdrawn: u64,
    score_gained: u64,
}

public(package) fun new_registry(season_id: ID, ctx: &mut TxContext): PlanetRegistry {
    PlanetRegistry { id: object::new(ctx), season_id }
}

public(package) fun share_registry(registry: PlanetRegistry) {
    transfer::share_object(registry);
}

public(package) fun new_verified_home_proof(
    interface_version: u64,
    season_id: ID,
    seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
): VerifiedHomeProof {
    VerifiedHomeProof {
        interface_version,
        season_id,
        seat_id,
        location_commitment,
        public_input_digest,
    }
}

public(package) fun new_verified_planet_proof(
    interface_version: u64,
    season_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    space_perlin: u64,
): VerifiedPlanetProof {
    VerifiedPlanetProof {
        interface_version,
        season_id,
        location_commitment,
        public_input_digest,
        space_perlin,
    }
}

public(package) fun claim_home_verified(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    proof: VerifiedHomeProof,
    now_ms: u64,
    sender: address,
): Planet {
    assert_registry(manifest, registry);
    season::assert_claim_open(manifest, runtime, now_ms);
    identity::assert_home_claim_objects(manifest, seat, civilization, score, sender);
    let VerifiedHomeProof {
        interface_version,
        season_id,
        seat_id,
        location_commitment,
        public_input_digest,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(season_id == season::season_id(manifest), EProofIntentMismatch);
    assert!(seat_id == identity::seat_id(seat), EProofIntentMismatch);
    assert!(location_commitment.length() == 32, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    let key = PlanetClaimKey {
        encoding_version: PROOF_INTERFACE_VERSION,
        season_id,
        location_commitment,
    };
    assert!(!derived_object::exists(&registry.id, key), EPlanetAlreadyClaimed);

    let planet_uid = derived_object::claim(&mut registry.id, key);
    let planet_id = planet_uid.to_inner();
    // Verification and caller-controlled policy checks are complete. The
    // remaining invariant assertion and writes are one atomic Move transaction.
    identity::activate_home(seat, civilization, planet_id);
    let stats = rules::initialize_home_stats();
    let planet = Planet {
        id: planet_uid,
        season_id,
        owner_seat_id: seat_id,
        location_commitment,
        public_input_digest,
        is_founding_planet: true,
        ruleset_version: rules::ruleset_version(),
        level: rules::stats_level(&stats),
        planet_type: rules::stats_planet_type(&stats),
        space_type: rules::stats_space_type(&stats),
        energy: rules::stats_energy(&stats),
        energy_capacity: rules::stats_energy_capacity(&stats),
        energy_growth: rules::stats_energy_growth(&stats),
        range: rules::stats_range(&stats),
        speed: rules::stats_speed(&stats),
        defense: rules::stats_defense(&stats),
        silver: rules::stats_silver(&stats),
        silver_capacity: rules::stats_silver_capacity(&stats),
        silver_growth: rules::stats_silver_growth(&stats),
        space_junk: rules::stats_space_junk(&stats),
        default_energy: rules::stats_energy(&stats),
        default_space_junk: rules::stats_space_junk(&stats),
        last_updated_at_seconds: now_ms / 1000,
        destroyed: false,
        pausers: 0,
        upgrade_defense: 0,
        upgrade_range: 0,
        upgrade_speed: 0,
        pending_voyages: vector[],
        artifact_ids: vector[],
        active_artifact_id: option::none(),
        prospected_checkpoint: option::none(),
        artifact_found: false,
        invader_seat_id: option::none(),
        invade_start_checkpoint: 0,
        capturer_seat_id: option::none(),
        revealed_x: option::none(),
        revealed_y: option::none(),
        revealer_seat_id: option::none(),
    };
    event::emit(FoundingPlanetClaimed { season_id, seat_id, planet_id });
    planet
}

/// Materializes a proof-verified natural planet at its deterministic registry
/// address. The planet is neutral; ownership can only change through arrival.
public(package) fun initialize_planet_verified(
    manifest: &SeasonManifest,
    registry: &mut PlanetRegistry,
    proof: VerifiedPlanetProof,
    now_ms: u64,
): Planet {
    assert_registry(manifest, registry);
    let VerifiedPlanetProof {
        interface_version,
        season_id,
        location_commitment,
        public_input_digest,
        space_perlin,
    } = proof;
    assert!(interface_version == PROOF_INTERFACE_VERSION, EInvalidProof);
    assert!(season_id == season::season_id(manifest), EProofIntentMismatch);
    assert!(location_commitment.length() == 32, EInvalidProof);
    assert!(public_input_digest.length() == 32, EInvalidProof);
    let key = PlanetClaimKey {
        encoding_version: PROOF_INTERFACE_VERSION,
        season_id,
        location_commitment,
    };
    assert!(!derived_object::exists(&registry.id, key), EPlanetAlreadyClaimed);
    let planet_uid = derived_object::claim(&mut registry.id, key);
    let planet_id = planet_uid.to_inner();
    let stats = rules::initialize_planet_from_location(&location_commitment, space_perlin);
    let level = rules::stats_level(&stats);
    let planet_type = rules::stats_planet_type(&stats);
    let space_type = rules::stats_space_type(&stats);
    let planet = Planet {
        id: planet_uid,
        season_id,
        owner_seat_id: @0x0.to_id(),
        location_commitment,
        public_input_digest,
        is_founding_planet: false,
        ruleset_version: rules::ruleset_version(),
        level,
        planet_type,
        space_type,
        energy: rules::stats_energy(&stats),
        energy_capacity: rules::stats_energy_capacity(&stats),
        energy_growth: rules::stats_energy_growth(&stats),
        range: rules::stats_range(&stats),
        speed: rules::stats_speed(&stats),
        defense: rules::stats_defense(&stats),
        silver: rules::stats_silver(&stats),
        silver_capacity: rules::stats_silver_capacity(&stats),
        silver_growth: rules::stats_silver_growth(&stats),
        space_junk: rules::stats_space_junk(&stats),
        default_energy: rules::stats_energy(&stats),
        default_space_junk: rules::stats_space_junk(&stats),
        last_updated_at_seconds: now_ms / 1000,
        destroyed: false,
        pausers: 0,
        upgrade_defense: 0,
        upgrade_range: 0,
        upgrade_speed: 0,
        pending_voyages: vector[],
        artifact_ids: vector[],
        active_artifact_id: option::none(),
        prospected_checkpoint: option::none(),
        artifact_found: false,
        invader_seat_id: option::none(),
        invade_start_checkpoint: 0,
        capturer_seat_id: option::none(),
        revealed_x: option::none(),
        revealed_y: option::none(),
        revealer_seat_id: option::none(),
    };
    event::emit(NeutralPlanetInitialized {
        season_id,
        planet_id,
        level,
        planet_type,
        space_type,
    });
    planet
}

public(package) fun share_planet(planet: Planet) {
    transfer::share_object(planet);
}

fun assert_registry(manifest: &SeasonManifest, registry: &PlanetRegistry) {
    assert!(registry.season_id == season::season_id(manifest), ESeasonMismatch);
    assert!(object::id(registry) == season::planet_registry_id(manifest), ESeasonMismatch);
}

public fun derive_planet_address(
    manifest: &SeasonManifest,
    registry: &PlanetRegistry,
    location_commitment: vector<u8>,
): address {
    assert_registry(manifest, registry);
    derived_object::derive_address(
        object::id(registry),
        PlanetClaimKey {
            encoding_version: PROOF_INTERFACE_VERSION,
            season_id: season::season_id(manifest),
            location_commitment,
        },
    )
}

public fun proof_interface_version(): u64 { PROOF_INTERFACE_VERSION }
public fun owner_seat_id(self: &Planet): ID { self.owner_seat_id }
public fun location_commitment(self: &Planet): &vector<u8> { &self.location_commitment }
public fun is_founding_planet(self: &Planet): bool { self.is_founding_planet }
public fun level(self: &Planet): u8 { self.level }
public fun planet_type(self: &Planet): u8 { self.planet_type }
public fun space_type(self: &Planet): u8 { self.space_type }
public fun energy(self: &Planet): u64 { self.energy }
public fun energy_capacity(self: &Planet): u64 { self.energy_capacity }
public fun energy_growth(self: &Planet): u64 { self.energy_growth }
public fun range(self: &Planet): u64 { self.range }
public fun speed(self: &Planet): u64 { self.speed }
public fun defense(self: &Planet): u64 { self.defense }
public fun silver(self: &Planet): u64 { self.silver }
public fun silver_capacity(self: &Planet): u64 { self.silver_capacity }
public fun silver_growth(self: &Planet): u64 { self.silver_growth }
public fun space_junk(self: &Planet): u64 { self.space_junk }
public fun default_energy(self: &Planet): u64 { self.default_energy }
public fun default_space_junk(self: &Planet): u64 { self.default_space_junk }
public fun pending_voyage_count(self: &Planet): u64 { self.pending_voyages.length() }
public fun is_neutral(self: &Planet): bool { self.owner_seat_id == @0x0.to_id() }
public fun upgrade_defense(self: &Planet): u8 { self.upgrade_defense }
public fun upgrade_range(self: &Planet): u8 { self.upgrade_range }
public fun upgrade_speed(self: &Planet): u8 { self.upgrade_speed }
public fun artifact_count(self: &Planet): u64 { self.artifact_ids.length() }
public fun has_active_artifact(self: &Planet): bool { self.active_artifact_id.is_some() }
public fun active_artifact_id(self: &Planet): &Option<ID> { &self.active_artifact_id }
public fun prospected_checkpoint(self: &Planet): &Option<u64> { &self.prospected_checkpoint }
public fun artifact_found(self: &Planet): bool { self.artifact_found }
public fun has_invader(self: &Planet): bool { self.invader_seat_id.is_some() }
public fun is_captured(self: &Planet): bool { self.capturer_seat_id.is_some() }
public fun is_revealed(self: &Planet): bool { self.revealed_x.is_some() }

public(package) fun assert_planet_season(planet: &Planet, season_id: ID) {
    assert!(planet.season_id == season_id, ESeasonMismatch);
    assert!(planet.ruleset_version == rules::ruleset_version(), EPlanetMismatch);
}

public(package) fun assert_controlled_by(planet: &Planet, seat: &SeasonSeat) {
    assert!(planet.owner_seat_id == identity::seat_id(seat), ENotPlanetController);
    assert!(!planet.destroyed, EDestroyed);
}

public(package) fun assert_intact(planet: &Planet) {
    assert!(!planet.destroyed, EDestroyed);
}

public(package) fun assert_no_pending_voyage(planet: &Planet) {
    assert!(planet.pending_voyages.is_empty(), EPendingVoyageDue);
}

public(package) fun assert_no_due_pending_voyage(planet: &Planet, now_seconds: u64) {
    let mut index = 0u64;
    while (index < planet.pending_voyages.length()) {
        assert!(
            planet.pending_voyages.borrow(index).arrival_at_seconds > now_seconds,
            EPendingVoyageDue,
        );
        index = index + 1;
    }
}

public(package) fun refresh(planet: &mut Planet, now_seconds: u64) {
    assert!(now_seconds >= planet.last_updated_at_seconds, EPlanetMismatch);
    let elapsed = now_seconds - planet.last_updated_at_seconds;
    if (elapsed == 0) return;
    let owned = planet.owner_seat_id != @0x0.to_id();
    planet.energy = rules::refreshed_energy(
        owned,
        planet.energy,
        planet.energy_capacity,
        planet.energy_growth,
        elapsed,
        planet.pausers,
        planet.planet_type == rules::planet_silver_bank(),
    );
    planet.silver = rules::silver_after_growth(
        owned,
        planet.planet_type == rules::planet_silver_mine(),
        planet.silver,
        planet.silver_growth,
        elapsed,
        planet.silver_capacity,
    );
    planet.last_updated_at_seconds = now_seconds;
}

public(package) fun debit_for_voyage(
    planet: &mut Planet,
    sent_energy: u64,
    sent_silver: u64,
) {
    assert!(!planet.destroyed, EDestroyed);
    assert!(planet.energy > sent_energy, EInsufficientEnergy);
    assert!(planet.silver >= sent_silver, EInsufficientSilver);
    planet.energy = planet.energy - sent_energy;
    planet.silver = planet.silver - sent_silver;
}

/// Applies the source-side state transition of the Round-5 abandonment move.
/// The caller computes the boosted route before invoking this function and
/// creates the one-shot arrival in the same transaction.
public(package) fun abandon_for_voyage(
    planet: &mut Planet,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
): (u64, u64) {
    assert_controlled_by(planet, seat);
    assert!(!planet.is_founding_planet, EInvalidShipAction);
    assert_no_pending_voyage(planet);
    let sent_energy = planet.energy;
    let sent_silver = planet.silver;
    planet.owner_seat_id = @0x0.to_id();
    planet.energy = if (planet.default_energy > 0xffffffffffffffff / 2) {
        0xffffffffffffffff
    } else {
        planet.default_energy * 2
    };
    planet.silver = 0;
    planet.space_junk = planet.default_space_junk;
    identity::return_space_junk_flooring_zero(
        seat,
        civilization,
        planet.default_space_junk,
    );
    identity::decrement_controlled_planets(seat, civilization);
    (sent_energy, sent_silver)
}

/// Round-5 upgrades are public, proof-free actions on a controlled planet.
public fun upgrade(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    branch: u8,
    clock_obj: &Clock,
    ctx: &TxContext,
) {
    upgrade_at(
        manifest,
        runtime,
        seat,
        civilization,
        planet,
        branch,
        clock::timestamp_ms(clock_obj),
        ctx.sender(),
    )
}

public(package) fun upgrade_at(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    planet: &mut Planet,
    branch: u8,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    assert_planet_season(planet, season::season_id(manifest));
    assert_controlled_by(planet, seat);
    let now_seconds = now_ms / 1000;
    assert_no_due_pending_voyage(planet, now_seconds);
    refresh(planet, now_seconds);
    assert!(planet.planet_type == rules::planet_regular(), EInvalidUpgrade);
    assert!(planet.level > 0, EInvalidUpgrade);
    assert!(branch <= rules::branch_speed(), EInvalidUpgrade);
    let total = planet.upgrade_defense + planet.upgrade_range + planet.upgrade_speed;
    assert!(total < rules::max_total_upgrade_level(planet.space_type), EInvalidUpgrade);
    let branch_level = if (branch == rules::branch_defense()) {
        planet.upgrade_defense
    } else if (branch == rules::branch_range()) {
        planet.upgrade_range
    } else {
        planet.upgrade_speed
    };
    assert!(branch_level < 4, EInvalidUpgrade);
    let cost = rules::upgrade_cost(planet.silver_capacity, total);
    assert!(planet.silver >= cost, EInsufficientSilver);
    planet.silver = planet.silver - cost;
    let (energy_capacity, energy_growth, defense, range, speed) = rules::upgraded_values(
        planet.energy_capacity,
        planet.energy_growth,
        planet.defense,
        planet.range,
        planet.speed,
        branch,
    );
    planet.energy_capacity = energy_capacity;
    planet.energy_growth = energy_growth;
    planet.defense = defense;
    planet.range = range;
    planet.speed = speed;
    let new_branch_level = branch_level + 1;
    if (branch == rules::branch_defense()) {
        planet.upgrade_defense = new_branch_level;
    } else if (branch == rules::branch_range()) {
        planet.upgrade_range = new_branch_level;
    } else {
        planet.upgrade_speed = new_branch_level;
    };
    event::emit(PlanetUpgraded {
        season_id: planet.season_id,
        seat_id: identity::seat_id(seat),
        planet_id: object::id(planet),
        branch,
        branch_level: new_branch_level,
        silver_spent: cost,
    });
}

public fun withdraw_silver(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    score: &mut ScoreCard,
    planet: &mut Planet,
    amount: u64,
    clock_obj: &Clock,
    ctx: &TxContext,
) {
    withdraw_silver_at(
        manifest,
        runtime,
        seat,
        civilization,
        score,
        planet,
        amount,
        clock::timestamp_ms(clock_obj),
        ctx.sender(),
    )
}

public(package) fun withdraw_silver_at(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    seat: &SeasonSeat,
    civilization: &CivilizationState,
    score: &mut ScoreCard,
    planet: &mut Planet,
    amount: u64,
    now_ms: u64,
    sender: address,
) {
    season::assert_action_allowed_after_home_close(manifest, runtime, now_ms);
    identity::assert_active_controller(seat, civilization, sender);
    assert_planet_season(planet, season::season_id(manifest));
    assert_controlled_by(planet, seat);
    assert_no_due_pending_voyage(planet, now_ms / 1000);
    refresh(planet, now_ms / 1000);
    assert!(planet.planet_type == rules::planet_spacetime_rip(), EInvalidWithdrawal);
    assert!(planet.silver >= amount, EInsufficientSilver);
    planet.silver = planet.silver - amount;
    let score_gained = rules::silver_withdrawal_score(amount);
    identity::add_score(seat, score, score_gained);
    event::emit(PlanetSilverWithdrawn {
        season_id: planet.season_id,
        seat_id: identity::seat_id(seat),
        planet_id: object::id(planet),
        silver_withdrawn: amount,
        score_gained,
    });
}

/// The original Round-5 move transfers a target planet's junk immediately at
/// dispatch, before the fleet arrives. Returning zero is a no-op.
public(package) fun take_space_junk_for_dispatch(planet: &mut Planet): u64 {
    let amount = planet.space_junk;
    planet.space_junk = 0;
    amount
}

public(package) fun assert_artifact_capacity_for_dispatch(planet: &Planet) {
    assert!(planet.artifact_ids.length() < 5, EArtifactCapacity);
}

public(package) fun contains_artifact(planet: &Planet, artifact_id: ID): bool {
    planet.artifact_ids.contains(&artifact_id)
}

public(package) fun attach_artifact(planet: &mut Planet, artifact_id: ID) {
    assert!(planet.artifact_ids.length() < 5, EArtifactCapacity);
    assert!(!planet.artifact_ids.contains(&artifact_id), EArtifactCapacity);
    planet.artifact_ids.push_back(artifact_id);
}

public(package) fun detach_artifact(planet: &mut Planet, artifact_id: ID) {
    assert!(
        planet.active_artifact_id.is_none() ||
            *planet.active_artifact_id.borrow() != artifact_id,
        EInvalidShipAction,
    );
    let mut index = 0u64;
    while (index < planet.artifact_ids.length()) {
        if (*planet.artifact_ids.borrow(index) == artifact_id) {
            planet.artifact_ids.swap_remove(index);
            return
        };
        index = index + 1;
    };
    abort EArtifactMissing
}

public(package) fun activate_artifact_stats(
    planet: &mut Planet,
    artifact_id: ID,
    artifact_type: u8,
    rarity: u8,
    biome: u8,
) {
    assert!(!planet.destroyed, EDestroyed);
    assert!(planet.active_artifact_id.is_none(), EInvalidShipAction);
    assert!(planet.artifact_ids.contains(&artifact_id), EArtifactMissing);
    let (capacity, growth, range, speed, defense) =
        rules::artifact_upgrade(artifact_type, rarity, biome);
    planet.energy_capacity = ((planet.energy_capacity as u128) * (capacity as u128) / 100) as u64;
    planet.energy_growth = ((planet.energy_growth as u128) * (growth as u128) / 100) as u64;
    planet.range = ((planet.range as u128) * (range as u128) / 100) as u64;
    planet.speed = ((planet.speed as u128) * (speed as u128) / 100) as u64;
    planet.defense = ((planet.defense as u128) * (defense as u128) / 100) as u64;
    planet.active_artifact_id = option::some(artifact_id);
}

public(package) fun deactivate_artifact_stats(
    planet: &mut Planet,
    artifact_id: ID,
    artifact_type: u8,
    rarity: u8,
    biome: u8,
) {
    assert!(!planet.destroyed, EDestroyed);
    assert!(planet.active_artifact_id.is_some(), EInvalidShipAction);
    assert!(*planet.active_artifact_id.borrow() == artifact_id, EInvalidShipAction);
    let (capacity, growth, range, speed, defense) =
        rules::artifact_upgrade(artifact_type, rarity, biome);
    planet.energy_capacity = ((planet.energy_capacity as u128) * 100 / (capacity as u128)) as u64;
    planet.energy_growth = ((planet.energy_growth as u128) * 100 / (growth as u128)) as u64;
    planet.range = ((planet.range as u128) * 100 / (range as u128)) as u64;
    planet.speed = ((planet.speed as u128) * 100 / (speed as u128)) as u64;
    planet.defense = ((planet.defense as u128) * 100 / (defense as u128)) as u64;
    planet.active_artifact_id = option::none();
}

public(package) fun bloom(planet: &mut Planet) {
    assert!(!planet.destroyed, EDestroyed);
    planet.energy = planet.energy_capacity;
    planet.silver = planet.silver_capacity;
}

public(package) fun destroy_with_black_domain(planet: &mut Planet) {
    assert!(!planet.destroyed, EDestroyed);
    planet.destroyed = true;
}

public(package) fun prospect(planet: &mut Planet, checkpoint: u64) {
    assert!(!planet.destroyed, EDestroyed);
    assert!(planet.planet_type == rules::planet_ruins(), EInvalidShipAction);
    assert!(planet.prospected_checkpoint.is_none(), EInvalidShipAction);
    planet.prospected_checkpoint = option::some(checkpoint);
}

public(package) fun consume_artifact_find(
    planet: &mut Planet,
    prospected_checkpoint: u64,
    current_checkpoint: u64,
) {
    assert!(!planet.destroyed, EDestroyed);
    assert!(!planet.artifact_found, EInvalidShipAction);
    assert!(planet.prospected_checkpoint.is_some(), EInvalidShipAction);
    assert!(*planet.prospected_checkpoint.borrow() == prospected_checkpoint, EInvalidShipAction);
    assert!(current_checkpoint > prospected_checkpoint, EInvalidShipAction);
    assert!(current_checkpoint - prospected_checkpoint < 256, EInvalidShipAction);
    planet.artifact_found = true;
}

public(package) fun attach_ship(
    planet: &mut Planet,
    artifact_id: ID,
    ship_type: u8,
) {
    assert!(!planet.artifact_ids.contains(&artifact_id), EInvalidShipAction);
    planet.artifact_ids.push_back(artifact_id);
    if (!planet.is_founding_planet) {
        if (ship_type == 10) {
            planet.energy_growth = planet.energy_growth * 2;
        } else if (ship_type == 12) {
            planet.silver_growth = planet.silver_growth * 2;
        } else if (ship_type == 14) {
            planet.pausers = planet.pausers + 1;
        };
    };
}

public(package) fun detach_ship(
    planet: &mut Planet,
    artifact_id: ID,
    ship_type: u8,
) {
    let mut index = 0u64;
    while (index < planet.artifact_ids.length()) {
        if (*planet.artifact_ids.borrow(index) == artifact_id) {
            planet.artifact_ids.swap_remove(index);
            if (!planet.is_founding_planet) {
                if (ship_type == 10) {
                    planet.energy_growth = planet.energy_growth / 2;
                } else if (ship_type == 12) {
                    planet.silver_growth = planet.silver_growth / 2;
                } else if (ship_type == 14) {
                    assert!(planet.pausers > 0, EInvalidShipAction);
                    planet.pausers = planet.pausers - 1;
                };
            };
            return
        };
        index = index + 1;
    };
    abort EArtifactMissing
}

public(package) fun activate_crescent(planet: &mut Planet) {
    assert!(planet.owner_seat_id == @0x0.to_id(), EInvalidShipAction);
    assert!(planet.level >= 1, EInvalidShipAction);
    assert!(planet.planet_type != rules::planet_silver_mine(), EInvalidShipAction);
    planet.planet_type = rules::planet_silver_mine();
    if (planet.silver == 0) planet.silver = 1;
    // Production planet initialization will pin the exact location bonus. The
    // current state stores the already-derived mine growth when available.
    if (planet.silver_growth == 0) {
        planet.silver_growth = rules::silver_mine_growth(planet.level, planet.space_type);
    };
}

public(package) fun begin_capture_invasion(
    planet: &mut Planet,
    seat: &SeasonSeat,
    current_checkpoint: u64,
) {
    assert_controlled_by(planet, seat);
    assert!(!planet.destroyed, EDestroyed);
    assert!(planet.invader_seat_id.is_none(), EInvalidCaptureState);
    assert!(planet.capturer_seat_id.is_none(), EInvalidCaptureState);
    assert!(current_checkpoint <= 0xffffffffffffffff - 2048, EInvalidCaptureState);
    planet.invader_seat_id = option::some(identity::seat_id(seat));
    planet.invade_start_checkpoint = current_checkpoint;
}

public(package) fun complete_capture(
    planet: &mut Planet,
    seat: &SeasonSeat,
    current_checkpoint: u64,
): u64 {
    assert_controlled_by(planet, seat);
    assert!(!planet.destroyed, EDestroyed);
    assert!(planet.invader_seat_id.is_some(), EInvalidCaptureState);
    assert!(planet.capturer_seat_id.is_none(), EInvalidCaptureState);
    assert!(
        current_checkpoint >= planet.invade_start_checkpoint + 2048,
        ECaptureHoldIncomplete,
    );
    assert!(
        rules::capture_energy_eligible(planet.energy, planet.energy_capacity),
        ECaptureEnergyTooLow,
    );
    planet.capturer_seat_id = option::some(identity::seat_id(seat));
    rules::capture_score(planet.level)
}

public(package) fun reveal(
    planet: &mut Planet,
    revealer_seat_id: ID,
    x: vector<u8>,
    y: vector<u8>,
) {
    assert!(planet.revealed_x.is_none(), EAlreadyRevealed);
    assert!(planet.revealed_y.is_none(), EAlreadyRevealed);
    assert!(x.length() == 32 && y.length() == 32, EInvalidProof);
    planet.revealed_x = option::some(x);
    planet.revealed_y = option::some(y);
    planet.revealer_seat_id = option::some(revealer_seat_id);
}

public(package) fun register_pending_voyage(
    planet: &mut Planet,
    voyage_id: ID,
    player_seat_id: ID,
    arrival_at_seconds: u64,
) {
    let from_owner = player_seat_id == planet.owner_seat_id;
    let mut class_count = 0u64;
    let mut index = 0u64;
    while (index < planet.pending_voyages.length()) {
        let pending = planet.pending_voyages.borrow(index);
        if ((pending.player_seat_id == planet.owner_seat_id) == from_owner) {
            class_count = class_count + 1;
        };
        index = index + 1;
    };
    assert!(class_count < 6, EArrivalRateLimited);
    planet.pending_voyages.push_back(PendingVoyage {
        voyage_id,
        player_seat_id,
        arrival_at_seconds,
    });
}

/// Removes only the earliest pending arrival. Equal-time arrivals preserve the
/// same insertion order used by the Round-5 event array.
public(package) fun remove_due_pending_voyage(
    planet: &mut Planet,
    voyage_id: ID,
    arrival_at_seconds: u64,
) {
    assert!(!planet.pending_voyages.is_empty(), EVoyageMissing);
    let mut earliest_index = 0u64;
    let mut index = 1u64;
    while (index < planet.pending_voyages.length()) {
        if (
            planet.pending_voyages.borrow(index).arrival_at_seconds <
                planet.pending_voyages.borrow(earliest_index).arrival_at_seconds
        ) {
            earliest_index = index;
        };
        index = index + 1;
    };
    let earliest = planet.pending_voyages.borrow(earliest_index);
    assert!(earliest.voyage_id == voyage_id, EVoyageMissing);
    assert!(earliest.arrival_at_seconds == arrival_at_seconds, EVoyageMissing);
    planet.pending_voyages.swap_remove(earliest_index);
}

/// Returns true when ownership changes to the arriving Seat.
public(package) fun apply_energy_and_silver_arrival(
    planet: &mut Planet,
    player_seat_id: ID,
    arriving_energy: u64,
    arriving_silver: u64,
): bool {
    let mut conquered = false;
    if (planet.owner_seat_id == player_seat_id) {
        planet.energy = planet.energy + arriving_energy;
    } else {
        let result = rules::resolve_hostile_combat(
            planet.energy,
            planet.defense,
            arriving_energy,
        );
        planet.energy = rules::combat_energy(&result);
        if (rules::combat_conquered(&result)) {
            planet.owner_seat_id = player_seat_id;
            conquered = true;
        };
    };
    if (
        planet.planet_type == rules::planet_silver_bank() ||
        planet.pausers > 0
    ) {
        if (planet.energy > planet.energy_capacity) {
            planet.energy = planet.energy_capacity;
        };
    };
    planet.silver = rules::capped_silver_after_arrival(
        planet.silver,
        arriving_silver,
        planet.silver_capacity,
    );
    conquered
}

/// Round-5 Wormhole arrivals reinforce a friendly endpoint, but transfer no
/// energy and cannot conquer when the endpoint is neutral or hostile. Silver
/// still transfers in every case.
public(package) fun apply_wormhole_energy_and_silver_arrival(
    planet: &mut Planet,
    player_seat_id: ID,
    arriving_energy: u64,
    arriving_silver: u64,
) {
    if (planet.owner_seat_id == player_seat_id) {
        planet.energy = planet.energy + arriving_energy;
        if (
            planet.planet_type == rules::planet_silver_bank() ||
            planet.pausers > 0
        ) {
            if (planet.energy > planet.energy_capacity) {
                planet.energy = planet.energy_capacity;
            };
        };
    };
    planet.silver = rules::capped_silver_after_arrival(
        planet.silver,
        arriving_silver,
        planet.silver_capacity,
    );
}

#[test_only]
fun bytes32(value: u8): vector<u8> {
    let mut bytes = vector[];
    32u64.do!(|_| bytes.push_back(value));
    bytes
}

#[test_only]
public fun new_registry_for_testing(season_id: ID, ctx: &mut TxContext): PlanetRegistry {
    new_registry(season_id, ctx)
}

#[test_only]
public fun claim_home_fixture_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
): Planet {
    let proof = new_verified_home_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        identity::seat_id(seat),
        location_commitment,
        public_input_digest,
    );
    claim_home_verified(
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        score,
        proof,
        now_ms,
        sender,
    )
}

#[test_only]
public fun claim_home_fixture_with_intent_for_testing(
    manifest: &SeasonManifest,
    runtime: &SeasonRuntime,
    registry: &mut PlanetRegistry,
    seat: &SeasonSeat,
    civilization: &mut CivilizationState,
    score: &ScoreCard,
    proof_season_id: ID,
    proof_seat_id: ID,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    now_ms: u64,
    sender: address,
): Planet {
    let proof = new_verified_home_proof(
        PROOF_INTERFACE_VERSION,
        proof_season_id,
        proof_seat_id,
        location_commitment,
        public_input_digest,
    );
    claim_home_verified(
        manifest,
        runtime,
        registry,
        seat,
        civilization,
        score,
        proof,
        now_ms,
        sender,
    )
}

#[test_only]
public fun initialize_planet_fixture_for_testing(
    manifest: &SeasonManifest,
    registry: &mut PlanetRegistry,
    location_commitment: vector<u8>,
    public_input_digest: vector<u8>,
    space_perlin: u64,
    now_ms: u64,
): Planet {
    let proof = new_verified_planet_proof(
        PROOF_INTERFACE_VERSION,
        season::season_id(manifest),
        location_commitment,
        public_input_digest,
        space_perlin,
    );
    initialize_planet_verified(manifest, registry, proof, now_ms)
}

#[test_only]
public fun new_neutral_fixture_for_testing(
    season_id: ID,
    level: u8,
    planet_type: u8,
    space_type: u8,
    now_seconds: u64,
    ctx: &mut TxContext,
): Planet {
    let stats = rules::initialize_planet_stats(
        level,
        planet_type,
        space_type,
        false,
        false,
        false,
        false,
        false,
        false,
    );
    Planet {
        id: object::new(ctx),
        season_id,
        owner_seat_id: @0x0.to_id(),
        location_commitment: bytes32(7),
        public_input_digest: bytes32(8),
        is_founding_planet: false,
        ruleset_version: rules::ruleset_version(),
        level: rules::stats_level(&stats),
        planet_type: rules::stats_planet_type(&stats),
        space_type: rules::stats_space_type(&stats),
        energy: rules::stats_energy(&stats),
        energy_capacity: rules::stats_energy_capacity(&stats),
        energy_growth: rules::stats_energy_growth(&stats),
        range: rules::stats_range(&stats),
        speed: rules::stats_speed(&stats),
        defense: rules::stats_defense(&stats),
        silver: rules::stats_silver(&stats),
        silver_capacity: rules::stats_silver_capacity(&stats),
        silver_growth: rules::stats_silver_growth(&stats),
        space_junk: rules::stats_space_junk(&stats),
        default_energy: rules::stats_energy(&stats),
        default_space_junk: rules::stats_space_junk(&stats),
        last_updated_at_seconds: now_seconds,
        destroyed: false,
        pausers: 0,
        upgrade_defense: 0,
        upgrade_range: 0,
        upgrade_speed: 0,
        pending_voyages: vector[],
        artifact_ids: vector[],
        active_artifact_id: option::none(),
        prospected_checkpoint: option::none(),
        artifact_found: false,
        invader_seat_id: option::none(),
        invade_start_checkpoint: 0,
        capturer_seat_id: option::none(),
        revealed_x: option::none(),
        revealed_y: option::none(),
        revealer_seat_id: option::none(),
    }
}

#[test_only]
public fun set_owner_and_silver_for_testing(
    planet: &mut Planet,
    owner_seat_id: ID,
    silver: u64,
) {
    assert!(silver <= planet.silver_capacity, EInsufficientSilver);
    planet.owner_seat_id = owner_seat_id;
    planet.silver = silver;
}

#[test_only]
public fun set_owner_energy_and_silver_for_testing(
    planet: &mut Planet,
    owner_seat_id: ID,
    energy: u64,
    silver: u64,
) {
    assert!(silver <= planet.silver_capacity, EInsufficientSilver);
    planet.owner_seat_id = owner_seat_id;
    planet.energy = energy;
    planet.silver = silver;
}

#[test_only]
public fun destroy_registry_for_testing(registry: PlanetRegistry) {
    let PlanetRegistry { id, season_id: _ } = registry;
    object::delete(id);
}

#[test_only]
public fun destroy_planet_for_testing(planet: Planet) {
    let Planet {
        id,
        season_id: _,
        owner_seat_id: _,
        location_commitment: _,
        public_input_digest: _,
        is_founding_planet: _,
        ruleset_version: _,
        level: _,
        planet_type: _,
        space_type: _,
        energy: _,
        energy_capacity: _,
        energy_growth: _,
        range: _,
        speed: _,
        defense: _,
        silver: _,
        silver_capacity: _,
        silver_growth: _,
        space_junk: _,
        default_energy: _,
        default_space_junk: _,
        last_updated_at_seconds: _,
        destroyed: _,
        pausers: _,
        upgrade_defense: _,
        upgrade_range: _,
        upgrade_speed: _,
        pending_voyages: _,
        artifact_ids: _,
        active_artifact_id: _,
        prospected_checkpoint: _,
        artifact_found: _,
        invader_seat_id: _,
        invade_start_checkpoint: _,
        capturer_seat_id: _,
        revealed_x: _,
        revealed_y: _,
        revealer_seat_id: _,
    } = planet;
    object::delete(id);
}
