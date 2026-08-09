# Launch and Live Operations

## Operating principle

A season is a published contract with players. Its rules, artifacts, timing, and failure policy are declared before entry. Operators may protect the system, but they do not improvise competitive outcomes.

## Season manifest

Before enrollment opens, publish and pin:

- Season ID and network.
- Start, phase-change, end, and settlement times.
- Package ID and package bytecode hash.
- Rules object ID and canonical rules hash.
- Circuit config ID and all artifact hashes.
- Reference-client core/prover hash and source revision.
- Initial presentation-shell hash and compatible-release policy.
- Indexer schema version.
- League policy.
- Queue, gas-sponsorship, and rate limits.
- Scoring and tie-break rules.
- Extension, cancellation, and refund policy.
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
9. Settle permissionlessly after the declared end.
10. Publish a season report before announcing the next ruleset.

No mid-season balance patch is allowed. The manifest's reference transaction/prover core never changes. A client-only presentation fix may be added to a separate `CompatibleClientReleaseRegistry` if it does not alter transaction construction, proof semantics, rules, telemetry schema, or private-data handling. It requires a reproducible hash, two-person review, and release notes. This registry is a disclosure/compatibility surface, not authority over custom clients.

## Operational capabilities

### Pause

`PauseCap` may only toggle the pause field within its manifest-defined window. Pause stops creation of new strategic actions. When safe, already-created arrivals, withdrawals, map export, and deterministic settlement continue. The exact allowed calls are specified and tested before launch.

### Extension

`ExtensionCap` may increase `cumulative_extension_ms` only for a manifest-listed objective network or protocol availability failure, before settlement starts, and up to `max_extension_ms`. All game paths derive effective timestamps from the frozen base time plus this runtime value. The transition is announced through signed and onchain channels. Operators cannot extend because a preferred player is losing.

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
- Indexer checkpoint lag and reconciliation errors.
- Tutorial funnel and time to first valid action.
- Meaningful interaction, retention, and next-season return.
- Support volume and incident status.

Never attach coordinates, local labels, map-vault content, raw worker messages, or arbitrary transaction context to analytics.

## Community rollout

### Before closed Alpha

- Recruit strategy players, Soul holders, Move developers, and privacy-minded testers.
- Set expectations that the economy and balance may reset.
- Teach the difference between a Soul, Commander Projection, and Civilization.
- Publish a plain-language privacy model.

### During open testnet

- Run scheduled onboarding windows to create world density.
- Highlight discoveries, rescues, and rivalries—not only top rank.
- Publish weekly protocol and UX metrics.
- Open a documented vulnerability channel and bounty.
- Invite alternate analytics and read-only clients using canonical public data.

### Before mainnet

- Publish audit reports, ceremony artifacts, reproducible hashes, and unresolved limitations.
- Announce exact seat caps and sponsor terms.
- Rehearse support coverage across the first 24 hours and season end.
- Prepare chain-status, client-status, and incident communication channels that remain available if the main site fails.

## Soul chronicle operations

After settlement:

1. Freeze compact factual receipts from bounded onchain Seat/Soul accumulators; events provide independently retrievable leaves and evidence, not an indexer-invented root.
2. Segment attribution by Soul ownership epoch.
3. Aggregate external Veilworld receipts on the Soul career view without claiming to modify `SoulState`.
4. Generate optional narrative interpretation separately.
5. Let the current holder review and submit a separate supported Soulidity memory transaction.
6. Preserve links from claims to onchain evidence.
7. Mark corrected or disputed interpretations without rewriting the underlying receipt.

Chronicles should celebrate meaningful choices at multiple skill levels. A season needs memorable scouts, allies, survivors, and rivals—not only one winner.

## Support model

Support must be able to distinguish:

- Lost local map data.
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
