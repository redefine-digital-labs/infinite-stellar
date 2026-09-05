# Infinite Stellar Player Client

Responsive English React client for the Infinite Stellar activation journey.

From the repository root:

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`.

The wallet control uses Mysten dApp Kit on Sui mainnet. The ranked route reads the
pinned canonical Soulidity ABI and fixed-controller Seat, while ranked writes
remain fail-closed without the audited game deployment, production proof keys
and release evidence. The local demo creates no Sui or Soul history.

The map home/fleet controls connect fresh chain reads, local Worker proving,
simulation, explicit wallet signature, pre-transmission digest journaling and
indexed finality. This is implemented wiring, not a live ranked release.
Production artifact URLs are selected with `VITE_CLAIM_HOME_PROOF_MANIFEST_URL`,
`VITE_MOVE_PROOF_MANIFEST_URL` and `VITE_MOVE_NEW_PROOF_MANIFEST_URL`; URLs alone
cannot open release gates or override the deployment's exact hashes/config IDs.

For offline UI-only QA, visit `/ranked-actions-development.html` (fleet) or add
`?mode=home` on the local Vite server. This uses public test fixtures and callback
readouts only: no RPC, wallet, proofs or submission. It is excluded from the
production build. Read-only canonical Sui mainnet Clock verification is available
with `npm run test:chain-read`; it does not verify undeployed game objects.

Run its checks from the root with `npm run validate:web`, or from this workspace with `npm run typecheck`, `npm run test`, and `npm run build`.
