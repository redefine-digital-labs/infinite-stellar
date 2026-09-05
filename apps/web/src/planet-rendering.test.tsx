import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { planetCosmetic, planetDetail, planetWorldRadius, biomeFromMap } from './planet-rendering';
import { MapPlanetGlyph } from './MapPlanetGlyph';
import { MapPlanetBodies } from './MapPlanetBodies';

describe('DF scale-dependent planetary detail', () => {
  it('preserves real level/world size differences, scaled by committed rarity', () => {
    expect(planetWorldRadius(2) / planetWorldRadius(0)).toBe(9);
    expect(planetWorldRadius(5) / planetWorldRadius(4)).toBeCloseTo(3);
    expect(planetWorldRadius(1, 65_536)).toBe(6);
  });
  it('culls subpixel low-level planets while keeping large ones visible', () => {
    expect(planetDetail(0, 0.4).visible).toBe(false);
    expect(planetDetail(2, 0.4).visible).toBe(true);
    expect(planetDetail(2, 0.4).showResources).toBe(false);
    expect(planetDetail(2, 1.4).showResources).toBe(true);
  });
  it('shows low-level bodies and resources only after zooming in', () => {
    expect(planetDetail(0, 1.4).simplified).toBe(true);
    expect(planetDetail(0, 12).showResources).toBe(true);
    expect(planetDetail(0, 12).radius).toBeGreaterThan(planetDetail(0, 1.4).radius * 8);
  });
  it('preserves selection, Home and active voyage anchors at distant zoom', () => {
    const detail = planetDetail(0, 0.001, true);
    expect(detail.visible).toBe(true);
    expect(detail.radius).toBe(2);
    expect(detail.hitDiameter).toBe(16);
  });
  it('fades detail continuously and never turns hidden nodes into large hit targets', () => {
    expect(planetDetail(1, 2).detailOpacity).toBeLessThan(planetDetail(1, 3).detailOpacity);
    expect(planetDetail(0, 0.1).hitDiameter).toBe(8);
    expect(planetDetail(0, 0.1).visible).toBe(false);
  });
  it('uses original deterministic biome palettes and shader properties', () => {
    expect(biomeFromMap('DeepSpace', 16)).toBe(8);
    expect(biomeFromMap('DeadSpace', 0)).toBe(10);
    const world = planetCosmetic('123456789abcdef', 2, 4);
    expect(world).toEqual(planetCosmetic('123456789abcdef', 2, 4));
    expect(world.land).not.toEqual(world.ocean);
    expect(world.clouds).toBe(1);
    expect(world.beachMode).toBe(1);
    expect(planetCosmetic('abcdef123', 9, 4).morph).toBeGreaterThan(0);
  });
  it('keeps resource labels and ownership rings out of the low-detail neutral glyph', () => {
    const { container, rerender } = render(<MapPlanetGlyph name="P" level={0} planetType="Regular"
      energyFraction={0.6} selected={false} targeted={false} energy="600" owned={false} />);
    expect(container.querySelector('.planet-energy-value')).toBeNull();
    expect(container.querySelector('.planet-energy-ring')).toBeNull();
    rerender(<MapPlanetGlyph name="P" level={0} planetType="Regular" energyFraction={0.6}
      selected targeted={false} energy="600" owned showResources />);
    expect(container.querySelector('.planet-energy-value')).toHaveTextContent('600');
    expect(container.querySelector('.planet-energy-ring')).not.toBeNull();
  });
  it('retains a DOM fallback when the browser has no WebGL2', () => {
    const ready = vi.fn();
    const { container } = render(<MapPlanetBodies planets={[]} viewport={{ width: 393, height: 720 }} onReady={ready} />);
    expect(container.querySelector('canvas')).toHaveAttribute('data-renderer', 'dark-forest-round5');
    expect(ready).not.toHaveBeenCalled();
  });
});
