# DF Foundation: Flight, Fog and Stable Exploration

Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`.
Branch: `codex/dark-forest-parity`. No game-chain write was made.
The sibling Soulidity handoff helper rejects this repository; this compact
handoff uses the project skill's direct-file fallback.

## Latest continuation: original renderer and DF product direction

The foundation below was pushed as `5ef56b5` and deployed READY as
`dpl_9K7HLDABHexGS4njbq2MmjXmaNV2`; evidence is
`ops/deployments/vercel-production-2026-09-05-foundation-flight-fog.json`.

The owner then requested DF-style zoom/detail, actual original planet visuals,
and a simpler DF-like entry flow. They explicitly accept GPL and MIT reuse
and want innovation focused on Soul integration and seasonal operations.
These are standing facts in `PROJECT_MEMORY.md`, not optional design ideas.

`MapPlanetBodies`, `planet-rendering` and `rendering/df-planet.frag.glsl` add
the original MIT normal-planet shader and biome palette, one shared GPU canvas,
level/density-based size, subpixel culling, faded resources and closer zoom.
No shader context per Planet, no uploaded coordinates, no gameplay authority
change. Public notices preserve the package-level licenses. Special facilities
are not yet replaced by the original renderer. GPU fallback, context loss,
cleanup and camera/DOM synchronization have regression coverage.

Actual browser: mobile close-up shows original biome/cloud texture, Focus planet
clears the obstructing sheet, desktop captured-pointer double-tap reaches 479%
zoom, and 75% sending creates one moving 13.7K-energy Voyage. Temporary viewport
overrides were reset. Final validation/release evidence belongs in CURRENT.md.

Rendering source `3884a50` is pushed and READY as deployment
`dpl_7xK5S61dxCwvKJy6w97kzmwvTR73` at the production alias. Final Node 24.20.0
validation passes all 283 tests, types, lint and build; docs/diff checks pass.
Production Home close-up shows the original shader and the upstream license
is publicly served. Exact evidence is
`ops/deployments/vercel-production-2026-09-05-df-planet-renderer.json`.

Latest entry correction: `apps/web/src/demo-entry.ts` combines local fixture
setup after Soul selection. The shell removes simulated approval/open/search/
claim screens and artificial delay; legacy intermediate saves have one resume
action. Navigation home preserves the vault and an in-tab continuation. Ranked
readiness never saves over local gameplay, entry waits for restore, and local
records cannot supply ranked authority. Browser confirms same Home across
entry, home/mainnet/back/continue, and refresh with continued energy growth.
Tests cover all legacy boundaries and storage safety. Release evidence belongs
in CURRENT.md. No real Sui signature, proof or ranked activation is claimed.

Next: replace fixed demo Home/candidate generation, finish actual ranked
proof/signing/finality, then the confirmed season operations work. Preserve
required authorization and release gates; do not relabel local shortcuts as
a real ranked Season or claim this partial renderer finishes full DF parity.

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
