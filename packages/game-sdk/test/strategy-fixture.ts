import { createStrategyGame as createNaturalGame, mergeMinedStrategyLocations, round5WorldLocation, type StrategyGame } from '../src';

// Test-only survey and synthetic rift for targeted ability regressions.
// This file is never imported by the player runtime.
const ROUND5_LOCAL_COORDINATES = [
  [73, 6421], [269, 6442], [-12, 6384], [-94, 6581], [-46, 6238], [0, 6236],
  [202, 6221], [-111, 6630], [-75, 6640], [173, 6641], [-147, 6418], [310, 6660],
  [68, 6662], [-75, 6670], [271, 6166], [-118, 6165], [334, 6481], [-136, 6682],
  [-71, 6155], [-32, 6142], [-40, 6133], [367, 6690], [-228, 6232], [377, 6272],
  [73, 6728], [89, 6734], [298, 6106], [-48, 6097], [83, 6097], [-76, 6749],
  [-261, 6351], [260, 6085], [282, 6082], [417, 6495], [391, 6779], [-69, 6779],
  [70, 6782], [5, 6784], [257, 6785], [-292, 6727], [442, 6335], [444, 6214],
  [445, 6575], [448, 6238], [201, 6043], [-311, 6779], [-313, 6071], [-315, 6246],
] as const;
let surveyedPlanets: StrategyGame['planets'] | undefined;
export function createStrategyGame(input: { universeSeed: string; homeId: string; homeName: string }): StrategyGame {
  const home = round5WorldLocation({ x: 73, y: 6421 })!;
  const game = createNaturalGame({ ...input, homeLocation: home });
  if (surveyedPlanets) return { ...game, planets: [...game.planets, ...structuredClone(surveyedPlanets)] };
  const locations = ROUND5_LOCAL_COORDINATES.slice(1).map(([x,y]) => round5WorldLocation({x,y})!);
  const chunks = locations.map((point, index) => ({index, x: Math.floor(point.x/16)*16, y:Math.floor(point.y/16)*16, side:16}));
  const surveyed = mergeMinedStrategyLocations(game, locations, chunks);
  const candidate = surveyed.planets.filter(planet => !planet.isHome && planet.planetType === 'Regular' && planet.level >= 2)
    .sort((a,b) => b.level-a.level || a.id.localeCompare(b.id))[0]!;
  surveyedPlanets = surveyed.planets.filter(planet => !planet.isHome).map(planet => ({
    ...planet, discovered:false,
    ...(planet.id === candidate.id ? {planetType:'SpacetimeRip' as const, defense:Math.floor(planet.defense/2), silverCapacity:planet.silverCapacity*2} : {}),
  }));
  return { ...game, planets: [...game.planets, ...structuredClone(surveyedPlanets)] };
}
