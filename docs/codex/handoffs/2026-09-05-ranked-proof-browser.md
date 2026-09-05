# Ranked Proof Preparation and Real Browser Verification

Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`.
Branch: `codex/dark-forest-parity`. Source: `f66c1f35c72ba5d26b95d1e980fc0746185234fc`.
The full objective remains active. No transaction was signed or submitted.

## Implemented

- SDK `ranked-proof.ts`: request/deadline snapshot, real prover boundary and a
  second authoritative-context read before unsigned transaction construction.
  Changed source nonce, owner, destination existence, expiry, deployment or
  readiness gates reject. Output excludes coordinates and witness.
- Web `ranked-action-prover.ts`: exact production manifest selection for each
  action, one isolated Worker and guaranteed cleanup on success/failure/abort.
  This service is not yet connected to ranked map action buttons.
- Worker/client: immediate termination on cancellation/replacement; late results
  cannot win. Cache keys include the entire selection, including setup mode,
  identity, origin and budget. Proofs retain their original artifact snapshot.
- Vercel CSP: narrowly permit WASM compilation and blob child Workers required
  by the existing prover. Ordinary JS eval/inline scripts remain forbidden;
  connection origins, frame/form/object restrictions are unchanged.
- Reusable local-only browser QA at `apps/web/proof-development.html` plus an
  opt-in integration suite. The public test fixture no longer depends on Node
  Buffer, so the same SDK inputs run in the browser. The development-only Vite
  middleware fixes missing zkey media types without changing FS access.

## Verification

Node 24.20.0 `npm run validate:web`: 330 passing tests (149 web, 143 SDK,
38 prover), typecheck, lint and build. `npm run circuits:test:ranked`: 3 actual
WASM/zkey integration tests, valid Groth16 proofs, exact four/five public
signals and 128-byte Sui proof-point serialization, unsigned transaction
construction, coordinate/statement tampering rejection, and production-mode
development-manifest rejection. Artifacts are required, never silently skipped.

Real browser first reproduced two QA-only issues: Vite served zkeys without a
media type, and the shared public fixture used Node Buffer for materialized
planets. Both were fixed. A fresh local origin then passed all three proofs.
The exact former production CSP separately reproduced a WebAssembly compile
failure. With the revised CSP enforced on the page AND Worker responses, the
three real proofs and unsigned transactions passed at 717/756/743 ms including
local artifact preflight. These are single-device timings, not a browser p95 or
cross-engine/performance approval. A real preflight cancellation stopped without
submitting. Production output contains no harness, fixture or development key.

Reproduce using the commands and local artifact-directory field documented in
`docs/16-proof-interface-and-artifact-preflight.md`. The opt-in environment
variable `INFINITE_STELLAR_PROOF_CSP_QA=1` copies the actual Vercel policy into
local responses. The test manifest pins remain explicitly development-only.

## Next and boundaries

Wire a fresh context reader using `readPlayerSeatBundle`, exact private-location
point reads and current Clock observation; then connect ranked map home/fleet
operations to proof, explicit signing, public-only pending journal, indexed
finality/recovery and map refresh. The helper must be cancelled on wallet,
Season and navigation changes. Fresh-read callback semantics are a caller
requirement; unit fixtures are not evidence of real chain reads.

Required production setup ceremony, independent audits, approved custody/signers,
release evidence, two-wallet chain settlement, indexing/backup/recovery and
operations remain unfinished. Never set readiness true to unlock testing.
Natural local playtest behavior and per-deployment reset policy are unchanged.

Rollback: prior player deployment `dpl_5EfcU2Ho6sokh682gbSUzcKFct2i` and source
`3a6826da127b846eb21ac8f9cb52261dfcc7c42c`. Reverting CSP again prevents browser
proof computation; it does not disable any currently live ranked action because
ranked actions are not enabled. Newly built rollbacks reset only local playtests
as the owner requested. No chain rollback is needed.

Current release/evidence status is recorded in `docs/codex/CURRENT.md` and
`ops/deployments/vercel-production-2026-09-05-ranked-proof-browser.json`.
