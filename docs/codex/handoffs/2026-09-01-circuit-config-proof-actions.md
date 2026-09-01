# Infinite Stellar Phase Handoff

## Phase

Immutable circuit configuration and proof-consuming Move actions

## Status

Complete as a production-shaped, fail-closed verification phase. Development
proofs now reach real game-state transitions in tests. This is not production
key activation, a contract upgrade, a mainnet deployment, or a public launch.

## Goal

Bind exact per-action circuit and ceremony identity into every Season, then
make `claim_home` and normal fleet dispatch recompute their four public inputs,
invoke Sui's native Groth16 verifier, and create package-internal witnesses only
after verification succeeds.

## Outcome

- `CircuitConfig` schema v1 commits to action kind, proof-interface version,
  public-input count, circuit source, proving key, verifying key, ceremony
  transcript, artifact manifest, and the raw `392`-byte Arkworks BN254 key.
- `SeasonManifest` binds separate claim/move config object IDs, config digests,
  verifying-key digests, and the proof network field. Same-action config or key
  substitution aborts.
- Public `claim_home` and `dispatch_move` entry points reconstruct intent from
  canonical Season, Seat, sender, Planet, nonce, deadline, and arguments before
  verification. They share the newly created Planet or Voyage only after all
  checks and state transitions succeed.
- Every Planet now stores the canonical location-hash field and a monotonic
  proof nonce. All fleet variants consume the exact source nonce atomically;
  an abort rolls it back and a successful action invalidates replay.
- Dark Forest's fixed 32-byte big-endian location ID is preserved for derived
  identity and byte-indexed planet generation. Groth16 public scalar bytes stay
  separately encoded as 32-byte little-endian values.
- A tracked development-only fixture contains real claim/move proofs, raw keys,
  and config metadata. TypeScript recomputes the config digests and asserts the
  JSON and Move vectors remain synchronized.
- Move tests use the real proofs to create a Founding Planet and dispatch a
  fleet. They reject sender mutation, expiry, same-action config substitution,
  and replay after nonce advancement.
- The game SDK models exact circuit-config pins and refuses home or movement
  builders when the production verifier is unavailable or a required pin is
  malformed/missing.
- Runtime production config construction does not exist. Both ranked readiness
  probes remain false, so development ceremony material cannot enter a live
  Season or action.

## Main changed paths

- `move/infinite_stellar/sources/circuit_config.move`
- `move/infinite_stellar/sources/proof_actions.move`
- `move/infinite_stellar/sources/proof_intent.move`
- `move/infinite_stellar/sources/season.move`
- `move/infinite_stellar/sources/planet.move`
- `move/infinite_stellar/sources/voyage.move`
- `move/infinite_stellar/sources/zk_verifier.move`
- `move/infinite_stellar/tests/circuit_config_tests.move`
- `move/infinite_stellar/tests/proof_actions_tests.move`
- `packages/prover/src/proof-intent.ts`
- `packages/prover/test/fixtures/proof-actions-development.json`
- `packages/prover/test/proof-actions-fixture.test.ts`
- `packages/game-sdk/src/sui-gateway.ts`
- `circuits/fixtures/`
- `circuits/scripts/`
- `config/proof-interface-v1.json`
- `README.md`, `circuits/README.md`, `move/infinite_stellar/README.md`
- `docs/04-technical-architecture.md`
- `docs/14-dark-forest-v06-parity.md`
- `docs/15-round5-sui-architecture.md`
- `docs/16-proof-interface-and-artifact-preflight.md`

## Verification

- Node 24 workspace typecheck, ESLint, tests, and production web build: PASS.
- Web tests: PASS, 18/18.
- Game SDK tests: PASS, 37/37.
- Prover tests: PASS, 32/32.
- Move build with warnings as errors: PASS.
- Move tests with warnings as errors: PASS, 69/69.
- Move lint: PASS.
- Full Circom 2.2.3 development build: PASS; `claim_home` remains at 9,331
  constraints and `move` at 11,489, within ptau14 capacity.
- Circuit proof/adversarial/differential suite: PASS, including 24 independent
  signed/mirrored Perlin vectors.
- Existing sealed Sui testnet deployment verification: PASS and unchanged.
- Dependency audit: PASS, zero production vulnerabilities.
- Secret-pattern scan: PASS; no tracked private key, mnemonic, or token pattern.
- JSON parse, Markdown lint, and `git diff --check`: PASS.

## Production and mainnet boundary

- Development ptau, zkeys, WASM, witnesses, and generated build outputs remain
  ignored. The tracked proof bridge is explicitly non-production.
- No constructor can create a production-approved `CircuitConfig`; the later
  constructor must use only code-pinned audited ceremony constants and freeze
  the resulting objects.
- The current normal-move adapter requires an already initialized destination
  Planet. A production-safe natural-Planet initialization/`move_new` path still
  needs a proof output for space Perlin or another audited stat commitment.
- Artifact, ship, Wormhole, Photoid, abandonment, reveal, capture, and natural-
  Planet production proof adapters remain unavailable even though their core
  state machines have fixture coverage.
- The Soulidity ABI remains unfinished and was not guessed. Production
  enrollment stays fail-closed.
- Signed client builders, production artifact hosting, multi-wallet testnet
  soak, independent audits, ceremony operations, monitoring, incident response,
  and legal/name clearance remain release gates.
- Mainnet publish/write, testnet package upgrade, Vercel deployment, production
  verifier activation, and public launch were not performed. The old sealed
  testnet canary has a different package ABI and remains only a recovery canary.

## Repository state

The user authorized committing and pushing this phase to the corresponding
GitHub repository on `codex/dark-forest-parity`. Ignored local environment,
Vercel state, build output, and disposable ceremony material are excluded.

## Recovery

The phase started from and can be recovered at
`5407e5051f49e41fdd18b71abe1b9496cbb5c137`. The prior production proof-byte
bridge handoff remains the immediate design recovery record. The sealed Sui
testnet canary remains unchanged.

## Exact next action

Specify and implement proof-verified natural Planet initialization and an atomic
`move_new` entry point so a player can discover and target an uninitialized
coordinate without trusting caller-supplied Perlin or stats. Keep all new
development configs test-only and production activation fail-closed.
