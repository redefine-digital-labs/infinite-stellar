# Infinite Stellar Phase Handoff

## Phase

Chain-backed ranked route and canonical Soul discovery

## Status

Complete. The production web route reads canonical Sui mainnet identity state;
the onchain mainnet release remains correctly blocked.

## Outcome

The SDK now discovers canonical shared `SoulState` objects through pinned
`SoulCreated` events, validates live BCS identity/current ownership/epoch/listing
state, and reads the bound Soul object. The React route derives and reads an
existing controller Seat before Soul discovery, survives wallet changes and
retry races, and presents only chain-backed candidates.

Ranked enrollment now creates a version-bound neutral Commander Projection,
simulates before wallet signing, waits for indexed finality, and reconciles
exact effects/events. The signing action cannot appear unless the complete game
deployment, all production proof configs, ceremony and independent audit
digests, operations approval, and multisig policy are pinned. No mainnet game
transaction was signed or submitted.

The production web deployment is live at
<https://infinite-stellar.vercel.app> from source commit
`956715a01ef922d01c13255ef2d21bdb2d97b480`. Its immutable deployment is
<https://infinite-stellar-kdfgserst-soulidity-ai.vercel.app>, ID
`dpl_EEjTNS9JwMZFzkimFBhkHCPopz9m`.

## Verification

- `npm run validate:web`: PASS, 121 TypeScript tests plus typecheck, lint, and
  production build.
- `sui move test -e testnet --threads 1 --warnings-are-errors`: PASS, 72/72.
- Mainnet Move build, lint, and bytecode meter: PASS, 15 modules and 337,201
  verifier ticks.
- `npm run verify:soulidity-mainnet`: PASS against canonical Soulidity v1.
- Live mainnet Soul discovery: PASS, complete event replay with zero current
  `SoulCreated` events; no transaction submitted.
- `npm run verify:move-mainnet-dry-run`: PASS, 544,308,000 MIST; no transaction
  submitted.
- `npm audit --audit-level=high`: PASS, zero vulnerabilities.
- Vercel build, HTTP 200, security headers, mainnet CSP, and browser fail-closed
  route smoke: PASS.

## Remaining release blockers

- Reproducible production proof ceremony and production verifier activation.
- Independent circuit, Move, and client audits.
- Checkpoint-derived Manifest, Runtime, Planet, and Voyage projections.
- Production indexer, sponsor, monitoring, and digest-based crash recovery.
- Two-wallet production-candidate soak and incident rehearsal.
- Multisig/capability custody, operations approval, and rights clearance.

## Exact next action

Implement checkpoint-derived Manifest, Runtime, Planet, and Voyage projections
plus digest-based recovery. Rehearse signing with two wallets only after exact
production-candidate proof and release evidence exists; do not publish the
current fail-closed package to mainnet.
