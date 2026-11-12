import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const room = vi.hoisted(() => ({ ledger: undefined as object | undefined, real: null as object | null }));

vi.mock('../raidRoom/friendRoom', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  friendRoom: () =>
    room.real ?? {
      room: { code: 'BCDF', mapId: 'floodplain-relay', me: 'me' },
      loot: room.ledger,
    },
}));

import { FriendRoom } from '../raidRoom/friendRoom';
import type { HarbourWire } from '../harbour/harbourLink';
import type { RaidPlace } from '../raidRoom/raidProtocol';
import { roomLootKey } from '../raidRoom/roomLoot';
import type { LootClaim, RaidRoomService } from '../raidRoom/roomService';
import { LootLedger } from '../raidRoom/roomLoot';
import { getWorldMap } from '../worldMap';
import type { WorldLoot } from '../world/loot';
import { WorldScene } from './WorldScene';

const PIECE = { id: 'shared-potion', itemId: 'potion', quantity: 1, position: { x: 13, y: 12 } } as WorldLoot;

/** A world on the floodplain with one piece of room loot on it, settled frame by frame. */
function worldWith(piece: WorldLoot) {
  const collected: string[] = [];
  const dialogBox = { visible: false, showMessages: vi.fn() };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: getWorldMap('floodplain-relay'),
    currentTile: { x: 0, y: 0 },
    runSession: { plan: { roomLootIds: [piece.id] } },
    collectedLootIds: new Set<string>(),
    dialogBox,
    pendingHubTransition: false,
    isLootAvailable: () => true,
    lootForCurrentMap: () => [piece],
    lootAt: () => undefined,
    takeLootMarksOff: () => undefined,
    collectLootHere: (loot: WorldLoot | undefined) => {
      if (!loot) {
        return null;
      }
      collected.push(loot.id);
      return 'Found Potion!';
    },
  });
  const settle = () => (scene as unknown as { settleRoomLoot(): void }).settleRoomLoot();
  const stepOn = () => (scene as unknown as { tryCollectLootAt(at: { x: number; y: number }): string | null }).tryCollectLootAt(piece.position);
  return { scene, collected, settle, stepOn };
}

const ME = '11111111-1111-4111-8111-111111111111';
const AMY = '22222222-2222-4222-8222-222222222222';

/** The room's database as the stand-in keeps it: who took what, answering `yours` to whoever took it, as `take_raid_loot` does. */
function roomWithTaken(taken: Map<string, string>, lootTaken: () => Promise<ReadonlyMap<string, string>> = () => Promise.resolve(new Map(taken))) {
  const service = {
    open: () => Promise.resolve({ ok: false, reason: '' }),
    join: (code: string) => Promise.resolve({ ok: true, room: { code, mapId: 'floodplain-relay', role: 'guest', me: ME, hostName: 'AMY', seed: 7 } }),
    leave: () => Promise.resolve(),
    takeLoot: (_code: string, key: string): Promise<LootClaim> => {
      const holder = taken.get(key);
      if (holder !== undefined) {
        return Promise.resolve(holder === ME ? { outcome: 'yours' } : { outcome: 'taken', by: holder });
      }
      taken.set(key, ME);
      return Promise.resolve({ outcome: 'yours' });
    },
    lootTaken,
  } as unknown as RaidRoomService;
  const wire = {
    join: () => Promise.resolve(true),
    standIn: () => undefined,
    send: () => undefined,
    signal: () => undefined,
    nudge: () => undefined,
    names: () => Promise.resolve(new Map()),
    leave: () => Promise.resolve(),
  } as unknown as HarbourWire<RaidPlace>;
  return new FriendRoom(service, () => wire);
}

const answered = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The multiplayer bug hunt of 12 Nov 2026: a player who took room loot, walked
 * out and banked it, then joined the same room code again while a friend was
 * still in it, was handed every piece back on the landing - the database
 * answers a piece's taker `yours` for the room's whole hour, and the new raid
 * read that as a claim won now. A piece taken before this raid dropped in is
 * gone, whoever took it.
 */
describe('a room joined again for another raid', () => {
  it('hands back nothing this player took in an earlier raid in it', async () => {
    const taken = new Map([[roomLootKey(PIECE.id), ME]]);
    const rooms = roomWithTaken(taken);
    room.real = rooms;
    try {
      await rooms.join('BCDF', 'ME');
      rooms.askWhatWasTaken();
      await answered();
      const world = worldWith(PIECE);
      world.settle();
      expect(world.collected).toEqual([]);
      // Nor is it picked up again by walking back onto where it lay.
      world.stepOn();
      await answered();
      world.settle();
      expect(world.collected).toEqual([]);
    } finally {
      room.real = null;
    }
  });

  it('hands back nothing stepped on before the room has said what was taken', async () => {
    // The race: landing beside a piece taken last raid and stepping on it
    // before the taken-list comes back. The database answers `yours`.
    const taken = new Map([[roomLootKey(PIECE.id), ME]]);
    let tell: (() => void) | null = null;
    const rooms = roomWithTaken(taken, () => new Promise((resolve) => (tell = () => resolve(new Map(taken)))));
    room.real = rooms;
    try {
      await rooms.join('BCDF', 'ME');
      rooms.askWhatWasTaken();
      const world = worldWith(PIECE);
      expect(world.stepOn()).toBeNull();
      await answered();
      world.settle();
      expect(world.collected).toEqual([]);
      tell!();
      await answered();
      world.settle();
      expect(world.collected).toEqual([]);
    } finally {
      room.real = null;
    }
  });

  it('still gives a piece nobody had taken to whoever steps on it first', async () => {
    const taken = new Map([['other-piece', AMY]]);
    const rooms = roomWithTaken(taken);
    room.real = rooms;
    try {
      await rooms.join('BCDF', 'ME');
      rooms.askWhatWasTaken();
      await answered();
      const world = worldWith(PIECE);
      world.stepOn();
      await answered();
      world.settle();
      expect(world.collected).toEqual([PIECE.id]);
    } finally {
      room.real = null;
    }
  });
});

describe('a shared piece this player won while a line was up', () => {
  it('is collected once the line is read, not left on the ground for good', () => {
    const ledger = new LootLedger();
    ledger.claim(PIECE.id);
    ledger.answered(PIECE.id, 'me', 'me');
    room.ledger = ledger;

    const collected: string[] = [];
    const dialogBox = { visible: true, showMessages: vi.fn() };
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      currentMap: getWorldMap('floodplain-relay'),
      runSession: { plan: { roomLootIds: [PIECE.id] } },
      collectedLootIds: new Set<string>(),
      dialogBox,
      pendingHubTransition: false,
      isLootAvailable: () => true,
      lootForCurrentMap: () => [PIECE],
      collectLootHere: (loot: WorldLoot) => {
        collected.push(loot.id);
        return 'Found Potion!';
      },
    });
    const settle = () => (scene as unknown as { settleRoomLoot(): void }).settleRoomLoot();

    // The database says this player was first on a frame a trainer's
    // challenge (or any line) is on screen: nothing is said over it.
    settle();
    expect(collected).toEqual([]);

    // The line is read: the piece is this player's, so it comes into the pack.
    dialogBox.visible = false;
    settle();
    expect(collected).toEqual([PIECE.id]);
    expect(dialogBox.showMessages).toHaveBeenCalledWith(['Found Potion!']);

    // And only once.
    settle();
    expect(collected).toEqual([PIECE.id]);
  });
});
