import { describe, expect, it } from 'vitest';
import { RAID_BAG_GRID } from './containers';
import { fitsInGrid, gridCells, packContents } from './itemGrid';
import { ITEM_DEFINITIONS, ItemCategory, isFoundOnly, isPack, PACK_ITEM_IDS } from './items';
import {
  bestPackIn,
  FALLBACK_PACK_ID,
  isPackId,
  PACK_IDS,
  packGrid,
  packGridFor,
  packName,
  packsIn,
  packSquares,
  STARTING_PACK_ID,
} from './packs';
import { MINIMUM_SUPPLIES } from '../stash/Stash';
import { WORLD_MAPS } from '../worldMap';
import { OUTFITTER_UPGRADES } from '../hub/outfitter';
import { TRADER_STOCK, TRADER_BARTERS } from '../hub/trader';
import { RAID_CONTRACTS } from '../objectives/contracts';

describe('the packs', () => {
  it('is a ladder of four, six squares apart, that never doubles', () => {
    expect(PACK_IDS).toEqual(['satchel', 'raid-pack', 'ranger-pack', 'hauler-frame']);
    expect(PACK_IDS.map(packSquares)).toEqual([12, 18, 24, 30]);
    // Each rung is one more row of the picture the player already reads, and
    // never twice the last - a doubling would make the step before it worthless.
    const steps = PACK_IDS.slice(1).map((id, index) => packSquares(id) - packSquares(PACK_IDS[index]));
    expect(new Set(steps)).toEqual(new Set([6]));
  });

  it('draws every pack the same width, so growing one only ever adds a row', () => {
    expect(new Set(PACK_IDS.slice(1).map((id) => packGridFor(id).width))).toEqual(new Set([6]));
    // The smallest is narrower as well as shorter: it is meant to look like less.
    expect(packGridFor(FALLBACK_PACK_ID)).toEqual({ width: 4, height: 3 });
  });

  it('is a found thing, never a packed one, and never gear', () => {
    for (const itemId of PACK_ITEM_IDS) {
      const item = ITEM_DEFINITIONS.find((definition) => definition.id === itemId)!;
      expect(item.category).toBe(ItemCategory.Pack);
      expect(isPack(itemId)).toBe(true);
      // Found in the field and carried out, exactly as a material or money is.
      expect(isFoundOnly(itemId)).toBe(true);
      // Two squares on a side, because that is what carrying one home costs.
      expect(item.footprint).toEqual({ width: 2, height: 2 });
    }
  });

  it('starts a save on the eighteen squares the game was designed around', () => {
    expect(STARTING_PACK_ID).toBe('raid-pack');
    expect(packGridFor(STARTING_PACK_ID)).toEqual(RAID_BAG_GRID);
    expect(gridCells(RAID_BAG_GRID)).toBe(18);
  });

  /**
   * The last resort has to be able to carry the last-resort kit. A player who
   * lost everything is handed the Satchel and the restock supplies together,
   * and a pack that could not hold them would break the one promise this game
   * makes to somebody with nothing left to trade.
   */
  it('carries the whole wipe restock kit in the pack the wipe restock hands out', () => {
    const kit = Object.fromEntries(
      Object.entries(MINIMUM_SUPPLIES).filter(([itemId]) => !isPack(itemId)),
    );
    const satchel = packGridFor(FALLBACK_PACK_ID);
    expect(fitsInGrid(kit, satchel)).toBe(true);
    expect(gridCells(satchel) - packContents(kit, satchel).cellsUsed).toBe(4);
    // And the kit's pack line is the Satchel, so the restock is never generous.
    expect(MINIMUM_SUPPLIES[FALLBACK_PACK_ID]).toBe(1);
    expect(packSquares(FALLBACK_PACK_ID)).toBe(Math.min(...PACK_IDS.map(packSquares)));
  });

  it('answers an id it has never heard of with the smallest pack rather than a crash', () => {
    expect(packGrid('hot-air-balloon')).toBeUndefined();
    expect(packGridFor('hot-air-balloon')).toEqual(packGridFor(FALLBACK_PACK_ID));
    expect(packGridFor(undefined)).toEqual(packGridFor(FALLBACK_PACK_ID));
    expect(isPackId('potion')).toBe(false);
    expect(isPackId(null)).toBe(false);
    expect(packName(null)).toBe('Pack');
  });

  it('reads a vault as the packs it holds, smallest first and counted', () => {
    expect(packsIn({ potion: 4 })).toEqual([]);
    expect(bestPackIn({ potion: 4 })).toBeUndefined();
    expect(packsIn({ 'hauler-frame': 1, satchel: 2, potion: 9 })).toEqual([
      { itemId: 'satchel', held: 2 },
      { itemId: 'hauler-frame', held: 1 },
    ]);
    // A loadout opens on the biggest, the way the secure container fills itself.
    expect(bestPackIn({ 'hauler-frame': 1, satchel: 2 })).toBe('hauler-frame');
    expect(bestPackIn({ satchel: 1, 'raid-pack': 1 })).toBe('raid-pack');
  });
});

/**
 * A pack has to be obtainable, or losing one is a dead end - and it has to be
 * obtainable only by *going and finding it*, or losing one costs nothing.
 */
describe('where a pack comes from', () => {
  const lootPacks = Object.values(WORLD_MAPS).map((map) => ({
    id: map.id,
    packs: map.loot.filter((item) => isPack(item.itemId)),
  }));

  it('lies in the field on every map, and always as a roll rather than a certainty', () => {
    for (const { id, packs } of lootPacks) {
      expect(packs.length, `${id} holds no pack`).toBeGreaterThan(0);
      for (const item of packs) {
        // A rolled find like the machines and the stone: a pack at pool odds
        // would be a formality, and the point of it is the raid you remember.
        expect(item.chance, `${id}/${item.id} is not rolled`).toBeGreaterThan(0);
        expect(item.chance).toBeLessThan(1);
      }
    }
  });

  it('puts the biggest packs only on the two vast maps', () => {
    const biggest = PACK_IDS.at(-1)!;
    const holders = lootPacks
      .filter(({ packs }) => packs.some((item) => item.itemId === biggest))
      .map(({ id }) => id);
    expect(holders.sort()).toEqual(['floodplain-relay', 'viridian-forest']);
  });

  /**
   * Nothing that repeats may hand one out. A pack is kept by surviving with it,
   * the way gear is kept by carrying it out, so a contract reward, a shelf or an
   * Outfitter rung paying one would stop the loss meaning anything. The types
   * already refuse it - `SupplyItemId` excludes packs - and this says so out
   * loud, because a type can be widened by accident.
   */
  it('is never sold, bartered, built or handed out by a contract', () => {
    const named = [
      ...OUTFITTER_UPGRADES.flatMap((upgrade) => upgrade.cost.supplies.map(({ itemId }) => itemId)),
      ...TRADER_STOCK.map((stock) => stock.itemId),
      ...TRADER_BARTERS.flatMap((barter) => [
        barter.gives.itemId,
        ...barter.takes.map(({ itemId }) => itemId),
      ]),
      ...RAID_CONTRACTS.flatMap((contract) => [
        ...(contract.reward.items ?? []).map(({ itemId }) => itemId),
        ...contract.markers.flatMap((marker) => (marker.carriedIn ?? []).map(({ itemId }) => itemId)),
      ]),
    ];
    expect(named.filter((itemId) => isPack(itemId))).toEqual([]);
  });
});
