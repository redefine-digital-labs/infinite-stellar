import { describe, expect, it } from 'vitest';
import {
  chooseHomeSearchOrigin, createStrategyGame, isRound5HomeLocation,
  mergeMinedStrategyLocations, round5WorldLocation,
} from '../src';

const home = round5WorldLocation({ x: 73, y: 6421 })!;

describe('natural Round-5 home generation', () => {
  it('checks exact MiMC/Perlin, home band, level/type and origin-centered radius', () => {
    expect(isRound5HomeLocation(home)).toBe(true);
    for (const invalid of [
      { ...home, x: home.x + 1 }, { ...home, perlin: 14 },
      { ...home, biomebase: home.biomebase + 1 }, { ...home, locationId: '0'.repeat(64) },
      { ...home, x: 12_000, y: 0 }, { ...home, x: NaN },
    ]) expect(isRound5HomeLocation(invalid)).toBe(false);
  });

  it('samples a region, not a precomputed planet or a Soul-derived coordinate', () => {
    let index = 0;
    const samples = [0, 0, (73.5 / 12_000 + 1) / 2, (6421.5 / 12_000 + 1) / 2];
    const origin = chooseHomeSearchOrigin(() => samples[index++]!);
    expect(index).toBe(4); // first sample was outside the circular world
    expect(origin).toEqual({ x: 73, y: 6421 });
    expect(() => chooseHomeSearchOrigin(() => 1)).toThrow(/random/);
  });

  it('starts with exactly the supplied verified home and no hidden fixtures', () => {
    const game = createStrategyGame({ universeSeed: 'public-round5', homeId: home.locationId,
      homeName: 'Home', homeLocation: home });
    expect(game.planets).toHaveLength(1);
    expect(game.planets[0]).toMatchObject({ x: home.x, y: home.y, locationId: home.locationId,
      energy: 50_000, isHome: true, owner: 'player', level: 0, planetType: 'Regular' });
    expect(game.exploredChunks).toEqual([]);
    expect(() => createStrategyGame({ universeSeed: 'test', homeId: 'fake', homeName: 'fake',
      homeLocation: { ...home, x: 0 } })).toThrow(/verified/);
  });

  it('retains the natural planet type when exploration reveals a neighbor', () => {
    const game = createStrategyGame({ universeSeed: 'test', homeId: home.locationId, homeName: 'Home', homeLocation: home });
    const neighbor = round5WorldLocation({ x: 269, y: 6442 })!;
    const discovered = mergeMinedStrategyLocations(game, [neighbor], [{index:0, x:256,y:6432,side:16}]);
    expect(discovered.planets).toHaveLength(2);
    expect(discovered.planets[1]).toMatchObject({locationId:neighbor.locationId, planetType:'Regular', isHome:false});
  });
});
