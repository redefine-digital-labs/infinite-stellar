# Decision Log

This is the compact record of product and architecture decisions. A decision remains revisable between seasons, but changes require evidence and an explicit update here.

## Accepted

### D-001 — Build a Sui-native game, not an EVM port

Use independent Sui objects and derive natural contention boundaries. Do not reproduce a global Solidity contract layout.

### D-002 — Soul is the persistent actor, not the empire

The Soul supplies persistent identity. `CommanderProjection` is its seasonal role. `CivilizationState` and `SeasonSeat` hold temporary competitive state. Veilworld relationships and career facts are external receipts associated with the Soul, not fields already present in `SoulState`.

### D-003 — Soul progression is non-power progression

Soul rarity, age, price, history, cosmetics, and editable personality files provide no ranked modifiers.

### D-004 — A Soul transfer never transfers a civilization

The bound ownership epoch becomes stale. The civilization stays with its Season Seat. External public history remains discoverable by Soul ID, but no receipt object, control capability, map, or rank transfers as part of the civilization.

### D-005 — Keep private coordinates local

Mining, coordinate storage, witness generation, and proving are local by default. No required backend receives coordinate preimages.

### D-006 — Bind proofs to exact action intent

A valid geometry proof cannot be replayed for another season, Seat, sender, route, amount, source-planet nonce, deadline, ruleset, or action kind.

### D-007 — Avoid a global mutable universe object

Use frozen manifests/rules, sharded claim registries, and independent derived/shared planet objects. A planet may serialize its own contested writes.

### D-008 — No token at launch

Season 0 has no fungible token, tradable energy, land sale, yield loop, or paid ranked advantage.

### D-009 — Separate Human and Open Agent leagues

Agent control requires a dedicated, narrow, expiring `WorldCommandCap`. General Soul grants do not authorize game control. Human League is explicitly policy-enforced, not cryptographically bot-proof.

### D-010 — Indexers are rebuildable projections

Sui checkpoints are authoritative. PostgreSQL state must be reproducible from a clean database and the client must tolerate indexer degradation.

### D-011 — Freeze each season

Every season pins an immutable engine/dependency set, rules, circuit, proving artifacts, reference-client core, and policy hashes. The engine `UpgradeCap` is consumed before the manifest is finalized. No mid-season balance changes.

### D-012 — Original product identity and implementation

Veilworld may learn from the design space opened by Dark Forest, but uses original name, art, writing, Move code, and circuits unless a deliberate GPL-compatible strategy is approved.

### D-013 — One ranked binding per Soul and Seat per season

Both the Soul slot and Seat commander slot remain consumed for the entire season. Transfer detaches the projection; the Seat continues with a neutral commander and the buyer waits until the next ranked season.

### D-014 — Receipts are external and attribution is live-validated

Veilworld issues frozen Seat and Soul Segment receipts from bounded onchain accumulators. Every Soul-attributed update validates the canonical SoulState owner and epoch at execution. Optional narrative memory is a separate holder-approved Soulidity transaction.

### D-015 — Onchain entropy, not operator-selected seeds

Universe and beacon entropy use one-way, permissionless Sui Random transitions at manifest-declared times with no output-dependent abort path.

### D-016 — Fixed controller for ranked Alpha

The Season Seat controller is fixed at enrollment and human actions validate `ctx.sender()`. Mid-season recovery/delegation is deferred; future capabilities remain separate from Soul ownership.

### D-017 — Bounded canonical Season 0 outcome

Beacon finalization writes an onchain winner or no-winner result after its bounded arrival queue is drained. Seat ScoreCards are onchain; exact leaderboard order is a checkpoint-reproducible UI view and is not used for Season 0 protocol rewards.

## Working hypotheses

These require prototypes or playtests before becoming accepted decisions:

- A seven-day Alpha season is long enough for diplomacy and short enough for learning speed.
- 100–300 active players produces useful world density.
- A beacon objective reduces passive snowballing.
- Browser-local Groth16 proving can meet a 5-second desktop p95.
- Sharded derived-object claims and per-planet writes meet target throughput.
- A bounded destination arrival index gives the best correctness/complexity tradeoff.
- Assisted Soul creation plus sponsored transactions can reduce onboarding without unacceptable abuse.
- Score/achievement bands are better permanent Soul receipts than exact ranks.

## Open decisions

- Final product name and visual direction.
- Exact coordinate hash and Poseidon parameter set.
- Public-input packing schema.
- Planet density and generation function.
- Combat and beacon scoring constants.
- Post-Alpha Season Seat recovery and delegation pattern.
- Arrival object versus inline arrival representation.
- Whether formal alliances ship before mainnet.
- Mobile proving support for Season 0.
- Production data provider and full-node strategy.
- Long-term repository and asset licenses.
- Whether high-stakes seasons justify a Soulidity core/market extension for `RuntimeLock`.

## Decision criteria

Prefer the option that, in order:

1. Preserves correctness and privacy.
2. Keeps ranked competition fair.
3. Can be independently reconstructed and operated.
4. Produces understandable player behavior.
5. Reduces irreversible implementation and audit cost.
