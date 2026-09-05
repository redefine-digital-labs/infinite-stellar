import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
} from '@mysten/dapp-kit-react';
import { useCallback } from 'react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { GameShell } from './GameShell';
import { MAINNET_DEPLOYMENT, RANKED_PROOF_MANIFEST_URLS, SOULIDITY_MAINNET_PIN } from './deployment';
import { useRankedGateway } from './use-ranked-gateway';
import { useRankedEnrollment } from './use-ranked-enrollment';
import { rankedMapIdentityFor, useRankedMap } from './use-ranked-map';
import { useRankedActions } from './use-ranked-actions';
import type { Transaction } from '@mysten/sui/transactions';

export function App() {
  const account = useCurrentAccount();
  const client = useCurrentClient();
  const dAppKit = useDAppKit();
  const network = useCurrentNetwork();
  const ranked = useRankedGateway(
    client,
    account?.address,
    MAINNET_DEPLOYMENT,
    SOULIDITY_MAINNET_PIN,
  );
  const execute = useCallback(
    (transaction: Parameters<typeof dAppKit.signAndExecuteTransaction>[0]['transaction']) =>
      dAppKit.signAndExecuteTransaction({ transaction, network: 'mainnet' }),
    [dAppKit],
  );
  const enrollment = useRankedEnrollment(
    client,
    MAINNET_DEPLOYMENT,
    account?.address,
    execute,
    ranked.refresh,
  );
  const rankedMap = useRankedMap(
    client,
    MAINNET_DEPLOYMENT,
    SOULIDITY_MAINNET_PIN.chainIdentifier,
    ranked.snapshot.seat,
  );
  const onActionFinalized = useCallback(() => { ranked.refresh(); rankedMap.refresh(); }, [ranked.refresh, rankedMap.refresh]);
  const rankedActionsReady = ranked.snapshot.writesReady &&
    Object.values(RANKED_PROOF_MANIFEST_URLS).every(Boolean);
  const actions = useRankedActions({
    client, deployment: MAINNET_DEPLOYMENT, network, controller: account?.address,
    identity: rankedMapIdentityFor(MAINNET_DEPLOYMENT, SOULIDITY_MAINNET_PIN.chainIdentifier, ranked.snapshot.seat),
    writesReady: rankedActionsReady, manifestUrls: RANKED_PROOF_MANIFEST_URLS,
    buildTransaction: (transaction: Transaction) => transaction.build({ client }),
    signTransaction: (transaction: Transaction) => dAppKit.signTransaction({ transaction, network: 'mainnet', account: account ?? undefined }),
    executeTransaction: (bytes, signature) => client.executeTransaction({ transaction: bytes, signatures: [signature] }),
    onFinalized: onActionFinalized,
  });

  return (
    <GameShell
      walletAddress={account?.address}
      network={network}
      walletControl={<ConnectButton />}
      deployment={MAINNET_DEPLOYMENT}
      rankedGateway={ranked.snapshot}
      onRefreshRanked={ranked.refresh}
      rankedEnrollment={enrollment.state}
      onEnrollRanked={enrollment.enroll}
      rankedMap={rankedMap.snapshot}
      onRefreshRankedMap={rankedMap.refresh}
      rankedMining={rankedMap.mining}
      onMineRankedMap={rankedMap.mine}
      onCancelRankedMining={rankedMap.cancelMining}
      rankedBackup={rankedMap.backup}
      onExportRankedBackup={rankedMap.exportBackup}
      onImportRankedBackup={rankedMap.importBackup}
      rankedAction={actions.state}
      rankedActionsReady={rankedActionsReady}
      onSubmitRankedAction={actions.submit}
      onRecoverRankedAction={actions.recover}
      onCancelRankedAction={actions.cancel}
    />
  );
}
