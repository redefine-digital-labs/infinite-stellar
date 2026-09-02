# Infinite Stellar Current Phase

- **Status:** In progress (player-facing mainnet launch remains blocked)
- **Phase:** Production checkpoint index and private-map merge
- **Goal:** Add a deterministic, resumable checkpoint projection store and merge its authoritative Planet/Voyage state with the controller's private coordinate vault for an existing-Seat multiplayer map route.
- **Authorization:** GitHub delivery and production-valid Sui mainnet engineering are authorized. Development keys, missing audits, unfinished services, or absent signer approvals cannot be substituted.
- **Outcome:** Work in progress. The prior bounded direct-RPC projection remains live while the durable index and safe private-coordinate merge are implemented.
- **Acceptance checks:** Checkpoint replay is ordered, idempotent, cursor-persistent, and detects gaps/reorg-incompatible input; projection snapshots bind exact chain/package/season and object digests; private coordinates never enter public storage or telemetry; merge rejects stale/cross-seat/cross-season records and never invents authoritative ownership/resources; existing Seats can render a chain-backed interactive map; large-world reads no longer depend on bounded browser event pagination; signing remains unreachable while release gates are absent.
- **Mainnet status:** No transaction was signed or submitted. Production verifier readiness remains false.
- **Remaining blockers:** Production ceremony and audits; production config activation; sponsor/monitoring; two-wallet soak; reveal/capture/external Artifact adapters; multisig/capability custody; release and rights clearance.
- **Exact next action:** Specify the cursor, snapshot, API, and private-coordinate merge contracts before implementing their deterministic reducers and client route.
- **Current handoff:** `docs/codex/handoffs/2026-09-01-ranked-universe-projection.md`
