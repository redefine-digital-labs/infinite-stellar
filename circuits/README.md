# Infinite Stellar circuits

This directory contains independently written, development-only Circom
candidates for the frozen proof-interface v1. They are not production circuits.

Implemented now:

- exact four-public-signal order and Sui BN254 Poseidon action intent;
- exact Round-5 MiMC location preimages;
- canonical sign/magnitude coordinates, manifest-pinned dynamic radius, exact
  planet rarity, three-octave Round-5 Perlin, home band, and movement distance;
- an in-circuit Poseidon commitment to every geometry parameter;
- deterministic TypeScript fixtures, valid/tampered Groth16 verification, and
  an Arkworks byte vector accepted by Sui's native BN254 verifier.

Still blocking production:

- broader differential/property testing, performance budgets, reproducible
  container builds, and an independent circuit audit;
- a production Phase 2 ceremony and audited verifying-key pinning;
- immutable mainnet `CircuitConfig` and verified package entry points.

## Development build

Use Node 24, `snarkjs` 0.7.6, `circomlib` 2.0.5, and the official Circom
compiler v2.2.3. Build the compiler from the official source tag, then run:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH \
  CIRCOM_BIN=/absolute/path/to/circom \
  npm run circuits:build:dev

PATH=/opt/homebrew/opt/node@24/bin:$PATH npm run circuits:test:dev
```

The generated powers of tau and circuit-specific contributions use a public,
deterministic development entropy string. They have no toxic-waste security and
are ignored by Git. Production loaders must continue to reject them.

The current optimized development R1CS contains `9,331` constraints for
`claim_home_v1` and `11,489` for `move_v1`, both below the checked-in powers-of-
tau-14 capacity. On the 2026-08-31 development machine, the two valid proofs,
24 signed/mirrored Perlin differential vectors, and all adversarial witnesses
completed in `1.68s`; this is reproducibility evidence, not a browser p95 or a
production performance approval.

Tooling dependencies are GPL-3.0; project-authored circuit source remains under
the repository MIT license. No Dark Forest GPL circuit source is copied here.
