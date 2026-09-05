import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mergeRankedPrivateMap } from '@infinite-stellar/game-sdk';
import { rankedActionFixture } from '../../../packages/game-sdk/test/ranked-action-fixtures';
import { RankedActionControls, type RankedActionControlsProps } from './RankedActionControls';

function props(mode: 'home' | 'move' | 'move_new' = 'move_new'): RankedActionControlsProps {
  const context = rankedActionFixture(mode);
  const map = mergeRankedPrivateMap(context.record, context.seat, context.projection, context.record);
  return { selected: map.planets.find((planet) => planet.locationId === context.record.locations[0]!.locationId),
    target: mode === 'home' ? undefined : map.planets.find((planet) => planet.locationId === context.record.locations[1]!.locationId),
    needsHome: mode === 'home', ready: true, blocked: false, state: { status: 'idle' },
    onAim: vi.fn(), onSubmit: vi.fn().mockResolvedValue(undefined), onCancel: vi.fn(), onRecover: vi.fn().mockResolvedValue(undefined) };
}

describe('ranked home and fleet controls', () => {
  it('emits a home request without coordinates or simulated ownership changes', () => {
    const input = props('home'); render(<RankedActionControls {...input} />);
    fireEvent.click(screen.getByRole('button', { name: 'Prove and claim home' }));
    expect(input.onSubmit).toHaveBeenCalledWith({ kind: 'claim_home', destinationLocationId: input.selected!.locationId });
    expect(input.selected!.materialized).toBe(false);
  });
  it.each(['move', 'move_new'] as const)('sends the selected %s route and exact displayed resource amounts', (mode) => {
    const input = props(mode); render(<RankedActionControls {...input} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Ranked fleet energy percentage' }), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prove and send fleet' }));
    expect(input.onSubmit).toHaveBeenCalledWith({ kind: 'move', sourceLocationId: input.selected!.locationId,
      destinationLocationId: input.target!.locationId, sentEnergy: 37_500n, sentSilver: 0n });
  });
  it('keeps signing unreachable when release gates are sealed', () => {
    const input = props(); render(<RankedActionControls {...input} ready={false} />);
    expect(screen.getByText('Ranked writes remain sealed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Prove and send fleet' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Prove and send fleet' }));
    expect(input.onSubmit).not.toHaveBeenCalled();
  });
  it('offers recovery, not another send, for an uncertain submitted digest', () => {
    const input = props(); render(<RankedActionControls {...input} state={{ status: 'error', digest: '1'.repeat(32), error: 'Response lost' }} />);
    expect(screen.getByRole('button', { name: 'Prove and send fleet' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Recover pending transaction' }));
    expect(input.onRecover).toHaveBeenCalledOnce();
    expect(input.onSubmit).not.toHaveBeenCalled();
  });
  it('allows preparation cancellation but does not advertise submitted-transaction cancellation', () => {
    const input = props(); const view = render(<RankedActionControls {...input} state={{ status: 'proving' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel before submission' }));
    expect(input.onCancel).toHaveBeenCalledOnce();
    view.rerender(<RankedActionControls {...input} state={{ status: 'finalizing', digest: '1'.repeat(32) }} />);
    expect(screen.queryByRole('button', { name: 'Cancel before submission' })).not.toBeInTheDocument();
  });
});
