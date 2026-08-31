import { useEffect, useState } from 'react';
import type { ProofArtifactProgress, ProofArtifactSelection } from '@infinite-stellar/prover';
import { ProverWorkerClient } from './prover-client';

export type ProofReadinessStatus = 'not-configured' | 'loading' | 'ready' | 'error';

export interface ProofReadinessState {
  status: ProofReadinessStatus;
  label: string;
  progress?: ProofArtifactProgress;
  manifestSha256?: string;
  error?: string;
}

function productionSelection(): ProofArtifactSelection | undefined {
  const manifestUrl = import.meta.env.VITE_PROOF_MANIFEST_URL;
  const manifestSha256 = import.meta.env.VITE_PROOF_MANIFEST_SHA256;
  if (!manifestUrl || !manifestSha256) return undefined;
  return {
    manifestUrl,
    manifestSha256,
    mode: 'production',
    expectedNetwork: 'sui:mainnet',
    expectedRulesetId: 'dark-forest-v06-round5',
    expectedCircuitId: 'round5-move',
    expectedCircuitVersion: 1,
  };
}

const NOT_CONFIGURED: ProofReadinessState = {
  status: 'not-configured',
  label: 'PROVER GATED · NO MAINNET MANIFEST',
};

export function useProofReadiness(): ProofReadinessState {
  const [state, setState] = useState<ProofReadinessState>(NOT_CONFIGURED);

  useEffect(() => {
    const selection = productionSelection();
    if (!selection) {
      setState(NOT_CONFIGURED);
      return;
    }
    if (typeof Worker === 'undefined') {
      setState({ status: 'error', label: 'PROVER UNAVAILABLE', error: 'This browser cannot start a Web Worker.' });
      return;
    }
    const client = new ProverWorkerClient();
    let disposed = false;
    const operation = client.preflight(selection, (progress) => {
      if (disposed) return;
      setState({ status: 'loading', label: 'VERIFYING PINNED PROVER', progress });
    });
    setState({ status: 'loading', label: 'VERIFYING PINNED PROVER' });
    void operation.result.then((result) => {
      if (disposed) return;
      setState({
        status: 'ready',
        label: 'MAINNET PROVER · HASH VERIFIED',
        manifestSha256: result.manifestSha256,
      });
    }).catch((error) => {
      if (disposed) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState({
        status: 'error',
        label: 'PROVER FAIL-CLOSED',
        error: error instanceof Error ? error.message : 'Proof artifact preflight failed.',
      });
    });
    return () => {
      disposed = true;
      operation.cancel();
      client.destroy();
    };
  }, []);

  return state;
}
