# Player Vertical Slice

## Purpose

This document records the original P0 player-journey slice. The repository has
since expanded beyond this milestone with the local Round 5 strategy sandbox
defined by the [parity contract](14-dark-forest-v06-parity.md) and
[Sui gameplay architecture](15-round5-sui-architecture.md). Production
Soulidity and ZK interfaces remain deliberately fail-closed.

The milestone described below stops after the Founding Planet is established;
the current local client continues into discovery, voyages, combat, upgrades,
artifacts, ships, junk, capture, reveal, score, and Last Light settlement.

## Current map-first strategy shell

After activation, the star map owns the full gameplay viewport. Commander
status, Planet and fleet controls, artifacts and ships, pending voyages, and
the command log are independent windows rather than fixed columns.

- Desktop windows can be focused, dragged, moved with arrow keys, minimized,
  reopened from the dock, and reset to safe defaults. Positions persist locally
  and clamp back inside the current viewport after resize.
- Compact map viewports start with every window docked so the universe fills the
  screen; selecting a Planet opens the Planet and fleet window on demand.
- The Planet and fleet window uses energy and silver sliders with live arrival
  energy and travel-time previews.
- At mobile widths, only one command window is mounted as a bottom sheet. The
  same dock switches sheets, so hidden overlapping panels do not remain in the
  screen-reader tree.
- This layout changes presentation only. Every action still calls the same SDK
  transition and remains a clearly labeled local simulation.

## What a player can do

The English web client supports this complete implemented journey:

1. Open Infinite Stellar and connect a Sui wallet on mainnet if desired.
2. Inspect the live canonical Soul/Seat read evidence and the pinned sealed testnet package. Ranked enrollment remains unavailable because no production game package, proof setup, audit set, or multisig policy is pinned.
3. Enter a clearly labeled local simulation with three deterministic demo Souls.
4. Select a Soul and review the fixed-controller Season Seat consequences.
5. Approve simulated enrollment and wait through a checkpoint-shaped finality state.
6. Enter the sealed lobby with an `AwaitingHome` Civilization and zero Planets.
7. Open the simulated universe and unlock local-only Founding Planet search.
8. Generate a deterministic candidate, commitment, and proof-shaped digest while keeping coordinates and salt local.
9. Approve a simulated claim, wait for finality, and activate the Civilization.
10. Inspect the Active dashboard, fixed Seat authority, local vault status, and explicitly locked movement system.

The journey persists by controller address as AES-GCM-authenticated ciphertext in IndexedDB. Reloading resumes an existing local Seat before offering Soul selection. A valid legacy plaintext session migrates once and is removed from `localStorage`; restarting clears only that controller-scoped simulation.

## Capability matrix

| Capability | Player client | Game SDK | Sui Move | Production status |
| --- | --- | --- | --- | --- |
| Wallet connection and mainnet identity | Real Mysten dApp Kit | Address input | Not required for read-only connection | Available |
| Eligible Soul list | Canonical shared-state discovery plus deterministic demo fixtures | Exact Soul/SoulState/SoulCreated BCS | Fail-closed `soul_adapter` boundary | Mainnet read available; ranked write unavailable |
| Existing-Seat-first routing | Chain route before Soul selection; local persisted demo Seat | Derived key and exact bundle reader | Deterministic fixed-controller Seat | Mainnet read source integrated; no game mainnet objects exist |
| Enrollment | Checked-simulation, wallet, finality, and failure UX | Sender-bound PTB plus exact event/effect reconciliation | Atomic Seat/binding/capacity invariants | Production builder integrated but unreachable while release gates are absent |
| Universe opening | Simulated keeper action | Real transaction builder seam | Permissionless Sui Random transition | Builder and canary objects pinned; canary sealed until 2030 |
| Founding Planet search | Local browser operation | Deterministic fixture search | No private coordinates stored | Demo fixture only |
| Strategy frontier mining | Cancellable browser Worker with visible progress | Exact MiMC/Perlin coordinate evaluation and deterministic square-spiral chunks | No strategic write required | Local sandbox integrated; development proof candidates connected; production artifacts unavailable |
| Home claim | Approval, artifact preflight, proof generation, and finality UX | Fail-closed production builder | Proof-bound atomic activation | Development candidate available; production relation/verifier unavailable |
| Active dashboard | Real client projection of local session | Typed Active snapshot | Canonical state exists in Move | Demo projection; production chain read not implemented |
| Movement, combat, upgrades, artifacts, ships, junk, capture, reveal, score, Last Light | Playable local strategy console | Deterministic compatibility simulator | Typed fixture-proof state machines | Local sandbox integrated; signed production builders unavailable |

## Architecture

```text
Sui wallet
    │ address/network only
    ▼
React player client ───── controller-scoped encrypted IndexedDB vault
    │
    ▼
@infinite-stellar/game-sdk
    ├── pure journey state machine
    ├── deterministic demo fixture adapter
    ├── canonical Soulidity shared-state reader
    ├── deterministic Seat derivation and bundle reader
    ├── Sui transaction gateway
    └── production enrollment/claim fail-closed gates
              │
              ▼
       infinite_stellar Move package
       (pinned testnet foundation; no mainnet game package)
```

The client never treats a demo transition as a Sui transaction. Demo screens, status pills, approval copy, footer, and live-region messages identify the simulation. The mainnet readiness route reads canonical Souls and any pinned deterministic Seat, reports each missing production gate, and cannot expose a signing button until every gate is satisfied.

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
  src/soulidity-reader.ts     canonical shared Soul BCS/event discovery
  src/sui-player-runtime.ts   Seat bundle read, simulation, finality reconciliation
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
- Exact candidate coordinates, salt, and local strategy state are AES-GCM encrypted and authenticated under a non-extractable controller-scoped device key in IndexedDB. The current prototype does not resist same-origin XSS, a compromised browser extension/device, or loss of local storage; portable wrapping, export, restore, and recovery UX remain release gates.
- Production enrollment throws `SOUL_ADAPTER_UNAVAILABLE` for deployment records that do not explicitly pin and enable the compatible canonical Soulidity adapter; a complete mainnet record can construct a sender-bound typed transaction.
- Production home/move/move-new construction throws `PROOF_VERIFIER_UNAVAILABLE` until exact production circuits and verifiers are pinned. When enabled in a reviewed release record, the SDK re-derives the full action statement, checks prepared proof/public-input bytes, simulates with validation enabled, waits for indexed finality, and reconciles exact BCS events/effects before reporting success.
- Existing controller state is point-read by deriving the Season Seat from the exact Move key/type-origin encoding, then BCS-validating its Projection, Civilization, and Score bindings. The ranked React route performs this read before scanning Soul candidates.
- Public keeper builders require complete package and object IDs; the client pins the sealed testnet canary while unconfigured deployments still throw `DEPLOYMENT_UNAVAILABLE`.
- A Soul transfer never transfers the fixed Season Seat, Planet authority, or local controller-scoped vault.

## Exit evidence

The slice is complete when the locked workspace install is reproducible, SDK and web tests pass, TypeScript and ESLint checks pass, the production bundle builds, the player journey works at desktop and mobile widths, and all existing Move tests remain green.

This evidence validates the vertical slice only. The separate deployment record proves the experimental testnet package and sealed canary, but neither artifact is an audit, mainnet claim, live-ranked claim, or completion claim for the full game.
