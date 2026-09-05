# Ranked Map Home and Fleet Lifecycle

Worktree: `/Users/naoer/Documents/Claude/Projects/infinite-stellar`.
Branch: `codex/dark-forest-parity`. Full objective remains active.

## Implemented

- SDK canonical shared Clock BCS and selected-location context reader; exact
  RPC chain, controller/Seat/map scope, bracketed Seat versions and fixed
  chain-derived deadline. No coordinate upload or global event-history scan.
- Map home and fleet controls preserve the original camera, renderer and
  panels. Choose a controlled source, aim at a known destination and select
  fixed energy/silver. The SDK selects move versus atomic move-new.
- Fresh context before/after proof, before signature and after signature;
  checked simulation; exact signed-byte equality. Gate/deployment/wallet/Season,
  nonce, ownership, destination existence and deadline changes reject.
- Public-only exact digest journal written and verified before transmission.
  No signature, signed bytes, coordinates or witness persist. Web Locks cover
  the lifecycle across tabs. Corrupt journals block new sends.
- Indexed event/effect finality before map refresh. Response loss and reconnect
  recover by exact digest without re-signing/resending. Unrelated failed RPC
  digests cannot clear pending transactions. Verified settlement refreshes the
  map even if local journal cleanup fails; cleanup can then be retried.
- Explicit production manifest URL locators documented in web README and
  proof-interface spec. No readiness flag or release pin was loosened.

## Verified evidence and limits

`npm run validate:web`: 384 tests (183 web, 163 SDK, 38 prover), types, lint and
production build. `npm run circuits:test:ranked`: 3 actual development
Groth16 proofs to unsigned action builders. `npm run test:chain-read`: 1 real
read-only mainnet chain/genesis and canonical Clock BCS check. Node 24.20.0.
Documentation lint and diff whitespace checks pass.

Hook tests use synthetic transport/effect/event/signature fixtures, with the
actual SDK simulation/finality reconciler. They cover all three action kinds,
state races, exact-byte rejection, storage failure, pending response loss,
remount recovery, cancellation and no optimistic refresh. These are not real
wallet or game-chain settlement evidence.

Local-only `/ranked-actions-development.html` uses public fixture coordinates
and callback readouts, no RPC/proof/wallet/executor. Browser verified source
IS-5BF92 to target IS-4A806, 65% = 32,500 fixed energy, claim-home callback,
desktop controls and 390×844 scrolling without horizontal page overflow.
Visual review found inline sliders and corrected their grid/full-width layout.
No browser errors. The harnesses and development keys are excluded from the
production entry/build.

## Continue

Use `CURRENT.md` and the exact deployment evidence for current release state.
Next integrate chain-authoritative Voyage arrival/settlement and confirmed
special actions; finish original facility visuals. Ceremony, independent
audits, approved real multisig/signers, game mainnet deployment, two-wallet
rehearsal and operational readiness remain mandatory and incomplete.

No game transaction was signed or submitted. Production gates remain false.
Do not use synthetic deployment fixtures or development keys to open them.
Rollback target: `dpl_HXtcLUYrTgGwMDCfgVJtWdpu2zgU`, source
`f66c1f35c72ba5d26b95d1e980fc0746185234fc`. A new rollback build resets only the
local playtest namespace; no chain rollback or ranked-vault deletion.
