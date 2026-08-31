# Infinite Stellar Phase Handoff

## Phase

Worker exploration and encrypted map vault

## Status

Complete as a local gameplay-foundation phase. No production proof, signed Sui
gameplay transaction, deployment, commit, or push occurred.

## Goal

Replace instant main-thread frontier reveal and plaintext session persistence
with deterministic exact-hash Worker mining and authenticated encrypted device
storage.

## Outcome

- A versioned worker protocol accepts bounded, typed mining batches and returns
  progress, completion, cancellation, or error messages.
- Four 64×64 chunks form one deterministic square-spiral batch around the
  founding Planet. The current browser measured approximately 11.6k hashes per
  second for the exact Round 5 MiMC implementation.
- Mining performs exact planet-rarity and Perlin/biome evaluation off the main
  thread, reports live progress, and can be cancelled without merging partial
  or stale results.
- Worker findings are recomputed and checked on the main thread before a cached
  Planet is revealed or a newly found Planet is inserted.
- The Active strategy map now ingests mined Planets without duplicate location
  IDs and advances its explored frontier only after a completed batch.
- Controller sessions are AES-GCM encrypted and authenticated under a random,
  non-extractable device key. The key and ciphertext are stored in separate
  IndexedDB object stores.
- A valid legacy plaintext session migrates once into the encrypted vault and
  is removed from `localStorage`.
- Mining, cancellation, measured hash rate, and vault status are visible in the
  map UI. The status toast and frontier readout no longer overlap.

## Security boundary

The device vault improves at-rest handling; it is not an XSS boundary. A
compromised same-origin script, browser extension, or device can use the active
browser context. Portable key wrapping, user export/restore, loss recovery, and
an independent client security review remain production release gates.

The Founding Planet onboarding search still uses the deterministic demo
fixture. This phase applies real mining to Active-strategy frontier exploration
and does not claim a production Groth16 prover, verifier, or proof pipeline.

## Main changed paths

- `packages/game-sdk/src/miner.ts`
- `packages/game-sdk/src/strategy.ts`
- `packages/game-sdk/src/persistence.ts`
- `packages/game-sdk/test/miner.test.ts`
- `apps/web/src/miner.worker.ts`
- `apps/web/src/miner-client.ts`
- `apps/web/src/session-vault.ts`
- `apps/web/src/session-vault.test.ts`
- `apps/web/src/use-player-journey.ts`
- `apps/web/src/StrategyConsole.tsx`
- `apps/web/src/GameShell.tsx`
- `apps/web/src/styles.css`
- `README.md`
- `docs/13-player-vertical-slice.md`

## Verification

- Game SDK typecheck and production build pass.
- Web typecheck and production build pass; Vite emits a dedicated 10.17kB
  `miner.worker` asset.
- Game SDK: 35/35 tests pass.
- Web: 12/12 tests pass.
- ESLint passes with zero warnings.
- Markdown lint passes across 35 files.
- `git diff --check` passes.
- Live in-app browser verification at `http://127.0.0.1:4174/` passes for
  progressive mining, completion, immediate cancellation, encrypted-vault
  status, responsive map control, and non-overlapping overlays.

## Repository and release state

- The broader Dark Forest parity worktree remains intentionally uncommitted.
- No commit, push, Vercel deployment, Sui package publish, or onchain write
  occurred in this phase.
- The existing public canary remains the earlier sealed release and does not
  contain this phase.

## Exact next action

Start a separate proof-pipeline phase: pin the production circuit statements
and golden vectors, then add a Worker proof-artifact loader without enabling
ranked Sui writes. Portable vault wrapping/export/restore remains a parallel
production requirement.
