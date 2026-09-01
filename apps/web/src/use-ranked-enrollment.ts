import { useCallback, useState } from 'react';
import type { SuiClientTypes } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import {
  buildEnrollmentTransaction,
  createNeutralCommanderProjectionCommitment,
  submitAndFinalizePlayerTransaction,
  type CanonicalSoul,
  type FinalizedPlayerTransaction,
  type InfiniteStellarDeployment,
  type PlayerSuiClient,
} from '@infinite-stellar/game-sdk';

export interface RankedEnrollmentState {
  status: 'idle' | 'simulating' | 'awaiting-signature' | 'finalizing' | 'finalized' | 'error';
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
  });
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
        onPhase: (status) => setState({ status, soulStateId: soul.stateId }),
      });
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
