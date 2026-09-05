import type { SuiProofSubmission } from '@infinite-stellar/prover';
import {
  buildPreparedRankedActionTransaction, prepareRankedAction,
  type PreparedRankedAction, type RankedActionContext, type RankedActionRequest,
} from './ranked-actions';

export type RankedProofPhase = 'reading' | 'proving' | 'revalidating';

export interface RankedProofDependencies {
  /** Must perform fresh authoritative reads on EVERY invocation, including current time. */
  readContext: () => Promise<RankedActionContext>;
  /** Local-only computation. Never upload, journal, log or persist the private witness. */
  prove: (action: PreparedRankedAction, context: RankedActionContext) => Promise<SuiProofSubmission>;
  signal?: AbortSignal;
  onPhase?: (phase: RankedProofPhase) => void;
}

/** Prepare an unsigned proof-backed transaction. Simulation, explicit wallet approval,
 * finality and settlement are separate mandatory steps; this never submits a write.
 * The caller must cancel on wallet/Season/navigation changes.
 */
export async function proveRankedAction(request: RankedActionRequest, dependencies: RankedProofDependencies) {
  const { readContext, prove, signal, onPhase } = dependencies;
  // Fleet amounts are live transaction arguments, not proof public signals. Snapshot
  // them too so edits made while proving cannot silently change the requested fleet.
  const intent = { ...request };
  const phase = (value: RankedProofPhase) => { signal?.throwIfAborted(); onPhase?.(value); };
  phase('reading');
  const initialContext = await readContext();
  signal?.throwIfAborted();
  const initial = prepareRankedAction(initialContext, intent);
  // Retain immutable public pins independently of the prover/caller's mutable objects.
  const initialDigest = initial.publicInputDigest;
  const initialCircuit = JSON.stringify(initial.circuit);
  const initialDeployment = JSON.stringify(initialContext.deployment);
  const initialDeadline = initialContext.deadlineMs;
  phase('proving');
  const proof = await prove(initial, initialContext);
  phase('revalidating');
  const latest = await readContext();
  signal?.throwIfAborted();
  // Refresh the clock and objects, never renew an existing proof's deadline.
  const fresh = prepareRankedAction({ ...latest, deadlineMs: initialDeadline }, intent);
  if (fresh.publicInputDigest !== initialDigest || JSON.stringify(fresh.circuit) !== initialCircuit ||
    JSON.stringify(latest.deployment) !== initialDeployment) {
    throw new Error('The action changed during proving. Refresh the map and generate a new proof.');
  }
  const transaction = buildPreparedRankedActionTransaction(latest.deployment, fresh, proof);
  signal?.throwIfAborted();
  // No coordinates, witness or stale local ownership leave this boundary.
  return { transaction, expectation: fresh.expectation, publicInputDigest: fresh.publicInputDigest };
}
