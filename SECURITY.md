# Security Policy

## Current status

Infinite Stellar is a planning and pre-production repository. It contains no playable implementation, deployed package, production circuit, live sponsor, or player-secret service.

No released version is currently supported. Security claims in the planning documents are requirements, not evidence that an implementation has passed them.

## Reporting

Use GitHub's **Report a vulnerability** flow for this repository to submit a private security advisory. Do not place an undisclosed vulnerability, private coordinate, map-vault export, key, seed phrase, capability object, ceremony secret, or personal data in a public issue.

Include:

- the affected document, future component, commit, package, circuit, or deployment;
- impact and prerequisites;
- reproduction steps or a minimal proof of concept;
- any private data the report may contain;
- whether public disclosure is already planned or underway.

If private vulnerability reporting is unavailable, do not publish sensitive details merely to obtain a response. Open a public issue containing no vulnerability details and ask maintainers to restore the private channel.

## Future scope

Before public testnet, the reporting program must define supported versions, response targets, disclosure coordination, safe harbor, and bounty scope for:

- Sui Move packages and capabilities;
- zero-knowledge circuits, setup, and artifacts;
- browser map privacy and recovery;
- transaction construction and sponsorship;
- indexer correctness and rebuildability;
- Soulidity, Animacraft, and Infinite Flow integration boundaries;
- release manifests and operator controls.

Third-party projects retain their own reporting channels. A dependency issue should also be reported to its maintainer when doing so does not expose Infinite Stellar players or an uncoordinated live season.
