import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vitest/config';
import { randomUUID } from 'node:crypto';
import vercelConfig from '../../vercel.json' with { type: 'json' };

export default defineConfig(({ command }) => ({
  // Every production build is a fresh local playtest. Refreshes of that build retain progress.
  define: {
    __LOCAL_DEMO_RELEASE__: JSON.stringify(command === 'build' ? `playtest-${randomUUID()}` : 'development'),
  },
  plugins: [react(), {
    name: 'development-proof-key-media-type',
    apply: 'serve',
    configureServer(server) {
      // The integrity loader rejects untyped zkeys. Vite's MIME table does not
      // recognize this extension; set the correct type without widening FS access.
      server.middlewares.use((request, response, next) => {
        if (request.url?.split('?', 1)[0]?.endsWith('_development.zkey')) {
          response.setHeader('Content-Type', 'application/octet-stream');
        }
        next();
      });
    },
  }],
  optimizeDeps: {
    exclude: ['@infinite-stellar/game-sdk', '@infinite-stellar/prover'],
  },
  server: {
    port: 4173,
    // Opt-in proof QA uses the exact deployed CSP, including on Worker scripts.
    headers: process.env.INFINITE_STELLAR_PROOF_CSP_QA === '1'
      ? Object.fromEntries(vercelConfig.headers.flatMap((entry) => entry.headers)
        .filter((header) => header.key === 'Content-Security-Policy').map(({ key, value }) => [key, value]))
      : undefined,
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
