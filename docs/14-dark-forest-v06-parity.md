# Dark Forest v0.6 Round 5 Gameplay Parity

## Status and scope

This document is the normative gameplay target for Infinite Stellar's first
complete strategy season. The target is behavioral parity with the official
Dark Forest v0.6 Round 5 contracts, commonly called Junk Wars. Infinite Stellar
is an independent project. It is not an official Dark Forest release and is not
endorsed by the Dark Forest team.

Parity means that the same public state and action inputs produce the same
gameplay outcomes, subject only to the Sui mappings and explicit deviations in
this document. Infinite Stellar keeps its own name, story, interface, art,
contracts, object topology, and Soul-based commander identity.

No GPL source, original client asset, logo, or protected Dark Forest branding
may be copied into this MIT repository. Mechanics, public constants, formulas,
and observed behavior are independently reimplemented and attributed here. The
MiMC/Perlin compatibility layer is verified against the separately published
MIT-licensed hashing package, but does not vendor that package's source.

## Reference authority

When references disagree, use this order:

1. The exact Round 5 Ethereum contracts and configuration at
   [`darkforest-eth/eth@76c28cc`](https://github.com/darkforest-eth/eth/tree/76c28ccb48a7900d6071212c9c4b1d5a9fce074b).
2. The official post-Round-5 v0.6 snapshot at
   [`darkforest-eth/darkforest-v0.6@d1e25ea`](https://github.com/darkforest-eth/darkforest-v0.6/tree/d1e25ead311697ecaa27ff648dac16a0d8cea15c).
3. The official [Round 5 announcement](https://blog.zkga.me/v6-r5-announce)
   and [v0.6 announcement](https://blog.zkga.me/announcing-v6) for intent and
   player-facing language.
4. Later descriptions are context only.

The reference repositories are GPL-3.0. Anyone proposing reuse of their source
must first isolate that work under a compatible license and follow the
[community-round guidance](https://blog.zkga.me/hosting-a-dark-forest-community-round).

## Versioned rules authority

The machine-readable source of fixed parameters is
[`config/dark-forest-v06-round5.json`](../config/dark-forest-v06-round5.json).
SDK and Move tests must assert its `rulesetId`, `rulesetVersion`, and all shared
parity vectors. A rules change requires a new manifest version; a deployed
season never mutates its rules manifest.

The non-ranked local client applies one explicit `SpacetimeRip` showcase overlay
to its compact 48-coordinate scenario because that small natural sample contains
no type-3 planet. It preserves a real coordinate and applies the canonical Rip
stat transform, but it is not a proof or ranked rule vector. Production and Move
planet initialization always derive type from location byte `8`.

## Compatibility matrix

| ID | Mechanic | Required observable behavior | Phase status |
| --- | --- | --- | --- |
| UNI-DF-001 | Private universe | Deterministic location hash, perlin, radius, rarity, and proof-bound initialization | Integrated under fixture proofs |
| UNI-DF-002 | Planet generation | Levels, type weights, bonus bytes, biome, space modifiers, pirates, and world radius match Round 5 | Integrated under fixture proofs |
| ECO-DF-001 | Energy | Lazy logistic growth and over-cap decay with contract-compatible integer rounding | Integrated under fixture proofs |
| ECO-DF-002 | Silver | Owned asteroid linear growth, caps, movement, and withdrawal score match | Integrated under fixture proofs |
| MOV-DF-001 | Voyage | Travel time, energy decay, pending-arrival limits, and arrival ordering match | Integrated under fixture proofs |
| MOV-DF-002 | Combat | Friendly reinforcement, hostile defense, conquest, silver transfer, and zero remainder rules match | Integrated under fixture proofs |
| UPG-DF-001 | Upgrades | Three branches, costs, branch limits, and space-dependent total limits match | Integrated under fixture proofs |
| ART-DF-001 | Artifacts | Prospect/find, rarity/type rolls, inventory, activation, cooldown, and transfer match | Integrated under fixture proofs |
| SHP-DF-001 | Spaceships | Five once-per-player ships and every ship effect match Round 5 | Integrated under fixture proofs |
| JNK-DF-001 | Space junk | Capacity, planet junk, half-junk bonus, conquest collection, and abandonment match | Integrated under fixture proofs |
| CAP-DF-001 | Capture zones | Zone schedule, geometry, invade/hold/capture, ownership transfer, and score match | Integrated under fixture proofs |
| REV-DF-001 | Reveal | Proof-bound public coordinates, global deduplication, and three-hour cooldown match | Integrated under fixture proofs |
| LIF-DF-001 | Round lifecycle | Pause, mint cutoff, round close, score finality, and settlement are one-way | Integrated under fixture proofs |
| SOU-IS-001 | Soul commander | One Soul projection selects a fixed Season Seat without changing gameplay math | Integrated; production adapter blocked |
| ZKP-IS-001 | Sui verifier | Pinned BN254 Groth16 keys and public-input intents; production stays fail-closed until audited | Production blocked |
| UI-IS-001 | Player client | Discover, inspect, move, fight, upgrade, use artifacts, reveal, capture, score, and settle | Local rules sandbox integrated |

## Canonical enumerations

Planet types are `Regular`, `SilverMine`, `Ruins`, `SpacetimeRip`, and
`SilverBank`. Player-facing Infinite Stellar names may differ, but serialized
codes remain `0` through `4` in that order.

Space types are `Nebula`, `Space`, `DeepSpace`, and `DeadSpace`, serialized as
`0` through `3`.

Artifact types use the Round 5 numeric codes: `1 Monolith`, `2 Colossus`,
`3 SpaceshipLegacy`, `4 Pyramid`, `5 Wormhole`, `6 Shield`, `7 Photoid`,
`8 BloomFilter`, `9 BlackDomain`, `10 Mothership`, `11 Crescent`, `12 Whale`,
`13 Gear`, and `14 Titan`. Rarity codes are `1 Common` through `5 Mythic`.

## Universe and planet generation

- The field is BN254. A location is a planet when its hash is less than the
  field modulus divided by `12,000`.
- Hash bytes `4..6` select level using the canonical ten level thresholds.
- Nebula clips natural level at `4`; Space clips it at `5`; Deep Space and Dead
  Space do not clip it.
- Hash byte `8` selects planet type using the manifest's type-weight table.
- Bytes `9` through `13` independently grant a `1/16` capacity, growth, range,
  speed, or defense bonus. Byte `14` grants half space junk with probability
  `1/16`.
- Perlin below `14` is Nebula, `14` is Space, `15..18` is Deep Space, and `19+`
  is Dead Space.
- Location, space, and biome keys are `115`, `116`, and `117`. Perlin scale is
  `16,384` with neither axis mirrored.
- Biome combines space type with biome-perlin thresholds `14` and `17`; Dead
  Space always produces the corrupted biome.
- The minimum world radius is `12,000`. Dynamic growth targets initialized
  level-four planets plus twenty level-four equivalents per player using the
  original cumulative rarity formula.
- A home is a level-zero regular planet at the spawn perlin band. It begins with
  `50,000` energy, no junk, and the claiming Seat as controller.

Space multipliers are applied after base stats. Space multiplies productive
stats by `1.25` and defense by `0.5`; Deep Space uses `1.5` and `0.25`; Dead
Space uses `2.0` and `0.15`. Nebula uses `1.0` for all.

Silver Mines enable silver growth, double silver capacity, halve defense, and
begin half full. Silver Banks halve speed, multiply silver capacity by ten,
disable population growth, multiply population capacity by five, and halve
pirates. Spacetime Rips halve defense and double silver capacity.

Pirates are base capacity times the level's barbarian percentage, then
multiplied by `4`, `10`, or `20` in Space, Deep Space, or Dead Space. Silver
Banks halve the result.

## Economy and refresh

For owned planets, energy refresh uses the reference logistic curve:

```text
new = cap / (1 + exp((-4 * growth * elapsed) / cap) * (cap / current - 1))
```

Values above capacity decay through the same curve. Contract-compatible fixed
point rounding, elapsed-time saturation, and exact-boundary vectors are
normative. Unowned planets do not grow energy or silver.

Owned Silver Mines grow silver linearly by `silverGrowth * elapsed`, capped at
silver capacity. Multiple Motherships or Whales multiply their respective
growth by two per ship and unstack on departure. Ship bonuses do not apply to
the founding home.

Compatibility quirk: a Titan pauses positive energy growth and clamps energy to
capacity. The exact Round 5 contract does not pause silver growth, even though
the announcement described a broader freeze. Infinite Stellar follows the
contract.

## Voyages, reinforcement, and combat

Normal travel time is:

```text
max(1, floor(effectiveDistance * 100 / originSpeed)) seconds
```

Normal arriving energy is:

```text
max(0, floor(sentEnergy / 2^(effectiveDistance / originRange)
             - originEnergyCapacity / 20))
```

The source owner cannot send all source energy. Friendly arrivals add energy
and may overpopulate except where a Titan or Silver Bank clamps it. On a hostile
arrival, defense first absorbs `arrival * 100 / defense`. If that is insufficient,
ownership transfers and remaining energy is
`arrival - defender * defense / 100`; an exact-zero victorious remainder becomes
`1`. Silver always transfers and caps at the destination, even on a failed
attack.

The destination's current owner may have at most six pending arrivals to a
planet. All senders other than that owner share a second aggregate limit of six;
a seventh arrival in either class is rejected. Arrival processing is ordered by
arrival time and stable voyage identity.

One active Wormhole on either endpoint, pointing to the other endpoint, divides
effective distance by rarity multiplier `1, 2, 4, 8, 16, 32`; a reciprocal
second Wormhole is not required. A hostile or unowned Wormhole endpoint receives
no energy, although silver and an artifact still arrive. An eligible move
consumes an active Photoid after its activation delay; its range, speed, and
defense modifiers are manifest constants.

Abandonment requires no incoming voyages and is forbidden from the home. It
sends all energy and silver, applies `150%` range and speed, clears ownership,
sets pirates to twice default, and returns the planet's junk to the map.

## Upgrades

Only owned regular planets above level zero upgrade. Each upgrade costs:

```text
silverCapacity * 20% * (totalUpgradeLevel + 1)
```

Defense, range, and speed branches have four levels each. All branches multiply
capacity and growth by `120%`. Their specialization multipliers are defense
`120%`, range `125%`, and speed `175%`. Nebula, Space, and Deep/Dead Space allow
at most `3`, `4`, and `5` total upgrade levels respectively.

## Space junk

Player capacity is `2,000`. Planet junk by level is
`20, 25, 30, 35, 40, 45, 50, 55, 60, 65`; homes have none. The half-junk bonus
halves this value. A non-ship move clears remaining target junk into the player
before ownership is resolved and must fit capacity. Abandoning subtracts that
planet's default junk, flooring player junk at zero.

## Artifacts and spaceships

An owned Ruins planet may be prospected once while the controller's Gear is
present. Discovery must occur in a later block and before the 256-block hash
window expires. A Ruins planet yields at most one artifact. Rarity is selected
from planet level plus the canonical bonus roll. Discovery awards the manifest
artifact points.

At most five artifacts may be present at a planet. Only one non-ship artifact
may be active there. Wormhole and Shield have four-hour cooldowns; Photoid,
Bloom Filter, and Black Domain have twenty-four-hour cooldowns. Bloom Filter and
Black Domain require twice rarity to meet or exceed planet level and are
consumed immediately. Bloom Filter fills energy and silver. Black Domain
destroys a planet and blocks normal moves and artifact transfers. Shield and
Photoid burn when deactivated.

Artifacts enter or leave external custody only through an owned Spacetime Rip
whose level exceeds artifact rarity. Spaceships cannot leave the game universe.
The official v0.6 announcement describes the Rip as the bridge for silver and
artifact movement between the finite universe and the surrounding contract
ecosystem. Infinite Stellar independently reimplements that behavior and uses
original visual treatment; it does not copy the GPL client or its assets.

Compatibility quirk: the final intended biome-specific artifact bucket is
overwritten to Photoid by the exact Round 5 contract. Infinite Stellar preserves
that result.

Each commander claims exactly one Mothership, Crescent, Whale, Gear, and Titan
at the owned home. Ships move with zero energy and silver, use their controller
instead of planet ownership, cannot conquer, and are not lost when a host planet
changes owner. Crescent activates once on an unowned level-one-or-higher planet,
turning it into a Silver Mine and initializing silver to one if needed.

## Capture zones, reveal, and score

Capture zones change every `255` reference blocks, have radius `1,000`, and use
three zones per `5,000` world-radius ring. Zone centers derive from the interval
block hash and nonce with the reference polar-point algorithm.

An owned, undestroyed, publicly located planet inside the current zone may be
invaded once. Any later owner may complete capture after `2,048` blocks. Capture
score uses the level table in the manifest.

Compatibility quirk: the exact capture predicate is
`energy * 100 >= capacity * 100 / 78`, approximately `1.28%`. A reference UX
string described eighty percent, but Infinite Stellar follows the contract.

Public reveal proves coordinates, location hash, and perlin. A planet may be
revealed only once globally and a player may reveal once every three hours.

Score sources are artifact discovery, capture zones, and silver extracted at an
owned Spacetime Rip. Silver score follows the contract's integer truncation:
`floor(silver / 1,000) * 10 / 100`.

## Zero-knowledge boundary

The reference circuits prove:

- home initialization inside the radius and in the thin spawn rim;
- source/destination commitments, destination perlin, radius, and maximum
  distance for movement;
- public coordinates matching a committed location for reveal; and
- biome perlin matching the committed coordinates for artifact discovery.

Infinite Stellar will use Sui's BN254 Groth16 natives behind typed proof intents.
Every intent commits to package, season, action kind, Seat where applicable,
public inputs, circuit version, and verifying-key digest. Test fixtures may
construct package-internal witnesses. Public production entry points remain
unavailable until circuits, trusted-setup provenance, verifier keys, and gas
limits are pinned and independently audited.

No private coordinate, salt, witness, scan cache, or proof-generation secret is
stored onchain or committed to this repository.

## Sui mapping and permitted deviations

| Reference concept | Infinite Stellar mapping | Parity effect |
| --- | --- | --- |
| Player address | Fixed Season Seat controlled by a wallet | No gameplay-math change |
| Player identity | Soul-derived Commander Projection at enrollment | Attribution only; pure Seat play survives later Soul transfer |
| Diamond/global contract | Versioned shared Season roots plus bounded planet/voyage objects | Transaction topology changes, rules do not |
| Ethereum block | Sui checkpoint/Clock abstraction fixed by the season manifest | Timing units are calibrated and vector-tested |
| Block hash entropy | Sui randomness plus committed checkpoint inputs | Distribution and one-way transitions must match |
| Ethereum NFT custody | Sui artifact object/custody boundary | Inventory and eligibility rules match |
| EVM fixed point | Independently implemented bounded integer math | Must pass shared golden vectors |

Anything not listed here is not an allowed deviation. UI naming and visuals may
change, but they must not hide mechanically relevant state.

## Required parity vectors

Before a mechanic is marked implemented, tests must cover at least:

- every level, space type, planet type, bonus bit, clip boundary, and pirate
  multiplier;
- zero/current/capacity/over-cap energy, long elapsed time, and integer rounding;
- silver growth, cap, hostile transfer, withdrawal truncation, and Whale stacks;
- exact travel-time boundaries, zero-arrival, reinforcement, failed attack,
  exact-zero conquest, and multiple ordered arrivals;
- six versus seven pending voyages for owner and outsider;
- Wormhole, Photoid, abandonment, destroyed destination, and spaceship moves;
- every upgrade branch/level/cost/space cap and invalid planet type;
- prospect timing, expired hash window, rarity/type buckets, five-artifact cap,
  activation cooldown, burn/consume semantics, and Spacetime Rip custody;
- all five ships, stacking, home exclusion, ship transfer, and Crescent once;
- junk capacity, half-junk, neutral/enemy clearing, conquest, and abandonment;
- zone interval boundary, geometry, ownership change during hold, exact hold,
  exact energy predicate, and every score level;
- reveal validity, deduplication, cooldown, and public-input intent replay;
- pause/close/settlement one-way behavior and deterministic final score;
- rejection of cross-season, cross-package, cross-action, cross-Seat, stale-key,
  malformed-field, and oversized proof inputs.

## Completion rule

`Reference locked` means the expected behavior and source are known. It does not
mean code exists. A row becomes `Implemented` only when Move, SDK/local engine,
and UI behavior are integrated and its required vectors pass. Production-ready
proof rows additionally require pinned real verifying keys and an external
security review.
