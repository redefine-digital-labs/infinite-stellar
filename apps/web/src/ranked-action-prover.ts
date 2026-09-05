import {
  proveRankedAction, type RankedActionRequest, type RankedProofDependencies,
} from '@infinite-stellar/game-sdk';
import type { ProofArtifactSelection, ProofPublicSignalName } from '@infinite-stellar/prover';
import { ProverWorkerClient } from './prover-client';

export interface RankedActionProverOptions extends Omit<RankedProofDependencies, 'prove'> {
  /** URLs come from release configuration; all identity/hash pins come from the Season. */
  manifestUrls: Partial<Record<'claim_home' | 'move' | 'move_new', string>>;
}

/** One isolated Worker per action. Only verified artifact GETs leave this Worker;
 * private coordinates stay on this device. Cancellation terminates computation.
 */
export async function prepareRankedActionWithWorker(
  request: RankedActionRequest,
  options: RankedActionProverOptions,
  createClient: () => ProverWorkerClient = () => new ProverWorkerClient(),
) {
  let client: ProverWorkerClient | undefined;
  const abort = () => client?.destroy();
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    return await proveRankedAction(request, {
      ...options,
      prove: async (action, context) => {
        options.signal?.throwIfAborted();
        const manifestUrl = options.manifestUrls[action.transaction.kind];
        if (!manifestUrl) throw new Error('This action has no pinned production artifact URL.');
        const selection: ProofArtifactSelection = {
          manifestUrl, manifestSha256: action.circuit.artifactManifestSha256, mode: 'production',
          expectedNetwork: context.deployment.proofIntent!.network,
          expectedRulesetId: context.deployment.proofIntent!.rulesetId,
          expectedCircuitId: action.circuit.circuitId,
          expectedCircuitVersion: action.circuit.circuitVersion,
          expectedPublicSignals: action.publicSignalOrder as readonly ProofPublicSignalName[],
        };
        client = createClient();
        await client.preflight(selection).result;
        options.signal?.throwIfAborted();
        return await client.prove(action.circuit.artifactManifestSha256,
          action.privateWitness, action.publicSignals).result;
      },
    });
  } catch (error) {
    options.signal?.throwIfAborted();
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abort);
    client?.destroy();
  }
}
