import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';
import { randomUUID } from 'node:crypto';

export default defineConfig(({ command }) => ({
  // Every production build is a fresh local playtest. Refreshes of that build retain progress.
  define: {
    __LOCAL_DEMO_RELEASE__: JSON.stringify(command === 'build' ? `playtest-${randomUUID()}` : 'development'),
  },
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@infinite-stellar/game-sdk', '@infinite-stellar/prover'],
  },
  server: {
    port: 4173,
  },
  preview: {
    port: 4174,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'sui-wallet', test: /node_modules\/@mysten/ },
            { name: 'react-runtime', test: /node_modules\/(react|react-dom|scheduler)/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: true,
  },
}));
