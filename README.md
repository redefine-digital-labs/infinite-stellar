# Infinite Stellar

> One Soul. Infinite worlds. Verifiable history.

**Infinite Stellar is a Soul-centered, zero-knowledge, fully onchain seasonal strategy game built on Sui.**

> **Status:** Experimental pre-production testnet canary plus a playable local Round 5 rules sandbox. The canonical Soulidity mainnet `SoulState` ABI, typed ranked-enrollment adapter, live ABI verifier, and proof-bound enrollment/home/move/move-new transaction gateway are now pinned in source, and the complete package passes a Sui mainnet publish dry-run. They are not deployed. The gateway simulates before signing, rejects resolved onchain failures, waits for indexed finality, reconciles exact BCS events/effects, and reconstructs the deterministic controller Seat bundle from chain BCS. Production proof keys, the web integration of that chain read model, reveal/capture proofs, external Artifact custody, and production services remain unavailable and fail closed.

The name describes an endless succession of bounded stellar worlds, not one season that runs forever. A player's civilization disappears when its universe closes; the Soul remains as the persistent actor and carries only verifiable history, relationships, and expression into the next world.

Infinite Stellar uses *stellar* in its astronomical sense and is built on Sui. “Stellar” is a trademark of the Stellar Development Foundation. All rights reserved. This is an independent project, not affiliated with, sponsored by, or endorsed by the Stellar Development Foundation.

Prior written name consent has not been obtained. The public working name is legally unconfirmed and may require another rename. On 1 September 2026, the project owner expanded the earlier canary authorization to include GitHub updates and production-valid Sui mainnet engineering. That authorization is not trademark clearance and does not waive technical release gates. Custom domains, internet or social accounts, app-store listings, campaigns, public events, commercial announcements, and promoted public releases remain blocked until counsel completes clearance and any required prior written consent is obtained. See the [decision log](docs/08-decisions.md).

## Product thesis

Players explore a shared seasonal universe without revealing private coordinates. They discover planets, grow energy, move fleets, coordinate socially, attack, defend, and contest a public endgame objective. Outcome-changing rules execute on Sui. Private map knowledge and proof generation remain on the player's device.

The identity model is deliberately split:

- A connected **address** authorizes enrollment and becomes the fixed controller of one ranked Seat; it is a command key, not the protagonist.
- A **Soul** is the persistent actor: identity, personality, relationships, and career history.
- An **Animacraft visual projection** or neutral fallback gives that actor versioned visible form.
- A **Commander Projection** binds the Soul, frozen presentation, and ownership epoch to one seasonal role.
- A **Season Seat** owns control, Planet custody, accountability, ranking, and anti-abuse state for one season.
- A **Civilization** is disposable strategic state. It begins `AwaitingHome`, becomes `Active` when its Seat claims a Founding Planet, and ends with the universe.

A Soul is more than an avatar because it creates continuity between worlds. It is less than a traditional hero because it carries no permanent combat or economic power. The shortest product rule is:

> Addresses authorize. Souls cross. Animacraft gives form. Commander Projections bind roles. Seats control. Civilizations expand.

## Ecosystem boundaries

| System | Role in Infinite Stellar | Explicit boundary |
| --- | --- | --- |
| **Soulidity** | Canonical Soul identity, current owner, ownership epoch, grants, content, and optional directly holder-signed Chronicle memory | Soul metadata, memory, popularity, price, and grants never determine ranked power or game control |
| **Animacraft** | Versioned visual material and provenance input for a Commander Projection | It is not game authority or the binding record; provenance is not a display license, unsupported rights fall back to neutral art, and cosmetics never affect ranked outcomes |
| **Infinite Flow Engine** | Candidate runtime for optional Soul-bound prologue and PvE Scenes | It requires a Soul and creates independent persistent Run history; it is neither the guest tutorial nor multiplayer authority |
| **Infinite Stellar** | Dedicated Season, Seat, Civilization, Planet, Arrival, score, privacy, and settlement authority | It never takes custody of a Soul; its official Chronicle flow requires a direct current-holder signature |

These are integration boundaries, not claims that every integration is already shipped. Each production season must pin the exact package versions and interface contracts it accepts.

## Non-negotiable principles

1. **Sui-native, not Solidity-shaped.** Ordinary actions do not serialize through one mutable global universe object.
2. **Honest hidden information.** Coordinates and discovery paths stay local; hidden-geometry actions carry zero-knowledge proofs bound to their exact intent.
3. **Onchain authority, offchain acceleration.** Indexers, relayers, sponsors, and rendering may improve UX, but none may decide a game outcome.
4. **Seasonal equality.** Soul age, rarity, price, memory, editable personality, and visual traits never grant ranked power.
5. **A Soul is not an empire.** Selling or transferring a Soul never transfers planets, fleets, coordinates, score, or a Season Seat.
6. **No token-first economy.** Season 0 has no fungible token, land sale, yield loop, or pay-to-win market.
7. **Verifiable operations.** Every production season pins package, circuit, client-core, rules, and configuration hashes before play begins.
8. **Finite seasons, infinite continuity.** Every universe has declared bounds, phases, settlement, and a deterministic end.
9. **One ranked command.** One address may control at most one ranked Seat per league and season; this is a product-fairness quota, not Sybil resistance.

## First public target

The release path uses private/testnet rehearsals before a web-first Sui mainnet
season. The player target is:

- 100–300 active players in one universe.
- A seven-day season.
- Explore, discover, claim, grow, move, reinforce, attack, defend, and score.
- Browser-local mining and proof generation in Web Workers.
- Sponsored transactions and a guest tutorial.
- Ranked entry requires an eligible Soul; the guest tutorial requires no Soul and creates no ranked or Soul-linked history.
- Social coordination without a protocol-enforced alliance system in the initial release.
- Human League first; an explicitly separate Open Agent League follows only after the human game is stable.
- No token, tradable ranked advantage, or persistent military power.

Mainnet is gated by circuit, contract, performance, privacy, indexer-rebuild, operations, licensing, and name-clearance evidence—not by a calendar promise. The limited testnet/Vercel canary above does not satisfy any mainnet or public-launch gate.

## Repository map

| Document | Purpose |
| --- | --- |
| [World Bible](docs/00-world-bible.md) | Canon, tone, seasonal arc, terminology, and narrative boundaries |
| [Product vision](docs/01-product-vision.md) | Audience, experience, positioning, boundaries, and success metrics |
| [The role of Soul](docs/02-soul-role.md) | Identity model, seasonal binding, transfer behavior, and progression |
| [Game design](docs/03-game-design.md) | Core loop, season structure, resources, conflict, diplomacy, and endgame |
| [Technical architecture](docs/04-technical-architecture.md) | Sui objects, Move modules, ZK design, client, indexer, and data flow |
| [Security and privacy](docs/05-security-and-privacy.md) | Threat model, circuit risks, operational controls, and launch gates |
| [Security policy](SECURITY.md) | Private reporting channel and current support scope |
| [Roadmap](docs/06-roadmap.md) | Go/no-go prototype through staged mainnet release |
| [Launch and live operations](docs/07-launch-and-live-ops.md) | Season publishing, community, support, incidents, and measurement |
| [Decision log](docs/08-decisions.md) | Accepted decisions, hypotheses, and unresolved choices |
| [Research notes](docs/09-research-notes.md) | Primary references and claims that require prototype validation |
| [Product requirements](docs/10-product-requirements.md) | Prioritized requirements, user journeys, acceptance criteria, and launch scope |
| [Onboarding and narrative flow](docs/11-onboarding-and-narrative-flow.md) | Address-to-Soul entry, screen routing, lifecycle, Founding Planet, transfer, vault, and accessibility contracts |
| [Soul adapter contract](docs/12-soul-adapter-contract.md) | Replaceable Soulidity boundary, frozen game-core inputs, production gates, and current Move evidence |
| [Player vertical slice](docs/13-player-vertical-slice.md) | Runnable client journey, SDK boundary, persistence, real-versus-demo capability matrix, and validation |
| [Round 5 parity contract](docs/14-dark-forest-v06-parity.md) | Source-linked behavioral target, formulas, compatibility quirks, and acceptance vectors |
| [Round 5 Sui architecture](docs/15-round5-sui-architecture.md) | Object topology, proof intents, concurrency, state machines, and release gates |
| [Proof interface and artifact preflight](docs/16-proof-interface-and-artifact-preflight.md) | Exact BN254/Poseidon encoding, golden vector, manifest contract, Worker lifecycle, and mainnet gates |
| [Mainnet readiness](docs/17-mainnet-readiness.md) | Canonical Soul evidence, successful publish simulation, exact blockers, and safe release order |
| [`apps/web`](apps/web) | Responsive React player client with Sui wallet connection and a clearly labeled local strategy sandbox |
| [`packages/game-sdk`](packages/game-sdk) | Typed journey, exact MiMC/Perlin vectors, Round 5 rules simulator, persistence, and fail-closed Sui gateway |
| [`packages/prover`](packages/prover) | Cross-language proof intent, Arkworks-compatible Sui Groth16 bytes, content-addressed artifact loader, and Worker protocol |
| [`move/infinite_stellar`](move/infinite_stellar) | Sui Move season, identity, Planet, voyage, artifact, reveal, capture, score, and settlement state machines |
| [Round 5 rules manifest](config/dark-forest-v06-round5.json) | Machine-readable constants, enumerations, ship effects, and preserved contract quirks |
| [Proof interface v1](config/proof-interface-v1.json) | Machine-readable field order, constants, mainnet domain, serialization, and golden vector |
| [Move-new proof extension v1](config/move-new-proof-interface-v1.json) | Five-signal natural-Planet initialization statement, proof-derived Perlin, and config shape |
| [Sui testnet deployment](ops/deployments/sui-testnet-v0.1.0.json) | Immutable package, transaction, capability, canary-object, source-commit, and readiness evidence |

## Run the player vertical slice

Requirements: Node.js 24.x, npm 11 or newer, and a modern browser.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. The wallet client targets Sui mainnet while the readiness screen links the existing testnet canary evidence; ranked writes remain disabled because no production package/Season or production circuit setup is pinned. The canonical Soul adapter and enrollment builder exist in source but are deliberately not exposed against the sealed canary. Choose **Explore local demo** to enter the full local loop: activate a Soul-bound commander, claim a valid founding location, and enter a full-viewport private star map. Desktop commands live in draggable, keyboard-movable windows with persisted safe positions and a minimize/reopen dock; mobile commands become one dock-selected bottom sheet. Drag empty map space or use the arrow keys to pan; use the wheel, camera buttons, `H`, and `0` to zoom, return Home, and fit resolved space. Voyage routes use aspect-ratio-safe SVG endpoints, so they remain attached to both Planet centers through pan and zoom. The map can mine deterministic square-spiral frontier batches in a cancellable browser Worker while the main interface stays responsive. From there, launch and settle energy/silver fleets, conquer and upgrade planets, operate artifacts and all five ships, route eligible artifacts through controlled Spacetime Rips, manage junk, reveal/capture, score, and finalize Last Light. Rip custody is simulated locally; a production wallet-owned Sui artifact wrapper remains fail-closed.

The controller session is authenticated and encrypted with AES-GCM under a non-extractable device key stored beside ciphertext in IndexedDB. Valid legacy plaintext sessions migrate once and are removed from `localStorage`. This improves at-rest handling but is not an XSS boundary: a compromised same-origin script, browser extension, or device can still use the unlocked browser context. Portable key wrapping, user export/restore, recovery UX, and an independent client security review remain production release gates.

Run all TypeScript checks with:

```bash
npm run validate:web
npm run lint:docs
npm run verify:deployment
npm run verify:soulidity-mainnet
npm run verify:move-mainnet-dry-run  # requires active Sui environment: mainnet
```

The capability boundary and remaining work are documented in the [player vertical slice](docs/13-player-vertical-slice.md).

## Repository evolution

If the technical prototype passes its gates, this repository becomes the product monorepo rather than being discarded:

```text
apps/
  web/                       player client
packages/
  game-sdk/                  typed game actions and state projection
  prover/                    worker protocol and proof artifact loader
  shared-math/               canonical fixed-point and hash vectors
move/
  infinite_stellar/          Sui Move package
circuits/
  location/                  Circom sources and tests
services/
  indexer/                   checkpoint ingestion and projections
  sponsor/                   rate-limited transaction sponsorship
ops/
  seasons/                   signed manifests and release procedures
```

Implemented directories are shown above. The remaining entries are roadmap targets and appear only when their workstream begins with tests and reproducible build instructions.

## Current status

- **Phase:** Experimental testnet interface canary plus player-facing full-stack vertical slice
- **Network:** Sui testnet package and sealed canary deployed; no mainnet deployment
- **Implementation:** Round 5 gameplay state machines are implemented in Move; canonical Soulidity mainnet enrollment is compile-time pinned and undeployed; complete development claim/move/move-new relations constrain manifest-committed MiMC, rarity, radius, Perlin, home-band, distance, and action intent; each Season binds exact per-action circuit-config IDs and digests; real development Groth16 proofs create a Founding Planet, dispatch nonce-bound fleets, and atomically initialize a proof-derived natural Planet in Sui Move tests; the SDK binds prepared proof bytes to the exact sender/Seat/nonce/deadline/Manifest intent, builds all three player PTBs, simulates and reconciles finalized BCS events, and directly derives/reads the controller Seat bundle; production proof configs and ranked gameplay writes remain fail-closed; the responsive client still uses the local compatibility authority rather than the new chain read model
- **License:** [MIT](LICENSE)
- **Next gate:** Complete the production proof ceremony and key pinning, wire the tested transaction/read-model gateway into the wallet UI, build the indexer/sponsor/monitoring path, and pass independent circuit/contract/client audits, multi-wallet soak, operational controls, and release clearance before publishing a playable mainnet season. See [mainnet readiness](docs/17-mainnet-readiness.md).

Dark Forest v0.6 is GPL-3.0 licensed. Infinite Stellar requires original fiction, art direction, writing, Move code, and circuits unless the team deliberately accepts the obligations of incorporating GPL-licensed material. See [research notes](docs/09-research-notes.md).
