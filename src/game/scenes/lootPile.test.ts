import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { getWorldMap } from '../worldMap';
import type { WorldLoot } from '../world/loot';
import { WorldScene } from './WorldScene';

const AT = { x: 13, y: 12 };
const pile = [
  { id: 'dropped-valve', itemId: 'radio-valve', quantity: 1, position: AT },
  { id: 'dropped-money', itemId: 'money', quantity: 35, position: AT },
  { id: 'dropped-berry', itemId: 'oran-berry', quantity: 1, position: AT },
] as WorldLoot[];

/**
 * AI playtest of 22 Nov 2026 (Safari Marsh): a Radio valve, P35 and an Oran
 * Berry on one tile with one square free, and every step back onto it said only
 * 'No room for RADIO VALVE' - the money that would fit was never picked up.
 */
describe('a pile of pieces on one tile', () => {
  it('has every piece tried in turn, so what fits is picked up behind what does not', () => {
    const tried: string[] = [];
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      currentMap: getWorldMap('floodplain-relay'),
      runSession: { plan: {}, manager: {} },
      collectedLootIds: new Set<string>(),
      isLootAvailable: () => true,
      lootForCurrentMap: () => pile,
      collectLootHere: (loot: WorldLoot) => {
        tried.push(loot.id);
        return loot.itemId === 'money' ? 'Picked up ₽35 again.' : `No room for ${loot.itemId}.`;
      },
    });

    const said = (scene as unknown as { tryCollectLootAt(at: { x: number; y: number }): string | null }).tryCollectLootAt(AT);

    expect(tried).toEqual(['dropped-valve', 'dropped-money', 'dropped-berry']);
    expect(said).toContain('Picked up ₽35 again.');
  });
});
