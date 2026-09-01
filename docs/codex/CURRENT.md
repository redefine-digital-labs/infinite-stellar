# Infinite Stellar Current Phase

- **Status:** Complete
- **Phase:** Immutable circuit configuration and proof-consuming Move actions
- **Goal:** Pin per-action circuit, verification-key, and ceremony identity in immutable `CircuitConfig` objects and each `SeasonManifest`, then add `claim_home` and `move` adapters that recompute the four public inputs, verify Groth16 bytes, consume replay state, and only then construct package-internal witnesses.
- **Reference:** Official Dark Forest v0.6 posts and the pinned post-Round-5 snapshot `darkforest-eth/darkforest-v0.6@d1e25ead311697ecaa27ff648dac16a0d8cea15c`. The reference is GPL-3.0; this repository uses an independently written compatibility implementation and original presentation.
- **Branch:** `codex/dark-forest-parity` from committed proof-byte bridge `5407e5051f49e41fdd18b71abe1b9496cbb5c137`.
- **In scope:** Immutable per-action config metadata and digests; exact Season config binding; public-input/action recomputation; Sui native proof verification; canonical location-hash storage; per-source proof nonce consumption; deadline and object-intent checks; test-only real development proof flows; adversarial config/proof/replay tests; SDK/config documentation; full validation; authorized commit and push.
- **Non-goals:** No production Phase 2 ceremony or key generation, claim of independent circuit audit, production config activation, Soul ABI guess, reveal/capture circuit completion, ranked/mainnet signing, mainnet publish/write, Vercel deployment, or public launch.
- **Production boundary:** Test-only development configs may prove the complete adapter path, but production `CircuitConfig` construction and ranked proof actions must remain impossible until audited ceremony artifacts and their digests are code-pinned. The unfinished Soulidity ABI, signed transaction builders, artifact custody, independent audits, operations, and legal/name clearance remain separate blockers.
- **Acceptance:** A Season binds exact immutable claim/move config IDs, config digests, and verifying-key digests; callers cannot substitute action/config/key metadata; adapters reconstruct intent and public inputs from canonical objects/arguments, reject expired or mutated proofs, and atomically consume a source-Planet nonce; real development proof fixtures exercise claim then move in Move tests without exposing a runtime development bypass; all Node 24 workspace, Move, circuit, lint, build, documentation, dependency, diff, and secret-safety gates pass.
- **Deployment:** Validated source will be committed and pushed to `origin/codex/dark-forest-parity`. No Vercel deployment or onchain write is authorized. The earlier sealed testnet canary remains unchanged.
- **Exact next action:** Specify and implement proof-verified natural Planet initialization and atomic `move_new` so a player can discover and target an uninitialized coordinate without trusting caller-supplied Perlin or stats.
- **Current handoff:** `docs/codex/handoffs/2026-09-01-circuit-config-proof-actions.md`
- **Previous handoff:** `docs/codex/handoffs/2026-08-31-production-circuit-sui-proof-byte-bridge.md`

The prior production-testnet release handoff remains the recovery point for the
sealed canary. Do not modify or enable it until the production Soul, proof, and
artifact-custody adapters are frozen, audited, and separately authorized.

This phase bound exact claim/move circuit configs into each Season and routed
real development Groth16 proofs through Founding Planet creation and nonce-bound
fleet dispatch. Production action readiness remains fail-closed until audited
ceremony constants are code-pinned and explicitly activated. Natural Planet
initialization/`move_new` is the next gameplay proof gap.
