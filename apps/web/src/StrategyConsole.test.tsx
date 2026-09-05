import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createStrategyGame,
  claimStrategyStartingShips,
  dispatchStrategyVoyage,
  selectStrategyPlanet,
  setStrategyTarget,
  scanStrategyUniverse,
} from '@infinite-stellar/game-sdk';
import { StrategyConsole, type StrategyConsoleProps } from './StrategyConsole';

const originalWidth = window.innerWidth;
const originalHeight = window.innerHeight;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

// Low-level planets are deliberately absent at distant zoom; interaction tests
// must zoom them into view just as a player does, not bypass visibility rules.
function zoomToPlanet(name: RegExp): HTMLElement {
  for (let attempt = 0; attempt < 40; attempt++) {
    const planet = screen.queryAllByRole('button', { name })[0];
    if (planet) return planet;
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  }
  return screen.getByRole('button', { name });
}

function InteractiveConsole(props: StrategyConsoleProps) {
  const [game, setGame] = useState(props.game);
  return <StrategyConsole {...props} game={game}
    onChoosePlanet={(id) => { props.onChoosePlanet(id); setGame((current) => selectStrategyPlanet(current, id)); }}
    onSetTarget={(id) => { props.onSetTarget(id); setGame((current) => setStrategyTarget(current, id)); }} />;
}

function strategyProps(): StrategyConsoleProps {
  return {
    game: scanStrategyUniverse(createStrategyGame({
      universeSeed: 'floating-panel-test',
      homeId: 'home',
      homeName: 'FIRST-LIGHT',
    })),
    commanderName: 'Lyra-9',
    onChoosePlanet: vi.fn(),
    onSetTarget: vi.fn(),
    onScan: vi.fn(),
    onCancelScan: vi.fn(),
    mining: { status: 'idle', checked: 0, total: 0, found: 0 },
    vault: { status: 'sealed', protection: 'indexeddb-aes-gcm' },
    proofReadiness: { status: 'not-configured', label: 'PROVER GATED · NO MAINNET MANIFEST' },
    onMoveIntent: vi.fn(),
    onAbility: vi.fn(),
    onAdvanceArrival: vi.fn(),
    onAdvanceTime: vi.fn(),
    onSettle: vi.fn(),
  };
}

afterEach(() => {
  setViewport(originalWidth, originalHeight);
});

describe('map-first floating strategy controls', () => {
  it('culls distant low-level planets, reveals them after zoom and focuses a body on double click', () => {
    setViewport(393, 720);
    const props = strategyProps();
    render(<StrategyConsole {...props} />);
    const target = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    expect(screen.queryByRole('button', { name: new RegExp(`${target.name}, level`) })).not.toBeInTheDocument();
    const body = zoomToPlanet(new RegExp(`${target.name}, level`));
    const before = parseFloat(body.style.getPropertyValue('--planet-diameter'));
    fireEvent.doubleClick(body);
    expect(parseFloat(body.style.getPropertyValue('--planet-diameter'))).toBeGreaterThan(before);
    expect(body.style.left).toBe('50%');
    expect(body.style.top).toBe('50%');
    expect(props.onMoveIntent).not.toHaveBeenCalled();
  });
  it('does not auto-fit or reset the explorer label on each completed scan batch', () => {
    const props = strategyProps();
    const { rerender } = render(<StrategyConsole {...props} mining={{ ...props.mining, status: 'mining', checked: 0, total: 1024 }} />);
    const home = screen.getByRole('button', { name: /first-light, level/i });
    const style = home.getAttribute('style');
    const zoom = screen.getByLabelText('Map zoom').textContent;
    const button = screen.getByRole('button', { name: 'Exploring' });
    rerender(<StrategyConsole {...props} game={{ ...props.game, scanRadius: 5000 }}
      mining={{ ...props.mining, status: 'mining', checked: 1024, total: 1024 }} />);
    expect(home.getAttribute('style')).toBe(style);
    expect(screen.getByLabelText('Map zoom')).toHaveTextContent(zoom!);
    expect(button).toHaveTextContent('Exploring');
    expect(screen.queryByText(/Mining \d+%/)).not.toBeInTheDocument();
  });
  it('does not change manual zoom or planet position when newly explored space expands', async () => {
    const user = userEvent.setup();
    const props = strategyProps();
    const { rerender } = render(<StrategyConsole {...props} />);
    await user.click(screen.getByRole('button', { name: 'Zoom in' }));
    const zoom = screen.getByLabelText('Map zoom').textContent;
    const target = screen.getAllByRole('button', { name: /neutral, energy/i })[0]!;
    const position = target.getAttribute('style');
    rerender(<StrategyConsole {...props} game={{ ...props.game, scanRadius: props.game.scanRadius * 2 }} />);
    expect(screen.getByLabelText('Map zoom').textContent).toBe(zoom);
    expect(target.getAttribute('style')).toBe(position);
  });
  it('uses an explicit explorer-placement mode without selecting a Planet or dispatching', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    const home = props.game.planets.find((planet) => planet.isHome)!;
    render(<StrategyConsole {...props} />);
    await user.click(screen.getByRole('button', { name: 'Move explorer' }));
    expect(props.onCancelScan).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /first-light, level/i }), { clientX: 640, clientY: 400 });
    expect(props.onScan).toHaveBeenCalledExactlyOnceWith({ x: home.x, y: home.y });
    expect(props.onChoosePlanet).not.toHaveBeenCalled();
    expect(props.onMoveIntent).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Move explorer' }));
    await user.click(screen.getByRole('button', { name: 'Cancel explorer placement (Esc)' }));
    expect(props.onScan).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Click the map to move the explorer/)).not.toBeInTheDocument();
  });
  it('uses DF resource shortcuts without zooming and supports one-point fine adjustment', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    props.game = { ...props.game, planets: props.game.planets.map((planet) => planet.isHome ? { ...planet, silver: 400 } : planet) };
    render(<StrategyConsole {...props} />);
    const map = screen.getByLabelText(/star map camera/i);
    const zoom = screen.getByLabelText('Map zoom').textContent;
    fireEvent.keyDown(map, { key: '=' });
    expect(screen.getByLabelText('Fleet energy percentage')).toHaveValue('60');
    fireEvent.keyDown(map, { key: '+' });
    expect(screen.getByLabelText('Fleet silver percentage')).toHaveValue('10');
    fireEvent.keyDown(map, { key: '-' });
    expect(screen.getByLabelText('Fleet energy percentage')).toHaveValue('50');
    fireEvent.keyDown(map, { key: '!' });
    expect(screen.getByLabelText('Fleet silver percentage')).toHaveValue('10');
    expect(screen.getByLabelText('Map zoom').textContent).toBe(zoom);
    await user.click(screen.getByRole('button', { name: 'Increase energy by 1%' }));
    expect(screen.getByLabelText('Fleet energy percentage')).toHaveValue('51');
  });

  it('pans by exact pixel deltas around the local world center rather than clamping to global zero', () => {
    setViewport(1280, 800);
    render(<StrategyConsole {...strategyProps()} />);
    const map = screen.getByLabelText(/star map camera/i);
    const home = screen.getByRole('button', { name: /first-light, level/i });
    fireEvent.pointerDown(map, { pointerId: 21, button: 0, isPrimary: true, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(map, { pointerId: 21, clientX: 150, clientY: 150 });
    fireEvent.pointerUp(map, { pointerId: 21, clientX: 150, clientY: 150 });
    expect((Number.parseFloat(home.style.left) - 50) / 100 * 1280).toBeCloseTo(50);
    expect((Number.parseFloat(home.style.top) - 50) / 100 * 800).toBeCloseTo(50);
  });
  it('draws a circular energy-dependent reach ring on a non-square viewport', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const { container } = render(<StrategyConsole {...strategyProps()} />);
    const ring = container.querySelector<HTMLElement>('.energy-reach-ring')!;
    expect(ring.style.width).toBe(ring.style.height);
    const initialWidth = Number.parseFloat(ring.style.width);
    await user.click(screen.getByRole('button', { name: '75%' }));
    expect(Number.parseFloat(ring.style.width)).toBeGreaterThan(initialWidth);
    expect(ring).toHaveAttribute('aria-label', expect.stringContaining('75% energy'));
  });
  it('keeps the explorer origin independent of inspection and relocates only on Explore here', async () => {
    const user = userEvent.setup();
    const props = strategyProps();
    const home = props.game.planets.find((planet) => planet.isHome)!;
    render(<StrategyConsole {...props} />);
    await user.click(screen.getByRole('button', { name: 'Start explorer' }));
    expect(props.onScan).toHaveBeenCalledExactlyOnceWith();
    await user.click(screen.getByRole('button', { name: 'Explore here' }));
    expect(props.onScan).toHaveBeenLastCalledWith({ x: home.x, y: home.y });
    expect(props.onMoveIntent).not.toHaveBeenCalled();
  });
  it('clears compact overlays during aiming and restores the command panel after sending', async () => {
    setViewport(393, 720);
    const user = userEvent.setup();
    const props = strategyProps();
    const target = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    render(<InteractiveConsole {...props} />);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: '75%' }));
    await user.click(screen.getByRole('button', { name: 'Send (Q)' }));
    expect(screen.queryByRole('dialog', { name: 'Planet & fleet' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/star map camera/i)).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Cancel aiming (Esc)' })).toBeVisible();
    await user.click(zoomToPlanet(new RegExp(`${target.name}, level`, 'i')));
    expect(props.onMoveIntent).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ energyPercentage: 75, targetId: target.id }));
    expect(screen.getByRole('dialog', { name: 'Planet & fleet' })).toBeVisible();
  });

  it('shows invalid-route reasons instead of zero-valued distance and travel metrics', () => {
    setViewport(1280, 800);
    const props = strategyProps();
    const target = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    props.game = setStrategyTarget({ ...props.game,
      planets: props.game.planets.map((planet) => planet.isHome ? { ...planet, energy: 1 } : planet) }, target.id);
    const { container } = render(<StrategyConsole {...props} />);
    expect(container.querySelector('.route-preview')).not.toBeInTheDocument();
    expect(screen.queryByText('DISTANCE')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send (Q)' })).toBeDisabled();
  });

  it('uses the chosen cargo and both resource percentages in the clicked destination intent', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    props.game = { ...props.game, artifacts: [{ id: 'relic', type: 'Pyramid', rarity: 1, planetId: 'home',
      activations: 0, active: false, biome: 0, mintedAt: 0, burned: false }],
      planets: props.game.planets.map((planet) => planet.id === 'home' ? { ...planet, silver: 400, artifactIds: ['relic'] } : planet) };
    const target = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    render(<InteractiveConsole {...props} />);
    fireEvent.change(screen.getByLabelText('Fleet energy percentage'), { target: { value: '75' } });
    fireEvent.change(screen.getByLabelText('Fleet silver percentage'), { target: { value: '40' } });
    await user.selectOptions(screen.getByLabelText('Fleet cargo or ship'), 'relic');
    await user.click(screen.getByRole('button', { name: 'Send (Q)' }));
    await user.click(zoomToPlanet(new RegExp(`${target.name}, level`, 'i')));
    expect(props.onMoveIntent).toHaveBeenCalledExactlyOnceWith({ kind: 'fleet', artifactId: 'relic', sourceId: 'home',
      targetId: target.id, energyPercentage: 75, silverPercentage: 40 });
  });

  it('selects a ship on a neutral host and disables the resource sliders without disabling movement', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    props.game = claimStrategyStartingShips(props.game);
    const ship = props.game.artifacts.find((artifact) => artifact.type === 'Gear')!;
    props.game = { ...props.game, planets: props.game.planets.map((planet) => planet.isHome ? { ...planet, owner: 'neutral' } : planet) };
    const target = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    render(<InteractiveConsole {...props} />);
    await user.selectOptions(screen.getByLabelText('Fleet cargo or ship'), ship.id);
    expect(screen.getByLabelText('Fleet energy percentage')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move ship (Q)' }));
    await user.click(zoomToPlanet(new RegExp(`${target.name}, level`, 'i')));
    expect(props.onMoveIntent).toHaveBeenCalledExactlyOnceWith({ kind: 'ship', artifactId: ship.id, sourceId: 'home',
      targetId: target.id, energyPercentage: 50, silverPercentage: 0 });
  });

  it('enters abandonment mode before choosing a destination and never offers upgrades on a rival', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    const other = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    props.game = { ...props.game, planets: props.game.planets.map((planet) => planet.id === other.id
      ? { ...planet, owner: 'player', energy: 100_000, range: 1000 } : planet) };
    render(<InteractiveConsole {...props} />);
    expect(screen.getByRole('button', { name: 'Abandon & send all' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: new RegExp(`${other.name}, level`, 'i') }));
    await user.click(screen.getByRole('button', { name: 'Abandon & send all' }));
    expect(props.onMoveIntent).not.toHaveBeenCalled();
    expect(screen.getByText(/Origin becomes neutral immediately/)).toBeInTheDocument();
    expect(screen.getByLabelText('Fleet energy percentage')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /first-light, level/i }));
    expect(props.onMoveIntent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'abandon', sourceId: other.id, targetId: 'home' }));
    fireEvent.keyDown(screen.getByLabelText(/star map camera/i), { key: 'Escape' });
    expect(props.onChoosePlanet).toHaveBeenLastCalledWith(undefined);
    expect(screen.queryByRole('button', { name: 'defense' })).not.toBeInTheDocument();
  });
  it('inspects planets and sends only after explicitly aiming with per-origin resources', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    const target = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    render(<InteractiveConsole {...props} />);
    const energy = screen.getByLabelText('Fleet energy percentage');
    expect(energy).toHaveValue('50');
    fireEvent.change(energy, { target: { value: '75' } });
    await user.click(zoomToPlanet(new RegExp(`${target.name}, level`, 'i')));
    expect(props.onChoosePlanet).toHaveBeenLastCalledWith(target.id);
    expect(props.onSetTarget).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send (Q)' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /first-light, level/i }));
    expect(screen.getByLabelText('Fleet energy percentage')).toHaveValue('75');
    await user.click(screen.getByRole('button', { name: 'Send (Q)' }));
    expect(props.onMoveIntent).not.toHaveBeenCalled();
    await user.click(zoomToPlanet(new RegExp(`${target.name}, level`, 'i')));
    expect(props.onMoveIntent).toHaveBeenCalledExactlyOnceWith({ kind: 'fleet', artifactId: undefined, energyPercentage: 75, silverPercentage: 0, sourceId: 'home', targetId: target.id });
  });

  it('remembers independent friendly-origin percentages and cancels keyboard aiming', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    const other = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    props.game = { ...props.game, planets: props.game.planets.map((planet) => ({ ...planet,
      owner: planet.id === other.id ? 'player' as const : planet.owner, silver: 400 })) };
    render(<InteractiveConsole {...props} />);
    const map = screen.getByLabelText(/star map camera/i);
    fireEvent.keyDown(map, { key: '9' });
    fireEvent.keyDown(map, { key: '4', shiftKey: true });
    await user.click(screen.getByRole('button', { name: new RegExp(`${other.name}, level`, 'i') }));
    expect(screen.getByLabelText('Fleet energy percentage')).toHaveValue('50');
    expect(screen.getByLabelText('Fleet silver percentage')).toHaveValue('0');
    fireEvent.keyDown(map, { key: '2' });
    await user.click(screen.getByRole('button', { name: /first-light, level/i }));
    expect(screen.getByLabelText('Fleet energy percentage')).toHaveValue('90');
    expect(screen.getByLabelText('Fleet silver percentage')).toHaveValue('40');
    fireEvent.keyDown(map, { key: 'q' });
    expect(map).toHaveClass('is-aiming');
    fireEvent.keyDown(map, { key: 'Escape' });
    expect(map).not.toHaveClass('is-aiming');
    expect(props.onMoveIntent).not.toHaveBeenCalled();
  });

  it('drag-sends exactly once, while pointer cancellation never sends', () => {
    setViewport(1280, 800);
    const props = strategyProps();
    render(<InteractiveConsole {...props} />);
    const home = screen.getByRole('button', { name: /first-light, level/i });
    const targetPlanet = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    const target = zoomToPlanet(new RegExp(`${targetPlanet.name}, level`, 'i'));
    fireEvent.pointerDown(home, { pointerId: 11, button: 0, isPrimary: true, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(target, { pointerId: 11, clientX: 500, clientY: 400 });
    fireEvent.pointerCancel(target, { pointerId: 11 });
    expect(props.onMoveIntent).not.toHaveBeenCalled();
    fireEvent.pointerDown(home, { pointerId: 12, button: 0, isPrimary: true, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(target, { pointerId: 12, clientX: 500, clientY: 400 });
    fireEvent.pointerUp(target, { pointerId: 12, clientX: 500, clientY: 400 });
    fireEvent.click(target);
    expect(props.onMoveIntent).toHaveBeenCalledExactlyOnceWith({ kind: 'fleet', artifactId: undefined, energyPercentage: 50, silverPercentage: 0, sourceId: 'home', targetId: targetPlanet.id });
  });

  it('keeps an unreachable destination in preview without dispatching', async () => {
    setViewport(1280, 800);
    const user = userEvent.setup();
    const props = strategyProps();
    const target = props.game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    props.game = { ...props.game, planets: props.game.planets.map((planet) => planet.id === target.id ? { ...planet, x: 100_000, y: 100_000 } : planet) };
    render(<InteractiveConsole {...props} />);
    await user.click(screen.getByRole('button', { name: 'Send (Q)' }));
    await user.click(zoomToPlanet(new RegExp(`${target.name}, level`, 'i')));
    expect(screen.getByText(/not enough energy survives/i)).toBeInTheDocument();
    expect(props.onMoveIntent).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/star map camera/i)).toHaveClass('is-aiming');
  });
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
    expect(props.onMoveIntent).not.toHaveBeenCalled();
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
    await user.click(zoomToPlanet(/level 0 regular, neutral/i));
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
    expect(props.onAbility).toHaveBeenCalledExactlyOnceWith('home', { kind: 'withdraw-silver' });
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
    fireEvent.keyDown(map, { key: '[' });
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
    expect(screen.getByTestId(`voyage-fleet-${voyage.id}`)).toBeInTheDocument();
    expect(route).not.toHaveAttribute('marker-end');
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
    const destination = zoomToPlanet(new RegExp(`${target.name}, level`, 'i'));
    expect(Number(route.getAttribute('x1'))).toBeCloseTo(Number.parseFloat(origin.style.left));
    expect(Number(route.getAttribute('y2'))).toBeCloseTo(Number.parseFloat(destination.style.top));
    expect(destination.querySelector('.planet-map-label')).toHaveTextContent('TARGET');
    expect(props.onMoveIntent).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.voyage-route')).toHaveLength(0);
  });
});
