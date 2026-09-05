# Ranked Private Exploration Increment

## Scope and authority

Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`.
Branch: `codex/dark-forest-parity`.

The full five-milestone objective in `docs/18-delivery-and-season-operations.md`
remains active. This increment does not constitute playable ranked mainnet,
an independent audit, production proof approval, or a two-wallet rehearsal.
No game transaction was signed or submitted.

## Implemented

- Shared shaded planet glyphs, route previews, clear-view controls and mobile
  layout fixes were pushed in `e8e5ad4`.
- Ranked exploration uses the exact committed Season radius, rarity, MiMC key,
  Perlin parameters and home interval. Pre-seed and closed worlds reject new
  mining; a pause does not prevent private local work.
- A cancellable local Worker scans bounded sectors. Its output is untrusted:
  requested-sector scope and all private location bindings are checked before
  encrypted persistence. Nothing locally discovered grants chain ownership.
- Existing-Seat maps expose sector exploration and refresh deterministic
  public object point reads after saving. Seat/account changes cancel old work
  and suppress late results. No private coordinate is sent to the RPC.
- Browser vault operations use per-namespace Web Locks; concurrent instances
  merge discoveries, preserve original timestamps and refuse conflicting or
  corrupt records without overwriting them.
- A conquered founding Planet remains visible with the actual onchain owner.

## Validation

Typecheck, lint, production build, and 164 TypeScript tests passed, including
the exploration UI callback assertion.
Tests cover manifest commitments, reference hashes, scope/corruption rejection,
late Seat results, encrypted restore, concurrent vaults and Worker cancellation.
The browser's local simulation also completed a real Worker frontier scan.
This is not evidence of a live ranked Season.

## Remaining and next

Select durable home candidates, prepare exact proof-bound home/move intents,
and integrate the existing prover and transaction lifecycle behind unchanged
production gates. Complete portable encrypted backup/import before real player
onboarding. Continue public indexing, two-wallet shared-state rehearsal,
operations, independent audit remediation and approved multisig release.

Source `8439b2a9b5232795befff8690b5c5091dda5f57c` is pushed and deployed as
`dpl_46KUx7ZEKdD8U4NWaqNMZzXA8t5u` on the production alias. See
`ops/deployments/vercel-production-2026-09-05-ranked-exploration.json`.
No onchain rollback is required: this increment
changes no chain state. The prior web source is `e57b78f`; vault ciphertext
format is unchanged and forward merges only add discoveries.
