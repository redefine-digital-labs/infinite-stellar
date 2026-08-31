# Infinite Stellar Current Phase

- **Status:** Complete
- **Phase:** Circuit candidate and real-multiplayer rehearsal
- **Goal:** Implement audit-ready candidate `claim_home` and `move` Circom relations against proof interface v1, generate development-only Groth16 artifacts, connect proof execution and verification without opening production gates, and rehearse two-controller shared-season transactions.
- **Reference:** Official Dark Forest v0.6 posts and the pinned post-Round-5 snapshot `darkforest-eth/darkforest-v0.6@d1e25ead311697ecaa27ff648dac16a0d8cea15c`. The reference is GPL-3.0; this repository uses an independently written compatibility implementation and original presentation.
- **Branch:** `codex/dark-forest-parity` from release-record commit `75fe712e4d2349b2e6b57dfa3751dade7921a48d`.
- **In scope:** `claim_home` and `move` Circom source; constrained coordinate/location/action/rules relations; adversarial witness tests; reproducible development-only Groth16 artifacts; browser/local proving and verification; test-only or rehearsal verifier integration; two-controller shared-state transaction rehearsal; performance and memory evidence; documentation and full validation.
- **Non-goals:** No production Phase 2 ceremony, production proving/verifying key, claim of circuit audit, production verifier activation, mainnet publish/write, public launch, or Vercel deployment in this phase. The validated implementation will be committed and pushed to the development branch as explicitly authorized by the user.
- **Production boundary:** Development `claim_home` and `move` proofs can be generated and self-verified in the browser Worker, but they are not production relations or keys. Round-5 Perlin/home bands, manifest-dynamic geometry, Arkworks-to-Sui proof serialization, an audited Move verifier wrapper, a production ceremony, the canonical Soul ABI, and independent audits remain fail-closed. Wallet-owned Sui artifact custody and signed ranked transaction builders are also absent.
- **Acceptance:** Complete. Circom proves the exact four-signal v1 candidates; adversarial coordinates, distance, intent, and action mutations fail; generated development artifacts are content-addressed and production-ineligible; local proof generation/self-verification passes; TypeScript and Move share golden commitments and public-input digests; two controllers mutate one shared rehearsal season without cross-control; all TypeScript, Move, circuit, lint, build, documentation, dependency, diff, and browser gates pass.
- **Deployment:** The validated phase is recorded on `origin/codex/dark-forest-parity`. No Vercel deployment or onchain write occurred. The earlier sealed testnet canary remains unchanged. The wallet client targets mainnet, but ranked construction/signing and production verification remain fail-closed.
- **Exact next action:** Complete Perlin/home-band and manifest-dynamic geometry constraints, implement the audited Arkworks-to-Sui proof bridge and verifier wrapper, then run signed two-wallet testnet transactions before a production setup ceremony is considered.
- **Current handoff:** `docs/codex/handoffs/2026-08-31-circuit-candidate-multiplayer-rehearsal.md`
- **Previous handoff:** `docs/codex/handoffs/2026-08-31-worker-mining-encrypted-vault.md`

The prior production-testnet release handoff remains the recovery point for the
sealed canary. Do not modify or enable it until the production Soul, proof, and
artifact-custody adapters are frozen, audited, and separately authorized.
