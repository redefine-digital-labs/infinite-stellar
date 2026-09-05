import {
  abandonStrategyPlanet, activateStrategyArtifact, activateStrategyCrescent,
  captureStrategyPlanet, claimStrategyStartingShips, deactivateStrategyArtifact,
  depositStrategyArtifact, dispatchStrategyShip, dispatchStrategyVoyage,
  findStrategyArtifact, invadeStrategyPlanet, prospectStrategyPlanet, revealStrategyPlanet,
  selectStrategyPlanet, setStrategyTarget, upgradeStrategyPlanet,
  withdrawStrategyArtifact, withdrawStrategySilver,
  type StrategyGame, type StrategyVoyage,
} from './strategy';
import type { Round5UpgradeBranch } from './round5-rules';

export type StrategyMoveMode =
  | { kind: 'fleet'; artifactId?: string }
  | { kind: 'ship'; artifactId: string }
  | { kind: 'abandon'; artifactId?: string };

/** UI intent, not proof of ownership or a chain transaction. Always revalidated at execution. */
export type StrategyMoveIntent = StrategyMoveMode & {
  sourceId: string;
  targetId: string;
  energyPercentage: number;
  silverPercentage: number;
};

export function executeStrategyMoveIntent(game: StrategyGame, intent: StrategyMoveIntent): StrategyGame {
  const selected = setStrategyTarget(selectStrategyPlanet(game, intent.sourceId), intent.targetId);
  if (intent.kind === 'ship') return dispatchStrategyShip(selected, intent.artifactId);
  if (intent.kind === 'abandon') return abandonStrategyPlanet(selected, intent.artifactId);
  if (!Number.isFinite(intent.silverPercentage) || intent.silverPercentage < 0 || intent.silverPercentage > 100) {
    throw new Error('Silver percentage must be between 0 and 100.');
  }
  const source = selected.planets.find((planet) => planet.id === intent.sourceId)!;
  return dispatchStrategyVoyage(selected, intent.energyPercentage,
    Math.floor(source.silver * intent.silverPercentage / 100), intent.artifactId);
}

export interface StrategyMovePreview {
  error?: string;
  distance: number;
  energySent: number;
  energyArriving: number;
  silverMoved: number;
  travelTime: number;
  friendly: boolean;
  defenseDamage: number;
  spaceJunk: number;
  arrivalType?: StrategyVoyage['arrivalType'];
  kind: StrategyMoveMode['kind'];
  artifactId?: string;
}

/** Evaluate the pure transition without committing it: all modes use actual dispatch rules. */
export function previewStrategyMoveIntent(game: StrategyGame, intent: StrategyMoveIntent): StrategyMovePreview {
  const empty: StrategyMovePreview = { distance: 0, energySent: 0, energyArriving: 0,
    silverMoved: 0, travelTime: 0, friendly: false, defenseDamage: 0, spaceJunk: 0,
    kind: intent.kind, artifactId: intent.artifactId };
  try {
    const next = executeStrategyMoveIntent(game, intent);
    const voyage = next.voyages.at(-1)!;
    const target = game.planets.find((planet) => planet.id === intent.targetId)!;
    const friendly = target.owner === 'player';
    return { ...empty, distance: voyage.distance, energySent: voyage.energySent,
      energyArriving: voyage.energyArriving, silverMoved: voyage.silverMoved,
      travelTime: voyage.arrivalAt - voyage.departureAt, friendly,
      defenseDamage: friendly || voyage.arrivalType === 'Wormhole' || intent.kind === 'ship'
        ? 0 : Math.floor(voyage.energyArriving * 100 / target.defense),
      spaceJunk: next.spaceJunk - game.spaceJunk, arrivalType: voyage.arrivalType };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : 'This route is unavailable.' };
  }
}

export type StrategyAbility =
  | { kind: 'upgrade'; branch: Round5UpgradeBranch }
  | { kind: 'prospect' | 'find' | 'invade' | 'capture' | 'reveal' | 'withdraw-silver' | 'claim-ships' }
  | { kind: 'activate' | 'deactivate' | 'crescent' | 'withdraw-artifact' | 'deposit-artifact'; artifactId: string; endpointId?: string };

export function executeStrategyAbility(game: StrategyGame, sourceId: string, ability: StrategyAbility): StrategyGame {
  const selected = selectStrategyPlanet(game, sourceId);
  if ('artifactId' in ability && ability.kind !== 'deposit-artifact' &&
      selected.artifacts.find((artifact) => artifact.id === ability.artifactId)?.planetId !== sourceId) {
    throw new Error('The artifact is not on the selected Planet.');
  }
  switch (ability.kind) {
    case 'upgrade': return upgradeStrategyPlanet(selected, ability.branch);
    case 'prospect': return prospectStrategyPlanet(selected);
    case 'find': return findStrategyArtifact(selected);
    case 'invade': return invadeStrategyPlanet(selected);
    case 'capture': return captureStrategyPlanet(selected);
    case 'reveal': return revealStrategyPlanet(selected);
    case 'withdraw-silver': return withdrawStrategySilver(selected);
    case 'claim-ships': return claimStrategyStartingShips(selected);
    case 'activate': return activateStrategyArtifact(selected, ability.artifactId, ability.endpointId);
    case 'deactivate': return deactivateStrategyArtifact(selected, ability.artifactId);
    case 'crescent': return activateStrategyCrescent(selected, ability.artifactId);
    case 'withdraw-artifact': return withdrawStrategyArtifact(selected, ability.artifactId);
    case 'deposit-artifact': return depositStrategyArtifact(selected, ability.artifactId);
  }
}

export function strategyAbilityStatus(game: StrategyGame, sourceId: string | undefined, ability: StrategyAbility) {
  try {
    if (!sourceId) throw new Error('Select a Planet first.');
    executeStrategyAbility(game, sourceId, ability);
    return { allowed: true, reason: undefined };
  } catch (error) {
    return { allowed: false, reason: error instanceof Error ? error.message : 'This ability is unavailable.' };
  }
}
