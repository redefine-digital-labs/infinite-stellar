import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStrategyGame,
  dispatchStrategyVoyage,
  setStrategyTarget,
} from '@infinite-stellar/game-sdk';
import { StrategyConsole, type StrategyConsoleProps } from './StrategyConsole';

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function strategyProps(): StrategyConsoleProps {
  return {
    game: createStrategyGame({
      universeSeed: 'floating-panel-test',
      homeId: 'home',
      homeName: 'FIRST-LIGHT',
    }),
    commanderName: 'Lyra-9',
    onChoosePlanet: vi.fn(),
    onSetTarget: vi.fn(),
    onScan: vi.fn(),
    onCancelScan: vi.fn(),
    mining: { status: 'idle', checked: 0, total: 0, found: 0 },
    vault: { status: 'sealed', protection: 'indexeddb-aes-gcm' },
    proofReadiness: { status: 'not-configured', label: 'PROVER GATED · NO MAINNET MANIFEST' },
    onDispatch: vi.fn(),
    onAdvanceArrival: vi.fn(),
    onAdvanceTime: vi.fn(),
    onUpgrade: vi.fn(),
    onClaimShips: vi.fn(),
    onDispatchShip: vi.fn(),
    onDispatchArtifact: vi.fn(),
    onActivateCrescent: vi.fn(),
    onActivateArtifact: vi.fn(),
    onDeactivateArtifact: vi.fn(),
    onWithdrawArtifact: vi.fn(),
    onDepositArtifact: vi.fn(),
    onProspect: vi.fn(),
    onFindArtifact: vi.fn(),
    onInvade: vi.fn(),
    onCapture: vi.fn(),
    onReveal: vi.fn(),
    onWithdrawSilver: vi.fn(),
    onAbandon: vi.fn(),
    onSettle: vi.fn(),
  };
}

afterEach(() => {
  setViewport(originalWidth, originalHeight);
});

describe('map-first floating strategy controls', () => {
  it('clears the tactical view and restores the command windows without changing gameplay', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    render(<StrategyConsole {...props} />);
    await user.click(screen.getByRole('button', { name: 'Clear view' }));
    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Home' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Restore panels' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(3);
    expect(props.onDispatch).not.toHaveBeenCalled();
  });
  it('moves with the keyboard, persists positions, and minimizes into the dock', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const first = render(<StrategyConsole {...strategyProps()} />);

    expect(screen.getAllByRole('dialog')).toHaveLength(3);
    const commanderHandle = screen.getByLabelText(/move commander panel/i);
    const commanderPanel = screen.getByRole('dialog', { name: 'Commander' });
    const initialTransform = commanderPanel.style.transform;
    commanderHandle.focus();
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(commanderPanel.style.transform).not.toBe(initialTransform);

    const saved = JSON.parse(window.localStorage.getItem('infinite-stellar:strategy-panels:v2') ?? '{}') as {
      mission?: { x: number; y: number };
    };
    expect(saved.mission).toEqual({ x: 34, y: 156 });

    await user.click(screen.getByRole('button', { name: /minimize planet & fleet panel/i }));
    expect(screen.queryByRole('dialog', { name: 'Planet & fleet' })).not.toBeInTheDocument();
    const commandDock = screen.getByRole('button', { name: 'Planet & fleet' });
    expect(commandDock).toHaveAttribute('aria-pressed', 'false');
    await user.click(commandDock);
    expect(screen.getByRole('dialog', { name: 'Planet & fleet' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Artifacts & ships' }));
    expect(screen.getByRole('dialog', { name: 'Artifacts & ships' })).toBeInTheDocument();

    first.unmount();
    render(<StrategyConsole {...strategyProps()} />);
    expect(screen.getByRole('dialog', { name: 'Commander' })).toHaveStyle({
      transform: 'translate3d(34px, 156px, 0)',
    });
  });

  it('renders one mobile bottom sheet and switches it from the command dock', async () => {
    setViewport(390, 844);
    const user = userEvent.setup();
    render(<StrategyConsole {...strategyProps()} />);

    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Commander' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Commander' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Planet & fleet' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Commander panel')).toHaveAttribute('tabindex', '-1');
  });

  it('starts compact desktop viewports with a clear map and opens a floating panel from a Planet', async () => {
    setViewport(609, 762);
    const user = userEvent.setup();
    render(<StrategyConsole {...strategyProps()} />);

    expect(screen.queryAllByRole('dialog')).toHaveLength(0);
    await user.click(screen.getAllByRole('button', { name: /level 0 regular, neutral/i })[0]!);
    expect(screen.getByRole('dialog', { name: 'Planet & fleet' })).toBeInTheDocument();
    expect(screen.getByLabelText(/move planet & fleet panel/i)).toHaveAttribute('tabindex', '0');
  });

  it('presents a dedicated Spacetime Rip gate for silver and artifact custody', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    props.game = {
      ...props.game,
      planets: props.game.planets.map((planet) => planet.id === 'home'
        ? { ...planet, level: 2, planetType: 'SpacetimeRip', silver: 200_000, silverCapacity: 500_000 }
        : planet),
    };
    render(<StrategyConsole {...props} />);

    expect(screen.getByRole('region', { name: 'Spacetime Rip gate' })).toBeInTheDocument();
    expect(screen.getByText('Spacetime Rip')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /extract 200k silver/i }));
    expect(props.onWithdrawSilver).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: /open artifact bridge/i }));
    expect(screen.getByRole('dialog', { name: 'Artifacts & ships' })).toBeInTheDocument();
  });

  it('zooms both ways and always provides recoverable Home and Fit camera routes', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    props.game = {
      ...props.game,
      scanRadius: 1_200,
      planets: props.game.planets.map((planet) => ({ ...planet, discovered: true })),
    };
    render(<StrategyConsole {...props} />);

    const map = screen.getByLabelText(/star map camera/i);
    const zoom = screen.getByLabelText('Map zoom');
    expect(zoom).toHaveTextContent('100%');

    fireEvent.wheel(map, { deltaY: -100 });
    expect(zoom).toHaveTextContent('125%');
    fireEvent.keyDown(map, { key: '-' });
    expect(zoom).toHaveTextContent('100%');

    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(zoom).toHaveTextContent('125%');
    await user.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(zoom).toHaveTextContent('100%');

    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(props.onChoosePlanet).toHaveBeenCalledWith('home');
    expect(Number.parseInt(zoom.textContent ?? '0', 10)).toBeGreaterThan(100);

    await user.click(screen.getByRole('button', { name: 'Fit' }));
    expect(zoom).toHaveTextContent('100%');
  });

  it('pans the camera by dragging empty map space and with arrow keys', () => {
    setViewport(1280, 800);
    const props = strategyProps();
    props.game = {
      ...props.game,
      scanRadius: 1_200,
      planets: props.game.planets.map((planet) => ({ ...planet, discovered: true })),
    };
    render(<StrategyConsole {...props} />);

    const map = screen.getByLabelText(/star map camera/i);
    const home = screen.getByRole('button', { name: /first-light, level/i });
    const beforeDrag = home.style.left;
    fireEvent.pointerDown(map, { pointerId: 7, button: 0, isPrimary: true, clientX: 500, clientY: 400 });
    fireEvent.pointerMove(map, { pointerId: 7, clientX: 650, clientY: 460 });
    fireEvent.pointerUp(map, { pointerId: 7, clientX: 650, clientY: 460 });
    expect(home.style.left).not.toBe(beforeDrag);
    expect(map).not.toHaveClass('is-panning');

    const beforeKey = home.style.top;
    fireEvent.keyDown(map, { key: 'ArrowDown' });
    expect(home.style.top).not.toBe(beforeKey);
  });

  it('pins every voyage route to the exact screen centers of its source and destination', () => {
    const props = strategyProps();
    const target = props.game.planets.find((planet) => planet.owner === 'neutral' && planet.level === 0);
    expect(target).toBeDefined();
    props.game = dispatchStrategyVoyage(setStrategyTarget(props.game, target!.id), 90, 0);
    render(<StrategyConsole {...props} />);

    const voyage = props.game.voyages[0]!;
    const route = screen.getByTestId(`voyage-route-${voyage.id}`);
    const sourceNode = screen.getByRole('button', { name: /first-light, level/i });
    const targetNode = screen.getByRole('button', { name: new RegExp(`${target!.name}, level`, 'i') });
    expect(Number(route.getAttribute('x1'))).toBeCloseTo(Number.parseFloat(sourceNode.style.left));
    expect(Number(route.getAttribute('y1'))).toBeCloseTo(Number.parseFloat(sourceNode.style.top));
    expect(Number(route.getAttribute('x2'))).toBeCloseTo(Number.parseFloat(targetNode.style.left));
    expect(Number(route.getAttribute('y2'))).toBeCloseTo(Number.parseFloat(targetNode.style.top));
    expect(route).toHaveAttribute('marker-end', 'url(#voyage-arrow)');
  });

  it('keeps the proposed route attached while panning without dispatching a fleet', () => {
    const props = strategyProps();
    const target = props.game.planets.find((planet) => planet.discovered && planet.owner === 'neutral')!;
    props.game = setStrategyTarget(props.game, target.id);
    const { container } = render(<StrategyConsole {...props} />);
    const map = screen.getByLabelText(/star map camera/i);
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    fireEvent.keyDown(map, { key: '+' });
    const route = container.querySelector('.map-route-preview')!;
    const origin = screen.getByRole('button', { name: /first-light, level/i });
    const destination = screen.getByRole('button', { name: new RegExp(`${target.name}, level`, 'i') });
    expect(Number(route.getAttribute('x1'))).toBeCloseTo(Number.parseFloat(origin.style.left));
    expect(Number(route.getAttribute('y2'))).toBeCloseTo(Number.parseFloat(destination.style.top));
    expect(destination.querySelector('.planet-map-label')).toHaveTextContent('TARGET');
    expect(props.onDispatch).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.voyage-route')).toHaveLength(0);
  });
});
