import { useCurrentAccount, useCurrentNetwork } from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { GameShell } from './GameShell';

export function App() {
  const account = useCurrentAccount();
  const network = useCurrentNetwork();

  return (
    <GameShell
      walletAddress={account?.address}
      network={network}
      walletControl={<ConnectButton />}
    />
  );
}
