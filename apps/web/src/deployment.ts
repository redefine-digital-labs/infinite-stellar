import type {
  InfiniteStellarDeployment,
  SoulidityMainnetPin,
} from '@infinite-stellar/game-sdk';
import deploymentRecord from '../../../ops/deployments/sui-testnet-v0.1.0.json';
import soulidityRecord from '../../../config/soulidity-mainnet-v1.json';

export const SOULIDITY_MAINNET_PIN: SoulidityMainnetPin = {
  network: 'mainnet',
  chainIdentifier: soulidityRecord.chainIdentifier,
  callablePackageId: soulidityRecord.package.callablePackageId,
  originalPackageId: soulidityRecord.package.originalPackageId,
  soulStateType: soulidityRecord.package.soulStateType,
  protocolVersion: Number(soulidityRecord.interface.protocolVersion),
  stateVersion: Number(soulidityRecord.interface.stateVersion),
};

export const MAINNET_DEPLOYMENT: InfiniteStellarDeployment = {
  network: 'mainnet',
  soulidityCallablePackageId: SOULIDITY_MAINNET_PIN.callablePackageId,
  soulidityOriginalPackageId: SOULIDITY_MAINNET_PIN.originalPackageId,
  productionSoulAdapterReady: false,
  productionProofVerifierReady: false,
};

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
