import { bcs } from '@mysten/sui/bcs';
import type { SuiClientTypes } from '@mysten/sui/client';
import { describe, expect, it, vi } from 'vitest';
import { prepareRankedAction, readRankedActionContext, readSuiActionClock, SUI_ACTION_CLOCK_ID,
  type RankedActionReaderDependencies, type RankedActionRequest, type RankedActionReadClient } from '../src';
import { rankedActionFixture } from './ranked-action-fixtures';

const ClockBcs = bcs.struct('Clock', { id: bcs.Address, timestamp_ms: bcs.u64() });
function clockObject(): SuiClientTypes.Object<{ content: true }> {
  return { objectId: SUI_ACTION_CLOCK_ID, version: '20', digest: 'clock-digest', type: '0x2::clock::Clock',
    owner: { $kind: 'Shared', Shared: { initialSharedVersion: '1' } },
    content: ClockBcs.serialize({ id: SUI_ACTION_CLOCK_ID, timestamp_ms: '10000' }).toBytes(),
    previousTransaction: undefined, objectBcs: undefined, json: undefined, display: undefined };
}

describe('canonical Sui action Clock', () => {
  it('reads exact shared Clock BCS instead of local time or JSON', async () => {
    const getObjects = vi.fn().mockResolvedValue({ objects: [clockObject()] });
    expect(await readSuiActionClock({ getObjects })).toBe(10_000n);
    expect(getObjects).toHaveBeenCalledWith({ objectIds: [SUI_ACTION_CLOCK_ID], include: { content: true } });
  });
  it.each(['type', 'owner', 'object-id', 'bcs-id', 'trailing-bytes', 'missing'] as const)('rejects %s', async (change) => {
    const object = clockObject();
    if (change === 'type') object.type = '0x2::clock::FakeClock';
    if (change === 'owner') object.owner = { $kind: 'Immutable', Immutable: true };
    if (change === 'object-id') object.objectId = `0x${'1'.repeat(64)}`;
    if (change === 'bcs-id') object.content = ClockBcs.serialize({ id: `0x${'1'.repeat(64)}`, timestamp_ms: '10000' }).toBytes();
    if (change === 'trailing-bytes') object.content = new Uint8Array(41);
    await expect(readSuiActionClock({ getObjects: vi.fn().mockResolvedValue({ objects: change === 'missing' ? [] : [object] }) }))
      .rejects.toThrow();
  });
});

describe('fresh selected-Planet action context', () => {
  function setup(mode: 'home' | 'move' | 'move_new' = 'move_new') {
    const fixture = rankedActionFixture(mode);
    const request: RankedActionRequest = mode === 'home'
      ? { kind: 'claim_home', destinationLocationId: fixture.record.locations[0]!.locationId }
      : { kind: 'move', sourceLocationId: fixture.record.locations[0]!.locationId,
        destinationLocationId: fixture.record.locations[1]!.locationId, sentEnergy: 25_000n, sentSilver: 0n };
    const client: RankedActionReadClient = {
      getChainIdentifier: vi.fn().mockResolvedValue({ chainIdentifier: fixture.record.chainIdentifier }),
      getObjects: vi.fn().mockResolvedValue({ objects: [clockObject()] }),
    };
    const dependencies: RankedActionReaderDependencies = {
      readSeat: vi.fn(async () => structuredClone(fixture.seat)),
      readProjection: vi.fn(async () => structuredClone(fixture.projection)), readClock: readSuiActionClock,
    };
    return { fixture, request, client, dependencies };
  }
  it.each(['home', 'move', 'move_new'] as const)('reads %s exact IDs, brackets Seat state, and prepares a valid witness', async (mode) => {
    const { fixture, request, client, dependencies } = setup(mode);
    const context = await readRankedActionContext(client, fixture.deployment, fixture.record, request, {}, dependencies);
    expect(context.nowMs).toBe(10_000n);
    expect(context.deadlineMs).toBe(mode === 'home' ? 99_999n : 130_000n);
    expect(context.record.locations).toHaveLength(mode === 'home' ? 1 : 2);
    expect(dependencies.readSeat).toHaveBeenCalledTimes(2);
    expect(vi.mocked(dependencies.readProjection).mock.calls[0]![2]).toHaveLength(mode === 'home' ? 1 : 2);
    expect(prepareRankedAction(context, request).transaction.kind).toBe(mode === 'home' ? 'claim_home' : mode);
    expect(JSON.stringify(vi.mocked(client.getObjects).mock.calls)).not.toMatch(/x_magnitude|biomebase|privateWitness/);
    expect(client.getChainIdentifier).toHaveBeenCalledOnce();
  });
  it('does not refresh a caller-pinned proof deadline', async () => {
    const { fixture, request, client, dependencies } = setup();
    const result = await readRankedActionContext(client, fixture.deployment, fixture.record, request,
      { deadlineMs: 11_000n }, dependencies);
    expect(result.deadlineMs).toBe(11_000n);
    await expect(readRankedActionContext(client, fixture.deployment, fixture.record, request,
      { deadlineMs: 10_000n }, dependencies)).rejects.toThrow(/deadline/);
  });
  it('rejects the wrong RPC chain before reading Seat or coordinates', async () => {
    const { fixture, request, client, dependencies } = setup();
    vi.mocked(client.getChainIdentifier).mockResolvedValue({ chainIdentifier: 'wrong-chain' });
    await expect(readRankedActionContext(client, fixture.deployment, fixture.record, request, {}, dependencies)).rejects.toThrow(/another chain/);
    expect(dependencies.readSeat).not.toHaveBeenCalled();
  });
  it('rejects a Seat mutation spanning the selected-Planet read', async () => {
    const { fixture, request, client, dependencies } = setup();
    vi.mocked(dependencies.readSeat).mockResolvedValueOnce(structuredClone(fixture.seat));
    fixture.seat.civilization.version = '2';
    await expect(readRankedActionContext(client, fixture.deployment, fixture.record, request, {}, dependencies)).rejects.toThrow(/Seat changed/);
  });
  it.each(['gates', 'clock', 'controller', 'missing-coordinate'] as const)('rejects %s before RPC', async (change) => {
    const { fixture, request, client, dependencies } = setup();
    if (change === 'gates') fixture.deployment.productionProofVerifierReady = false;
    if (change === 'clock') fixture.deployment.clockObjectId = `0x${'6'.repeat(64)}`;
    if (change === 'controller') fixture.record.controllerAddress = `0x${'b'.repeat(64)}`;
    if (change === 'missing-coordinate') fixture.record.locations.pop();
    await expect(readRankedActionContext(client, fixture.deployment, fixture.record, request, {}, dependencies)).rejects.toThrow();
    expect(client.getChainIdentifier).not.toHaveBeenCalled();
  });
  it('rejects cancellation after the chain identity read', async () => {
    const { fixture, request, client, dependencies } = setup();
    const abort = new AbortController();
    vi.mocked(client.getChainIdentifier).mockImplementation(async () => { abort.abort(); return { chainIdentifier: fixture.record.chainIdentifier }; });
    await expect(readRankedActionContext(client, fixture.deployment, fixture.record, request, { signal: abort.signal }, dependencies))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(dependencies.readSeat).not.toHaveBeenCalled();
  });
  it('rejects cancellation during the final Clock observation', async () => {
    const { fixture, request, client, dependencies } = setup();
    const abort = new AbortController();
    dependencies.readClock = async () => { abort.abort(); return 10_000n; };
    await expect(readRankedActionContext(client, fixture.deployment, fixture.record, request,
      { signal: abort.signal }, dependencies)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
