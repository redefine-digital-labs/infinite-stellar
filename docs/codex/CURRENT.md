# Infinite Stellar Current Phase

- **Status:** Complete (web canary live; player-facing mainnet launch remains blocked)
- **Phase:** Vercel playable-canary deployment and mainnet release-gate execution
- **Goal:** Deploy and verify the current validated gameplay client on the existing Vercel project, then execute the production mainnet release gates and submit only if the production verifier, audits, custody, and configuration are genuinely ready.
- **Authorization:** GitHub delivery and production-valid Sui mainnet engineering are authorized. Development keys, missing audits, unfinished services, or absent signer approvals cannot be substituted.
- **Delivered:** Vercel production deployment `dpl_9mqhtJ3krUJkPMszA3rSKRxxAjoH` at `https://infinite-stellar.vercel.app`; Sui mainnet RPC CSP allowance; public deployment evidence; complete browser journey smoke; rerun canonical Soulidity and mainnet publish dry-run gates.
- **Verification:** 105 TypeScript tests and production build; zero dependency vulnerabilities; public HTTP 200 and security headers; browser Soul-to-full-map journey and zoom; 15-module mainnet publish dry-run at 544,308,000 MIST simulated net gas; canonical Soulidity live ABI verification.
- **Mainnet status:** No transaction was signed or submitted. Production verifier readiness remains false.
- **Remaining blockers:** Production ceremony and audits; production config activation; ranked React integration; checkpoint-derived Planet/Voyage projections; indexer/sponsor/monitoring; two-wallet soak; reveal/capture/external Artifact adapters; multisig/capability custody; release and rights clearance.
- **Exact next action:** Complete production ceremony/audit and reviewed verifier-key pinning while wiring the tested gateway and checkpoint-derived read model into the ranked React route; then run the two-wallet rehearsal and rerun every release gate before signing mainnet.
- **Current handoff:** `docs/codex/handoffs/2026-09-01-vercel-production-and-mainnet-gate.md`
- **Previous handoff:** `docs/codex/handoffs/2026-09-01-production-player-gateway.md`
