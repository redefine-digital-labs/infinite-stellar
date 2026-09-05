import { SuiGrpcClient } from '@mysten/sui/grpc';
import { expect, it } from 'vitest';
import { readSuiActionClock } from '../src';
import soulidityPin from '../../../config/soulidity-mainnet-v1.json';

it('reads the canonical Clock from the actual pinned mainnet chain without signing', async () => {
  const client = new SuiGrpcClient({ network: 'mainnet', baseUrl: 'https://fullnode.mainnet.sui.io:443' });
  expect((await client.getChainIdentifier()).chainIdentifier).toBe(soulidityPin.chainIdentifier);
  const first = await readSuiActionClock(client);
  const second = await readSuiActionClock(client);
  expect(first).toBeGreaterThan(0n);
  expect(second).toBeGreaterThanOrEqual(first);
  expect(Math.abs(Number(second) - Date.now())).toBeLessThan(300_000);
  console.info(`Canonical mainnet Clock: ${first} -> ${second} ms; read-only.`);
});
