# Infinite Stellar Phase Handoff

## Phase

Map-first floating command interface

## Status

Complete.

## Goal

Replace the fixed strategy dashboard with a full-viewport star map and
Dark-Forest-inspired floating command interaction while preserving Infinite
Stellar's original visuals, narrative, and existing gameplay transitions.

## Outcome

The local strategy experience is now map-first. Desktop players operate five
independent command windows; mobile players use the same panel model as one
dock-selected bottom sheet. The SDK and gameplay rules were not changed.

## Implemented interaction model

- The private star map occupies the complete gameplay viewport.
- Commander, Planet and fleet, artifacts and ships, voyages, and command log
  use independent non-modal windows.
- Desktop windows focus on interaction, drag with pointer input, move with arrow
  keys, clamp to safe viewport positions, and persist their positions locally.
- Every window can minimize into and reopen from the command dock.
- A reset control restores safe default positions and the default open set.
- The default desktop layout opens only Commander, Planet and fleet, and log so
  the map remains readable. Other windows stay one click away in the dock.
- Viewports at 900 pixels or less start with all windows docked. Selecting a
  Planet opens the command window, preserving a truly full-screen initial map.
- At widths of 560 pixels or less, only the active window is mounted. It becomes
  a bottom sheet and the five-part dock switches accessible content.
- Fleet composition now exposes energy and silver sliders, three energy presets,
  live arrival energy, and travel-time previews before launch.
- The active game hides the non-game footer and legacy mission strip so the map
  receives the complete area beneath the global product header.
- The product/wallet HUD occupies the first overlay row and the map toolbar a
  separate second row, preventing wide-screen status and Scan collisions.
- Persisted desktop window geometry uses layout schema `v2`; old coordinates
  are intentionally ignored so the safer two-row clearance takes effect.

## Changed paths

- `apps/web/src/FloatingPanel.tsx`
- `apps/web/src/StrategyConsole.tsx`
- `apps/web/src/StrategyConsole.test.tsx`
- `apps/web/src/GameShell.tsx`
- `apps/web/src/GameShell.test.tsx`
- `apps/web/src/styles.css`
- `README.md`
- `docs/13-player-vertical-slice.md`
- `docs/codex/CURRENT.md`

## Verification

- `npm run validate:web`: PASS. Web 7/7, SDK 31/31, TypeScript, ESLint,
  and production builds.
- Desktop interaction coverage: PASS for focus, keyboard movement, persisted
  position, minimize, reopen, and dock access to initially closed windows.
- Mobile interaction coverage at 390 × 844: PASS for one mounted bottom sheet,
  dock switching, and non-draggable handle semantics.
- Compact desktop coverage at 609 × 762: PASS for a panel-free initial map and
  on-demand floating Planet/Fleet window after Planet selection.
- Direct visual inspection at 609 × 762: PASS. The map extends behind the
  overlay header to all four viewport edges; the dock and scan controls remain
  accessible without reserving page layout space.
- Wide-screen inspection at 1438 × 760: PASS. Brand and wallet controls remain
  on the first HUD row, the map toolbar remains on the second, and default
  command windows are separated along the viewport edges.
- Complete local journey: PASS from Soul selection through home claim, target
  selection, 90-percent fleet launch, voyage inspection, arrival, and conquest.
- `npm run lint:docs`: PASS. Zero issues across 33 files.
- `git diff --check`: PASS.
- The user's existing local server at `http://127.0.0.1:4174/` returned HTTP
  `200` after the changes.

## Constraints and recovery

- No Git commit, push, pull request, Vercel deployment, or Sui transaction was
  performed.
- The public Vercel canary remains the earlier sealed release.
- Production Soul and proof adapters remain fail-closed.
- The underlying Round 5 parity handoff remains
  `docs/codex/handoffs/2026-08-31-dark-forest-round5-parity.md`.
- The existing public release recovery commit remains
  `75fe712e4d2349b2e6b57dfa3751dade7921a48d`.

## Exact next action

Visually review the running local page at `http://127.0.0.1:4174/`. If the
interaction direction is accepted, start a separately authorized production
integration phase only after the Soulidity ABI and audited Groth16 artifacts
are frozen.
