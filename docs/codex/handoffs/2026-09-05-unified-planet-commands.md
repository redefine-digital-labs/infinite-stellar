# Planet Commands, Exploration and Portable Recovery

Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`.
Branch: `codex/dark-forest-parity`. The client increment is validated and ready
for authorized source/deployment delivery. No game-chain write was made.

## Implemented and verified

- `packages/game-sdk/src/strategy-commands.ts` provides complete fleet/cargo,
  ship and abandonment intents, pure dispatch-matching previews and selected
  Planet ability validation. `routing.ts` uses an exact integer ceiling bound.
- `StrategyConsole`, `GameShell` and `use-player-journey` carry explicit actions.
  Ship resources are zero; abandonment uses all resources; cargo preserves the
  chosen percentages. Wormhole endpoints are explicit. Neutral inspection,
  blank/Escape deselection and compact aiming are corrected.
- Current full validation passes: 230 tests (102 web, 90 SDK, 38 prover),
  typecheck, lint and production build. Build retains the large-wallet-chunk warning.
- Real local browser at 393 × 720 verified 75% click-send, neutral conquest,
  reinforcement, exactly one drag-send and blank deselection. Compact panels
  previously covered the destination; they now hide while aiming.
- The earlier three exploration failures are fixed using aligned chunk
  fixtures, complete-batch counts and explicit out-of-scope rejection coverage.
- Local/ranked continuous loops, pause/resume, camera-center relocation and
  exact completed-coverage display are connected. Empty chunks persist and
  compact without filling holes. Invalid restored local coverage rejects.
  Ranked chain closure stops mining and disables restart. Backup cannot race
  between active search batches.
- Browser Worker run persisted 70,656 units², restored after refresh and then
  resumed to 175,104 units² with two new Planets. Zoom and pause remained usable.
- Measured isotropic projection, pointer-anchored zoom, stable manual zoom and
  correct local-world pan bounds now apply. Direct-space reach/cursor guidance
  and DF percentage/fine controls match the dispatch formula. Compact aiming
  retains keyboard focus. Explicit click-to-relocate explorer mode sends no fleet.
- Portable backup/recovery is covered by real Web Crypto, UI and hook tests.
  Authenticated namespace bindings, malformed/tampered files, late Seat changes,
  failed storage/RPC and authoritative chain resources are verified. Format and
  player instructions: `docs/20-private-map-backup.md`.

## Remaining and next

Deliver the coherent client increment and pin deployment/rollback evidence.
Continue animated/partially known voyages and ranked proof-bound special-action adapters,
pending state and two-wallet finality. Production audits, ceremony, custody,
signers and operations remain real release gates.

Full review and implementation evidence is in `docs/19-df-interaction-audit.md`.
The reference fork still lacked an authorized entered account at the last
inspection; local browser work must not be described as playing that fork.
The current live release is unchanged (`8439b2a`). There is no onchain rollback
for this unpublished increment; preserve the dirty worktree rather than
resetting it wholesale.
