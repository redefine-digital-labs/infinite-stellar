# Infinite Stellar Phase Handoff

## Phase

Spacetime Rip parity correction

## Status

Complete as an independently written local gameplay, Sui rule, and interface
phase. Production wallet-owned artifact custody remains fail-closed.

## Goal

Correct the previous Trading Post interpretation by adopting Dark Forest v0.6
Round 5 Spacetime Rip behavior: a controllable universe bridge for silver
extraction and artifact movement between the universe and external custody.

## Official behavior pinned

- Spacetime Rips are one of the five canonical planet types.
- A controlled Rip can withdraw silver for score.
- Artifacts enter and leave the universe through controlled Rips.
- Rip level constrains artifact rarity in the original rules.
- Ships are not deposited or withdrawn through Rips.
- A Spacetime Rip is distinct from a Wormhole artifact.

Primary references:

- <https://blog.zkga.me/announcing-v6>
- <https://blog.zkga.me/v6-r5-announce>
- <https://github.com/darkforest-eth/darkforest-v0.6>

## Outcome

- SDK and Move now use canonical `SpacetimeRip` terminology while preserving
  numeric planet type code `3` and the existing integer rules.
- Move exposes `planet_spacetime_rip()` and retains the prior function name only
  as a compatibility alias to the same value.
- Strategy state supports silver extraction, artifact warp to local wallet
  custody, and artifact warp back into the universe only at a controlled,
  intact Rip.
- The full-screen map renders an original animated Rift marker and a dedicated
  Rift Gate surface in the floating Planet/Fleet window.
- The Artifact Bridge is directly reachable from the Rift Gate.
- The local scenario schema advanced to version `5` so stale sessions cannot
  retain the previous type model.

## Local showcase disclosure

The bounded 48-coordinate local slice has no naturally derived type-3 planet.
For discoverability, the non-ranked local scenario deterministically turns one
eligible non-home regular planet into a showcase Rip and applies the canonical
defense and silver-capacity transforms. This overlay is not used by ranked
play, Move tests, proof vectors, or canonical location derivation.

## Production boundary

The current browser experience models external artifact custody locally. The
Move Artifact remains a shared object with a logical `external_owner` field.
It is not yet transferred into a wallet-owned Sui object wrapper, and the web
client has no production signed Rift transaction builder. The product copy and
architecture documents state this boundary, and the production adapter remains
fail-closed.

## Main changed paths

- `apps/web/src/StrategyConsole.tsx`
- `apps/web/src/StrategyConsole.test.tsx`
- `apps/web/src/styles.css`
- `apps/web/vite.config.ts`
- `packages/game-sdk/src/round5-rules.ts`
- `packages/game-sdk/src/strategy.ts`
- `packages/game-sdk/src/persistence.ts`
- `packages/game-sdk/test/round5-rules.test.ts`
- `packages/game-sdk/test/strategy.test.ts`
- `move/infinite_stellar/sources/round5_rules.move`
- `move/infinite_stellar/sources/artifact.move`
- `move/infinite_stellar/sources/planet.move`
- `docs/14-dark-forest-v06-parity.md`
- `docs/15-round5-sui-architecture.md`
- `README.md`

## Verification

- Game SDK: 32/32 tests pass.
- Web: 8/8 tests pass.
- Move: 52/52 tests pass with warnings treated as errors.
- TypeScript and ESLint pass.
- SDK and web production builds pass.
- Markdown lint passes across 34 files.
- `git diff --check` passes.
- The running local browser was inspected at `http://127.0.0.1:4174/`;
  target-state Rift Gate, extraction gating, and Artifact Bridge are visible.

## Repository and release state

- The worktree remains intentionally uncommitted.
- No push, Vercel deployment, or Sui transaction occurred.
- The existing public canary remains the earlier sealed release.

## Exact next action

Only after explicit authorization, define a wallet-owned `RiftArtifact` or
equivalent custody wrapper, freeze the adapter ABI, add signed Sui transaction
builders and wallet inventory reconciliation, audit ownership and replay
invariants, and publish a new testnet package for end-to-end withdrawal and
redeposit testing before considering production deployment.
