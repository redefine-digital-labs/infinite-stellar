# Infinite Stellar circuits

This directory contains independently written, development-only Circom
candidates for the frozen proof-interface v1. They are not production circuits.

Implemented now:

- frozen four-public-signal claim/move order plus a five-signal `move_new`
  extension and the same Sui BN254 Poseidon action intent;
- exact Round-5 MiMC location preimages;
- canonical sign/magnitude coordinates, manifest-pinned dynamic radius, exact
  planet rarity, three-octave Round-5 Perlin, home band, and movement distance;
- an in-circuit Poseidon commitment to every geometry parameter;
- deterministic TypeScript fixtures, valid/tampered Groth16 verification, and
  Arkworks byte vectors accepted by Sui's native BN254 verifier;
- test-only immutable-config vectors and real proof-to-state Move tests for
  Founding Planet creation, nonce-bound fleet dispatch, and atomic natural
  Planet initialization plus dispatch.

Still blocking production:

- broader differential/property testing, performance budgets, reproducible
  container builds, and an independent circuit audit;
- a production Phase 2 ceremony and audited verifying-key pinning;
- code-pinned, frozen production `CircuitConfig` creation and explicit enabling
  of the currently fail-closed ranked entry points.

## Development build

Use Node 24, `snarkjs` 0.7.6, `circomlib` 2.0.5, and the official Circom
compiler v2.2.3. Build the compiler from the official source tag, then run:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH \
  CIRCOM_BIN=/absolute/path/to/circom \
  npm run circuits:build:dev

PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run circuits:test:dev

PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run circuits:export:move-fixtures
```

The export command first rebuilds the prover package, then emits one tracked
development-only bridge fixture. It is an auditable test vector, not a stable
production setup artifact; rebuilding the disposable development setup may
produce a different key and proof and therefore requires regenerating the Move
vector deliberately.

The generated powers of tau and circuit-specific contributions use a public,
deterministic development entropy string. They have no toxic-waste security and
are ignored by Git. Production loaders must continue to reject them.

All three optimized development R1CS files remain below the checked-in
powers-of-tau-14 capacity. Local CLI timings are reproducibility evidence, not
a browser p95 or production performance approval.

Tooling dependencies are GPL-3.0; project-authored circuit source remains under
the repository MIT license. No Dark Forest GPL circuit source is copied here.
