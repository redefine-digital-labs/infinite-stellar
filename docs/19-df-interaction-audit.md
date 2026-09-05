# Dark Forest Interaction Audit

## Priority and evidence boundary

Read **Foundation correction** and **Original planet rendering and zoom detail**
for the latest state. Earlier
sections retain the defects and validation state at their recorded milestones;
their words "unpublished" and "remaining" are historical, not current status.

On September 5 the owner identified substantial interaction mismatches,
especially exploration and choosing energy before attacking. Interaction
fidelity now takes priority over the in-progress portable-backup increment.
The five-milestone multiplayer and production objective remains unchanged.

The supplied live reference is
[INFINITY SPCX](https://infinity-spcx.vercel.app/play/0x3b3045241c1a71732040300d61f365c9fb4d519e).
The site opened successfully and identified itself as Robinhood Testnet. The
accessible browser profile had no saved account and offered burner generation
or private-key import. No account was generated, no key was requested or
imported, and no transaction was submitted. Actual in-game behavior of this
fork remains to be observed in an authorized existing session; do not describe
the source audit as having played the owner's game.

Source authority: official Round 5 snapshot
[`d1e25ea`](https://github.com/darkforest-eth/darkforest-v0.6/tree/d1e25ead311697ecaa27ff648dac16a0d8cea15c).
The separately published client at `009e6438` corroborates the key interactions.
Read-only reference checkouts are outside the product repository. The initial
behavioral audit used independent implementations. The owner subsequently
authorized GPL and MIT reuse; the original renderer and procedural packages
have individual MIT licenses and the planet-rendering adaptation below retains
their notices. The root game's GPL code has not been imported by that adaptation.

## Confirmed source mismatches in the published baseline

| Interaction | Reference behavior | Current Infinite Stellar gap |
| --- | --- | --- |
| Continuous exploration | Explore/Pause controls a continuing search; completed chunks lead to the next unexplored chunk | The public demo runs one batch per click; the new ranked control scans one sector per click |
| Move explorer | A dedicated targeting mode lets the player click the map to reposition the search origin; camera position is independent | Demo search is pinned to Home; ranked search uses camera center or a random location |
| Fog and coverage | Completed spatial chunks are recorded even when they contain no planets, skipped on later scans, and visibly reveal the map | State primarily records planets and a radial summary, not the actual explored-area footprint |
| Inspect versus aim | Clicking any planet selects it for inspection. Sending mode and drag gestures establish an explicit source-to-target action | Selection overloads non-owned planets as targets and can target another owned planet instead of selecting it |
| Energy selection | Each origin remembers its own energy/silver percentages; energy defaults to 50%; sliders include numeric adjustments and shortcuts | One component-wide 60% setting; silver uses an absolute amount; no per-origin memory |
| Send sequence | Set energy, then Send/Q and aim; alternatively drag from a controlled origin. Targeting has clear cancellation and cleanup | Select target first, then a separate launch button; no equivalent aiming/drag state |
| In-map prediction | A cursor-following route and range rings respond to the selected energy. The target displays reinforcement or defense-adjusted loss and junk cost | A line appears only after target selection; no energy-dependent reach ring or hover combat prediction |
| Availability and pending sends | Pending departures reduce spendable energy and are visibly distinguished from completed actions | Demo dispatch is immediate local state; the eventual ranked UI still needs pending-intent accounting and reconciliation |
| Camera behavior | One world-to-pixel scale preserves geometry; scroll zoom remains anchored under the cursor | Horizontal and vertical percentage transforms use different physical scales; zoom is anchored at the map center |
| Fleet visibility | Fleets move along the route with arrival countdown and carried resources; partially known routes still have useful arrival feedback | Ranked map currently draws static lines and hides voyages without both coordinate preimages |

## Primary source locations

- [Explore controls](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Frontend/Panes/ExplorePane.tsx): pause/resume, origin targeting, patterns and core selection.
- [Mining scheduler](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Backend/Miner/MinerManager.ts): continuous chunk completion, skipped explored chunks and non-blocking scheduling.
- [Persistent coverage](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Backend/Storage/PersistentChunkStore.ts) and [background rendering](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/packages/renderer/src/Entities/BackgroundRenderer.ts): explored-area authority and fog.
- [Input state](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Backend/GameLogic/GameUIManager.ts): selection, drag-send, send/cancel transitions and per-planet percentages.
- [Resource controls](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Frontend/Views/SendResources.tsx): energy/silver controls and keyboard percentages.
- [Camera](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Frontend/Game/Viewport.ts): isotropic projection, pointer-anchored zoom and pan-versus-send handling.
- [Aiming overlay](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/packages/renderer/src/UIRenderer.ts), [planet feedback](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/packages/renderer/src/Entities/PlanetRenderManager.ts), and [voyages](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/packages/renderer/src/Entities/VoyageRenderer.ts): route, reach, combat and arrival visualization.

## Correction sequence and acceptance

1. Separate inspect, pan, relocate-explorer and aim/send states. Verify that
   selecting a neutral, rival or second friendly Planet never accidentally
   starts a move. A drag from a controlled origin previews and initiates the
   same intent as Send followed by choosing a target. Escape cancels safely.
2. Bind energy/silver selection to each origin. Reflect departure deductions,
   route modifiers, arrival energy, defense impact, junk and transit time in
   one shared prediction path; the final action must use that same path.
   Reference 100% input is not permission to empty a normal source: its client
   caps normal sending at 98%, distinct from abandon and ship actions.
3. Make exploration a persistent continuous job with bounded Worker batches,
   explicit pause/resume and click-to-relocate. Persist exact completed chunks,
   including empty ones. Render actual fog clearance and the active search
   footprint; never substitute a radial reveal or pretend every visible region
   has been mined. Start with the reference 16-by-16 chunk footprint.
4. Use isotropic camera transforms, cursor-anchored zoom, appropriate map
   hit-testing, live fleet markers and compact contextual panels. Validate
   desktop and touch workflows against the same behavior contract.
5. Compare these paths in the owner's live reference once access is available.
   Record fork-specific differences separately from Round 5 rules. Add
   interaction regression tests before publishing the corrected product.

Sui confirmation, Soul/Seat authority and private-coordinate guarantees stay
intact. Sending intent does not bypass the Sui wallet or production proof
gates. Local fixture actions remain visibly separate from ranked actions.
Do not copy a burner-key wallet flow into the Soul-based product.

## Parked work

Portable backup encryption, controls and founding-Planet recovery code are
uncommitted and unverified as a complete integration. Do not publish them as a
finished recovery milestone. The backup schema must include the corrected
private exploration coverage before claiming cross-device exploration resume.
The last verified published source remains `8439b2a`; documentation follow-up
`ca1e1e8` records its Vercel deployment.

## Local interaction correction, September 5

The unpublished working tree separates inspection from fleet aiming. Clicking
any discovered Planet selects it, regardless of ownership. The local simulation
remembers each origin's energy and silver percentages (50/0 defaults). Send/Q
starts aiming, a destination click submits the local intent, and dragging from
a controlled origin uses the same atomic source/destination callback. Escape,
pointer cancellation and dropping onto empty space do not submit a fleet.
Invalid routes remain in preview. A separate route-only action preserves ship,
artifact and abandonment controls without dispatching a normal fleet.

Normal dispatch and preview now share route preparation and rounding, including
charged Photoid consumption, Wormhole routing, arrival limits and space junk.
The quote does not mutate artifacts. A 100% UI setting caps a normal departure
at 98% and leaves at least one energy. Keyboard digits choose energy; shifted
digits choose silver; F fits the map. These are local simulation interactions,
not ranked signing. Ranked clicks now inspect instead of implicitly targeting;
ranked writes remain sealed.

This is an incremental correction, not completed DF fidelity. Continuous
exploration, actual chunk coverage/fog, isotropic and cursor-anchored camera,
energy reach rings, deselection, unowned-Planet drag panning, full ranked intent
composition and pending-signature reservations remain to be implemented.
The reference browser was checked again and still reports zero saved accounts;
no authorized in-game playtest has occurred.

## Expanded planet-to-combat review

The owner reiterated that planet selection, abilities and attacking must be
reviewed as one complete interaction, not a sequence of isolated button edits.
The continuous-explorer work in progress is parked while this review takes
priority. It is not published or fully regression-verified.

The reviewed path spans `GameShell` and `use-player-journey`, `StrategyConsole`
and `MapPlanetGlyph`, SDK selection/dispatch/ship/artifact/abandonment and
arrival functions, `round5-rules`, the guarded `sui-gateway`, and Move
`proof_actions`, `voyage` and Planet debit/arrival functions. The pinned DF
comparison additionally covers `PlanetContextPane`, `SendResources`,
`MineArtifactButton`, `CapturePlanetButton`, `GameUIManager`, `GameManager`,
`Viewport`, `UIRenderer`, `PlanetRenderManager` and `DFMoveFacet`.

### Confirmed defects at review time

| Path | Evidence in the current working tree | Required correction |
| --- | --- | --- |
| Selected Planet abilities | `StrategyConsole` renders upgrade, prospect, find, invade and capture buttons without matching the SDK ownership, type, Gear, cooldown, checkpoint, capacity and energy predicates | Derive visible/enabled actions and specific rejection reasons from the selected Planet's capabilities; preserve read-only inspection of rivals |
| Artifact + fleet resources | `onDispatchArtifact(id)` reaches `dispatchStrategyArtifact(game, id)` with its default 60% energy and zero silver; the selected percentages never reach it | One explicit payload must carry the same chosen energy, silver, origin, target and artifact through preview and submission |
| Ship movement | `dispatchStrategyShip` is a separate zero-energy path, but the console displays a normal-fleet quote; it also uses direct distance without the Wormhole handling present in DF's `_executeMove` before ship-specific behavior | Choose a ship in the same sending composer, disable energy/silver, validate controller/location/capacity and use a matching ship quote; settle without conquest |
| Abandonment | The separate button sends all resources and changes ownership, using a 150% route, while the displayed normal quote still uses the user's ordinary percentage and route | Explicit abandonment mode must preview its actual resources, route, returned junk, carried artifact and irreversible source-side effect; Home and incoming-voyage restrictions must be visible before aiming |
| Hover target versus committed target | During fleet aiming, `target` is `hoveredId`, while artifact/ship/abandon callbacks still read `game.targetPlanetId`; the UI may show actions for a target the callback does not use | Do not mix a hover with an independently stored dispatch target; freeze the complete intended action at destination selection |
| Deselect and input modes | Escape clears aiming but leaves selection; blank click does not deselect; non-owned Planet buttons prevent panning; plus/minus still zoom rather than adjust selected resources | Separate inspect, pan, normal send, ship, abandon and endpoint selection; implement cleanup and shortcuts consistently |
| Normal attack feedback | The new quote covers normal dispatch, but no energy-dependent reach rings or numeric energy at an empty cursor are shown; map glyphs have no defended-loss/capture feedback | Draw source-relative reach and cursor/target feedback from the same quote; show reinforcement versus defended damage and qualify any predicted capture as a snapshot estimate |
| Distance bound | SDK `distanceBetween` floors Euclidean distance. DF `GameManager.move` uses the ceiling for the proof's maximum distance, and `DFMoveFacet` / Sui `voyage` calculate decay from that bound | Share an exact proof-bound distance convention before using local predictions for ranked intents; add non-integer-distance boundary tests |
| Pending state and errors | Demo callbacks immediately mutate local state. Ranked composition is absent. A Sui source's nonce, pending departures, due arrivals, changing owner and refreshed resources can invalidate a previously shown quote | Track immutable pending intents, reserve their spend, simulate, show rejection/finality, and rebuild after a changed source/Seat; never infer onchain success from UI selection |
| Public action adapter coverage | Move contains package-internal artifact/ship/Wormhole/Photoid/abandon dispatch helpers, but public proof actions and SDK builders expose only normal `move` / `move_new` here | Finish the real proof-bound adapters and rehearsal; package-internal functionality is not a playable ranked action |

### Original-client versus contract differences

Blindly copying DF's frontend formula is not sufficient. In this pinned
snapshot, `GameManager.getWormholeFactors` uses linear distance factors
`[0, 2, 4, 6, 8, 10]` and prefers greater rarity across endpoints, whereas
`DFMoveFacet._checkWormhole` uses `[1, 2, 4, 8, 16, 32]` and gives an active
source Wormhole precedence. The current SDK's exponential factor matches that
contract, not that frontend helper. Keep contract-authoritative math and
document the improved prediction rather than reproducing a known mismatch.

Similarly, the DF client clamps growing, non-full Silver Mine sends to 98%
when the player chooses more than 98%, while the contract ultimately checks
available silver. Sui's Clock/read freshness and simulation need an explicit
policy; a visual 100% label must not silently promise a stale absolute amount.

The primary evidence for these differences is
[`GameManager`](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Backend/GameLogic/GameManager.ts),
[`GameUIManager`](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/client/src/Backend/GameLogic/GameUIManager.ts)
and
[`DFMoveFacet`](https://github.com/darkforest-eth/darkforest-v0.6/blob/d1e25ead311697ecaa27ff648dac16a0d8cea15c/eth/contracts/facets/DFMoveFacet.sol).

### Next acceptance slice

Use one complete local action intent for fleet, carried artifact, ship and
abandonment, with mode-specific quotes and capability predicates. Verify
click/drag equivalence, opponent inspection, blank/Escape cancellation,
resource memory, actual cargo/resource payloads, unreachable targets, Home
abandon rejection, ship-only non-conquest, charged artifacts, non-integer
distance, and changed ownership/arrival conditions. Then integrate the same
intent boundaries with real Sui preparation and finality. Do not treat the
previous 170 passing tests as evidence for these still-unimplemented cases.

## Unpublished unified-command implementation

The subsequent local correction adds `strategy-commands.ts`: fleet (including
carried artifacts), ship and abandonment all take an explicit origin, target,
mode and resource intent. Preview evaluates the same pure transition used by
execution without committing its result. Execution revalidates changed
ownership, cargo, capacity and route conditions. Selected-Planet abilities use
the same validation for their enabled state and displayed rejection reason.
These are simulation commands, not production Sui transaction builders.

The console now sends those complete intents, selects ships/cargo within the
composer, uses zero resources for ships and all resources for abandonment,
and explicitly aims Wormhole endpoints. Escape and blank clicks deselect;
non-owned Planets can be inspected or dragged to pan. Exact integer ceiling
distance replaces the previous floor. Ship routing includes contract-style
Wormhole factors; claiming ships preserves existing artifacts.

Browser validation at 393 × 720 reproduced a real overlay defect: the command
panel covered the target during aiming. Compact aiming now hides panels and
restores the command panel after send/cancel. Actual local clicks sent 37,500
of 50,000 energy, conquered the neutral destination with 4,375 remaining,
then sent reinforcement. A subsequent real drag sent exactly one voyage,
using the remembered 75%; blank-map click cleared both selection markers.
Unavailable next routes show a reason, not bogus zero distance/time metrics.

Verification: 25 targeted web tests and 19 targeted SDK tests pass. Typecheck,
lint and production build pass. Full-suite run exposed three additional
failures in the parked exploration changes (`ranked-map-vault`,
`use-ranked-map`, `miner`); an initial duplicate-error UI assertion has since
been corrected and the targeted suite rerun. This working tree is not ready
to publish. No reference-fork gameplay, ranked action, or chain settlement
was claimed or performed.

Remaining: finish and validate continuous exploration, real reach rings,
isotropic camera/cursor math, DF resource shortcuts, pending ranked spend,
public proof-bound artifact/ship/abandonment adapters and real two-wallet
finality. Local command parity does not close those release requirements.

## Continuous exploration implementation and validation

Both local and ranked exploration now continue through bounded, aligned
16-unit chunks until paused. Origin is independent of selected Planet and
camera; the explicit Explore here control relocates to camera center. Resume
uses the saved origin and skips completed coverage. Empty results still save
complete footprints. Four complete siblings compact, but incomplete siblings
never become a filled bounding box. The shared SVG layer darkens unsearched
space and marks current chunks; no discovery-radius circle claims coverage.

Worker scope/hash and completed-batch validation are retained. A later
closed-season chain read stops the loop and disables restart while retaining
readable discoveries. Backup import/export cannot begin in the interval
between active batches. Restored local coverage validates alignment and origin.

The three earlier explorer failures were obsolete fixtures; the revised
tests explicitly retain out-of-scope and forged-location rejection. Additional
tests cover empty-chunk persistence/resume, holes, negative coordinates,
finite-world exhaustion, coverage rendering and closed-season stopping.
All 190 tests, typecheck, lint and production build now pass.

In the local browser, 70,656 units² survived refresh; resuming reached
175,104 units² and resolved two additional Planets. Zooming and pausing worked
while the Worker loop ran. This is local evidence, not ranked multiplayer.
Portable recovery, camera/reach/shortcut parity and real proof-bound actions
remain unfinished. No commit, deployment or chain write was made here.

## Camera, reach, resource controls and portable recovery correction

The later client correction uses one measured world-to-pixel scale for local
and ranked Planets, routes, coverage and local capture zones. Wheel zoom
preserves the coordinate beneath the pointer. Local panning clamps around the
actual local world center, not global zero. Manual zoom no longer changes its
displayed percentage when exploration expands. A direct-space reach circle
ends at the last integer proof distance with surviving energy, and empty-cursor
guidance uses the same arrival formula and Photoid/abandon source modifiers.
Wormhole endpoint routes still use their target-specific full quote; a generic
reach circle is not a claim about those special endpoints.

The pinned SendResources source was rechecked: minus/equal change energy by
10 percentage points, underscore/plus change silver, and the fine-adjustment
buttons change one point. Those controls are implemented. Map zoom uses the
wheel, on-screen controls and bracket keys in the local command map. Compact
aiming explicitly focuses the map so Escape and resource keys continue working.
Move explorer is now a separate click-to-place mode in both maps; it pauses
the previous search and never selects a Planet or submits a fleet.

Portable recovery validation and its authority boundary are documented in
`20-private-map-backup.md`. Real Web Crypto and hook tests verify authentication,
namespace binding, failure preservation and chain-derived ownership/resources.
Browser checks also verified the circular reach on a narrow viewport, changing
50% to 60% with equal while aiming, Escape cancellation, and click-to-relocate
exploration with no new fleet. A narrow-toolbar overlap found in that check
was fixed by retaining Move explorer and hiding the redundant camera-center
shortcut on small screens.

Remaining interaction work includes animated voyages/countdowns and useful
partially known arrival routes, full ranked intent/pending-state integration,
and an authorized in-game reference-fork comparison. These do not disappear
because the local control tests pass. No real two-wallet Season or game-chain
write has been performed by this client increment.

## Foundation correction

The owner explicitly prioritized the basic Dark Forest loop before invented
mechanics, and supplied a recording of map jitter and missing visible flights.
The previous "parity rules" badge overstated completeness. It now identifies
the DF Round 5 ruleset without claiming a finished 1:1 implementation.

The pinned `VoyageRenderer` computes a confirmed fleet's position from elapsed
departure-to-arrival time, draws a moving energy marker and shows its remaining
time and cargo. Our prior dashed-path animation did not implement that behavior.
Worse, local game time was frozen unless the player pressed a manual advance
button. The correction adds a shared camera-projected fleet overlay and a
persisted demo wall-clock anchor. Normal play advances growth and arrival
resolution automatically; focus and refresh catch up exactly once. Explicit
demo fast-forward remains available but is no longer necessary for movement.
Ranked visuals use time only for presentation: a reached endpoint reads
"Awaiting settlement" until chain reads actually establish the result.

New local games expose only Home. Other cached coordinates stay undiscovered
until real Worker chunk completion reveals them. The counter no longer leaks
the size of the hidden fixture. Existing saves preserve owned, visited,
artifact-bearing and explicitly explored locations; migration hides untouched
pre-revealed bootstrap neighbors without deleting Planet data. Completed empty
chunks still persist but no longer flood the command log. Initial candidate
stats now show Regular, level 0 and the actual 50,000 starting energy, instead
of cosmetic class/resonance values and inconsistent energy.

Exploration no longer auto-fits the camera after each batch. Manual Fit remains
explicit, the zoom baseline uses fixed world bounds, and the explorer button
keeps a stable label and width across 0/100-percent batch transitions. The
recording's changing camera and toolbar wrapping were separate causes.

### Evidence and remaining baseline

| Basic behavior | Current implementation and acceptance |
| --- | --- |
| Unknown space | New-game regression: only Home visible, unknown target rejected, valid mined chunks reveal locations |
| Continuous search | Existing Worker/chunk validation plus regression for unchanged camera and stable exploring label |
| Fleet in transit | Shared `MapVoyages` overlay, fractional movement, energy/cargo and ETA; render tests cover RAF cleanup and ranked settlement boundary |
| Time and arrival | SDK and hook tests cover real elapsed time, resource growth, refresh/focus catch-up, exact-once arrival and unchanged ranked authority |
| Reference gameplay | Official pinned source reviewed; the supplied fork still needs an authorized entered session |
| Remaining local fidelity | Fixed demo Home/seed and a deliberately retyped Spacetime Rip showcase still differ from hash-native generation; replace with verified natural candidates before claiming 1:1 |
| Remaining ranked gameplay | Partially known voyage indication, proof Worker/UI composition, pending-spend reservations, special-action adapters and two-wallet finality remain incomplete |

The SDK additionally contains guarded `prepareRankedAction` for claim-home,
move and move-new, with 28 unit tests for deployment/Seat/config bindings,
validated private preimages, exact point-read existence, lifecycle/deadlines,
source nonce, due arrivals and statement generation. This preparatory work is
not wired to the client prover/signing journey and has not yet been validated
end-to-end against actual Circom witnesses. It does not open ranked writes.

## Original planet rendering and zoom detail

The owner asked for the actual DF planet appearance, scale-dependent detail,
and an entry flow closer to DF. The confirmed product direction is to preserve
the mature DF experience and concentrate innovation on Soul integration and
season operations. Both GPL and MIT reuse are approved with their obligations.

`MapPlanetBodies` uses the original pinned MIT `PlanetProgram` fragment shader,
required noise mixins, original biome palette and level-based cloud/terrain
properties. This replaces the generic glossy CSS sphere for normal Planets.
Source, modifications and full upstream licenses ship under `public/third-party`.
Special facilities still have separate presentation; this is not the complete
upstream renderer, nor a claim that every facility has been replaced.

The shared camera now determines real screen radius using DF's level sizes
and rarity scaling (ranked density comes from the manifest threshold). Subpixel
low-level bodies are culled, smaller visible bodies fade, and resource text and
facility markers appear at useful projected sizes. Home, owned, selected and
in-flight endpoints remain navigable; keeping an owned anchor does not force
all its resource text into the distant overview. Hidden nodes are removed from
the hit-test DOM. Small visible nodes are painted above overlapping large ones.
Zoom extends down to a close-up scale rather than stopping before low-level
details can appear. Double-click focuses a body; compact panels also provide
an explicit Focus planet action that clears the obstructing sheet.

One WebGL2 canvas renders normal Planets, not one context per Planet. Camera
changes repaint synchronously before DOM rings and labels; animation is bounded
to 24 fps and pauses drawing in hidden tabs. Reduced motion freezes rotation.
Unavailable/failed/lost GPU contexts leave the readable DOM fallback intact;
unmount releases animation frames and GL objects. The local command log also
avoids duplicate React keys from older repeated discovery entries.

Actual browser checks cover mobile low-level close-up, visible land/ocean/clouds,
Focus planet, distant overview and desktop resize/camera alignment. Unit tests
cover radius/density, culling, level-dependent resources, selected anchors,
same-paint camera updates, GL failure/loss/cleanup and click/drag command
regressions at an appropriate zoom. New rendering does not modify simulation
rules or ranked authority.

### Initial entry correction: September 5 (superseded by natural search below)

The upstream `GameLandingPage.tsx` combines home search/join after user intent
and validates existing-player coordinates before entry. Our local preview now
uses Soul selection followed by one Enter universe action, removing two fake
wallet approvals, manually opening the fixture universe, the fixture-search
button and artificial finality delay. It explicitly labels the fixture home;
this is not actual proof generation or a production search/join implementation.
Restoring old enrollment/search/claim boundaries preserves finalized identity
and candidate state. Existing ranked Seat-first resolution and coordinate
recovery remain in the chain-backed route; wallet signatures are not bypassed.

Returning home is now non-destructive and offers Continue local game. Checking
mainnet readiness cannot overwrite the encrypted demo record. Local entry waits
for authenticated restore and blocks on restore failure; local records cannot
restore ranked authority. Browser smoke verifies new entry, navigation through
mainnet readiness, continuation and refresh with the same Home and growing
energy. Tests cover every legacy entry boundary, absent Soul, onchain shortcut
rejection, restoration races and storage authentication failure.

### Natural home search: September 5

The owner continued the DF-foundation work. `GameManager.findRandomHomePlanet`
and pinned `eth/darkforest.toml` supply the reference behavior: sample a public
home region, search chunks, require the home Perlin band, level-0 Regular type,
valid location hash and universe-origin radius. Local entry now performs this
actual Worker work, reports coordinates hashed rather than fabricated progress,
and saves completed chunks for pause/reload/resume. Another-region search keeps
already completed knowledge. A valid home and its hash-derived bonuses/biome
are recomputed before activation; no pretend proof digest is manufactured.

The runtime no longer contains a fixed Home, FNV candidate coordinates, a
48-coordinate hidden bootstrap or the retyped Spacetime Rip. Controlled
survey/ability data is test-only. New games start with the verified Home plus
only genuinely mined knowledge. Active old saves are untouched; unclaimed
legacy candidates are searched again without replacing the finalized Seat.
Explorer and camera boundary guards use the universe origin, not the Home.

Real-browser evidence: three independent new sessions found BA7DE, 5BF92 and
33073, with 16,384, 16,384 and 4,096 searched units² respectively. The third
paused and resumed before completion. Further exploration around BA7DE found
four natural neighbors; refresh retained five Planets, 67,584 searched units²
and continued energy growth. No private coordinates are included in evidence.
Full release validation passes 300 tests, types, lint and build.

This closes fixture geography and actual local home-search gaps, not ranked
proofs or multiplayer. Public Round-5 keys/local radius, demo Souls/Seat and
local simulation authority are still explicit. Required Sui signatures,
production proofs, independent audits and release gates remain unchanged.

The owner then requested fresh initialization on every deployment. Production
builds now isolate local playtest saves by a new build identifier, so old
progress is not imported; same-build navigation/reload still resume. This
supersedes cross-deployment preservation of local demo progress. Wallets,
canonical Souls, ranked map storage and chain data are unaffected. Expanded
release checks pass 302 tests, including same-build resume, fresh-build
isolation and ignoring legacy saves without broad storage deletion.
