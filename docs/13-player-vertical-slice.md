# Player Vertical Slice

## Purpose

This vertical slice turns the P0 Move foundation into a runnable player journey. It proves the product flow from an address and Soul selection to an Active civilization without pretending that unresolved Soulidity or ZK interfaces exist.

The slice is a product and integration baseline, not a complete Dark Forest-style season. It deliberately stops after the Founding Planet is established.

## What a player can do

The English web client supports this complete implemented journey:

1. Open Infinite Stellar and connect a Sui wallet on testnet if desired.
2. See that live ranked enrollment is unavailable while deployment and adapters are unpinned.
3. Enter a clearly labeled local simulation with three deterministic demo Souls.
4. Select a Soul and review the fixed-controller Season Seat consequences.
5. Approve simulated enrollment and wait through a checkpoint-shaped finality state.
6. Enter the sealed lobby with an `AwaitingHome` Civilization and zero Planets.
7. Open the simulated universe and unlock local-only Founding Planet search.
8. Generate a deterministic candidate, commitment, and proof-shaped digest while keeping coordinates and salt local.
9. Approve a simulated claim, wait for finality, and activate the Civilization.
10. Inspect the Active dashboard, fixed Seat authority, local vault status, and explicitly locked movement system.

The journey persists by controller address in browser storage. Reloading resumes an existing local Seat before offering Soul selection. Restarting clears only that controller-scoped simulation.

## Capability matrix

| Capability | Player client | Game SDK | Sui Move | Production status |
| --- | --- | --- | --- | --- |
| Wallet connection and testnet identity | Real Mysten dApp Kit | Address input | Not required for read-only connection | Available |
| Eligible Soul list | Deterministic demo fixtures | Typed `SoulCandidate` | Fail-closed `soul_adapter` boundary | Production unavailable |
| Existing-Seat-first routing | Local persisted Seat | Pure route resolver | Deterministic fixed-controller Seat | Demo available; chain query pending deployment |
| Enrollment | Approval and finality UX | Typed state transitions | Atomic Seat/binding/capacity invariants | Demo available; signed production builder unavailable |
| Universe opening | Simulated keeper action | Real transaction builder seam | Permissionless Sui Random transition | Builder available; deployment unavailable |
| Founding Planet search | Local browser operation | Deterministic fixture search | No private coordinates stored | Demo fixture only |
| Home claim | Approval and finality UX | Fail-closed production builder | Proof-bound atomic activation | Demo available; production verifier unavailable |
| Active dashboard | Real client projection of local session | Typed Active snapshot | Canonical state exists in Move | Demo projection; chain read pending deployment |
| Movement, combat, recovery, Last Light | Explicitly locked | Not implemented | Not implemented | Out of slice |

## Architecture

```text
Sui wallet
    │ address/network only
    ▼
React player client ───── controller-scoped browser persistence
    │
    ▼
@infinite-stellar/game-sdk
    ├── pure journey state machine
    ├── deterministic demo fixture adapter
    ├── Seat-first route resolver
    ├── Sui transaction gateway
    └── production enrollment/claim fail-closed gates
              │
              ▼
       infinite_stellar Move package
       (undeployed in this repository)
```

The client never treats a demo transition as a Sui transaction. Demo screens, status pills, approval copy, footer, and live-region messages identify the simulation. The live testnet route reports each missing production gate and cannot create an enrollment or home-claim transaction.

## Workspace

```text
apps/web/
  src/App.tsx                 wallet-aware app composition
  src/GameShell.tsx           player screens and narrative routing
  src/use-player-journey.ts   persistence and finality orchestration
  src/styles.css              responsive visual system

packages/game-sdk/
  src/types.ts                canonical client types
  src/journey.ts              pure transition rules
  src/routing.ts              existing-Seat-first decision
  src/persistence.ts          controller-scoped storage contract
  src/demo.ts                 deterministic local fixtures
  src/sui-gateway.ts          Sui transaction builders and hard gates
```

## Run and validate

```bash
npm ci
npm run dev
```

The development server listens on `http://127.0.0.1:4173`.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Move validation remains independent:

```bash
cd move/infinite_stellar
sui move build --warnings-are-errors
sui move test --threads 1 --warnings-are-errors
sui move lint
```

## Safety and privacy boundary

- The local demo creates no wallet signature, Sui digest, Soul history, or public game record.
- Demo transaction digests are deterministic fixtures and are never shown as explorer links.
- Exact candidate coordinates and salt stay in controller-scoped browser storage for this prototype. This storage is not encrypted and is labeled as demo-only; a production encrypted vault, export, and recovery design remains a release gate.
- Production enrollment throws `SOUL_ADAPTER_UNAVAILABLE` until the exact manifest-pinned Soulidity adapter is compatible.
- Production home claiming throws `PROOF_VERIFIER_UNAVAILABLE` until the circuit and verifier are pinned.
- Public keeper builders require package and object IDs and throw `DEPLOYMENT_UNAVAILABLE` otherwise.
- A Soul transfer never transfers the fixed Season Seat, Planet authority, or local controller-scoped vault.

## Exit evidence

The slice is complete when the locked workspace install is reproducible, SDK and web tests pass, TypeScript and ESLint checks pass, the production bundle builds, the player journey works at desktop and mobile widths, and all existing Move tests remain green.

This evidence validates the vertical slice only. It is not an audit, deployment, mainnet claim, or completion claim for the full game.
