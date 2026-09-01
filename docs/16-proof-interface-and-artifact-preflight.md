# Proof Interface and Artifact Preflight

## Status and boundary

This document freezes Infinite Stellar proof interface v1 for cross-language
implementation. The repository includes development-only `claim_home`, `move`,
and `move_new` relations that cover the intended v1 geometry and action predicates,
plus a deterministic Sui serialization bridge and test-only proof-consuming
Move adapters. They remain unaudited development circuits; no production
verifying key, production trusted setup, or audited verifier exists. Ranked
writes remain fail-closed until every production gate in this document passes.

The machine-readable authority is
[`config/proof-interface-v1.json`](../config/proof-interface-v1.json), with the
action-specific natural-Planet statement in
[`config/move-new-proof-interface-v1.json`](../config/move-new-proof-interface-v1.json). The
TypeScript implementation lives in [`packages/prover`](../packages/prover), and
the matching Sui Move helper lives in
[`move/infinite_stellar/sources/proof_intent.move`](../move/infinite_stellar/sources/proof_intent.move).

## Sui compatibility

Interface v1 uses BN254. Sui's Groth16 API accepts at most eight public inputs
and expects concatenated 32-byte little-endian scalar elements. Sui's framework
Poseidon primitive accepts between one and sixteen canonical BN254 field
elements. Infinite Stellar uses exactly four public signals for `claim_home`
and ordinary `move`, five for `move_new`, and one sixteen-field action
commitment. Both layouts remain below Sui's eight-input ceiling.

Primary implementation references:

- [Sui Groth16 framework source](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/crypto/groth16.move)
- [Sui Poseidon framework source](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/packages/sui-framework/sources/crypto/poseidon.move)

## Domain and field rules

The scalar field is:

```text
21888242871839275222246405745257275088548364400416034343698204186575808495617
```

The domain label is `INFINITE_STELLAR_PROOF_INTENT_V1`. UTF-8 SHA-256 reduced
modulo the scalar field yields:

```text
13909138997969785233372616111572825994268025797777928597047068964955765571998
```

Network tags use the same derivation. The production network is `sui:mainnet`,
whose field is:

```text
135562284393187496412304656295821855871151406243072554287673956922558459083
```

All location, context, rules, action, and public-signal values must be canonical
field elements. Amount, source nonce, and deadline must fit unsigned 64-bit
integers. League must fit `u8`.

## Sui identifier encoding

Season ID, Seat ID, and sender use the 32-byte Sui address/object-ID value as a
big-endian `u256`. Each is split into two fields in this order:

```text
low_128  = identifier mod 2^128
high_128 = identifier / 2^128
```

This order is intentionally independent of the later little-endian Groth16
public-input byte serialization.

## Action commitment

Action kinds are `claim_home = 1`, `move = 2`, `reveal = 3`, `capture = 4`, and
`move_new = 5`.
The context field is:

```text
poseidon_bn254([network_field, league_u8])
```

The action commitment is `poseidon_bn254` over exactly these sixteen fields:

```text
0   domain_field
1   proof_interface_version
2   action_kind
3   context_field
4   season_id_low_128
5   season_id_high_128
6   seat_id_low_128
7   seat_id_high_128
8   sender_low_128
9   sender_high_128
10  source_location_hash
11  destination_location_hash
12  amount_u64
13  source_planet_nonce_u64
14  deadline_ms_u64
15  rules_geometry_commitment
```

Each Season pins the exact immutable claim/move/move-new `CircuitConfig` object ID,
config digest, and verifying-key digest. `CircuitConfig` schema v1 also fixes
the action kind, proof-interface version, public-input count, raw Arkworks key,
and SHA-256 digests of circuit source, proving key, verifying key, ceremony
transcript, and artifact manifest. Production entry points read those
authorities and reject a mismatch; callers cannot choose or supply key bytes.
Season and Seat IDs are globally unique Sui object IDs and bind the tuple to the
intended deployed object graph.

## Public inputs

The standard claim/move public-signal order is:

```text
source_location_hash
destination_location_hash
action_commitment
rules_geometry_commitment
```

Each signal is serialized as one 32-byte little-endian canonical scalar and the
four values are concatenated without a length prefix. The final byte length is
128. The TypeScript and Move tests lock the mainnet golden action commitment and
the SHA-256 digest of the serialized public inputs.

`move_new` uses this action-specific order:

```text
source_location_hash
destination_location_hash
destination_space_perlin
action_commitment
rules_geometry_commitment
```

Its five scalars occupy 160 bytes, and its Arkworks prepared verifying key
occupies 424 bytes rather than 392. The circuit constrains
`destination_space_perlin` to the exact Round-5 Perlin of the private
destination coordinates and manifest-committed geometry. Move accepts it only
after native verification, then derives all natural-Planet stats internally.

The numeric location field has two intentionally distinct byte views. Groth16
uses the little-endian scalar encoding above. Planet identity and Round-5
byte-indexed generation use the same fixed-width 32-byte big-endian location ID
shown by the client. Converting one to the other is explicit and vector-tested.

## Circuit obligations

Freezing the public interface is not enough. The production circuit must prove:

- private coordinate preimages produce both public location hashes;
- signed coordinate encoding, world radius, distance, Perlin, rarity, home, and
  action-specific predicates match the pinned rules;
- `rules_geometry_commitment` is constrained by embedded constants or fully
  constrained circuit inputs;
- the circuit recomputes the exact action commitment rather than accepting it
  as an unconstrained witness;
- every integer width, comparison, truncation, and field conversion is bounded;
- no alternate witness can satisfy a malformed or ambiguous encoding.

Circuit review, differential witness tests, adversarial tests, reproducible
builds, benchmarks, and an independent audit are mandatory before setup.

## Development circuit candidates

The independently written candidates in [`circuits/`](../circuits/) now
exercise the frozen standard interface and move-new extension with real Groth16 proofs:

- `claim_home_v1` constrains the action intent, canonical signed coordinates,
  exact Round-5 MiMC location hash, dynamic manifest radius, planet rarity,
  three-octave Perlin, and the configured home band;
- `move_v1` constrains both location preimages and the squared route-distance
  bound; for action kind `move`, proof-intent `amount_u64` canonically means
  the route's maximum distance, while sent energy and silver remain Move state
  transition inputs;
- `move_new_v1` proves the same route relation and exposes the constrained
  destination space Perlin so one transaction can claim the derived Planet ID,
  initialize canonical neutral stats, and dispatch its colonizing Voyage;
- TypeScript generates the fixtures, Circom generates the witness, snarkjs
  proves and self-verifies, and TypeScript serializes the proof/VK into
  Arkworks canonical-compressed bytes accepted by Sui's native verifier;
- a tracked development-only fixture binds the exact claim/move/move-new configs to a
  deterministic Move Season/Seat object graph; Move recomputes every public
  input, creates a Founding Planet, dispatches fleets, initializes a natural
  Planet, increments its source proof nonce, and rejects replay, sender/Perlin
  mutation, expiry, and config substitution;
- wrong coordinate preimages, negative-zero encodings, non-home planets,
  inconsistent geometry, non-power-of-two Perlin scales, rarity mutations,
  out-of-range routes, public-input mutation, and action mutation are rejected.

These are deliberately not production circuits. Independent review/audit,
expanded differential/property testing, performance evidence, a reproducible
container build, production Phase 2 ceremony, and audited production-config
activation remain blocking gates. Development build artifacts are disposable
and Git-ignored; their exported bridge fixture is labeled non-production and
runtime code has no constructor that can approve it.

## Artifact manifest v1

A selected manifest pins:

- mainnet, ruleset ID, circuit ID, and circuit version;
- BN254 and one of the two exact supported signal orders;
- source repository, 40-hex commit, circuit source SHA-256, and build image;
- development or production status;
- trusted-setup kind, and for production, ceremony ID and transcript SHA-256;
- exactly one circuit WASM, proving key, and verification key, each with URL,
  lowercase SHA-256, byte length, and exact media type.

The active season/build selection separately pins the manifest URL and its
SHA-256. Production selection rejects a development manifest or development
setup. Production URLs require HTTPS. Artifacts are same-origin with the
manifest unless the season explicitly allows a cross-origin source. Plain HTTP
is limited to local development hosts.

## Worker lifecycle

The browser creates one persistent Prover Worker. Preflight:

1. verifies the pinned manifest before parsing it;
2. checks the active mainnet/rules/circuit selection and setup provenance;
3. rejects duplicate/missing roles and a set above the declared memory budget;
4. fetches each role in the Worker and verifies media type, size, and SHA-256;
5. reports bounded progress and keeps successful bytes in Worker memory;
6. cancels the previous request when a new selection starts;
7. ignores messages for stale request IDs; and
8. exposes `ready` only after every check passes.

The Worker never receives a wallet signer. A ready preflight means only “the
bytes match the selected hashes”; it does not mean the circuit or setup is safe.

## Mainnet release gates

Mainnet ranked writes remain disabled until all of the following are evidenced:

- the exact live-verified Soulidity adapter ABI and accepted package remain
  pinned to the reviewed source and deployment record;
- circuit source and build image are reproducible and independently audited;
- Phase 2 ceremony, transcript, contribution verification, and final hashes are
  public and checked;
- the Move verifier pins the corresponding prepared verifying key and rejects
  every mutated intent field;
- real multi-wallet testnet/isolated-mainnet rehearsal covers enrollment,
  simultaneous voyages, contention, settlement, indexer rebuild, pause, and
  recovery;
- gas, proof latency, memory, browser support, incident, rollback, and monitoring
  targets pass;
- contract/client security review and the repository's legal/name-clearance gate
  are complete.

Until then the official client may run the local rules sandbox, but it must show
`PROVER GATED` or `PROVER FAIL-CLOSED` and must not construct or sign a ranked
transaction.
