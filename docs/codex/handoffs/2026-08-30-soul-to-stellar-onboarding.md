# Infinite Stellar Phase Handoff: Soul-to-Stellar Onboarding

## Snapshot

- **Completed:** 2026-08-30
- **Status:** Complete
- **Repository:** `https://github.com/redefine-digital-labs/infinite-stellar`
- **Branch:** `main`
- **Reviewed product commit:** `ae6464e51c8e0db441a8ef8ccbe6b554a5967c81`
- **Starting commit:** `e040089d3eb78e2f0331f5958fc5e196249cf355`

## Outcome

The repository now contains a normative English onboarding and narrative-flow specification for the official client. It defines the complete route from public landing and wallet connection through Soul selection, Animacraft visual input, Commander Projection, deterministic Season Seat, `AwaitingHome` Civilization, local discovery, and the Seat-owned Founding Planet.

The phase also reconciled the World Bible, product vision, Soul role, game design, architecture, security, roadmap, live operations, decision log, research notes, PRD, repository index, contribution guide, and durable project memory.

## Durable decisions

- Addresses authorize. Souls cross. Animacraft gives form. Commander Projections bind roles. Seats control. Civilizations expand. Universes collapse. Echoes remain.
- The official client resolves the deterministic fixed-controller Seat before scanning currently owned Souls. Soul transfer never transfers the Seat, Planets, map vault, score, sanctions, or command authority.
- One address may create at most one ranked Seat per league and season. The manifest-pinned derived Seat is both the logical controller claim and direct lookup; a bounded enrollment-only capacity object enforces the exact Seat cap.
- Atomic enrollment creates the Seat, binding, attribution and score state, Seat-bound unused home state, and `CivilizationState(status = AwaitingHome)`, but no Planet.
- A later finalized `claim_home` creates the Seat-owned Founding Planet and changes the Civilization to `Active`. Pre-home Seats cannot move, score, colonize, or use gameplay recovery.
- `HomeSearchAvailableAt` starts authoritative local work; `HomeClaimAvailableAt` records the onchain submission gate. A nonzero Clock-time observation delay rejects immediate claims without pretending to force checkpoint separation.
- Permissionless capped ticks credit onchain-evidenced home-window availability. At close, global `home_window_resolution` becomes `ClosedAvailable` or `CancelledUnavailable` before any Seat may act or finalize further.
- The map vault is encrypted and namespaced to chain, engine package, season, Seat, and fixed controller. It never follows Soul transfer.
- Animacraft supplies accepted visual material only. `CommanderProjection` is the seasonal binding record, and the neutral fallback preserves play when display authority is absent.
- The no-wallet tutorial is a local simulation with no ranked, Soul-linked, or Infinite Flow history.

## Verification

- `markdownlint-cli2` reported zero issues across all 18 Markdown files.
- All relative Markdown links resolved, and all 16 external URLs returned successful responses.
- `git diff --check`, untracked-file whitespace, English public-prose, and stale-terminology scans passed.
- Independent UX, invariant, lifecycle, fairness, and repository audits closed every P0/P1 finding.
- The primary onboarding specification is tracked in the reviewed product commit.

## Risks and blockers

- Infinite Stellar remains an unconfirmed working name. External brand expansion remains blocked until counsel completes clearance and any required prior written consent is obtained.
- The repository remains planning and pre-production. Move, circuit, browser, Sui Clock/checkpoint, availability, privacy, performance, indexer, security, and operations requirements have not yet produced implementation evidence.
- The capped availability accumulator is intentionally conservative: missing timely onchain evidence can cancel a season rather than blame players. Its cadence, contention, sponsor reliability, and Clock behavior must pass the Phase 0 prototype.
- A custom client can speculate on an executed universe-opening effect before checkpoint finality. The reference client discards pre-final candidate/proof work, the manifest supplies a public observation delay, and the limitation remains disclosed rather than described as impossible.

## Recovery

The pre-phase state is preserved at `e040089d3eb78e2f0331f5958fc5e196249cf355`; the reviewed product state is preserved at `ae6464e51c8e0db441a8ef8ccbe6b554a5967c81`. Use normal `git revert` operations rather than rewriting public history.

## Exact next action

Start a new bounded Phase 0 technical go/no-go task. Implement and test deterministic Seat derivation, atomic capacity enrollment, one-way seed opening, Clock-time observation gating, the capped permissionless availability accumulator, global home-window resolution, and `claim_home` against the P0 acceptance tables before building the full client.
