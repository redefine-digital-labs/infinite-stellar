import type { CSSProperties } from 'react';

interface MapPlanetGlyphProps {
  name: string;
  level: number;
  planetType: string;
  energyFraction: number;
  selected: boolean;
  targeted: boolean;
}

/** Presentation only: both maps supply resources from their own authority. */
export function MapPlanetGlyph({ name, level, planetType, energyFraction, selected, targeted }: MapPlanetGlyphProps) {
  const fill = Number.isFinite(energyFraction) ? Math.max(0, Math.min(1, energyFraction)) : 0;
  const symbol = planetType === 'SpacetimeRip' ? '◎'
    : planetType === 'SilverMine' ? '◆'
      : planetType === 'Ruins' ? '◇'
        : planetType === 'SilverBank' ? '▰' : '';
  return (
    <div className="planet-glyph" aria-hidden="true" data-kind={planetType}>
      <div className="planet-surface" />
      <div className="planet-energy-ring" style={{ '--energy-angle': `${fill * 360}deg` } as CSSProperties} />
      {symbol && <div className="planet-facility">{symbol}</div>}
      <div className={`planet-map-label ${selected || targeted ? 'is-visible' : ''}`}>
        <strong>{name}</strong>
        <small>{targeted ? 'TARGET · ' : selected ? 'SELECTED · ' : ''}LV {level} · {planetType === 'SpacetimeRip' ? 'SPACETIME RIP' : planetType.toUpperCase()}</small>
      </div>
    </div>
  );
}
