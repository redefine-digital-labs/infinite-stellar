import { useCallback, useEffect, useState } from 'react';
import type { SuiClientTypes } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import {
  buildEnrollmentTransaction,
  createNeutralCommanderProjectionCommitment,
  recoverPlayerTransactionByDigest,
  submitAndFinalizePlayerTransaction,
  type CanonicalSoul,
  type FinalizedPlayerTransaction,
  type InfiniteStellarDeployment,
  type PlayerSuiClient,
} from '@infinite-stellar/game-sdk';

export interface RankedEnrollmentState {
  status: 'idle' | 'recovering' | 'simulating' | 'awaiting-signature' | 'finalizing' | 'finalized' | 'error';
  soulStateId?: string;
  digest?: string;
  error?: string;
}

export interface RankedEnrollmentInput {
  client: PlayerSuiClient;
  deployment: InfiniteStellarDeployment;
  controller: string;
  soul: CanonicalSoul;
  execute: (transaction: Transaction) => Promise<SuiClientTypes.TransactionResult>;
  onPhase?: (phase: 'simulating' | 'awaiting-signature' | 'finalizing') => void;
  onSubmitted?: (digest: string) => void;
}

export async function submitRankedEnrollment(
  input: RankedEnrollmentInput,
): Promise<FinalizedPlayerTransaction> {
  if (!input.deployment.manifestId || !input.deployment.soulidityOriginalPackageId) {
    throw new Error('The exact mainnet Season and Soulidity type-origin package are not pinned.');
  }
  if (input.soul.currentOwner !== input.controller || input.soul.listed) {
    throw new Error('The selected Soul is not an unlisted canonical Soul of the connected controller.');
  }
  const transaction = buildEnrollmentTransaction(input.deployment, {
    soulStateId: input.soul.stateId,
    sender: input.controller,
    projectionCommitment: createNeutralCommanderProjectionCommitment({
      seasonId: input.deployment.manifestId,
      soulidityOriginalPackageId: input.deployment.soulidityOriginalPackageId,
      soul: input.soul,
    }),
  });
  return submitAndFinalizePlayerTransaction({
    client: input.client,
    transaction,
    execute: input.execute,
    deployment: input.deployment,
    expectation: {
      kind: 'enroll',
      seasonId: input.deployment.manifestId,
      controller: input.controller,
      soulId: input.soul.soulId,
    },
    onPhase: input.onPhase,
    onSubmitted: input.onSubmitted,
  });
}

interface PendingEnrollment {
  schemaVersion: 1;
  kind: 'enroll';
  digest: string;
  seasonId: string;
  controller: string;
  soulId: string;
  soulStateId: string;
  createdAtMs: number;
}

const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;
const ADDRESS = /^0x[0-9a-f]{64}$/;

function recoveryKey(controller: string): string {
  return `infinite-stellar:ranked-pending:v1:mainnet:${controller}`;
}

export function loadPendingEnrollment(controller: string): PendingEnrollment | null {
  try {
    const raw = window.localStorage.getItem(recoveryKey(controller));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingEnrollment>;
    if (
      value.schemaVersion !== 1 || value.kind !== 'enroll' ||
      typeof value.digest !== 'string' || !DIGEST.test(value.digest) ||
      typeof value.seasonId !== 'string' || !ADDRESS.test(value.seasonId) ||
      value.controller !== controller || !ADDRESS.test(controller) ||
      typeof value.soulId !== 'string' || !ADDRESS.test(value.soulId) ||
      typeof value.soulStateId !== 'string' || !ADDRESS.test(value.soulStateId) ||
      typeof value.createdAtMs !== 'number' || !Number.isSafeInteger(value.createdAtMs)
    ) {
      return null;
    }
    return value as PendingEnrollment;
  } catch {
    return null;
  }
}

function savePendingEnrollment(value: PendingEnrollment): void {
  try {
    window.localStorage.setItem(recoveryKey(value.controller), JSON.stringify(value));
  } catch {
    // Finality reconciliation must continue even when browser storage is unavailable.
  }
}

function clearPendingEnrollment(controller: string): void {
  try {
    window.localStorage.removeItem(recoveryKey(controller));
  } catch {
    // An unavailable storage surface must not change the chain result.
  }
}

export function useRankedEnrollment(
  client: PlayerSuiClient,
  deployment: InfiniteStellarDeployment,
  controller: string | undefined,
  execute: (transaction: Transaction) => Promise<SuiClientTypes.TransactionResult>,
  onFinalized: () => void,
): {
  state: RankedEnrollmentState;
  enroll: (soul: CanonicalSoul) => Promise<void>;
  reset: () => void;
} {
  const [state, setState] = useState<RankedEnrollmentState>({ status: 'idle' });

  useEffect(() => {
    if (!controller || !deployment.manifestId) {
      setState({ status: 'idle' });
      return;
    }
    const pending = loadPendingEnrollment(controller);
    if (!pending) {
      setState({ status: 'idle' });
      return;
    }
    if (pending.seasonId !== deployment.manifestId) {
      clearPendingEnrollment(controller);
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({
      status: 'recovering',
      soulStateId: pending.soulStateId,
      digest: pending.digest,
    });
    void recoverPlayerTransactionByDigest({
      client,
      digest: pending.digest,
      deployment,
      expectation: {
        kind: 'enroll',
        seasonId: pending.seasonId,
        controller,
        soulId: pending.soulId,
      },
    }).then((finalized) => {
      if (cancelled) return;
      clearPendingEnrollment(controller);
      setState({
        status: 'finalized',
        soulStateId: pending.soulStateId,
        digest: finalized.digest,
      });
      onFinalized();
    }).catch((error) => {
      if (cancelled) return;
      setState({
        status: 'error',
        soulStateId: pending.soulStateId,
        digest: pending.digest,
        error: error instanceof Error ? error.message : 'Pending enrollment recovery failed.',
      });
    });
    return () => { cancelled = true; };
  }, [client, controller, deployment, onFinalized]);

  const enroll = useCallback(async (soul: CanonicalSoul) => {
    if (!controller) {
      setState({ status: 'error', error: 'Connect the mainnet controller wallet first.' });
      return;
    }
    setState({ status: 'simulating', soulStateId: soul.stateId });
    try {
      const finalized = await submitRankedEnrollment({
        client,
        deployment,
        controller,
        soul,
        execute,
        onPhase: (status) => setState((current) => ({
          status,
          soulStateId: soul.stateId,
          digest: status === 'finalizing' ? current.digest : undefined,
        })),
        onSubmitted: (digest) => {
          savePendingEnrollment({
            schemaVersion: 1,
            kind: 'enroll',
            digest,
            seasonId: deployment.manifestId!,
            controller,
            soulId: soul.soulId,
            soulStateId: soul.stateId,
            createdAtMs: Date.now(),
          });
          setState({ status: 'finalizing', soulStateId: soul.stateId, digest });
        },
      });
      clearPendingEnrollment(controller);
      setState({
        status: 'finalized',
        soulStateId: soul.stateId,
        digest: finalized.digest,
      });
      onFinalized();
    } catch (error) {
      setState({
        status: 'error',
        soulStateId: soul.stateId,
        error: error instanceof Error ? error.message : 'Ranked enrollment failed.',
      });
    }
  }, [client, controller, deployment, execute, onFinalized]);

  return {
    state,
    enroll,
    reset: () => setState({ status: 'idle' }),
  };
}
