# DF Foundation: Flight, Fog and Stable Exploration

Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`.
Branch: `codex/dark-forest-parity`. No game-chain write was made.
The sibling Soulidity handoff helper rejects this repository; this compact
handoff uses the project skill's direct-file fallback.

## Implemented and verified

- New local games expose only Home. Verified Worker chunks reveal the rest.
  Migration retains owned, visited, artifact-bearing and explored locations
  without deleting private or simulation data. The hidden fixture count is
  no longer displayed; empty batches save coverage without log spam.
- Persisted demo wall time drives resource growth and automatic arrivals.
  Refresh/focus catch up; old unanchored saves start their clock on first load.
  Manual demo advance remains available. Ranked state is never clock-mutated.
- `MapVoyages` draws a moving marker, energy, cargo and ETA in the same camera
  projection. Ranked endpoint visuals await chain settlement. Unknown-source
  voyages still need a useful arrival indicator.
- Exploration no longer auto-fits after each batch or alternates button width
  between percentage labels. Initial Home stats now show Regular, level 0,
  50,000 energy. The badge identifies a ruleset, not completed 1:1 parity.
- `npm run validate:web` passes: 109 web, 124 SDK, 38 prover tests (271 total),
  typecheck, lint and production build. Docs lint and diff checks pass. The
  existing large-wallet-chunk build warning remains.
- Fresh real browser: one Home initially; Worker discovered 25 Planets across
  371,712 units² while zoom stayed 100%. A 264-second fleet continued after
  refresh and automatically conquered IS-4A806 with 11,607 arrival energy.
  No manual advance or arrival-resolution control was clicked.
- SDK `ranked-actions.ts` preserves the in-progress claim/move/move-new
  preparer. Its 28 unit tests pass, but actual Circom witness integration and
  client proof/signing composition remain unfinished. Ranked writes stay shut.

## Remaining and next

Publish this bounded correction and record exact deployment evidence. Then
replace fixed demo Home/seed and the intentionally retyped Spacetime Rip with
natural verified generation, add partially known voyage feedback, and complete
ranked proof/pending/finality and special-action adapters. Follow
`docs/19-df-interaction-audit.md`; no full 1:1, live reference-fork playtest or
two-wallet Season is claimed. The owner prioritized foundations before new
mechanics. Production ceremony, audits, custody and signer gates remain real.

Rollback: source `8b5880c`, deployment `dpl_57v5xdB1v58ff6XdHcnQZDXuHiUP`.
Preserve all device vaults, portable backups and local simulation data.
