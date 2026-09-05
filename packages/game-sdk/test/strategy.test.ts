import { describe, expect, it } from 'vitest';
import {
  advanceStrategyToNextArrival,
  advanceStrategyTime,
  abandonStrategyPlanet,
  activateStrategyArtifact,
  activateStrategyCrescent,
  captureStrategyPlanet,
  claimStrategyStartingShips,
  createStrategyGame,
  dispatchStrategyShip,
  dispatchStrategyArtifact,
  dispatchStrategyVoyage,
  previewStrategyVoyage,
  strategySendingEnergy,
  deactivateStrategyArtifact,
  invadeStrategyPlanet,
  scanStrategyUniverse,
  selectStrategyPlanet,
  setStrategyTarget,
  settleStrategyGame,
  depositStrategyArtifact,
  withdrawStrategyArtifact,
  withdrawStrategySilver,
  type StrategyArtifact,
} from '../src/strategy';

function fixtureArtifact(
  id: string,
  type: StrategyArtifact['type'],
  planetId: string,
  rarity = 1,
): StrategyArtifact {
  return {
    id,
    type,
    rarity,
    planetId,
    activations: 0,
    active: false,
    biome: 0,
    mintedAt: 0,
    burned: false,
  };
}

describe('local Round 5 strategy universe', () => {
  it('inspects neutral, rival and friendly planets without setting a destination', () => {
    const game = createStrategyGame({ universeSeed: 'inspect', homeId: 'home', homeName: 'HOME' });
    for (const owner of ['neutral', 'rival', 'player'] as const) {
      const other = game.planets.find((planet) => planet.discovered && !planet.isHome)!;
      const selected = selectStrategyPlanet({ ...game, targetPlanetId: other.id,
        planets: game.planets.map((planet) => planet.id === other.id ? { ...planet, owner } : planet) }, other.id);
      expect(selected.selectedPlanetId).toBe(other.id);
      expect(selected.targetPlanetId).toBeUndefined();
      expect(selected.voyages).toEqual([]);
    }
  });

  it('quotes the same normal route it dispatches and reserves energy at 100% input', () => {
    const game = createStrategyGame({ universeSeed: 'quote', homeId: 'home', homeName: 'HOME' });
    const target = game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    const quote = previewStrategyVoyage(game, 'home', target.id, 100);
    expect(quote.error).toBeUndefined();
    const next = dispatchStrategyVoyage(setStrategyTarget(game, target.id), 100);
    expect(next.voyages[0]).toMatchObject({ energySent: quote.energySent, energyArriving: quote.energyArriving, arrivalAt: game.now + quote.travelTime });
    expect(quote.energySent).toBe(49_000);
    expect(next.planets.find((planet) => planet.id === 'home')!.energy).toBe(1_000);
    expect(game.voyages).toEqual([]);
    expect(strategySendingEnergy(1.5, 100)).toBe(0);
    expect(strategySendingEnergy(2.5, 100)).toBe(1);
    for (const percentage of [Number.NaN, Infinity, -1, 101]) {
      expect(previewStrategyVoyage(game, 'home', target.id, percentage).error).toBeDefined();
      expect(() => dispatchStrategyVoyage(setStrategyTarget(game, target.id), percentage)).toThrow();
    }
  });
  it('is deterministic and expands private discovery', () => {
    const left = createStrategyGame({ universeSeed: 'seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const right = createStrategyGame({ universeSeed: 'seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    expect(left.planets).toEqual(right.planets);
    expect(left.planets.filter((planet) => planet.planetType === 'SpacetimeRip')).toHaveLength(1);
    const discoveredBefore = left.planets.filter((planet) => planet.discovered).length;
    const scanned = scanStrategyUniverse(left);
    expect(scanned.planets.filter((planet) => planet.discovered).length).toBeGreaterThan(discoveredBefore);
  });

  it('claims and moves the five ships without letting a ship conquer', () => {
    let game = createStrategyGame({ universeSeed: 'ship-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    game = claimStrategyStartingShips(game);
    expect(game.artifacts.map((artifact) => artifact.type)).toEqual([
      'Mothership', 'Crescent', 'Whale', 'Gear', 'Titan',
    ]);
    const target = game.planets.find((planet) =>
      planet.discovered && planet.owner === 'neutral' && planet.level >= 1 && planet.planetType !== 'SilverMine');
    expect(target).toBeDefined();
    game = setStrategyTarget(game, target!.id);
    const crescent = game.artifacts.find((artifact) => artifact.type === 'Crescent')!;
    game = dispatchStrategyShip(game, crescent.id);
    expect(game.voyages[0]?.energyArriving).toBe(0);
    game = advanceStrategyToNextArrival(game);
    expect(game.planets.find((planet) => planet.id === target!.id)?.owner).toBe('neutral');
    expect(game.artifacts.find((artifact) => artifact.id === crescent.id)?.planetId).toBe(target!.id);
    game = activateStrategyCrescent(game, crescent.id);
    expect(game.planets.find((planet) => planet.id === target!.id)?.planetType).toBe('SilverMine');
    expect(game.planets.find((planet) => planet.id === target!.id)?.silver).toBe(1);
  });

  it('holds and captures under the Round 5 checkpoint and energy predicates', () => {
    let game = createStrategyGame({ universeSeed: 'capture-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const home = game.planets.find((planet) => planet.isHome)!;
    game = { ...game, captureZones: [{ id: 'fixture-zone', x: home.x, y: home.y, radius: 1_000 }] };
    game = invadeStrategyPlanet(game);
    expect(game.planets.find((planet) => planet.id === 'home')?.invadedAt).toBe(0);
    game = advanceStrategyTime(game, 2_048);
    game = captureStrategyPlanet(game);
    expect(game.planets.find((planet) => planet.id === 'home')?.captured).toBe(true);
  });

  it('launches, waits, and resolves a conquest using shared rules', () => {
    let game = createStrategyGame({ universeSeed: 'combat-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const home = game.planets.find((planet) => planet.isHome)!;
    const target = game.planets.find((planet) =>
      planet.discovered && planet.owner === 'neutral' &&
      Math.hypot(planet.x - home.x, planet.y - home.y) < 700);
    expect(target).toBeDefined();
    game = selectStrategyPlanet(game, 'home');
    game = setStrategyTarget(game, target!.id);
    game = dispatchStrategyVoyage(game, 90);
    expect(game.voyages).toHaveLength(1);
    expect(game.planets.find((planet) => planet.id === 'home')!.energy).toBe(5_000);
    expect(game.spaceJunk).toBe(target!.spaceJunk);
    expect(game.planets.find((planet) => planet.id === target!.id)!.spaceJunk).toBe(0);
    game = advanceStrategyToNextArrival(game);
    expect(game.voyages).toHaveLength(0);
    expect(game.planets.find((planet) => planet.id === target!.id)!.owner).toBe('player');
  });

  it('moves silver with a fleet and caps it at the destination', () => {
    let game = createStrategyGame({ universeSeed: 'silver-route-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const target = game.planets.find((planet) => planet.discovered && planet.owner === 'neutral')!;
    game = {
      ...game,
      targetPlanetId: target.id,
      planets: game.planets.map((planet) => planet.id === 'home'
        ? { ...planet, silver: 400 }
        : planet.id === target.id
          ? { ...planet, silver: 0, silverCapacity: 250 }
          : planet),
    };
    game = dispatchStrategyVoyage(game, 90, 400);
    expect(game.voyages[0]?.silverMoved).toBe(400);
    expect(game.planets.find((planet) => planet.id === 'home')?.silver).toBe(0);
    game = advanceStrategyToNextArrival(game);
    expect(game.planets.find((planet) => planet.id === target.id)?.silver).toBe(250);
  });

  it('activates and deactivates legacy stat artifacts with contract rounding', () => {
    let game = createStrategyGame({ universeSeed: 'artifact-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const monolith = fixtureArtifact('monolith', 'Monolith', 'home');
    game = {
      ...game,
      artifacts: [monolith],
      planets: game.planets.map((planet) => planet.id === 'home'
        ? { ...planet, artifactIds: [monolith.id] }
        : planet),
    };
    game = activateStrategyArtifact(game, monolith.id);
    const activeHome = game.planets.find((planet) => planet.id === 'home')!;
    expect(activeHome.energyCapacity).toBe(105_000);
    expect(activeHome.activeArtifactId).toBe(monolith.id);
    game = deactivateStrategyArtifact(game, monolith.id);
    expect(game.planets.find((planet) => planet.id === 'home')!.energyCapacity).toBe(100_000);
    expect(game.artifacts[0]?.active).toBe(false);
  });

  it('consumes a charged Photoid on departure and applies its temporary route speed', () => {
    let game = createStrategyGame({ universeSeed: 'photoid-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const photoid = fixtureArtifact('photoid', 'PhotoidCannon', 'home', 1);
    game = {
      ...game,
      artifacts: [photoid],
      planets: game.planets.map((planet) => planet.id === 'home'
        ? { ...planet, artifactIds: [photoid.id] }
        : planet),
    };
    game = activateStrategyArtifact(game, photoid.id);
    expect(game.planets.find((planet) => planet.id === 'home')!.defense).toBe(200);
    game = advanceStrategyTime(game, 10_800);
    const target = game.planets.find((planet) => planet.discovered && planet.owner === 'neutral')!;
    game = setStrategyTarget(game, target.id);
    const normalTravel = Math.max(1, Math.floor((Math.hypot(target.x, target.y) * 100) / 75));
    const quote = previewStrategyVoyage(game, 'home', target.id, 90);
    expect(game.artifacts[0]?.burned).toBe(false);
    game = dispatchStrategyVoyage(game, 90);
    expect(game.voyages[0]).toMatchObject({ energySent: quote.energySent, energyArriving: quote.energyArriving, arrivalAt: game.now + quote.travelTime });
    expect(game.voyages[0]!.arrivalAt - game.now).toBeLessThan(normalTravel);
    expect(game.artifacts[0]?.burned).toBe(true);
    expect(game.planets.find((planet) => planet.id === 'home')!.defense).toBe(400);
  });

  it('carries an inactive artifact with a fleet and attaches it on arrival', () => {
    let game = createStrategyGame({ universeSeed: 'carry-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const pyramid = fixtureArtifact('pyramid', 'Pyramid', 'home');
    game = {
      ...game,
      artifacts: [pyramid],
      planets: game.planets.map((planet) => planet.id === 'home'
        ? { ...planet, artifactIds: [pyramid.id] }
        : planet),
    };
    const target = game.planets.find((planet) => planet.discovered && planet.owner === 'neutral')!;
    game = setStrategyTarget(game, target.id);
    game = dispatchStrategyArtifact(game, pyramid.id, 90);
    expect(game.artifacts[0]?.voyageId).toBe(game.voyages[0]?.id);
    game = advanceStrategyToNextArrival(game);
    expect(game.artifacts[0]?.planetId).toBe(target.id);
    expect(game.planets.find((planet) => planet.id === target.id)?.artifactIds).toContain(pyramid.id);
  });

  it('warps artifacts and extracts score only through a controlled Spacetime Rip', () => {
    let game = createStrategyGame({ universeSeed: 'rift-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const pyramid = fixtureArtifact('rift-pyramid', 'Pyramid', 'home', 1);
    game = {
      ...game,
      artifacts: [pyramid],
      planets: game.planets.map((planet) => planet.id === 'home'
        ? {
          ...planet,
          level: 2,
          planetType: 'SpacetimeRip',
          silver: 200_000,
          silverCapacity: 500_000,
          artifactIds: [pyramid.id],
        }
        : planet),
    };

    game = withdrawStrategyArtifact(game, pyramid.id);
    expect(game.artifacts[0]).toMatchObject({ planetId: undefined, externalOwner: 'player' });
    expect(game.planets.find((planet) => planet.id === 'home')?.artifactIds).not.toContain(pyramid.id);

    game = depositStrategyArtifact(game, pyramid.id);
    expect(game.artifacts[0]).toMatchObject({ planetId: 'home', externalOwner: undefined });
    expect(game.planets.find((planet) => planet.id === 'home')?.artifactIds).toContain(pyramid.id);

    game = withdrawStrategySilver(game, 100_000);
    expect(game.planets.find((planet) => planet.id === 'home')?.silver).toBe(100_000);
    expect(game.score).toBe(10);
    expect(game.log[0]?.message).toMatch(/extracted through the Rip/);
  });

  it('freezes Last Light only after every local voyage resolves', () => {
    let game = createStrategyGame({ universeSeed: 'settle-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const target = game.planets.find((planet) => planet.discovered && planet.owner === 'neutral')!;
    game = setStrategyTarget(game, target.id);
    game = dispatchStrategyVoyage(game, 90);
    expect(() => settleStrategyGame(game)).toThrow(/Resolve every pending voyage/);
    game = advanceStrategyToNextArrival(game);
    game = settleStrategyGame(game);
    expect(game.settled).toBe(true);
    expect(game.finalScore).toBe(game.score);
    expect(() => advanceStrategyTime(game, 1)).toThrow(/already settled/);
  });

  it('preserves the hostile Wormhole no-energy arrival quirk', () => {
    let game = createStrategyGame({ universeSeed: 'wormhole-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const endpoint = game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    const wormhole = fixtureArtifact('wormhole', 'Wormhole', 'home', 1);
    game = {
      ...game,
      artifacts: [wormhole],
      planets: game.planets.map((planet) => planet.id === 'home'
        ? { ...planet, artifactIds: [wormhole.id] }
        : planet.id === endpoint.id ? { ...planet, owner: 'player' } : planet),
    };
    game = setStrategyTarget(game, endpoint.id);
    game = activateStrategyArtifact(game, wormhole.id, endpoint.id);
    const energyBefore = game.planets.find((planet) => planet.id === endpoint.id)!.energy;
    game = {
      ...game,
      planets: game.planets.map((planet) => planet.id === endpoint.id
        ? { ...planet, owner: 'neutral' }
        : planet),
    };
    const quote = previewStrategyVoyage(game, 'home', endpoint.id, 90);
    expect(quote.defenseDamage).toBe(0);
    game = dispatchStrategyVoyage(game, 90);
    expect(game.voyages[0]).toMatchObject({ arrivalType: 'Wormhole', energyArriving: quote.energyArriving, arrivalAt: game.now + quote.travelTime });
    game = advanceStrategyToNextArrival(game);
    expect(game.planets.find((planet) => planet.id === endpoint.id)?.owner).toBe('neutral');
    expect(game.planets.find((planet) => planet.id === endpoint.id)?.energy).toBe(energyBefore);
  });

  it('can carry an inactive artifact while abandoning a non-home planet', () => {
    let game = createStrategyGame({ universeSeed: 'abandon-carry-seed', homeId: 'home', homeName: 'FIRST-LIGHT' });
    const source = game.planets.find((planet) => planet.discovered && !planet.isHome)!;
    game = scanStrategyUniverse(game);
    const target = game.planets.find((planet) => planet.discovered && !planet.isHome && planet.id !== source.id)!;
    const pyramid = fixtureArtifact('abandon-pyramid', 'Pyramid', source.id);
    game = {
      ...game,
      selectedPlanetId: source.id,
      targetPlanetId: target.id,
      artifacts: [pyramid],
      planets: game.planets.map((planet) => planet.id === source.id
        ? { ...planet, owner: 'player', energy: Math.max(50_000, planet.energy), artifactIds: [pyramid.id] }
        : planet),
    };
    game = abandonStrategyPlanet(game, pyramid.id);
    expect(game.planets.find((planet) => planet.id === source.id)?.owner).toBe('neutral');
    expect(game.artifacts[0]?.voyageId).toBe(game.voyages[0]?.id);
    game = advanceStrategyToNextArrival(game);
    expect(game.artifacts[0]?.planetId).toBe(target.id);
  });
});
