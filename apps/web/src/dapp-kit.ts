import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const GRPC_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
} as const;

export const dAppKit = createDAppKit({
  networks: ['mainnet'],
  defaultNetwork: 'mainnet',
  autoConnect: true,
  createClient: (network) =>
    new SuiGrpcClient({
      network,
      baseUrl: GRPC_URLS[network],
    }),
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
