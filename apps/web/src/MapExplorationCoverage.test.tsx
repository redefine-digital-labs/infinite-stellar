import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MapExplorationCoverage } from './MapExplorationCoverage';

describe('exact private search footprints', () => {
  it('reveals only complete rectangles and keeps in-progress work outside the reveal mask', () => {
    const { container } = render(<MapExplorationCoverage centerX={0} centerY={0} radius={100}
      chunks={[{ x: 0, y: 0, side: 16 }]} active={[{ x: 16, y: 0, side: 16 }]}
      origin={{ x: 8, y: 8 }} />);
    const revealed = container.querySelectorAll('mask rect[fill="black"]');
    expect(revealed).toHaveLength(1);
    expect(revealed[0]).toHaveAttribute('x', '50');
    expect(Number(revealed[0]!.getAttribute('width'))).toBeCloseTo(7.36);
    expect(container.querySelectorAll('.active-search-chunk')).toHaveLength(1);
    expect(container.querySelector('mask .active-search-chunk')).toBeNull();
    expect(container.querySelector('.explorer-origin')).toBeInTheDocument();
  });

  it('culls offscreen cells and never draws a full-radius discovery circle', () => {
    const { container } = render(<MapExplorationCoverage centerX={0} centerY={0} radius={100}
      chunks={[{ x: 1000, y: 1000, side: 16 }]} active={[]} />);
    expect(container.querySelectorAll('mask rect[fill="black"]')).toHaveLength(0);
    expect(container.querySelector('circle')).toBeNull();
  });
});
