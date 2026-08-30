# Product Vision

## One-sentence concept

Infinite Stellar is a persistent-identity, seasonal strategy game on Sui where players privately discover shared universes, publicly prove hidden-geometry actions, build civilizations that eventually disappear, and carry verifiable history forward through their Souls.

## The player fantasy

The player should feel like an explorer in a universe that exists whether or not the official client is open. The map begins as darkness. Knowledge has value because it is earned locally and is not automatically published. Every move exposes intent while preserving enough uncertainty for scouting, deception, diplomacy, and betrayal to matter.

At the same time, the game should not feel like a one-off wallet leaderboard. An address authorizes a Soul to enter; an accepted visual gives it form; a Commander Projection binds its seasonal role; and a fixed Season Seat controls the temporary civilization and Planets. The Soul forms relationships and leaves with independently verifiable Echoes plus an optional holder-approved Chronicle. The strategic board resets; the character's history does not.

“Infinite” describes the number of worlds a Soul may experience over time. It does not describe the duration of one season, the size of a mutable collection, or a promise that a single universe never settles.

## Why Sui

The game should be designed around Sui's strengths rather than reproducing an EVM contract topology:

- Objects make ownership and authorization explicit.
- Independent shared objects can allow unrelated planets to progress in parallel.
- Derived object IDs can make a planet address deterministic from a registry and a location commitment without routing every later mutation through the registry.
- Native Move verification of Groth16 proofs can anchor hidden-map rules directly in game actions.
- Programmable transactions can combine proof verification, state updates, fee payment, and receipts into one atomic player action where appropriate.

These are engineering hypotheses until measured under realistic contention. The technical prototype exists to disprove them cheaply.

## Target audience

### Primary

- Strategy players who enjoy incomplete information, optimization, and diplomacy.
- Onchain game players who care about verifiable rules and composable history.
- Soulidity users who want their Soul to accumulate meaningful life events rather than remain a profile image.

### Secondary

- Developers who build alternate clients, analytics, simulations, and carefully permissioned agents.
- Guilds and communities that organize expeditions and seasonal narratives.
- Researchers interested in zero-knowledge game design and object-centric execution.

### Not the initial target

- Traders seeking passive yield.
- Players who expect purchased assets to confer ranked power.
- Mobile-only users on low-memory devices during the first proving prototype.
- Autonomous-agent competition before a fair and legible human game exists.

## Experience pillars

### 1. Discovery is private and consequential

Exploration happens locally. A player chooses where to search and when to reveal that knowledge through a claim, movement, alliance, or attack. The protocol verifies geometry without learning the underlying coordinates.

### 2. The world is shared and authoritative

Ownership, resource production, fleet arrivals, combat, scoring, and settlement are decided by Move code. A custom client may omit information or present it differently, but cannot invent a winning outcome.

### 3. Civilizations are temporary

A season has a declared start, end, ruleset, and settlement process. Planetary power does not escape the season. Resetting prevents permanent incumbency and makes each universe strategically fresh.

### 4. Souls create continuity without power creep

Infinite Stellar associates public Echoes, provenance-tagged relationships, records of past doctrine choices, and cosmetic expression with a Soul through external receipts. An optional Chronicle is separately reviewed and directly signed by the current holder. Animacraft supplies accepted versioned visual material; `CommanderProjection` is the historical Soul/visual/role/Seat binding. Neither visual provenance nor presentation enters ranked math. Functional doctrine and build state belong to the Season Seat and reset. A Soul does not keep energy, planets, combat modifiers, resource multipliers, faster proving, privileged map data, or ranking bonuses.

### 5. Social strategy is a first-class system

Players should have reasons to cooperate before they have reasons to fight. Shared discoveries, coordinated arrivals, rescue actions, public promises, and the final beacon create legible social moments worth remembering.

## Product boundaries

### Fully onchain means

- Anyone can derive the canonical public state from Sui checkpoints.
- All state transitions that can change an outcome are authorized and computed onchain.
- The official backend is replaceable.
- A sponsor may pay gas but cannot choose whether a valid action succeeds.
- An indexer may serve fast queries but is never the source of truth.

### Fully onchain does not mean

- Private coordinates are uploaded to a server.
- Every visual frame is stored onchain.
- Search work is performed onchain.
- The client waits for a global world object on every animation tick.
- Narrative prose is authoritative merely because it was generated by an AI model.

## Season 0 scope

Season 0 proves one complete strategic arc:

1. Enter the optional no-wallet, no-career-history guest tutorial or connect a wallet directly.
2. Resolve any existing fixed-controller Seat before current Soul ownership; returning controllers resume that Seat, including after Soul transfer.
3. If no Seat exists and enrollment is open, distinguish zero, one, multiple, and ineligible Souls, then explicitly select one eligible Soul.
4. Select a licensed visual or neutral fallback and an equal-budget doctrine, then atomically consume the controller/Soul/commander claims and create the Commander Projection, Season Seat, and `AwaitingHome` Civilization.
5. Wait in the sealed-universe lobby until opening finality publishes the seed, then create or restore the Seat-scoped vault and begin local discovery even if claim submission is gated.
6. When home claiming becomes canonically available, submit the saved proof and claim the Seat-owned Founding Planet to become `Active`.
7. Grow energy and extend reach.
8. Move between known planets using a locally generated proof.
9. Attack, defend, cooperate, and contest a public endgame beacon.
10. Settle the season deterministically.
11. Receive a factual season receipt issued by Infinite Stellar and optionally approve a separate narrative-memory transaction.
12. Return with the same Soul to a new universe without carrying power forward.

Out of scope for Season 0:

- Fungible game token.
- Tradable land or fleets.
- User-authored executable plugins.
- Cross-game power bonuses.
- Permissionless agent league.
- User-created worlds.
- Complex crafting or technology trees.
- Governance token or DAO control of live balance.
- Soul minting, Personal Kiosk creation, or Animacraft authoring inside the game.

## Business and ecosystem posture

The first release optimizes for a trustworthy game loop, not financial extraction. Gas sponsorship is an acquisition and onboarding expense. Monetization, if later introduced, should come from expressive and service surfaces that do not change ranked outcomes: cosmetic projections, commemorative artifacts, private worlds, tournament hosting, or optional archival presentation.

Any market around Souls must preserve a clean rule: the buyer acquires the Soul and its public history, never the seller's active civilization, secret map, command capabilities, competitive standing, operator reputation, or sanctions. Transfer and ownership-epoch provenance must be prominent wherever Soul relationships or history are shown.

## Success metrics

### North-star metric

The share of source-season eligible controllers who complete at least three meaningful strategic interactions and then create a valid Seat and finalize one ranked action in the next comparable Human League season.

A meaningful interaction is a state-changing action involving another player or a contested objective—for example combat, reinforcement, rescue, a coordinated beacon contribution, or a reciprocal alliance action. Routine self-transfers and spam do not count.

### Initial targets

| Area | Target |
| --- | --- |
| Home search available to finalized Founding Planet | Under 5 minutes p50 wall-clock; incident-affected cohorts reported separately |
| Tutorial completion | At least 60% |
| Day-1 retention | At least 30% |
| Day-7 retention | At least 15% |
| Return for next season | At least 25% |
| Submitted transaction success | At least 99%, excluding explicit rule rejection |
| Social/competitive participation | At least 40% complete one meaningful PvP or cooperation event |
| Client privacy | Zero coordinate values in logs, analytics, crash reports, or replay tools |

These targets are learning thresholds, not promises. They use the [PRD metric definitions](10-product-requirements.md#metric-event-and-cohort-definitions) and are segmented by new/returning player, wallet type, device capability, and proof latency.

## Positioning language

Use:

> One Soul. Infinite worlds. Verifiable history.

Supporting line:

> Universes reset. Civilizations disappear. The Soul remembers.

Avoid:

- “Dark Forest on Sui,” which implies a port and inherits another game's brand.
- “Play-to-earn,” which misstates the product goal.
- “Your NFT hero levels forever,” which suggests permanent competitive advantage.
- “Everything happens onchain,” unless the onchain/offchain boundary is explained precisely.
- “An endless season,” which misstates the bounded seasonal design.
- “Built on Stellar,” because the product is built on Sui and has no Stellar-network affiliation.
