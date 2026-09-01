import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const packageDirectory = new URL('../move/infinite_stellar/', import.meta.url);

const { stdout: activeEnvironment } = await execFile('sui', [
  'client',
  'active-env',
]);

if (activeEnvironment.trim() !== 'mainnet') {
  throw new Error('Refusing to simulate a release unless the Sui CLI active environment is mainnet.');
}

const { stdout } = await execFile('sui', [
  'client',
  'publish',
  '--dry-run',
  '--json',
  '--warnings-are-errors',
  '.',
], {
  cwd: packageDirectory,
  maxBuffer: 20 * 1024 * 1024,
});

const result = JSON.parse(stdout);
if (result.effects?.status?.status !== 'success') {
  throw new Error(`Sui mainnet publish dry-run failed: ${result.effects?.status?.error ?? 'unknown error'}`);
}

const published = result.objectChanges?.find((change) => change.type === 'published');
if (!published || published.modules?.length !== 15) {
  throw new Error('Dry-run did not publish the expected 15-module Infinite Stellar package.');
}

const computationCost = BigInt(result.effects.gasUsed.computationCost);
const storageCost = BigInt(result.effects.gasUsed.storageCost);
const storageRebate = BigInt(result.effects.gasUsed.storageRebate);
const nonRefundableStorageFee = BigInt(result.effects.gasUsed.nonRefundableStorageFee);
const netGasMist = computationCost + storageCost - storageRebate + nonRefundableStorageFee;

process.stdout.write(`${JSON.stringify({
  status: 'verified',
  network: 'mainnet',
  operation: 'publish-dry-run',
  packageId: published.packageId,
  packageDigest: published.digest,
  moduleCount: published.modules.length,
  modules: published.modules,
  netGasMist: netGasMist.toString(),
}, null, 2)}\n`);
