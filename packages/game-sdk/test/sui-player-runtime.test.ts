import { bcs } from '@mysten/sui/bcs';
import { ObjectError, type SuiClientTypes } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { describe, expect, it, vi } from 'vitest';
import {
  PlayerTransactionExecutionError,
  deriveSeasonSeatId,
  readPlayerSeatBundle,
  simulatePlayerTransaction,
  submitAndFinalizePlayerTransaction,
  type InfiniteStellarDeployment,
  type PlayerSuiClient,
} from '../src';

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;
const PACKAGE_ID = id('10');
const MANIFEST_ID = id('11');
const REGISTRY_ID = id('12');
const CONTROLLER = id('13');
const SOUL_ID = id('14');
const SOUL_STATE_ID = id('15');
const PROJECTION_ID = id('16');
const CIVILIZATION_ID = id('17');
const SCORE_CARD_ID = id('18');
const PLANET_ID = id('19');
const SOURCE_PLANET_ID = id('1a');
const VOYAGE_ID = id('1b');
const DIGEST = '11111111111111111111111111111111';

const DEPLOYMENT: InfiniteStellarDeployment = {
  network: 'mainnet',
  packageId: PACKAGE_ID,
  manifestId: MANIFEST_ID,
  enrollmentRegistryId: REGISTRY_ID,
  seatRouting: {
    keyTypeOriginPackageId: PACKAGE_ID,
    keyEncodingVersion: 1,
    league: 1,
  },
  productionSoulAdapterReady: true,
  productionProofVerifierReady: true,
};

const SeasonSeatBcs = bcs.struct('SeasonSeat', {
  id: bcs.Address,
  season_id: bcs.Address,
  league: bcs.u8(),
  controller: bcs.Address,
  soul_id: bcs.Address,
  projection_id: bcs.Address,
  civilization_id: bcs.Address,
  score_card_id: bcs.Address,
});

const CommanderProjectionBcs = bcs.struct('CommanderProjection', {
  id: bcs.Address,
  season_id: bcs.Address,
  seat_id: bcs.Address,
  soulidity_package_id: bcs.Address,
  soul_state_id: bcs.Address,
  soul_id: bcs.Address,
  controller_at_enrollment: bcs.Address,
  ownership_epoch_at_enrollment: bcs.u64(),
  projection_commitment: bcs.vector(bcs.u8()),
});

const CivilizationStateBcs = bcs.struct('CivilizationState', {
  id: bcs.Address,
  season_id: bcs.Address,
  seat_id: bcs.Address,
  status: bcs.u8(),
  controlled_planet_count: bcs.u64(),
  pending_voyage_count: bcs.u64(),
  space_junk: bcs.u64(),
  space_junk_limit: bcs.u64(),
  ships_claimed: bcs.bool(),
  last_reveal_at_seconds: bcs.option(bcs.u64()),
  initial_home_planet_id: bcs.option(bcs.Address),
  home_claim_consumed: bcs.bool(),
  activated_once: bcs.bool(),
});

const ScoreCardBcs = bcs.struct('ScoreCard', {
  id: bcs.Address,
  season_id: bcs.Address,
  seat_id: bcs.Address,
  score: bcs.u64(),
  pending_scored_arrival_count: bcs.u64(),
});

const FoundingPlanetClaimedEventBcs = bcs.struct('FoundingPlanetClaimed', {
  season_id: bcs.Address,
  seat_id: bcs.Address,
  planet_id: bcs.Address,
});

function changedObject(objectId: string): SuiClientTypes.ChangedObject {
  return {
    objectId,
    inputState: 'DoesNotExist',
    inputVersion: null,
    inputDigest: null,
    inputOwner: null,
    outputState: 'ObjectWrite',
    outputVersion: '1',
    outputDigest: DIGEST,
    outputOwner: { $kind: 'Shared', Shared: { initialSharedVersion: '1' } },
    idOperation: 'Created',
  };
}

function effects(changedObjectIds: string[]): SuiClientTypes.TransactionEffects {
  return {
    bcs: null,
    version: 2,
    status: { success: true, error: null },
    gasUsed: {
      computationCost: '10',
      storageCost: '20',
      storageRebate: '5',
      nonRefundableStorageFee: '2',
    },
    transactionDigest: DIGEST,
    gasObject: null,
    eventsDigest: null,
    dependencies: [],
    lamportVersion: '1',
    changedObjects: changedObjectIds.map(changedObject),
    unchangedConsensusObjects: [],
    auxiliaryDataDigest: null,
  };
}

function successfulTransaction(
  changedObjectIds: string[],
  events: SuiClientTypes.Event[] = [],
  finalized = false,
): SuiClientTypes.TransactionResult<{ effects: true; events: true; objectTypes: true }> {
  return {
    $kind: 'Transaction',
    Transaction: {
      digest: DIGEST,
      signatures: [],
      epoch: '1',
      timestampMs: finalized ? 1_900_000_000_000 : null,
      checkpoint: finalized ? '42' : null,
      status: { success: true, error: null },
      balanceChanges: undefined,
      effects: effects(changedObjectIds),
      events,
      objectTypes: Object.fromEntries(changedObjectIds.map((objectId) => [objectId, 'type'])),
      transaction: undefined,
      bcs: undefined,
    },
  };
}

function failedTransaction(message: string): SuiClientTypes.TransactionResult {
  return {
    $kind: 'FailedTransaction',
    FailedTransaction: {
      digest: DIGEST,
      signatures: [],
      epoch: '1',
      timestampMs: null,
      checkpoint: null,
      status: {
        success: false,
        error: { $kind: 'Unknown', Unknown: null, message },
      },
      balanceChanges: undefined,
      effects: undefined,
      events: undefined,
      objectTypes: undefined,
      transaction: undefined,
      bcs: undefined,
    },
  };
}

function sharedObject(
  objectId: string,
  type: string,
  content: Uint8Array,
): SuiClientTypes.Object<{ content: true; previousTransaction: true }> {
  return {
    objectId,
    version: '7',
    digest: DIGEST,
    owner: { $kind: 'Shared', Shared: { initialSharedVersion: '1' } },
    type,
    content: new Uint8Array(content),
    previousTransaction: DIGEST,
    objectBcs: undefined,
    json: undefined,
    display: undefined,
  };
}

function seatObjects(seatId: string) {
  const seat = sharedObject(
    seatId,
    `${PACKAGE_ID}::identity::SeasonSeat`,
    SeasonSeatBcs.serialize({
      id: seatId,
      season_id: MANIFEST_ID,
      league: 1,
      controller: CONTROLLER,
      soul_id: SOUL_ID,
      projection_id: PROJECTION_ID,
      civilization_id: CIVILIZATION_ID,
      score_card_id: SCORE_CARD_ID,
    }).toBytes(),
  );
  const projection = sharedObject(
    PROJECTION_ID,
    `${PACKAGE_ID}::identity::CommanderProjection`,
    CommanderProjectionBcs.serialize({
      id: PROJECTION_ID,
      season_id: MANIFEST_ID,
      seat_id: seatId,
      soulidity_package_id: id('20'),
      soul_state_id: SOUL_STATE_ID,
      soul_id: SOUL_ID,
      controller_at_enrollment: CONTROLLER,
      ownership_epoch_at_enrollment: 3,
      projection_commitment: new Uint8Array(32).fill(9),
    }).toBytes(),
  );
  const civilization = sharedObject(
    CIVILIZATION_ID,
    `${PACKAGE_ID}::identity::CivilizationState`,
    CivilizationStateBcs.serialize({
      id: CIVILIZATION_ID,
      season_id: MANIFEST_ID,
      seat_id: seatId,
      status: 1,
      controlled_planet_count: 2,
      pending_voyage_count: 1,
      space_junk: 7,
      space_junk_limit: 1_000,
      ships_claimed: true,
      last_reveal_at_seconds: 100,
      initial_home_planet_id: PLANET_ID,
      home_claim_consumed: true,
      activated_once: true,
    }).toBytes(),
  );
  const score = sharedObject(
    SCORE_CARD_ID,
    `${PACKAGE_ID}::identity::ScoreCard`,
    ScoreCardBcs.serialize({
      id: SCORE_CARD_ID,
      season_id: MANIFEST_ID,
      seat_id: seatId,
      score: 99,
      pending_scored_arrival_count: 1,
    }).toBytes(),
  );
  return { seat, projection, civilization, score };
}

describe('production Sui player runtime', () => {
  it('derives the deterministic controller Seat using the exact Move key layout', () => {
    expect(deriveSeasonSeatId(DEPLOYMENT, CONTROLLER)).toBe(
      '0x2b27b1050e7c0c166f7955cf44bfe6ca2c6e6d1d1b9ce410c5e47e05ff2e6c84',
    );
  });

  it('distinguishes a genuinely absent derived Seat from RPC and integrity errors', async () => {
    const getObjects = vi.fn().mockResolvedValue({
      objects: [new ObjectError('notExists', 'not found', {
        reason: 'notFound',
        objectId: deriveSeasonSeatId(DEPLOYMENT, CONTROLLER),
      })],
    });
    await expect(readPlayerSeatBundle({ getObjects } as unknown as Pick<PlayerSuiClient, 'getObjects'>, DEPLOYMENT, CONTROLLER))
      .resolves.toEqual({
        status: 'not-enrolled',
        seatId: deriveSeasonSeatId(DEPLOYMENT, CONTROLLER),
      });

    getObjects.mockResolvedValueOnce({ objects: [new Error('RPC unavailable')] });
    await expect(readPlayerSeatBundle({ getObjects } as unknown as Pick<PlayerSuiClient, 'getObjects'>, DEPLOYMENT, CONTROLLER))
      .rejects.toMatchObject({ code: 'READ_MODEL_INVALID', message: 'RPC unavailable' });
  });

  it('loads and cross-checks the full Seat-bound BCS read model', async () => {
    const seatId = deriveSeasonSeatId(DEPLOYMENT, CONTROLLER);
    const objects = seatObjects(seatId);
    const getObjects = vi.fn()
      .mockResolvedValueOnce({ objects: [objects.seat] })
      .mockResolvedValueOnce({ objects: [objects.projection, objects.civilization, objects.score] });

    const snapshot = await readPlayerSeatBundle(
      { getObjects } as unknown as Pick<PlayerSuiClient, 'getObjects'>,
      DEPLOYMENT,
      CONTROLLER,
    );
    expect(snapshot).toMatchObject({
      status: 'enrolled',
      seatId,
      seat: { controller: CONTROLLER, soulId: SOUL_ID },
      projection: { soulStateId: SOUL_STATE_ID, ownershipEpochAtEnrollment: 3n },
      civilization: {
        lifecycle: 'Active',
        controlledPlanetCount: 2n,
        initialHomePlanetId: PLANET_ID,
      },
      scoreCard: { score: 99n },
    });
  });

  it('rejects a Seat child substituted from another Seat', async () => {
    const seatId = deriveSeasonSeatId(DEPLOYMENT, CONTROLLER);
    const objects = seatObjects(seatId);
    const badCivilization = sharedObject(
      CIVILIZATION_ID,
      `${PACKAGE_ID}::identity::CivilizationState`,
      CivilizationStateBcs.serialize({
        id: CIVILIZATION_ID,
        season_id: MANIFEST_ID,
        seat_id: id('ff'),
        status: 1,
        controlled_planet_count: 0,
        pending_voyage_count: 0,
        space_junk: 0,
        space_junk_limit: 1_000,
        ships_claimed: false,
        last_reveal_at_seconds: null,
        initial_home_planet_id: null,
        home_claim_consumed: false,
        activated_once: false,
      }).toBytes(),
    );
    const getObjects = vi.fn()
      .mockResolvedValueOnce({ objects: [objects.seat] })
      .mockResolvedValueOnce({ objects: [objects.projection, badCivilization, objects.score] });

    await expect(readPlayerSeatBundle(
      { getObjects } as unknown as Pick<PlayerSuiClient, 'getObjects'>,
      DEPLOYMENT,
      CONTROLLER,
    )).rejects.toMatchObject({ code: 'READ_MODEL_INVALID' });
  });

  it('treats a resolved failed simulation as failure and preserves the Move abort message', async () => {
    const simulateTransaction = vi.fn().mockResolvedValue({
      ...failedTransaction('MoveAbort EWrongLifecycle'),
      commandResults: [],
      protoJson: undefined,
    });
    await expect(simulatePlayerTransaction(
      { simulateTransaction } as unknown as Pick<PlayerSuiClient, 'simulateTransaction'>,
      new Transaction(),
    )).rejects.toMatchObject({
      code: 'SIMULATION_FAILED',
      message: 'MoveAbort EWrongLifecycle',
    });
  });

  it('simulates, executes, waits for indexed finality, and reconciles the exact claim event', async () => {
    const seatId = deriveSeasonSeatId(DEPLOYMENT, CONTROLLER);
    const event: SuiClientTypes.Event = {
      packageId: PACKAGE_ID,
      module: 'planet',
      sender: CONTROLLER,
      eventType: `${PACKAGE_ID}::planet::FoundingPlanetClaimed`,
      bcs: FoundingPlanetClaimedEventBcs.serialize({
        season_id: MANIFEST_ID,
        seat_id: seatId,
        planet_id: PLANET_ID,
      }).toBytes(),
      json: null,
    };
    const simulationResult = {
      ...successfulTransaction([PLANET_ID]),
      commandResults: [{ returnValues: [], mutatedReferences: [] }],
      protoJson: undefined,
    };
    const finalizedResult = {
      ...successfulTransaction([PLANET_ID], [event], true),
      protoJson: undefined,
    };
    const client = {
      simulateTransaction: vi.fn().mockResolvedValue(simulationResult),
      waitForTransaction: vi.fn().mockResolvedValue(finalizedResult),
    } as unknown as PlayerSuiClient;
    const execute = vi.fn().mockResolvedValue(successfulTransaction([PLANET_ID]));
    const onPhase = vi.fn();

    const result = await submitAndFinalizePlayerTransaction({
      client,
      transaction: new Transaction(),
      execute,
      deployment: DEPLOYMENT,
      expectation: {
        kind: 'claim_home',
        seasonId: MANIFEST_ID,
        seatId,
      },
      onPhase,
    });

    expect(result).toMatchObject({
      digest: DIGEST,
      checkpoint: '42',
      simulation: { commandCount: 1, gas: { netGasMist: 25n } },
      event: { createdObjectId: PLANET_ID, seatId },
    });
    expect(client.waitForTransaction).toHaveBeenCalledWith(expect.objectContaining({
      digest: DIGEST,
      include: { effects: true, events: true, objectTypes: true },
    }));
    expect(onPhase.mock.calls.map(([phase]) => phase)).toEqual([
      'simulating',
      'awaiting-signature',
      'finalizing',
    ]);
  });

  it('does not treat wallet resolution, wrong events, or missing changed objects as success', async () => {
    const seatId = deriveSeasonSeatId(DEPLOYMENT, CONTROLLER);
    const client = {
      simulateTransaction: vi.fn().mockResolvedValue({
        ...successfulTransaction([PLANET_ID]),
        commandResults: [],
        protoJson: undefined,
      }),
      waitForTransaction: vi.fn(),
    } as unknown as PlayerSuiClient;

    await expect(submitAndFinalizePlayerTransaction({
      client,
      transaction: new Transaction(),
      execute: vi.fn().mockResolvedValue(failedTransaction('MoveAbort EProofInvalid')),
      deployment: DEPLOYMENT,
      expectation: { kind: 'claim_home', seasonId: MANIFEST_ID, seatId },
    })).rejects.toMatchObject({ code: 'EXECUTION_FAILED', message: 'MoveAbort EProofInvalid' });

    const mismatchedEvent: SuiClientTypes.Event = {
      packageId: PACKAGE_ID,
      module: 'planet',
      sender: CONTROLLER,
      eventType: `${PACKAGE_ID}::planet::FoundingPlanetClaimed`,
      bcs: FoundingPlanetClaimedEventBcs.serialize({
        season_id: MANIFEST_ID,
        seat_id: id('ff'),
        planet_id: PLANET_ID,
      }).toBytes(),
      json: null,
    };
    client.waitForTransaction = vi.fn().mockResolvedValue({
      ...successfulTransaction([PLANET_ID], [mismatchedEvent], true),
      protoJson: undefined,
    }) as never;
    await expect(submitAndFinalizePlayerTransaction({
      client,
      transaction: new Transaction(),
      execute: vi.fn().mockResolvedValue(successfulTransaction([PLANET_ID])),
      deployment: DEPLOYMENT,
      expectation: { kind: 'claim_home', seasonId: MANIFEST_ID, seatId },
    })).rejects.toBeInstanceOf(PlayerTransactionExecutionError);

    client.waitForTransaction = vi.fn().mockResolvedValue({
      ...successfulTransaction([], [{
        ...mismatchedEvent,
        bcs: FoundingPlanetClaimedEventBcs.serialize({
          season_id: MANIFEST_ID,
          seat_id: seatId,
          planet_id: PLANET_ID,
        }).toBytes(),
      }], true),
      protoJson: undefined,
    }) as never;
    await expect(submitAndFinalizePlayerTransaction({
      client,
      transaction: new Transaction(),
      execute: vi.fn().mockResolvedValue(successfulTransaction([PLANET_ID])),
      deployment: DEPLOYMENT,
      expectation: { kind: 'claim_home', seasonId: MANIFEST_ID, seatId },
    })).rejects.toMatchObject({ code: 'RECONCILIATION_FAILED' });
  });

  it('reconciles a move only when the finalized route matches exactly', async () => {
    const VoyageDispatchedEventBcs = bcs.struct('VoyageDispatched', {
      season_id: bcs.Address,
      voyage_id: bcs.Address,
      player_seat_id: bcs.Address,
      from_planet_id: bcs.Address,
      to_planet_id: bcs.Address,
      arrival_at_seconds: bcs.u64(),
      is_abandon: bcs.bool(),
    });
    const seatId = deriveSeasonSeatId(DEPLOYMENT, CONTROLLER);
    const event: SuiClientTypes.Event = {
      packageId: PACKAGE_ID,
      module: 'voyage',
      sender: CONTROLLER,
      eventType: `${PACKAGE_ID}::voyage::VoyageDispatched`,
      bcs: VoyageDispatchedEventBcs.serialize({
        season_id: MANIFEST_ID,
        voyage_id: VOYAGE_ID,
        player_seat_id: seatId,
        from_planet_id: SOURCE_PLANET_ID,
        to_planet_id: PLANET_ID,
        arrival_at_seconds: 123,
        is_abandon: false,
      }).toBytes(),
      json: null,
    };
    const client = {
      simulateTransaction: vi.fn().mockResolvedValue({
        ...successfulTransaction([VOYAGE_ID]),
        commandResults: [],
        protoJson: undefined,
      }),
      waitForTransaction: vi.fn().mockResolvedValue({
        ...successfulTransaction([VOYAGE_ID], [event], true),
        protoJson: undefined,
      }),
    } as unknown as PlayerSuiClient;

    const result = await submitAndFinalizePlayerTransaction({
      client,
      transaction: new Transaction(),
      execute: vi.fn().mockResolvedValue(successfulTransaction([VOYAGE_ID])),
      deployment: DEPLOYMENT,
      expectation: {
        kind: 'move',
        seasonId: MANIFEST_ID,
        seatId,
        fromPlanetId: SOURCE_PLANET_ID,
        toPlanetId: PLANET_ID,
      },
    });
    expect(result.event).toMatchObject({
      createdObjectId: VOYAGE_ID,
      fromPlanetId: SOURCE_PLANET_ID,
      toPlanetId: PLANET_ID,
      arrivalAtSeconds: 123n,
    });
  });
});
