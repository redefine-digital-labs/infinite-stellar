import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  generateAndVerifyGroth16Proof, loadProofArtifacts, prepareSuiProofSubmission,
  type ProofArtifactManifestV1, type ProofArtifactSelection,
} from '@infinite-stellar/prover';
import { prepareRankedAction, proveRankedAction, type RankedActionRequest } from '../src';
import { rankedActionFixture } from './ranked-action-fixtures';

const directory = new URL('../../../circuits/build/dev/', import.meta.url);
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('real SDK witness → development Circom → Groth16 → Sui transaction', () => {
  it.each(['home', 'move', 'move_new'] as const)('proves %s and rejects mutated witness/statement', async (mode) => {
    const circuit = mode === 'home' ? 'claim_home_v1' : `${mode}_v1`;
    const manifestBytes = await readFile(new URL(`${circuit}.manifest.json`, directory));
    const manifest = JSON.parse(manifestBytes.toString()) as ProofArtifactManifestV1;
    expect(manifest.status).toBe('development');
    const selection: ProofArtifactSelection = {
      manifestUrl: `http://localhost/${circuit}.manifest.json`, manifestSha256: digest(manifestBytes),
      mode: 'development', expectedNetwork: manifest.network, expectedRulesetId: manifest.rulesetId,
      expectedCircuitId: manifest.circuitId, expectedCircuitVersion: manifest.circuitVersion,
      expectedPublicSignals: manifest.publicSignals,
    };
    // Read only pinned local files through the real integrity/media-type loader. No RPC/HTTP.
    const fetcher = async (url: string) => {
      const name = new URL(url).pathname.slice(1);
      const descriptor = manifest.artifacts.find((entry) => entry.url === `./${name}`);
      if (name !== `${circuit}.manifest.json` && !descriptor) throw new Error('Unpinned artifact path.');
      const bytes = await readFile(new URL(name, directory));
      return { ok: true, status: 200, headers: { get: () => descriptor?.mediaType ?? 'application/json' },
        arrayBuffer: async () => Uint8Array.from(bytes).buffer };
    };
    await expect(loadProofArtifacts({ ...selection, mode: 'production',
      manifestUrl: `https://localhost/${circuit}.manifest.json` }, fetcher))
      .rejects.toMatchObject({ code: 'DEVELOPMENT_SETUP_REJECTED' });
    const loaded = await loadProofArtifacts(selection, fetcher);
    const context = rankedActionFixture(mode);
    const config = mode === 'home' ? context.deployment.claimHomeCircuitConfig!
      : mode === 'move' ? context.deployment.moveCircuitConfig! : context.deployment.moveNewCircuitConfig!;
    // Synthetic offline fixture, not release evidence. Pin the actual dev artifacts,
    // retaining synthetic deployment IDs/approvals; no gate is changed in runtime code.
    config.circuitId = manifest.circuitId;
    config.artifactManifestSha256 = loaded.manifestSha256;
    const request: RankedActionRequest = mode === 'home'
      ? { kind: 'claim_home', destinationLocationId: context.record.locations[0]!.locationId }
      : { kind: 'move', sourceLocationId: context.record.locations[0]!.locationId,
        destinationLocationId: context.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n };
    const action = prepareRankedAction(context, request);
    const start = performance.now();
    const generated = await generateAndVerifyGroth16Proof(loaded, action.privateWitness);
    const submission = await prepareSuiProofSubmission(loaded, generated, action.publicSignals);
    expect(submission.publicInputDigest).toBe(action.publicInputDigest);
    expect(submission.proofBytes).toHaveLength(128);
    expect(submission.publicInputs).toHaveLength(mode === 'move_new' ? 160 : 128);
    config.verifyingKeyDigest = submission.verifyingKeyDigest;
    const binding = mode === 'home' ? context.projection.manifest.claimHomeCircuit
      : mode === 'move' ? context.projection.manifest.moveCircuit : context.projection.manifest.moveNewCircuit;
    binding.verifyingKeyDigest = submission.verifyingKeyDigest;
    let reads = 0;
    const result = await proveRankedAction(request, {
      readContext: async () => { reads++; return context; },
      prove: async (prepared) => {
        expect(prepared.privateWitness).toEqual(action.privateWitness);
        return submission;
      },
    });
    expect(reads).toBe(2);
    expect(result.transaction.getData().commands[0]?.MoveCall?.function)
      .toBe(mode === 'home' ? 'claim_home' : `dispatch_${mode}`);
    const altered = [...action.publicSignals];
    altered[mode === 'move_new' ? 3 : 2] = '1';
    await expect(prepareSuiProofSubmission(loaded, generated, altered))
      .rejects.toMatchObject({ code: 'PUBLIC_SIGNAL_MISMATCH' });
    const coordinate = mode === 'home' ? 'x_magnitude' : 'destination_x_magnitude';
    await expect(generateAndVerifyGroth16Proof(loaded, { ...action.privateWitness,
      [coordinate]: (BigInt(action.privateWitness[coordinate]!) + 1n).toString() })).rejects.toThrow();
    console.info(`${circuit}: real proof and unsigned transaction passed in ${Math.round(performance.now() - start)}ms; tampering rejected.`);
  });
});
