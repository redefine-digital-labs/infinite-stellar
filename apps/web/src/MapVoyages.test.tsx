import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapVoyages, voyageProgress, type MapVoyage } from './MapVoyages';

const voyage: MapVoyage = {
  id: 'one', from: { x: 20, y: 30 }, to: { x: 80, y: 70 }, departureAt: 100, arrivalAt: 200,
  energy: '2.4K', silver: '40', owner: 'player', kind: 'fleet', artifact: true,
};

afterEach(() => vi.useRealTimers());

describe('time-positioned fleets', () => {
  it('interpolates along the full route, clamps time and handles zero-duration arrivals', () => {
    expect(voyageProgress(100, 200, 50)).toBe(0);
    expect(voyageProgress(100, 200, 150)).toBe(0.5);
    expect(voyageProgress(100, 200, 210)).toBe(1);
    expect(voyageProgress(100, 100, 100)).toBe(1);
  });
  it('moves one marker at the real time fraction with energy, silver, cargo and ETA', () => {
    const { rerender } = render(<MapVoyages viewport={{ width: 1440, height: 900 }} voyages={[voyage]} clock={{ seconds: 150 }} />);
    const marker = screen.getByTestId('voyage-fleet-one');
    expect(marker).toHaveStyle({ left: '50%', top: '50%' });
    expect(marker).toHaveTextContent('2.4K');
    expect(marker).toHaveTextContent('+40 Ag');
    expect(marker).toHaveTextContent('50s');
    expect(marker.querySelector('.fleet-artifact')).toBeInTheDocument();
    rerender(<MapVoyages viewport={{ width: 393, height: 720 }} voyages={[voyage]} clock={{ seconds: 175 }} />);
    expect(marker).toHaveStyle({ left: '65%', top: '60%' });
    expect(screen.getByTestId('voyage-route-one')).toHaveAttribute('x1', '20');
  });
  it('animates only elapsed time and keeps position when the game clock is synchronized', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const { rerender, unmount } = render(<MapVoyages viewport={{ width: 1200, height: 800 }} voyages={[voyage]}
      clock={{ seconds: 100, observedAtMs: 100_000 }} />);
    await act(() => vi.advanceTimersByTimeAsync(500));
    const before = Number(screen.getByTestId('voyage-fleet-one').getAttribute('data-progress'));
    expect(before).toBeGreaterThan(0.004);
    expect(before).toBeLessThanOrEqual(0.005);
    rerender(<MapVoyages viewport={{ width: 1200, height: 800 }} voyages={[voyage]}
      clock={{ seconds: 100, observedAtMs: 100_000 }} />);
    expect(Number(screen.getByTestId('voyage-fleet-one').getAttribute('data-progress'))).toBe(before);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('never pretends that a ranked arrival is settled just because its ETA elapsed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(201_000);
    render(<MapVoyages viewport={{ width: 1200, height: 800 }} voyages={[voyage]} ranked />);
    expect(screen.getByTestId('voyage-fleet-one')).toHaveStyle({ left: '80%', top: '70%' });
    expect(screen.getByText('Awaiting settlement')).toBeInTheDocument();
  });
});
