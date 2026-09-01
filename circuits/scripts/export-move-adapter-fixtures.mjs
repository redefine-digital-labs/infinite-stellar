import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { groth16 } from 'snarkjs';
import { createCircuitConfigDigest } from '../../packages/prover/dist/proof-intent.js';
import { serializeSnarkjsGroth16ForSui } from '../../packages/prover/dist/sui-groth16.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const build = resolve(root, 'circuits/build/dev');
const fixtures = resolve(root, 'circuits/fixtures');
const output = resolve(root, 'packages/prover/test/fixtures/proof-actions-development.json');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest();
}

function hex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function fromHex(value) {
  return Uint8Array.from(Buffer.from(value, 'hex'));
}

async function buildFixture(circuit, actionKind) {
  const input = JSON.parse(await readFile(
    resolve(fixtures, `${circuit}.move_adapter.input.json`),
    'utf8',
  ));
  const verificationKey = JSON.parse(await readFile(
    resolve(build, `${circuit}.verification_key.json`),
    'utf8',
  ));
  const manifestBytes = await readFile(resolve(build, `${circuit}.manifest.json`));
  const manifest = JSON.parse(manifestBytes);
  const provingKeyArtifact = manifest.artifacts.find((artifact) => artifact.role === 'proving-key');
  if (!provingKeyArtifact) throw new Error(`${circuit} manifest has no proving-key artifact.`);
  const { proof, publicSignals } = await groth16.fullProve(
    input,
    resolve(build, `${circuit}_js/${circuit}.wasm`),
    resolve(build, `${circuit}_development.zkey`),
  );
  if (!await groth16.verify(verificationKey, publicSignals, proof)) {
    throw new Error(`${circuit} development proof did not self-verify.`);
  }
  const serialized = await serializeSnarkjsGroth16ForSui(
    proof,
    verificationKey,
    publicSignals,
  );
  const circuitSourceDigest = fromHex(manifest.source.circuitSourceSha256);
  const provingKeyDigest = fromHex(provingKeyArtifact.sha256);
  const ceremonyTranscriptDigest = sha256(
    Buffer.from('INFINITE_STELLAR_DEVELOPMENT_CEREMONY_PLACEHOLDER_V1'),
  );
  const artifactManifestDigest = sha256(manifestBytes);
  const config = createCircuitConfigDigest({
    actionKind,
    circuitSourceDigest,
    provingKeyDigest,
    ceremonyTranscriptDigest,
    artifactManifestDigest,
    verifyingKeyBytes: serialized.verifyingKey,
  });
  return {
    actionKind,
    publicSignals,
    proofBytesHex: hex(serialized.proofPoints),
    publicInputBytesHex: hex(serialized.publicInputs),
    verifyingKeyBytesHex: hex(serialized.verifyingKey),
    circuitConfig: {
      circuitSourceDigestHex: hex(circuitSourceDigest),
      provingKeyDigestHex: hex(provingKeyDigest),
      verifyingKeyDigestHex: hex(config.verifyingKeyDigest),
      ceremonyTranscriptDigestHex: hex(ceremonyTranscriptDigest),
      artifactManifestDigestHex: hex(artifactManifestDigest),
      configDigestHex: hex(config.configDigest),
      productionApproved: false,
    },
  };
}

const fixture = {
  schemaVersion: 1,
  status: 'development-only-never-production',
  txContextHint: 800,
  sender: '0xa11ce',
  seasonId: '0xaa6c0d93139bf53665db0a89b79e6ef5d6d109f26cf497145acfb07d5fdf1d23',
  seatId: '0xca496bc8c86ec7a792681f16f93afb7ee0411f8e4a79ed04fd81e652b5293568',
  deadlineMs: '1800000000000',
  claimHome: await buildFixture('claim_home_v1', 'claim_home'),
  move: await buildFixture('move_v1', 'move'),
  moveNew: await buildFixture('move_new_v1', 'move_new'),
};

await writeFile(output, `${JSON.stringify(fixture, null, 2)}\n`);
console.log(`Wrote DEVELOPMENT-ONLY Move adapter fixtures to ${output}.`);

// ffjavascript may retain proof worker threads after all writes complete.
process.exit(0);
