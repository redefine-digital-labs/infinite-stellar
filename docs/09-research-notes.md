# Research Notes

This document records primary references behind the planning assumptions. It is not a substitute for pinning exact dependency and network versions during implementation.

## Sui primitives

- [Sui Groth16 documentation](https://docs.sui.io/develop/cryptography/groth16) documents Move verification over BN254 or BLS12-381, the current maximum of eight public inputs, and the requirement to pin a production verifying key generated through a proper trusted setup.
- [Sui derived objects](https://docs.sui.io/develop/objects/derived-objects) documents deterministic `(parent, key)` addresses, one-per-key uniqueness, and independent operation after creation without routing ordinary writes through the parent.
- [Sui JSON-RPC migration guide](https://docs.sui.io/develop/accessing-data/json-rpc-migration) marks JSON-RPC deprecated and directs new integrations toward gRPC or GraphQL. It also explains gRPC streams, retention, and production endpoint expectations.
- [Sui custom indexing framework](https://docs.sui.io/develop/accessing-data/custom-indexer/) describes checkpoint processing and PostgreSQL-backed examples.
- [Sui onchain randomness](https://docs.sui.io/sui-stack/on-chain-primitives/randomness-onchain) documents the `Random` object and resource-exhaustion considerations for randomness-dependent Move flows.
- [`sui::clock`](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/clock.move) shows that the singleton Clock is updated by the consensus-commit prologue. Clock delay and checkpoint separation are therefore treated as different claims in this plan.
- [Sui checkpoint summary source](https://github.com/MystenLabs/sui/blob/main/crates/sui-types/src/messages_checkpoint.rs) documents monotonic but not strictly increasing checkpoint timestamps. The target network's checkpoint batching, Clock, and finality semantics must be pinned and tested rather than inferred from timestamp inequality.
- [`sui::package::make_immutable`](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/package.move) consumes an `UpgradeCap`; the production plan relies on this enforced immutability rather than manifest text alone.
- [Sui repository](https://github.com/MystenLabs/sui) is the primary source for framework APIs, protocol configuration, and release behavior.

## Dark Forest reference boundary

- [Dark Forest v0.6](https://github.com/darkforest-eth/darkforest-v0.6) is GPL-3.0 licensed.
- Its historical movement circuit declares seven public inputs and three public outputs. Because circuit outputs are public signals, the design must not assume that circuit can be verified unchanged under Sui's current eight-input limit.
- Dark Forest is a precedent for private-coordinate strategy, local proving, plugins, and seasonal universes. It is not a source of branding, art, prose, or automatically reusable implementation for this project.

## Soulidity integration baseline

The current Soulidity protocol already models a canonical `SoulState` with `current_owner` and an incrementing `ownership_epoch`. A supported Market purchase rotates the owner and increments the epoch; listing alone does not. Existing grants snapshot the epoch and become unusable after owner rotation. Infinite Stellar should compose with those invariants rather than create a second owner registry.

The current core does **not** provide Scene/Outcome fields, structured relationship or season records, a starter-Soul primitive, or a Runtime Lock. Infinite Stellar receipts therefore remain external objects associated by canonical IDs. Soulidity permits owner or authorized live `MEMORY`-grantee appends; the stricter official Infinite Stellar Chronicle flow requires a separate transaction directly signed by the current holder and never uses delegated grant authority. Blocking transfers during a season would require a future Soulidity market/transfer-policy extension; an Infinite Stellar-only lock cannot enforce it.

Implementation work must pin the exact Soulidity package and interface version used by each season.

## Product integration references

- The [Soulidity repository](https://github.com/redefine-digital-labs/soulidity) is the source for the canonical identity package and ownership-epoch behavior. A season must pin a reviewed interface rather than track a moving branch.
- The [Animacraft repository](https://github.com/redefine-digital-labs/animacraft) is the intended source for versioned visual projection and provenance commitments. Those commitments can identify evidence or terms but do not themselves grant animation, modification, commercial-display, duration, or post-transfer rights. Infinite Stellar requires a separate accepted display-license resolver or uses a neutral fallback; planning does not imply that every authoring or protected-asset path is production-ready.
- [Infinite Flow Engine](https://github.com/redefine-digital-labs/infinite-flow-engine) is a bounded Scene/SoloRun engine that requires a canonical Soul/profile and records persistent Run history. It may frame a separate Soul-bound prologue or PvE experience, but it cannot provide the no-Soul guest tutorial and is not the multiplayer universe authority.

## Name and brand boundary

- The [Stellar Development Foundation brand policy](https://stellar.org/brand-policy) identifies “Stellar” as a word trademark and states that using it in a product or project name requires prior written consent. Infinite Stellar uses the word astronomically, is built on Sui, and is not affiliated with the Stellar network, but written consent has not been obtained. The public working name is unconfirmed and may require another rename. D-023 records a project-owner-authorized, unannounced technical canary on the existing GitHub repository, Sui testnet, and a default Vercel URL; it is not evidence of consent and does not open custom domains, social accounts, app-store listings, campaigns, events, commercial announcements, mainnet, or a promoted public launch.
- An exact [Infinite-Stellar architectural lighting product](https://assets.zaneen.com/series/Infinite-Stellar/A5INST-MOD-SYS.pdf) also exists. Product-name review must cover software/game classes, target markets, domains, stores, and social accounts before commercial launch.

## Claims requiring prototype validation

- Real proof time and memory on representative browsers.
- Exact gas cost of Groth16 verification and bounded arrival settlement.
- Whether action-hash packing is safe and ergonomic within the public-input limit.
- Contention behavior of registry shards and popular destination planets.
- Derived-object API availability and behavior on the target Sui release.
- gRPC and GraphQL SDK maturity for all required client paths.
- Checkpoint source retention and rebuild time at production scale.
- Clock-delay, consensus-commit, checkpoint-batching, finality, and same-checkpoint ordered-event reconstruction on the target Sui release.
- Sponsor UX and abuse cost.

Record measurements with hardware, browser, Sui version, package revision, circuit hash, dataset, and test command. Do not promote a benchmark into a product claim without that context.
