# Infinite Stellar Phase Handoff

## Phase

Vercel playable-canary deployment and mainnet release-gate execution

## Status

Complete. The web canary is live; the onchain mainnet release remains correctly
blocked.

## Outcome

The current Round 5 local gameplay client is live at
<https://infinite-stellar.vercel.app> from source commit
`85c9db6a205fed6e6fbeecd9bc9e182371fd0ab4`. The Vercel production deployment
is `dpl_9mqhtJ3krUJkPMszA3rSKRxxAjoH`. CSP now permits the pinned Sui mainnet RPC
as well as the sealed testnet evidence endpoint.

The production mainnet release was not submitted. Canonical Soulidity mainnet
ABI verification and a 15-module Sui publish dry-run pass, with simulated net
gas of `544308000` MIST and sufficient gas available. The ranked home, move,
move-new, voyage, and reveal verifier readiness functions remain fail-closed,
and the production proof ceremony and independent audit are incomplete. A
publish now would create an unusable package rather than a playable mainnet
season.

## Verification

- `npm ci`: PASS, zero reported vulnerabilities.
- `npm run validate:web`: PASS, 105 TypeScript tests plus typecheck, lint, and
  production build.
- Vercel production deployment: READY and aliased to the canonical default URL.
- Public `/`: HTTP 200; CSP includes the Sui mainnet RPC.
- Browser smoke: Soul fixture selection, Seat creation, universe opening, local
  search, Founding Planet claim, full-screen command map, and 100% to 80% zoom.
- `npm run verify:soulidity-mainnet`: PASS against canonical Soulidity v1.
- `npm run verify:move-mainnet-dry-run`: PASS, 15 modules, `544308000` MIST.
- No Sui mainnet transaction was signed or submitted.

## Exact next action

Complete the independent production ceremony and audit, code-pin the reviewed
verifier keys, and activate the production configs only through reviewed Move
tests. In parallel, wire the tested gateway and deterministic Seat/chain read
model into the React ranked route and complete the two-wallet rehearsal. Then
rerun the release gate before any mainnet signature.
