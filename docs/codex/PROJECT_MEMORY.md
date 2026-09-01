# Infinite Stellar Durable Project Memory

This file contains stable facts that should survive individual implementation phases. Current work belongs in `CURRENT.md`; completed detail belongs in the linked handoff, code, tests, specifications, and Git history.

## Product invariants

- Infinite Stellar is a Sui-native, zero-knowledge, fully onchain seasonal strategy game in pre-production. It has an experimental P0 Move foundation, a sealed Sui testnet interface canary, and a runnable local player vertical slice, but no playable ranked onchain release.
- An address authorizes; a Soul is the persistent actor; Animacraft supplies accepted visual material; a Commander Projection freezes the seasonal Soul/visual/role/Seat binding; a fixed Season Seat controls a temporary Civilization and owns Planets through `owner_seat_id`.
- One controller address may create at most one ranked Seat per league and season. Manifest-pinned registry parents and typed-key/shard vectors deterministically derive the Season Seat itself as the logical `ControllerLeagueSeasonSlot` and direct lookup. This is address-level fairness, not human-level Sybil resistance.
- A bounded enrollment-only capacity object atomically enforces manifest `max_ranked_seats`; it is not an ordinary-play global write.
- Atomic enrollment creates the Seat/binding/state set but no Planet. `CivilizationState` begins `AwaitingHome`; one later finalized `claim_home` creates the Seat-owned Founding Planet and changes it to `Active`. Pre-home Seats cannot move, score, colonize, or recover.
- The five-minute activation metric begins at chain-derived `HomeSearchAvailableAt`; `HomeClaimAvailableAt` separately records when submission is legal. A nonzero Clock-time observation delay rejects immediate claims but does not claim checkpoint separation. Public-seed local work remains possible during a claim pause, so pauses are never subtracted to make latency look better.
- Permissionless capped availability ticks credit the minimum home-claim window. At close, global `home_window_resolution` becomes `ClosedAvailable` or `CancelledUnavailable` before any Seat may act or finalize further; a delayed opening, pause, or unevidenced chain/ticker gap that leaves insufficient credit reaches global `HomeWindowUnavailable` cancellation/refund rather than player-caused missed activation.
- The official client resolves an existing fixed-controller Seat before current Soul ownership. Its encrypted map vault is Seat/controller-scoped and never follows Soul transfer.
- Civilizations, planets, energy, fleets, map advantage, score, and ranked power reset. Soul-linked history and expression may persist without creating ranked advantage.
- Soulidity is the canonical identity/ownership layer. Infinite Stellar validates the live Soul owner and ownership epoch but does not take Soul custody.
- The unfinished Soulidity ABI is isolated in a compile-time `soul_adapter`. Core game modules accept only a package-internal, non-storable verified binding; production enrollment stays fail-closed until the exact Soul package and semantics pass compatibility tests.
- The typed game SDK and English React client implement the activation journey with deterministic local demo fixtures, checkpoint-shaped finality UX, controller-scoped persistence, and existing-Seat-first resume. Demo screens cannot produce a Sui or Soulidity write; production enrollment and claim builders fail closed.
- Infinite Flow Engine may host a separate Soul-bound prologue or PvE Scene with independent history; it is neither the guest tutorial nor the asynchronous multiplayer universe authority.
- Private coordinates and map secrets remain local. Outcome-changing rules and settlement are authoritative on Sui.
- Proof interface v1 has exactly four BN254 public signals and binds a sixteen-field Sui Poseidon action tuple. For `move`, `amount_u64` means maximum route distance; transferred energy and silver remain live-state arguments. Checked-in Circom 2.2.3 `claim_home` and `move` relations cover manifest-committed radius/rarity/MiMC/Perlin/home/distance geometry. Each Season binds exact claim/move `CircuitConfig` IDs plus config and verifying-key digests. Move recomputes public inputs, invokes Sui Groth16, creates internal witnesses only after verification, and consumes a source-Planet nonce on successful dispatch. Development proofs exercise real home and move state changes; sender mutation, expiry, config substitution, and replay reject. Dark Forest location IDs remain fixed 32-byte big-endian for planet generation while Groth16 public scalars are separately little-endian. All current keys/artifacts remain development-only; no production-approved config constructor exists, so ranked writes stay fail-closed until reproducible builds, expanded review, setup ceremony, independent audit, and code-pinned production-key activation pass.
- The initial release has no fungible token, land sale, yield loop, or paid ranked power.

## Brand and repository

- The canonical working product name is Infinite Stellar and the repository slug is `infinite-stellar`.
- “Infinite” means one Soul can cross many finite seasonal worlds; each world remains bounded.
- The product is built on Sui and has no affiliation with the Stellar network or Stellar Development Foundation.
- D-023 permits a narrow, unannounced technical canary using the existing GitHub repository, Sui testnet address, and default Vercel project URL. It is not name clearance. Custom domains, social/internet accounts, app-store listings, campaigns, events, commercial announcements, mainnet, and promoted public releases remain blocked pending counsel and any required written consent; another rename may be required.
- Public repository content and project operations use English.
- Original repository content is MIT licensed; third-party assets and dependencies require their own provenance.

## Working-memory contract

- `docs/codex/CURRENT.md` is the continuation entry point.
- Read only the handoff named there when resuming work.
- Do not describe a planned integration or undeployed package as shipped.
- Do not commit, push, publish, deploy, or write onchain without explicit authorization for that phase.
