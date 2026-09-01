import { readFile } from 'node:fs/promises';
import { SuiGrpcClient } from '@mysten/sui/grpc';

const configUrl = new URL('../config/soulidity-mainnet-v1.json', import.meta.url);
const config = JSON.parse(await readFile(configUrl, 'utf8'));
const moveManifest = await readFile(new URL('../move/infinite_stellar/Move.toml', import.meta.url), 'utf8');
const moveLock = await readFile(new URL('../move/infinite_stellar/Move.lock', import.meta.url), 'utf8');

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function retryRpc(label, operation, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delayMs = 250 * (2 ** (attempt - 1));
      process.stderr.write(`${label} RPC attempt ${attempt}/${attempts} failed; retrying in ${delayMs}ms.\n`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`${label} RPC verification failed after ${attempts} attempts.`, { cause: lastError });
}

const normalizedIdPattern = /^0x[0-9a-f]{64}$/;
const digestPattern = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const sourceCommitPattern = /^[0-9a-f]{40}$/;
const moveManifestDigestPattern = /^[0-9A-F]{64}$/;

invariant(config.schemaVersion === 1, 'Unsupported Soulidity ABI record schema.');
invariant(config.network === 'mainnet', 'Soulidity ABI verifier only permits mainnet.');
invariant(normalizedIdPattern.test(config.package.callablePackageId), 'Callable package ID is not canonical.');
invariant(normalizedIdPattern.test(config.package.originalPackageId), 'Original package ID is not canonical.');
invariant(digestPattern.test(config.package.callableDigest), 'Callable package digest is malformed.');
invariant(digestPattern.test(config.package.originalDigest), 'Original package digest is malformed.');
invariant(sourceCommitPattern.test(config.source.commit), 'Source commit is malformed.');
invariant(moveManifestDigestPattern.test(config.source.moveManifestDigest), 'Move manifest digest is malformed.');
invariant(
  config.package.soulStateType === `${config.package.originalPackageId}::soul::SoulState`,
  'SoulState type does not use the original package ID.',
);
invariant(moveManifest.includes(`git = "${config.source.repository}.git"`), 'Move manifest uses another Soulidity repository.');
invariant(moveManifest.includes(`subdir = "${config.source.subdirectory}"`), 'Move manifest uses another Soulidity package path.');
invariant(moveManifest.includes(`rev = "${config.source.commit}"`), 'Move manifest uses another Soulidity source commit.');
const mainnetLockBlock = moveLock.split('[pinned.mainnet.soulidity]')[1]?.split('\n\n')[0] ?? '';
invariant(mainnetLockBlock.includes(`rev = "${config.source.commit}"`), 'Mainnet Move lock uses another Soulidity source commit.');
invariant(
  mainnetLockBlock.includes(`manifest_digest = "${config.source.moveManifestDigest}"`),
  'Mainnet Move lock has another Soulidity manifest digest.',
);

const client = new SuiGrpcClient({
  network: 'mainnet',
  baseUrl: config.grpcUrl,
});

const [{ chainIdentifier }, callableResponse, originalResponse] = await Promise.all([
  retryRpc('Chain identifier', () => client.getChainIdentifier()),
  retryRpc('Callable Soulidity package', () => client.getObject({
    objectId: config.package.callablePackageId,
    include: { previousTransaction: true },
  })),
  retryRpc('Original Soulidity package', () => client.getObject({
    objectId: config.package.originalPackageId,
    include: { previousTransaction: true },
  })),
]);

invariant(chainIdentifier === config.chainIdentifier, 'Connected chain is not the pinned Sui mainnet.');

function verifyPackage(object, expectedId, expectedVersion, expectedDigest, expectedTransaction, label) {
  invariant(object?.objectId === expectedId, `${label} returned the wrong object ID.`);
  invariant(object.type === 'package', `${label} is not a Move package.`);
  invariant(object.owner?.$kind === 'Immutable', `${label} is not immutable.`);
  invariant(object.version === expectedVersion, `${label} version changed.`);
  invariant(object.digest === expectedDigest, `${label} digest changed.`);
  invariant(object.previousTransaction === expectedTransaction, `${label} transaction changed.`);
}

verifyPackage(
  callableResponse.object,
  config.package.callablePackageId,
  config.package.callableVersion,
  config.package.callableDigest,
  config.package.callableTransaction,
  'Callable Soulidity package',
);
verifyPackage(
  originalResponse.object,
  config.package.originalPackageId,
  config.package.originalVersion,
  config.package.originalDigest,
  config.package.originalTransaction,
  'Original Soulidity package',
);

const objectIdType = '0x0000000000000000000000000000000000000000000000000000000000000002::object::ID';
const expectedFunctions = {
  protocol_version: { parameters: [], returns: [{ reference: null, kind: 'u64' }] },
  state_version: { parameters: [{ reference: 'immutable', kind: config.package.soulStateType }], returns: [{ reference: null, kind: 'u64' }] },
  state_id: { parameters: [{ reference: 'immutable', kind: config.package.soulStateType }], returns: [{ reference: null, kind: objectIdType }] },
  soul_id: { parameters: [{ reference: 'immutable', kind: config.package.soulStateType }], returns: [{ reference: null, kind: objectIdType }] },
  current_owner: { parameters: [{ reference: 'immutable', kind: config.package.soulStateType }], returns: [{ reference: null, kind: 'address' }] },
  ownership_epoch: { parameters: [{ reference: 'immutable', kind: config.package.soulStateType }], returns: [{ reference: null, kind: 'u64' }] },
  is_listed: { parameters: [{ reference: 'immutable', kind: config.package.soulStateType }], returns: [{ reference: null, kind: 'bool' }] },
};

function signatureKind(signature) {
  if (signature.body?.$kind === 'datatype') return signature.body.datatype.typeName;
  return signature.body?.$kind;
}

function verifySignatures(actual, expected, label) {
  invariant(actual.length === expected.length, `${label} arity changed.`);
  actual.forEach((signature, index) => {
    invariant(signature.reference === expected[index].reference, `${label}[${index}] reference changed.`);
    invariant(signatureKind(signature) === expected[index].kind, `${label}[${index}] type changed.`);
  });
}

await Promise.all(Object.entries(expectedFunctions).map(async ([name, expected]) => {
  const response = await retryRpc(`Soulidity function ${name}`, () => client.getMoveFunction({
    packageId: config.package.callablePackageId,
    moduleName: config.interface.module,
    name,
  }));
  const fn = response.function;
  invariant(fn?.packageId === config.package.callablePackageId, `${name} resolved from the wrong package.`);
  invariant(fn.moduleName === config.interface.module && fn.name === name, `${name} resolved incorrectly.`);
  invariant(fn.visibility === 'public' && fn.isEntry === false, `${name} visibility changed.`);
  invariant(fn.typeParameters.length === 0, `${name} acquired type parameters.`);
  verifySignatures(fn.parameters, expected.parameters, `${name} parameter`);
  verifySignatures(fn.returns, expected.returns, `${name} return`);
}));

process.stdout.write(`${JSON.stringify({
  status: 'verified',
  network: config.network,
  chainIdentifier,
  sourceCommit: config.source.commit,
  callablePackageId: config.package.callablePackageId,
  originalPackageId: config.package.originalPackageId,
  soulStateType: config.package.soulStateType,
  protocolVersion: config.interface.protocolVersion,
}, null, 2)}\n`);
