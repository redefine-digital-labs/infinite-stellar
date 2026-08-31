# Infinite Stellar Phase Handoff

## Phase

Production circuit relation and Sui proof-byte bridge

## Status

Complete as an exact Round-5 geometry, development-proof, and deterministic
Sui-byte interoperability phase. The result is not an audited production
verifier, production ceremony, mainnet deployment, or public launch.

## Goal

Complete the Round-5 `claim_home` and `move` geometry relations, including
Perlin/home bands and manifest-pinned parameters, then implement deterministic
snarkjs-to-Sui Groth16 byte serialization with cross-language vectors and a
fail-closed Move verifier seam.

## Outcome

- The Circom relations independently recompute the Round-5 MiMC location hash,
  signed and mirrored three-octave Perlin noise, radius/rarity bounds, home
  space classification, route distance, and a Poseidon commitment over the
  immutable rules geometry.
- The rules geometry is typed in TypeScript and Move, pinned in
  `SeasonManifest`, and locked by one shared TypeScript/Circom/Move commitment
  vector.
- `claim_home` proves that the private location is a valid planet in the
  manifest-selected home band. `move` proves both endpoint preimages and the
  bounded route against the same manifest commitment.
- Adversarial circuit tests reject wrong preimages, negative zero, non-home
  planets, inconsistent geometry, invalid Perlin scale, threshold mutation,
  public-intent mutation, and out-of-range routes.
- A pure TypeScript serializer emits the exact canonical-compressed BN254 proof,
  prepared verifying-key, and scalar byte layouts expected by Sui's Arkworks
  Groth16 API.
- The serialization fixture was independently reproduced with a temporary Rust
  Arkworks utility. The same bytes pass Sui Move native verification, while a
  one-byte public-input mutation fails.
- The checked-in Move verifier seam exposes test-only verification and keeps
  both production action probes fail-closed. No development key can activate a
  ranked or production transaction path.
- The reviewed GitHub Actions template includes the official Circom 2.2.3
  development build/test gate, but is not installed as an active workflow
  because the repository credential still lacks workflow scope.

## Main changed paths

- `circuits/src/lib/round5_perlin.circom`
- `circuits/src/lib/rules_geometry_v1.circom`
- `circuits/src/claim_home_v1.circom`
- `circuits/src/move_v1.circom`
- `circuits/scripts/`
- `circuits/fixtures/`
- `packages/prover/src/proof-intent.ts`
- `packages/prover/src/sui-groth16.ts`
- `packages/prover/test/fixtures/claim-home-sui-serialization.json`
- `move/infinite_stellar/sources/rules_geometry.move`
- `move/infinite_stellar/sources/zk_verifier.move`
- `move/infinite_stellar/sources/season.move`
- `move/infinite_stellar/tests/rules_geometry_tests.move`
- `move/infinite_stellar/tests/zk_verifier_tests.move`
- `config/proof-interface-v1.json`
- `docs/15-round5-sui-architecture.md`
- `docs/16-proof-interface-and-artifact-preflight.md`
- `ops/github-actions/ci.yml`

## Verification

- Node 24 workspace typecheck, ESLint, tests, and production web build: PASS.
- Web tests: PASS, 18/18.
- Game SDK tests: PASS, 35/35.
- Prover tests: PASS, 27/27.
- Move build with warnings as errors: PASS.
- Move tests with warnings as errors: PASS, 61/61.
- Move lint: PASS.
- Full development circuit build: PASS; `claim_home` has 9,331 constraints and
  `move` has 11,489 constraints, both within the development ptau14 capacity.
- Circuit proof/adversarial/differential suite: PASS, including 24 independent
  TypeScript signed/mirrored Perlin vectors.
- Timed local circuit suite: PASS in 1.68 seconds on the development machine;
  this is engineering evidence, not a browser p95 claim.
- Existing sealed Sui testnet deployment verification: PASS after transient
  GraphQL connectivity retries.
- Dependency audit: PASS, zero production vulnerabilities.
- Secret-pattern scan: PASS, no tracked key, mnemonic, or Sui private-key
  material found.
- Markdown lint and `git diff --check`: PASS before repository handoff.

## Production and mainnet boundary

- All generated entropy, ptau, zkeys, witnesses, proofs, and prepared verifying
  keys remain ignored development material. No production setup material was
  generated or published.
- The repository still needs immutable per-action circuit configuration and
  ceremony-key digest topology before Move entry points may consume proofs.
- The Soulidity Soul ABI remains unfinished and is intentionally not guessed.
  A production adapter must be added only after the canonical package, object,
  ownership, epoch, and attribution interfaces are frozen.
- Independent circuit/Move/application audits, a Phase 2 ceremony and custody
  plan, signed two-wallet checkpoint-derived rehearsal, operations readiness,
  and legal/name clearance remain release gates.
- Mainnet publish/write, Vercel deployment, verifier activation, ranked signing,
  and public launch were not performed. The earlier sealed testnet canary is
  unchanged.

## Repository state

The user explicitly authorized storing the work in the corresponding GitHub
repository. This handoff and the validated implementation are committed on
`origin/codex/dark-forest-parity`. Ignored proving material, local environment
files, deployment credentials, and build outputs are excluded.

## Recovery

The phase started from commit
`8d3b559399230d9f60f7ae8562ef17b596a89674`. The previous circuit-candidate
handoff remains the behavioral recovery record, and the sealed Sui testnet
canary remains the deployment recovery point.

## Exact next action

Implement immutable per-action `CircuitConfig` and ceremony-key digest topology,
then add proof-consuming `claim_home` and `move` entry-point adapters while
continuing to reject every development key until the independently audited
Phase 2 ceremony is complete.
