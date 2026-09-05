# Mainnet Readiness

## Current verdict

**Blocked for a player-facing mainnet season. Do not publish or advertise a
playable release yet.**

The package now compiles against the canonical Soulidity mainnet package and a
full Sui mainnet publish dry-run succeeds. That proves the current bytecode is
publishable; it does not make the season playable or production-safe. Ranked
home claiming and fleet movement still reject because production proof
configurations and verifying keys are intentionally unavailable.

## Resolved release work

| Gate | Evidence | Status |
| --- | --- | --- |
| Canonical Soul format | `soulidity::soul::SoulState` v1; owner, epoch, Soul ID, State ID, and listing accessors verified live | Ready |
| Soulidity package identity | Callable package `0x60bf…2ecd`; original/type-origin package `0xa43c…e5d5d`; exact source commit pinned | Ready |
| Ranked enrollment adapter | Move reads the canonical shared `SoulState` in the enrollment transaction and creates no Soul custody | Ready in source, undeployed |
| Player transaction builders | SDK constructs sender-bound `soul_adapter::enroll` and exact proof-bound `claim_home`, `dispatch_move`, and `dispatch_move_new` PTBs from pinned deployment/config inputs | Ready in source; proof builders remain runtime-gated by unavailable production configs |
| Proof submission boundary | Worker output is converted to exact Arkworks/Sui proof bytes and rejected unless manifest, key digest, public signals, serialized inputs, and action intent all match | Ready in source against development fixtures |
| Canonical Soul discovery | Client scans canonical `SoulCreated` events because `SoulState` is shared, then BCS-validates the live State/Soul type, identity, current owner, epoch, listing state, versions, and digests | Ready in source and wired to the ranked React route; bounded replay reports incomplete instead of a false empty result |
| Simulation and finality | Gateway simulates with checks enabled before invoking the wallet, treats resolved `FailedTransaction` results as failures, waits for indexed finality, and verifies exact BCS event/effect bindings | Ready in source and wired to the gated enrollment route |
| Existing-Seat read model | SDK derives the controller Seat from the exact Move `ControllerSeatKey` BCS/type origin and cross-checks Seat, Projection, Civilization, and Score BCS identities | Ready in source and resolved before Soul discovery in the ranked React route |
| Ranked universe projection | SDK can scan bounded checkpoint-bearing global history or derive Planet IDs from authenticated private coordinates, point-read exact Manifest/Runtime/Planet/pending-Voyage BCS, re-read every object to reject races, and fingerprint versions/digests | Known-coordinate path and interactive read-only map are wired; global public/revealed surfaces still require the production indexer |
| Private map vault | AES-GCM ciphertext and non-extractable device keys are isolated by exact chain ID, package, type origin, Season, PlanetRegistry, Seat, and controller; merge recomputes MiMC/Perlin/radius/rarity and never accepts local ownership or resources | Existing-Seat map and manifest-bound Worker exploration are wired, with cross-tab discovery union; portable backup/import and proof-bound home-claim preparation remain unfinished |
| Submitted-digest recovery | Enrollment persists its public digest and exact action expectation immediately after wallet submission, then can resume indexed finality/event/effect reconciliation after reload without signing again | Ready in source; production two-wallet crash rehearsal remains required |
| Release evidence gate | SDK requires exact SHA-256 pins for ceremony, circuit/Move/client audits, operations approval, and multisig policy before any ranked builder can reach signing | Ready in source; no production evidence record exists, so writes remain unreachable |
| Sui protocol limits | `SeasonManifest` and `Planet` are below the mainnet 32-field struct limit without changing gameplay accessors | Ready |
| Bytecode verification | Mainnet build and bytecode meter pass | Ready |
| Publish simulation | Full mainnet dry-run succeeds; observed simulated gas was 544,308,000 MIST | Ready at the tested source revision |

The machine-readable Soul ABI record is
[`config/soulidity-mainnet-v1.json`](../config/soulidity-mainnet-v1.json). Run:

```bash
npm run verify:soulidity-mainnet
cd move/infinite_stellar
sui move test -e testnet
sui move build --warnings-are-errors -e mainnet
sui client verify-bytecode-meter --package . -e mainnet --warnings-are-errors
cd ../..
npm run verify:move-mainnet-dry-run
```

The last command requires the Sui CLI's active environment to be `mainnet`. It
does not sign, publish, or spend gas.

## Remaining blockers to multiplayer play

| Release gate | Current evidence | Required closure |
| --- | --- | --- |
| Production claim/move/move-new circuits | Complete development relations and real test proofs; production readiness is hardcoded false | Reproducible release build, public Phase 2 ceremony, pinned production artifacts, independent circuit review, production `CircuitConfig` constructor, and positive/adversarial vectors |
| Reveal and capture privacy | Typed fail-closed adapters only | Complete and audit the action-specific relations, keys, Move verifier paths, and client builders |
| External Artifact custody | Local Spacetime Rip behavior and fail-closed adapter | Define and audit the wallet-owned Sui artifact wrapper, extraction/deposit authority, and signed client paths |
| Player transaction gateway | The supported wallet route discovers live Souls, resolves an existing Seat first, keeps closed gates out of the DOM, simulates before signing, and shows submission/finality failures | Run a real two-wallet rejection/retry/crash rehearsal against production-candidate configs and retain digest-based recovery evidence |
| Chain-backed web client | Canonical Soul, deterministic Seat, exact known-Planet/pending-Voyage reads, encrypted private-map merge, and read-only ranked map are chain-backed; command submission remains sealed and the public site has no mainnet game deployment | Persist ranked miner/home-claim witnesses into the exact vault and connect audited proof-backed commands without importing local sandbox authority |
| Multiplayer infrastructure | No production indexer, sponsor, or monitoring service in this repository | Rebuildable checkpoint indexer, rate-limited sponsor, health/incident telemetry, archive/full-node strategy, and failure-mode tests |
| Season release | No production Manifest, production circuit objects, or immutable engine package | Freeze exact timings/rules/hashes, publish and verify objects, make the engine immutable, and record every transaction/object digest |
| Operational control | Release authority is not yet a documented production ceremony | Establish signer/capability custody, separation of duties, incident actions, and auditable release approvals |
| Security and performance | Unit/local integration evidence only | Independent Move/circuit/client review, browser proof benchmarks, gas/load tests, multi-wallet contention soak, indexer rebuild, and recovery rehearsal |
| Public release clearance | Working name and third-party presentation rights remain unconfirmed | Complete name, asset, font, audio, visual-license, privacy, and public-launch review |

## Safe release order

1. Finish and review production circuits and ceremony artifacts.
2. Activate the production Move verifiers only against their exact pinned
   digests and connect the tested SDK gateway to the wallet UI.
3. Run a real multi-wallet rehearsal with a checkpoint-rebuildable indexer and
   the production web path, including crash/retry and contention cases.
4. Complete independent security, performance, operations, and release-rights
   gates.
5. Publish the immutable engine and production objects, verify them from a
   second endpoint, then expose the ranked route.

Publishing the current package before step 4 would create an immutable-looking
mainnet object whose core ranked actions are sealed. It would not let everyone
play and would make later release provenance harder to explain.
