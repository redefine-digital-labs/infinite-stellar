import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUND5_RULES_GEOMETRY, createRulesGeometryCommitment } from '@infinite-stellar/prover';
import { ROUND5_MINER_PROTOCOL_VERSION, type Round5MinerMessage, type Round5MinerRequest } from '@infinite-stellar/game-sdk';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function workerHarness() {
  const messages: Round5MinerMessage[] = [];
  let receive!: (event: MessageEvent<Round5MinerRequest>) => void;
  vi.stubGlobal('self', {
    postMessage: (message: Round5MinerMessage) => messages.push(message),
    addEventListener: (_type: string, callback: typeof receive) => { receive = callback; },
  });
  await import('./miner.worker');
  return { messages, send: (request: Round5MinerRequest) => receive({ data: request } as MessageEvent<Round5MinerRequest>) };
}

describe('local mining Worker', () => {
  it('uses committed ranked geometry and emits exact bounded progress', async () => {
    const worker = await workerHarness();
    worker.send({ type: 'start', version: ROUND5_MINER_PROTOCOL_VERSION, requestId: 'ranked',
      chunks: [{ index: 0, x: 73, y: 6421, side: 1 }], progressEvery: 1,
      rankedGeometry: { ...ROUND5_RULES_GEOMETRY, rulesGeometryCommitment: createRulesGeometryCommitment(ROUND5_RULES_GEOMETRY) },
    });
    await vi.waitFor(() => expect(worker.messages.at(-1)?.type).toBe('complete'));
    expect(worker.messages).toMatchObject([
      { type: 'progress', checked: 1, total: 1, locations: [{ x: 73, y: 6421, perlin: 13 }] },
      { type: 'complete', checked: 1, total: 1, locations: [{ x: 73, y: 6421, perlin: 13 }] },
    ]);
  });

  it('reports malformed workload and mismatched commitment instead of falling back to demo mining', async () => {
    const worker = await workerHarness();
    worker.send({ type: 'start', version: ROUND5_MINER_PROTOCOL_VERSION, requestId: 'bad-chunk',
      chunks: [{ index: 0, x: Number.MAX_SAFE_INTEGER, y: 0, side: 1 }], progressEvery: 1 });
    worker.send({ type: 'start', version: ROUND5_MINER_PROTOCOL_VERSION, requestId: 'bad-geometry',
      chunks: [{ index: 0, x: 73, y: 6421, side: 1 }], progressEvery: 1,
      rankedGeometry: { ...ROUND5_RULES_GEOMETRY, rulesGeometryCommitment: 1n } });
    expect(worker.messages).toHaveLength(2);
    expect(worker.messages.every((message) => message.type === 'error')).toBe(true);
  });

  it('observes cancellation at a yielded progress boundary', async () => {
    const worker = await workerHarness();
    worker.send({ type: 'start', version: ROUND5_MINER_PROTOCOL_VERSION, requestId: 'cancel-me',
      chunks: [{ index: 0, x: 73, y: 6421, side: 2 }], progressEvery: 1 });
    worker.send({ type: 'cancel', version: ROUND5_MINER_PROTOCOL_VERSION, requestId: 'cancel-me' });
    await vi.waitFor(() => expect(worker.messages.at(-1)?.type).toBe('cancelled'));
    expect(worker.messages.some((message) => message.type === 'complete')).toBe(false);
  });
});
