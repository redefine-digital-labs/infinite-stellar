# Infinite Stellar Current Phase

- **Status:** Complete
- **Phase:** Proof-verified natural Planet initialization and atomic move-new
- **Goal:** Add an action-specific `move_new` proof statement that exposes proof-derived destination space Perlin, bind its exact circuit configuration into each Season, and atomically initialize the unique neutral destination Planet plus dispatch a colonizing voyage without trusting caller-supplied Planet stats.
- **Reference:** Official Dark Forest v0.6 posts and the pinned post-Round-5 snapshot `darkforest-eth/darkforest-v0.6@d1e25ead311697ecaa27ff648dac16a0d8cea15c`. The reference is GPL-3.0; this repository uses an independently written compatibility implementation and original presentation.
- **Branch:** `codex/dark-forest-parity` from committed proof-byte bridge `5407e5051f49e41fdd18b71abe1b9496cbb5c137`.
- **In scope:** A frozen action-specific five-signal `move_new` extension; exact Season config binding; proof-derived destination Perlin; deterministic natural Planet initialization; atomic voyage dispatch; occupied-location, replay, race, and rollback protections; test-only real development proof flows; SDK/config documentation; full validation; authorized commit and push.
- **Non-goals:** No production Phase 2 ceremony or key generation, claim of independent circuit audit, production config activation, Soul ABI guess, reveal/capture circuit completion, ranked/mainnet signing, mainnet publish/write, Vercel deployment, or public launch.
- **Production boundary:** Test-only development configs may prove the complete adapter path, but production `CircuitConfig` construction and ranked proof actions must remain impossible until audited ceremony artifacts and their digests are code-pinned. The unfinished Soulidity ABI, signed transaction builders, artifact custody, independent audits, operations, and legal/name clearance remain separate blockers.
- **Acceptance:** A Season binds the exact immutable `move_new` config ID, config digest, and verifying-key digest; callers cannot substitute destination Perlin, action/config/key metadata, source nonce, or location; one transaction verifies the proof, claims the derived Planet ID, initializes proof-derived stats, and dispatches the voyage; every downstream abort rolls all state back; real development proof fixtures exercise the path without exposing a runtime development bypass; all Node 24 workspace, Move, circuit, lint, build, documentation, dependency, diff, and secret-safety gates pass.
- **Deployment:** Validated source will be committed and pushed to `origin/codex/dark-forest-parity`. No Vercel deployment or onchain write is authorized. The earlier sealed testnet canary remains unchanged.
- **Acceptance result:** Complete. The action-specific relation and exact config/key pins are implemented; a real development Groth16 proof atomically initializes the derived natural Planet and dispatches its Voyage; caller Perlin substitution, occupied-coordinate races, action/config substitution, expiry, and nonce replay reject. Node 24 validation passed 93 TypeScript tests, Move passed 72 tests plus warning-clean build/lint, Circom valid/adversarial vectors passed, dependency audit found zero production vulnerabilities, and the sealed testnet deployment still verifies unchanged.
- **Exact next action:** Start a separate mainnet-readiness phase: resolve the canonical Soulidity mainnet package ABI and IDs, inventory production circuit ceremony/audit artifacts, and verify multisig funding/control before constructing any publish transaction.
- **Current handoff:** `docs/codex/handoffs/2026-09-01-proof-verified-move-new.md`
- **Previous handoff:** `docs/codex/handoffs/2026-09-01-circuit-config-proof-actions.md`

The prior production-testnet release handoff remains the recovery point for the
sealed canary. Do not modify or enable it until the production Soul, proof, and
artifact-custody adapters are frozen, audited, and separately authorized.

The current phase closes the natural-Planet discovery gap while preserving the
frozen four-signal claim/move interface. Development artifacts remain test-only;
production action readiness stays fail-closed until audited ceremony constants
for every bound action are code-pinned and explicitly activated.
