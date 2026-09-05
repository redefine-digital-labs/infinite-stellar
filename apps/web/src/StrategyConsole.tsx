import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  controlledPlanetCount,
  round5ArrivingEnergy,
  round5TravelTime,
  type Round5UpgradeBranch,
  type StrategyGame,
  type StrategyPlanet,
} from '@infinite-stellar/game-sdk';
import { Eyebrow, StatusPill } from './components';
import { FloatingPanel, type FloatingPanelPosition } from './FloatingPanel';
import { MapPlanetGlyph } from './MapPlanetGlyph';
import type { PlayerVaultState, StrategyMiningState } from './use-player-journey';
import type { ProofReadinessState } from './use-proof-readiness';

export interface StrategyConsoleProps {
  game: StrategyGame;
  commanderName?: string;
  onChoosePlanet: (planetId: string) => void;
  onSetTarget: (planetId: string) => void;
  onScan: () => void;
  onCancelScan: () => void;
  mining: StrategyMiningState;
  vault: PlayerVaultState;
  proofReadiness: ProofReadinessState;
  onDispatch: (percentage: number, silverMoved?: number) => void;
  onAdvanceArrival: () => void;
  onAdvanceTime: (seconds: number) => void;
  onUpgrade: (branch: Round5UpgradeBranch) => void;
  onClaimShips: () => void;
  onDispatchShip: (artifactId: string) => void;
  onDispatchArtifact: (artifactId: string) => void;
  onActivateCrescent: (artifactId: string) => void;
  onActivateArtifact: (artifactId: string) => void;
  onDeactivateArtifact: (artifactId?: string) => void;
  onWithdrawArtifact: (artifactId: string) => void;
  onDepositArtifact: (artifactId: string) => void;
  onProspect: () => void;
  onFindArtifact: () => void;
  onInvade: () => void;
  onCapture: () => void;
  onReveal: () => void;
  onWithdrawSilver: () => void;
  onAbandon: (artifactId?: string) => void;
  onSettle: () => void;
}

type PanelId = 'mission' | 'command' | 'artifacts' | 'voyages' | 'log';

const PANEL_IDS: PanelId[] = ['mission', 'command', 'artifacts', 'voyages', 'log'];
const DEFAULT_VISIBLE: PanelId[] = ['mission', 'command', 'log'];
const DEFAULT_ORDER: PanelId[] = ['mission', 'artifacts', 'voyages', 'log', 'command'];
const MOBILE_PANEL_BREAKPOINT = 560;
const TOP_HUD_CLEARANCE = 140;
const PANEL_LAYOUT_KEY = 'infinite-stellar:strategy-panels:v2';
const MIN_CAMERA_RADIUS = 120;
const HOME_CAMERA_RADIUS = 260;
const CAMERA_ZOOM_FACTOR = 1.25;
const PANEL_DIMENSIONS: Record<PanelId, { width: number; safeHeight: number }> = {
  mission: { width: 310, safeHeight: 190 },
  command: { width: 370, safeHeight: 260 },
  artifacts: { width: 390, safeHeight: 220 },
  voyages: { width: 350, safeHeight: 180 },
  log: { width: 420, safeHeight: 180 },
};

const PANEL_LABELS: Record<PanelId, string> = {
  mission: 'Commander',
  command: 'Planet & fleet',
  artifacts: 'Artifacts & ships',
  voyages: 'Voyages',
  log: 'Command log',
};

interface MapCamera {
  centerX: number;
  centerY: number;
  radius: number;
  mode: 'fit' | 'manual';
  homeId?: string;
}

interface MapPanGesture {
  pointerId: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

function compact(value: number): string {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function planetTypeLabel(planet: StrategyPlanet): string {
  return planet.planetType === 'SpacetimeRip' ? 'Spacetime Rip' : planet.planetType;
}

function clock(value: number): string {
  const hours = Math.floor(value / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((value % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function planetPosition(planet: StrategyPlanet, radius: number, centerX: number, centerY: number) {
  return {
    left: `${50 + ((planet.x - centerX) / radius) * 46}%`,
    top: `${50 + ((planet.y - centerY) / radius) * 46}%`,
  };
}

function viewportSize() {
  if (typeof window === 'undefined') return { width: 1440, height: 900 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function defaultPanelPositions(): Record<PanelId, FloatingPanelPosition> {
  const { width, height } = viewportSize();
  const top = TOP_HUD_CLEARANCE;
  return {
    mission: { x: 18, y: top },
    command: { x: Math.max(18, width - 388), y: top },
    artifacts: { x: 18, y: Math.max(300, height - 430) },
    voyages: { x: Math.max(18, width - 368), y: Math.max(420, height - 260) },
    log: { x: Math.max(18, Math.floor(width / 2) - 210), y: Math.max(420, height - 225) },
  };
}

function initialVisiblePanels(): PanelId[] {
  const { width } = viewportSize();
  if (width <= MOBILE_PANEL_BREAKPOINT) return [];
  if (width <= 900) return [];
  return DEFAULT_VISIBLE;
}

function clampPanelPosition(panelId: PanelId, position: FloatingPanelPosition) {
  const { width, height } = viewportSize();
  const dimensions = PANEL_DIMENSIONS[panelId];
  return {
    x: Math.max(8, Math.min(position.x, Math.max(8, width - dimensions.width - 8))),
    y: Math.max(
      TOP_HUD_CLEARANCE,
      Math.min(position.y, Math.max(TOP_HUD_CLEARANCE, height - dimensions.safeHeight)),
    ),
  };
}

function loadPanelPositions(): Record<PanelId, FloatingPanelPosition> {
  const defaults = defaultPanelPositions();
  if (typeof window === 'undefined') return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PANEL_LAYOUT_KEY) ?? '{}') as
      Partial<Record<PanelId, FloatingPanelPosition>>;
    return Object.fromEntries(PANEL_IDS.map((panelId) => {
      const value = parsed[panelId];
      const position = value && Number.isFinite(value.x) && Number.isFinite(value.y)
        ? value
        : defaults[panelId];
      return [panelId, clampPanelPosition(panelId, position)];
    })) as Record<PanelId, FloatingPanelPosition>;
  } catch {
    return defaults;
  }
}

export function StrategyConsole({
  game,
  commanderName,
  onChoosePlanet,
  onSetTarget,
  onScan,
  onCancelScan,
  mining,
  vault,
  proofReadiness,
  onDispatch,
  onAdvanceArrival,
  onAdvanceTime,
  onUpgrade,
  onClaimShips,
  onDispatchShip,
  onDispatchArtifact,
  onActivateCrescent,
  onActivateArtifact,
  onDeactivateArtifact,
  onWithdrawArtifact,
  onDepositArtifact,
  onProspect,
  onFindArtifact,
  onInvade,
  onCapture,
  onReveal,
  onWithdrawSilver,
  onAbandon,
  onSettle,
}: StrategyConsoleProps) {
  const [energyPercentage, setEnergyPercentage] = useState(60);
  const [silverMoved, setSilverMoved] = useState(0);
  const [positions, setPositions] = useState(loadPanelPositions);
  const [visiblePanels, setVisiblePanels] = useState<PanelId[]>(initialVisiblePanels);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(DEFAULT_ORDER);
  const [compactPanels, setCompactPanels] = useState(() => viewportSize().width <= MOBILE_PANEL_BREAKPOINT);
  const [isPanning, setIsPanning] = useState(false);
  const mapPan = useRef<MapPanGesture | undefined>(undefined);

  const source = game.planets.find((planet) => planet.id === game.selectedPlanetId);
  const target = game.planets.find((planet) => planet.id === game.targetPlanetId);
  const activeRift = source?.planetType === 'SpacetimeRip'
    ? source
    : target?.planetType === 'SpacetimeRip' ? target : undefined;
  const controlsActiveRift = activeRift !== undefined
    && activeRift.id === source?.id
    && activeRift.owner === 'player';
  const distance = source && target ? Math.floor(Math.hypot(source.x - target.x, source.y - target.y)) : 0;
  const previewSent = source ? Math.floor((source.energy * energyPercentage) / 100) : 0;
  const previewArrival = source && target
    ? round5ArrivingEnergy(previewSent, distance, source.range, source.energyCapacity)
    : 0;
  const previewTravel = source && target ? round5TravelTime(distance, source.speed) : 0;
  const sourceArtifacts = source
    ? game.artifacts.filter((artifact) => artifact.planetId === source.id)
    : [];
  const targetArtifacts = target
    ? game.artifacts.filter((artifact) => artifact.planetId === target.id)
    : [];
  const walletArtifacts = game.artifacts.filter((artifact) => artifact.externalOwner === 'player');
  const home = game.planets.find((planet) => planet.isHome);
  const centerX = home?.x ?? 0;
  const centerY = home?.y ?? 0;
  const farthestDiscovered = game.planets.reduce((farthest, planet) => planet.discovered
    ? Math.max(farthest, Math.hypot(planet.x - centerX, planet.y - centerY))
    : farthest, 0);
  const viewportRadius = Math.max(
    220,
    Math.min(game.worldRadius, Math.ceil(Math.max(game.scanRadius, farthestDiscovered) * 1.15)),
  );
  const maximumCameraRadius = Math.min(
    game.worldRadius,
    Math.max(1_000, viewportRadius * 2),
  );
  const [camera, setCamera] = useState<MapCamera>(() => ({
    centerX,
    centerY,
    radius: viewportRadius,
    mode: 'fit',
    homeId: home?.id,
  }));
  const cameraRadius = Math.max(
    MIN_CAMERA_RADIUS,
    Math.min(maximumCameraRadius, camera.radius),
  );
  const cameraZoom = Math.round((viewportRadius / cameraRadius) * 100);
  const focusedPanel = useMemo(
    () => [...panelOrder].reverse().find((panelId) => visiblePanels.includes(panelId)) ?? 'command',
    [panelOrder, visiblePanels],
  );
  const miningPercent = mining.total > 0
    ? Math.min(100, Math.floor((mining.checked / mining.total) * 100))
    : 0;
  const vaultLabel = vault.status === 'sealed'
    ? 'AES-GCM · INDEXEDDB'
    : vault.status === 'ephemeral'
      ? 'MEMORY ONLY'
      : vault.status === 'error' ? 'VAULT ERROR' : 'RESTORING';

  useEffect(() => {
    setSilverMoved((current) => Math.min(current, Math.floor(source?.silver ?? 0)));
  }, [source?.id, source?.silver]);

  useEffect(() => {
    setCamera((current) => {
      if (current.homeId !== home?.id || current.mode === 'fit') {
        return {
          centerX,
          centerY,
          radius: viewportRadius,
          mode: 'fit',
          homeId: home?.id,
        };
      }
      const radius = Math.max(MIN_CAMERA_RADIUS, Math.min(maximumCameraRadius, current.radius));
      return radius === current.radius ? current : { ...current, radius };
    });
  }, [centerX, centerY, home?.id, maximumCameraRadius, viewportRadius]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(positions));
    } catch {
      // The game remains usable when private browsing blocks layout storage.
    }
  }, [positions]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setCompactPanels(window.innerWidth <= MOBILE_PANEL_BREAKPOINT);
      setPositions((current) => Object.fromEntries(PANEL_IDS.map((panelId) => [
        panelId,
        clampPanelPosition(panelId, current[panelId]),
      ])) as Record<PanelId, FloatingPanelPosition>);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const focusPanel = (panelId: PanelId) => {
    setVisiblePanels((current) => current.includes(panelId) ? current : [...current, panelId]);
    setPanelOrder((current) => [...current.filter((candidate) => candidate !== panelId), panelId]);
  };

  const minimizePanel = (panelId: PanelId) => {
    setVisiblePanels((current) => current.filter((candidate) => candidate !== panelId));
  };

  const movePanel = (panelId: PanelId, position: FloatingPanelPosition) => {
    setPositions((current) => ({ ...current, [panelId]: clampPanelPosition(panelId, position) }));
  };

  const resetPanelLayout = () => {
    setPositions(defaultPanelPositions());
    setVisiblePanels(initialVisiblePanels());
    setPanelOrder(DEFAULT_ORDER);
  };

  const zoomCamera = (factor: number) => {
    setCamera((current) => ({
      ...current,
      radius: Math.max(
        MIN_CAMERA_RADIUS,
        Math.min(maximumCameraRadius, current.radius * factor),
      ),
      mode: 'manual',
    }));
  };

  const fitDiscoveredUniverse = () => {
    setCamera({
      centerX,
      centerY,
      radius: viewportRadius,
      mode: 'fit',
      homeId: home?.id,
    });
  };

  const returnToHome = () => {
    if (!home) return;
    setCamera({
      centerX: home.x,
      centerY: home.y,
      radius: Math.min(viewportRadius, HOME_CAMERA_RADIUS),
      mode: 'manual',
      homeId: home.id,
    });
    onChoosePlanet(home.id);
    focusPanel('command');
  };

  const focusPlanet = (planet: StrategyPlanet) => {
    setCamera((current) => ({
      centerX: planet.x,
      centerY: planet.y,
      radius: Math.min(current.radius, HOME_CAMERA_RADIUS),
      mode: 'manual',
      homeId: home?.id,
    }));
  };

  const handleMapWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    zoomCamera(event.deltaY < 0 ? 1 / CAMERA_ZOOM_FACTOR : CAMERA_ZOOM_FACTOR);
  };

  const panCamera = (deltaX: number, deltaY: number) => {
    setCamera((current) => ({
      ...current,
      centerX: Math.max(-game.worldRadius, Math.min(game.worldRadius, current.centerX + deltaX)),
      centerY: Math.max(-game.worldRadius, Math.min(game.worldRadius, current.centerY + deltaY)),
      mode: 'manual',
    }));
  };

  const beginMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const fallback = viewportSize();
    mapPan.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX: camera.centerX,
      centerY: camera.centerY,
      width: bounds.width || fallback.width,
      height: bounds.height || fallback.height,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const continueMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = mapPan.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const worldPerPixelX = cameraRadius / (gesture.width * 0.46);
    const worldPerPixelY = cameraRadius / (gesture.height * 0.46);
    setCamera((current) => ({
      ...current,
      centerX: Math.max(
        -game.worldRadius,
        Math.min(game.worldRadius, gesture.centerX - (event.clientX - gesture.startX) * worldPerPixelX),
      ),
      centerY: Math.max(
        -game.worldRadius,
        Math.min(game.worldRadius, gesture.centerY - (event.clientY - gesture.startY) * worldPerPixelY),
      ),
      mode: 'manual',
    }));
  };

  const endMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mapPan.current?.pointerId !== event.pointerId) return;
    mapPan.current = undefined;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleMapKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomCamera(1 / CAMERA_ZOOM_FACTOR);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomCamera(CAMERA_ZOOM_FACTOR);
    } else if (event.key === '0') {
      event.preventDefault();
      fitDiscoveredUniverse();
    } else if (event.key.toLowerCase() === 'h') {
      event.preventDefault();
      returnToHome();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      panCamera(-cameraRadius * 0.1, 0);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      panCamera(cameraRadius * 0.1, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      panCamera(0, -cameraRadius * 0.1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      panCamera(0, cameraRadius * 0.1);
    }
  };

  const panelIsRendered = (panelId: PanelId) => visiblePanels.includes(panelId) &&
    (!compactPanels || focusedPanel === panelId);

  const panelFrame = (panelId: PanelId, eyebrow: string, className: string, children: ReactNode) => {
    if (!panelIsRendered(panelId)) return null;
    return (
      <FloatingPanel
        panelId={panelId}
        title={PANEL_LABELS[panelId]}
        eyebrow={eyebrow}
        position={positions[panelId]}
        zIndex={20 + panelOrder.indexOf(panelId)}
        focused={focusedPanel === panelId}
        movable={!compactPanels}
        className={className}
        onFocus={() => focusPanel(panelId)}
        onMove={(position) => movePanel(panelId, position)}
        onMinimize={() => minimizePanel(panelId)}
      >
        {children}
      </FloatingPanel>
    );
  };

  if (game.settled) {
    return (
      <section className="last-light" aria-labelledby="last-light-title">
        <StatusPill tone="live">FINAL RECEIPT · LOCAL</StatusPill>
        <Eyebrow>LAST LIGHT</Eyebrow>
        <h1 id="last-light-title">The universe closes.<br />The Soul remembers.</h1>
        <p>{commanderName ?? 'Your Commander'} completed this finite world with a frozen local outcome.</p>
        <div className="last-light-score"><span>FINAL SCORE</span><strong>{game.finalScore?.toLocaleString() ?? game.score.toLocaleString()}</strong></div>
        <dl>
          <div><dt>PLANETS CONTROLLED</dt><dd>{controlledPlanetCount(game)}</dd></div>
          <div><dt>ARTIFACTS FOUND</dt><dd>{game.artifacts.filter((artifact) => artifact.rarity > 0).length}</dd></div>
          <div><dt>SETTLED AT</dt><dd>{clock(game.settledAt ?? game.now)}</dd></div>
          <div><dt>PENDING VOYAGES</dt><dd>{game.voyages.length}</dd></div>
        </dl>
        <p className="truth-note">Local simulation only. A production receipt requires the pinned Soul and proof adapters.</p>
      </section>
    );
  }

  return (
    <section className="strategy-console floating-strategy" aria-label="Infinite Stellar command map">
      <div className="strategy-map-canvas" aria-label="Interactive private universe map">
        <h1 className="sr-only">Command the unknown sky.</h1>
        <div className="map-toolbar floating-map-toolbar">
          <div>
            <span className="map-mode-label">LOCAL SIMULATION</span>
            <strong>{game.planets.filter((planet) => planet.discovered).length} / {game.planets.length} resolved</strong>
          </div>
          <div className="map-legend" aria-label="Map legend">
            <span><i className="legend-player" /> Yours</span>
            <span><i className="legend-rival" /> Rival</span>
            <span><i className="legend-neutral" /> Unclaimed</span>
          </div>
          <div className="miner-toolbar-actions">
            <button
              className="button button-secondary compact-button"
              type="button"
              disabled={mining.status === 'mining' || mining.status === 'cancelling'}
              onClick={onScan}
            >
              {mining.status === 'mining'
                ? `Mining ${miningPercent}%`
                : mining.status === 'cancelling' ? 'Cancelling…' : 'Mine next frontier'}
            </button>
            {(mining.status === 'mining' || mining.status === 'cancelling') && (
              <button className="miner-cancel" type="button" onClick={onCancelScan}>Cancel</button>
            )}
          </div>
        </div>

        <div className="map-camera-controls" role="group" aria-label="Map camera controls">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out (−)"
            disabled={cameraRadius >= maximumCameraRadius}
            onClick={() => zoomCamera(CAMERA_ZOOM_FACTOR)}
          >−</button>
          <output aria-label="Map zoom">{cameraZoom}%</output>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in (+)"
            disabled={cameraRadius <= MIN_CAMERA_RADIUS}
            onClick={() => zoomCamera(1 / CAMERA_ZOOM_FACTOR)}
          >+</button>
          <button type="button" onClick={returnToHome} title="Return to the founding Planet (H)">Home</button>
          <button type="button" onClick={fitDiscoveredUniverse} title="Fit all resolved space (0)">Fit</button>
          <button type="button" aria-pressed={visiblePanels.length === 0}
            onClick={() => setVisiblePanels(visiblePanels.length ? [] : compactPanels ? ['command'] : DEFAULT_VISIBLE)}
            title="Hide command windows for an unobstructed star map">
            {visiblePanels.length ? 'Clear view' : 'Restore panels'}
          </button>
        </div>

        <div
          className={`star-map ${isPanning ? 'is-panning' : ''}`}
          aria-label="Star map camera. Drag empty space or use arrow keys to pan, plus and minus to zoom, H for home, and 0 to fit."
          tabIndex={0}
          onWheel={handleMapWheel}
          onKeyDown={handleMapKeyDown}
          onPointerDown={beginMapPan}
          onPointerMove={continueMapPan}
          onPointerUp={endMapPan}
          onPointerCancel={endMapPan}
        >
          <span className="map-ring ring-a" aria-hidden="true" />
          <span className="map-ring ring-b" aria-hidden="true" />
          <span className="map-crosshair map-crosshair-x" aria-hidden="true" />
          <span className="map-crosshair map-crosshair-y" aria-hidden="true" />
          {game.captureZones.map((zone) => (
            <span
              className="capture-zone"
              key={zone.id}
              style={{
                left: `${50 + ((zone.x - camera.centerX) / cameraRadius) * 46}%`,
                top: `${50 + ((zone.y - camera.centerY) / cameraRadius) * 46}%`,
                width: `${(zone.radius / cameraRadius) * 92}%`,
                height: `${(zone.radius / cameraRadius) * 92}%`,
              }}
              aria-hidden="true"
            />
          ))}
          {game.planets.filter((planet) => planet.discovered).map((planet) => {
            const selected = planet.id === game.selectedPlanetId;
            const targeted = planet.id === game.targetPlanetId;
            const size = 22 + planet.level * 3;
            return (
              <button
                className={`map-planet owner-${planet.owner} space-${planet.spaceType.toLowerCase()} ${planet.planetType === 'SpacetimeRip' ? 'type-spacetime-rip' : ''} ${selected ? 'is-selected' : ''} ${targeted ? 'is-targeted' : ''}`}
                key={planet.id}
                style={{ ...planetPosition(planet, cameraRadius, camera.centerX, camera.centerY), width: size, height: size }}
                type="button"
                onClick={() => {
                  focusPanel('command');
                  if (planet.owner === 'player' && planet.id !== source?.id && !targeted) {
                    onSetTarget(planet.id);
                  } else {
                    onChoosePlanet(planet.id);
                  }
                }}
                onDoubleClick={() => focusPlanet(planet)}
                aria-label={`${planet.name}, level ${planet.level} ${planetTypeLabel(planet)}, ${planet.owner}, energy ${Math.floor(planet.energy)}`}
                aria-pressed={selected || targeted}
              >
                <MapPlanetGlyph name={planet.name} level={planet.level} planetType={planet.planetType}
                  energyFraction={planet.energyCapacity > 0 ? planet.energy / planet.energyCapacity : 0}
                  selected={selected} targeted={targeted} />
              </button>
            );
          })}
          <svg className="voyage-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <marker
                id="voyage-arrow"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
                markerUnits="strokeWidth"
                viewBox="0 0 6 6"
                preserveAspectRatio="xMidYMid meet"
              >
                <path d="M 0 0 L 6 3 L 0 6 z" />
              </marker>
            </defs>
            {source && target && source.id !== target.id && (
              <line className="map-route-preview" x1={50 + ((source.x - camera.centerX) / cameraRadius) * 46}
                y1={50 + ((source.y - camera.centerY) / cameraRadius) * 46}
                x2={50 + ((target.x - camera.centerX) / cameraRadius) * 46}
                y2={50 + ((target.y - camera.centerY) / cameraRadius) * 46}
                vectorEffect="non-scaling-stroke" />
            )}
            {game.voyages.map((voyage) => {
              const from = game.planets.find((planet) => planet.id === voyage.fromPlanetId);
              const to = game.planets.find((planet) => planet.id === voyage.toPlanetId);
              if (!from || !to) return null;
              const x1 = 50 + ((from.x - camera.centerX) / cameraRadius) * 46;
              const y1 = 50 + ((from.y - camera.centerY) / cameraRadius) * 46;
              const x2 = 50 + ((to.x - camera.centerX) / cameraRadius) * 46;
              const y2 = 50 + ((to.y - camera.centerY) / cameraRadius) * 46;
              return (
                <line
                  className="voyage-route"
                  data-testid={`voyage-route-${voyage.id}`}
                  key={voyage.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  vectorEffect="non-scaling-stroke"
                  markerEnd="url(#voyage-arrow)"
                />
              );
            })}
          </svg>
          <div className="scan-readout" aria-live="polite">
            <span>{mining.status === 'mining' ? 'WORKER MINING' : 'EXPLORED RADIUS'}</span>
            <strong>{mining.status === 'mining'
              ? `${mining.checked.toLocaleString()} / ${mining.total.toLocaleString()}`
              : game.scanRadius}</strong>
            <small>{mining.status === 'error'
              ? mining.error
              : mining.hashesPerSecond
                ? `${mining.hashesPerSecond.toLocaleString()} hash/s · ${mining.found} found`
                : `DEVICE VAULT · ${vaultLabel}`}</small>
          </div>
        </div>
      </div>

      {panelFrame('mission', 'SOUL · SEASON · STATUS', 'mission-panel', (
        <div className="mission-window">
          <StatusPill tone="live">ROUND 5 PARITY RULES</StatusPill>
          <p className={`proof-readiness proof-${proofReadiness.status}`}>{proofReadiness.label}</p>
          <Eyebrow>PRIVATE EXPANSION · ONCHAIN OUTCOMES</Eyebrow>
          <div className="mission-title">Command the<br />unknown sky.</div>
          <p><strong>{commanderName ?? 'Your Commander'}</strong> commands this finite civilization.</p>
          <div className="strategy-kpis floating-kpis">
            <div><span>TIME</span><strong>{clock(game.now)}</strong></div>
            <div><span>CONTROL</span><strong>{controlledPlanetCount(game)}</strong></div>
            <div><span>JUNK</span><strong>{game.spaceJunk}/{game.spaceJunkLimit}</strong></div>
            <div><span>SCORE</span><strong>{compact(game.score)}</strong></div>
          </div>
          <button className="reset-panel-layout" type="button" onClick={resetPanelLayout}>Reset window layout</button>
        </div>
      ))}

      {panelFrame('command', 'ORIGIN · TARGET · ACTION', 'command-floating-panel', (
        <div className="command-panel floating-command-panel">
          <div className="command-section">
            <span className="command-label">ORIGIN</span>
            {source ? <PlanetReadout planet={source} selected /> : <p>Select one of your planets.</p>}
          </div>
          <div className="command-section target-section">
            <span className="command-label">TARGET</span>
            {target ? <PlanetReadout planet={target} /> : <p>Choose a revealed neutral or rival planet on the map.</p>}
          </div>
          {source && target && (
            <div className="route-preview">
              <div><span>DISTANCE</span><strong>{distance}</strong></div>
              <div><span>ENERGY SENT</span><strong>{compact(previewSent)}</strong></div>
              <div><span>ARRIVES</span><strong>{compact(previewArrival)}</strong></div>
              <div><span>TRAVEL</span><strong>{previewTravel}s</strong></div>
            </div>
          )}
          <div className="fleet-composer">
            <label>
              <span>ENERGY</span>
              <output>{energyPercentage}%</output>
              <input aria-label="Fleet energy percentage" type="range" min="1" max="99" value={energyPercentage} onChange={(event) => setEnergyPercentage(Number(event.currentTarget.value))} />
            </label>
            <div className="fleet-presets" aria-label="Fleet energy presets">
              {[25, 60, 90].map((percentage) => (
                <button key={percentage} type="button" aria-pressed={energyPercentage === percentage} onClick={() => setEnergyPercentage(percentage)}>{percentage}%</button>
              ))}
            </div>
            <label>
              <span>SILVER</span>
              <output>{compact(silverMoved)}</output>
              <input aria-label="Fleet silver amount" type="range" min="0" max={Math.max(0, Math.floor(source?.silver ?? 0))} value={silverMoved} disabled={!source || source.silver <= 0} onChange={(event) => setSilverMoved(Number(event.currentTarget.value))} />
            </label>
            <button className="button button-primary launch-button" type="button" disabled={!target || previewArrival <= 0} onClick={() => onDispatch(energyPercentage, silverMoved)}>Launch fleet</button>
          </div>
          <div className="time-actions">
            <button type="button" disabled={game.voyages.length === 0} onClick={onAdvanceArrival}>Resolve next arrival</button>
            <button type="button" onClick={() => onAdvanceTime(300)}>Advance 5 minutes</button>
          </div>
          {activeRift && (
            <section className="rift-gate" aria-label="Spacetime Rip gate">
              <div className="rift-gate-heading">
                <span className="command-label">SPACETIME RIP · UNIVERSE BRIDGE</span>
                <strong>Rift Gate</strong>
                <p>{controlsActiveRift
                  ? 'Warp eligible artifacts between this finite universe and wallet custody.'
                  : 'Secure this Rip before extracting silver or warping artifacts into wallet custody.'}</p>
              </div>
              <div className="rift-gate-actions">
                <button type="button" disabled={!controlsActiveRift || activeRift.silver < 1} onClick={onWithdrawSilver}>
                  {controlsActiveRift
                    ? `Extract ${compact(Math.floor(activeRift.silver))} silver`
                    : 'Secure Rip to extract'}
                </button>
                <button type="button" onClick={() => focusPanel('artifacts')}>Open artifact bridge</button>
              </div>
              <small>Local custody simulation. Production Sui object transfer remains fail-closed.</small>
            </section>
          )}
          <div className="upgrade-actions">
            <span className="command-label">PLANET UPGRADE</span>
            <div>{(['defense', 'range', 'speed'] as const).map((branch) => <button type="button" key={branch} onClick={() => onUpgrade(branch)}>{branch}</button>)}</div>
          </div>
          <div className="round5-actions">
            <span className="command-label">ROUND 5 ACTIONS</span>
            {!game.shipsClaimed && <button type="button" onClick={onClaimShips}>Claim five ships</button>}
            <button type="button" onClick={onReveal}>Reveal coordinates</button>
            <button type="button" onClick={onProspect}>Prospect ruins</button>
            <button type="button" onClick={onFindArtifact}>Find artifact</button>
            <button type="button" onClick={onInvade}>Invade capture zone</button>
            <button type="button" onClick={onCapture}>Complete capture</button>
            <button className="danger-action" type="button" disabled={!target} onClick={() => onAbandon()}>Abandon &amp; send all</button>
            <button type="button" disabled={game.voyages.length > 0} onClick={onSettle}>Finalize Last Light</button>
          </div>
        </div>
      ))}

      {panelFrame('artifacts', 'INVENTORY · RELICS · SHIPS', 'artifacts-floating-panel', (
        <div className="artifact-bay floating-artifact-bay">
          {!game.shipsClaimed && <p>Claim the five Junk Wars ships from your home planet.</p>}
          {sourceArtifacts.length === 0 && targetArtifacts.length === 0 && walletArtifacts.length === 0 && <p>No artifact is visible at the selected route.</p>}
          {sourceArtifacts.map((artifact) => (
            <div key={artifact.id}>
              <strong>{artifact.type}{artifact.rarity > 0 ? ` · R${artifact.rarity}` : ''}{artifact.active ? ' · ACTIVE' : ''}</strong>
              <span>{source?.name}</span>
              {artifact.controller && target && <button type="button" onClick={() => onDispatchShip(artifact.id)}>Move ship</button>}
              {!artifact.controller && target && !artifact.active && <button type="button" onClick={() => onDispatchArtifact(artifact.id)}>Carry with fleet</button>}
              {!artifact.controller && target && !artifact.active && source && !source.isHome && <button className="danger-action" type="button" onClick={() => onAbandon(artifact.id)}>Abandon + carry</button>}
              {!artifact.controller && !artifact.active && <button type="button" onClick={() => onActivateArtifact(artifact.id)}>Activate</button>}
              {!artifact.controller && artifact.active && <button type="button" onClick={() => onDeactivateArtifact(artifact.id)}>Deactivate</button>}
              {!artifact.controller && source?.planetType === 'SpacetimeRip' && !artifact.active && <button type="button" onClick={() => onWithdrawArtifact(artifact.id)}>Warp to wallet</button>}
              {artifact.type === 'Crescent' && artifact.activations === 0 && source?.owner === 'neutral' && source.level >= 1 && source.planetType !== 'SilverMine' && <button type="button" onClick={() => onActivateCrescent(artifact.id)}>Activate</button>}
            </div>
          ))}
          {targetArtifacts.map((artifact) => (
            <div key={artifact.id}>
              <strong>{artifact.type}{artifact.rarity > 0 ? ` · R${artifact.rarity}` : ''}</strong>
              <span>{target?.name}</span>
              {artifact.type === 'Crescent' && artifact.activations === 0 && target?.owner === 'neutral' && target.level >= 1 && target.planetType !== 'SilverMine' && <button type="button" onClick={() => onActivateCrescent(artifact.id)}>Activate</button>}
            </div>
          ))}
          {walletArtifacts.map((artifact) => (
            <div key={artifact.id}>
              <strong>{artifact.type} · R{artifact.rarity}</strong>
              <span>Wallet custody</span>
              {source?.planetType === 'SpacetimeRip' && source.owner === 'player' && <button type="button" onClick={() => onDepositArtifact(artifact.id)}>Warp into universe</button>}
            </div>
          ))}
        </div>
      ))}

      {panelFrame('voyages', 'ARRIVAL QUEUE', 'voyages-floating-panel', (
        <div className="voyage-queue floating-voyage-queue">
          {game.voyages.length === 0 ? <p>No fleets are in transit.</p> : game.voyages.map((voyage) => (
            <div key={voyage.id}>
              <strong>{game.planets.find((planet) => planet.id === voyage.fromPlanetId)?.name} → {game.planets.find((planet) => planet.id === voyage.toPlanetId)?.name}</strong>
              <span>{voyage.kind === 'ship' ? 'ship transit' : `${compact(voyage.energyArriving)} energy`}{voyage.silverMoved > 0 ? ` + ${compact(voyage.silverMoved)} silver` : ''}{voyage.carriedArtifactId ? ' + artifact' : ''} · arrives {clock(voyage.arrivalAt)}</span>
            </div>
          ))}
        </div>
      ))}

      {panelFrame('log', 'FINALIZED LOCAL EVENTS', 'log-floating-panel', (
        <div className="command-log floating-command-log">
          {game.log.slice(0, 8).map((entry) => <div className={`log-${entry.tone}`} key={entry.id}><time>{clock(entry.at)}</time><span>{entry.message}</span></div>)}
        </div>
      ))}

      <nav className="strategy-panel-dock" aria-label="Command window dock">
        {PANEL_IDS.map((panelId) => {
          const open = visiblePanels.includes(panelId);
          const active = open && focusedPanel === panelId;
          return (
            <button key={panelId} type="button" className={active ? 'is-active' : ''} aria-label={PANEL_LABELS[panelId]} aria-pressed={open} onClick={() => open && active ? minimizePanel(panelId) : focusPanel(panelId)}>
              <span aria-hidden="true">{panelId === 'mission' ? '✦' : panelId === 'command' ? '◎' : panelId === 'artifacts' ? '◇' : panelId === 'voyages' ? '↗' : '≡'}</span>
              <strong>{PANEL_LABELS[panelId]}</strong>
              {panelId === 'voyages' && game.voyages.length > 0 && <em>{game.voyages.length}</em>}
            </button>
          );
        })}
      </nav>
    </section>
  );
}

function PlanetReadout({ planet, selected = false }: { planet: StrategyPlanet; selected?: boolean }) {
  return (
    <article className={`planet-readout owner-${planet.owner} ${selected ? 'selected-origin' : ''}`}>
      <header><div><small>LEVEL {planet.level} · {planet.spaceType}</small><h2>{planet.name}</h2></div><span>{planet.owner.toUpperCase()}</span></header>
      <p>{planetTypeLabel(planet)}</p>
      <p className="planet-flags">
        {planet.isHome && <span>HOME</span>}
        {planet.planetType === 'SpacetimeRip' && <span>RIFT</span>}
        {planet.artifactIds.length > 0 && <span>{planet.artifactIds.length} ARTIFACTS</span>}
        {planet.revealed && <span>REVEALED</span>}
        {planet.invadedAt !== undefined && !planet.captured && <span>INVADED</span>}
        {planet.captured && <span>CAPTURED</span>}
      </p>
      <div className="resource-bar"><span style={{ width: `${Math.min(100, (planet.energy / planet.energyCapacity) * 100)}%` }} /></div>
      <dl>
        <div><dt>ENERGY</dt><dd>{compact(Math.floor(planet.energy))} / {compact(planet.energyCapacity)}</dd></div>
        <div><dt>SILVER</dt><dd>{compact(Math.floor(planet.silver))} / {compact(planet.silverCapacity)}</dd></div>
        <div><dt>RANGE</dt><dd>{planet.range}</dd></div>
        <div><dt>DEFENSE</dt><dd>{planet.defense}%</dd></div>
      </dl>
    </article>
  );
}
