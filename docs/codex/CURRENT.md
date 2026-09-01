# Infinite Stellar Current Phase

- **Status:** Complete (player-facing mainnet launch remains blocked)
- **Phase:** Checkpoint-derived multiplayer read projection
- **Goal:** Implement exact Manifest, Runtime, Planet, and Voyage BCS/event projections with digest-based recovery, then expose a read-only ranked universe route without relaxing any production write gate.
- **Authorization:** GitHub delivery and production-valid Sui mainnet engineering are authorized. Development keys, missing audits, unfinished services, or absent signer approvals cannot be substituted.
- **Outcome:** Exact Manifest/Runtime/Planet/Voyage BCS/event projection, object-digest fingerprinting, core-race rejection, React existing-Seat status, and submitted-digest finality recovery are implemented and live on Vercel. The interactive ranked map remains unavailable until private coordinates and a production indexer are merged.
- **Acceptance checks:** Exact Move BCS layouts and package/type pins are validated; projections are checkpoint/digest anchored and reject malformed or cross-season objects; pending transaction recovery matches exact digest/effects; an existing Seat routes to chain-backed read-only state before local demo; stale wallet/checkpoint and retry fixtures pass; signing remains unreachable while release gates are absent.
- **Mainnet status:** No transaction was signed or submitted. Production verifier readiness remains false.
- **Remaining blockers:** Production ceremony and audits; production config activation; checkpoint-derived Planet/Voyage projections; indexer/sponsor/monitoring; two-wallet soak; reveal/capture/external Artifact adapters; multisig/capability custody; release and rights clearance.
- **Exact next action:** Build the checkpoint-ingestion service and deterministic projection store, then merge authoritative Planet/Voyage state with the controller's private coordinate vault.
- **Current handoff:** `docs/codex/handoffs/2026-09-01-ranked-universe-projection.md`
