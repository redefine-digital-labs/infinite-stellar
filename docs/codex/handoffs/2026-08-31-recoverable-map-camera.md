# Infinite Stellar Phase Handoff

## Phase

Recoverable map camera controls

## Status

Complete as a local player-interface correction. No game rule, Move package,
deployment, or onchain state changed.

## Goal

Make star-map inspection reversible: players must be able to zoom in and out,
return directly to their founding Planet, and restore a full resolved-space
view without relying on browser zoom or losing their gameplay selection.

## Root cause

The previous map had no independent camera model. Its center was hard-coded to
the founding Planet and its radius was recomputed from scan progress. It had no
paired zoom or recovery controls. During live validation, the new Fit action
also exposed a stacking-context defect: a moved floating command window could
sit above visible camera controls and intercept pointer input.

## Outcome

- Camera center and radius are now explicit local interface state.
- `−` and `+` provide bounded bidirectional zoom with a live percentage.
- `Home` recenters on, selects, and opens controls for the founding Planet.
- `Fit` recenters and restores all currently resolved space.
- Mouse wheel, `+`, `-`, `H`, and `0` provide equivalent camera input.
- Double-clicking a Planet focuses the camera on it.
- Camera controls sit in a navigation layer above movable panels.
- The 561–900px layout moves and compacts the camera bar into a safe left-side
  lane so it does not cover the Planet/Fleet title or drag handle.
- Camera actions do not alter scans, coordinates, energy, voyages, ownership,
  score, proofs, or persisted strategy state.

## Changed paths

- `apps/web/src/StrategyConsole.tsx`
- `apps/web/src/StrategyConsole.test.tsx`
- `apps/web/src/styles.css`
- `docs/codex/CURRENT.md`
- `docs/codex/handoffs/2026-08-31-recoverable-map-camera.md`

## Verification

- Web tests: 9/9 pass.
- TypeScript passes.
- ESLint passes with zero warnings.
- Web production build passes.
- Markdown lint passes across 35 files.
- `git diff --check` passes.
- Live local browser verification at `http://127.0.0.1:4174/` passes:
  zoom in `100% → 125%`, zoom out `125% → 100%`, Home `100% → 252%`,
  Fit `252% → 100%`, and founding-Planet selection.
- Visual inspection at the current 609px-wide viewport confirms the camera bar
  and Planet/Fleet window have a clear gap and both remain operable.

## Repository and release state

- The broader parity worktree remains intentionally uncommitted.
- No commit, push, Vercel deployment, Sui package publish, or onchain write
  occurred in this phase.
- The existing public canary remains the earlier sealed release.

## Exact next action

Have the user inspect the running Home-centered page. Any production artifact
custody or public release work remains a separate phase requiring explicit
authorization and the existing audit gates.
