import { proofNetworkField, ROUND5_PLANET_HASH_THRESHOLD, ROUND5_RULES_GEOMETRY_COMMITMENT } from '@infinite-stellar/prover';
import {
  deriveRankedPlanetObjectId, deriveSeasonSeatId, round5WorldLocation,
  type CircuitConfigPin, type InfiniteStellarDeployment, type PlanetProjection,
  type RankedActionContext, type RankedPrivateMapRecord,
} from '../src';

const id = (byte: string) => `0x${byte.repeat(32)}`;
const version = (objectId: string) => ({ objectId, version: '1', digest: 'test-digest', previousTransaction: null });
const config = (name: string, byte: string): CircuitConfigPin => ({
  objectId: id(byte), circuitId: `round5-${name}`, circuitVersion: 1,
  artifactManifestSha256: byte.repeat(32), configDigest: 'cd'.repeat(32), verifyingKeyDigest: 'ef'.repeat(32),
});

/** Synthetic deployment pins for unit tests only; never release evidence. */
export function rankedActionFixture(mode: 'home' | 'move' | 'move_new' = 'home'): RankedActionContext {
  const deployment: InfiniteStellarDeployment = {
    network: 'mainnet', packageId: id('10'), manifestId: id('11'), runtimeId: id('12'),
    enrollmentRegistryId: id('13'), planetRegistryId: id('14'), randomObjectId: id('08'), clockObjectId: id('06'),
    soulidityCallablePackageId: id('60'), soulidityOriginalPackageId: id('a4'),
    claimHomeCircuitConfig: config('claim-home', '31'), moveCircuitConfig: config('move', '32'),
    moveNewCircuitConfig: config('move-new', '33'),
    proofIntent: { network: 'sui:mainnet', rulesetId: 'dark-forest-v06-round5', league: 1,
      rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT.toString() },
    seatRouting: { keyTypeOriginPackageId: id('10'), keyEncodingVersion: 1, league: 1 },
    productionReleaseEvidence: { schemaVersion: 1, ceremonyTranscriptSha256: 'a1'.repeat(32),
      circuitAuditSha256: 'a2'.repeat(32), moveAuditSha256: 'a3'.repeat(32), clientAuditSha256: 'a4'.repeat(32),
      operationsApprovalSha256: 'a5'.repeat(32), multisigPolicySha256: 'a6'.repeat(32) },
    productionSoulAdapterReady: true, productionProofVerifierReady: true,
  };
  const seatId = deriveSeasonSeatId(deployment, id('aa'));
  const locations = [{ x: 73, y: 6421 }, { x: 269, y: 6442 }].map((coordinates) => {
    const location = round5WorldLocation(coordinates)!;
    return { x: location.x, y: location.y, locationId: location.locationId, perlin: location.perlin,
      biomebase: location.biomebase, discoveredAtMs: 1 };
  });
  const record: RankedPrivateMapRecord = {
    schemaVersion: 1, network: 'mainnet', chainIdentifier: 'test-chain-identifier-'.repeat(3),
    packageId: id('10'), typeOriginPackageId: id('10'), seasonId: id('11'), planetRegistryId: id('14'),
    seatId, controllerAddress: id('aa'), locations, updatedAtMs: 1,
  };
  const planetIds = locations.map((location) => deriveRankedPlanetObjectId(record, location.locationId));
  const planet = (index: number): PlanetProjection => ({
    ...version(planetIds[index]!), seasonId: id('11'), ownerSeatId: index === 0 ? seatId : id('bb'),
    locationHash: BigInt(`0x${locations[index]!.locationId}`),
    locationCommitment: Uint8Array.from(Buffer.from(locations[index]!.locationId, 'hex')),
    publicInputDigest: new Uint8Array(32), proofNonce: 7n, isFoundingPlanet: index === 0,
    rulesetVersion: 1n, level: 0, planetType: 0, spaceType: 0,
    energy: 50_000n, energyCapacity: 100_000n, energyGrowth: 417n, range: 99n, speed: 75n, defense: 400n,
    silver: 0n, silverCapacity: 0n, silverGrowth: 0n, spaceJunk: 0n, defaultEnergy: 50_000n,
    defaultSpaceJunk: 0n, lastUpdatedAtSeconds: 1n, destroyed: false, pausers: 0n,
    upgrades: { defense: 0, range: 0, speed: 0 }, pendingVoyages: [], artifactIds: [], activeArtifactId: null,
    prospectedCheckpoint: null, artifactFound: false, invaderSeatId: null, invadeStartCheckpoint: 0n,
    capturerSeatId: null, revealedX: null, revealedY: null, revealerSeatId: null,
  });
  const binding = (pin: CircuitConfigPin) => ({ configId: pin.objectId, configDigest: pin.configDigest,
    verifyingKeyDigest: pin.verifyingKeyDigest });
  return {
    deployment, record, nowMs: 10_000n, deadlineMs: 20_000n,
    seat: {
      status: 'enrolled', seatId,
      seat: { ...version(seatId), seasonId: id('11'), league: 1, controller: id('aa'), soulId: id('20'),
        projectionId: id('21'), civilizationId: id('22'), scoreCardId: id('23') },
      projection: { ...version(id('21')), soulidityPackageId: id('a4'), soulStateId: id('24'), soulId: id('20'),
        controllerAtEnrollment: id('aa'), ownershipEpochAtEnrollment: 1n, projectionCommitment: new Uint8Array(32) },
      civilization: { ...version(id('22')), lifecycle: mode === 'home' ? 'AwaitingHome' : 'Active',
        controlledPlanetCount: mode === 'home' ? 0n : 1n, pendingVoyageCount: 0n, spaceJunk: 0n,
        spaceJunkLimit: 1_000n, shipsClaimed: false, lastRevealAtSeconds: null,
        initialHomePlanetId: mode === 'home' ? null : planetIds[0]!,
        homeClaimConsumed: mode !== 'home', activatedOnce: mode !== 'home' },
      scoreCard: { ...version(id('23')), score: 0n, pendingScoredArrivalCount: 0n },
    },
    projection: {
      manifest: { ...version(id('11')), versionNumber: 1n, league: 1, enrollmentCloseAtMs: 1n,
        universeOpenAtMs: 2n, homeClaimOpenAtMs: 3n, homeClaimCloseAtMs: 100_000n, seasonEndAtMs: 1_000_000n,
        seedObservationDelayMs: 1n, minimumHomeClaimWindowMs: 1n, maxHomeAvailabilityTickGapMs: 1n,
        maxRankedSeats: 100n, worldRadius: 12_000n, planetHashThreshold: ROUND5_PLANET_HASH_THRESHOLD,
        locationHashKey: 115n, spaceTypeKey: 116n, perlinScale: 16_384n, perlinMirrorX: false, perlinMirrorY: false,
        homePerlinMin: 13, homePerlinMax: 14, rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT,
        proofNetworkField: proofNetworkField('sui:mainnet'), claimHomeCircuit: binding(deployment.claimHomeCircuitConfig!),
        moveCircuit: binding(deployment.moveCircuitConfig!), moveNewCircuit: binding(deployment.moveNewCircuitConfig!),
        enrollmentRegistryId: id('13'), runtimeId: id('12'), planetRegistryId: id('14') },
      runtime: { ...version(id('12')), seasonId: id('11'), universeOpened: true, universeOpenedAtMs: 2n,
        universeSeed: new Uint8Array(32), homeClaimNotBeforeAtMs: 3n, paused: false,
        homeAvailabilityLastTickAtMs: 3n, accumulatedHomeClaimableMs: 1n, homeWindowResolution: 'Pending',
        cancelled: false, settlementStarted: false },
      planets: mode === 'home' ? [] : mode === 'move' ? [planet(0), planet(1)] : [planet(0)], voyages: [],
      maxEventCheckpoint: '77', scannedEvents: 0, snapshotFingerprint: '1'.repeat(64),
      coverage: 'known-private-locations', requestedPlanetIds: planetIds,
      missingPlanetIds: mode === 'home' ? planetIds : mode === 'move' ? [] : [planetIds[1]!],
    },
  };
}
