# Infinite Stellar Phase Handoff

## Phase

Player-facing full-stack vertical slice

## Status

Complete

## Goal

Turn the P0 Move foundation into a runnable English player experience with a typed SDK while keeping unfinished Soulidity and proof interfaces fail closed.

## Outcome

The repository is now a working npm monorepo with a responsive React player client and `@infinite-stellar/game-sdk`. A player can connect a Sui testnet wallet, inspect the unavailable production gate, or complete a clearly labeled local First Light journey from Soul selection through fixed Seat enrollment, sealed lobby, universe opening, private Founding Planet search, checkpoint-shaped finality, and Active civilization projection.

The slice persists and resumes controller-scoped local state. It includes explicit failure/retry UX and never reports demo activity as a Sui transaction or Soul history. Real enrollment and home claiming remain unavailable until exact adapters, circuits, and deployment objects exist.

## In scope

- Locked npm workspace and shared TypeScript/ESLint/Markdown tooling.
- Typed journey state, local persistence, route resolver, deterministic fixtures, and Sui transaction gateway.
- Wallet-aware English React client using current Mysten dApp Kit and Sui SDK packages.
- Landing, Soul selection, enrollment, finality, sealed lobby, local search, claim, error/retry, unavailable, and Active screens.
- Responsive visual system, keyboard focus, skip navigation, semantic regions, live status, and reduced-motion behavior.
- Runnable and truthful implementation documentation.

## Non-goals

- Final Soulidity ABI, live Soul reads, or production ranked enrollment.
- Production ZK prover, circuit, verifier, or encrypted vault.
- Movement, combat, recovery, scoring, Last Light, or settlement client.
- Indexer, sponsorship service, deployment, onchain write, commit, or push.

## Durable decisions

- Live testnet mode fails closed and lists the missing integration gates; only the visibly labeled local simulation can traverse enrollment and claim.
- The client resumes a controller-scoped existing Seat before allowing another Soul selection.
- Simulated approvals have an observable finality boundary and a recoverable rejection path.
- Candidate coordinates and salt stay local, but the prototype browser store is not encrypted and is explicitly documented as demo-only.
- The SDK exposes real transaction builders only for public keeper actions whose deployment IDs are fully pinned. Enrollment and claim builders throw typed integration errors.
- Static Sui/wallet and React dependencies are emitted as separate production chunks rather than one oversized application bundle.

## Changed paths

- Root npm, TypeScript, ESLint, Markdown, ignore, and lockfile configuration.
- `apps/web/`
- `packages/game-sdk/`
- `docs/13-player-vertical-slice.md`
- Root product/status/contribution documentation.
- Codex phase memory and this handoff.

The earlier uncommitted Move foundation and specification corrections remain part of the same worktree and are preserved.

## Verification

- `npm ci`: PASS, 0 vulnerabilities.
- `npm run validate:web`: PASS.
- Web component/flow tests: 4/4 PASS.
- SDK unit tests: 12/12 PASS.
- TypeScript typecheck and ESLint: PASS.
- Production web build: PASS; application 27.74 kB, React 181.74 kB, Sui/wallet 467.48 kB before gzip.
- `npm run lint:docs`: 25 files, 0 issues.
- `sui move build --warnings-are-errors`: PASS.
- `sui move test --threads 1 --warnings-are-errors`: 24/24 PASS.
- `sui move lint`: PASS.
- `git diff --check`: PASS.
- English-script public-content audit: PASS.
- In-app browser desktop flow: Soul to Active PASS.
- Simulated finality and post-reload resume: PASS.
- Live testnet fail-closed route and console-error check: PASS.
- 390 × 844 responsive check: PASS after correcting a Soul-grid horizontal-overflow defect; the document width now equals the viewport while the card rail scrolls internally.

## Risks and open gates

- Soulidity package/type, kiosk/listing, epoch, and grants semantics are not frozen.
- No testnet package, manifest, runtime, or registry IDs are configured.
- Proof search is a deterministic local fixture, not cryptographic proof generation.
- Demo private material is browser-local but not encrypted.
- The Sui/wallet dependency chunk remains substantial; lazy-loading wallet infrastructure can be evaluated when route-level production reads exist.
- The product name remains legally unconfirmed as documented in the repository.

## Recovery point

Implementation baseline: `34cfbcde3a802d7317dfa5e1b7983fa20db9e7e7`. All Move-foundation and full-stack phase changes remain uncommitted in the Infinite Stellar worktree.

## Exact next action

Start a new integration phase. Pin a versioned local Soulidity compatibility fixture and proof-verifier fixture, add canonical object-read projections, publish a non-production Sui testnet deployment manifest, and replace the two typed fail-closed builders only after cross-package ownership/epoch/listing and proof-intent tests pass.
