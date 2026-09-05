# Portable Private Map Backup

## Scope and authority

The ranked map's Backup & recovery panel exports and restores private
discoveries for a configured controller Seat. It does not export wallet keys,
Soul custody, Planet ownership, resources, score, nonces or pending transactions.
Those remain Sui state. No new ranked signing gate is opened by this feature.
The local demo uses its separate device vault; this portable format is for
ranked private-map records, not for moving a demo civilization onto Sui.

## Player flow

1. Pause the explorer. Open Backup & recovery in the ranked status panel.
2. Enter and confirm a separate backup passphrase of at least 16 characters.
   Prefer several random words; never use a wallet recovery phrase. Download
   the encrypted JSON file and keep its passphrase separately.
3. On another device, connect the same controller on the same chain and Season
   Seat. Select the backup file, enter its passphrase and choose Restore and
   merge backup. A lost backup passphrase cannot be reset.
4. Recovery authenticates the file, verifies location preimages against the
   committed Season geometry locally, point-reads deterministic public Planet
   objects, then merges the discoveries into the device vault.

Existing discoveries and completed empty search chunks are preserved. The
explorer resumes from its saved origin without repeating complete footprints.
A changed controller, Seat, chain or Season is not a supported recovery target;
Soul transfers do not transfer the controller's private map.

## Format v1 and failure behavior

- AES-256-GCM with a 128-bit authentication tag and fresh 12-byte IV.
- PBKDF2-HMAC-SHA-256 with 600,000 iterations and fresh 32-byte salt. The file
  cannot select weaker parameters or an unbounded derivation cost.
- Authenticated context binds the format and exact chain, callable/type-origin
  packages, Season, registry, Seat and controller namespace. Identity and map
  contents are encrypted; only cryptographic format metadata is outside.
- The portable envelope is bounded to 6 MiB; plaintext is bounded to 4 MiB.
  Imports also respect the current 5,000-location public projection bound.
  Larger maps reject explicitly; they are never silently truncated.
- Wrong passwords, altered ciphertext, mismatched identity, malformed coverage,
  invalid location preimages, missing founding-Planet bindings and failed public
  reads reject before saving the candidate. Existing encrypted data is retained.
- Explorer work and backup operations cannot run concurrently. Switching the
  active Seat invalidates pending recovery work; late results cannot update the
  new Seat. UI password fields clear after completed or failed processing.
- The browser warns when it cannot provide persistent device storage. Portable
  backups are not uploaded by the app, and private coordinates do not go to RPC.

## Evidence and remaining gates

Tests exercise real Web Crypto round-trips, randomized encryption, wrong
passwords, ciphertext tampering, all namespace substitutions, cryptographic
parameter downgrade attempts, malformed/oversized inputs, UI file limits,
temporary download URL cleanup, late Seat changes and current-chain resource
authority. Restore failures preserve the existing map, including failed RPC
and vault saves. This is implementation verification, not an independent
cryptographic audit or a live two-wallet Season rehearsal.

The files and passphrases remain player-managed. Server backup, public indexing,
operational recovery, independent audits and production release evidence remain
separate requirements in the full delivery plan.
