# Infinite Stellar Phase Handoff

## Phase

Checkpoint-derived multiplayer read projection

## Status

Complete. The production web client has a bounded chain-authoritative universe
read path; the playable strategy map and onchain mainnet release remain
correctly blocked.

## Outcome

The SDK now reconstructs Planet and active Voyage IDs from checkpoint-bearing
module events, then parses and validates exact shared `SeasonManifest`,
`SeasonRuntime`, `Planet`, and `Voyage` BCS. It binds every object to the pinned
Season/type origin, checks dispatch/settlement and pending-arrival relations,
re-reads the core to reject concurrent mutations, and fingerprints all object
versions, digests, previous transactions, and the event checkpoint watermark.

The direct event replay is deliberately bounded. Incomplete pagination, a
transport without checkpoints, a missing or cross-season object, a dispatch or
settlement mismatch, and a core read race all fail explicitly. A production
checkpoint indexer is still required for large universes.

For enrollment, the web client stores the public transaction digest and exact
action expectation immediately after wallet submission. Reload recovery waits
for that exact digest and reuses the same BCS event/effect reconciliation; it
never signs the action again. An existing Seat triggers the read-only universe
status path. Private coordinates and the interactive command map are not yet
merged with the chain projection.

The production web deployment is live at
<https://infinite-stellar.vercel.app> from source commit
`b0d19c8a44de8edf923387383508235918a23ebc`. Its immutable deployment is
<https://infinite-stellar-h9nwpa8sd-soulidity-ai.vercel.app>, ID
`dpl_GSRSGUXz9FwXhTHuZg8nGsnQBuHC`.

## Verification

- `npm run validate:web`: PASS, 133 TypeScript tests plus typecheck, lint, and
  production build.
- Projection adversarial cases: PASS for partial pagination, missing
  checkpoints, cross-season objects, core races, settlement mismatch, stale
  Seat response, retry, and digest recovery.
- `sui move test -e testnet --threads 1 --warnings-are-errors`: PASS, 72/72.
- Mainnet Move build and bytecode meter: PASS, 15 modules.
- `npm run verify:soulidity-mainnet`: PASS against canonical Soulidity v1.
- `npm run verify:move-mainnet-dry-run`: PASS, 544,308,000 MIST; no transaction
  submitted.
- `npm audit --audit-level=high`: PASS, zero vulnerabilities.
- Vercel build, HTTP 200, security headers, mainnet CSP, and browser fail-closed
  route smoke: PASS.

## Remaining release blockers

- Reproducible production proof ceremony and production verifier activation.
- Independent circuit, Move, and client audits.
- Production checkpoint indexer and private-coordinate map merge.
- Artifact/ship chain projection and external Artifact custody.
- Sponsor, monitoring, two-wallet soak, and incident rehearsal.
- Multisig/capability custody, operations approval, and rights clearance.

## Exact next action

Build the checkpoint-ingestion service and deterministic projection store, then
merge its authoritative Planet/Voyage state with the controller's private
coordinate vault. Keep every ranked signing route closed until production proof
and release evidence is real and reviewed.
