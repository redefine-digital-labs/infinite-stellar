# Round 5 Sui Gameplay Architecture

## Purpose

This document maps the gameplay contract in
[`14-dark-forest-v06-parity.md`](14-dark-forest-v06-parity.md) onto Sui objects
without changing observable game outcomes. It extends the existing enrollment
and founding-planet foundation; it does not reopen the Soul adapter or proof
verifier production gates.

## Design constraints

- A season is immutable in rules, circuit versions, verification keys, timing
  calibration, and score policy after creation.
- Coordinates and scan state remain private. Shared objects contain commitments,
  verified public outputs, and gameplay state only.
- A transaction may contend on the planets and Seats it changes, but unrelated
  players and unrelated destinations must remain parallel.
- All delayed actions are permissionlessly settleable and deterministic.
- Soul is checked only when a Seat is enrolled or when a later action explicitly
  requests Soul attribution. Ordinary gameplay uses fixed Seat authority.
- Production entry points reject fixture proofs, unknown key digests, oversized
  public inputs, stale package intents, and unpinned Soul bindings.

## Immutable season rule authority

The production `SeasonManifest` freezes or must extend its frozen authority to include:

- `ruleset_id` and `ruleset_version`;
- a canonical BCS rules-manifest digest;
- location, space, and biome hash keys;
- world-radius, rarity, perlin, and planet-generation parameters;
- timing calibration from reference blocks/seconds to Sui Clock/checkpoints;
- one circuit version and prepared verifying-key digest per proof action;
- capture-zone entropy and checkpoint derivation policy;
- round pause, action close, artifact mint close, and settlement boundaries; and
- score weights and the explicit compatibility-quirk bitset.

The checked-in JSON manifest is an audit and SDK source. The deployed manifest
contains bounded typed fields and its digest; contracts never parse JSON.

## Object graph

```text
SeasonManifest (shared, immutable after creation)
├── SeasonRuntime (shared, bounded lifecycle and entropy state)
├── EnrollmentRegistry (shared only for enrollment)
├── PlanetRegistry (shared only for first initialization per commitment)
├── RevealRegistry shards (shared, bounded key partitions)
├── CaptureEpoch (shared once per active zone interval)
└── ArtifactRegistry shards (shared, bounded mint/custody indexes)

SeasonSeat (shared, fixed controller)
├── CommanderProjection (shared, attribution snapshot)
├── CivilizationState (shared, lifecycle and exact control aggregate)
├── ScoreCard (shared, score aggregate)
└── SpaceJunkState (shared, per-Seat junk and limit)

Planet (shared, derived from season + location commitment)
├── bounded current stats and upgrade levels
├── current owner Seat ID or neutral sentinel
├── at most twelve pending voyage descriptors
├── at most five resident artifact IDs
├── reveal, prospect, invasion, and capture one-way state
└── refresh timestamp and ship-effect counters

Voyage (shared, one-shot delayed action)
Artifact (shared while in-universe; owned object when withdrawn)
FinalScoreReceipt (owned, frozen Last Light result)
```

No season-wide vector of planets, voyages, reveals, or action history is stored.
Events and deterministic IDs provide enumeration for clients and indexers.

## Planet identity and initialization

`PlanetRegistry` derives exactly one Planet ID from:

```text
(encoding_version, package_id, season_id, location_commitment)
```

A verified initialization intent supplies location hash, space perlin, and the
bounded radius statement. The implemented fixture-proof path checks the typed
season intent, derives level/type/space/stats through `round5_rules`, claims the
derived ID, and creates the neutral Planet atomically. A losing race aborts
without consuming unrelated state. The production verifier constructor remains
package-private and unavailable until its pinned key is audited.

Home initialization additionally binds the proof to the Seat, requires the home
predicate, initializes `50,000` energy and zero junk, and performs the existing
`AwaitingHome -> Active` transition.

## Typed proof intents

Each verifier wrapper accepts only one action-specific public-input type. Proof
interface v1 fixes four public signals in this exact order:

```text
source_location_hash
destination_location_hash
action_commitment
rules_geometry_commitment
```

`action_commitment` is Sui's BN254 Poseidon hash of the exact 16-field tuple
defined in [`16-proof-interface-and-artifact-preflight.md`](16-proof-interface-and-artifact-preflight.md).
It binds the interface domain/version, action kind, mainnet/league context,
season, Seat, sender, both locations, amount, source nonce, deadline, and rules
geometry commitment. Sui IDs and sender are split into low/high 128-bit limbs.
For `move` in interface v1, `amount` is the proof's maximum route distance;
energy and silver amounts remain separate state-transition arguments checked by
the source Planet and voyage logic.

Package, circuit, and verifying-key identity are not free transaction fields:
the production entry point must obtain them from the immutable package and
season `CircuitConfig`, then reject any artifact or verifier digest mismatch.
Globally unique season and Seat object IDs bind an intent to that deployed
object graph. Sui's Groth16 native accepts at most eight public field elements;
v1 uses four. Native inputs are exactly 128 bytes: four canonical BN254 scalar
elements concatenated as 32-byte little-endian values.
The checked-in serializer additionally emits Arkworks canonical-compressed
BN254 proof points (`128` bytes) and verifying keys (`232 + 32 * IC.length`
bytes; `392` bytes for four public inputs). A tracked vector is verified by the
Sui Move native in tests. Production code must use a ceremony key pinned by the
immutable circuit configuration, never transaction-supplied key bytes.

Fixtures construct package-internal witnesses under `#[test_only]`; no public
function can turn a fixture digest into a production witness.

## Planet refresh

Every transition first refreshes each mutable planet to the action time. Refresh
is deterministic and updates no season-wide object:

1. Settle due pending voyages in `(arrival_at, voyage_id)` order when the entry
   point requires current state.
2. Apply logistic energy growth or over-cap decay with the reference fixed-point
   rounding.
3. Apply owned Silver Mine linear silver growth and cap.
4. Preserve the Titan compatibility quirk: positive energy growth pauses, while
   silver growth continues.
5. Set `last_updated_at` exactly once.

Public SDK projections reproduce the same order and shared golden vectors.
The SDK also contains an independent MiMC/Perlin compatibility implementation
with canonical vectors and a compact local coordinate slice whose points all
pass the Round-5 rarity predicate. That slice is a playable rules fixture, not
an index of the full production universe.

## Voyage lifecycle

Dispatch mutably borrows the origin Planet, target Planet, attacker Seat, and
attacker SpaceJunkState. It:

- refreshes origin and target;
- verifies fixed Seat control or spaceship controller authority;
- verifies the proof-bound maximum distance and target initialization outputs;
- dynamically counts target pending arrivals as owner versus outsider and
  rejects the seventh in either class;
- applies Wormhole, Photoid, abandonment, artifact, and spaceship departure
  rules;
- debits source energy, silver, artifact custody, and any junk transition; and
- creates a shared Voyage plus one bounded target pending descriptor.

The target descriptor stores voyage ID, controller class input, and arrival
time, not a growing action payload. Maximum descriptor count is twelve.

Settlement consumes the Voyage, refreshes the target to `arrival_at`, applies
reinforcement/combat/silver/artifact/ship effects, removes the exact pending
descriptor, and emits an outcome event. Anybody may settle once all referenced
owner objects are supplied. Duplicate or early settlement aborts.

## Ownership aggregates

`CivilizationState.controlled_planet_count` remains exact, not best-effort. A
conquest that changes ownership supplies and verifies the attacker Seat and
CivilizationState plus the current defender pair when the target is owned.
Neutral capture uses the neutral transition. The transaction increments the new
owner and decrements the old owner atomically with Planet ownership.

This serializes simultaneous ownership changes for one civilization while
preserving parallel play between different civilizations. A stale defender
input aborts and can be rebuilt from the latest Planet owner ID. Indexers are
never the authority for the aggregate.

## Artifacts and ships

Artifact IDs derive from the prospect Planet, prospect checkpoint, and canonical
seed. A bounded ArtifactRegistry shard prevents duplicate mint. Planet resident
IDs are limited to five and the active non-ship slot is unique.

The five ships are created atomically once per Seat from the owned founding
home. Their controller is immutable. A ship Voyage requires zero energy and
silver, cannot conquer, and may originate independently of host ownership.
Mothership, Whale, and Titan counters are stored on the host Planet so stacking
and departure are exact. Crescent holds a one-use activation bit. Gear presence
gates prospect and discovery.

External artifact warp changes the shared Artifact record from an in-universe
location to controller-address custody only through a qualifying owned
Spacetime Rip. Deposit reverses that logical custody after checking artifact
identity and eligibility. Spaceships reject both transitions. A production
wallet-owned Sui object wrapper and signed client transaction remain gated by
the fail-closed artifact adapter; the local sandbox must not imply that this
wrapper is already shipped.

## Capture zones and public reveal

One `CaptureEpoch` is created per interval from the pinned checkpoint entropy
policy. Its centers are immutable. Planet invasion records epoch and start
checkpoint; capture rechecks location proof, current zone, hold duration,
current owner, energy predicate, and one-way capture state before adding score.

Reveal registries are sharded by the leading commitment byte. Reveal consumes a
proof intent, writes the first global coordinate record, and updates the
revealing Seat's cooldown state. Cross-shard duplication is impossible because
the shard function is manifest-pinned and vector-tested.

## Score and settlement

`ScoreCard` changes only through bounded typed sources:

- artifact discovery points;
- capture-zone points; and
- silver extracted through a qualifying Spacetime Rip.

Each source has a unique receipt key so replay is impossible. At season end,
new gameplay actions reject. Permissionless settlement first drains or resolves
the bounded pending states required by policy, freezes the ScoreCard, and emits
the final receipt used by Infinite Stellar's Last Light narrative.

## Concurrency matrix

| Action | Mutable shared inputs | Expected contention |
| --- | --- | --- |
| Enroll | EnrollmentRegistry shard, new Seat objects | Enrollment shard only |
| Initialize planet | PlanetRegistry shard, new Planet | Same commitment or shard |
| Dispatch voyage | Origin, target, attacker Seat/junk | Same origin, target, or attacker |
| Settle reinforcement | Target, Voyage, owner Seat | Same target or owner |
| Settle conquest | Target, Voyage, attacker and defender aggregates | Two involved civilizations |
| Upgrade | Planet, controller Seat | Same planet/controller |
| Artifact action | Planet, Artifact, registry shard when minting | Same planet/artifact/shard |
| Reveal | Reveal shard, revealer cooldown | Same commitment/shard/revealer |
| Capture | Planet, CaptureEpoch, ScoreCard | Same planet/commander score |
| Settle season | Seat, CivilizationState, ScoreCard | One civilization |

## Implementation gates

The following are independent gates:

1. Pure rules and deterministic vectors — integrated and tested.
2. Planet/voyage/artifact/capture state machines under fixture proofs —
   integrated and tested.
3. SDK local engine and UI parity — integrated as an English local rules
   sandbox.
4. Real circuits and proof generation with pinned setup provenance.
5. Production Soul adapter ABI.
6. External Move/circuit/client security review and testnet soak.

Gates one through three may proceed before Soulidity finalizes its Soul ABI.
Ranked enrollment and attributed production writes stay fail-closed until gate
five. No gate authorizes mainnet deployment.
