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

export function findDemoHomeCandidate(
  universeSeed: string,
  soulId: string,
  attempt: number,
): HomeCandidate {
  const seed = fnv1a(`${universeSeed}:${soulId}:${attempt}`);
  const x = (seed % 4096) - 2048;
  const y = (Math.floor(seed / 4096) % 4096) - 2048;
  const classes = ['Cinder', 'Pelagic', 'Garden'] as const;
  const planetClass = classes[seed % classes.length] ?? 'Cinder';
  const salt = hex32(`salt:${seed}:${attempt}`);
  const commitment = hex32(`commitment:${x}:${y}:${salt}`);
  return {
    id: hex32(`planet:${commitment}`),
    sectorCode: `IS-${Math.abs(x).toString(36).toUpperCase().padStart(3, '0')}-${Math.abs(y)
      .toString(36)
      .toUpperCase()
      .padStart(3, '0')}`,
    planetClass,
    resonance: 62 + (seed % 35),
    energy: 420 + (seed % 180),
    commitment,
    proofDigest: hex32(`proof:${commitment}`),
    privateMaterial: { x, y, salt },
  };
}

export function demoDigest(action: string, identity: string): string {
  return hex32(`demo-tx:${action}:${identity}`);
}
