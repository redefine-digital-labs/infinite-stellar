# Infinite Stellar Phase Handoff

## Phase

Chain-backed ranked private map

## Status

Complete. The production client can render an existing Seat through an
authenticated private-coordinate vault merged with deterministic
chain-authoritative point reads. Ranked signing and the Sui mainnet game
release remain correctly blocked.

## Outcome

The SDK now binds each private map to the exact mainnet chain, callable and
type-origin packages, Season, Planet registry, Seat, and controller. It
recomputes each location commitment, MiMC hash, Perlin value, biomebase,
rarity, radius, and exact Sui derived Planet object ID before accepting a
coordinate. Cross-namespace, conflicting, duplicate, or non-monotonic records
fail explicitly.

The browser stores those records in an AES-GCM vault with a non-extractable key
and authenticated namespace. The ranked projection point-reads only the known
derived Planet IDs and the bounded pending Voyage IDs referenced by their
queues. It validates exact BCS, Season, ownership and arrival relations, then
re-reads every object to reject mixed-version snapshots. Ownership, resources,
upgrades, artifacts, nonces, and pending arrivals always come from chain
objects; a local-only discovery is labeled unmaterialized.

An existing Seat can enter a full-screen, pan/zoom ranked universe route with
aligned voyage overlays and floating status panels. It remains read-only. No
ranked command or enrollment button is exposed while the production package,
verifier, ceremony, audit, operations, and multisig gates are absent.

Source commit `e57b78fb61e7154b6ea204cf497613c0567b1194` is pushed to
`origin/codex/dark-forest-parity`. The production alias is
<https://infinite-stellar.vercel.app>. Immutable deployment
<https://infinite-stellar-f6py0b0wg-soulidity-ai.vercel.app> has ID
`dpl_3AaZeR4b5pSiKVsvSPXtQBG6hxxa`.

## Changed paths

- `packages/game-sdk/src/ranked-map.ts`
- `packages/game-sdk/src/ranked-projection.ts`
- `apps/web/src/ranked-map-vault.ts`
- `apps/web/src/use-ranked-map.ts`
- `apps/web/src/RankedUniverseConsole.tsx`
- `apps/web/src/GameShell.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- Ranked-map, projection, vault, hook, and route tests
- `README.md`
- `docs/04-technical-architecture.md`
- `docs/13-player-vertical-slice.md`
- `docs/17-mainnet-readiness.md`

## Verification

- `npm run validate:web`: PASS; typecheck, lint, production build, and 146
  TypeScript tests.
- `sui move test -e testnet --threads 1 --warnings-are-errors`: PASS, 72/72.
- `npm run verify:soulidity-mainnet`: PASS against canonical Soulidity v1.
- `npm run verify:move-mainnet-dry-run`: PASS, 15 modules and 544,308,000 MIST
  simulated net gas; no transaction submitted.
- `npm audit --audit-level=high`: PASS, zero vulnerabilities.
- Vercel production inspect: READY.
- Production HTTP smoke: PASS, HTTP 200 with CSP, HSTS, frame denial,
  no-referrer, permissions policy, and content-type protection.
- Production browser smoke: PASS, canonical mainnet fail-closed route, missing
  game package and release gates visible, zero enrollment buttons.

## Durable decisions

- Private coordinates stay client-side and are never uploaded to the public
  projection or telemetry.
- Exact chain objects are the only authority for public and competitive state.
- Direct point reads make a private gameplay map independent of global event
  replay. A public checkpoint indexer is still required for discovery,
  leaderboards, spectator views, and operations.
- No development verifier, key, package, audit, or signer substitutes for a
  production release gate.

## Remaining release blockers

- Reproducible production proof ceremony and production verifier activation.
- Independent circuit, Move, SDK, and client audits.
- Infinite Stellar Sui mainnet package and immutable production config.
- Ranked home/miner witness persistence and proof-bound command preparation.
- Public checkpoint indexer, sponsor, monitoring, and two-wallet soak.
- Artifact/ship projection and external Artifact custody.
- Multisig/capability custody, operations approval, and rights clearance.

## Recovery point

The prior ranked projection remains at commits `b0d19c8` and `a9c418a`, with
immutable deployment `dpl_GSRSGUXz9FwXhTHuZg8nGsnQBuHC`. The new implementation
is isolated in source commit `e57b78f`; no Sui state was changed.

## Exact next action

Persist ranked home/miner witnesses into the exact Seat vault and prepare
proof-bound home and fleet command intents behind the existing production
gates. Provision the public checkpoint indexer as a separate public-data path;
it must never receive private coordinates.
