# Infinite Stellar Durable Project Memory

This file contains stable facts that should survive individual implementation phases. Current work belongs in `CURRENT.md`; completed detail belongs in the linked handoff, code, tests, specifications, and Git history.

## Product invariants

- Infinite Stellar is a Sui-native, zero-knowledge, fully onchain seasonal strategy game in planning and pre-production.
- A Soul is the persistent actor; an Animacraft Projection is its visual embodiment; a Commander Projection is its seasonal role; a Season Seat controls a temporary Civilization.
- Civilizations, planets, energy, fleets, map advantage, score, and ranked power reset. Soul-linked history and expression may persist without creating ranked advantage.
- Soulidity is the canonical identity/ownership layer. Infinite Stellar validates the live Soul owner and ownership epoch but does not take Soul custody.
- Infinite Flow Engine may host a separate Soul-bound prologue or PvE Scene with independent history; it is neither the guest tutorial nor the asynchronous multiplayer universe authority.
- Private coordinates and map secrets remain local. Outcome-changing rules and settlement are authoritative on Sui.
- The initial release has no fungible token, land sale, yield loop, or paid ranked power.

## Brand and repository

- The canonical working product name is Infinite Stellar and the repository slug is `infinite-stellar`.
- “Infinite” means one Soul can cross many finite seasonal worlds; each world remains bounded.
- The product is built on Sui and has no affiliation with the Stellar network or Stellar Development Foundation.
- Brand expansion beyond this public planning repository—including domains, internet or social accounts, app-store listings, external campaigns, public event promotion, commercial announcements, and release—is blocked until counsel completes clearance and any required prior written consent is obtained; another rename may be required.
- Public repository content and project operations use English.
- Original repository content is MIT licensed; third-party assets and dependencies require their own provenance.

## Working-memory contract

- `docs/codex/CURRENT.md` is the continuation entry point.
- Read only the handoff named there when resuming work.
- Do not describe a planned integration or undeployed package as shipped.
- Do not commit, push, publish, deploy, or write onchain without explicit authorization for that phase.
