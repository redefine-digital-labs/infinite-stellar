# Contributing

This repository is currently a pre-production specification. Contributions should reduce uncertainty or make a decision more testable.

## Before proposing implementation

Read the [product vision](docs/01-product-vision.md), [Soul role](docs/02-soul-role.md), [technical architecture](docs/04-technical-architecture.md), and [decision log](docs/08-decisions.md). A proposal that changes a non-negotiable principle should update the decision log and explain the evidence for the change.

## Documentation changes

- Write in English.
- Separate accepted decisions from hypotheses.
- Link technical claims to primary documentation.
- Give every performance number a device, version, dataset, and command.
- Do not describe unimplemented behavior as shipped.
- Preserve the distinction between Soul, Commander Projection, Season Seat, and Civilization State.

## Future code changes

When implementation begins, every pull request should include relevant tests. Changes to math, hashes, proof statements, public inputs, object topology, authorization, or season artifacts require cross-language vectors and security review.

Never include private keys, seed phrases, production capability objects, ceremony secrets, real player coordinates, or map-vault exports in issues, fixtures, logs, or commits.

## Licensing

No repository license has been selected yet. Do not copy code, circuits, art, or prose from Dark Forest or another project merely because its source is visible. Any dependency or derived work must be reviewed against its license before inclusion.
