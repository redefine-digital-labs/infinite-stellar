# Security and Privacy

## Security objective

No participant or operator should be able to create an invalid strategic outcome, learn private coordinates through required infrastructure, reuse authority after a Soul transfer, or make the canonical game unrecoverable by disabling an offchain service.

The game combines smart-contract, zero-knowledge, browser, economic, and live-operations risk. Passing a Move audit alone is insufficient.

## Protected assets

- Planet ownership, energy, fleets, score, and settlement correctness.
- Coordinate preimages and the private map graph.
- Soul ownership and ownership-epoch integrity.
- Projection provenance, display rights, and fallback availability.
- Season Seat and command capabilities.
- Proving and verifying artifact integrity.
- Sponsor funds and anti-abuse budget.
- Upgrade, pause, publishing, and deployment keys.
- Indexer availability and reproducibility.
- Fair access during congestion and incident recovery.

## Principal threats

| Threat | Required control |
| --- | --- |
| Underconstrained circuit | Independent circuit review, adversarial witness tests, mutation tests |
| Missing range checks | Explicit bit widths and boundary vectors for every private integer |
| Malicious verifying key | Frozen `CircuitConfig`, manifest hash pinning, public ceremony |
| Proof replay or front-running | Bind season, sender/seat, source, destination, amount, nonce, deadline, and action kind |
| Field-encoding ambiguity | Versioned canonical encoding with rejection rules and golden vectors |
| Shared-object hotspot | Sharded first-claim registries, per-planet state, realistic load tests |
| Arrival queue denial of service | Hard queue bounds, action fees/rate limits, permissionless bounded settlement |
| Sponsor draining | Per-seat/IP/device heuristics, budgets, captchas where appropriate, circuit breaker |
| Soul transfer authority leak | Canonical owner and `ownership_epoch` validation on every Soul-attributed path |
| Projection substitution or rights loss | Freeze exact visual/provenance commitments and policy version; retain a neutral permanent fallback |
| Dependency/package drift | Pin exact Soulidity, Animacraft, optional Infinite Flow Engine, circuit, and client-core identities in the applicable season manifest or separate product release record |
| Agent overreach | Separate scoped `WorldCommandCap`; never reuse broad Soul grants |
| Coordinate exfiltration | Local-only witnesses, worker isolation, telemetry schema denylist, no session replay on map |
| Plugin exfiltration | No executable plugins initially; later capability manifest and isolated worker |
| Cross-language math drift | Shared golden vectors in Move, TypeScript, Rust, and Circom |
| Indexer divergence | Checkpoint cursor, reconciliation, clean rebuild drill, chain-linked UI evidence |
| Operator rule change | Frozen season manifest and no mid-season balance changes |
| Key compromise | Hardware-backed multisig, separation of duties, timelock, rehearsed rotation |
| Randomness grinding | One-way permissionless transitions with no output-dependent abort or caller choice |
| Public behavior correlation | Minimize fields, disclose graph visibility, epoch-tag relationships, separate sponsor metadata |

## Circuit assurance

The circuit audit must look for what the proof fails to constrain, not only whether valid examples pass. The test suite should deliberately mutate every public action field after proof generation and require verification failure. It should attempt out-of-range signed values, field aliases, overflowed squares, boundary distances, malformed proof bytes, and alternate-domain commitments.

Production ceremony artifacts and their hashes must be independently verifiable. The client should reject an artifact bundle that does not match the manifest even if the official CDN serves it.

## Move assurance

Required practices:

- Unit and scenario tests for every invariant and abort path.
- Property testing or fuzzing for fixed-point math, arrival ordering, and combat.
- Tests at exact phase and timestamp boundaries.
- Capability-flow review for ownership, transfer, destruction, and upgrade.
- Adversarial programmable-transaction tests that combine calls in unexpected orders.
- Gas profiling at every declared collection bound.
- Independent Move audit before valuable mainnet play.

Critical invariants include conservation of action energy, unique planet claims, monotonic nonces, deterministic arrival order, single ranked Soul binding per season, and immediate epoch-based invalidation.

## Client privacy controls

- Coordinate preimages never enter standard logs.
- Analytics events use enumerated schemas; arbitrary context objects are prohibited.
- Session-replay tools are disabled on the map and proof surfaces.
- Crash reporters scrub worker messages, transaction payloads where necessary, local labels, and storage snapshots.
- Content Security Policy restricts unexpected scripts and network destinations.
- Third-party UI packages cannot access the local map vault by default.
- Clipboard, export, and support flows warn when data contains private map material.
- The team runs a browser network-capture test that exercises the full season loop and confirms no coordinate leakage.

## Metadata and correlation limits

Hidden coordinates do not make a player anonymous. Soul, wallet/controller, Season Seat, league, action timing, location commitments, ownership changes, sponsor requests, and relationship receipts can form a durable behavior graph. Soul transfer does not erase old epoch records.

The product must state this plainly. Publish only fields required for verification or intentional social play; use score bands in permanent receipts; require both parties for a positive reciprocal relationship label; show ownership-epoch provenance; and define retention/deletion behavior for offchain metadata. Sponsor logs are access-controlled, short-lived, and not joined to analytics profiles by default.

## Operational security

Roles should be separated:

- Immutable engine deployment and manifest-approval multisig.
- Emergency pause multisig or threshold role.
- Extension and cancellation multisigs or threshold roles.
- Season publisher.
- Sponsor treasury.
- Web deployment.
- Indexer/database operations.

The production engine's `UpgradeCap` is consumed before the manifest is finalized. No single hot key should control deployment, season publication, operational transitions, and sponsor funds. All production changes require recorded artifact hashes and a two-person review.

## Incident classes

### Privacy incident

Stop affected client distribution and telemetry ingestion, preserve evidence without copying private data unnecessarily, disclose the exposure scope, and provide map-vault rotation or migration guidance.

### Invalid-state or proof incident

Pause new strategic actions if the narrow PauseCap can reduce harm. Do not invent an offchain winner. Publish affected versions and transactions, preserve deterministic settlement where safe, and follow the predeclared cancel/extend policy.

### Availability incident

Fail over dedicated RPC/indexer infrastructure. Provide direct-chain fallback and status communication. A backend outage alone is not grounds to rewrite the season.

### Key compromise

Execute rehearsed rotation for affected service or operational keys, revoke access, publish onchain administrative actions, and remain within the manifest's predeclared transition limits. An immutable active engine is not patched through a compromised admin workflow.

## Launch-blocking gates

Mainnet is blocked until all of the following are true:

- Independent Move audit has no unresolved critical or high findings.
- Independent circuit review has no unresolved critical or high findings.
- Production trusted setup is complete and reproducible.
- Browser privacy capture finds no coordinate leakage.
- Hot-planet and queue-limit stress tests pass.
- Package, circuit, client, rules, and manifest hashes are reproducible.
- Indexer rebuild and RPC failover drills pass.
- Pause, settlement, extension/cancellation, and disclosure runbooks are rehearsed.
- A public security contact and funded bug bounty exist.

## Responsible disclosure

The repository publishes a [security policy](../SECURITY.md) and uses GitHub private vulnerability reporting during pre-production. Before public testnet, expand it with supported versions, response targets, safe harbor, a funded bounty, and explicit scope for Move, circuits, client privacy, sponsor, indexer, and integration boundaries. Do not direct vulnerability details into public issues.
