import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { groth16 } from 'snarkjs';
import { WitnessCalculatorBuilder } from 'circom_runtime';
import {
  round5Perlin,
  ROUND5_BIOMEBASE_KEY,
  ROUND5_SPACE_TYPE_KEY,
} from '../../packages/game-sdk/src/round5-universe.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'circuits/build/dev');
const fixtures = resolve(root, 'circuits/fixtures');
const expected = JSON.parse(await readFile(resolve(fixtures, 'expected-public-signals.json'), 'utf8'));

async function expectWitnessRejection(label, input, circuit) {
  try {
    await groth16.fullProve(
      input,
      resolve(out, `${circuit}_js/${circuit}.wasm`),
      resolve(out, `${circuit}_development.zkey`),
    );
  } catch {
    console.log(`${circuit}: rejected ${label} witness.`);
    return;
  }
  throw new Error(`${circuit} accepted ${label} witness.`);
}

const perlinWasm = await readFile(resolve(
  out,
  'round5_perlin_test_js/round5_perlin_test.wasm',
));
const perlinCalculator = await WitnessCalculatorBuilder(perlinWasm);
for (const coordinates of [
  { x: 0, y: 0 },
  { x: 1, y: 2 },
  { x: -17, y: 42 },
  { x: 1234, y: -5678 },
]) {
  for (const key of [ROUND5_SPACE_TYPE_KEY, ROUND5_BIOMEBASE_KEY]) {
    for (const mirrors of [
      { mirrorX: false, mirrorY: false },
      { mirrorX: true, mirrorY: false },
      { mirrorX: false, mirrorY: true },
    ]) {
      const witness = await perlinCalculator.calculateWitness({
        x_magnitude: Math.abs(coordinates.x).toString(),
        x_sign: coordinates.x < 0 ? '1' : '0',
        y_magnitude: Math.abs(coordinates.y).toString(),
        y_sign: coordinates.y < 0 ? '1' : '0',
        key: key.toString(),
        scale: '16384',
        mirror_x: mirrors.mirrorX ? '1' : '0',
        mirror_y: mirrors.mirrorY ? '1' : '0',
      }, true);
      const expectedPerlin = round5Perlin(coordinates, { key, ...mirrors });
      if (BigInt(witness[1]) !== BigInt(expectedPerlin)) {
        throw new Error(`Perlin differential mismatch at ${coordinates.x},${coordinates.y}.`);
      }
    }
  }
}
console.log('round5_perlin_test: Circom matches 24 TypeScript signed/mirrored vectors.');

for (const circuit of ['claim_home_v1', 'move_v1']) {
  const input = JSON.parse(await readFile(resolve(fixtures, `${circuit}.input.json`), 'utf8'));
  const verificationKey = JSON.parse(
    await readFile(resolve(out, `${circuit}.verification_key.json`), 'utf8'),
  );
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    resolve(out, `${circuit}_js/${circuit}.wasm`),
    resolve(out, `${circuit}_development.zkey`),
  );
  const wanted = expected[circuit];
  if (JSON.stringify(publicSignals) !== JSON.stringify(wanted)) {
    throw new Error(`${circuit} public-signal order or values differ from TypeScript.`);
  }
  if (!await groth16.verify(verificationKey, publicSignals, proof)) {
    throw new Error(`${circuit} valid development proof failed verification.`);
  }
  const mutated = [...publicSignals];
  mutated[2] = (BigInt(mutated[2]) + 1n).toString();
  if (await groth16.verify(verificationKey, mutated, proof)) {
    throw new Error(`${circuit} accepted a mutated action commitment.`);
  }
  await Promise.all([
    writeFile(resolve(out, `${circuit}.proof.json`), JSON.stringify(proof, null, 2) + '\n'),
    writeFile(resolve(out, `${circuit}.public.json`), JSON.stringify(publicSignals, null, 2) + '\n'),
  ]);
  console.log(`${circuit}: valid proof accepted; mutated action commitment rejected.`);

  if (circuit === 'claim_home_v1') {
    await expectWitnessRejection(
      'wrong coordinate preimage',
      { ...input, x_magnitude: (BigInt(input.x_magnitude) + 1n).toString() },
      circuit,
    );
    await expectWitnessRejection(
      'negative zero coordinate',
      { ...input, x_magnitude: '0', x_sign: '1' },
      circuit,
    );
    const nonHome = JSON.parse(
      await readFile(resolve(fixtures, 'claim_home_v1.non_home.input.json'), 'utf8'),
    );
    await expectWitnessRejection('valid planet outside the home Perlin band', nonHome, circuit);
    await expectWitnessRejection(
      'geometry parameter inconsistent with the public commitment',
      { ...input, world_radius: '12001' },
      circuit,
    );
    await expectWitnessRejection(
      'non-power-of-two Perlin scale',
      { ...input, perlin_scale: '12000' },
      circuit,
    );
  } else {
    await expectWitnessRejection(
      'out-of-range route',
      { ...input, max_distance: '197' },
      circuit,
    );
    await expectWitnessRejection(
      'rarity threshold inconsistent with the public commitment',
      { ...input, planet_hash_threshold: (BigInt(input.planet_hash_threshold) + 1n).toString() },
      circuit,
    );
  }
}

// ffjavascript owns worker threads that are useful for proving but otherwise
// keep one-shot CI processes alive after all awaited work has completed.
process.exit(0);
