import { useEffect, useState } from 'react';
import type { MapPoint, MapViewport } from './map-camera';

export interface MapVoyage {
  id: string;
  from: MapPoint;
  to: MapPoint;
  departureAt: number;
  arrivalAt: number;
  energy: string;
  silver?: string;
  owner: 'player' | 'rival' | 'neutral';
  kind: 'fleet' | 'ship' | 'abandon';
  artifact: boolean;
}

export function voyageProgress(departureAt: number, arrivalAt: number, now: number): number {
  if (![departureAt, arrivalAt, now].every(Number.isFinite) || arrivalAt <= departureAt) return 1;
  return Math.max(0, Math.min(1, (now - departureAt) / (arrivalAt - departureAt)));
}

/** All routes/points use the same camera projection. Only this overlay ticks at 30fps.
 * The visual clock never settles a ranked Voyage or changes resources/ownership.
 */
export function MapVoyages({ voyages, viewport, clock, ranked = false }: {
  voyages: MapVoyage[];
  viewport: MapViewport;
  clock?: { seconds: number; observedAtMs?: number };
  ranked?: boolean;
}) {
  const [wallNow, setWallNow] = useState(Date.now);
  const active = voyages.length > 0;
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    let last = 0;
    const update = (timestamp: number) => {
      if (timestamp - last >= 1000 / 30) { last = timestamp; setWallNow(Date.now()); }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  const now = ranked ? wallNow / 1000 : (clock?.seconds ?? 0) +
    (clock?.observedAtMs === undefined ? 0 : Math.max(0, wallNow - clock.observedAtMs) / 1000);
  return <div className="voyage-layer fleet-layer" aria-label="Fleets in flight">
    <svg className="voyage-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {voyages.map((voyage) => <line className={`voyage-route owner-${voyage.owner}`} key={voyage.id}
        data-testid={`voyage-route-${voyage.id}`} x1={voyage.from.x} y1={voyage.from.y}
        x2={voyage.to.x} y2={voyage.to.y} vectorEffect="non-scaling-stroke" />)}
    </svg>
    {voyages.map((voyage) => {
      const progress = voyageProgress(voyage.departureAt, voyage.arrivalAt, now);
      const x = voyage.from.x + (voyage.to.x - voyage.from.x) * progress;
      const y = voyage.from.y + (voyage.to.y - voyage.from.y) * progress;
      const angle = Math.atan2((voyage.to.y - voyage.from.y) * viewport.height,
        (voyage.to.x - voyage.from.x) * viewport.width) * 180 / Math.PI;
      const remaining = Math.max(0, Math.ceil(voyage.arrivalAt - now));
      const eta = remaining === 0 ? ranked ? 'Awaiting settlement' : 'Arriving' : `${remaining}s`;
      const cargo = voyage.kind === 'ship' ? 'Ship' : `${voyage.energy} energy`;
      return <div key={voyage.id} className={`map-fleet owner-${voyage.owner} kind-${voyage.kind} ${progress >= 1 ? 'is-arrived' : ''}`}
        data-testid={`voyage-fleet-${voyage.id}`} data-progress={progress.toFixed(6)}
        style={{ left: `${x}%`, top: `${y}%` }} aria-label={`${cargo}, ${eta}`}>
        <span className="fleet-heading" style={{ transform: `rotate(${angle}deg)` }} aria-hidden="true">
          <i className="fleet-tail" /><i className="fleet-core" />
        </span>
        <span className="fleet-cargo">{voyage.kind === 'ship' ? '◇ SHIP' : voyage.energy}
          {voyage.artifact && voyage.kind !== 'ship' && <i className="fleet-artifact" title="Artifact aboard"> ◇</i>}
          {voyage.silver && <i className="fleet-silver"> +{voyage.silver} Ag</i>}</span>
        <span className="fleet-eta">{eta}</span>
      </div>;
    })}
  </div>;
}
