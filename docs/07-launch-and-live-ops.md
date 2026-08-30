# Launch and Live Operations

## Operating principle

A season is a published contract with players. Its rules, artifacts, timing, and failure policy are declared before entry. Operators may protect the system, but they do not improvise competitive outcomes.

## Season manifest

Before enrollment opens, publish and pin:

- Season ID and network.
- `max_ranked_seats`, enrollment-capacity object, registry parent IDs, shard/key-encoding version, and exact controller-to-Seat derivation vectors.
- Enrollment close, universe opening, `home_claim_open_at`, competitive start, `home_claim_close_at`, phase-change, end, and settlement times.
- The ordered checkpoint-derived `HomeSearchAvailableAt` and `HomeClaimAvailableAt` rules, nonzero `seed_observation_delay_ms`, pause treatment, and any pre-competitive energy/growth clamp.
- `minimum_home_claim_window_ms` as cumulative onchain-evidenced claimable time, `0 < max_home_availability_tick_gap_ms < minimum_home_claim_window_ms`, and the predeclared late-opening/pause/outage extension-or-cancellation path.
- Recovery-close time, proof domain, one-use limit, eligible planet class, and starting energy.
- Package ID and package bytecode hash.
- Pinned Soulidity package/interface and supported ownership predicate.
- Accepted Animacraft projection policy, `ProjectionDisplayLicense` schema/resolver, authority proof rules, and public fallback.
- Manifest `Commander` role-schema ID and privacy-preserving visual delivery policy.
- Rules object ID and canonical rules hash.
- Circuit config ID and all artifact hashes.
- Reference-client core/prover hash and source revision.
- Initial presentation-shell hash and compatible-release policy.
- Indexer schema version.
- League policy, ranked scope, and one-Seat-per-controller rule, explicitly described as address-level rather than human-level Sybil resistance.
- Queue, gas-sponsorship, and rate limits.
- Scoring and tie-break rules.
- Extension causes with their own objective bounds and deltas, cancellation, and refund policy.
- Known limitations and supported device classes.

The client verifies the manifest before allowing ranked entry and displays a human-readable summary.

## Release train

1. Freeze code and game constants.
2. Produce artifacts in a clean reproducible environment.
3. Run Move, circuit, integration, vector, privacy, and load suites.
4. Verify hashes independently.
5. Publish the manifest and client candidate.
6. Run a short canary universe using the exact artifacts.
7. Open enrollment in stages.
8. Monitor public and infrastructure metrics.
9. Resolve the global home window if still pending, then settle permissionlessly after the declared end.
10. Publish a season report before announcing the next ruleset.

No mid-season balance patch is allowed. The manifest's reference transaction/prover core never changes. A client-only presentation fix may be added to a separate `CompatibleClientReleaseRegistry` if it does not alter transaction construction, proof semantics, rules, telemetry schema, or private-data handling. It requires a reproducible hash, two-person review, and release notes. This registry is a disclosure/compatibility surface, not authority over custom clients.

## Operational capabilities

### Pause

`PauseCap` may only settle bounded availability state and toggle the pause field within its manifest-defined window; it cannot move deadlines or mutate unrelated state. Pause stops creation of new strategic actions. When safe, already-created arrivals, withdrawals, map export, and deterministic settlement continue. The exact allowed calls are specified and tested before launch.

After the universe seed is public, pause cannot disable local mining or proving and official UX must not pretend otherwise. `PauseCap` settles the bounded availability accumulator and toggles pause; resume advances its last-tick time without crediting the paused interval. It never moves a deadline. If unused schedule slack is insufficient, only an `ExtensionCap`-authorized transition may add the exact delta needed to legal, still-future boundaries, either separately or atomically with resume. If effective home close arrives without the credited cumulative minimum, any account resolves the season to `HomeWindowUnavailable` cancellation/refund rather than leaving Seats stuck or blaming players.

### Extension

`ExtensionCap` may add a delta only for a manifest-listed objective network or protocol availability failure, within its call window and up to total `max_extension_ms`. For home-window restoration, it first counts unused future slack and may add no more than the remaining delta required by `minimum_home_claim_window_ms`. Every other allowed cause defines its own objective bound and maximum delta in the manifest; for example, a post-movement settlement/finalization extension is independent of the already resolved home window. Each cause maps to a declared suffix of phase boundaries that are still in the future; the same authorized delta is added to those phase-specific offsets. The call must precede the earliest affected effective boundary, preserve phase order, and cannot alter any boundary whose time has arrived or whose one-way transition has committed. After movement closes, only a separately allowed settlement/finalization deadline may move—competitive movement and the finished season cannot reopen. The transition is announced through signed and onchain channels. Operators cannot extend because a preferred player is losing.

### Cancellation

`CancelCap` may enter an irreversible cancelled state only under the manifest's causes and time window, recording a reason code and refund/receipt policy. If valid outcomes can no longer be guaranteed, do not select an offchain winner. Preserve a public record of the incident and whether participation receipts remain valid.

### Upgrade

The production engine package and any transition-affecting dependency are made immutable before the season manifest is finalized. A new engine package applies only to later seasons. The manifest does not merely rely on a multisig promise that an upgrade will leave active state alone.

## Monitoring

Public-health dashboards should cover:

- Transaction submission, success, abort code, and confirmation latency.
- Proof generation latency and memory by coarse device class, without witnesses.
- Shared-object congestion by registry shard and planet.
- Arrival queue depth and settlement lag.
- Sponsor spend, rejection rate, and abuse indicators.
- Enrollment-capacity count, final-slot contention, `ESeasonFull`, and rollback anomalies.
- Availability-tick age/credit, observation-delay enforcement, insufficient-credit cancellation risk, and same-checkpoint multi-commit timing reconstruction.
- Indexer checkpoint lag and reconciliation errors.
- Tutorial funnel, wall-clock `HomeSearchAvailableAt`-to-finalized-Founding-Planet latency, claim-gate wait, and separately labeled incident-affected cohorts.
- Privacy-safe onboarding reason/result counts for no Soul, ineligible/multiple Souls, existing Seat resume, transfer views, and vault backup/restore states.
- Meaningful interaction, retention, and next-season return.
- Support volume and incident status.

Never attach coordinates, local labels, map-vault content, raw worker messages, or arbitrary transaction context to analytics.

## Community rollout

D-023 permits only an unannounced engineering canary on the existing GitHub repository, Sui testnet, and a default Vercel URL. No custom domain, internet or social account, app-store listing, external campaign whether paid or unpaid, public event promotion, commercial announcement, mainnet release, or promoted public launch may use the Infinite Stellar brand until counsel completes clearance and any required prior written consent is obtained. Repository planning and the technical canary are not evidence of clearance.

### Before closed Alpha

- Recruit strategy players, Soul holders, Move developers, and privacy-minded testers.
- Set expectations that the economy and balance may reset.
- Teach that an address authorizes, a Soul enters, Animacraft gives visual form, a Commander Projection binds the role, a fixed Season Seat controls, and a Civilization resets.
- Publish a plain-language privacy model.
- Verify that every marketplace integration labeled supported presents active-season binding/transfer warnings before purchase; otherwise expose no market CTA from the game.

### During open testnet

- Run scheduled onboarding windows to create world density.
- Highlight discoveries, rescues, and rivalries—not only top rank.
- Publish weekly protocol and UX metrics.
- Open a documented vulnerability channel and bounty.
- Invite alternate analytics and read-only clients using canonical public data.

### Before mainnet

- Publish audit reports, ceremony artifacts, reproducible hashes, and unresolved limitations.
- Reconfirm product-name clearance and retain evidence of any written permission required for the current brand.
- Announce exact seat caps and sponsor terms.
- Rehearse support coverage across the first 24 hours and season end.
- Prepare chain-status, client-status, and incident communication channels that remain available if the main site fails.

## Soul Echo and Chronicle operations

After settlement:

1. Freeze compact factual receipts from bounded onchain Seat/Soul accumulators; events provide independently retrievable leaves and evidence, not an indexer-invented root.
2. Segment attribution by Soul ownership epoch.
3. Aggregate external Infinite Stellar receipts on the Soul career view without claiming to modify `SoulState`.
4. Generate optional narrative interpretation separately.
5. Let the current holder review and directly sign a separate supported Soulidity memory transaction; the official flow never substitutes a `SoulGrant` grantee.
6. Preserve links from claims to onchain evidence.
7. Mark corrected or disputed interpretations without rewriting the underlying receipt.

Chronicles should celebrate meaningful choices at multiple skill levels. A season needs memorable scouts, allies, survivors, and rivals—not only one winner.

## Support model

Support must be able to distinguish:

- No supported Soul, ineligible Soul, multiple eligible Souls, or an already-consumed controller/Soul slot.
- Existing Seat resume, detached seller/controller, buyer/current-holder, and wrong-wallet states.
- Lost local map data.
- Locked, corrupt, incompatible, wrong-network, wrong-season, and wrong-Seat vault imports.
- Wallet or signing failure.
- Proof-generation failure.
- Stale object or shared-object congestion.
- Rule rejection.
- Sponsor rejection.
- Indexer/UI lag.
- Confirmed onchain execution.

Support agents must never ask users to send seed phrases, private keys, full map-vault exports, or coordinate preimages through ordinary tickets.

## Post-season review

Publish:

- Final manifest and settlement transaction.
- Participation and retention metrics.
- Distribution of meaningful interactions.
- Congestion, proof, sponsor, and cost data.
- Incidents and corrective actions.
- Balance findings and proposed next-season changes.
- What will remain exactly the same.

Changes belong between seasons. The intermission is part of the product: it turns raw telemetry into a shared account of what happened and gives Souls time to absorb the universe before the next one begins.
