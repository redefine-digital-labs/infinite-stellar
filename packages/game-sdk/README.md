# Infinite Stellar Game SDK

Typed client boundary for Infinite Stellar. It contains the pure player journey, deterministic demo fixtures, controller-scoped persistence, existing-Seat-first route resolver, and Sui transaction gateway seam.

Production enrollment and home-claim builders fail closed until the Soulidity adapter and proof verifier are pinned. Public keeper builders also require a complete deployment configuration.

From the repository root:

```bash
npm run typecheck --workspace @infinite-stellar/game-sdk
npm run test --workspace @infinite-stellar/game-sdk
npm run build --workspace @infinite-stellar/game-sdk
```
