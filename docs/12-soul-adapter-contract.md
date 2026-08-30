# Soul Adapter Contract

## Status and purpose

This document defines the boundary that lets Infinite Stellar engineering begin
before Soulidity freezes its final Soul representation. It describes the P0 Move
implementation under `move/infinite_stellar`; it is not a claim that the
production Soulidity integration is live.

The implementation rule is:

> The game core may trust a package-internal verified Soul binding. It may not
> import, inspect, or guess a concrete unfinished Soul type.

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
one. The current `soul_adapter` exposes only its required interface version and
`production_adapter_ready() == false`; fixture construction is compiled only in
tests.

The current Soulidity worktree has conceptually matching reads for Soul ID,
SoulState ID, current owner, ownership epoch, and listing state. Those reads are
evidence that the seam is viable, not a frozen dependency declaration.

## Enrollment contract

The future production adapter must receive the canonical Soul and SoulState
objects accepted by the manifest-pinned Soulidity package and perform all of
the following before constructing a binding:

1. Prove the Soul object and SoulState refer to each other.
2. Prove the transaction sender is the canonical current owner.
3. Read the current ownership epoch from canonical state.
4. Reject a Soul in a listing or incompatible custody transition.
5. Validate the accepted visual/provenance and display-license policy, or bind
   the neutral fallback.
6. Bind the exact package, interface version, object IDs, epoch, and projection
   commitment.
7. Call the package-internal enrollment core in the same transaction.

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

The production Soul adapter and proof verifier remain deliberately closed. The
test fixtures cannot be compiled into a publishable production entry point.

## Compatibility gate

The adapter may be marked production-ready only after all of these are fixed:

- Soulidity package and type identities.
- Canonical Soul-to-SoulState linkage.
- Current-owner semantics under kiosk, listing, purchase, and transfer.
- Ownership-epoch rotation semantics.
- Listing/custody states that must block enrollment.
- Animacraft output and display-license validation inputs.
- Package upgrade and historical-read policy.

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

The P0 suite currently covers deterministic and duplicate enrollment, owner and
adapter spoofing, final-slot capacity contention, one-way opening, exact timing
boundaries, proof intent and Planet uniqueness, transfer detachment, capped
availability, pauses, global cancellation, and active-first settlement guards.

## Explicit non-goals

This seam does not define the final Soul data model. It does not provide a
production ZK verifier, movement, combat, recovery, Last Light, receipts,
Chronicle writes, client vault, indexer, deployment configuration, audit, or
mainnet readiness. Those remain separate release gates.
