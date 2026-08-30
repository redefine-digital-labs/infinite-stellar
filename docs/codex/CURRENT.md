# Infinite Stellar Current Phase

- **Status:** Complete
- **Phase:** Production-grade experimental testnet release
- **Outcome:** The experimental Move foundation and sealed non-player canary are verified on Sui testnet. GitHub `main` and `codex/testnet-release` contain the tested English full stack, and the existing Vercel production project serves the fail-closed player client at <https://infinite-stellar.vercel.app>.
- **Final source commit:** `3d2bcf1e3fc17effe9a7df4751e415214a674b0b`
- **Move package:** `0x1199adc93f61acd99d6d7889c82650b79c90e51ed3816c8c40d0544f9e2c9665` on Sui testnet.
- **Production gates:** Soul enrollment and proof-backed home claims remain intentionally unavailable until exact production dependencies are frozen and audited.
- **Risk:** Name clearance remains incomplete. Mainnet, custom domain, promotion, and commercial-announcement work remain blocked by D-023. GitHub Actions activation awaits an authorized credential with `workflow` scope.
- **Exact next action:** Freeze the Soulidity Soul ABI and proof verifier interface, then start a new bounded compatibility and security-integration phase.
- **Latest handoff:** `docs/codex/handoffs/2026-08-30-production-testnet-release.md`

Read only the linked handoff when resuming. Do not enable player writes from the
testnet canary or describe the local simulation as ranked onchain gameplay.
