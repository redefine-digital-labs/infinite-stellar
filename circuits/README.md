# Infinite Stellar circuits

This directory contains independently written, development-only Circom
candidates for the frozen proof-interface v1. They are not production circuits.

Implemented now:

- exact four-public-signal order and Sui BN254 Poseidon action intent;
- exact Round-5 MiMC location preimages;
- canonical sign/magnitude coordinates, fixed radius, planet rarity, and normal
  movement distance;
- deterministic TypeScript fixtures and valid/tampered Groth16 verification.

Still blocking production:

- the independent Round-5 Perlin and home-band relation;
- dynamic season radius and complete action-specific public-input semantics;
- circuit review, adversarial differential tests, benchmarks, and independent
  audit;
- a production Phase 2 ceremony and Sui Arkworks serialization bridge;
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

Tooling dependencies are GPL-3.0; project-authored circuit source remains under
the repository MIT license. No Dark Forest GPL circuit source is copied here.
