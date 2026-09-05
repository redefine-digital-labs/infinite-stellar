import type { CSSProperties } from 'react';

interface MapPlanetGlyphProps {
  name: string;
  level: number;
  planetType: string;
  energyFraction: number;
  selected: boolean;
  targeted: boolean;
  energy?: string;
  silver?: string;
  owned?: boolean;
  showResources?: boolean;
  showFacility?: boolean;
  simplified?: boolean;
  fallbackColor?: string;
}

/** Presentation only: both maps supply resources from their own authority. */
export function MapPlanetGlyph({ name, level, planetType, energyFraction, selected, targeted,
  energy, silver, owned = true, showResources = false, showFacility = true, simplified = false, fallbackColor }: MapPlanetGlyphProps) {
  const fill = Number.isFinite(energyFraction) ? Math.max(0, Math.min(1, energyFraction)) : 0;
  const symbol = planetType === 'SpacetimeRip' ? '◎'
    : planetType === 'SilverMine' ? '◆'
      : planetType === 'Ruins' ? '◇'
        : planetType === 'SilverBank' ? '▰' : '';
  return (
    <div className={`planet-glyph ${simplified ? 'is-simple' : ''}`} aria-hidden="true" data-kind={planetType}
      style={{ '--surface-mid': fallbackColor } as CSSProperties}>
      <div className="planet-surface" />
      {owned && <div className="planet-energy-ring" style={{ '--energy-angle': `${fill * 360}deg` } as CSSProperties} />}
      {showFacility && symbol && <div className="planet-facility">{symbol}</div>}
      {showResources && energy && <span className="planet-energy-value">{energy}</span>}
      {showResources && silver && <span className="planet-silver-value">{silver} Ag</span>}
      <div className={`planet-map-label ${selected || targeted ? 'is-visible' : ''}`}>
        <strong>{name}</strong>
        <small>{targeted ? 'TARGET · ' : selected ? 'SELECTED · ' : ''}LV {level} · {planetType === 'SpacetimeRip' ? 'SPACETIME RIP' : planetType.toUpperCase()}</small>
      </div>
    </div>
  );
}
