import { useCallback, useEffect, useRef, useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import type { SuiClientTypes } from '@mysten/sui/client';
import { fromBase64 } from '@mysten/sui/utils';
import {
  assertRankedReleaseDeploymentReady, prepareRankedAction, readRankedActionContext,
  recoverPlayerTransactionByDigest, submitAndFinalizePlayerTransaction,
  rankedPrivateMapStorageKey, PlayerTransactionExecutionError,
  type InfiniteStellarDeployment, type PlayerSuiClient, type RankedActionReadClient,
  type RankedActionRequest, type RankedMapIdentity,
} from '@infinite-stellar/game-sdk';
import { prepareRankedActionWithWorker, type RankedActionProverOptions } from './ranked-action-prover';
import { browserRankedMapVault, type RankedMapVault } from './ranked-map-vault';
import { clearPendingRankedAction, loadPendingRankedAction, rankedActionJournalKey,
  savePendingRankedAction, type RankedJournalStorage, type PendingRankedAction } from './ranked-action-journal';

export type RankedActionStatus = 'idle' | 'reading' | 'proving' | 'revalidating' | 'simulating' |
  'awaiting-signature' | 'submitting' | 'finalizing' | 'recovering' | 'finalized' | 'cancelled' | 'error';
export interface RankedActionState {
  status: RankedActionStatus;
  digest?: string;
  error?: string;
  kind?: 'claim_home' | 'move' | 'move_new';
}

export interface RankedActionsOptions {
  client: PlayerSuiClient & RankedActionReadClient;
  deployment: InfiniteStellarDeployment;
  identity: RankedMapIdentity | null;
  controller?: string;
  network: string;
  writesReady: boolean;
  manifestUrls: RankedActionProverOptions['manifestUrls'];
  buildTransaction: (transaction: Transaction) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction) => Promise<{ bytes: string; signature: string }>;
  executeTransaction: (bytes: Uint8Array, signature: string) => Promise<SuiClientTypes.TransactionResult>;
  onFinalized: () => void;
}

export interface RankedActionsDependencies {
  vault: RankedMapVault;
  storage: () => RankedJournalStorage;
  readContext: typeof readRankedActionContext;
  prepare: typeof prepareRankedActionWithWorker;
  submit: typeof submitAndFinalizePlayerTransaction;
  recover: typeof recoverPlayerTransactionByDigest;
  withLock: <T>(key: string, action: () => Promise<T>) => Promise<T>;
}
const DEPENDENCIES: RankedActionsDependencies = {
  vault: browserRankedMapVault(), storage: () => window.localStorage,
  readContext: readRankedActionContext, prepare: prepareRankedActionWithWorker,
  submit: submitAndFinalizePlayerTransaction, recover: recoverPlayerTransactionByDigest,
  withLock: async (key, action) => {
    if (!navigator.locks) throw new Error('This browser cannot coordinate ranked submissions safely across tabs.');
    return navigator.locks.request(key, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error('Another tab is processing this Seat. Recover or wait for that action first.');
      return action();
    });
  },
};

function scopeKey(options: RankedActionsOptions): string | null {
  return options.identity && options.network === 'mainnet' &&
    options.controller === options.identity.controllerAddress
    ? rankedPrivateMapStorageKey(options.identity) : null;
}

function clearSettledJournal(dependencies: RankedActionsDependencies, identity: RankedMapIdentity, digest: string): string | undefined {
  try { clearPendingRankedAction(dependencies.storage(), identity, digest); }
  catch { return 'Chain outcome verified, but the local recovery journal could not be cleared. Recover again before sending another action.'; }
}

/** Signing is separated from submission: persist the exact digest BEFORE network
 * transmission. Recovery only reads by digest; it never re-signs or resubmits.
 */
export function useRankedActions(options: RankedActionsOptions, dependencies = DEPENDENCIES) {
  const latest = useRef(options);
  latest.current = options;
  const scope = scopeKey(options);
  const [state, setState] = useState<RankedActionState>({ status: 'idle' });
  const active = useRef<AbortController | null>(null);
  const phase = useRef<RankedActionStatus>('idle');
  const running = useRef(false);
  const generation = useRef(0);

  const emit = useCallback((value: RankedActionState) => { phase.current = value.status; setState(value); }, []);
  const cancel = useCallback(() => {
    if (['submitting', 'finalizing', 'recovering'].includes(phase.current)) return;
    if (active.current && !active.current.signal.aborted) {
      active.current.abort();
      emit({ status: 'cancelled' });
    }
  }, [emit]);

  const recover = useCallback(async () => {
    const current = latest.current;
    const key = scopeKey(current);
    if (!key || !current.identity || running.current) return;
    const identity = current.identity;
    const revision = generation.current;
    const sameScope = () => generation.current === revision && scopeKey(latest.current) === key;
    running.current = true;
    try {
      await dependencies.withLock(rankedActionJournalKey(identity), async () => {
        const pending = loadPendingRankedAction(dependencies.storage(), identity);
        if (!pending) { if (sameScope()) emit({ status: 'idle' }); return; }
        if (sameScope()) emit({ status: 'recovering', digest: pending.digest, kind: pending.expectation.kind });
        const chain = await current.client.getChainIdentifier();
        if (chain.chainIdentifier !== identity.chainIdentifier) throw new Error('Recovery RPC belongs to another chain.');
        try {
          const result = await dependencies.recover({ client: current.client, deployment: current.deployment,
            digest: pending.digest, expectation: pending.expectation });
          const cleanupError = clearSettledJournal(dependencies, identity, pending.digest);
          if (sameScope()) {
            emit({ status: cleanupError ? 'error' : 'finalized', digest: result.digest, kind: pending.expectation.kind, error: cleanupError });
            latest.current.onFinalized();
          }
        } catch (error) {
          if (error instanceof PlayerTransactionExecutionError && error.code === 'EXECUTION_FAILED') {
            const cleanupError = clearSettledJournal(dependencies, identity, pending.digest);
            if (sameScope()) emit({ status: 'error', error: cleanupError ?? error.message,
              digest: cleanupError ? pending.digest : undefined });
            return;
          }
          throw error;
        }
      });
    } catch (error) {
      if (sameScope()) setState((previous) => ({ ...previous, status: 'error',
        error: error instanceof Error ? error.message : 'Recovery failed. The pending digest is retained.' }));
    } finally { if (sameScope()) { running.current = false; phase.current = 'idle'; } }
  }, [dependencies, emit]);

  useEffect(() => {
    generation.current++;
    active.current?.abort(); active.current = null; running.current = false;
    emit({ status: 'idle' });
    if (scope) void recover();
    return () => { generation.current++; active.current?.abort(); };
  }, [scope, options.client, options.deployment, dependencies, emit, recover]);

  const submit = useCallback(async (request: RankedActionRequest) => {
    const current = latest.current;
    const key = scopeKey(current);
    if (!key || !current.identity || !current.writesReady || running.current) return;
    const identity = current.identity;
    const deploymentPin = JSON.stringify(current.deployment);
    const intent = { ...request };
    const abort = new AbortController();
    const revision = generation.current;
    const sameScope = () => generation.current === revision && scopeKey(latest.current) === key;
    const ensureCurrent = () => {
      abort.signal.throwIfAborted();
      if (!sameScope() || !latest.current.writesReady || latest.current.deployment !== current.deployment ||
        JSON.stringify(current.deployment) !== deploymentPin) {
        throw new DOMException('The active controller, Season or release changed.', 'AbortError');
      }
      assertRankedReleaseDeploymentReady(current.deployment);
    };
    let pending: PendingRankedAction | undefined;
    running.current = true; active.current = abort;
    try {
      ensureCurrent();
      await dependencies.withLock(rankedActionJournalKey(identity), async () => {
        ensureCurrent();
        const stored = loadPendingRankedAction(dependencies.storage(), identity);
        if (stored) {
          pending = stored;
          throw new Error('A submitted action needs recovery before another transaction can be sent.');
        }
        let deadlineMs: bigint | undefined;
        const readContext = async () => {
          ensureCurrent();
          const record = await dependencies.vault.restore(identity);
          ensureCurrent();
          if (!record || rankedPrivateMapStorageKey(record) !== key) throw new Error('Restore the encrypted private map before preparing this action.');
          const context = await dependencies.readContext(current.client, current.deployment, record, intent,
            { signal: abort.signal, deadlineMs });
          ensureCurrent();
          deadlineMs ??= context.deadlineMs;
          return context;
        };
        const prepared = await dependencies.prepare(intent, { readContext, signal: abort.signal,
          manifestUrls: current.manifestUrls, onPhase: (status) => { if (sameScope()) emit({ status }); } });
        ensureCurrent();
        const checkStatement = async () => {
          const fresh = prepareRankedAction(await readContext(), intent);
          if (fresh.publicInputDigest !== prepared.publicInputDigest) throw new Error('Chain state changed. Prepare a new proof.');
        };
        const result = await dependencies.submit({ client: current.client, deployment: current.deployment,
          transaction: prepared.transaction, expectation: prepared.expectation,
          onPhase: (status) => { if (sameScope() && !abort.signal.aborted) emit({ status, digest: pending?.digest, kind: prepared.expectation.kind === 'enroll' ? undefined : prepared.expectation.kind }); },
          execute: async (transaction) => {
            await checkStatement();
            const unsignedBytes = await current.buildTransaction(transaction);
            ensureCurrent();
            const signed = await current.signTransaction(Transaction.from(unsignedBytes));
            ensureCurrent();
            const signedBytes = fromBase64(signed.bytes);
            if (signedBytes.length !== unsignedBytes.length || signedBytes.some((byte, index) => byte !== unsignedBytes[index])) {
              throw new Error('The wallet changed the prepared transaction bytes. Nothing was submitted.');
            }
            await checkStatement();
            const digest = await Transaction.from(signedBytes).getDigest();
            ensureCurrent();
            if (prepared.expectation.kind === 'enroll') throw new Error('An enrollment cannot use the ranked action journal.');
            const intentRecord: PendingRankedAction = { schemaVersion: 1, identity, digest, publicInputDigest: prepared.publicInputDigest,
              expectation: prepared.expectation, createdAtMs: Date.now() };
            // No signed bytes/signature enter durable storage. A failed journal write prevents sending.
            savePendingRankedAction(dependencies.storage(), intentRecord);
            pending = intentRecord;
            emit({ status: 'submitting', digest, kind: pending.expectation.kind });
            const response = await current.executeTransaction(signedBytes, signed.signature);
            const returnedDigest = response.$kind === 'Transaction' ? response.Transaction.digest : response.FailedTransaction.digest;
            if (returnedDigest !== digest) throw new Error('Submission returned another digest. Recover the saved exact transaction.');
            return response;
          },
        });
        const cleanupError = pending ? clearSettledJournal(dependencies, identity, pending.digest) : undefined;
        if (sameScope()) {
          emit({ status: cleanupError ? 'error' : 'finalized', digest: result.digest, error: cleanupError });
          latest.current.onFinalized();
        }
      });
    } catch (error) {
      let message = error instanceof Error ? error.message : 'Ranked action failed.';
      if (pending && error instanceof PlayerTransactionExecutionError && error.code === 'EXECUTION_FAILED') {
        const cleanupError = clearSettledJournal(dependencies, identity, pending.digest);
        if (!cleanupError) pending = undefined;
        else message = `${message} ${cleanupError}`;
      }
      if (sameScope()) emit({ status: abort.signal.aborted && !pending ? 'cancelled' : 'error', digest: pending?.digest,
        error: message });
    } finally {
      if (sameScope()) { running.current = false; active.current = null; }
    }
  }, [dependencies, emit]);

  return { state, submit, recover, cancel };
}
