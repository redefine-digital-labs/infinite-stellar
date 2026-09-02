import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import type { RankedMapPlanet, RankedMapView } from '@infinite-stellar/game-sdk';
import { FloatingPanel, type FloatingPanelPosition } from './FloatingPanel';
import { StatusPill } from './components';

export interface RankedUniverseConsoleProps {
  map: RankedMapView;
  hasPrivateRecord: boolean;
  protection?: string;
  soulId?: string;
  onRefresh: () => void;
  onBack: () => void;
}

interface Camera {
  centerX: number;
  centerY: number;
  radius: number;
}

interface PanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

const MIN_RADIUS = 120;
const ZOOM_FACTOR = 1.25;

function compact(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const units = [
    [1_000_000_000n, 'B'],
    [1_000_000n, 'M'],
    [1_000n, 'K'],
  ] as const;
  for (const [unit, suffix] of units) {
    if (absolute >= unit) {
      const whole = absolute / unit;
      const tenth = (absolute % unit) * 10n / unit;
      return `${negative ? '-' : ''}${whole}${tenth === 0n ? '' : `.${tenth}`}${suffix}`;
    }
  }
  return value.toString();
}

function planetName(planet: RankedMapPlanet): string {
  return `IS-${planet.locationId.slice(-5).toUpperCase()}`;
}

function fitCamera(planets: readonly RankedMapPlanet[], worldRadius: number): Camera {
  if (planets.length === 0) return { centerX: 0, centerY: 0, radius: Math.max(MIN_RADIUS, worldRadius) };
  const xs = planets.map((planet) => planet.x);
  const ys = planets.map((planet) => planet.y);
  const minimumX = Math.min(...xs);
  const maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys);
  const maximumY = Math.max(...ys);
  return {
    centerX: (minimumX + maximumX) / 2,
    centerY: (minimumY + maximumY) / 2,
    radius: Math.max(MIN_RADIUS, (maximumX - minimumX) * 0.62, (maximumY - minimumY) * 0.62),
  };
}

function mapPosition(planet: RankedMapPlanet, camera: Camera) {
  return {
    left: `${50 + ((planet.x - camera.centerX) / camera.radius) * 46}%`,
    top: `${50 + ((planet.y - camera.centerY) / camera.radius) * 46}%`,
  };
}

function initialPositions(): Record<'status' | 'command', FloatingPanelPosition> {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
  return {
    status: { x: 16, y: 152 },
    command: { x: Math.max(16, width - 390), y: 152 },
  };
}

export function RankedUniverseConsole({
  map,
  hasPrivateRecord,
  protection,
  soulId,
  onRefresh,
  onBack,
}: RankedUniverseConsoleProps) {
  const home = map.planets.find((planet) => planet.isHome);
  const initialCamera = useMemo(() => fitCamera(map.planets, map.worldRadius), [map.planets, map.worldRadius]);
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const [selectedId, setSelectedId] = useState(home?.objectId ?? map.planets[0]?.objectId);
  const [targetId, setTargetId] = useState<string>();
  const [isPanning, setIsPanning] = useState(false);
  const [positions, setPositions] = useState(initialPositions);
  const [visiblePanels, setVisiblePanels] = useState<Array<'status' | 'command'>>(['status', 'command']);
  const [focusedPanel, setFocusedPanel] = useState<'status' | 'command'>('command');
  const pan = useRef<PanGesture | undefined>(undefined);

  const selected = map.planets.find((planet) => planet.objectId === selectedId);
  const target = map.planets.find((planet) => planet.objectId === targetId);
  const maximumRadius = Math.max(MIN_RADIUS, map.worldRadius * 1.15);
  const zoom = Math.max(1, Math.round((maximumRadius / camera.radius) * 100));

  useEffect(() => {
    if (!map.planets.some((planet) => planet.objectId === selectedId)) {
      setSelectedId(home?.objectId ?? map.planets[0]?.objectId);
    }
    if (targetId && !map.planets.some((planet) => planet.objectId === targetId)) {
      setTargetId(undefined);
    }
  }, [home?.objectId, map.planets, selectedId, targetId]);

  const zoomCamera = (factor: number) => setCamera((current) => ({
    ...current,
    radius: Math.min(maximumRadius, Math.max(MIN_RADIUS, current.radius * factor)),
  }));
  const focusHome = () => {
    if (!home) return;
    setSelectedId(home.objectId);
    setCamera({ centerX: home.x, centerY: home.y, radius: Math.max(MIN_RADIUS, 260) });
  };
  const fit = () => setCamera(fitCamera(map.planets, map.worldRadius));
  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pan.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: camera.centerX,
      centerY: camera.centerY,
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const continuePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pan.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setCamera((current) => ({
      ...current,
      centerX: gesture.centerX - ((event.clientX - gesture.startX) / gesture.width) * current.radius * 2,
      centerY: gesture.centerY - ((event.clientY - gesture.startY) / gesture.height) * current.radius * 2,
    }));
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointerId !== event.pointerId) return;
    pan.current = undefined;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomCamera(event.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR);
  };
  const keyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = camera.radius * 0.12;
    if (event.key === '+' || event.key === '=') zoomCamera(1 / ZOOM_FACTOR);
    else if (event.key === '-' || event.key === '_') zoomCamera(ZOOM_FACTOR);
    else if (event.key.toLowerCase() === 'h') focusHome();
    else if (event.key === '0') fit();
    else if (event.key === 'ArrowLeft') setCamera((current) => ({ ...current, centerX: current.centerX - step }));
    else if (event.key === 'ArrowRight') setCamera((current) => ({ ...current, centerX: current.centerX + step }));
    else if (event.key === 'ArrowUp') setCamera((current) => ({ ...current, centerY: current.centerY - step }));
    else if (event.key === 'ArrowDown') setCamera((current) => ({ ...current, centerY: current.centerY + step }));
    else return;
    event.preventDefault();
  };

  const panel = (id: 'status' | 'command', title: string, eyebrow: string, children: ReactNode) =>
    visiblePanels.includes(id) && (
      <FloatingPanel
        panelId={`ranked-${id}`}
        title={title}
        eyebrow={eyebrow}
        position={positions[id]}
        zIndex={focusedPanel === id ? 61 : 60}
        focused={focusedPanel === id}
        className={id === 'status' ? 'mission-panel ranked-status-panel' : 'command-floating-panel ranked-command-panel'}
        onFocus={() => setFocusedPanel(id)}
        onMove={(position) => setPositions((current) => ({ ...current, [id]: position }))}
        onMinimize={() => setVisiblePanels((current) => current.filter((panelId) => panelId !== id))}
      >
        {children}
      </FloatingPanel>
    );

  return (
    <section className="strategy-console floating-strategy ranked-universe-console" aria-label="Ranked Infinite Stellar universe">
      <div className="strategy-map-canvas">
        <div className="map-toolbar floating-map-toolbar">
          <div><span>RANKED PRIVATE MAP</span><strong>{map.planets.length} known · {map.unmaterializedPlanets} unmaterialized</strong></div>
          <div className="map-legend"><span><i className="legend-player" /> Yours</span><span><i className="legend-rival" /> Rival</span><span><i className="legend-neutral" /> Unclaimed</span></div>
          <button className="button button-secondary compact-button" type="button" onClick={onRefresh}>Refresh chain</button>
        </div>
        <div className="map-camera-controls" role="group" aria-label="Ranked map camera controls">
          <button type="button" aria-label="Zoom out" disabled={camera.radius >= maximumRadius} onClick={() => zoomCamera(ZOOM_FACTOR)}>−</button>
          <output aria-label="Ranked map zoom">{zoom}%</output>
          <button type="button" aria-label="Zoom in" disabled={camera.radius <= MIN_RADIUS} onClick={() => zoomCamera(1 / ZOOM_FACTOR)}>+</button>
          <button type="button" disabled={!home} onClick={focusHome}>Home</button>
          <button type="button" onClick={fit}>Fit</button>
        </div>
        <div
          className={`star-map ${isPanning ? 'is-panning' : ''}`}
          tabIndex={0}
          aria-label="Ranked star map. Drag empty space to pan; use wheel or plus and minus to zoom."
          onPointerDown={beginPan}
          onPointerMove={continuePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={wheel}
          onKeyDown={keyboard}
        >
          <span className="map-ring ring-a" aria-hidden="true" />
          <span className="map-ring ring-b" aria-hidden="true" />
          <span className="map-crosshair map-crosshair-x" aria-hidden="true" />
          <span className="map-crosshair map-crosshair-y" aria-hidden="true" />
          {map.planets.map((planet) => (
            <button
              key={planet.objectId}
              type="button"
              className={`map-planet owner-${planet.owner} space-${planet.spaceType.toLowerCase()} ${planet.planetType === 'SpacetimeRip' ? 'type-spacetime-rip' : ''} ${selectedId === planet.objectId ? 'is-selected' : ''} ${targetId === planet.objectId ? 'is-targeted' : ''} ${planet.materialized ? '' : 'is-unmaterialized'}`}
              style={{ ...mapPosition(planet, camera), width: 10 + planet.level * 2, height: 10 + planet.level * 2 }}
              onClick={() => {
                if (selected?.owner === 'player' && selected.objectId !== planet.objectId) setTargetId(planet.objectId);
                else setSelectedId(planet.objectId);
                setFocusedPanel('command');
                setVisiblePanels((current) => current.includes('command') ? current : [...current, 'command']);
              }}
              onDoubleClick={() => setCamera({ centerX: planet.x, centerY: planet.y, radius: MIN_RADIUS })}
              aria-label={`${planetName(planet)}, level ${planet.level}, ${planet.owner}, ${planet.materialized ? 'onchain' : 'not yet onchain'}`}
            ><span /></button>
          ))}
          <svg className="voyage-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><marker id="ranked-voyage-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth" viewBox="0 0 6 6"><path d="M 0 0 L 6 3 L 0 6 z" /></marker></defs>
            {map.voyages.map((voyage) => {
              const from = map.planets.find((planet) => planet.objectId === voyage.fromPlanetId);
              const to = map.planets.find((planet) => planet.objectId === voyage.toPlanetId);
              if (!from || !to) return null;
              const start = mapPosition(from, camera);
              const end = mapPosition(to, camera);
              return <line key={voyage.id} className="voyage-route" x1={Number.parseFloat(start.left)} y1={Number.parseFloat(start.top)} x2={Number.parseFloat(end.left)} y2={Number.parseFloat(end.top)} vectorEffect="non-scaling-stroke" markerEnd="url(#ranked-voyage-arrow)" />;
            })}
          </svg>
          {map.planets.length === 0 && (
            <div className="ranked-map-empty">
              <strong>{hasPrivateRecord ? 'No coordinates have been discovered yet.' : 'This device has no private map for the Seat.'}</strong>
              <span>Chain ownership is intact. Restore the encrypted map backup or return on the device that mined it.</span>
            </div>
          )}
          <div className="scan-readout"><span>CHAIN SNAPSHOT</span><strong>{map.snapshotFingerprint.slice(0, 12)}…</strong><small>{protection ?? 'vault unavailable'} · private coordinates never uploaded</small></div>
        </div>
      </div>

      {panel('status', 'Ranked universe', 'SOUL · SEAT · SNAPSHOT', (
        <div className="mission-window">
          <StatusPill tone="live">CHAIN-AUTHORITATIVE READ</StatusPill>
          <div className="mission-title">One Seat.<br />One hidden sky.</div>
          <p>Soul <strong>{soulId?.slice(0, 12) ?? 'detached'}…</strong> names the Commander. The fixed Seat owns all ranked control.</p>
          <div className="strategy-kpis floating-kpis">
            <div><span>KNOWN</span><strong>{map.planets.length}</strong></div>
            <div><span>ONCHAIN</span><strong>{map.planets.length - map.unmaterializedPlanets}</strong></div>
            <div><span>VOYAGES</span><strong>{map.voyages.length}</strong></div>
            <div><span>HIDDEN</span><strong>{map.hiddenChainPlanets}</strong></div>
          </div>
          <button className="reset-panel-layout" type="button" onClick={onBack}>Release readiness</button>
        </div>
      ))}

      {panel('command', 'Planet & route', 'CHAIN STATE · PRIVATE POSITION', (
        <div className="command-panel floating-command-panel ranked-command-content">
          {selected ? <RankedPlanetReadout label="ORIGIN" planet={selected} /> : <p>Select a known Planet.</p>}
          {target && <RankedPlanetReadout label="TARGET" planet={target} />}
          <div className="ranked-command-lock">
            <strong>Ranked writes remain sealed</strong>
            <span>The map is real chain state. Fleet signing unlocks only with audited production proof keys and release evidence.</span>
          </div>
        </div>
      ))}

      <nav className="strategy-panel-dock ranked-panel-dock" aria-label="Ranked command window dock">
        {(['status', 'command'] as const).map((id) => (
          <button key={id} type="button" aria-pressed={visiblePanels.includes(id)} className={focusedPanel === id && visiblePanels.includes(id) ? 'is-active' : ''} onClick={() => {
            setVisiblePanels((current) => current.includes(id) ? current : [...current, id]);
            setFocusedPanel(id);
          }}><span aria-hidden="true">{id === 'status' ? '✦' : '◎'}</span><strong>{id === 'status' ? 'Universe' : 'Planet & route'}</strong></button>
        ))}
      </nav>
    </section>
  );
}

function RankedPlanetReadout({ label, planet }: { label: string; planet: RankedMapPlanet }) {
  return (
    <section className="command-section">
      <span className="command-label">{label}</span>
      <article className={`planet-readout owner-${planet.owner}`}>
        <header><div><small>LEVEL {planet.level} · {planet.spaceType}</small><h2>{planetName(planet)}</h2></div><span>{planet.owner.toUpperCase()}</span></header>
        <p>{planet.planetType} · {planet.materialized ? 'ONCHAIN' : 'LOCAL DISCOVERY'}</p>
        <div className="resource-bar"><span style={{ width: `${planet.energyCapacity === 0n ? 0 : Math.min(100, Number(planet.energy * 100n / planet.energyCapacity))}%` }} /></div>
        <dl>
          <div><dt>ENERGY</dt><dd>{compact(planet.energy)} / {compact(planet.energyCapacity)}</dd></div>
          <div><dt>SILVER</dt><dd>{compact(planet.silver)} / {compact(planet.silverCapacity)}</dd></div>
          <div><dt>RANGE</dt><dd>{compact(planet.range)}</dd></div>
          <div><dt>NONCE</dt><dd>{planet.proofNonce.toString()}</dd></div>
        </dl>
      </article>
    </section>
  );
}
