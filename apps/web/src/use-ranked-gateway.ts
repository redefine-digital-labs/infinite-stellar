import { useCallback, useEffect, useRef, useState } from 'react';
import {
  assertRankedReleaseDeploymentReady,
  discoverCanonicalSoulsForOwner,
  readPlayerSeatBundle,
  type CanonicalSoul,
  type InfiniteStellarDeployment,
  type PlayerSeatBundle,
  type SoulidityMainnetPin,
  type SoulidityReadClient,
} from '@infinite-stellar/game-sdk';

export type RankedGatewayBlocker =
  | 'GAME_DEPLOYMENT_MISSING'
  | 'SOUL_ADAPTER_CLOSED'
  | 'PROOF_VERIFIER_CLOSED'
  | 'RELEASE_EVIDENCE_MISSING'
  | 'SOUL_DISCOVERY_INCOMPLETE'
  | 'NO_ELIGIBLE_SOUL';

export interface RankedGatewaySnapshot {
  phase: 'disconnected' | 'loading' | 'loaded' | 'error';
  controller?: string;
  seat?: PlayerSeatBundle;
  souls: CanonicalSoul[];
  discoveryComplete: boolean;
  scannedSoulEvents: number;
  blockers: RankedGatewayBlocker[];
  writesReady: boolean;
  error?: string;
}

export interface RankedGatewayDependencies {
  readSeat: typeof readPlayerSeatBundle;
  discoverSouls: typeof discoverCanonicalSoulsForOwner;
}

const DEFAULT_DEPENDENCIES: RankedGatewayDependencies = {
  readSeat: readPlayerSeatBundle,
  discoverSouls: discoverCanonicalSoulsForOwner,
};

const DISCONNECTED: RankedGatewaySnapshot = {
  phase: 'disconnected',
  souls: [],
  discoveryComplete: false,
  scannedSoulEvents: 0,
  blockers: [],
  writesReady: false,
};

function hasSeatReadPins(deployment: InfiniteStellarDeployment): boolean {
  return Boolean(
    deployment.packageId &&
    deployment.manifestId &&
    deployment.enrollmentRegistryId &&
    deployment.seatRouting,
  );
}

function hasCompleteGameDeployment(deployment: InfiniteStellarDeployment): boolean {
  return Boolean(
    deployment.network === 'mainnet' &&
    deployment.packageId &&
    deployment.manifestId &&
    deployment.runtimeId &&
    deployment.enrollmentRegistryId &&
    deployment.planetRegistryId &&
    deployment.randomObjectId &&
    deployment.clockObjectId &&
    deployment.soulidityCallablePackageId &&
    deployment.soulidityOriginalPackageId &&
    deployment.claimHomeCircuitConfig &&
    deployment.moveCircuitConfig &&
    deployment.moveNewCircuitConfig &&
    deployment.proofIntent &&
    deployment.seatRouting,
  );
}

function releaseEvidencePresent(deployment: InfiniteStellarDeployment): boolean {
  const evidence = deployment.productionReleaseEvidence;
  const digest = /^[0-9a-f]{64}$/;
  return Boolean(
    evidence && evidence.schemaVersion === 1 &&
    digest.test(evidence.ceremonyTranscriptSha256) &&
    digest.test(evidence.circuitAuditSha256) &&
    digest.test(evidence.moveAuditSha256) &&
    digest.test(evidence.clientAuditSha256) &&
    digest.test(evidence.operationsApprovalSha256) &&
    digest.test(evidence.multisigPolicySha256),
  );
}

function rankedReleaseReady(deployment: InfiniteStellarDeployment): boolean {
  try {
    assertRankedReleaseDeploymentReady(deployment);
    return true;
  } catch {
    return false;
  }
}

export async function loadRankedGatewaySnapshot(
  client: SoulidityReadClient,
  controller: string,
  deployment: InfiniteStellarDeployment,
  soulidityPin: SoulidityMainnetPin,
  dependencies: RankedGatewayDependencies = DEFAULT_DEPENDENCIES,
  signal?: AbortSignal,
): Promise<RankedGatewaySnapshot> {
  if (hasSeatReadPins(deployment)) {
    const seat = await dependencies.readSeat(client, deployment, controller);
    if (seat.status === 'enrolled') {
      const blockers: RankedGatewayBlocker[] = [];
      if (!hasCompleteGameDeployment(deployment)) blockers.push('GAME_DEPLOYMENT_MISSING');
      if (!deployment.productionSoulAdapterReady) blockers.push('SOUL_ADAPTER_CLOSED');
      if (!deployment.productionProofVerifierReady) blockers.push('PROOF_VERIFIER_CLOSED');
      if (!releaseEvidencePresent(deployment)) blockers.push('RELEASE_EVIDENCE_MISSING');
      if (!rankedReleaseReady(deployment) && blockers.length === 0) {
        blockers.push('GAME_DEPLOYMENT_MISSING');
      }
      return {
        phase: 'loaded',
        controller,
        seat,
        souls: [],
        discoveryComplete: true,
        scannedSoulEvents: 0,
        blockers,
        writesReady: blockers.length === 0 && rankedReleaseReady(deployment),
      };
    }
  }

  const discovery = await dependencies.discoverSouls(
    client,
    soulidityPin,
    controller,
    { signal },
  );
  const blockers: RankedGatewayBlocker[] = [];
  if (!hasCompleteGameDeployment(deployment)) blockers.push('GAME_DEPLOYMENT_MISSING');
  if (!deployment.productionSoulAdapterReady) blockers.push('SOUL_ADAPTER_CLOSED');
  if (!deployment.productionProofVerifierReady) blockers.push('PROOF_VERIFIER_CLOSED');
  if (!releaseEvidencePresent(deployment)) blockers.push('RELEASE_EVIDENCE_MISSING');
  if (!rankedReleaseReady(deployment) && blockers.length === 0) {
    blockers.push('GAME_DEPLOYMENT_MISSING');
  }
  if (!discovery.complete) blockers.push('SOUL_DISCOVERY_INCOMPLETE');
  if (discovery.complete && discovery.souls.length === 0) blockers.push('NO_ELIGIBLE_SOUL');
  return {
    phase: 'loaded',
    controller,
    souls: discovery.souls,
    discoveryComplete: discovery.complete,
    scannedSoulEvents: discovery.scannedEvents,
    blockers,
    writesReady: blockers.length === 0 && rankedReleaseReady(deployment),
  };
}

export function useRankedGateway(
  client: SoulidityReadClient,
  controller: string | undefined,
  deployment: InfiniteStellarDeployment,
  soulidityPin: SoulidityMainnetPin,
  dependencies: RankedGatewayDependencies = DEFAULT_DEPENDENCIES,
): { snapshot: RankedGatewaySnapshot; refresh: () => void } {
  const [snapshot, setSnapshot] = useState<RankedGatewaySnapshot>(DISCONNECTED);
  const [revision, setRevision] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    requestSequence.current += 1;
    const request = requestSequence.current;
    if (!controller) {
      setSnapshot(DISCONNECTED);
      return;
    }
    const abort = new AbortController();
    setSnapshot({
      phase: 'loading',
      controller,
      souls: [],
      discoveryComplete: false,
      scannedSoulEvents: 0,
      blockers: [],
      writesReady: false,
    });
    void loadRankedGatewaySnapshot(
      client,
      controller,
      deployment,
      soulidityPin,
      dependencies,
      abort.signal,
    ).then((next) => {
      if (!abort.signal.aborted && requestSequence.current === request) setSnapshot(next);
    }).catch((error) => {
      if (abort.signal.aborted || requestSequence.current !== request) return;
      setSnapshot({
        phase: 'error',
        controller,
        souls: [],
        discoveryComplete: false,
        scannedSoulEvents: 0,
        blockers: [],
        writesReady: false,
        error: error instanceof Error ? error.message : 'The mainnet player state could not be read.',
      });
    });
    return () => abort.abort();
  }, [client, controller, dependencies, deployment, revision, soulidityPin]);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  return { snapshot, refresh };
}
