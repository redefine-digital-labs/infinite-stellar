# Infinite Stellar Move Foundation

This package is the first bounded Sui Move implementation of Infinite Stellar's
ranked-season foundation. It is experimental and unaudited. Version 1 is
published to Sui testnet with a sealed, non-player interface canary; see the
[immutable deployment record](../../ops/deployments/sui-testnet-v0.1.0.json).

Implemented modules:

- `bootstrap`: creates one manifest and its bounded shared roots.
- `season`: one-way universe opening, observation timing, capped availability,
  global home-window resolution, pause accounting, settlement guards, and
  immutable circuit geometry.
- `rules_geometry`: the cross-language Poseidon commitment to radius, rarity,
  MiMC/Perlin parameters, and the home band.
- `identity`: deterministic Seats, controller/Soul uniqueness, atomic capacity,
  Commander Projections, Civilizations, and ScoreCards.
- `soul_adapter`: compile-time-pinned canonical Soulidity `SoulState` enrollment
  adapter; no Soul custody or client-supplied ownership fact.
- `planet`: closed verifier seam and atomic Founding Planet activation.
- `circuit_config`: per-action circuit, key, ceremony, and artifact identity.
- `proof_actions`: recomputes claim/move/move-new intent, verifies Groth16, and
  creates package-internal witnesses only after successful verification.
- `zk_verifier`: Sui-native Groth16 byte bridge and fail-closed production
  readiness probes.
- `voyage`: nonce-consuming fleet dispatch and deterministic delayed arrivals.

The test suite executes real development Groth16 proofs through home activation,
fleet dispatch, and atomic natural-Planet initialization plus dispatch,
including Perlin substitution, config substitution, and replay rejection. Those
development configs and adapters are exposed only under `#[test_only]`. Runtime
production config construction and ranked proof acceptance remain impossible
until audited ceremony constants are code-pinned in a later reviewed package
revision. Canonical Soul enrollment is implemented in source but remains
undeployed and cannot produce a playable season without those proof gates.

## Verify

```sh
sui move test -e testnet
sui move build --warnings-are-errors -e mainnet
sui client verify-bytecode-meter --package . -e mainnet --warnings-are-errors
```

See [`docs/12-soul-adapter-contract.md`](../../docs/12-soul-adapter-contract.md)
for the compatibility contract and remaining gates.
