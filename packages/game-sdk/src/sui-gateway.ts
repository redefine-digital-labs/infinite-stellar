import { Transaction } from '@mysten/sui/transactions';

export interface InfiniteStellarDeployment {
  network: 'localnet' | 'devnet' | 'testnet' | 'mainnet';
  packageId?: string;
  manifestId?: string;
  runtimeId?: string;
  enrollmentRegistryId?: string;
  planetRegistryId?: string;
  randomObjectId?: string;
  clockObjectId?: string;
  productionSoulAdapterReady: boolean;
  productionProofVerifierReady: boolean;
}

export class IntegrationUnavailableError extends Error {
  readonly code:
    | 'DEPLOYMENT_UNAVAILABLE'
    | 'SOUL_ADAPTER_UNAVAILABLE'
    | 'PROOF_VERIFIER_UNAVAILABLE';

  constructor(
    code: IntegrationUnavailableError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationUnavailableError';
    this.code = code;
  }
}

function requireObjectIds(deployment: InfiniteStellarDeployment): asserts deployment is InfiniteStellarDeployment & {
  packageId: string;
  manifestId: string;
  runtimeId: string;
} {
  if (!deployment.packageId || !deployment.manifestId || !deployment.runtimeId) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'Infinite Stellar has no pinned package, manifest, and runtime for this network.',
    );
  }
}

export function buildOpenUniverseTransaction(
  deployment: InfiniteStellarDeployment,
): Transaction {
  requireObjectIds(deployment);
  if (!deployment.randomObjectId || !deployment.clockObjectId) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'Random and Clock object IDs are required to open the universe.',
    );
  }
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::season::open_universe`,
    arguments: [
      transaction.object(deployment.manifestId),
      transaction.object(deployment.runtimeId),
      transaction.object(deployment.randomObjectId),
      transaction.object(deployment.clockObjectId),
    ],
  });
  return transaction;
}

export function buildTickHomeAvailabilityTransaction(
  deployment: InfiniteStellarDeployment,
): Transaction {
  requireObjectIds(deployment);
  if (!deployment.clockObjectId) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The Sui Clock object ID is required.',
    );
  }
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::season::tick_home_availability`,
    arguments: [
      transaction.object(deployment.manifestId),
      transaction.object(deployment.runtimeId),
      transaction.object(deployment.clockObjectId),
    ],
  });
  return transaction;
}

export function buildResolveHomeWindowTransaction(
  deployment: InfiniteStellarDeployment,
): Transaction {
  requireObjectIds(deployment);
  if (!deployment.clockObjectId) {
    throw new IntegrationUnavailableError(
      'DEPLOYMENT_UNAVAILABLE',
      'The Sui Clock object ID is required.',
    );
  }
  const transaction = new Transaction();
  transaction.moveCall({
    target: `${deployment.packageId}::season::resolve_home_window`,
    arguments: [
      transaction.object(deployment.manifestId),
      transaction.object(deployment.runtimeId),
      transaction.object(deployment.clockObjectId),
    ],
  });
  return transaction;
}

export function buildEnrollmentTransaction(
  deployment: InfiniteStellarDeployment,
): never {
  if (!deployment.productionSoulAdapterReady) {
    throw new IntegrationUnavailableError(
      'SOUL_ADAPTER_UNAVAILABLE',
      'Ranked enrollment is disabled until the manifest-pinned Soulidity adapter is ready.',
    );
  }
  throw new IntegrationUnavailableError(
    'DEPLOYMENT_UNAVAILABLE',
    'No production enrollment transaction builder is available in this release.',
  );
}

export function buildHomeClaimTransaction(
  deployment: InfiniteStellarDeployment,
): never {
  if (!deployment.productionProofVerifierReady) {
    throw new IntegrationUnavailableError(
      'PROOF_VERIFIER_UNAVAILABLE',
      'Home claiming is disabled until the manifest-pinned proof verifier is ready.',
    );
  }
  throw new IntegrationUnavailableError(
    'DEPLOYMENT_UNAVAILABLE',
    'No production home-claim transaction builder is available in this release.',
  );
}

export const UNCONFIGURED_TESTNET: InfiniteStellarDeployment = {
  network: 'testnet',
  productionSoulAdapterReady: false,
  productionProofVerifierReady: false,
};
