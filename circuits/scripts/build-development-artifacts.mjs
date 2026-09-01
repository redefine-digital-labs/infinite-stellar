import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'circuits/build/dev');
const circom = process.env.CIRCOM_BIN ?? 'circom';
const snarkjs = resolve(root, 'node_modules/.bin/snarkjs');
const circuits = ['claim_home_v1', 'move_v1', 'move_new_v1'];
const testCircuits = ['round5_perlin_test'];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}.`);
}

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}.`);
  return result.stdout.trim();
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function circuitSourceDigest() {
  const paths = [
    'circuits/src/claim_home_v1.circom',
    'circuits/src/move_v1.circom',
    'circuits/src/move_new_v1.circom',
    'circuits/src/lib/action_intent_v1.circom',
    'circuits/src/lib/round5_location.circom',
    'circuits/src/lib/round5_perlin.circom',
    'circuits/src/lib/rules_geometry_v1.circom',
    'circuits/src/lib/signed_coordinate.circom',
  ];
  const hash = createHash('sha256');
  for (const path of paths.sort()) {
    hash.update(path);
    hash.update('\0');
    hash.update(await readFile(resolve(root, path)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function requireCircomVersion() {
  const result = spawnSync(circom, ['--version'], { cwd: root, encoding: 'utf8' });
  if (result.error) throw new Error('Circom v2.2.3 is required. Set CIRCOM_BIN to the pinned binary.');
  if (result.status !== 0 || !result.stdout.includes('2.2.3')) {
    throw new Error(`Expected Circom v2.2.3, received: ${(result.stdout || result.stderr).trim()}`);
  }
}

await mkdir(out, { recursive: true });
requireCircomVersion();
run(process.execPath, ['--experimental-strip-types', 'circuits/scripts/create-fixtures.mjs']);

for (const circuit of circuits) {
  run(circom, [
    `circuits/src/${circuit}.circom`,
    '--r1cs', '--wasm', '--sym', '--O2', '--inspect',
    '-l', 'node_modules', '-o', 'circuits/build/dev',
  ]);
}

for (const circuit of testCircuits) {
  run(circom, [
    `circuits/src/test/${circuit}.circom`,
    '--wasm', '--O2', '--inspect',
    '-l', 'node_modules', '-o', 'circuits/build/dev',
  ]);
}

const potInitial = resolve(out, 'powersOfTau14_0000.ptau');
const potContribution = resolve(out, 'powersOfTau14_0001.ptau');
const potFinal = resolve(out, 'powersOfTau14_final.ptau');
if (!existsSync(potFinal)) {
  run(snarkjs, ['powersoftau', 'new', 'bn128', '14', potInitial, '-v']);
  run(snarkjs, [
    'powersoftau', 'contribute', potInitial, potContribution,
    '--name=Infinite Stellar deterministic development contribution',
    '--entropy=INFINITE_STELLAR_DEVELOPMENT_ONLY_NEVER_PRODUCTION_V1',
  ]);
  run(snarkjs, ['powersoftau', 'prepare', 'phase2', potContribution, potFinal, '-v']);
}

for (const circuit of circuits) {
  const r1cs = resolve(out, `${circuit}.r1cs`);
  const initial = resolve(out, `${circuit}_0000.zkey`);
  const final = resolve(out, `${circuit}_development.zkey`);
  const verificationKey = resolve(out, `${circuit}.verification_key.json`);
  run(snarkjs, ['groth16', 'setup', r1cs, potFinal, initial]);
  run(snarkjs, [
    'zkey', 'contribute', initial, final,
    '--name=Infinite Stellar deterministic development phase 2',
    '--entropy=INFINITE_STELLAR_DEVELOPMENT_ONLY_NEVER_PRODUCTION_V1',
  ]);
  run(snarkjs, ['zkey', 'verify', r1cs, potFinal, final]);
  run(snarkjs, ['zkey', 'export', 'verificationkey', final, verificationKey]);
}

const sourceDigest = await circuitSourceDigest();
const sourceCommit = capture('git', ['rev-parse', 'HEAD']);
let repository = capture('git', ['config', '--get', 'remote.origin.url']);
repository = repository
  .replace(/^git@github.com:/, 'https://github.com/')
  .replace(/\.git$/, '');

for (const circuit of circuits) {
  const browserWasm = resolve(out, `${circuit}.wasm`);
  await copyFile(resolve(out, `${circuit}_js/${circuit}.wasm`), browserWasm);
  const descriptors = [
    ['circuit-wasm', browserWasm, `./${circuit}.wasm`, 'application/wasm'],
    ['proving-key', resolve(out, `${circuit}_development.zkey`), `./${circuit}_development.zkey`, 'application/octet-stream'],
    ['verification-key', resolve(out, `${circuit}.verification_key.json`), `./${circuit}.verification_key.json`, 'application/json'],
  ];
  const artifacts = [];
  for (const [role, path, url, mediaType] of descriptors) {
    const bytes = await readFile(path);
    artifacts.push({ role, url, sha256: sha256(bytes), bytes: (await stat(path)).size, mediaType });
  }
  const circuitId = circuit === 'claim_home_v1'
    ? 'round5-claim-home-development-candidate'
    : circuit === 'move_v1'
      ? 'round5-move-development-candidate'
      : 'round5-move-new-development-candidate';
  const publicSignals = circuit === 'move_new_v1'
    ? [
        'source_location_hash',
        'destination_location_hash',
        'destination_space_perlin',
        'action_commitment',
        'rules_geometry_commitment',
      ]
    : [
        'source_location_hash',
        'destination_location_hash',
        'action_commitment',
        'rules_geometry_commitment',
      ];
  const manifest = {
    schemaVersion: 1,
    status: 'development',
    network: 'sui:mainnet',
    rulesetId: 'dark-forest-v06-round5',
    circuitId,
    circuitVersion: 1,
    curve: 'bn254',
    publicSignals,
    source: {
      repository,
      commit: sourceCommit,
      circuitSourceSha256: sourceDigest,
      buildImage: 'uncontainerized-development:circom-2.2.3+snarkjs-0.7.6',
    },
    trustedSetup: { kind: 'development' },
    artifacts,
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(resolve(out, `${circuit}.manifest.json`), manifestBytes);
  await writeFile(resolve(out, `${circuit}.manifest.sha256`), `${sha256(manifestBytes)}\n`);
}

console.log('Built DEVELOPMENT-ONLY Groth16 artifacts. They are forbidden in production.');
