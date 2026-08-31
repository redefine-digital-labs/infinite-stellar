import type { StrategyGame } from './strategy';

export type JourneyMode = 'demo' | 'onchain';

export type JourneyStage =
  | 'welcome'
  | 'soul-selection'
  | 'enrolling'
  | 'sealed-lobby'
  | 'searching'
  | 'claim-ready'
  | 'claiming'
  | 'active'
  | 'unavailable'
  | 'error';

export type TransactionStatus =
  | 'idle'
  | 'awaiting-signature'
  | 'submitted'
  | 'finalizing'
  | 'finalized'
  | 'failed';

export interface SoulCandidate {
  id: string;
  stateId: string;
  name: string;
  epithet: string;
  signal: string;
  visualClass: 'ember' | 'tide' | 'verdant';
  owner: string;
  ownershipEpoch: number;
  listed: boolean;
  source: 'demo' | 'soulidity';
}

export interface SeatSnapshot {
  id: string;
  controller: string;
  soulId: string;
  soulName: string;
  ownershipEpochAtEnrollment: number;
  status: 'AwaitingHome' | 'Active';
  createdAt: string;
  foundingPlanetId?: string;
}

export interface RuntimeSnapshot {
  universe: 'sealed' | 'open' | 'cancelled';
  seasonLabel: string;
  universeSeed?: string;
  homeClaimNotBeforeAt?: string;
  homeClaimCloseAt: string;
}

export interface PrivateHomeMaterial {
  x: number;
  y: number;
  salt: string;
}

export interface HomeCandidate {
  id: string;
  sectorCode: string;
  planetClass: 'Cinder' | 'Pelagic' | 'Garden';
  resonance: number;
  energy: number;
  commitment: string;
  proofDigest: string;
  privateMaterial: PrivateHomeMaterial;
}

export interface JourneyTransaction {
  action: 'enroll' | 'open-universe' | 'claim-home' | null;
  status: TransactionStatus;
  digest?: string;
  error?: string;
}

export interface SearchSnapshot {
  attempt: number;
  progress: number;
  candidate?: HomeCandidate;
}

export interface PlayerSession {
  schemaVersion: 1;
  mode: JourneyMode;
  stage: JourneyStage;
  controllerAddress?: string;
  souls: SoulCandidate[];
  selectedSoulId?: string;
  seat?: SeatSnapshot;
  runtime: RuntimeSnapshot;
  search: SearchSnapshot;
  transaction: JourneyTransaction;
  lastStableStage: JourneyStage;
  notice?: string;
  strategy?: StrategyGame;
}

export interface PlayerRouteInput {
  existingSeat?: SeatSnapshot;
  eligibleSouls: SoulCandidate[];
  productionAdapterReady: boolean;
}

export type PlayerRoute =
  | 'resume-seat'
  | 'select-soul'
  | 'integration-unavailable'
  | 'no-eligible-soul';
