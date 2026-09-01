# Proof-Verified Move-New Handoff

## Status

Complete on `codex/dark-forest-parity`. This phase adds the missing proof-bound
path from a controlled Planet to a previously uninitialized natural Planet. It
does not deploy or activate production proof keys.

## Delivered

- Added `circuits/src/move_new_v1.circom`, fixtures, deterministic development
  artifact generation, adversarial proof tests, and Move adapter export.
- Preserved the frozen four-signal `claim_home`/`move` interface and added an
  action-specific five-signal `move_new` extension. Its third public signal is
  the exact Round-5 destination space Perlin.
- Added action kind `5`, 160-byte public-input serialization, a 424-byte BN254
  prepared verifying-key requirement, and exact artifact-manifest signal-order
  selection in the TypeScript prover.
- Bound an exact `move_new` `CircuitConfig` ID, config digest, and verifying-key
  digest into every production-shaped `SeasonManifest`.
- Added `proof_actions::dispatch_move_new`: it verifies the route and action
  intent, claims the deterministic Planet ID, initializes neutral Round-5 stats
  from verified outputs, and dispatches the colonizing Voyage in one atomic Sui
  transaction.
- Added SDK fail-closed deployment pin validation for the new action.
- Updated the architecture, parity, proof-interface, circuit, Move, and root
  documentation.

## Security Properties Exercised

- The caller cannot substitute destination space Perlin after proof creation.
- The action is bound to network, league, Season, Seat, sender, source and
  destination location hashes, maximum distance, source nonce, deadline, and
  rules geometry.
- A normal-move circuit/config/manifest cannot substitute for `move_new`.
- A second transaction cannot claim an already initialized coordinate.
- Downstream dispatch failure aborts Planet registry claim, Planet creation,
  source energy/nonce mutation, and Voyage creation together.
- Artifact preflight rejects a manifest whose public-signal order differs from
  the selected action even when the circuit ID and version otherwise match.

## Validation

- `npm run validate:web` on Node 24: 18 Web, 38 game-SDK, and 37 prover tests;
  typecheck, ESLint, and production builds passed.
- `sui move build --warnings-are-errors`: passed.
- `sui move test --warnings-are-errors`: 72/72 passed.
- `sui move lint --warnings-are-errors`: passed.
- Circom 2.2.3 development build, valid proofs, adversarial mutations, and Move
  adapter fixture export passed for `claim_home`, `move`, and `move_new`.
- `npm run lint:docs`: passed with zero issues.
- `npm audit --omit=dev`: zero vulnerabilities.
- `npm run verify:deployment`: the existing sealed Sui testnet canary remains
  verified and unchanged.
- JSON parsing, `git diff --check`, and changed-content secret-pattern scans
  passed.

## Production Boundary

All checked-in proving and verification material is development-only. Runtime
production config construction and all ranked proof actions remain deliberately
unreachable. No Vercel deployment, testnet write, mainnet publish, mainnet
transaction, or multisig mutation occurred in this phase.

Production still requires exact Soulidity mainnet ABI/package binding,
reproducible production circuit builds, Phase 2 ceremony provenance, independent
circuit and Move audits, code-pinned production config constructors/readiness,
artifact custody, signer/multisig policy, funded gas, and a separately verified
mainnet bootstrap manifest.

## Exact Next Action

Run a bounded mainnet-readiness audit against the actual Soulidity repository,
deployment manifests, local Sui client configuration, and GitHub/Vercel state.
Resolve canonical Soul type/ownership/epoch semantics and multisig control. Only
then construct reviewable mainnet publish/bootstrap transaction data; do not
replace missing audited proof material with development keys.
