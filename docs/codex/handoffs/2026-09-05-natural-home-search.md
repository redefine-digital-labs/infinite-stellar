# Natural Home Search and Fixture Removal

Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`.
Branch: `codex/dark-forest-parity`. No chain write was made.

## Implemented

- `home-search.ts`: random public home-region sampling and exact verified
  Round-5 home predicates (Perlin 13–14 exclusive, rarity, level/type, radius).
- `home-search-client.ts`: real Worker search, honest coordinate counts,
  completed-footprint checkpoints, cancellation and local continuation.
- `demo-entry.ts` and player hook/shell: preserve local Soul/Seat, perform real
  search before activation, keep searched knowledge, pause/resume/relocate.
  No fake proof digest. This is still a local simulation, not a Sui claim.
- `createStrategyGame` requires a verified mined Home and generates no hidden
  neighbors. Original hash bonuses/biome apply, with Home energy 50,000.
  FNV geography and the retyped rift were removed from runtime; controlled
  ability-test fixtures live only in `test/strategy-fixture.ts`.
- Discovery and explorer/camera boundary guards use the universe origin,
  not the player's Home. Existing active saves are never regenerated.

## Verification

Full Node 24.20.0 release validation passes all 300 tests (134 web, 128 SDK,
38 prover), types, lint and production build. Busy-host testing exposed a
pre-existing assertion that energy should freeze while navigating; it now
checks stable identity plus nondecreasing energy. Test deadlines were not
increased. Test-only static survey geometry is cloned rather than rehashed
for every UI interaction test.

Real browser: independent searches found BA7DE/5BF92 (16,384 units² each),
and a paused/resumed search found 33073 (4,096 units²). BA7DE then naturally
discovered four neighbors. Refresh retained the five-Planet map, exact
67,584 units² and naturally increased Home energy. No runtime errors; only
the development Lit warning. No private coordinates were uploaded or
included in release evidence. Production evidence will be named in CURRENT.

## Boundary and next

The geography uses pinned Round-5 public keys, not a production Season
manifest. Demo Soul/Seat, simulation authority and all ranked release gates
remain explicit. Active historical saves retain legacy fixtures; only new
games use fully natural bootstrap. Special facilities still need the
original renderer. Next: real witness/proof integration and guarded ranked
home/move/move-new pending/finality, then remaining actions/operations.

The owner subsequently authorized fresh local initialization on every
deployment. Each production Vite build embeds a new playtest namespace;
`scopeLocalDemoVault` ignores older-build/address-only demo saves. Within a
build, navigation and refresh retain search/game progress. Wallets, canonical
Souls, ranked map vaults and chain state are outside this reset. Old demo
records are left inactive, not deleted through a broad storage operation.
This supersedes the earlier cross-deployment demo-continuity policy.

Natural-search source `31d4459` reached READY deployment
`dpl_9T54gNMKPfovhkxq2E3gAECB1M34` before the reset-policy addition. Final
combined source `3a6826d` is READY as `dpl_5EfcU2Ho6sokh682gbSUzcKFct2i`.
Full validation passes 302 tests (136 web, 128 SDK, 38 prover), types/lint/build.
Production alias with an older two-Planet save now starts at welcome. Real
Worker search found 4BF54 with 6,144 searched units²; another refresh retains
it with energy growing from 54,980 to 62,631. HTTP/security headers pass, with
no new browser warnings/errors. Evidence:
`ops/deployments/vercel-production-2026-09-05-natural-home-reset.json`.

Rollback: previous entry deployment `dpl_AnUCr63FyzusegXHg58wAi8GnPcz`.
A newly built rollback also initializes a fresh local playtest under the
owner's policy. Never reset wallet/Soul/ranked/chain data.
