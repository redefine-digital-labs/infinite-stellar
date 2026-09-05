import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createStrategyGame, locationInChunks, round5WorldLocation } from '@infinite-stellar/game-sdk';
import { startRound5Miner } from './miner-client';
import type {
  CanonicalSoul,
  PlayerSeatBundle,
  RankedMapView,
  RankedUniverseProjection,
} from '@infinite-stellar/game-sdk';
import { GameShell } from './GameShell';
import { worldToMap } from './map-camera';

vi.mock('./miner-client', () => ({ startRound5Miner: vi.fn() }));

const id = (suffix: string) => `0x${suffix.padStart(64, '0')}`;
const canonicalSoul: CanonicalSoul = {
  soulId: id('11'),
  stateId: id('12'),
  name: 'Lyra Mainnet',
  description: 'Canonical fixture',
  imageUrl: '',
  provenanceKind: 1,
  originRef: null,
  creator: id('13'),
  currentOwner: id('14'),
  currentKioskId: id('15'),
  ownershipEpoch: 7n,
  listed: false,
  stateObjectVersion: '9',
  stateObjectDigest: 'state-digest',
  soulObjectVersion: '4',
  soulObjectDigest: 'soul-digest',
};

describe('Infinite Stellar player shell', () => {
  it('runs the complete local First Light journey', async () => {
    const user = userEvent.setup();
    const worlds = createStrategyGame({ universeSeed: 'test', homeId: 'home', homeName: 'HOME' }).planets
      .map((planet) => round5WorldLocation(planet)!);
    vi.mocked(startRound5Miner).mockImplementation((chunks) => {
      const locations = worlds.filter((planet) => locationInChunks(planet, chunks));
      const total = chunks.reduce((sum, chunk) => sum + chunk.side ** 2, 0);
      return { requestId: 'test-mining', cancel: vi.fn(), result: Promise.resolve({ locations, total, checked: total, found: locations.length,
        elapsedMs: 1 }) };
    });
    render(<GameShell />);

    await user.click(await screen.findByRole('button', { name: /explore local demo/i }));
    expect(screen.getByRole('heading', { name: /who crosses/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /lyra-9/i }));
    await user.click(screen.getByRole('button', { name: /enter universe/i }));
    expect(screen.queryByRole('button', { name: /approve simulated/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /command the/i })).toBeInTheDocument();
    expect(screen.getByText(/df round 5 ruleset/i)).toBeInTheDocument();

    expect(screen.queryAllByRole('button', { name: /neutral, energy/i })).toHaveLength(0);
    expect(screen.getByText('1 discovered')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move explorer' }));
    const point = worldToMap({ x: 269, y: 6442 }, { centerX: 73, centerY: 6421, radius: 253 },
      { width: window.innerWidth, height: window.innerHeight });
    fireEvent.click(screen.getByLabelText(/star map camera/i), {
      clientX: point.x / 100 * window.innerWidth, clientY: point.y / 100 * window.innerHeight,
    });
    const neutral = (await screen.findAllByRole('button', { name: /level 0 regular, neutral/i }, { timeout: 3000 }))[0];
    await user.click(screen.getByRole('button', { name: 'Pause explorer' }));
    expect(neutral).toBeDefined();
    await user.click(neutral!);
    expect(screen.getByRole('button', { name: 'Send (Q)' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /level 0 regular, player/i }));
    await user.click(screen.getByRole('button', { name: '75%' }));
    await user.click(screen.getByRole('button', { name: 'Send (Q)' }));
    await user.click(neutral!);
    await user.click(screen.getByRole('button', { name: 'Voyages' }));
    expect(screen.getByRole('dialog', { name: 'Voyages' })).toHaveTextContent(/energy/i);
    await user.click(screen.getByRole('button', { name: /resolve next arrival/i }));
    expect(screen.getAllByRole('button', { name: /level 0 regular, player/i })).toHaveLength(2);
  });

  it('shows canonical mainnet identity evidence while keeping ranked writes fail-closed', async () => {
    const user = userEvent.setup();
    render(<GameShell
      walletAddress="0xabc"
      network="mainnet"
      rankedGateway={{
        phase: 'loaded',
        controller: '0xabc',
        souls: [],
        discoveryComplete: true,
        scannedSoulEvents: 0,
        blockers: [
          'GAME_DEPLOYMENT_MISSING',
          'SOUL_ADAPTER_CLOSED',
          'PROOF_VERIFIER_CLOSED',
          'RELEASE_EVIDENCE_MISSING',
          'NO_ELIGIBLE_SOUL',
        ],
        writesReady: false,
      }}
    />);
    await user.click(screen.getByRole('button', { name: /check mainnet readiness/i }));
    expect(screen.getByRole('heading', { name: /mainnet season is not open/i })).toBeInTheDocument();
    expect(screen.getByText(/canonical soulidity v1 package and abi pinned/i)).toBeInTheDocument();
    expect(screen.getByText(/mainnet wallet connected/i)).toBeInTheDocument();
    expect(screen.getByText(/0 eligible canonical souls found/i)).toBeInTheDocument();
    expect(screen.getByText(/infinite stellar mainnet package not deployed/i)).toBeInTheDocument();
    expect(screen.getByText(/ranked soul adapter activation pending/i)).toBeInTheDocument();
    expect(screen.getByText(/ceremony, audits, operations, and multisig evidence pending/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/production soul adapter and proof verifier/i);
    expect(screen.getByText(/mainnet target · ranked writes fail-closed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inspect sealed testnet package/i })).toHaveAttribute(
      'href',
      expect.stringContaining('0x1199adc93f61acd99d6d7889c82650b79c90e51ed3816c8c40d0544f9e2c9665'),
    );
  });

  it('labels demo mode and exposes a skip link', async () => {
    const user = userEvent.setup();
    render(<GameShell />);
    expect(screen.getByRole('link', { name: /skip to mission control/i })).toHaveAttribute('href', '#main-content');
    await user.click(await screen.findByRole('button', { name: /explore local demo/i }));
    expect(screen.getByText('LOCAL SIMULATION')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/nothing here is submitted to sui/i);
  });

  it('only exposes ranked enrollment after every release gate is ready', async () => {
    const user = userEvent.setup();
    const enroll = vi.fn();
    const { rerender } = render(<GameShell
      walletAddress={canonicalSoul.currentOwner}
      rankedGateway={{
        phase: 'loaded', controller: canonicalSoul.currentOwner, souls: [canonicalSoul],
        discoveryComplete: true, scannedSoulEvents: 1, blockers: ['GAME_DEPLOYMENT_MISSING'],
        writesReady: false,
      }}
      onEnrollRanked={enroll}
    />);
    await user.click(screen.getByRole('button', { name: /check mainnet readiness/i }));
    expect(screen.queryByRole('button', { name: /enroll this soul/i })).not.toBeInTheDocument();

    rerender(<GameShell
      walletAddress={canonicalSoul.currentOwner}
      rankedGateway={{
        phase: 'loaded', controller: canonicalSoul.currentOwner, souls: [canonicalSoul],
        discoveryComplete: true, scannedSoulEvents: 1, blockers: [], writesReady: true,
      }}
      onEnrollRanked={enroll}
    />);
    await user.click(screen.getByRole('button', { name: /enroll this soul/i }));
    expect(enroll).toHaveBeenCalledWith(canonicalSoul);
  });

  it('keeps the game when returning home or checking mainnet readiness', async () => {
    const user = userEvent.setup();
    render(<GameShell />);
    await user.click(await screen.findByRole('button', { name: /explore local demo/i }));
    expect(screen.getByRole('button', { name: /enter universe/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /lyra-9/i }));
    await user.click(screen.getByRole('button', { name: /enter universe/i }));
    expect(await screen.findByRole('heading', { name: /command the/i })).toBeInTheDocument();
    const homeLabel = screen.getByRole('button', { name: /level 0 regular, player/i }).getAttribute('aria-label');
    await user.click(screen.getByRole('button', { name: /return to infinite stellar home/i }));
    expect(screen.getByRole('button', { name: /continue local game/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /check mainnet readiness/i }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: /continue local game/i }));
    expect(screen.getByRole('heading', { name: /command the/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /level 0 regular, player/i })).toHaveAttribute('aria-label', homeLabel);
    expect(screen.getByText('1 discovered')).toBeInTheDocument();
  });

  it('shows a digest-anchored read-only universe for an existing ranked Seat', async () => {
    const user = userEvent.setup();
    const seat = { status: 'enrolled', seatId: id('31') } as unknown as PlayerSeatBundle;
    const projection = {
      planets: [{}, {}],
      voyages: [{}],
      maxEventCheckpoint: '4242',
      snapshotFingerprint: 'a1'.repeat(32),
    } as unknown as RankedUniverseProjection;
    render(<GameShell
      walletAddress={canonicalSoul.currentOwner}
      rankedGateway={{
        phase: 'loaded', controller: canonicalSoul.currentOwner,
        seat, souls: [], discoveryComplete: true, scannedSoulEvents: 0,
        blockers: ['PROOF_VERIFIER_CLOSED'], writesReady: false,
      }}
      rankedProjection={{ phase: 'loaded', seatId: seat.seatId, projection }}
    />);

    await user.click(screen.getByRole('button', { name: /check mainnet readiness/i }));
    expect(screen.getByText(/2 Planets · 1 active Voyages · checkpoint 4242/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /enroll this soul/i })).not.toBeInTheDocument();
  });

  it('routes an existing Seat into the chain-backed private command map', async () => {
    const user = userEvent.setup();
    const mine = vi.fn();
    const seat = {
      status: 'enrolled',
      seatId: id('31'),
      seat: { soulId: id('32') },
      civilization: { initialHomePlanetId: id('41') },
    } as unknown as PlayerSeatBundle;
    const map = {
      identity: { seatId: seat.seatId },
      worldRadius: 10_000,
      snapshotFingerprint: 'b2'.repeat(32),
      maxEventCheckpoint: null,
      hiddenChainPlanets: 0,
      hiddenVoyages: 0,
      unmaterializedPlanets: 0,
      voyages: [],
      planets: [{
        objectId: id('41'), locationId: '1'.repeat(64), x: 73, y: 6421,
        perlin: 13, biomebase: 14, owner: 'player', materialized: true,
        isHome: true, level: 0, planetType: 'Regular', spaceType: 'Nebula',
        energy: 50_000n, energyCapacity: 100_000n, energyGrowth: 417n,
        range: 99n, speed: 75n, defense: 400n, silver: 0n,
        silverCapacity: 0n, silverGrowth: 0n, spaceJunk: 0n,
        destroyed: false, proofNonce: 1n, artifactIds: [], activeArtifactId: null,
        chain: {},
      }],
    } as unknown as RankedMapView;
    render(<GameShell
      walletAddress={canonicalSoul.currentOwner}
      rankedGateway={{
        phase: 'loaded', controller: canonicalSoul.currentOwner,
        seat, souls: [], discoveryComplete: true, scannedSoulEvents: 0,
        blockers: ['PROOF_VERIFIER_CLOSED'], writesReady: false,
      }}
      rankedMap={{
        phase: 'loaded', seatId: seat.seatId, hasPrivateRecord: true,
        protection: 'indexeddb-aes-gcm', map,
        canMine: true,
      }}
      onMineRankedMap={mine}
    />);

    await user.click(screen.getByRole('button', { name: /check mainnet readiness/i }));
    expect(screen.getByRole('region', { name: /ranked infinite stellar universe/i })).toBeInTheDocument();
    expect(screen.getByText(/chain-authoritative read/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /is-11111, level 0, player, onchain/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /launch fleet/i })).not.toBeInTheDocument();
    expect(screen.getByText(/ranked writes remain sealed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Explore here' }));
    expect(mine).toHaveBeenCalledWith({ x: 73, y: 6421 });
  });
});
