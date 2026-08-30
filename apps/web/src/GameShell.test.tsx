import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameShell } from './GameShell';

describe('Infinite Stellar player shell', () => {
  it('runs the complete local First Light journey', async () => {
    const user = userEvent.setup();
    render(<GameShell />);

    await user.click(screen.getByRole('button', { name: /explore local demo/i }));
    expect(screen.getByRole('heading', { name: /who crosses/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /lyra-9/i }));
    await user.click(screen.getByRole('button', { name: /create season seat/i }));
    expect(screen.getByRole('heading', { name: /bind lyra-9/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /approve simulated transaction/i }));
    expect(screen.getByRole('button', { name: /waiting for simulated finality/i })).toBeDisabled();
    await screen.findByRole('button', { name: /open the simulated universe/i });
    expect(screen.getAllByText('AwaitingHome')).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /open the simulated universe/i }));
    expect(screen.getByRole('heading', { name: /the map is yours/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /run local search/i }));
    expect(screen.getByRole('heading', { name: /a place to begin/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /claim founding planet/i }));
    await user.click(screen.getByRole('button', { name: /approve simulated claim/i }));
    expect(screen.getByRole('button', { name: /waiting for simulated finality/i })).toBeDisabled();
    expect(await screen.findByRole('heading', { name: /the dark has/i })).toBeInTheDocument();
    expect(screen.getByText(/civilization active/i)).toBeInTheDocument();
  });

  it('keeps the live testnet route visibly fail-closed', async () => {
    const user = userEvent.setup();
    render(<GameShell walletAddress="0xabc" network="testnet" />);
    await user.click(screen.getByRole('button', { name: /check live testnet/i }));
    expect(screen.getByRole('heading', { name: /bridge to soulidity is not pinned/i })).toBeInTheDocument();
    expect(screen.getByText(/testnet package deployed/i)).toBeInTheDocument();
    expect(screen.getByText(/production soul adapter pending/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/production soul adapter and proof verifier/i);
    expect(screen.getByText(/experimental · unaudited · testnet canary/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inspect package/i })).toHaveAttribute(
      'href',
      expect.stringContaining('0x1199adc93f61acd99d6d7889c82650b79c90e51ed3816c8c40d0544f9e2c9665'),
    );
  });

  it('labels demo mode and exposes a skip link', async () => {
    const user = userEvent.setup();
    render(<GameShell />);
    expect(screen.getByRole('link', { name: /skip to mission control/i })).toHaveAttribute('href', '#main-content');
    await user.click(screen.getByRole('button', { name: /explore local demo/i }));
    expect(screen.getByText('LOCAL SIMULATION')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/nothing here is submitted to sui/i);
  });

  it('shows a recoverable transaction rejection state', async () => {
    const user = userEvent.setup();
    render(<GameShell />);
    await user.click(screen.getByRole('button', { name: /explore local demo/i }));
    await user.click(screen.getByRole('button', { name: /lyra-9/i }));
    await user.click(screen.getByRole('button', { name: /create season seat/i }));
    await user.click(screen.getByRole('button', { name: /simulate wallet rejection/i }));
    expect(screen.getByRole('heading', { name: /nothing finalized/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /retry from safe state/i }));
    expect(screen.getByRole('button', { name: /create season seat/i })).toBeInTheDocument();
  });
});
