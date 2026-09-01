# Soul Adapter Contract

## Status and purpose

This document defines the canonical Soulidity boundary used by Infinite
Stellar. The v1 source and Sui mainnet ABI are now pinned in the P0 Move
implementation under `move/infinite_stellar`. The adapter is implemented but
not deployed, and its readiness does not imply that proof-backed ranked play is
ready.

The implementation rule is:

> The game core may trust only a package-internal verified Soul binding created
> from the compile-time-pinned canonical `&SoulState`. It may not trust copied
> owner, epoch, Soul ID, listing, or package facts supplied by a client.

Sui Move does not provide a runtime interface or trait mechanism for swapping
arbitrary package types. Infinite Stellar therefore uses a compile-time adapter
module. A season release pins one adapter and one accepted Soulidity package.
Changing that external ABI requires adapter code, compatibility tests, and a new
pinned engine release; it does not require rewriting Season, Seat,
Civilization, or Planet rules.

## What is stable now

The game core consumes this normalized binding at ranked enrollment:

```text
interface_version
soulidity_package_id
soul_state_id
soul_id
current_owner
ownership_epoch
listed
projection_commitment
```

The binding has `drop` but not `store`. Its fields are private, and its
constructor is `public(package)`. An external caller cannot manufacture or save
one. `soul_adapter::enroll` receives the canonical shared `&SoulState`, reads
all identity facts from Soulidity, creates the normalized binding, and consumes
the enrollment claims in one transaction. Test fixture construction remains
compiled only in tests.

The exact v1 record is [`config/soulidity-mainnet-v1.json`](../config/soulidity-mainnet-v1.json):

- source `redefine-digital-labs/soulidity@a3a4a835e0298c3a4a0aba80943a05443770a9ef`;
- callable package `0x60bf39455f90e2af94381f2434d2c013c4e38a12fd16873ac296a26660f92ecd`;
- original/type-origin package `0xa43cc9a94caa904a97316d97c08804369ee8fbe3335d2ddae154022d7d6e5d5d`;
- type `soulidity::soul::SoulState`, protocol/state version `1`.

`npm run verify:soulidity-mainnet` verifies both package objects and every
required function signature over Sui gRPC.

## Enrollment contract

The canonical adapter performs the following before constructing a binding:

1. Receive the canonical `SoulState`; its `soul_id` field is the canonical
   Soul-to-State link.
2. Read the SoulState ID, Soul ID, current owner, ownership epoch, and listing
   state through the pinned Soulidity accessors.
3. Require protocol and state version `1`.
4. Bind the exact type-origin package, adapter version, object IDs, epoch, and
   projection commitment.
5. Call the package-internal enrollment core in the same transaction, which
   derives the controller from `ctx.sender()`, checks owner equality, and
   rejects listing or policy mismatch before consuming uniqueness or capacity.

The core then atomically checks time and capacity, claims the deterministic
controller-to-Seat address, consumes the Soul-season uniqueness claim, creates
the Commander Projection, `AwaitingHome` Civilization, and ScoreCard, and
increments capacity. Any abort rolls back the entire transaction under Move
semantics.

## Authorization after enrollment

Enrollment and play intentionally use different predicates.

- **Enrollment and Soul-attributed writes** require a live adapter validation of
  the current Soul owner and ownership epoch.
- **Pure Seat actions** require the immutable Seat controller and game state;
  they do not require the player to keep owning the Soul.

Consequently, a later Soul transfer makes the Commander Projection stale for
new Soul attribution, but it does not transfer or freeze the Season Seat,
Founding Planet, score, vault, or strategic authority. The buyer cannot use the
seller's Seat. The P0 tests exercise both the detached pure-Seat path and buyer
rejection.

## P0 Move foundation

The package currently implements:

- A manifest-pinned, bounded season and separate shared runtime.
- A shared enrollment registry used only at enrollment.
- Deterministic derived Seat addresses keyed by season, league, and controller.
- One ranked Seat per controller and one binding per Soul per season.
- Atomic bounded capacity and `AwaitingHome` object creation.
- Permissionless one-way universe opening using Sui native randomness.
- A nonzero Clock-time seed-observation gate.
- Permissionless, capped availability ticks that undercredit missing evidence.
- A single global home-window result: `ClosedAvailable` or
  `CancelledUnavailable`.
- A package-internal proof-witness seam and atomic, Seat-owned Founding Planet
  activation.
- Post-close action and settlement guards that require global resolution first.

The canonical Soul adapter is open in source and transaction-buildable. The
production proof verifiers, reveal/capture proof paths, and other release gates
remain deliberately closed. Test Soul fixtures cannot be compiled into a
publishable production entry point.

## Compatibility gate

The identity half of the adapter is production-shaped. A release still must
freeze and test:

- the exact reviewed Soulidity source/package record and compatibility policy;
- supported purchase/transfer/listing transitions and ownership-epoch
  rotation against live fixtures;
- Commander Projection display-license validation or an explicit neutral-only
  fallback policy;
- package upgrade review and historical-read policy;
- the exact mainnet Infinite Stellar package and Season Manifest that consume
  this adapter.

Required integration tests must cover the canonical happy path, mismatched
Soul/State, spoofed owner, stale epoch, listed Soul, purchase in progress,
post-transfer seller, post-transfer buyer, wrong package, wrong interface
version, fallback visual, and atomic rollback after every rejection.

## Build and current evidence

From `move/infinite_stellar`:

```sh
sui move build --warnings-are-errors
sui move test
```

The P0 suite covers deterministic and duplicate enrollment, owner and adapter
spoofing, final-slot capacity contention, one-way opening, exact timing
boundaries, proof intent and Planet uniqueness, transfer detachment, capped
availability, pauses, global cancellation, and active-first settlement guards.
Mainnet compilation enforces the concrete external `SoulState` type, and a
live ABI verifier catches package or signature drift.

## Explicit non-goals

This seam does not provide a production ZK setup, chain-backed client, indexer,
sponsor, deployment configuration, independent audit, or player-facing
mainnet release. Those remain separate gates in
[Mainnet Readiness](17-mainnet-readiness.md).
