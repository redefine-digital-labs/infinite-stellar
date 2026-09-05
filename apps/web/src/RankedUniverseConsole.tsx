import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { exploredChunkArea, type RankedActionRequest, type RankedMapPlanet, type RankedMapView } from '@infinite-stellar/game-sdk';
import { FloatingPanel, type FloatingPanelPosition } from './FloatingPanel';
import { StatusPill } from './components';
import { MapPlanetGlyph } from './MapPlanetGlyph';
import { MapExplorationCoverage } from './MapExplorationCoverage';
import { MapVoyages } from './MapVoyages';
import { MapPlanetBodies } from './MapPlanetBodies';
import { MIN_PLANET_CAMERA_RADIUS, biomeFromMap, planetCosmetic, planetDetail, planetGlyphStyle, planetWorldRadius } from './planet-rendering';
import { mapPosition, mapToWorld, worldPixelScale, zoomAtMapPoint } from './map-camera';
import { useMapViewport } from './use-map-viewport';
import type { RankedMiningSnapshot, RankedBackupSnapshot, RankedBackupDownload } from './use-ranked-map';
import { RankedMapBackupControls } from './RankedMapBackupControls';
import { RankedActionControls } from './RankedActionControls';
import type { RankedActionState } from './use-ranked-actions';

export interface RankedUniverseConsoleProps {
  map: RankedMapView;
  hasPrivateRecord: boolean;
  protection?: string;
  soulId?: string;
  onRefresh: () => void;
  onBack: () => void;
  mining?: RankedMiningSnapshot;
  canMine?: boolean;
  miningBlocker?: string;
  needsHome?: boolean;
  onMine?: (center: { x: number; y: number }) => void;
  onCancelMining?: () => void;
  backup?: RankedBackupSnapshot;
  onExportBackup?: (passphrase: string) => Promise<RankedBackupDownload>;
  onImportBackup?: (raw: string, passphrase: string) => Promise<void>;
  refreshing?: boolean;
  action?: RankedActionState;
  actionsReady?: boolean;
  onSubmitAction?: (request: RankedActionRequest) => Promise<void>;
  onRecoverAction?: () => Promise<void>;
  onCancelAction?: () => void;
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

const MIN_RADIUS = MIN_PLANET_CAMERA_RADIUS;
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
  mining = { phase: 'idle' },
  canMine = false,
  miningBlocker,
  needsHome = false,
  onMine,
  onCancelMining,
  backup,
  onExportBackup,
  onImportBackup,
  refreshing = false,
  action = { status: 'idle' },
  actionsReady = false,
  onSubmitAction,
  onRecoverAction,
  onCancelAction,
}: RankedUniverseConsoleProps) {
  const home = map.planets.find((planet) => planet.isHome);
  const initialCamera = useMemo(() => fitCamera(map.planets, map.worldRadius), [map.planets, map.worldRadius]);
  const [camera, setCamera] = useState<Camera>(initialCamera);
  const [selectedId, setSelectedId] = useState(home?.objectId ?? map.planets[0]?.objectId);
  const [targetId, setTargetId] = useState<string>();
  const [aimingRoute, setAimingRoute] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [relocatingExplorer, setRelocatingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState('');
  const [positions, setPositions] = useState(initialPositions);
  const [visiblePanels, setVisiblePanels] = useState<Array<'status' | 'command'>>(['status', 'command']);
  const [focusedPanel, setFocusedPanel] = useState<'status' | 'command'>('command');
  const pan = useRef<PanGesture | undefined>(undefined);
  const { ref: mapRef, viewport: mapViewport } = useMapViewport();
  const position = (point: { x: number; y: number }) => mapPosition(point, camera, mapViewport);

  const selected = map.planets.find((planet) => planet.objectId === selectedId);
  const target = map.planets.find((planet) => planet.objectId === targetId);
  const [planetRendererReady, setPlanetRendererReady] = useState(false);
  const mapScale = worldPixelScale(camera, mapViewport);
  const voyageEndpoints = new Set(map.voyages.flatMap((voyage) => [voyage.fromPlanetId, voyage.toPlanetId]));
  const displayedPlanets = map.planets.flatMap((planet) => {
    const detail = planetDetail(planet.level, mapScale, planet.isHome || planet.owner === 'player' ||
      planet.objectId === selectedId || planet.objectId === targetId || voyageEndpoints.has(planet.objectId), map.planetRarity);
    return detail.visible ? [{ planet, detail, biome: biomeFromMap(planet.spaceType, planet.biomebase) }] : [];
  }).sort((a, b) => b.planet.level - a.planet.level);
  const planetBodies = displayedPlanets.map(({ planet, detail, biome }) => {
    const point = position(planet);
    return { id: planet.locationId, x: parseFloat(point.left) / 100 * mapViewport.width,
      y: parseFloat(point.top) / 100 * mapViewport.height, radius: detail.radius, opacity: detail.bodyOpacity,
      biome, level: planet.level, planetType: planet.planetType };
  });
  const maximumRadius = Math.max(MIN_RADIUS, map.worldRadius * 1.15);
  const zoom = Math.max(1, Math.round((maximumRadius / camera.radius) * 100));
  const backupBusy = backup?.phase === 'exporting' || backup?.phase === 'importing';

  useEffect(() => {
    if (selectedId && !map.planets.some((planet) => planet.objectId === selectedId)) {
      setSelectedId(home?.objectId ?? map.planets[0]?.objectId);
    }
    if (targetId && !map.planets.some((planet) => planet.objectId === targetId)) {
      setTargetId(undefined);
    }
  }, [home?.objectId, map.planets, selectedId, targetId]);

  const zoomCamera = (factor: number, anchor = { x: 50, y: 50 }) => setCamera((current) =>
    zoomAtMapPoint(current, Math.min(maximumRadius, Math.max(MIN_RADIUS, current.radius * factor)), anchor, mapViewport));
  const focusHome = () => {
    if (!home) return;
    setSelectedId(home.objectId);
    setCamera({ centerX: home.x, centerY: home.y, radius: Math.max(MIN_RADIUS, 260) });
  };
  const fit = () => setCamera(fitCamera(map.planets, map.worldRadius));
  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (relocatingExplorer) return;
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pan.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: camera.centerX,
      centerY: camera.centerY,
      width: bounds.width || mapViewport.width,
      height: bounds.height || mapViewport.height,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const continuePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = pan.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setCamera((current) => ({
      ...current,
      centerX: gesture.centerX - (event.clientX - gesture.startX) / worldPixelScale(current, gesture),
      centerY: gesture.centerY - (event.clientY - gesture.startY) / worldPixelScale(current, gesture),
    }));
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointerId !== event.pointerId) return;
    pan.current = undefined;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const wheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    zoomCamera(event.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR,
      { x: (event.clientX - bounds.left) / (bounds.width || mapViewport.width) * 100,
        y: (event.clientY - bounds.top) / (bounds.height || mapViewport.height) * 100 });
  };
  const keyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = camera.radius * 0.12;
    if (event.key === 'Escape') { setRelocatingExplorer(false); setAimingRoute(false); setSelectedId(undefined); setTargetId(undefined); }
    else if (event.key.toLowerCase() === 'q' && selected?.owner === 'player') setAimingRoute(true);
    else if (event.key === '+' || event.key === '=') zoomCamera(1 / ZOOM_FACTOR);
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

  const chooseExplorerPoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!relocatingExplorer || (event.target as HTMLElement).closest('.aim-status')) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = mapToWorld({ x: (event.clientX - bounds.left) / (bounds.width || mapViewport.width) * 100,
      y: (event.clientY - bounds.top) / (bounds.height || mapViewport.height) * 100 }, camera, mapViewport);
    const origin = { x: Math.round(point.x), y: Math.round(point.y) };
    if (Math.hypot(origin.x, origin.y) >= map.worldRadius) {
      setExplorerError('Choose an explorer origin inside this finite world.'); return;
    }
    setRelocatingExplorer(false); setExplorerError('');
    onMine?.(origin);
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
          <div><span className="map-mode-label">RANKED PRIVATE MAP</span><strong>{map.planets.length} known · {map.unmaterializedPlanets} unmaterialized</strong></div>
          <div className="map-legend"><span><i className="legend-player" /> Yours</span><span><i className="legend-rival" /> Rival</span><span><i className="legend-neutral" /> Unclaimed</span></div>
          <button className="button button-secondary compact-button" type="button" disabled={refreshing || backupBusy}
            onClick={onRefresh}>{refreshing ? 'Refreshing chain…' : 'Refresh chain'}</button>
          {(mining.phase === 'mining' || mining.phase === 'saving') && <button className="miner-cancel" type="button" onClick={onCancelMining}>Pause explorer</button>}
        </div>
        <div className="map-camera-controls" role="group" aria-label="Ranked map camera controls">
          <button type="button" aria-label="Zoom out" disabled={camera.radius >= maximumRadius} onClick={() => zoomCamera(ZOOM_FACTOR)}>−</button>
          <output aria-label="Ranked map zoom">{zoom}%</output>
          <button type="button" aria-label="Zoom in" disabled={camera.radius <= MIN_RADIUS} onClick={() => zoomCamera(1 / ZOOM_FACTOR)}>+</button>
          <button type="button" disabled={!home} onClick={focusHome}>Home</button>
          <button type="button" onClick={fit}>Fit</button>
          <button type="button" aria-pressed={visiblePanels.length === 0}
            onClick={() => setVisiblePanels(visiblePanels.length ? [] : ['status', 'command'])}>
            {visiblePanels.length ? 'Clear view' : 'Restore panels'}
          </button>
        </div>
        <div
          ref={mapRef}
          className={`star-map ${planetRendererReady ? 'has-planet-renderer' : ''} ${isPanning ? 'is-panning' : ''} ${relocatingExplorer ? 'is-aiming' : ''}`}
          tabIndex={0}
          aria-label="Ranked star map. Drag empty space to pan; use wheel or plus and minus to zoom."
          onPointerDown={beginPan}
          onPointerMove={continuePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={wheel}
          onKeyDown={keyboard}
          onClickCapture={chooseExplorerPoint}
        >
          <MapExplorationCoverage chunks={map.exploredChunks ?? []} active={mining.chunks ?? []}
            origin={mining.origin ?? map.explorationOrigin} centerX={camera.centerX} centerY={camera.centerY} radius={camera.radius} viewport={mapViewport} />
          <MapPlanetBodies planets={planetBodies} viewport={mapViewport} onReady={setPlanetRendererReady} />
          {relocatingExplorer && <div className="aim-status" role="status">
            <strong>Click the map to move the explorer. This does not send a fleet.</strong>
            {explorerError && <span>{explorerError}</span>}
            <button type="button" onClick={() => setRelocatingExplorer(false)}>Cancel explorer placement (Esc)</button>
          </div>}
          {aimingRoute && <div className="aim-status" role="status">
            <strong>Choose a different Planet for this fleet. No transaction is sent until you confirm.</strong>
            <button type="button" onClick={() => setAimingRoute(false)}>Cancel target selection</button>
          </div>}
          <span className="map-crosshair map-crosshair-x" aria-hidden="true" />
          <span className="map-crosshair map-crosshair-y" aria-hidden="true" />
          {displayedPlanets.map(({ planet, detail, biome }) => (
            <button
              key={planet.objectId}
              type="button"
              className={`map-planet owner-${planet.owner} space-${planet.spaceType.toLowerCase()} ${planet.planetType === 'SpacetimeRip' ? 'type-spacetime-rip' : ''} ${selectedId === planet.objectId ? 'is-selected' : ''} ${targetId === planet.objectId ? 'is-targeted' : ''} ${planet.materialized ? '' : 'is-unmaterialized'}`}
              data-detail={detail.simplified ? 'point' : detail.showResources ? 'resources' : 'body'}
              style={{ ...position(planet), ...planetGlyphStyle(detail) }}
              onClick={() => {
                if (aimingRoute && selected && selected.objectId !== planet.objectId) {
                  setTargetId(planet.objectId); setAimingRoute(false);
                } else if (!aimingRoute) {
                  setSelectedId(planet.objectId); setTargetId(undefined);
                }
                setFocusedPanel('command');
                setVisiblePanels((current) => current.includes('command') ? current : [...current, 'command']);
              }}
              onDoubleClick={() => setCamera({ centerX: planet.x, centerY: planet.y,
                radius: Math.max(MIN_RADIUS, Math.min(camera.radius,
                  Math.min(mapViewport.width, mapViewport.height) * 0.46 * planetWorldRadius(planet.level, map.planetRarity) / 24)) })}
              aria-label={`${planetName(planet)}, level ${planet.level}, ${planet.owner}, ${planet.materialized ? 'onchain' : 'not yet onchain'}`}
            ><MapPlanetGlyph name={planetName(planet)} level={planet.level} planetType={planet.planetType}
              energyFraction={planet.energyCapacity > 0n ? Number(planet.energy * 1000n / planet.energyCapacity) / 1000 : 0}
              energy={planet.energy > 0n ? compact(planet.energy) : undefined}
              silver={planet.silver > 0n ? compact(planet.silver) : undefined} owned={planet.owner !== 'neutral'}
              showResources={detail.showResources || selectedId === planet.objectId || targetId === planet.objectId}
              showFacility={detail.showFacility} simplified={detail.simplified}
              fallbackColor={planetCosmetic(planet.locationId, biome, planet.level).fallbackColor}
              selected={selectedId === planet.objectId} targeted={targetId === planet.objectId} /></button>
          ))}
          <svg className="voyage-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {selected && target && selected.objectId !== target.objectId && (
              <line className="map-route-preview" x1={Number.parseFloat(position(selected).left)}
                y1={Number.parseFloat(position(selected).top)}
                x2={Number.parseFloat(position(target).left)} y2={Number.parseFloat(position(target).top)}
                vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          <MapVoyages viewport={mapViewport} ranked voyages={map.voyages.flatMap((voyage) => {
            const from = map.planets.find((planet) => planet.objectId === voyage.fromPlanetId);
            const to = map.planets.find((planet) => planet.objectId === voyage.toPlanetId);
            if (!from || !to) return [];
            const start = position(from);
            const end = position(to);
            return [{ id: voyage.id, from: { x: parseFloat(start.left), y: parseFloat(start.top) },
              to: { x: parseFloat(end.left), y: parseFloat(end.top) },
              departureAt: Number(voyage.departureAtSeconds), arrivalAt: Number(voyage.arrivalAtSeconds),
              energy: compact(voyage.energyArriving), silver: voyage.silverMoved > 0n ? compact(voyage.silverMoved) : undefined,
              owner: voyage.owner, kind: voyage.kind, artifact: Boolean(voyage.carriedArtifactId) }];
          })} />
          {map.planets.length === 0 && (
            <div className="ranked-map-empty">
              <strong>{hasPrivateRecord ? 'No coordinates have been discovered yet.' : 'This device has no private map for the Seat.'}</strong>
              <span>{needsHome ? 'Explore a sector to find private home candidates. Claiming still requires a verified proof and chain finality.' : 'Chain ownership is intact. Restore the encrypted map backup or return on the device that mined it.'}</span>
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
          <RankedMapBackupControls
            key={`${map.identity.chainIdentifier}:${map.identity.packageId}:${map.identity.seasonId}:${map.identity.seatId}:${map.identity.controllerAddress}`}
            status={backup} protection={protection} disabled={refreshing || mining.phase === 'mining' || mining.phase === 'saving'}
            onExport={onExportBackup} onImport={onImportBackup} />
        </div>
      ))}

      {panel('command', 'Planet & route', 'CHAIN STATE · PRIVATE POSITION', (
        <div className="command-panel floating-command-panel ranked-command-content">
          <div className="ranked-exploration">
            <strong>Continuous private explorer</strong>
            <p>Search outward from an origin until paused. Completed 16-unit chunks, including empty space, are saved and skipped on resume. Discoveries do not claim a Planet.</p>
            <p>{exploredChunkArea(map.exploredChunks ?? []).toLocaleString()} units² searched · coordinates stay on this device.</p>
            <div className="button-row">
              <button className="button button-secondary compact-button" type="button"
                disabled={!canMine || !onMine || backupBusy || refreshing || mining.phase === 'mining' || mining.phase === 'saving'}
                onClick={() => onMine?.({ x: Math.round(camera.centerX), y: Math.round(camera.centerY) })}>Explore here</button>
              <button className="button button-secondary compact-button" type="button" disabled={!canMine || !onMine || backupBusy || refreshing}
                onClick={() => { onCancelMining?.(); setRelocatingExplorer(true); setExplorerError(''); setVisiblePanels([]); mapRef.current?.focus({ preventScroll: true }); }}>Move explorer</button>
              <button className="button button-secondary compact-button" type="button"
                disabled={!canMine || !onMine || backupBusy || refreshing || mining.phase === 'mining' || mining.phase === 'saving'}
                onClick={() => {
                  const random = crypto.getRandomValues(new Uint32Array(2));
                  const angle = random[0]! / 2 ** 32 * Math.PI * 2;
                  const radius = Math.sqrt(random[1]! / 2 ** 32) * Math.max(0, map.worldRadius - 64);
                  const center = { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
                  setCamera({ centerX: center.x, centerY: center.y, radius: MIN_RADIUS });
                  onMine?.(center);
                }}>Random sector</button>
              {(mining.phase === 'mining' || mining.phase === 'saving') && <button className="button button-secondary compact-button" type="button" onClick={onCancelMining}>Pause explorer</button>}
              {map.explorationOrigin && <button className="button button-secondary compact-button" type="button"
                disabled={!canMine || !onMine || backupBusy || refreshing || mining.phase === 'mining' || mining.phase === 'saving'}
                onClick={() => onMine?.(map.explorationOrigin!)}>Resume explorer</button>}
            </div>
            <div role="status" aria-live="polite">
              {mining.phase === 'mining' && `Searching ${mining.progress?.checked ?? 0} / ${mining.progress?.total ?? 1024} · ${mining.progress?.found ?? 0} found`}
              {mining.phase === 'saving' && 'Validating and encrypting discoveries…'}
              {mining.message}
              {!canMine && (miningBlocker ?? 'Season exploration is not available.')}
            </div>
          </div>
          {selected ? <RankedPlanetReadout label="SELECTED PLANET" planet={selected} /> : <p>Select a known Planet.</p>}
          {selected && <button className="planet-focus" type="button" onClick={() => {
            setCamera({ centerX: selected.x, centerY: selected.y, radius: Math.max(MIN_RADIUS,
              Math.min(mapViewport.width, mapViewport.height) * 0.46 * planetWorldRadius(selected.level, map.planetRarity) / 24) });
            setVisiblePanels([]);
          }}>Focus planet</button>}
          {target && <RankedPlanetReadout label="TARGET" planet={target} />}
          <RankedActionControls selected={selected} target={target} needsHome={needsHome}
            ready={actionsReady} blocked={refreshing || backupBusy || mining.phase === 'saving'} state={action}
            onAim={() => { setAimingRoute(true); setRelocatingExplorer(false); setVisiblePanels([]); mapRef.current?.focus({ preventScroll: true }); }}
            onSubmit={onSubmitAction} onCancel={onCancelAction} onRecover={onRecoverAction} />
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
