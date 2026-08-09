# Soulidity Veilworld

> The universe resets. Civilizations disappear. The Soul carries its memories into every new season.

Soulidity Veilworld is the working title for a Sui-native, zero-knowledge, fully onchain strategy game inspired by the hidden-information frontier opened by Dark Forest. It is not an EVM port and it is not a Dark Forest fork. The design starts from Sui's object model, parallel execution, and native Groth16 verification, then gives Soulidity Souls a meaningful role as persistent commanders across otherwise ephemeral worlds.

This repository is a **planning and pre-production specification**. It contains product decisions, game rules, protocol boundaries, engineering gates, security requirements, and a release plan. It does not yet contain a playable implementation.

## Product thesis

Veilworld is a seasonal universe that players explore without revealing private coordinates. Each season, a player builds a civilization, discovers planets, moves energy, forms alliances, and competes around a public endgame objective. The authoritative rules and outcomes live on Sui. Private map knowledge and proof generation remain on the player's device.

The durable player identity is a Soul:

- A **Soul** is the persistent actor: personality and identity, with Veilworld planning external relationship and career receipts around it.
- A **Commander Projection** is the Soul's temporary role in one season.
- A **Civilization** is the disposable strategic state: planets, fleets, energy, resources, and score.

A Soul is more than an avatar because it carries personality, relationships, and memory. It is less than a traditional hero because it carries no permanent combat power. It sits above the empire because the empire ends while the Soul continues.

## Non-negotiable principles

1. **Sui-native, not Solidity-shaped.** No single mutable global universe object. Planet-level state must remain independently addressable and parallelizable.
2. **Honest hidden information.** Coordinates and discovery paths stay local; valid actions carry zero-knowledge proofs bound to their exact intent.
3. **Onchain authority, offchain acceleration.** Indexers, relayers, sponsors, and rendering may improve UX, but none may decide game outcomes.
4. **Seasonal equality.** Soul age, rarity, price, and editable personality files never grant ranked power.
5. **A Soul is not an empire.** Selling or transferring a Soul never transfers a player's planets, fleets, coordinates, or season seat.
6. **No token-first economy.** Season 0 has no fungible token, land sale, yield loop, or pay-to-win market.
7. **Verifiable operations.** Every production season pins package, circuit, client, and configuration hashes before play begins.

## First playable target

The first public target is a web-first Sui testnet season:

- 100–300 active players in one world.
- A seven-day season.
- Explore, discover, claim, grow, move, attack, defend, and score.
- Browser-local proving in a Web Worker.
- Sponsored transactions and a guest tutorial.
- Human League (policy-enforced, not bot-proof) for initial ranked competition; Open Agent League follows after the human game is stable.
- No token and no trading advantage.

Mainnet is gated by circuit, contract, performance, privacy, indexer-rebuild, and operations criteria—not by a calendar promise.

In the current Soulidity protocol, Veilworld can validate canonical Soul ownership and `ownership_epoch`, then issue its own frozen receipts associated with a Soul. Structured relationships and season outcomes are planned Veilworld features, not fields that already exist in `SoulState`. Any narrative memory update requires a separate transaction approved by the current holder.

## Repository map

| Document | Purpose |
| --- | --- |
| [Product vision](docs/01-product-vision.md) | Audience, experience, positioning, boundaries, and success metrics |
| [The role of Soul](docs/02-soul-role.md) | Canonical identity model, seasonal binding, transfer behavior, and progression |
| [Game design](docs/03-game-design.md) | Core loop, season structure, resources, conflict, alliances, and endgame |
| [Technical architecture](docs/04-technical-architecture.md) | Sui objects, Move modules, ZK design, client, indexer, and data flow |
| [Security and privacy](docs/05-security-and-privacy.md) | Threat model, circuit risks, operational controls, and launch gates |
| [Roadmap](docs/06-roadmap.md) | Go/no-go prototype through staged mainnet release |
| [Launch and live operations](docs/07-launch-and-live-ops.md) | Season publishing, community, support, incidents, and measurement |
| [Decision log](docs/08-decisions.md) | Accepted decisions, hypotheses, and unresolved choices |
| [Research notes](docs/09-research-notes.md) | Primary references and claims that require prototype validation |

## Intended repository evolution

If the technical prototype passes its gates, this repository becomes the product monorepo rather than being discarded. The intended top-level implementation layout is:

```text
apps/
  web/                 player client
packages/
  game-sdk/            typed game actions and state projection
  prover/              worker protocol and proof artifact loader
  shared-math/         canonical fixed-point and hash test vectors
move/
  veilworld/           Sui Move package
circuits/
  location/            Circom sources and tests
services/
  indexer/             checkpoint ingestion and PostgreSQL projections
  sponsor/             rate-limited transaction sponsorship
ops/
  seasons/             signed season manifests and release procedures
```

No implementation directories should be created merely to imply progress. They are added when their workstream starts and each must include tests and reproducible build instructions.

## Current status

- **Phase:** Planning / pre-production
- **Network:** Undeployed
- **License:** Not yet selected
**Primary decision required next:** complete the three-week technical go/no-go prototype described in the [roadmap](docs/06-roadmap.md).

Dark Forest v0.6 is GPL-3.0 licensed. Veilworld should use original product identity, art, writing, Move code, and circuits unless the team deliberately accepts the obligations of incorporating GPL-licensed material. See [research notes](docs/09-research-notes.md).
