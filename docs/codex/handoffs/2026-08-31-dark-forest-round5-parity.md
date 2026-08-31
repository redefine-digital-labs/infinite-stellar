# Infinite Stellar Phase Handoff

## Phase

Dark Forest v0.6 Round 5 gameplay parity

## Status

Complete as a local compatibility and Sui state-machine phase. Production
Soulidity and zero-knowledge integrations remain fail-closed.

## Goal

Deliver an independently written Infinite Stellar local rules sandbox and Sui
Move implementation with observable behavioral parity to the official Dark
Forest v0.6 Round 5 rules.

## Outcome

The repository now contains exact MiMC/Perlin compatibility vectors, a valid
deterministic private-universe slice, typed Round 5 game rules, Sui Move state
machines, and a responsive English player experience from Soul selection
through expansion, artifacts, scoring, and Last Light. No GPL source, client
asset, branding, prose, or circuit was copied.

## Implemented scope

- Exact BN254 MiMC location hashing and rational three-octave Perlin vectors.
- Planet levels, types, bonuses, space modifiers, pirates, energy, and silver.
- Voyages, reinforcement, combat, conquest, arrival ordering, and pending caps.
- Three upgrade branches and exact integer costs and limits.
- Artifacts, cooldowns, Spacetime Rips, five ships, and compatibility quirks.
- Space junk, abandonment, capture zones, public reveal, score, and settlement.
- Typed fixture-proof Move adapters with production verification fail-closed.
- Local strategy UI with scanning, fleet and silver movement, upgrades, ships,
  artifacts, reveal, capture, score, and Last Light controls.

## Durable decisions

- Behavioral authority is the pinned official Round 5 contract snapshot and
  source-linked parity contract in `docs/14-dark-forest-v06-parity.md`.
- Infinite Stellar retains original identity, narrative, UI, art direction,
  Sui object topology, and Soul-centered commander model.
- Production Soul and hidden-geometry writes remain unavailable until exact,
  independently audited adapters, circuits, and verifying keys are frozen in a
  season manifest.
- The earlier public Vercel/testnet canary is not overwritten by this phase.

## Main changed paths

- `README.md`
- `config/dark-forest-v06-round5.json`
- `docs/13-player-vertical-slice.md`
- `docs/14-dark-forest-v06-parity.md`
- `docs/15-round5-sui-architecture.md`
- `apps/web/src/StrategyConsole.tsx`
- `apps/web/src/GameShell.tsx`
- `apps/web/src/use-player-journey.ts`
- `move/infinite_stellar/sources/`
- `move/infinite_stellar/tests/`
- `packages/game-sdk/src/`
- `packages/game-sdk/test/`

## Verification

- `npm run validate:web`: PASS. Web 4/4, SDK 31/31, TypeScript, ESLint,
  and production builds.
- `sui move test --warnings-are-errors`: PASS. 52/52 tests.
- `npm run lint:docs`: PASS. Zero issues across 31 files.
- `npm run verify:deployment`: PASS for the existing sealed testnet release.
- `git diff --check`: PASS.
- Existing public canary browser journey: PASS through Soul selection, Seat
  creation, private home search, claim, and activation.

## Risks and remaining gates

- Production Groth16 circuits, prover artifacts, and verifying keys are absent;
  fixture proofs are not production verification.
- Soulidity's canonical Soul ABI is not frozen; production ranked enrollment
  remains deliberately unavailable.
- The public Vercel canary is the earlier vertical slice and does not contain
  this worktree's strategy sandbox.
- This worktree is uncommitted. No push or deployment occurred in this phase.

## Recovery

The existing release remains recoverable at commit
`75fe712e4d2349b2e6b57dfa3751dade7921a48d`. Its public surfaces remain:

- <https://github.com/redefine-digital-labs/infinite-stellar>
- <https://infinite-stellar.vercel.app>
- Sui testnet package
  `0x1199adc93f61acd99d6d7889c82650b79c90e51ed3816c8c40d0544f9e2c9665`

## Exact next action

Freeze and audit the production Soulidity adapter ABI plus Groth16 circuits and
verifying keys. Then replace fixture proofs and local mutations with signed Sui
testnet transaction builders before requesting deployment authorization.
