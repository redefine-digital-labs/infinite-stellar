# Roadmap

## Roadmap rule

Each phase ends in a go/no-go review with evidence. Calendar completion is not evidence. A failed gate should reduce scope or stop the project before audits and launch spending compound.

## Phase 0 — Technical go/no-go

**Duration:** Weeks 0–3

**Goal:** Disprove the riskiest assumptions with the smallest integrated prototype.

Deliverables:

- Minimal Circom movement circuit within Sui's public-input limit.
- Browser Web Worker that generates proofs from local coordinates.
- Move package that pins a verifying key and verifies action-bound proofs.
- Two or more independently mutable derived/shared planet objects.
- Lazy energy update and one deterministic arrival/combat path.
- TypeScript, Circom, Rust, and Move golden-vector suite.
- Synthetic load harness for uniform traffic and a hot destination.
- Minimal checkpoint indexer that can rebuild into PostgreSQL.
- Browser network-capture privacy test.

Go criteria:

- At most eight public proof inputs/signals as interpreted by the Sui API.
- Mutating sender, amount, nonce, deadline, season, source, or destination invalidates the proof/action.
- Desktop proof p95 is at most 5 seconds on the declared reference hardware.
- Peak prover memory is at most 512 MB.
- Worst-case settlement gas remains bounded and affordable at the declared queue cap.
- 10,000 synthetic actions complete without a global shared-object write bottleneck.
- Hot-planet failure behavior is understood and surfaced to the client.
- A clean database rebuild reaches the same public projections.
- No coordinate preimage appears in captured network traffic or telemetry.

No-go or redesign triggers:

- Default desktop proof latency remains above 10 seconds.
- Required semantics cannot fit safely within the public-input limit.
- The action commitment cannot be reproduced exactly across languages.
- Correct arrival settlement requires an unbounded collection.
- Ordinary moves serialize through a universe-wide object.
- Private witnesses must be sent to a trusted server for acceptable UX.

## Phase 1 — Vertical slice

**Duration:** Weeks 4–11

**Goal:** One player can complete the entire loop in an intentionally small universe.

Scope:

- Guest tutorial.
- Wallet connection and sponsored transactions.
- Existing Soul selection, canonical eligibility readback, and transfer disclosure.
- Commander Projection and Season Seat binding with a public Animacraft projection snapshot or neutral fallback.
- Local mining and encrypted map vault.
- Planet claim, growth, move, arrival, reinforcement, combat.
- Basic public map and transaction-state UX.
- Deterministic end-of-season settlement.
- Minimal frozen `InfiniteStellarSeatReceipt` and `InfiniteStellarSoulSegmentReceipt` objects, externally associated with canonical Soul IDs.

Exit criteria:

- Ten internal players finish a 60-minute session without operator state edits.
- A player can export and restore the private map.
- Every visible result links to canonical transaction/state evidence.
- Transfer of a bound Soul invalidates Soul attribution without transferring the civilization.
- Median time from ranked Seat creation to finalized home claim is under 5 minutes.

## Phase 2 — Closed Alpha

**Duration:** Weeks 12–22

**Goal:** Prove the social and strategic loop with 50–150 invited players.

Additions:

- Seven-day seasons.
- Beacon endgame prototype.
- Leaderboard and season timeline.
- Relationship receipts for reinforcement and joint objectives.
- Full observability without private-coordinate collection.
- Player support, incident, and cancellation/extension workflows.
- Balance simulation and repeated load tests.

Exit criteria:

- At least 60% tutorial completion.
- At least 99% submitted transaction success excluding valid rule rejections.
- At least 40% of players complete one meaningful social or competitive interaction.
- No unresolved high-severity privacy, contract, or circuit issue.
- Operators complete a clean indexer rebuild and an RPC failover during rehearsal.

## Phase 3 — Open testnet

**Duration:** Weeks 23–32

**Goal:** Validate acquisition, retention, abuse resistance, and world density with 100–300 active players per universe.

Entry gate:

Beyond this disclosed public planning repository and its repository metadata, no Infinite Stellar domain, internet or social account, app-store listing, external campaign, public event promotion, commercial announcement, or release may proceed until counsel completes name clearance and any required prior written consent is obtained. Phase 3 public onboarding and community activity are contingent on this gate.

Additions:

- Public onboarding and documentation.
- Sponsored-transaction abuse controls.
- Alternate read endpoints and degraded-mode UX.
- Soul chronicle review and acceptance flow.
- Community events and creator toolkit limited to safe, read-only data.
- Formal Human League policy.
- Bug bounty.

Exit criteria:

- Day-1 retention at least 30% and Day-7 at least 15% under the PRD cohort definitions.
- At least 25% of eligible players return for the next season.
- North-star interaction/return metric shows a stable or improving trend.
- No operator-only dependency prevents play or settlement.
- Mainnet cost model is measured from actual testnet action distributions.

## Phase 4 — Audit and hardening

**Duration:** Weeks 33–40

**Goal:** Freeze the production candidate and remove unacceptable risk.

Workstreams:

- Independent Move audit.
- Independent circuit audit.
- Circuit-specific trusted setup ceremony.
- Reproducible build and artifact verification.
- Economic and game-theory review of beacon scoring.
- Load, queue, sponsor, and sybil abuse exercises.
- Disaster recovery and incident simulation.
- Reconfirm name clearance and any required written permission; complete remaining legal review of original implementation, privacy, terms, and license.

No balance features are added during audit freeze.

## Phase 5 — Mainnet Season 0

**Duration:** Earliest Weeks 41–44

**Goal:** Launch a bounded, observable season without pretending scale is solved.

Staged mainnet rollout uses separate, predeclared canary universes rather than adding late players to a live world:

1. Canary universe with 100 seats and its own manifest.
2. Later 500-seat universe after the canary report and operational review.
3. Later universe with up to 2,000 seats only after congestion, sponsor, fairness, and support metrics remain healthy.

Every universe closes enrollment before its seed is sampled and begins with all participants on equal timing. Seat caps never expand after play starts.

The first mainnet release train remains tokenless. Enrollment growth is reversible; state integrity is not.

## Teams and ownership

At minimum, assign explicit owners for:

- Product/game direction.
- Move protocol.
- Circuit/prover.
- Web client and map privacy.
- Indexer/infrastructure.
- Soul protocol integration.
- Security and release engineering.
- Community/live operations.
- Art, narrative, and visual system; naming remains governed by the name-clearance gate.

One person may initially hold multiple roles, but each gate still needs an independent reviewer.

## Decision checkpoints

- **Week 3:** Is the core architecture technically viable?
- **Week 11:** Is the loop understandable and satisfying for internal players?
- **Week 22:** Does multiplayer behavior create stories rather than only optimization?
- **Week 32:** Are retention, abuse, costs, and operations strong enough to justify audits?
- **Week 40:** Is the frozen candidate safe and reproducible enough for bounded mainnet risk?
