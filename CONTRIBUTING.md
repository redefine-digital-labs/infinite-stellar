# Contributing

This repository is an experimental pre-production product monorepo with specifications, a Sui Move foundation, a typed game SDK, and a player-facing vertical slice. Contributions should reduce uncertainty, improve the runnable evidence, or make a decision more testable.

## Before proposing implementation

Read the [World Bible](docs/00-world-bible.md), [product vision](docs/01-product-vision.md), [Soul role](docs/02-soul-role.md), [product requirements](docs/10-product-requirements.md), [onboarding and narrative flow](docs/11-onboarding-and-narrative-flow.md), [technical architecture](docs/04-technical-architecture.md), and [decision log](docs/08-decisions.md). A proposal that changes a non-negotiable principle should update the decision log and explain the evidence for the change.

## Documentation changes

- Write in English.
- Separate accepted decisions from hypotheses.
- Link technical claims to primary documentation.
- Give every performance number a device, version, dataset, and command.
- Do not describe unimplemented behavior as shipped.
- Preserve the distinction between the authorizing address, Soul, Animacraft visual input, Commander Projection binding, Season Seat, Civilization State, and Seat-owned Planets.

## Code changes

Every implementation pull request should include relevant tests. Changes to math, hashes, proof statements, public inputs, object topology, authorization, or season artifacts require cross-language vectors and security review.

For the TypeScript workspaces, install and validate from the repository root:

```bash
npm ci
npm run validate:web
npm run lint:docs
```

For Move changes, run the strict build, unit tests, and linter documented in [`move/infinite_stellar`](move/infinite_stellar).

Never include private keys, seed phrases, production capability objects, ceremony secrets, real player coordinates, or map-vault exports in issues, fixtures, logs, or commits.

## Licensing

This repository is licensed under the [MIT License](LICENSE). Contributions are submitted under the same license.

Do not copy code, circuits, art, or prose from Dark Forest or another project merely because its source is visible. Every dependency and derived work must be reviewed against its license before inclusion. Third-party assets retain their own licenses and must be documented explicitly.
