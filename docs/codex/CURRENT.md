# Infinite Stellar Current Phase

- **Status:** Complete
- **Phase:** Production circuit relation and Sui proof-byte bridge
- **Goal:** Complete the Round-5 `claim_home` and `move` geometry relations, including Perlin/home bands and manifest-pinned parameters, then implement deterministic snarkjs-to-Sui Groth16 byte serialization plus a fail-closed Move verifier seam.
- **Reference:** Official Dark Forest v0.6 posts and the pinned post-Round-5 snapshot `darkforest-eth/darkforest-v0.6@d1e25ead311697ecaa27ff648dac16a0d8cea15c`. The reference is GPL-3.0; this repository uses an independently written compatibility implementation and original presentation.
- **Branch:** `codex/dark-forest-parity` from committed parity slice `8d3b559399230d9f60f7ae8562ef17b596a89674`.
- **In scope:** Exact Round-5 Perlin and home-band constraints; manifest-pinned geometry values committed inside the four-signal interface; canonical Groth16 proof/public-input serialization for Sui's Arkworks API; cross-language golden vectors; a test-only or fail-closed Move verifier seam; adversarial relation/serialization tests; performance evidence; documentation; full validation; authorized commit and push.
- **Non-goals:** No production Phase 2 ceremony or key generation, claim of independent circuit audit, production verifier activation, Soul ABI guess, ranked/mainnet signing, mainnet publish/write, Vercel deployment, or public launch.
- **Production boundary:** All generated Groth16 material remains development-only and ignored. The production verifier must remain impossible to construct unless a later audited package pins a ceremony-backed prepared verifying key. The unfinished Soulidity ABI, signed transaction builders, artifact custody, independent audits, operations, and legal/name clearance remain separate blockers.
- **Acceptance:** Circom recomputes the exact Round-5 location hash and Perlin/home classification from private coordinates under manifest-pinned geometry; valid claim/move witnesses prove and all mutated geometry, intent, distance, and canonical-encoding cases fail; snarkjs proofs serialize deterministically into Sui-compatible Arkworks bytes with TypeScript/Move golden vectors; the Move seam verifies only a pinned test fixture and stays production fail-closed; all TypeScript, Move, circuit, lint, build, documentation, dependency, diff, and secret-safety gates pass.
- **Deployment:** Source changes will be committed and pushed to `origin/codex/dark-forest-parity` after validation. No Vercel deployment or onchain write is authorized. The earlier sealed testnet canary remains unchanged.
- **Exact next action:** Implement immutable per-action `CircuitConfig` and ceremony-key digest topology, then add proof-consuming `claim_home` and `move` entry-point adapters while continuing to reject every development key until the independently audited Phase 2 ceremony is complete.
- **Current handoff:** `docs/codex/handoffs/2026-08-31-production-circuit-sui-proof-byte-bridge.md`
- **Previous handoff:** `docs/codex/handoffs/2026-08-31-circuit-candidate-multiplayer-rehearsal.md`

The prior production-testnet release handoff remains the recovery point for the
sealed canary. Do not modify or enable it until the production Soul, proof, and
artifact-custody adapters are frozen, audited, and separately authorized.

This phase completed the exact Round-5 Perlin/home geometry relations, one
TypeScript/Circom/Move rules commitment, canonical snarkjs-to-Sui Arkworks byte
serialization, and a Sui-native golden verification vector. Production action
readiness remains fail-closed until immutable circuit/key configuration and
audited ceremony material are wired into the Move entry points.
