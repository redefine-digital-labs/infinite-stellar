import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import {
  controlledPlanetCount,
  exploredChunkArea,
  previewStrategyMoveIntent,
  previewStrategyFreeSpace,
  strategyAbilityStatus,
  strategySendingEnergy,
  type StrategyMoveIntent,
  type StrategyMoveMode,
  type StrategyAbility,
  type StrategyGame,
  type StrategyPlanet,
} from '@infinite-stellar/game-sdk';
import { Eyebrow, StatusPill } from './components';
import { FloatingPanel, type FloatingPanelPosition } from './FloatingPanel';
import { MapPlanetGlyph } from './MapPlanetGlyph';
import { MapExplorationCoverage } from './MapExplorationCoverage';
import { MapVoyages } from './MapVoyages';
import { mapPosition, mapToWorld, worldToMap, worldPixelScale, zoomAtMapPoint } from './map-camera';
import { useMapViewport } from './use-map-viewport';
import type { PlayerVaultState, StrategyMiningState } from './use-player-journey';
import type { ProofReadinessState } from './use-proof-readiness';

export interface StrategyConsoleProps {
  game: StrategyGame;
  commanderName?: string;
  onChoosePlanet: (planetId?: string) => void;
  onSetTarget: (planetId?: string) => void;
  onMoveIntent: (intent: StrategyMoveIntent) => void;
  onAbility: (sourceId: string, ability: StrategyAbility) => void;
  onScan: (center?: { x: number; y: number }) => void;
  onCancelScan: () => void;
  mining: StrategyMiningState;
  vault: PlayerVaultState;
  proofReadiness: ProofReadinessState;
  onAdvanceArrival: () => void;
  onAdvanceTime: (seconds: number) => void;
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
  zoomReference: number;
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
  planetId?: string;
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
  onMoveIntent,
  onAbility,
  onAdvanceArrival,
  onAdvanceTime,
  onSettle,
}: StrategyConsoleProps) {
  const [resourcesByOrigin, setResourcesByOrigin] = useState<Record<string, { energy: number; silver: number }>>({});
  const [aim, setAim] = useState<{ sourceId: string; mode: StrategyMoveMode | { kind: 'wormhole'; artifactId: string } }>();
  const [relocatingExplorer, setRelocatingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState('');
  const [cargo, setCargo] = useState<{ sourceId: string; artifactId: string }>();
  const [hoveredId, setHoveredId] = useState<string>();
  const [aimCursor, setAimCursor] = useState<{ x: number; y: number }>();
  const dragSend = useRef<{ pointerId: number; sourceId: string; x: number; y: number; moved: boolean } | undefined>(undefined);
  const suppressClick = useRef(false);
  const [positions, setPositions] = useState(loadPanelPositions);
  const [visiblePanels, setVisiblePanels] = useState<PanelId[]>(initialVisiblePanels);
  const [panelOrder, setPanelOrder] = useState<PanelId[]>(DEFAULT_ORDER);
  const [compactPanels, setCompactPanels] = useState(() => viewportSize().width <= MOBILE_PANEL_BREAKPOINT);
  const [isPanning, setIsPanning] = useState(false);
  const mapPan = useRef<MapPanGesture | undefined>(undefined);
  const { ref: mapRef, viewport: mapViewport } = useMapViewport();

  const source = game.planets.find((planet) => planet.id === (aim?.sourceId ?? game.selectedPlanetId));
  const target = game.planets.find((planet) => planet.id === (aim ? hoveredId : game.targetPlanetId));
  const resourceKey = `${game.universeSeed}:${source?.id}`;
  const energyPercentage = resourcesByOrigin[resourceKey]?.energy ?? 50;
  const silverPercentage = resourcesByOrigin[resourceKey]?.silver ?? 0;
  const silverMoved = Math.floor((source?.silver ?? 0) * silverPercentage / 100);
  const selectedCargo = game.artifacts.find((artifact) => artifact.id === cargo?.artifactId && artifact.planetId === source?.id && cargo?.sourceId === source?.id);
  const composerMode: StrategyMoveMode = selectedCargo?.controller
    ? { kind: 'ship', artifactId: selectedCargo.id } : { kind: 'fleet', artifactId: selectedCargo?.id };
  const moveMode = aim?.mode.kind !== 'wormhole' ? aim?.mode ?? composerMode : composerMode;
  const lockResources = moveMode.kind === 'ship' || moveMode.kind === 'abandon';
  const intentFor = (sourceId: string, targetId: string, mode: StrategyMoveMode): StrategyMoveIntent => {
    const resources = resourcesByOrigin[`${game.universeSeed}:${sourceId}`] ?? { energy: 50, silver: 0 };
    return { ...mode, sourceId, targetId, energyPercentage: resources.energy, silverPercentage: resources.silver };
  };
  const updateResource = (field: 'energy' | 'silver', value: number) => setResourcesByOrigin((current) => ({
    ...current,
    [resourceKey]: { energy: energyPercentage, silver: silverPercentage, [field]: Math.max(0, Math.min(100, value)) },
  }));
  const activeRift = source?.planetType === 'SpacetimeRip'
    ? source
    : target?.planetType === 'SpacetimeRip' ? target : undefined;
  const controlsActiveRift = activeRift !== undefined
    && activeRift.id === source?.id
    && activeRift.owner === 'player';
  const routePreview = source && target && aim?.mode.kind !== 'wormhole'
    ? previewStrategyMoveIntent(game, intentFor(source.id, target.id, moveMode))
    : undefined;
  const previewSent = moveMode.kind === 'ship' ? 0 : source
    ? moveMode.kind === 'abandon' ? source.energy : strategySendingEnergy(source.energy, energyPercentage) : 0;
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
  const maximumCameraRadius = game.worldRadius;
  const [camera, setCamera] = useState<MapCamera>(() => ({
    centerX,
    centerY,
    radius: viewportRadius,
    zoomReference: viewportRadius,
    mode: 'fit',
    homeId: home?.id,
  }));
  const cameraRadius = Math.max(
    MIN_CAMERA_RADIUS,
    Math.min(maximumCameraRadius, camera.radius),
  );
  const cameraZoom = Math.round((camera.zoomReference / cameraRadius) * 100);
  const projectionCamera = { ...camera, radius: cameraRadius };
  const project = (point: { x: number; y: number }) => worldToMap(point, projectionCamera, mapViewport);
  const mapScale = worldPixelScale(projectionCamera, mapViewport);
  const cursorWorld = aimCursor && mapToWorld(aimCursor, projectionCamera, mapViewport);
  const freeSpace = source?.owner === 'player' && !source.destroyed && moveMode.kind !== 'ship' && aim?.mode.kind !== 'wormhole'
    ? previewStrategyFreeSpace(game, source.id, cursorWorld
      ? { x: Math.round(cursorWorld.x), y: Math.round(cursorWorld.y) } : source,
    energyPercentage, moveMode.kind === 'abandon') : undefined;
  const focusedPanel = useMemo(
    () => [...panelOrder].reverse().find((panelId) => visiblePanels.includes(panelId)) ?? 'command',
    [panelOrder, visiblePanels],
  );
  const vaultLabel = vault.status === 'sealed'
    ? 'AES-GCM · INDEXEDDB'
    : vault.status === 'ephemeral'
      ? 'MEMORY ONLY'
      : vault.status === 'error' ? 'VAULT ERROR' : 'RESTORING';

  useEffect(() => {
    if (aim && (game.selectedPlanetId !== aim.sourceId || source?.destroyed || game.settled)) {
      setAim(undefined);
      setHoveredId(undefined);
      setAimCursor(undefined);
    }
  }, [aim, game.selectedPlanetId, game.settled, source?.destroyed]);
  useEffect(() => { setCargo(undefined); }, [game.selectedPlanetId]);

  useEffect(() => {
    setCamera((current) => {
      if (current.homeId !== home?.id) {
        return {
          centerX,
          centerY,
          radius: viewportRadius,
          zoomReference: viewportRadius,
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

  const cancelAim = () => {
    setRelocatingExplorer(false);
    if (aim && compactPanels) focusPanel('command');
    setAim(undefined);
    setHoveredId(undefined);
    setAimCursor(undefined);
    dragSend.current = undefined;
    if (game.targetPlanetId) onSetTarget(game.selectedPlanetId);
  };

  const beginAim = (mode: StrategyMoveMode | { kind: 'wormhole'; artifactId: string } = composerMode) => {
    if (!source || (mode.kind !== 'ship' && source.owner !== 'player') || game.settled) return;
    if (mode.kind === 'abandon' && (source.isHome || source.destroyed || game.voyages.some((voyage) => voyage.toPlanetId === source.id))) return;
    setAim({ sourceId: source.id, mode });
    setRelocatingExplorer(false);
    mapRef.current?.focus({ preventScroll: true });
    if (compactPanels) setVisiblePanels([]);
    setHoveredId(undefined);
    setAimCursor(undefined);
    if (game.targetPlanetId) onSetTarget(source.id);
  };

  const chooseDestination = (sourceId: string, targetId: string, mode: StrategyMoveMode | { kind: 'wormhole'; artifactId: string }) => {
    if (sourceId === targetId) { cancelAim(); return; }
    if (mode.kind === 'wormhole') {
      const ability: StrategyAbility = { kind: 'activate', artifactId: mode.artifactId, endpointId: targetId };
      if (!strategyAbilityStatus(game, sourceId, ability).allowed) { setHoveredId(targetId); return; }
      onAbility(sourceId, ability);
    } else {
      const intent = intentFor(sourceId, targetId, mode);
      if (previewStrategyMoveIntent(game, intent).error) {
        setHoveredId(targetId);
        return;
      }
      onMoveIntent(intent);
    }
    setCargo(undefined);
    setAim(undefined);
    setHoveredId(undefined);
    setAimCursor(undefined);
    if (compactPanels) focusPanel('command');
  };

  const abilityButton = (label: string, ability: StrategyAbility, planetId = source?.id) => {
    const status = strategyAbilityStatus(game, planetId, ability);
    return <span className="planet-ability" key={label}>
      <button type="button" disabled={!status.allowed || !!aim} title={status.reason}
        onClick={() => { if (planetId) onAbility(planetId, ability); }}>{label}</button>
      {!status.allowed && <small>{status.reason}</small>}
    </span>;
  };

  const pointerPlanet = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Pointer capture keeps drag events on the map, so hit-test the release
    // position rather than treating the capture element as the destination.
    const element = document.elementFromPoint?.(event.clientX, event.clientY) ?? event.target as Element;
    const id = element.closest<HTMLElement>('[data-planet-id]')?.dataset.planetId;
    return game.planets.find((planet) => planet.id === id && planet.discovered);
  };

  const handleStrategyKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelAim();
      onChoosePlanet(undefined);
      return;
    }
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 'q') {
      event.preventDefault();
      if (aim) cancelAim(); else beginAim();
    } else if (source?.owner === 'player' && !lockResources && ['-', '=', '_', '+'].includes(event.key)) {
      event.preventDefault();
      const silver = event.key === '_' || event.key === '+';
      const delta = event.key === '=' || event.key === '+' ? 10 : -10;
      updateResource(silver ? 'silver' : 'energy', (silver ? silverPercentage : energyPercentage) + delta);
    } else if (source?.owner === 'player' && !lockResources && (/^[0-9]$/.test(event.key) || /^Digit[0-9]$/.test(event.code) || '!@#$%^&*()'.includes(event.key))) {
      event.preventDefault();
      const symbol = '!@#$%^&*()'.indexOf(event.key);
      const digit = symbol >= 0 ? (symbol + 1) % 10 : Number(/^Digit[0-9]$/.test(event.code) ? event.code.slice(-1) : event.key);
      updateResource(event.shiftKey || symbol >= 0 ? 'silver' : 'energy', (digit || 10) * 10);
    }
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

  const zoomCamera = (factor: number, anchor = { x: 50, y: 50 }) => {
    setCamera((current) => ({
      ...zoomAtMapPoint(current, Math.max(
        MIN_CAMERA_RADIUS,
        Math.min(maximumCameraRadius, current.radius * factor),
      ), anchor, mapViewport),
      mode: 'manual',
    }));
  };

  const fitDiscoveredUniverse = () => {
    setCamera({
      centerX,
      centerY,
      radius: viewportRadius,
      zoomReference: viewportRadius,
      mode: 'fit',
      homeId: home?.id,
    });
  };

  const returnToHome = () => {
    if (!home) return;
    cancelAim();
    setCamera({
      centerX: home.x,
      centerY: home.y,
      radius: Math.min(viewportRadius, HOME_CAMERA_RADIUS),
      zoomReference: camera.zoomReference,
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
      zoomReference: current.zoomReference,
      mode: 'manual',
      homeId: home?.id,
    }));
  };

  const handleMapWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.deltaY === 0) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    zoomCamera(event.deltaY < 0 ? 1 / CAMERA_ZOOM_FACTOR : CAMERA_ZOOM_FACTOR,
      { x: (event.clientX - bounds.left) / (bounds.width || mapViewport.width) * 100,
        y: (event.clientY - bounds.top) / (bounds.height || mapViewport.height) * 100 });
  };

  const panCamera = (deltaX: number, deltaY: number) => {
    setCamera((current) => ({
      ...current,
      centerX: Math.max(centerX - game.worldRadius, Math.min(centerX + game.worldRadius, current.centerX + deltaX)),
      centerY: Math.max(centerY - game.worldRadius, Math.min(centerY + game.worldRadius, current.centerY + deltaY)),
      mode: 'manual',
    }));
  };

  const beginMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    if (relocatingExplorer) return;
    suppressClick.current = false;
    const planet = pointerPlanet(event);
    if (aim) {
      if (!planet) cancelAim();
      return;
    }
    if (planet?.owner === 'player') {
      dragSend.current = { pointerId: event.pointerId, sourceId: planet.id, x: event.clientX, y: event.clientY, moved: false };
      return;
    }
    if (!planet && (event.target as HTMLElement).closest('button, input, select, textarea, a')) return;
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
      planetId: planet?.id,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const continueMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragSend.current;
    if (drag?.pointerId === event.pointerId && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) {
      if (!drag.moved) {
        drag.moved = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        onChoosePlanet(drag.sourceId);
        mapRef.current?.focus({ preventScroll: true });
        setAim({ sourceId: drag.sourceId, mode: drag.sourceId === source?.id ? composerMode : { kind: 'fleet' } });
        if (compactPanels) setVisiblePanels([]);
      }
    }
    if (aim || drag?.moved) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const fallback = viewportSize();
      setAimCursor({ x: (event.clientX - bounds.left) / (bounds.width || fallback.width) * 100,
        y: (event.clientY - bounds.top) / (bounds.height || fallback.height) * 100 });
      setHoveredId(pointerPlanet(event)?.id);
      return;
    }
    const gesture = mapPan.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const worldPerPixel = 1 / worldPixelScale(projectionCamera, gesture);
    setCamera((current) => ({
      ...current,
      centerX: Math.max(
        centerX - game.worldRadius,
        Math.min(centerX + game.worldRadius, gesture.centerX - (event.clientX - gesture.startX) * worldPerPixel),
      ),
      centerY: Math.max(
        centerY - game.worldRadius,
        Math.min(centerY + game.worldRadius, gesture.centerY - (event.clientY - gesture.startY) * worldPerPixel),
      ),
      mode: 'manual',
    }));
  };

  const endMapPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragSend.current;
    if (drag?.pointerId === event.pointerId) {
      dragSend.current = undefined;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (drag.moved) {
        suppressClick.current = true;
        const destination = pointerPlanet(event);
        if (destination) chooseDestination(drag.sourceId, destination.id, aim?.mode ?? { kind: 'fleet' });
        else cancelAim();
      }
      return;
    }
    if (mapPan.current?.pointerId !== event.pointerId) return;
    const gesture = mapPan.current;
    if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) <= 5) {
      onChoosePlanet(gesture.planetId);
      if (gesture.planetId) focusPanel('command');
    }
    suppressClick.current = true;
    mapPan.current = undefined;
    setIsPanning(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleMapKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === ']') {
      event.preventDefault();
      zoomCamera(1 / CAMERA_ZOOM_FACTOR);
    } else if (event.key === '[') {
      event.preventDefault();
      zoomCamera(CAMERA_ZOOM_FACTOR);
    } else if (event.key.toLowerCase() === 'f') {
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

  const chooseExplorerPoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!relocatingExplorer || (event.target as HTMLElement).closest('.aim-status')) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = mapToWorld({ x: (event.clientX - bounds.left) / (bounds.width || mapViewport.width) * 100,
      y: (event.clientY - bounds.top) / (bounds.height || mapViewport.height) * 100 }, projectionCamera, mapViewport);
    const origin = { x: Math.round(point.x), y: Math.round(point.y) };
    if (Math.hypot(origin.x - centerX, origin.y - centerY) >= game.worldRadius) {
      setExplorerError('Choose an explorer origin inside this finite world.');
      return;
    }
    setRelocatingExplorer(false);
    setExplorerError('');
    onScan(origin);
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
    <section className="strategy-console floating-strategy" aria-label="Infinite Stellar command map" onKeyDown={handleStrategyKeyDown}>
      <div className="strategy-map-canvas" aria-label="Interactive private universe map">
        <h1 className="sr-only">Command the unknown sky.</h1>
        <div className="map-toolbar floating-map-toolbar">
          <div>
            <span className="map-mode-label">LOCAL SIMULATION</span>
            <strong>{game.planets.filter((planet) => planet.discovered).length} discovered</strong>
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
              disabled={mining.status === 'mining' || mining.status === 'cancelling' || game.settled}
              onClick={() => onScan()}
            >
              {mining.status === 'mining'
                ? 'Exploring'
                : mining.status === 'cancelling' ? 'Pausing…' : game.exploredChunks?.length ? 'Resume explorer' : 'Start explorer'}
            </button>
            {(mining.status === 'mining' || mining.status === 'cancelling') && (
              <button className="miner-cancel" type="button" onClick={onCancelScan}>Pause explorer</button>
            )}
            <button className="miner-cancel explore-camera-origin" type="button" disabled={mining.status === 'mining' || game.settled ||
              Math.hypot(camera.centerX - centerX, camera.centerY - centerY) >= game.worldRadius}
              onClick={() => onScan({ x: Math.round(camera.centerX), y: Math.round(camera.centerY) })}
              title="Start a continuous search at the current camera center. Completed chunks are skipped.">Explore here</button>
            <button className="miner-cancel" type="button" disabled={game.settled} aria-pressed={relocatingExplorer}
              onClick={() => {
                cancelAim(); onCancelScan(); setExplorerError(''); setRelocatingExplorer(true);
                if (compactPanels) setVisiblePanels([]);
                mapRef.current?.focus({ preventScroll: true });
              }}>Move explorer</button>
          </div>
        </div>

        <div className="map-camera-controls" role="group" aria-label="Map camera controls">
          <button
            type="button"
            aria-label="Zoom out"
            title="Zoom out ([)"
            disabled={cameraRadius >= maximumCameraRadius}
            onClick={() => zoomCamera(CAMERA_ZOOM_FACTOR)}
          >−</button>
          <output aria-label="Map zoom">{cameraZoom}%</output>
          <button
            type="button"
            aria-label="Zoom in"
            title="Zoom in (])"
            disabled={cameraRadius <= MIN_CAMERA_RADIUS}
            onClick={() => zoomCamera(1 / CAMERA_ZOOM_FACTOR)}
          >+</button>
          <button type="button" onClick={returnToHome} title="Return to the founding Planet (H)">Home</button>
          <button type="button" onClick={fitDiscoveredUniverse} title="Fit all resolved space (F)">Fit</button>
          <button type="button" aria-pressed={visiblePanels.length === 0}
            onClick={() => setVisiblePanels(visiblePanels.length ? [] : compactPanels ? ['command'] : DEFAULT_VISIBLE)}
            title="Hide command windows for an unobstructed star map">
            {visiblePanels.length ? 'Clear view' : 'Restore panels'}
          </button>
        </div>

        <div
          ref={mapRef}
          className={`star-map ${isPanning ? 'is-panning' : ''} ${aim || relocatingExplorer ? 'is-aiming' : ''}`}
          aria-label="Star map camera. Drag empty space or use arrow keys to pan; wheel or brackets zoom; H for home, F to fit. Q to send; numbers and minus/equal set energy, Shift sets silver; Escape cancels."
          tabIndex={0}
          onWheel={handleMapWheel}
          onClickCapture={chooseExplorerPoint}
          onKeyDown={handleMapKeyDown}
          onPointerDown={beginMapPan}
          onPointerMove={continueMapPan}
          onPointerUp={endMapPan}
          onPointerCancel={(event) => {
            suppressClick.current = true;
            cancelAim();
            mapPan.current = undefined;
            setIsPanning(false);
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
        >
          <MapExplorationCoverage chunks={game.exploredChunks ?? []} active={mining.chunks ?? []}
            origin={mining.origin ?? game.explorationOrigin} centerX={camera.centerX} centerY={camera.centerY} radius={cameraRadius} viewport={mapViewport} />
          <span className="map-ring ring-a" aria-hidden="true" />
          <span className="map-ring ring-b" aria-hidden="true" />
          <span className="map-crosshair map-crosshair-x" aria-hidden="true" />
          <span className="map-crosshair map-crosshair-y" aria-hidden="true" />
          {source && freeSpace && freeSpace.maxDistance > 0 && <span className="energy-reach-ring"
            aria-label={`Direct-space reach: ${freeSpace.maxDistance} world units at ${moveMode.kind === 'abandon' ? 100 : energyPercentage}% energy`}
            style={{ ...mapPosition(source, projectionCamera, mapViewport),
              width: freeSpace.maxDistance * mapScale * 2, height: freeSpace.maxDistance * mapScale * 2 }} />}
          {game.captureZones.map((zone) => (
            <span
              className="capture-zone"
              key={zone.id}
              style={{
                ...mapPosition(zone, projectionCamera, mapViewport),
                width: zone.radius * mapScale * 2,
                height: zone.radius * mapScale * 2,
              }}
              aria-hidden="true"
            />
          ))}
          {game.planets.filter((planet) => planet.discovered).map((planet) => {
            const selected = planet.id === game.selectedPlanetId;
            const targeted = planet.id === target?.id;
            const size = 22 + planet.level * 3;
            return (
              <button
                className={`map-planet owner-${planet.owner} space-${planet.spaceType.toLowerCase()} ${planet.planetType === 'SpacetimeRip' ? 'type-spacetime-rip' : ''} ${selected ? 'is-selected' : ''} ${targeted ? 'is-targeted' : ''}`}
                key={planet.id}
                data-planet-id={planet.id}
                style={{ ...mapPosition(planet, projectionCamera, mapViewport), width: size, height: size }}
                type="button"
                onClick={() => {
                  if (suppressClick.current) { suppressClick.current = false; return; }
                  focusPanel('command');
                  if (aim) chooseDestination(aim.sourceId, planet.id, aim.mode);
                  else onChoosePlanet(planet.id);
                }}
                onPointerEnter={() => { if (aim) setHoveredId(planet.id); }}
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
            {source && ((target && source.id !== target.id) || (aim && aimCursor)) && (
              <line className="map-route-preview" x1={project(source).x}
                y1={project(source).y}
                x2={target ? project(target).x : aimCursor!.x}
                y2={target ? project(target).y : aimCursor!.y}
                vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          <MapVoyages viewport={mapViewport} clock={{ seconds: game.now, observedAtMs: game.wallClockAtMs }}
            voyages={game.voyages.flatMap((voyage) => {
              const from = game.planets.find((planet) => planet.id === voyage.fromPlanetId && planet.discovered);
              const to = game.planets.find((planet) => planet.id === voyage.toPlanetId && planet.discovered);
              return from && to ? [{ id: voyage.id, from: project(from), to: project(to),
                departureAt: voyage.departureAt, arrivalAt: voyage.arrivalAt, energy: compact(voyage.energyArriving),
                silver: voyage.silverMoved > 0 ? compact(voyage.silverMoved) : undefined,
                owner: voyage.player, kind: voyage.kind, artifact: Boolean(voyage.carriedArtifactId) }] : [];
            })} />
          {relocatingExplorer && <div className="aim-status" role="status">
            <strong>Click the map to move the explorer. This does not send a fleet.</strong>
            {explorerError && <span>{explorerError}</span>}
            <button type="button" onClick={cancelAim}>Cancel explorer placement (Esc)</button>
          </div>}
          {aim && <div className="aim-status" role="status">
            <strong>{aim.mode.kind === 'wormhole' ? 'Choose an intact controlled Wormhole endpoint'
              : aim.mode.kind === 'ship' ? 'Move ship · no energy, silver or conquest'
                : aim.mode.kind === 'abandon' ? 'Abandon origin · send all energy and silver'
                  : `Sending ${compact(previewSent)} energy · choose destination`}</strong>
            {routePreview && <span>{routePreview.error ?? `${routePreview.friendly
              ? `+${compact(routePreview.energyArriving)} reinforcement`
              : `−${compact(routePreview.defenseDamage)} defended energy`} · ${routePreview.travelTime}s · ${routePreview.spaceJunk} junk`}</span>}
            {!target && cursorWorld && freeSpace && <span>{compact(freeSpace.energyArriving)} energy reaches cursor · {freeSpace.travelTime}s · direct space</span>}
            {aim.mode.kind === 'wormhole' && target && <span>{strategyAbilityStatus(game, aim.sourceId,
              { kind: 'activate', artifactId: aim.mode.artifactId, endpointId: target.id }).reason ?? 'Click to activate this Wormhole route.'}</span>}
            <button type="button" onClick={cancelAim}>Cancel aiming (Esc)</button>
          </div>}
          <div className="scan-readout" aria-live="polite">
            <span>{mining.status === 'mining' ? 'WORKER MINING · CONTINUOUS' : 'SEARCHED AREA'}</span>
            <strong>{mining.status === 'mining'
              ? `${mining.checked.toLocaleString()} / ${mining.total.toLocaleString()}`
              : `${exploredChunkArea(game.exploredChunks ?? []).toLocaleString()} units²`}</strong>
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
          <StatusPill tone="live">DF ROUND 5 RULESET</StatusPill>
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
            <span className="command-label">{aim ? 'ORIGIN' : 'SELECTED PLANET'}</span>
            {source ? <PlanetReadout planet={source} selected /> : <p>Select any planet to inspect it.</p>}
          </div>
          <div className="command-section target-section">
            <span className="command-label">TARGET</span>
            {target ? <PlanetReadout planet={target} /> : <p>{aim ? 'Aim at a destination. Click to send; Escape cancels.' : 'Set resources, then Send or drag from a controlled planet.'}</p>}
          </div>
          {!aim && routePreview?.error && <p role="status">Next fleet: {routePreview.error}</p>}
          {routePreview && !routePreview.error && (
            <div className="route-preview">
              <div><span>DISTANCE</span><strong>{routePreview?.distance}</strong></div>
              <div><span>ENERGY SENT</span><strong>{compact(routePreview.energySent)}</strong></div>
              <div><span>ARRIVES</span><strong>{compact(routePreview?.energyArriving ?? 0)}</strong></div>
              <div><span>TRAVEL</span><strong>{routePreview?.travelTime}s</strong></div>
              <div><span>SILVER SENT</span><strong>{compact(routePreview?.silverMoved ?? 0)}</strong></div>
              <div><span>JUNK CHANGE</span><strong>{routePreview?.spaceJunk ?? 0}</strong></div>
            </div>
          )}
          <div className="fleet-composer">
            <label><span>CARGO / SHIP</span>
              <select aria-label="Fleet cargo or ship" value={selectedCargo?.id ?? ''} disabled={!!aim}
                onChange={(event) => setCargo(source && event.currentTarget.value ? { sourceId: source.id, artifactId: event.currentTarget.value } : undefined)}>
                <option value="">Energy and silver only</option>
                {sourceArtifacts.filter((artifact) => !artifact.active && !artifact.burned &&
                  (artifact.controller === 'player' || source?.owner === 'player')).map((artifact) =>
                  <option key={artifact.id} value={artifact.id}>{artifact.type}{artifact.controller ? ' · ship' : ` · R${artifact.rarity}`}</option>)}
              </select>
            </label>
            <label>
              <span>ENERGY</span>
              <output>{moveMode.kind === 'ship' ? 0 : moveMode.kind === 'abandon' ? 100 : energyPercentage}%</output>
              <input aria-label="Fleet energy percentage" type="range" min="0" max="100" value={energyPercentage} disabled={source?.owner !== 'player' || lockResources} onChange={(event) => updateResource('energy', Number(event.currentTarget.value))} />
            </label>
            <div className="resource-stepper" aria-label="Energy fine adjustment">
              <button type="button" aria-label="Decrease energy by 1%" disabled={source?.owner !== 'player' || lockResources} onClick={() => updateResource('energy', energyPercentage - 1)}>−1%</button>
              <button type="button" aria-label="Increase energy by 1%" disabled={source?.owner !== 'player' || lockResources} onClick={() => updateResource('energy', energyPercentage + 1)}>+1%</button>
            </div>
            <div className="fleet-presets" aria-label="Fleet energy presets">
              {[25, 50, 75, 100].map((percentage) => (
                <button key={percentage} type="button" disabled={source?.owner !== 'player' || lockResources} aria-pressed={energyPercentage === percentage} onClick={() => updateResource('energy', percentage)}>{percentage}%</button>
              ))}
            </div>
            <label>
              <span>SILVER</span>
              <output>{moveMode.kind === 'ship' ? '0% · 0' : moveMode.kind === 'abandon' ? `100% · ${compact(source?.silver ?? 0)}` : `${silverPercentage}% · ${compact(silverMoved)}`}</output>
              <input aria-label="Fleet silver percentage" type="range" min="0" max="100" value={silverPercentage} disabled={source?.owner !== 'player' || source.silver <= 0 || lockResources} onChange={(event) => updateResource('silver', Number(event.currentTarget.value))} />
            </label>
            <div className="resource-stepper" aria-label="Silver fine adjustment">
              <button type="button" aria-label="Decrease silver by 1%" disabled={source?.owner !== 'player' || lockResources || !source.silver} onClick={() => updateResource('silver', silverPercentage - 1)}>−1%</button>
              <button type="button" aria-label="Increase silver by 1%" disabled={source?.owner !== 'player' || lockResources || !source.silver} onClick={() => updateResource('silver', silverPercentage + 1)}>+1%</button>
            </div>
            <small>1–0: energy · −/=: ±10 energy points · Shift: silver. Wheel or [ ]: zoom. Normal fleets send at most 98% and leave at least 1 energy.</small>
            <button className="button button-primary launch-button" type="button"
              disabled={game.settled || (moveMode.kind === 'ship' ? !selectedCargo : source?.owner !== 'player' || source.destroyed || previewSent <= 0)}
              onClick={() => aim ? cancelAim() : beginAim()}>{aim ? 'Cancel send' : moveMode.kind === 'ship' ? 'Move ship (Q)' : 'Send (Q)'}</button>
            {aim?.mode.kind === 'abandon' && <p>Origin becomes neutral immediately on dispatch. All energy and silver leave; the normal percentage setting is ignored.</p>}
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
                {abilityButton(controlsActiveRift ? `Extract ${compact(Math.floor(activeRift.silver))} silver` : 'Secure Rip to extract', { kind: 'withdraw-silver' })}
                <button type="button" onClick={() => focusPanel('artifacts')}>Open artifact bridge</button>
              </div>
              <small>Local custody simulation. Production Sui object transfer remains fail-closed.</small>
            </section>
          )}
          {source?.owner === 'player' && !source.destroyed && <div className="upgrade-actions">
            <span className="command-label">PLANET UPGRADE</span>
            <div>{(['defense', 'range', 'speed'] as const).map((branch) => abilityButton(branch, { kind: 'upgrade', branch }))}</div>
          </div>}
          <div className="round5-actions">
            <span className="command-label">ROUND 5 ACTIONS</span>
            {!game.shipsClaimed && abilityButton('Claim five ships', { kind: 'claim-ships' })}
            {source && abilityButton('Reveal coordinates', { kind: 'reveal' })}
            {source?.owner === 'player' && !source.destroyed && <>
              {source.planetType === 'Ruins' && <>{abilityButton('Prospect ruins', { kind: 'prospect' })}{abilityButton('Find artifact', { kind: 'find' })}</>}
              {abilityButton('Invade capture zone', { kind: 'invade' })}
              {abilityButton('Complete capture', { kind: 'capture' })}
              <button className="danger-action" type="button" disabled={source.isHome || !!aim || game.voyages.some((voyage) => voyage.toPlanetId === source.id)}
                title={source.isHome ? 'The founding Planet cannot be abandoned.' : 'Cannot abandon a Planet with incoming voyages.'}
                onClick={() => beginAim({ kind: 'abandon', artifactId: selectedCargo?.controller ? undefined : selectedCargo?.id })}>Abandon &amp; send all</button>
            </>}
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
              {!artifact.active && source && (artifact.controller === 'player' || source.owner === 'player') &&
                <button type="button" disabled={!!aim} onClick={() => { setCargo({ sourceId: source.id, artifactId: artifact.id }); focusPanel('command'); }}>Select for sending</button>}
              {!artifact.controller && !artifact.active && artifact.type !== 'Wormhole' && abilityButton('Activate', { kind: 'activate', artifactId: artifact.id })}
              {!artifact.controller && !artifact.active && artifact.type === 'Wormhole' &&
                <button type="button" disabled={source?.owner !== 'player' || source.destroyed || !!aim} onClick={() => beginAim({ kind: 'wormhole', artifactId: artifact.id })}>Choose Wormhole endpoint</button>}
              {!artifact.controller && artifact.active && abilityButton('Deactivate', { kind: 'deactivate', artifactId: artifact.id })}
              {!artifact.controller && source?.planetType === 'SpacetimeRip' && !artifact.active && abilityButton('Warp to wallet', { kind: 'withdraw-artifact', artifactId: artifact.id })}
              {artifact.type === 'Crescent' && abilityButton('Activate Crescent', { kind: 'crescent', artifactId: artifact.id })}
            </div>
          ))}
          {targetArtifacts.map((artifact) => (
            <div key={artifact.id}>
              <strong>{artifact.type}{artifact.rarity > 0 ? ` · R${artifact.rarity}` : ''}</strong>
              <span>{target?.name}</span>
              <small>Select this Planet to manage its artifacts.</small>
            </div>
          ))}
          {walletArtifacts.map((artifact) => (
            <div key={artifact.id}>
              <strong>{artifact.type} · R{artifact.rarity}</strong>
              <span>Wallet custody</span>
              {source?.planetType === 'SpacetimeRip' && source.owner === 'player' && abilityButton('Warp into universe', { kind: 'deposit-artifact', artifactId: artifact.id })}
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
