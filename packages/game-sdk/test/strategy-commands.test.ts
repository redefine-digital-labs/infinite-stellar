import { describe, expect, it } from 'vitest';
import {
  createStrategyGame, claimStrategyStartingShips, executeStrategyMoveIntent,
  previewStrategyMoveIntent, strategyAbilityStatus, executeStrategyAbility, routeDistanceBound,
  previewStrategyFreeSpace,
  scanStrategyUniverse,
  type StrategyArtifact, type StrategyGame, type StrategyMoveIntent,
} from '../src';

function fixture() {
  const base = scanStrategyUniverse(createStrategyGame({ universeSeed: 'command', homeId: 'home', homeName: 'HOME' }));
  const target = base.planets.find((planet) => planet.discovered && !planet.isHome)!;
  const artifact: StrategyArtifact = { id: 'cargo', type: 'Pyramid', rarity: 1, planetId: 'home',
    activations: 0, active: false, biome: 0, mintedAt: 0, burned: false };
  const game: StrategyGame = { ...base, artifacts: [artifact], planets: base.planets.map((planet) =>
    planet.id === 'home' ? { ...planet, silver: 400, artifactIds: [artifact.id] } : planet) };
  return { game, target, artifact };
}

function freezeDeep(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value);
  Object.values(value).forEach(freezeDeep);
}

describe('complete strategy move intents', () => {
  it('uses the same direct-space energy and travel math for the cursor, reach edge and dispatch', () => {
    const { game, target } = fixture();
    const home = game.planets.find((planet) => planet.id === 'home')!;
    const cursor = previewStrategyFreeSpace(game, 'home', target, 75);
    const quote = previewStrategyMoveIntent(game, { kind: 'fleet', sourceId: 'home', targetId: target.id,
      energyPercentage: 75, silverPercentage: 0 });
    expect(cursor).toMatchObject({ energyArriving: quote.energyArriving, travelTime: quote.travelTime, distance: quote.distance });
    expect(previewStrategyFreeSpace(game, 'home', { x: home.x + cursor.maxDistance, y: home.y }, 75).energyArriving).toBeGreaterThan(0);
    expect(previewStrategyFreeSpace(game, 'home', { x: home.x + cursor.maxDistance + 1, y: home.y }, 75).energyArriving).toBe(0);
    expect(previewStrategyFreeSpace(game, 'home', target, 25).maxDistance).toBeLessThan(cursor.maxDistance);
    expect(previewStrategyFreeSpace(game, 'home', target, 0).maxDistance).toBe(0);
  });
  it('carries the chosen percentages and artifact through the same pure preview and dispatch', () => {
    const { game, target } = fixture();
    freezeDeep(game);
    const intent: StrategyMoveIntent = { kind: 'fleet', sourceId: 'home', targetId: target.id,
      artifactId: 'cargo', energyPercentage: 75, silverPercentage: 40 };
    const quote = previewStrategyMoveIntent(game, intent);
    expect(quote.error).toBeUndefined();
    expect(quote).toMatchObject({ energySent: 37_500, silverMoved: 160, artifactId: 'cargo' });
    const next = executeStrategyMoveIntent(game, intent);
    expect(next.voyages[0]).toMatchObject({ energySent: quote.energySent, silverMoved: quote.silverMoved,
      energyArriving: quote.energyArriving, carriedArtifactId: 'cargo', arrivalAt: game.now + quote.travelTime });
    expect(game.artifacts[0]!.planetId).toBe('home');
    expect(next.artifacts[0]!.planetId).toBeUndefined();
  });

  it('moves a controlled ship from a neutral host with zero resources and no conquest intent', () => {
    const { game: original, target } = fixture();
    const withShips = claimStrategyStartingShips(original);
    expect(withShips.artifacts.some((artifact) => artifact.id === 'cargo')).toBe(true);
    const ship = withShips.artifacts.find((artifact) => artifact.type === 'Gear')!;
    const game = { ...withShips, planets: withShips.planets.map((planet) => planet.id === 'home'
      ? { ...planet, owner: 'neutral' as const } : planet) };
    freezeDeep(game);
    const intent: StrategyMoveIntent = { kind: 'ship', sourceId: 'home', targetId: target.id,
      artifactId: ship.id, energyPercentage: 75, silverPercentage: 100 };
    const quote = previewStrategyMoveIntent(game, intent);
    expect(quote.error).toBeUndefined();
    expect(quote).toMatchObject({ energySent: 0, energyArriving: 0, silverMoved: 0, defenseDamage: 0 });
    const next = executeStrategyMoveIntent(game, intent);
    expect(next.voyages[0]).toMatchObject({ kind: 'ship', energySent: 0, silverMoved: 0, arrivalAt: game.now + quote.travelTime });
  });

  it('quotes abandonment with all resources and rejects Home, self and incoming voyages', () => {
    const { game: original, target } = fixture();
    const game = { ...original, planets: original.planets.map((planet) => planet.id === target.id
      ? { ...planet, owner: 'player' as const, energy: 100_000, silver: 321, range: 1000 } : planet) };
    const intent: StrategyMoveIntent = { kind: 'abandon', sourceId: target.id, targetId: 'home', energyPercentage: 10, silverPercentage: 0 };
    freezeDeep(game);
    const quote = previewStrategyMoveIntent(game, intent);
    expect(quote.error).toBeUndefined();
    expect(quote).toMatchObject({ energySent: 100_000, silverMoved: 321 });
    const next = executeStrategyMoveIntent(game, intent);
    expect(next.voyages[0]).toMatchObject({ energySent: quote.energySent, energyArriving: quote.energyArriving, arrivalAt: game.now + quote.travelTime });
    expect(next.planets.find((planet) => planet.id === target.id)!.owner).toBe('neutral');
    expect(previewStrategyMoveIntent(game, { ...intent, sourceId: 'home', targetId: target.id }).error).toMatch(/non-home/i);
    expect(previewStrategyMoveIntent(game, { ...intent, targetId: target.id }).error).toBeDefined();
    const incoming = { ...game, voyages: [{ ...next.voyages[0]!, toPlanetId: target.id }] };
    expect(previewStrategyMoveIntent(incoming, intent).error).toMatch(/incoming/i);
  });

  it('revalidates ownership and cargo at execution even after a valid preview', () => {
    const { game, target } = fixture();
    const intent: StrategyMoveIntent = { kind: 'fleet', sourceId: 'home', targetId: target.id,
      artifactId: 'cargo', energyPercentage: 75, silverPercentage: 0 };
    expect(previewStrategyMoveIntent(game, intent).error).toBeUndefined();
    const conquered = { ...game, planets: game.planets.map((planet) => planet.id === 'home' ? { ...planet, owner: 'rival' as const } : planet) };
    expect(() => executeStrategyMoveIntent(conquered, intent)).toThrow(/controlled/i);
    expect(() => executeStrategyMoveIntent({ ...game, artifacts: [] }, intent)).toThrow(/artifact/i);
    expect(strategyAbilityStatus(game, target.id, { kind: 'upgrade', branch: 'range' }).allowed).toBe(false);
    expect(strategyAbilityStatus(game, 'home', { kind: 'prospect' }).reason).toMatch(/Ruins/);
    expect(() => executeStrategyAbility(game, target.id, { kind: 'activate', artifactId: 'cargo' })).toThrow(/selected Planet/);
  });

  it('uses a ceiling distance bound even where floating sqrt rounds down', () => {
    expect(routeDistanceBound({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5n);
    expect(routeDistanceBound({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(2n);
    expect(routeDistanceBound({ x: 0, y: 0 }, { x: 1_000_000_000, y: 1 })).toBe(1_000_000_001n);
    const { game, target } = fixture();
    const home = game.planets.find((planet) => planet.id === 'home')!;
    const close = { ...game, planets: game.planets.map((planet) => planet.id === target.id ? { ...planet, x: home.x + 1, y: home.y + 1 } : planet) };
    expect(previewStrategyMoveIntent(close, { kind: 'fleet', sourceId: 'home', targetId: target.id, energyPercentage: 50, silverPercentage: 0 }).distance).toBe(2);
  });
});
