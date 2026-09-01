# Infinite Stellar Current Phase

- **Status:** In progress (player-facing mainnet launch remains blocked)
- **Phase:** Vercel playable-canary deployment and mainnet release-gate execution
- **Goal:** Deploy and verify the current validated gameplay client on the existing Vercel project, then execute the production mainnet release gates and submit only if the production verifier, audits, custody, and configuration are genuinely ready.
- **Authorization:** GitHub delivery and production-valid Sui mainnet engineering are authorized. Development keys, missing audits, unfinished services, or absent signer approvals cannot be substituted.
- **Starting point:** Exact Sui proof bytes/public inputs; sender/Seat/Manifest/nonce/deadline-bound enrollment/home/move/move-new PTBs; checked simulation; resolved-failure handling; indexed-finality and BCS event/effect reconciliation; deterministic controller Seat derivation; BCS-validated Projection/Civilization/Score recovery.
- **Verification:** 105 TypeScript tests and production build; 72 Move tests; mainnet lint/build/bytecode meter; 15-module mainnet publish dry-run at 544,308,000 MIST simulated net gas; canonical Soulidity live ABI verification; pinned Circom 2.2.3 development build/adversarial proofs; docs, deployment, dependency, and diff checks all pass.
- **Mainnet status:** No transaction was signed or submitted. Production verifier readiness remains false.
- **Remaining blockers:** Production ceremony and audits; production config activation; ranked React integration; checkpoint-derived Planet/Voyage projections; indexer/sponsor/monitoring; two-wallet soak; reveal/capture/external Artifact adapters; multisig/capability custody; release and rights clearance.
- **Acceptance checks:** Linked Vercel project verified; locked production build passes; production URL serves the current gameplay client; deployment evidence is recorded; mainnet release verifier, signer/custody, gas, package, and production proof gates are checked; no mainnet transaction is submitted unless every non-overridable production gate passes.
- **Exact next action:** Inspect the linked Vercel production state and mainnet release inputs, validate the artifact, deploy the web canary, and run the release gate without bypasses.
- **Current handoff:** `docs/codex/handoffs/2026-09-01-production-player-gateway.md`
