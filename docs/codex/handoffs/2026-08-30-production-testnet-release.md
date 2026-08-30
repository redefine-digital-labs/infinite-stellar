# Infinite Stellar Phase Handoff

## Phase

Production-grade experimental testnet release

## Status

Complete

## Goal

Publish and verify the experimental Move foundation and a sealed canary on Sui
testnet, push the English full-stack repository to GitHub, and serve the
fail-closed player client from the existing Vercel production project.

## Outcome

The Move package and five canary objects are live and independently verified on
Sui testnet. GitHub `main` and `codex/testnet-release` point to the tested source,
and the Vercel production alias serves the expected desktop and mobile client.
Production Soul enrollment and proof submission remain unavailable by design.

This is an experimental, unaudited testnet foundation with a local player
simulation. It is not a ranked onchain game release, a mainnet release, name
clearance, or a claim of production Soul or zero-knowledge readiness.

## Public release surfaces

- GitHub: <https://github.com/redefine-digital-labs/infinite-stellar>
- Player client: <https://infinite-stellar.vercel.app>
- Vercel deployment: `dpl_38DzDJQTGqTcM8vAxrP2SifB4Djb`
- Immutable deployment URL:
  <https://infinite-stellar-6mhubhv81-soulidity-ai.vercel.app>
- Final source commit: `3d2bcf1e3fc17effe9a7df4751e415214a674b0b`
- Move publish source commit: `2852942d191cb6223104d7007b995521b2f0ed1e`

## Sui testnet evidence

- Network: `testnet`
- Publisher:
  `0xadea1910ac0e738dc020247bc5408b57b15f3701026a96098b716a35c3a6c52f`
- Package:
  `0x1199adc93f61acd99d6d7889c82650b79c90e51ed3816c8c40d0544f9e2c9665`
- Publish transaction:
  `4UQtWdTPhTcD42bLp8J6dijgFDXpHaoCF6szq2P8hL7c`
- Bootstrap transaction:
  `4qpWz1qmbSHgG8w9MStaTMYjkET7Zc185LZXCWyZtBso`
- Canary manifest:
  `0x462831ce16999c96806cf49eba26ab7241fe67ed363d53eb6a26c4336d3fcb60`
- Runtime:
  `0xd2566cb35d34878813dfddd28abb15f8c9b5f000b6f7c7a84e9dd94c634a2a53`
- Enrollment registry:
  `0x6ce34ef502b587568481d7f4a90bc9b6263e96d7dd4dada5c22f709ba22b1008`
- Planet registry:
  `0x45573501f0555830166699b3bc7e6540e05f9209a5337f5e13190df9d7fc0983`
- Season admin capability:
  `0x8063de610cce2eea3cdd668a51ad326ec04c93ba47b1bb4433da1c90e61dc47b`
- Upgrade capability:
  `0x50eec9dab66c1b6ccc4482149fd32fa203a6f7fe3dfa065af0bc8500931b81ed`

The full chain identifier, initial object digests, checkpoints, timestamps, gas,
bindings, and expected owners are pinned in
`ops/deployments/sui-testnet-v0.1.0.json`. `npm run verify:deployment` reads the
public chain and verifies the package, interfaces, transactions, event, object
types, bindings, owners, initial digests, and closed readiness flags.

## Durable decisions

- The public release is an experimental, unaudited testnet canary.
- Ranked enrollment and home claims stay fail-closed until the exact Soulidity
  package, ownership epoch semantics, and proof verifier are frozen.
- The canary uses league `255`, one non-player seat, future 2030 dates, and false
  Soul/proof/home readiness flags. It must never admit a player.
- D-023 permits the existing GitHub repository, Sui testnet address, and default
  Vercel URL only. Mainnet, a custom domain, promotion, commercial announcement,
  and any name-clearance claim remain out of scope.
- The exact Slush metadata origin is present in CSP. In the in-app test browser,
  its Cloudflare edge returned `403`; the official Mysten SDK then used its
  built-in metadata fallback and registered the Slush wallet successfully.
  No self-hosted wallet metadata or broad CSP wildcard was introduced.

## Verification

- `npm run validate:web`: PASS. Web tests 4/4, SDK tests 12/12, typecheck,
  ESLint, and production build all passed.
- `npm run lint:docs`: PASS. Twenty-eight files, zero issues.
- `sui move build --warnings-are-errors`: PASS.
- `sui move test --threads 1 --warnings-are-errors`: PASS. Twenty-four tests.
- `sui move lint`: PASS.
- `npm run verify:deployment`: PASS against Sui testnet GraphQL.
- `vercel build --prod`: PASS. npm audit reported zero vulnerabilities.
- Public `/` and `/a-deep-route`: PASS with HTTP `200`.
- CSP, COOP, HSTS, nosniff, frame, referrer, and permissions headers: PASS.
- Desktop at 1280 × 720: PASS.
- Mobile at 390 × 844: PASS; document width equals viewport width.
- Wallet discovery and the fail-closed live gate: PASS.
- GitHub `main` and `codex/testnet-release` contain the final application source
  commit and this release handoff: PASS.
- Public repository prose, secret scan, private map-data review, and clean diff
  checks: PASS.

## Risks and remaining gates

- Soulidity's production ABI, listing/kiosk rules, ownership epoch behavior, and
  grant semantics are unresolved. No production Soul write is enabled.
- The proof circuit and verifier are unresolved. The local search is a visible
  simulation and cannot produce an onchain home claim.
- The product name is not legally cleared. Another rename may still be required.
- The configured GitHub OAuth token lacks `workflow` scope. The reviewed CI
  workflow is preserved at `ops/github-actions/ci.yml`, but it is not active
  under `.github/workflows/` until an authorized credential can install it.
- The Slush metadata control-plane request produced a non-blocking upstream
  console error in the in-app browser. The SDK fallback wallet remained usable;
  no Infinite Stellar application exception occurred.

## Recovery

- GitHub application recovery point:
  `3d2bcf1e3fc17effe9a7df4751e415214a674b0b`; later commits only record the
  release handoff.
- Vercel rollback candidate: `dpl_2Vx35rcqPrDrCR48Sdp2AK17UGmd`.
- The Sui package and canary objects are public and cannot be deleted. They are
  isolated from players by their manifest dates, league, capacity, and false
  readiness flags. The SeasonAdminCap and UpgradeCap remain with the publisher.
- No force push, mainnet transaction, custom domain, secret publication, or
  production player-coordinate upload occurred.

## Exact next action

Start a new bounded integration phase after the Soulidity Soul ABI and proof
verifier interface are frozen. Add cross-package compatibility fixtures and
security review, then replace the two fail-closed transaction builders only
after ownership epoch, listing/kiosk, intent, replay, and verifier tests pass.
