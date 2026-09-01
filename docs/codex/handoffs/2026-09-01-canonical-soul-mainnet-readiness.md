# Canonical Soul and Mainnet Readiness Handoff

## Outcome

Infinite Stellar now compiles directly against the existing canonical
Soulidity `SoulState` and can construct ranked enrollment from that shared
object without taking custody. The complete 15-module package passes Sui
mainnet protocol verification and a publish dry-run. It was deliberately not
published: production proof configurations do not exist and the current ranked
home/movement paths remain fail-closed, so publishing would not create a game
that players can actually use.

## Canonical Soul evidence

- Source: `redefine-digital-labs/soulidity` commit
  `a3a4a835e0298c3a4a0aba80943a05443770a9ef`, subdirectory
  `move/soulidity`.
- Mainnet callable package:
  `0x60bf39455f90e2af94381f2434d2c013c4e38a12fd16873ac296a26660f92ecd`.
- Original/type-origin package:
  `0xa43cc9a94caa904a97316d97c08804369ee8fbe3335d2ddae154022d7d6e5d5d`.
- Type: original package `::soul::SoulState`; protocol/state version `1`.
- Live-verified public accessors: `protocol_version`, `state_version`,
  `state_id`, `soul_id`, `current_owner`, `ownership_epoch`, and `is_listed`.
- Machine-readable evidence:
  `config/soulidity-mainnet-v1.json`; verification command:
  `npm run verify:soulidity-mainnet`.

## Implemented changes

- Added an exact Soulidity Git dependency and canonical dual-network Move lock.
- Replaced the fixture-only production adapter with a typed
  `soul_adapter::enroll` function. It reads owner, epoch, IDs, and listing state
  from `&SoulState` in the same transaction, creates only internal verified
  binding data, and shares the new Seat/Projection/Civilization/Score objects.
- Added the corresponding SDK enrollment transaction builder and tests.
- Added bounded-retry live mainnet ABI/package verification and a non-signing
  full-package mainnet publish dry-run gate.
- Grouped `SeasonManifest` circuit pins and `Planet` secondary state so both
  structs remain below the mainnet `max_fields_in_struct = 32` protocol limit.
  Existing public gameplay accessors and behavior remain stable.
- Updated English product, security, adapter, proof, deployment, and mainnet
  readiness documentation.

## Validation evidence

- `sui move lint -e mainnet --warnings-are-errors`: pass.
- `sui move test -e testnet --threads 1 --warnings-are-errors`: 72/72 pass.
- `sui move build -e mainnet --warnings-are-errors`: pass.
- `sui client verify-bytecode-meter ... -e mainnet`: pass.
- `npm run verify:move-mainnet-dry-run`: 15 modules, success, observed net gas
  `544,308,000` MIST. Its package ID and digest are simulation-only.
- `npm run validate:web`: 18 web + 40 SDK + 37 prover tests, typecheck, lint,
  and production build pass.
- Circom `v2.2.3` reproducible development build and adversarial proof suite:
  pass for `claim_home`, `move`, and `move_new`. These artifacts remain
  development-only.
- `npm run verify:soulidity-mainnet`, `npm run verify:deployment`,
  `npm run lint:docs`, `npm audit --omit=dev`, and `git diff --check`: pass.

## No mainnet write

No package, Manifest, circuit config, registry, Season, or capability was
created on Sui mainnet. No gas was spent. Mainnet engineering and GitHub updates
were authorized, but the production gates below did not pass.

## Remaining release blockers

1. Complete a reproducible production circuit release, public Phase 2
   ceremony, code-pinned production verifying keys/config constructors, and
   independent circuit review. The current production readiness constants are
   intentionally false.
2. Complete and audit reveal, capture, and wallet-owned Spacetime Rip artifact
   adapters.
3. Implement signed production home/move/move-new PTBs, proof preflight,
   finality/retry/crash reconciliation, and wallet test coverage.
4. Replace the deterministic local web authority with checkpoint-derived
   Season/Seat/Planet/Voyage state while retaining private coordinates and
   browser proofs.
5. Operate a rebuildable indexer, rate-limited sponsor, archive/full-node
   strategy, monitoring, incident response, and multi-wallet contention soak.
6. Freeze and review the production Manifest, signer/capability custody,
   immutable publish/bootstrap ceremony, security audit, performance budget,
   and public name/asset rights.

## Next bounded phase

Freeze the production proof release inputs and implement the complete signed
player transaction gateway in parallel with a checkpoint-backed client read
model. Do not publish until the production verification paths are enabled by
audited, reproducible artifacts and the resulting package supports an end-to-end
multi-wallet season.
