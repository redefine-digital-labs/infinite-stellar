import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { App } from './App';
import { dAppKit } from './dapp-kit';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root application mount.');

createRoot(root).render(
  <StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
      <App />
    </DAppKitProvider>
  </StrictMode>,
);
