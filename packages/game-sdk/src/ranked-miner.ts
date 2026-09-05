import { createRulesGeometryCommitment, type RulesGeometryV1 } from '@infinite-stellar/prover';
import type { RankedUniverseProjection } from './ranked-projection';
import {
  ROUND5_BIOMEBASE_KEY, round5MimcSponge, round5Perlin,
  type Round5Coordinates, type Round5WorldLocation,
} from './round5-universe';

/** Public manifest parameters only; safe to send to a local mining Worker. */
export interface RankedMiningGeometry extends RulesGeometryV1 {
  rulesGeometryCommitment: bigint;
}

export function rankedMiningGeometry(projection: RankedUniverseProjection): RankedMiningGeometry {
  if (!projection.runtime.universeOpened) throw new Error('The universe seed is not open yet.');
  if (projection.runtime.cancelled || projection.runtime.settlementStarted) {
    throw new Error('This universe is closed for new exploration.');
  }
  return rankedSeasonGeometry(projection);
}

/** Historical maps remain recoverable after new exploration closes. */
export function rankedSeasonGeometry(projection: RankedUniverseProjection): RankedMiningGeometry {
  const manifest = projection.manifest;
  const geometry: RankedMiningGeometry = {
    worldRadius: manifest.worldRadius,
    planetHashThreshold: manifest.planetHashThreshold,
    locationHashKey: manifest.locationHashKey,
    spaceTypeKey: manifest.spaceTypeKey,
    perlinScale: manifest.perlinScale,
    perlinMirrorX: manifest.perlinMirrorX,
    perlinMirrorY: manifest.perlinMirrorY,
    homePerlinMinInclusive: manifest.homePerlinMin,
    homePerlinMaxExclusive: manifest.homePerlinMax,
    rulesGeometryCommitment: manifest.rulesGeometryCommitment,
  };
  validateGeometry(geometry);
  return geometry;
}

function validateGeometry(geometry: RankedMiningGeometry): void {
  if (typeof geometry.perlinMirrorX !== 'boolean' || typeof geometry.perlinMirrorY !== 'boolean') {
    throw new Error('Season mirror parameters must be booleans.');
  }
  if (createRulesGeometryCommitment(geometry) !== geometry.rulesGeometryCommitment) {
    throw new Error('Mining parameters do not match the onchain Season geometry commitment.');
  }
  if (BigInt(geometry.spaceTypeKey) > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('This Season Perlin key exceeds the exact client range.');
  }
}

/** Snapshot and validate once per batch, not once per coordinate. */
export function createRankedLocationMiner(rawGeometry: RankedMiningGeometry):
  (coordinates: Round5Coordinates) => (Round5WorldLocation & { homeEligible: boolean }) | undefined {
  const geometry = { ...rawGeometry };
  validateGeometry(geometry);
  const radius = BigInt(geometry.worldRadius);
  const threshold = BigInt(geometry.planetHashThreshold);
  const key = BigInt(geometry.locationHashKey);
  const options = {
    key: Number(geometry.spaceTypeKey), scale: Number(geometry.perlinScale),
    mirrorX: geometry.perlinMirrorX, mirrorY: geometry.perlinMirrorY,
  };
  return ({ x, y }) => {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) throw new Error('Mining coordinates must be exact integers.');
    if (BigInt(x) ** 2n + BigInt(y) ** 2n >= radius ** 2n) return undefined;
    const hash = round5MimcSponge([x, y], key);
    if (hash >= threshold) return undefined;
    const perlin = round5Perlin({ x, y }, options);
    return {
      x, y, hash, locationId: hash.toString(16).padStart(64, '0'), perlin,
      biomebase: round5Perlin({ x, y }, { ...options, key: ROUND5_BIOMEBASE_KEY }),
      homeEligible: perlin >= Number(geometry.homePerlinMinInclusive) && perlin < Number(geometry.homePerlinMaxExclusive),
    };
  };
}
