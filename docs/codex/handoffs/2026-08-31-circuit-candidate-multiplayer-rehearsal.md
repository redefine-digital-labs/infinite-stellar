# Infinite Stellar Phase Handoff

## Phase

Circuit candidates and shared-season multiplayer rehearsal

## Status

Complete as a development-circuit, proof-runtime, and shared-state rehearsal
phase. The result is not a production circuit, production verifier, mainnet
deployment, or public launch.

## Goal

Add development `claim_home` and `move` Circom candidates against proof
interface v1, connect content-addressed browser proof generation and local
self-verification, and prove that two controllers can mutate one shared Sui
season without cross-control.

## Outcome

- Circom 2.2.3 candidates expose exactly four public signals in the frozen order:
  `source_location_hash`, `destination_location_hash`, `action_commitment`, and
  `rules_geometry_commitment`.
- Both candidates constrain canonical signed coordinate encoding, reject
  negative zero, reproduce the Round-5 MiMC location hash, enforce fixed-radius
  and planet-rarity bounds, and reproduce the sixteen-field Sui BN254 Poseidon
  action commitment.
- `move` additionally constrains both coordinate preimages and squared route
  distance. For interface v1, proof-intent `amount_u64` means maximum route
  distance; energy and silver remain separate live-state transaction inputs.
- Deterministic fixtures produce matching TypeScript and Move action commitments
  and exact 128-byte public-input SHA-256 digests.
- Development Groth16 setup artifacts are generated only under ignored
  `circuits/build/`, carry content-addressed development manifests, and are
  explicitly forbidden in production.
- The Prover Worker retains preflighted artifacts, runs snarkjs `fullProve`,
  validates the four canonical BN254 scalars, self-verifies the result, and
  returns a typed Groth16 proof without wallet authority.
- A positive Move rehearsal enrolls Alice and Bob into one manifest, claims two
  homes, dispatches independent routes, preserves isolated pending voyages, and
  settles both destinations to the correct Seats.
- The map-first client is fullscreen. Zoom, pan, Home, Fit, floating windows,
  and route geometry remain aligned during live desktop browser testing.

## Main changed paths

- `circuits/src/claim_home_v1.circom`
- `circuits/src/move_v1.circom`
- `circuits/src/lib/`
- `circuits/scripts/`
- `circuits/fixtures/`
- `packages/prover/src/proof-runtime.ts`
- `packages/prover/src/worker-protocol.ts`
- `packages/prover/test/proof-runtime.test.ts`
- `apps/web/src/prover.worker.ts`
- `apps/web/src/prover-client.ts`
- `apps/web/src/prover-client.test.ts`
- `move/infinite_stellar/tests/proof_intent_tests.move`
- `move/infinite_stellar/tests/voyage_tests.move`
- `config/proof-interface-v1.json`
- `docs/16-proof-interface-and-artifact-preflight.md`
- `docs/04-technical-architecture.md`

The branch also contains the earlier uncommitted Round-5 parity, encrypted
vault, map-first floating UI, recoverable camera, route alignment, and Spacetime
Rip phases. Their dedicated handoffs remain under `docs/codex/handoffs/`.

## Verification

- Node 24 `npm ci`: PASS; 373 packages installed and zero vulnerabilities.
- Workspace TypeScript, ESLint, Markdown lint, and production build: PASS.
- Web tests: PASS, 18/18.
- Game SDK tests: PASS, 35/35.
- Prover tests: PASS, 23/23.
- Move tests with warnings as errors: PASS, 56/56.
- Development circuit build: PASS; both Groth16 zkeys verify.
- Circuit proof vectors: PASS; valid claim/move proofs verify while mutated
  action commitments, wrong coordinate preimages, negative zero, and an
  out-of-range route fail.
- Dependency audit: PASS, zero vulnerabilities.
- Browser QA at 1440×900: PASS. Fullscreen map, 156% zoom, camera drag, Home,
  zoom-out, Fit, and route endpoint alignment were exercised without runtime
  errors.
- `git diff --check`: PASS before repository handoff.

## Production and mainnet boundary

The candidates are intentionally incomplete and development-only:

- `claim_home` does not yet constrain Round-5 Perlin or the home-space band;
- both candidates embed world radius 12000 instead of deriving a complete
  manifest-dynamic geometry relation;
- generated entropy, ptau, zkeys, witnesses, and proof JSON are ignored local
  test material and must never be published as production setup artifacts;
- Circom inspection emits CA02 unused-output warnings from range/hash helper
  components; they remain explicit circuit-audit review items;
- Arkworks proof serialization and an audited Sui Move Groth16 verifying-key
  wrapper are not implemented;
- reveal/capture production circuits, canonical Soulidity ABI, signed ranked
  builders, two-wallet checkpoint-derived testnet projection, independent
  audits, production ceremony, operations, and legal/name clearance remain open.

Mainnet publish/write, Vercel deployment, and promoted launch were not performed.
Production-mode proof selection and ranked signing remain fail-closed.

## Repository state

The user explicitly authorized storing the implementation in the corresponding
GitHub repository. This handoff and the full validated branch are recorded on
`origin/codex/dark-forest-parity`; Git history is the authoritative commit
record. Ignored development proving material, `.env.local`, Vercel state, build
outputs, and credentials are excluded.

## Recovery

The release-record base is commit
`75fe712e4d2349b2e6b57dfa3751dade7921a48d`. The earlier sealed Sui testnet
canary remains the deployment recovery point and was not mutated.

## Exact next action

Complete the Round-5 Perlin/home-band and manifest-dynamic geometry relations,
implement the Arkworks-to-Sui proof-byte bridge plus audited Move verifier
wrapper, and run signed two-wallet testnet transactions with checkpoint-derived
shared projection. Only after those results, the Soul ABI, independent audits,
operations, legal clearance, and a production ceremony are complete should a
mainnet release be reconsidered.
