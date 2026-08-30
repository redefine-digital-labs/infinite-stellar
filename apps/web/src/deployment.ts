import type { InfiniteStellarDeployment } from '@infinite-stellar/game-sdk';
import deploymentRecord from '../../../ops/deployments/sui-testnet-v0.1.0.json';

export const TESTNET_DEPLOYMENT: InfiniteStellarDeployment = {
  network: 'testnet',
  packageId: deploymentRecord.package.packageId,
  manifestId: deploymentRecord.canary.objects.manifest.objectId,
  runtimeId: deploymentRecord.canary.objects.runtime.objectId,
  enrollmentRegistryId: deploymentRecord.canary.objects.enrollmentRegistry.objectId,
  planetRegistryId: deploymentRecord.canary.objects.planetRegistry.objectId,
  randomObjectId: deploymentRecord.systemObjects.random,
  clockObjectId: deploymentRecord.systemObjects.clock,
  productionSoulAdapterReady: deploymentRecord.readiness.productionSoulAdapterReady,
  productionProofVerifierReady: deploymentRecord.readiness.productionProofVerifierReady,
};

export const TESTNET_DEPLOYMENT_EVIDENCE = {
  release: deploymentRecord.release,
  packageExplorerUrl: deploymentRecord.links.package,
  publishTransactionExplorerUrl: deploymentRecord.links.publishTransaction,
  manifestExplorerUrl: deploymentRecord.links.manifest,
  bootstrapTransactionExplorerUrl: deploymentRecord.links.bootstrapTransaction,
} as const;
