import { describe, expect, it, vi } from 'vitest';
import { EVOLUTION_STONE_IDS, isEvolutionStone } from '../items';
import { TRADER_STOCK } from '../hub/trader';
import { MINIMUM_SUPPLIES, Stash } from '../stash';
import { WORLD_MAPS } from '../worldMap';
import { districtAt, districtsForMap } from './districts';
import { getVisibleLoot, isPrize, prizesLeftBehind, tryCollectLoot, type WorldLoot } from './loot';

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

/**
 * **The prize: what a raid can be for.**
 *
 * The rule under all of this is one line - a piece with its own `chance` is a
 * prize - and what it buys is a raid with an intention in it. These hold the
 * three halves of that: which pieces are prizes, that each is seated in the
 * place its name belongs to, and that no map turns into a treasure hunt.
 */
describe('a rare find', () => {
  it('is a prize exactly when it is rolled on its own odds', () => {
    expect(isPrize(POKE_BALL_LOOT)).toBe(false);
    expect(isPrize({ ...POKE_BALL_LOOT, chance: 0.2 })).toBe(true);
  });

  it('names the place it belongs to, on every map', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      const prizes = map.loot.filter(isPrize);
      // Every map holds some: a map with no reason to be chosen is a map
      // nobody chooses.
      expect(prizes.length, `${map.id} holds nothing rare`).toBeGreaterThan(0);
      for (const prize of prizes) {
        const district = districtsForMap(map.id).find(
          (candidate) => candidate.id === prize.district,
        );
        expect(district, `${prize.id} names no district`).toBeDefined();
        // And its own fallback tile is inside it, so the piece is in the right
        // place even on the raid where the seating cannot find it room.
        expect(
          `${prize.id}: ${districtAt(map.id, prize.position)?.id}`,
          `${prize.id} falls back outside ${prize.district}`,
        ).toBe(`${prize.id}: ${prize.district}`);
      }
    }
  });

  it('stays rare: no map is mostly prizes, and nothing is a coin flip', () => {
    for (const map of Object.values(WORLD_MAPS)) {
      const prizes = map.loot.filter(isPrize);
      expect(prizes.length).toBeLessThan(map.loot.length / 3);
      for (const prize of prizes) {
        // A third would be "most raids", which is a chore rather than an event.
        expect(`${prize.id}: ${prize.chance}`).toBe(
          `${prize.id}: ${Math.min(prize.chance ?? 1, 0.3)}`,
        );
      }
    }
  });

  /**
   * The five stones are the prize the whole thing was built for: each map holds
   * exactly one of its own, in the country the Pokemon that reads it lives in,
   * so "which map am I going to today" and "what am I going out for" are the
   * same question.
   */
  it('puts one evolution stone on every map, in a place of its own', () => {
    const stones = Object.values(WORLD_MAPS).flatMap((map) =>
      map.loot
        .filter((loot) => isEvolutionStone(loot.itemId))
        .map((loot) => `${map.id}: ${loot.itemId} in ${loot.district}`),
    );
    expect(stones.sort()).toEqual([
      'floodplain-relay: leaf-stone in floodplain-withy-beds',
      'pallet-town: water-stone in pallet-beacon',
      'route-1: fire-stone in route-1-charcoal-burn',
      'viridian-forest: moon-stone in forest-stone-row',
      'viridian-forest: thunder-stone in forest-deep-stand',
    ]);
    // Every stone in the catalogue is findable: one that could only be bought
    // off Bill would be a thing money buys, which is the constraint the
    // barter table exists to keep (`hub/trader.ts`).
    const found = new Set(
      Object.values(WORLD_MAPS).flatMap((map) =>
        map.loot.filter((loot) => isEvolutionStone(loot.itemId)).map((loot) => loot.itemId),
      ),
    );
    expect([...found].sort()).toEqual([...EVOLUTION_STONE_IDS].sort());
  });
});

/** What the result screen is handed: what was seen, and not taken. */
describe('what a raid left on the ground', () => {
  const laid = {
    'route-1': [
      { id: 'stone', position: { x: 1, y: 1 }, itemId: 'fire-stone' as const, quantity: 1, chance: 0.2 },
      { id: 'pack', position: { x: 2, y: 2 }, itemId: 'ranger-pack' as const, quantity: 1, chance: 0.2 },
      { id: 'potion', position: { x: 3, y: 3 }, itemId: 'potion' as const, quantity: 1 },
    ],
  };

  it('is only what was seen, and only what was not picked up', () => {
    expect(prizesLeftBehind(laid, new Set(['stone', 'pack']), new Set(['pack']))).toEqual([
      'fire-stone',
    ]);
  });

  it('never names an ordinary supply, however much of it was walked past', () => {
    // A Potion on the grass is not a decision anybody made, and a screen that
    // listed one would be saying "you left a Potion" to somebody who left forty.
    expect(prizesLeftBehind(laid, new Set(['stone', 'potion']), new Set(['stone']))).toEqual([]);
  });

  it('says nothing about a prize the raid never laid eyes on', () => {
    expect(prizesLeftBehind(laid, new Set(), new Set())).toEqual([]);
  });
});

/**
 * Where a stone may come from, and the two places it may not.
 *
 * A stone is the one change this game makes that nothing can take back, so the
 * only two ways to hold one are to walk to it past the clock or to trade a
 * raid's worth of materials for it. Anything that *repeats on its own* - the
 * wipe restock, the kit every save starts with, Bill's shelf - would
 * make it a formality, which is exactly the rule the machines are held to
 * (`items/teaching.test.ts`).
 */
describe('where a stone comes from', () => {
  it('is never restocked and never part of the kit a save starts with', () => {
    const stash = new Stash();
    for (const id of EVOLUTION_STONE_IDS) {
      expect(MINIMUM_SUPPLIES).not.toHaveProperty(id);
    }
    stash.restockMinimumSupplies();
    for (const id of EVOLUTION_STONE_IDS) {
      expect(stash.itemCount(id), `${id} was restocked`).toBe(0);
    }
  });

  it('is never on the shelf, because it is one of the things money cannot buy', () => {
    for (const item of TRADER_STOCK) {
      expect(isEvolutionStone(item.itemId), `${item.itemId} is for sale`).toBe(false);
    }
  });
});
