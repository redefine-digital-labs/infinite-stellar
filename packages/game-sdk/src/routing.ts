import type { PlayerRoute, PlayerRouteInput } from './types';

/** Exact ceil(sqrt(dx² + dy²)) for proof bounds; floating rounding may understate long routes. */
export function routeDistanceBound(from: { x: number; y: number }, to: { x: number; y: number }): bigint {
  if (![from.x, from.y, to.x, to.y].every(Number.isSafeInteger)) throw new Error('Route coordinates must be safe integers.');
  const dx = BigInt(to.x) - BigInt(from.x);
  const dy = BigInt(to.y) - BigInt(from.y);
  const squared = dx * dx + dy * dy;
  if (squared === 0n) return 0n;
  let root = 1n << BigInt(Math.ceil(squared.toString(2).length / 2));
  let next = (root + squared / root) / 2n;
  while (next < root) { root = next; next = (root + squared / root) / 2n; }
  return root * root === squared ? root : root + 1n;
}

export function resolvePlayerRoute(input: PlayerRouteInput): PlayerRoute {
  if (input.existingSeat) return 'resume-seat';
  if (!input.productionAdapterReady) return 'integration-unavailable';
  if (input.eligibleSouls.length === 0) return 'no-eligible-soul';
  return 'select-soul';
}
