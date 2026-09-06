import { describe, expect, it, vi } from 'vitest';
import { getVisibleLoot, tryCollectLoot, type WorldLoot } from './loot';

const POKE_BALL_LOOT: WorldLoot = {
  id: 'test-poke-ball',
  position: { x: 5, y: 5 },
  itemId: 'poke-ball',
  quantity: 2,
};

describe('world loot', () => {
  it('collects through the supplied run-item seam exactly once', () => {
    const collectedLootIds = new Set<string>();
    const collectRunItem = vi.fn(() => true);

    expect(tryCollectLoot(POKE_BALL_LOOT, true, collectedLootIds, collectRunItem)).toBe(
      'collected',
    );
    expect(tryCollectLoot(POKE_BALL_LOOT, true, collectedLootIds, collectRunItem)).toBe(
      'unavailable',
    );
    expect(collectRunItem).toHaveBeenCalledOnce();
    expect(collectRunItem).toHaveBeenCalledWith('poke-ball', 2);
  });

  it('leaves loot available when the bag cannot accept it', () => {
    const collectedLootIds = new Set<string>();

    expect(tryCollectLoot(POKE_BALL_LOOT, true, collectedLootIds, () => false)).toBe('bag-full');
    expect(collectedLootIds).toEqual(new Set());
  });

  it('does not expose loot outside an active run', () => {
    expect(getVisibleLoot([POKE_BALL_LOOT], false, new Set())).toEqual([]);
    expect(getVisibleLoot([POKE_BALL_LOOT], true, new Set())).toEqual([POKE_BALL_LOOT]);
  });
});
