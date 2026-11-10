import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const room = vi.hoisted(() => ({ ledger: undefined as object | undefined, closed: false, asked: [] as string[] }));

// The room's session as `FriendRoom.claimLoot` behaves: once the room has closed
// under this raid, a claim is answered at once, and as this player's.
vi.mock('../raidRoom/friendRoom', () => ({
  friendRoom: () => ({
    room: { code: 'BCDF', mapId: 'floodplain-relay', me: 'me' },
    loot: room.ledger,
    claimLoot: (lootId: string) => {
      const ledger = room.ledger as import('../raidRoom/roomLoot').LootLedger;
      if (!ledger.claim(lootId)) {
        return;
      }
      room.asked.push(lootId);
      if (room.closed) {
        ledger.answered(lootId, 'me', 'me');
      }
    },
  }),
}));

import { LootLedger } from '../raidRoom/roomLoot';
import { getWorldMap } from '../worldMap';
import type { WorldLoot } from '../world/loot';
import { WorldScene } from './WorldScene';

const PIECE = { id: 'shared-potion', itemId: 'potion', quantity: 1, position: { x: 13, y: 12 } } as WorldLoot;

function sceneOn(collected: string[]) {
  const dialogBox = { visible: false, showMessages: vi.fn() };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: getWorldMap('floodplain-relay'),
    runSession: { plan: { roomLootIds: [PIECE.id] }, manager: {} },
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
  const call = scene as unknown as { tryCollectLootAt(at: { x: number; y: number }): string | null; settleRoomLoot(): void };
  return { step: () => call.tryCollectLootAt(PIECE.position), settle: () => call.settleRoomLoot(), dialogBox };
}

describe('a shared piece stepped on', () => {
  it('is only claimed while the room is open: the answer comes on a later frame', () => {
    room.ledger = new LootLedger();
    room.closed = false;
    room.asked = [];
    const collected: string[] = [];
    const { step } = sceneOn(collected);
    expect(step()).toBeNull();
    expect(collected).toEqual([]);
    expect(room.asked).toEqual([PIECE.id]);
  });

  it('is picked up on the step once the room has closed under this raid, and said once', () => {
    // The bug hunt of 9 Nov: with the room gone, every claim was refused and
    // the piece stayed on the ground however often the player stood on it.
    room.ledger = new LootLedger();
    room.closed = true;
    room.asked = [];
    const collected: string[] = [];
    const { step, settle, dialogBox } = sceneOn(collected);
    expect(step()).toBe('Found Potion!');
    expect(collected).toEqual([PIECE.id]);
    // The next frame's settling does not pick it up, or say it, a second time.
    settle();
    expect(collected).toEqual([PIECE.id]);
    expect(dialogBox.showMessages).not.toHaveBeenCalled();
  });
});
