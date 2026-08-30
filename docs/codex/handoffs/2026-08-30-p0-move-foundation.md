# Infinite Stellar Phase Handoff

## Phase

P0 Move foundation with replaceable Soul adapter

## Status

Complete

## Goal

Implement and verify the first Infinite Stellar Sui Move foundation without
freezing the unfinished Soulidity ABI.

## Outcome

The repository now contains an experimental standalone Move package for
manifest/runtime creation, deterministic fixed-controller enrollment, bounded
capacity, `AwaitingHome`, native-random universe opening, observation timing,
capped home availability, global close resolution, a fail-closed Soul adapter
seam, and atomic Founding Planet activation. Twenty-four adversarial Move tests
pass, and public status/integration documentation now reflects the implemented
foundation without describing it as playable or deployed.

## In scope

- Standalone `move/infinite_stellar` package and generated lockfile.
- Fail-closed Soul and proof adapter seams.
- Deterministic Seat and Planet derived-object identities.
- Conservative global home-window liveness accounting.
- English implementation and status documentation.

## Non-goals

- Final Soulidity ABI or live Soul enrollment.
- Production ZK circuit or verifier.
- Movement, combat, recovery, Last Light, client, indexer, or deployment.
- Git commit or push.

## Durable decisions

- Core game modules never import an unfinished Soul type. Only `soul_adapter`
  may normalize a pinned Soulidity package into a non-storable,
  package-internal binding.
- Pure fixed-controller Seat actions remain usable after Soul transfer, while
  Soul-attributed writes require a fresh live adapter validation.
- Production Soul enrollment and home-proof submission remain fail-closed
  until their pinned integrations exist.

## Changed paths

- `README.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `docs/08-decisions.md`
- `docs/10-product-requirements.md`
- `docs/11-onboarding-and-narrative-flow.md`
- `docs/12-soul-adapter-contract.md`
- `docs/codex/PROJECT_MEMORY.md`
- `docs/codex/CURRENT.md`
- `move/infinite_stellar/`

## Verification

- `sui move build --warnings-are-errors`: PASS
- `sui move test`: 24/24 PASS
- `sui move lint`: PASS
- `markdownlint-cli2`: 21 files, PASS
- `git diff --check`: PASS
- English-only public-content audit: PASS

The one suppressed Move lint is the intentional `public_random` annotation on
the one-way Sui Random opening entry point.

## Risks and open gates

- Soulidity package/type and kiosk/listing/epoch semantics are not frozen;
  `production_adapter_ready()` remains false.
- The home-proof seam has test fixtures only; no production circuit or onchain
  verifier exists.
- The Move package is experimental, unaudited, undeployed, and not a playable
  game.
- `sui move format` could not run because `prettier-move` is not installed on
  the host. No global package was installed implicitly.

## Recovery point

Implementation baseline:
`34cfbcde3a802d7317dfa5e1b7983fa20db9e7e7`. All phase changes remain
uncommitted in the Infinite Stellar worktree.

## Exact next action

Freeze a versioned Soulidity integration fixture and implement the production
`soul_adapter` against one exact local or pinned Soul package. Add canonical
Soul/SoulState, kiosk/listing, transfer, stale-epoch, wrong-package, and rollback
integration tests before exposing ranked enrollment.
