import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn() }),
}));

import { Bag, cellsFor, type ItemId } from '../items';
import { RunPhase } from '../run/RunManager';
import type { SearchPiece } from '../world/cacheSearch';
import { WorldScene } from './WorldScene';

/** The parts of the scene this drives, which are private to it. */
interface Driven {
  takeSearched(indices: readonly number[]): void;
  search: { said: string | null } | null;
}

/**
 * A beaten trainer's bag, open and searched to the end, beside a pack of
 * twelve squares that is all money: Koga's ₽1800 prize filled the pack, and
 * the TM40 AERIAL ACE in his ninja pouch then said NO ROOM (gyms playtest,
 * 26 Nov 2026).
 */
function besideABag(pieces: readonly SearchPiece[]) {
  const bag = new Bag({ money: 3000 }, { width: 4, height: 3 });
  const poi = { id: 'bag:koga', label: "KOGA'S NINJA POUCH", position: { x: 4, y: 4 }, reward: [] };
  const runSession = {
    cachesSearched: { [poi.id]: { searchedMs: 600_000, taken: [] as number[] } } as Record<string, { searchedMs: number; taken: number[] }>,
    droppedOnTheGround: {} as Record<string, unknown[]>,
    manager: { phase: RunPhase.InRun, registerFoundItem: vi.fn(), registerDroppedItem: vi.fn() },
  };
  const interrupt = vi.fn();
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: { id: 'greystone-vale' },
    currentTile: { x: 4, y: 5 },
    bag,
    runSession,
    search: { poi, pieces, takingAll: false, said: null },
    poiSprites: new Map(),
    poiLabels: new Map(),
    worldLabels: [],
    packReseated: false,
    isLootAvailable: () => false,
    interrupt,
  });
  return { scene: scene as unknown as Driven, bag, runSession, interrupt };
}

const tm: ItemId = 'tm40-aerial-ace';

describe("a prize never blocks a trainer's reward", () => {
  it('puts down just enough money to take a treasure the full pack had no room for', () => {
    expect(cellsFor(tm, 1)).toBe(1);
    const raid = besideABag([{ itemId: tm, squares: 1, find: 'treasure' }]);
    raid.scene.takeSearched([0]);
    expect(raid.bag.count(tm)).toBe(1);
    // One square of money, and no more, lies where the player stands to take back.
    expect(raid.bag.count('money')).toBe(2750);
    expect(Object.values(raid.runSession.droppedOnTheGround).flat()).toEqual([expect.objectContaining({ itemId: 'money', quantity: 250 })]);
    expect(raid.runSession.manager.registerDroppedItem).toHaveBeenCalledWith('money', 250);
    // The pouch is empty and the panel gone, so it is said in a box.
    expect(raid.scene.search).toBeNull();
    expect(raid.interrupt).toHaveBeenCalledWith([
      "You put down ₽250 to make room for the TM40 AERIAL ACE. It's on the ground here.",
    ]);
  });

  it('says what it put down while the search is still open', () => {
    const raid = besideABag([
      { itemId: tm, squares: 1, find: 'treasure' },
      { itemId: 'potion', squares: 1 },
    ]);
    raid.scene.takeSearched([0]);
    expect(raid.scene.search?.said).toBe('PUT DOWN ₽250 TO MAKE ROOM');
    expect(raid.interrupt).not.toHaveBeenCalled();
  });

  it('puts nothing down for an everyday piece, which is still refused', () => {
    const raid = besideABag([{ itemId: 'potion', squares: 1 }]);
    raid.scene.takeSearched([0]);
    expect(raid.bag.count('potion')).toBe(0);
    expect(raid.bag.count('money')).toBe(3000);
    expect(raid.scene.search?.said).toMatch(/^NO ROOM FOR POTION/);
  });
});
