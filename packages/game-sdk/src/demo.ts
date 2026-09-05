import { isRound5HomeLocation } from './home-search';
import type { MinedRound5Location } from './miner';
import type {
  HomeCandidate,
  PlayerSession,
  SeatSnapshot,
  SoulCandidate,
} from './types';

export const DEMO_CONTROLLER =
  '0xd3e0000000000000000000000000000000000000000000000000000000000001';

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hex32(input: string): string {
  const chunks = Array.from({ length: 8 }, (_, index) =>
    fnv1a(`${input}:${index}`).toString(16).padStart(8, '0'),
  );
  return `0x${chunks.join('')}`;
}

export function createDemoSouls(owner = DEMO_CONTROLLER): SoulCandidate[] {
  return [
    {
      id: hex32('soul:lyra'),
      stateId: hex32('state:lyra'),
      name: 'Lyra-9',
      epithet: 'Keeper of the Quiet Signal',
      signal: 'Patient · Cartographic · Unbroken',
      visualClass: 'tide',
      owner,
      ownershipEpoch: 3,
      listed: false,
      source: 'demo',
    },
    {
      id: hex32('soul:cael'),
      stateId: hex32('state:cael'),
      name: 'Cael Vector',
      epithet: 'A Memory With Forward Motion',
      signal: 'Resolute · Analytical · Luminous',
      visualClass: 'ember',
      owner,
      ownershipEpoch: 1,
      listed: false,
      source: 'demo',
    },
    {
      id: hex32('soul:morrow'),
      stateId: hex32('state:morrow'),
      name: 'Morrow Fern',
      epithet: 'The Green Between Stars',
      signal: 'Adaptive · Social · Restorative',
      visualClass: 'verdant',
      owner,
      ownershipEpoch: 8,
      listed: false,
      source: 'demo',
    },
  ];
}

export function createInitialSession(mode: 'demo' | 'onchain' = 'demo'): PlayerSession {
  return {
    schemaVersion: 1,
    mode,
    stage: 'welcome',
    souls: [],
    runtime: {
      universe: 'sealed',
      seasonLabel: 'First Light · Simulation 01',
      homeClaimCloseAt: 'T+18:00',
    },
    search: {
      attempt: 0,
      progress: 0,
    },
    transaction: {
      action: null,
      status: 'idle',
    },
    lastStableStage: 'welcome',
  };
}

export function createDemoSeat(
  controller: string,
  soul: SoulCandidate,
  now = new Date(0),
): SeatSnapshot {
  return {
    id: hex32(`seat:${controller}:${soul.id}`),
    controller,
    soulId: soul.id,
    soulName: soul.name,
    ownershipEpochAtEnrollment: soul.ownershipEpoch,
    status: 'AwaitingHome',
    createdAt: now.toISOString(),
  };
}

/** Verified local geometry, not a submitted claim or a SNARK proof. */
export function createLocalHomeCandidate(location: MinedRound5Location): HomeCandidate {
  if (!isRound5HomeLocation(location)) throw new Error('The mined location is not an eligible Round-5 home.');
  return {
    id: location.locationId,
    sectorCode: `IS-${location.locationId.slice(-5).toUpperCase()}`,
    planetClass: location.biomebase < 14 ? 'Cinder' : location.biomebase < 17 ? 'Pelagic' : 'Garden',
    energy: 50_000,
    commitment: `0x${location.locationId}`,
    privateMaterial: { x: location.x, y: location.y },
    location: { x: location.x, y: location.y, locationId: location.locationId,
      perlin: location.perlin, biomebase: location.biomebase },
  };
}

export function demoDigest(action: string, identity: string): string {
  return hex32(`demo-tx:${action}:${identity}`);
}
