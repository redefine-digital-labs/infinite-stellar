# Infinite Stellar Phase Handoff: Production Player Gateway

## Snapshot

- Created: 2026-09-01T09:33:02+03:00
- Phase: Production proof submission and player transaction gateway
- Status: complete
- Goal: Bind browser proof output to exact Sui player intents and implement checked transaction simulation, indexed-finality reconciliation, and deterministic chain-backed Seat recovery without enabling unaudited mainnet writes.
- Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`
- Branch: `codex/dark-forest-parity`
- Base commit: `3944431e72176af382e512d6015ef05d1bb18632`
- Working tree at handoff creation: dirty with this phase's reviewed changes
- Handoff: `docs/codex/handoffs/2026-09-01-production-player-gateway.md`

## Outcome

The browser proof boundary now produces the exact Arkworks/Sui proof-point
bytes and serialized public inputs consumed by the Move verifier. It refuses a
submission unless the loaded artifact manifest, verification key, generated
signals, and caller-recomputed action statement agree.

The game SDK now builds sender-bound canonical Soul enrollment plus exact
`claim_home`, `dispatch_move`, and `dispatch_move_new` PTBs. The proof-backed
builders independently recompute and compare the network, ruleset, Manifest,
Seat, sender, source/destination hashes, source nonce, deadline, route bound,
and rules-geometry commitment before exposing a transaction.

The player runtime simulates with transaction checks enabled, treats a resolved
`FailedTransaction` as failure, waits for indexed finality, and reconciles the
exact BCS event plus required changed objects. It also derives the unique
controller Seat from the exact Move typed-key layout and BCS-validates the
Seat, Commander Projection, Civilization, and Score identity graph.

No mainnet transaction was signed or submitted. Production verifier readiness
remains false, so current production writes still fail closed.

## Scope and non-goals

### In scope

- Exact Worker-to-Sui proof-byte and public-input preparation.
- Enrollment, home, move, and move-new player transaction construction.
- Sui simulation, resolved-failure checks, indexed finality, and exact BCS
  event/effect reconciliation.
- Deterministic `ControllerSeatKey` derivation and Seat-bound BCS read model.
- Adversarial tests, readiness documentation, and authorized Git delivery.

### Intentionally not done

- No production ceremony, audit, or key approval was fabricated.
- No wallet UI, indexer, sponsor, or monitoring service was claimed complete.
- No Sui mainnet transaction was signed or submitted.
- No development key or deterministic fixture was relabeled as production.

## Durable decisions

- A proof submission is signable only when its artifact manifest, prepared
  verifying-key digest, public signals, serialized public inputs, and 128-byte
  proof match the SDK's independently recomputed action intent.
- A resolved wallet or RPC promise is not success. The client checks the
  discriminated status, waits for indexed finality, and reconciles exact BCS
  events and changed objects.
- Existing player state resolves from the deterministic controller Seat before
  current-Soul discovery. Every Seat child is BCS cross-checked against the
  same season and Seat.
- `SeatRoutingPin.keyTypeOriginPackageId` is separate from the callable package
  ID so derived-object routing remains correct if a reviewed package is ever
  upgraded before final immutability.

## Changed paths

- `packages/prover/src/proof-runtime.ts`
- `packages/prover/src/worker-protocol.ts`
- `apps/web/src/prover.worker.ts`
- `apps/web/src/prover-client.ts`
- `packages/game-sdk/src/sui-gateway.ts`
- `packages/game-sdk/src/sui-player-runtime.ts`
- `packages/game-sdk/test/sui-gateway.test.ts`
- `packages/game-sdk/test/sui-player-runtime.test.ts`
- Related workspace metadata, tests, README, architecture, vertical-slice,
  proof-interface, readiness, and Codex memory files.

No image or binary asset is tracked by this phase. Rebuilt development circuit
artifacts remain Git-ignored and explicitly non-production.

## Verification

- `npm run validate:web` — 18 web, 49 game-sdk, and 38 prover tests (105
  total), typecheck, ESLint, and production build — PASS
- `sui move test -e testnet --threads 1 --warnings-are-errors` — 72/72 — PASS
- Mainnet Move lint/build and bytecode meter — 15 modules, 337,201 ticks — PASS
- `npm run verify:move-mainnet-dry-run` — 15 modules and 544,308,000 MIST
  simulated net gas — PASS
- `npm run verify:soulidity-mainnet` — canonical mainnet v1 package, type, and
  accessors — PASS
- Pinned Circom 2.2.3 development build and `npm run circuits:test:dev` — PASS
- Documentation lint, sealed deployment verification, production dependency
  audit, and `git diff --check` — PASS

## Risks and recovery

### Risks or blockers

- Production Groth16 Phase 2 ceremony, independent circuit/Move/client audit,
  and code-pinned production config activation remain blocking.
- The rendered React game still uses local deterministic authority. The
  wallet-connected chain route, Planet/Voyage projections, indexer, sponsor,
  monitoring, and two-wallet soak remain incomplete.
- Reveal, capture, and external Spacetime Rip artifact custody remain
  fail-closed.
- Production signer/capability custody and release/name/asset rights remain
  unclosed.

### Recovery or rollback

Use base commit `3944431e72176af382e512d6015ef05d1bb18632` as the pre-phase
recovery point. Production readiness constants stayed false and no onchain
write occurred, so reverting this phase requires no chain rollback.

## Exact next action

Wire the tested gateway and Seat read model into a wallet-connected ranked
React route, add checkpoint-derived Manifest/Runtime/Planet/Voyage projections
and crash/retry UX, then run a real two-wallet release-candidate rehearsal while
the independent production ceremony and audit proceed.
