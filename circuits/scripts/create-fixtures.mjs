import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { round5WorldLocation } from '../../packages/game-sdk/src/round5-universe.ts';
import {
  createProofIntentCommitment,
  ROUND5_RULES_GEOMETRY_COMMITMENT,
  splitSuiIdentifier,
} from '../../packages/prover/src/proof-intent.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const fixtureDir = resolve(root, 'circuits/fixtures');
const network = 'sui:mainnet';
const league = 1;
const seasonId = '0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000';
const seatId = '0x22223333444455556666777788889999aaaabbbbccccddddeeeeffff00001111';
const sender = '0xa11ce';
const deadlineMs = 1_800_000_000_000n;

const stringify = (value) => JSON.stringify(
  value,
  (_, item) => typeof item === 'bigint' ? item.toString() : item,
  2,
) + '\n';

const coordinateWitness = (prefix, { x, y }) => ({
  [`${prefix}x_magnitude`]: Math.abs(x).toString(),
  [`${prefix}x_sign`]: x < 0 ? '1' : '0',
  [`${prefix}y_magnitude`]: Math.abs(y).toString(),
  [`${prefix}y_sign`]: y < 0 ? '1' : '0',
});

function contextWitness() {
  const [seasonLow, seasonHigh] = splitSuiIdentifier(seasonId, 'seasonId');
  const [seatLow, seatHigh] = splitSuiIdentifier(seatId, 'seatId');
  const [senderLow, senderHigh] = splitSuiIdentifier(sender, 'sender');
  return {
    league: league.toString(),
    season_id_low_128: seasonLow.toString(),
    season_id_high_128: seasonHigh.toString(),
    seat_id_low_128: seatLow.toString(),
    seat_id_high_128: seatHigh.toString(),
    sender_low_128: senderLow.toString(),
    sender_high_128: senderHigh.toString(),
  };
}

function publicWitness(commitment) {
  const [source, destination, action, rules] = commitment.publicSignals;
  return {
    source_location_hash: source.toString(),
    destination_location_hash: destination.toString(),
    action_commitment: action.toString(),
    rules_geometry_commitment: rules.toString(),
  };
}

const homeCoordinates = { x: 73, y: 6421 };
const destinationCoordinates = { x: 269, y: 6442 };
const home = round5WorldLocation(homeCoordinates);
const destination = round5WorldLocation(destinationCoordinates);
if (!home || !destination || home.perlin !== 13) {
  throw new Error('Pinned Round-5 fixture coordinates no longer satisfy the expected universe relation.');
}

const claimCommitment = createProofIntentCommitment({
  network,
  league,
  actionKind: 'claim_home',
  seasonId,
  seatId,
  sender,
  sourceLocationHash: 0n,
  destinationLocationHash: home.hash,
  amount: 0n,
  sourcePlanetNonce: 0n,
  deadlineMs,
  rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT,
});

const maxDistance = 198n;
const moveCommitment = createProofIntentCommitment({
  network,
  league,
  actionKind: 'move',
  seasonId,
  seatId,
  sender,
  sourceLocationHash: home.hash,
  destinationLocationHash: destination.hash,
  amount: maxDistance,
  sourcePlanetNonce: 7n,
  deadlineMs,
  rulesGeometryCommitment: ROUND5_RULES_GEOMETRY_COMMITMENT,
});

const claimFixture = {
  ...publicWitness(claimCommitment),
  network_field: claimCommitment.networkField.toString(),
  ...contextWitness(),
  deadline_ms: deadlineMs.toString(),
  ...coordinateWitness('', homeCoordinates),
};

const moveFixture = {
  ...publicWitness(moveCommitment),
  network_field: moveCommitment.networkField.toString(),
  ...contextWitness(),
  max_distance: maxDistance.toString(),
  source_planet_nonce: '7',
  deadline_ms: deadlineMs.toString(),
  ...coordinateWitness('source_', homeCoordinates),
  ...coordinateWitness('destination_', destinationCoordinates),
};

await mkdir(fixtureDir, { recursive: true });
await Promise.all([
  writeFile(resolve(fixtureDir, 'claim_home_v1.input.json'), stringify(claimFixture)),
  writeFile(resolve(fixtureDir, 'move_v1.input.json'), stringify(moveFixture)),
  writeFile(resolve(fixtureDir, 'expected-public-signals.json'), stringify({
    order: [
      'source_location_hash',
      'destination_location_hash',
      'action_commitment',
      'rules_geometry_commitment',
    ],
    claim_home_v1: claimCommitment.publicSignals,
    move_v1: moveCommitment.publicSignals,
  })),
]);

console.log('Generated deterministic development circuit fixtures.');
