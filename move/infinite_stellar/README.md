# Infinite Stellar Move Foundation

This package is the first bounded Sui Move implementation of Infinite Stellar's
ranked-season foundation. It is experimental and unaudited. Version 1 is
published to Sui testnet with a sealed, non-player interface canary; see the
[immutable deployment record](../../ops/deployments/sui-testnet-v0.1.0.json).

Implemented modules:

- `bootstrap`: creates one manifest and its bounded shared roots.
- `season`: one-way universe opening, observation timing, capped availability,
  global home-window resolution, pause accounting, and settlement guards.
- `identity`: deterministic Seats, controller/Soul uniqueness, atomic capacity,
  Commander Projections, Civilizations, and ScoreCards.
- `soul_adapter`: closed production seam for the unfinished Soulidity ABI.
- `planet`: closed verifier seam and atomic Founding Planet activation.

The production Soul adapter and ZK verifier are intentionally unavailable.
Their fixture constructors exist only under `#[test_only]`; this package cannot
yet enroll a real Soul or accept a real location proof.

## Verify

```sh
sui move build --warnings-are-errors
sui move test
```

See [`docs/12-soul-adapter-contract.md`](../../docs/12-soul-adapter-contract.md)
for the compatibility contract and remaining gates.
