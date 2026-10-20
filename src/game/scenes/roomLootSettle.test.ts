import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const room = vi.hoisted(() => ({ ledger: undefined as object | undefined }));

vi.mock('../raidRoom/friendRoom', () => ({
  friendRoom: () => ({
    room: { code: 'BCDF', mapId: 'floodplain-relay', me: 'me' },
    loot: room.ledger,
  }),
}));

import { LootLedger } from '../raidRoom/roomLoot';
import { getWorldMap } from '../worldMap';
import type { WorldLoot } from '../world/loot';
import { WorldScene } from './WorldScene';

const PIECE = { id: 'shared-potion', itemId: 'potion', quantity: 1, position: { x: 13, y: 12 } } as WorldLoot;

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
