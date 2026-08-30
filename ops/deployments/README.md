# Deployment Records

Deployment records are immutable public evidence, not secret configuration.
Each JSON file pins one network, package, source commit, publisher, transaction,
and any shared bootstrap objects created for that release.

Rules:

- Never edit an existing successful record to point at a replacement package.
  Add a new versioned file and update `latest.json` deliberately.
- Never store private keys, mnemonics, capability contents, private map data, or
  Vercel/GitHub credentials here.
- Keep production Soul and proof readiness false until their exact integration
  suites and release gates pass.
- Verify every ID against the named Sui network and transaction before merging.
- A testnet deployment is not a mainnet release or an audit claim.
