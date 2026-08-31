# Infinite Stellar Phase Handoff

## Phase

Mainnet proof interface, artifact preflight, and map interaction closure

## Status

Complete as a proof-boundary and player-UX foundation phase. No proving circuit,
production setup, production verifier activation, mainnet deployment, commit, or
push occurred.

## Goal

Freeze one Sui-compatible proof-intent/public-input contract across TypeScript
and Move, add a content-addressed Prover Worker preflight that remains
fail-closed, and close the reported map pan and voyage-route alignment defects.

## Outcome

- Proof interface v1 uses four BN254 public signals in the exact order
  `source_location_hash`, `destination_location_hash`, `action_commitment`, and
  `rules_geometry_commitment`.
- `action_commitment` is Sui Poseidon over an exact sixteen-field tuple binding
  domain/version, action, mainnet/league, season, Seat, sender, source,
  destination, amount, source nonce, deadline, and rules geometry.
- Sui IDs use big-endian `u256` split low/high 128-bit limbs. Public signals use
  Sui Groth16's concatenated 32-byte little-endian scalar representation.
- The machine-readable mainnet golden vector is checked against the TypeScript
  package, the source rules-manifest SHA-256, and the Move native Poseidon
  implementation.
- Artifact manifest v1 pins network, ruleset, circuit/version, public signal
  order, source/build provenance, trusted setup, and exactly three artifacts.
- Production preflight requires a Phase 2 ceremony/transcript, HTTPS, exact
  manifest and artifact hashes, media types, sizes, role uniqueness, same-origin
  policy unless explicitly allowed, and a bounded aggregate memory budget.
- A persistent Worker owns loaded artifacts, reports progress, aborts replaced
  requests, and ignores stale messages. It never receives wallet authority.
- The web client targets Sui mainnet but presents `PROVER GATED` when no audited
  production manifest is configured. Ranked writes remain unavailable.
- The map pans on empty-space pointer/touch drag and arrow keys while preserving
  wheel/button zoom, `Home`, and `Fit` recovery.
- Voyage routes are aspect-ratio-safe SVG lines whose endpoints use the same
  screen-space transform as both Planet centers. A bounded arrow and animated
  dash communicate direction without changing hit testing.

## Main changed paths

- `packages/prover/src/proof-intent.ts`
- `packages/prover/src/artifact-manifest.ts`
- `packages/prover/src/worker-protocol.ts`
- `packages/prover/test/proof-intent.test.ts`
- `packages/prover/test/artifact-manifest.test.ts`
- `config/proof-interface-v1.json`
- `move/infinite_stellar/sources/proof_intent.move`
- `move/infinite_stellar/tests/proof_intent_tests.move`
- `apps/web/src/prover.worker.ts`
- `apps/web/src/prover-client.ts`
- `apps/web/src/prover-client.test.ts`
- `apps/web/src/use-proof-readiness.ts`
- `apps/web/src/StrategyConsole.tsx`
- `apps/web/src/StrategyConsole.test.tsx`
- `apps/web/src/dapp-kit.ts`
- `apps/web/src/GameShell.tsx`
- `apps/web/src/styles.css`
- `docs/16-proof-interface-and-artifact-preflight.md`
- `docs/04-technical-architecture.md`
- `docs/15-round5-sui-architecture.md`
- `README.md`

## Verification

- Node 24 `npm ci`: passes; 351 packages audited with zero vulnerabilities.
- All workspace typechecks and ESLint: pass with zero warnings.
- Web: 17/17 tests pass.
- Game SDK: 35/35 tests pass.
- Prover: 21/21 tests pass.
- Production build passes and emits dedicated `miner.worker` and
  `prover.worker` assets.
- Markdown lint passes across 37 files.
- Move strict build and lint pass; Move tests are 54/54.
- Existing sealed Sui testnet deployment evidence still verifies live.
- `git diff --check` passes.
- Live browser QA at 1440×900 verifies route endpoints before/after map drag and
  at 125% zoom. All four endpoint errors remain below 0.01 CSS pixels. The
  arrow-marker scale was visually checked and corrected.

## Production and mainnet boundary

The interface is frozen; the proof system is not production-ready. The
following are still absent or blocked:

- final Soulidity Soul package/ownership epoch ABI;
- Circom claim/move/reveal/capture relations and adversarial witness tests;
- reproducible circuit build image and independent circuit audit;
- Phase 2 ceremony, public transcript, final proving/verifying keys, and key
  ceremony verification;
- audited Move Groth16 wrappers with pinned prepared verifying keys;
- signed real-wallet gameplay transaction builders, sponsor policy, production
  indexer, and multi-wallet load/contention evidence;
- wallet-owned Sui artifact wrapper and audited Rip custody adapter;
- independent Move/client review, operational readiness, and legal/name
  clearance required by the existing project decision log.

Publishing the current package to mainnet would create an irreversible,
unaudited package without a production proof relation and would not make the
game multiplayer-ready. It was therefore not performed.

## Repository and release state

- The broader Dark Forest parity worktree remains intentionally uncommitted.
- No commit, push, Vercel deployment, Sui publish, capability transfer, or
  onchain write occurred in this phase.
- The existing public canary remains the earlier sealed testnet release and does
  not contain this phase.

## Exact next action

Start a separate circuit-and-real-multiplayer phase. Implement the v1
`claim_home` and `move` Circom relations against the frozen vectors, generate
development-only artifacts with conspicuous non-production provenance, connect
audited-candidate Move verifier wrappers, and run a two-wallet signed Sui
rehearsal plus checkpoint-derived shared-state projection. Mainnet construction
and signing must remain fail-closed until the production setup, audits, Soul ABI,
operations, and legal gates pass.
