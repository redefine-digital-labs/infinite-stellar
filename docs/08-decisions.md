# Decision Log

This is the compact record of product and architecture decisions. A decision remains revisable between seasons, but changes require evidence and an explicit update here.

## Accepted

### D-001 — Build a Sui-native game, not an EVM port

Use independent Sui objects and derive natural contention boundaries. Do not reproduce a global Solidity contract layout.

### D-002 — Soul is the persistent actor, not the empire

The Soul supplies persistent identity. `CommanderProjection` is its seasonal role. `CivilizationState` and `SeasonSeat` hold temporary competitive state. Infinite Stellar relationships and career facts are external receipts associated with the Soul, not fields already present in `SoulState`.

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

### D-012 — Original creative work and implementation

Infinite Stellar may learn from the design space opened by Dark Forest, but requires original fiction, art, writing, and—if implementation begins—original Move code and circuits unless a deliberate GPL-compatible strategy is approved.

### D-013 — One ranked binding per Soul and Seat per season

Both the Soul slot and Seat commander slot remain consumed for the entire season. Transfer detaches the projection; the Seat continues with a neutral commander and the buyer waits until the next ranked season.

### D-014 — Receipts are external and attribution is live-validated

Infinite Stellar issues frozen Seat and Soul Segment receipts from bounded onchain accumulators. Every Soul-attributed update validates the canonical SoulState owner and epoch at execution. The official optional Chronicle flow requires a separate Soulidity transaction directly signed by the current holder and does not use delegated `SoulGrant` memory authority.

### D-015 — Onchain entropy, not operator-selected seeds

Universe and beacon entropy use one-way, permissionless Sui Random transitions at manifest-declared times with no output-dependent abort path.

### D-016 — Fixed controller for ranked Alpha

The Season Seat controller is fixed at enrollment and human actions validate `ctx.sender()`. Mid-season recovery/delegation is deferred; future capabilities remain separate from Soul ownership.

### D-017 — Bounded canonical Season 0 outcome

Beacon finalization writes an onchain winner or no-winner result after its bounded arrival queue is drained. Seat ScoreCards are onchain; exact leaderboard order is a checkpoint-reproducible UI view and is not used for Season 0 protocol rewards.

### D-018 — Infinite Stellar is the canonical working brand

The public pre-production working name is **Infinite Stellar** and the repository slug is `infinite-stellar`. “Infinite” describes one Soul crossing an open-ended succession of finite seasonal worlds; it never describes an unbounded Run, queue, or season. “Stellar” is used in its astronomical sense. The product is built on Sui and is not affiliated with, sponsored by, or endorsed by the Stellar Development Foundation or the Stellar network.

This decision records the user's working-name choice; it does not establish a legal right or represent written consent. The repository openly records that consent has not been obtained. Except for this disclosed planning repository and its repository metadata, domains, internet or social accounts, app-store listings, external campaigns whether paid or unpaid, public event promotion, commercial announcements, and releases stay blocked until counsel completes clearance and any required prior written consent is obtained.

### D-019 — Ecosystem layers remain separate

Soulidity supplies canonical identity and ownership epochs. Animacraft is the intended versioned visual embodiment layer. Infinite Flow Engine may support a separate Soul-bound prologue or PvE Scene with its own persistent unranked Run history; it cannot provide the no-Soul guest tutorial. The asynchronous multiplayer universe has its own Infinite Stellar Season, Seat, Civilization, Planet, Arrival, score, and settlement authority. No integration is described as shipped until an exact package/interface version passes end-to-end acceptance.

### D-020 — The repository is open source under MIT

Planning documents and future original implementation in this repository use the MIT License. Dependencies, copied material, generated artifacts, fonts, art, audio, and other third-party assets require separate license provenance.

## Working hypotheses

These require prototypes or playtests before becoming accepted decisions:

- A seven-day Alpha season is long enough for diplomacy and short enough for learning speed.
- 100–300 active players produces useful world density.
- A beacon objective reduces passive snowballing.
- Browser-local Groth16 proving can meet a 5-second desktop p95.
- Sharded derived-object claims and per-planet writes meet target throughput.
- A bounded destination arrival index gives the best correctness/complexity tradeoff.
- A game-local guest tutorial plus sponsored transactions can reduce onboarding without unacceptable abuse.
- Score/achievement bands are better permanent Soul receipts than exact ranks.

## Open decisions

- Final visual direction and formal written product-name clearance.
- Exact coordinate hash and Poseidon parameter set.
- Public-input packing schema.
- Planet density and generation function.
- Combat and beacon scoring constants.
- Post-Alpha Season Seat recovery and delegation pattern.
- Arrival object versus inline arrival representation.
- Whether formal alliances ship before mainnet.
- Mobile proving support for Season 0.
- Production data provider and full-node strategy.
- Long-term asset, font, audio, and content licenses.
- Whether high-stakes seasons justify a Soulidity core/market extension for `RuntimeLock`.

## Decision criteria

Prefer the option that, in order:

1. Preserves correctness and privacy.
2. Keeps ranked competition fair.
3. Can be independently reconstructed and operated.
4. Produces understandable player behavior.
5. Reduces irreversible implementation and audit cost.
