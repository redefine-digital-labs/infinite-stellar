import {
  useCurrentAccount,
  useCurrentClient,
  useCurrentNetwork,
  useDAppKit,
} from '@mysten/dapp-kit-react';
import { useCallback } from 'react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { GameShell } from './GameShell';
import { MAINNET_DEPLOYMENT, SOULIDITY_MAINNET_PIN } from './deployment';
import { useRankedGateway } from './use-ranked-gateway';
import { useRankedEnrollment } from './use-ranked-enrollment';
import { useRankedMap } from './use-ranked-map';

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
    />
  );
}
