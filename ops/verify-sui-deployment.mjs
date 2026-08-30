import { readFile } from 'node:fs/promises';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

const recordUrl = new URL('./deployments/sui-testnet-v0.1.0.json', import.meta.url);
const record = JSON.parse(await readFile(recordUrl, 'utf8'));
const canaryUrl = new URL('./seasons/first-light-interface-canary-v0.1.0.json', import.meta.url);
const canary = JSON.parse(await readFile(canaryUrl, 'utf8'));

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function successful(transaction, label) {
  invariant(
    transaction.$kind === 'Transaction' && transaction.Transaction.status.success,
    `${label} transaction is missing or unsuccessful.`,
  );
  return transaction.Transaction;
}

function objectChange(transaction, objectId) {
  return transaction.effects?.changedObjects.find(
    (change) => change.objectId === objectId,
  );
}

async function fetchObject(client, objectId, expectedType, expectedOwner) {
  const response = await client.getObject({
    objectId,
    include: { json: true, previousTransaction: true },
  });
  invariant(response.object?.objectId === objectId, `Object ${objectId} returned the wrong ID.`);
  if (expectedType) {
    invariant(response.object.type === expectedType, `Object ${objectId} has an unexpected type.`);
  }
  if (expectedOwner === 'shared') {
    invariant(response.object.owner.$kind === 'Shared', `Object ${objectId} is not shared.`);
  }
  if (typeof expectedOwner === 'string' && expectedOwner !== 'shared') {
    const owner = response.object.owner;
    invariant(
      owner.$kind === 'AddressOwner' && owner.AddressOwner === expectedOwner,
      `Object ${objectId} is not owned by the recorded address.`,
    );
  }
  return response.object;
}

invariant(record.network === 'testnet', 'The release verifier only permits the pinned testnet record.');
invariant(record.readiness.productionSoulAdapterReady === false, 'Production Soul adapter must remain closed.');
invariant(record.readiness.productionProofVerifierReady === false, 'Production proof verifier must remain closed.');
invariant(record.readiness.rankedEnrollmentEnabled === false, 'Ranked enrollment must remain disabled.');
invariant(record.readiness.homeClaimEnabled === false, 'Home claiming must remain disabled.');

const client = new SuiGraphQLClient({ network: 'testnet', url: record.graphqlUrl });
const { chainIdentifier } = await client.getChainIdentifier();
invariant(chainIdentifier === record.chainIdentifier.base58, 'GraphQL chain identifier does not match the release record.');

const transactionOptions = {
  effects: true,
  events: true,
  objectTypes: true,
};
const [publishTransaction, bootstrapTransaction] = await Promise.all([
  client.getTransaction({ digest: record.package.publishTransaction, include: transactionOptions }),
  client.getTransaction({ digest: record.canary.bootstrapTransaction, include: transactionOptions }),
]);
const publish = successful(publishTransaction, 'Publish');
const bootstrap = successful(bootstrapTransaction, 'Bootstrap');

const published = objectChange(publish, record.package.packageId);
invariant(
  published?.idOperation === 'Created' &&
    published.outputState === 'PackageWrite' &&
    published.outputDigest === record.package.objectDigest,
  'Publish transaction does not create the recorded package and digest.',
);

const packageObject = await client.getObject({
  objectId: record.package.packageId,
  include: { previousTransaction: true },
});
invariant(packageObject.object.owner.$kind === 'Immutable', 'Published package is not immutable.');
invariant(packageObject.object.digest === record.package.objectDigest, 'Published package digest has changed.');
invariant(
  packageObject.object.previousTransaction === record.package.publishTransaction,
  'Published package does not point to the recorded transaction.',
);

const moduleFunctions = {
  bootstrap: 'create_season',
  identity: 'derive_seat_address',
  planet: 'derive_planet_address',
  season: 'open_universe',
  soul_adapter: 'production_adapter_ready',
};
await Promise.all(record.package.modules.map(async (moduleName) => {
  const response = await client.getMoveFunction({
    packageId: record.package.packageId,
    moduleName,
    name: moduleFunctions[moduleName],
  });
  invariant(response.function.moduleName === moduleName, `Published module ${moduleName} is unavailable.`);
}));

const packagePrefix = `${record.package.packageId}::`;
const objects = record.canary.objects;
const expectedObjects = [
  [objects.manifest, `${packagePrefix}season::SeasonManifest`, 'shared'],
  [objects.runtime, `${packagePrefix}season::SeasonRuntime`, 'shared'],
  [objects.enrollmentRegistry, `${packagePrefix}identity::EnrollmentRegistry`, 'shared'],
  [objects.planetRegistry, `${packagePrefix}planet::PlanetRegistry`, 'shared'],
  [objects.seasonAdminCapability, `${packagePrefix}season::SeasonAdminCap`, objects.seasonAdminCapability.owner],
];

const liveObjects = new Map();
for (const [object, expectedType, expectedOwner] of expectedObjects) {
  const created = objectChange(bootstrap, object.objectId);
  invariant(created?.idOperation === 'Created', `Bootstrap transaction did not create ${object.objectId}.`);
  invariant(created.outputDigest === object.objectDigest, `Initial digest mismatch for ${object.objectId}.`);
  liveObjects.set(object.objectId, await fetchObject(client, object.objectId, expectedType, expectedOwner));
}

const upgradeCapability = await fetchObject(
  client,
  record.upgradeCapability.objectId,
  '0x0000000000000000000000000000000000000000000000000000000000000002::package::UpgradeCap',
  record.upgradeCapability.owner,
);
invariant(
  upgradeCapability.json?.package === record.package.packageId,
  'Upgrade capability does not reference the recorded package.',
);

const seasonEvent = bootstrap.events?.find(
  (event) => event.eventType === `${packagePrefix}season::SeasonCreated`,
);
invariant(seasonEvent, 'Bootstrap transaction is missing SeasonCreated.');
invariant(seasonEvent.json.season_id === objects.manifest.objectId, 'SeasonCreated manifest mismatch.');
invariant(seasonEvent.json.runtime_id === objects.runtime.objectId, 'SeasonCreated runtime mismatch.');
invariant(
  seasonEvent.json.enrollment_registry_id === objects.enrollmentRegistry.objectId,
  'SeasonCreated enrollment registry mismatch.',
);
invariant(
  seasonEvent.json.planet_registry_id === objects.planetRegistry.objectId,
  'SeasonCreated planet registry mismatch.',
);

const manifest = liveObjects.get(objects.manifest.objectId).json;
const runtime = liveObjects.get(objects.runtime.objectId).json;
const enrollmentRegistry = liveObjects.get(objects.enrollmentRegistry.objectId).json;
const planetRegistry = liveObjects.get(objects.planetRegistry.objectId).json;
const seasonAdminCapability = liveObjects.get(objects.seasonAdminCapability.objectId).json;
const manifestFields = {
  league: canary.league,
  enrollment_close_at_ms: String(canary.enrollmentCloseAtMs),
  universe_open_at_ms: String(canary.universeOpenAtMs),
  home_claim_open_at_ms: String(canary.homeClaimOpenAtMs),
  home_claim_close_at_ms: String(canary.homeClaimCloseAtMs),
  season_end_at_ms: String(canary.seasonEndAtMs),
  seed_observation_delay_ms: String(canary.seedObservationDelayMs),
  minimum_home_claim_window_ms: String(canary.minimumHomeClaimWindowMs),
  max_home_availability_tick_gap_ms: String(canary.maxHomeAvailabilityTickGapMs),
  max_ranked_seats: String(canary.maxRankedSeats),
};
for (const [field, value] of Object.entries(manifestFields)) {
  invariant(manifest[field] === value, `Manifest field ${field} does not match the canary configuration.`);
}
invariant(manifest.runtime_id === objects.runtime.objectId, 'Manifest runtime binding mismatch.');
invariant(
  manifest.enrollment_registry_id === objects.enrollmentRegistry.objectId,
  'Manifest enrollment registry binding mismatch.',
);
invariant(manifest.planet_registry_id === objects.planetRegistry.objectId, 'Manifest planet registry binding mismatch.');
for (const object of [runtime, enrollmentRegistry, planetRegistry, seasonAdminCapability]) {
  invariant(object.season_id === objects.manifest.objectId, 'Canary object has the wrong season binding.');
}

process.stdout.write(`${JSON.stringify({
  status: 'verified',
  network: record.network,
  release: record.release,
  packageId: record.package.packageId,
  manifestId: objects.manifest.objectId,
  publishTransaction: record.package.publishTransaction,
  bootstrapTransaction: record.canary.bootstrapTransaction,
  sourceCommit: record.source.commit,
}, null, 2)}\n`);
