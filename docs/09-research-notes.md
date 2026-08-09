# Research Notes

This document records primary references behind the planning assumptions. It is not a substitute for pinning exact dependency and network versions during implementation.

## Sui primitives

- [Sui Groth16 documentation](https://docs.sui.io/develop/cryptography/groth16) documents Move verification over BN254 or BLS12-381, the current maximum of eight public inputs, and the requirement to pin a production verifying key generated through a proper trusted setup.
- [Sui derived objects](https://docs.sui.io/develop/objects/derived-objects) documents deterministic `(parent, key)` addresses, one-per-key uniqueness, and independent operation after creation without routing ordinary writes through the parent.
- [Sui JSON-RPC migration guide](https://docs.sui.io/develop/accessing-data/json-rpc-migration) marks JSON-RPC deprecated and directs new integrations toward gRPC or GraphQL. It also explains gRPC streams, retention, and production endpoint expectations.
- [Sui custom indexing framework](https://docs.sui.io/develop/accessing-data/custom-indexer/) describes checkpoint processing and PostgreSQL-backed examples.
- [Sui onchain randomness](https://docs.sui.io/sui-stack/on-chain-primitives/randomness-onchain) documents the `Random` object and resource-exhaustion considerations for randomness-dependent Move flows.
- [`sui::package::make_immutable`](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/package.move) consumes an `UpgradeCap`; the production plan relies on this enforced immutability rather than manifest text alone.
- [Sui repository](https://github.com/MystenLabs/sui) is the primary source for framework APIs, protocol configuration, and release behavior.

## Dark Forest reference boundary

- [Dark Forest v0.6](https://github.com/darkforest-eth/darkforest-v0.6) is GPL-3.0 licensed.
- Its historical movement circuit declares seven public inputs and three public outputs. Because circuit outputs are public signals, the design must not assume that circuit can be verified unchanged under Sui's current eight-input limit.
- Dark Forest is a precedent for private-coordinate strategy, local proving, plugins, and seasonal universes. It is not a source of branding, art, prose, or automatically reusable implementation for this project.

## Soulidity integration baseline

The current Soulidity protocol already models a canonical `SoulState` with `current_owner` and an incrementing `ownership_epoch`. A supported Market purchase rotates the owner and increments the epoch; listing alone does not. Existing grants snapshot the epoch and become unusable after owner rotation. Veilworld should compose with those invariants rather than create a second owner registry.

The current core does **not** provide Scene/Outcome fields, structured relationship or season records, a starter-Soul primitive, or a Runtime Lock. Veilworld receipts therefore remain external objects associated by canonical IDs. A holder-approved narrative memory update is a separate Soulidity transaction. Blocking transfers during a season would require a future Soulidity market/transfer-policy extension; a Veilworld-only lock cannot enforce it.

Implementation work must pin the exact Soulidity package and interface version used by each season.

## Claims requiring prototype validation

- Real proof time and memory on representative browsers.
- Exact gas cost of Groth16 verification and bounded arrival settlement.
- Whether action-hash packing is safe and ergonomic within the public-input limit.
- Contention behavior of registry shards and popular destination planets.
- Derived-object API availability and behavior on the target Sui release.
- gRPC and GraphQL SDK maturity for all required client paths.
- Checkpoint source retention and rebuild time at production scale.
- Sponsor UX and abuse cost.

Record measurements with hardware, browser, Sui version, package revision, circuit hash, dataset, and test command. Do not promote a benchmark into a product claim without that context.
