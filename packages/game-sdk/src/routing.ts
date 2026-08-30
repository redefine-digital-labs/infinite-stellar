import type { PlayerRoute, PlayerRouteInput } from './types';

export function resolvePlayerRoute(input: PlayerRouteInput): PlayerRoute {
  if (input.existingSeat) return 'resume-seat';
  if (!input.productionAdapterReady) return 'integration-unavailable';
  if (input.eligibleSouls.length === 0) return 'no-eligible-soul';
  return 'select-soul';
}
