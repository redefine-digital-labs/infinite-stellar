# Infinite Stellar Player Client

Responsive English React client for the Infinite Stellar activation journey.

From the repository root:

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`.

The wallet control uses Mysten dApp Kit on Sui testnet. The live route exposes the pinned testnet package and sealed interface canary, while ranked entry remains intentionally fail-closed because there is no production Soul adapter or proof verifier. The local demo is clearly labeled and creates no Sui or Soul history.

Run its checks from the root with `npm run validate:web`, or from this workspace with `npm run typecheck`, `npm run test`, and `npm run build`.
