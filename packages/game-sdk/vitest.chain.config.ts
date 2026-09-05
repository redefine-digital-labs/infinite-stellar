import { defineConfig } from 'vitest/config';

// Explicit read-only mainnet integration, excluded from offline unit/circuit suites.
export default defineConfig({ test: { environment: 'node', include: ['test/**/*.chain.ts'], testTimeout: 30_000 } });
