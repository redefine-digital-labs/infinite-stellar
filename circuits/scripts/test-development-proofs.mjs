import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { groth16 } from 'snarkjs';

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
  } else {
    await expectWitnessRejection(
      'out-of-range route',
      { ...input, max_distance: '197' },
      circuit,
    );
  }
}

// ffjavascript owns worker threads that are useful for proving but otherwise
// keep one-shot CI processes alive after all awaited work has completed.
process.exit(0);
