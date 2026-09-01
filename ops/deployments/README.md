# Deployment Records

Deployment records are immutable public evidence, not secret configuration.
Each JSON file pins one network, package, source commit, publisher, transaction,
and any shared bootstrap objects created for that release.

Rules:

- Never edit an existing successful record to point at a replacement package.
  Add a new versioned file and update `latest.json` deliberately.
- Never store private keys, mnemonics, capability contents, private map data, or
  Vercel/GitHub credentials here.
- Keep the sealed canary's Soul and proof readiness false; any later deployment
  record must prove its exact adapter and verifier integration
  suites and release gates pass.
- Verify every ID against the named Sui network and transaction before merging.
- A testnet deployment is not a mainnet release or an audit claim.

Verify the current record against Sui's public testnet GraphQL endpoint with:

```bash
npm run verify:deployment
```

The current Vercel web-canary record is
`vercel-production-2026-09-01-ranked-readiness.json`. It records the immutable
deployment URL, source commit, browser smoke path, canonical Soulidity mainnet
read, security-header check, and the independently blocked mainnet release
state. It is not an onchain deployment record. The earlier
`vercel-production-2026-09-01.json` record remains immutable deployment history.
