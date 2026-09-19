import { describe, expect, it } from 'vitest';
import { RAID_BAG_GRID, BASE_SECURE_GRID, VAULT_GRID } from './containers';
import { ITEM_DEFINITIONS } from './items';
import { cellsFor, fitsInGrid, footprintOf, gridCells, packContents, roomFor } from './itemGrid';
import { MINIMUM_SUPPLIES } from '../stash/Stash';

describe('what an item takes up', () => {
  it('gives every catalogue item a footprint no more than two squares on a side', () => {
    for (const item of ITEM_DEFINITIONS) {
      expect(item.footprint.width, item.id).toBeGreaterThanOrEqual(1);
      expect(item.footprint.height, item.id).toBeGreaterThanOrEqual(1);
      // The greedy packer is exact for pieces this size in an even-width
      // container. A three-wide item is a change to `packContents`, not a row
      // in the catalogue.
      expect(item.footprint.width, item.id).toBeLessThanOrEqual(2);
      expect(item.footprint.height, item.id).toBeLessThanOrEqual(2);
    }
  });

  it('makes every material bulkier than a Potion, which is the whole squeeze', () => {
    const potion = cellsFor('potion', 1);
    expect(potion).toBe(1);
    for (const item of ITEM_DEFINITIONS.filter(({ effect }) => effect.type === 'material')) {
      expect(cellsFor(item.id, 1), item.id).toBeGreaterThan(potion);
    }
  });

  it('prices a Super Potion at two Potions of room', () => {
    expect(cellsFor('super-potion', 1)).toBe(2 * cellsFor('potion', 1));
  });

  it('falls back to one square for an id the catalogue does not know', () => {
    expect(footprintOf('not-an-item')).toEqual({ width: 1, height: 1 });
  });
});

describe('packing a container', () => {
  it('seats big pieces first and leaves no square double-booked', () => {
    const packing = packContents({ 'parts-crate': 2, potion: 4, 'super-potion': 1 }, RAID_BAG_GRID);
    expect(packing.overflow).toEqual([]);
    expect(packing.cellsUsed).toBe(2 * 4 + 4 + 2);

    const seen = new Set<string>();
    for (const placement of packing.placements) {
      for (let y = placement.y; y < placement.y + placement.height; y += 1) {
        for (let x = placement.x; x < placement.x + placement.width; x += 1) {
          expect(seen.has(`${x}:${y}`)).toBe(false);
          seen.add(`${x}:${y}`);
          expect(x).toBeLessThan(RAID_BAG_GRID.width);
          expect(y).toBeLessThan(RAID_BAG_GRID.height);
        }
      }
    }
    expect(seen.size).toBe(packing.cellsUsed);
    // The crates take the top-left corner, because size decides the order.
    expect(packing.placements[0]).toMatchObject({ itemId: 'parts-crate', x: 0, y: 0 });
  });

  it('draws the same picture for the same contents, whatever order they arrive in', () => {
    const one = packContents({ potion: 2, 'cable-coil': 1, 'poke-ball': 3 }, RAID_BAG_GRID);
    const two = packContents({ 'poke-ball': 3, potion: 2, 'cable-coil': 1 }, RAID_BAG_GRID);
    expect(one.placements).toEqual(two.placements);
  });

  it('reports what would not go in rather than dropping it silently', () => {
    const packing = packContents({ 'parts-crate': 8 }, RAID_BAG_GRID);
    expect(packing.cellsUsed).toBe(12);
    expect(packing.overflow).toEqual([{ itemId: 'parts-crate', quantity: 5 }]);
  });

  it('answers how much more of one kind would fit, in that kind\'s own squares', () => {
    // Four crates fill the pack exactly; a fifth needs four squares that are
    // not there, while a Potion needs one and there is none of that either.
    expect(roomFor({}, RAID_BAG_GRID, 'parts-crate')).toBe(3);
    expect(roomFor({ 'parts-crate': 2 }, RAID_BAG_GRID, 'potion')).toBe(10);
    expect(roomFor({ 'parts-crate': 3 }, RAID_BAG_GRID, 'potion')).toBe(6);
  });

  /**
   * The reason nothing is ever placed by hand. A pack is re-seated from its
   * whole contents every time it is asked about, so a crate picked up last is
   * seated first and the singles fill in around it: a player can never be
   * refused for having packed in the wrong order, only for being out of room.
   * That is what makes auto-placement enough, and manual placement a cost with
   * nothing to buy.
   */
  it('re-seats the whole pack round a big find, so order can never lose a square', () => {
    const contents = { potion: 14 };
    expect(gridCells(RAID_BAG_GRID) - packContents(contents, RAID_BAG_GRID).cellsUsed).toBe(4);
    expect(fitsInGrid({ ...contents, 'parts-crate': 1 }, RAID_BAG_GRID)).toBe(true);
    const packed = packContents({ ...contents, 'parts-crate': 1 }, RAID_BAG_GRID);
    expect(packed.placements[0]).toMatchObject({ itemId: 'parts-crate', x: 0, y: 0 });
    expect(packed.cellsUsed).toBe(18);
    // One square over is one square over, whatever the order.
    expect(fitsInGrid({ potion: 15, 'parts-crate': 1 }, RAID_BAG_GRID)).toBe(false);
  });
});

describe('the containers a save starts with', () => {
  /**
   * The wipe restock is the game's promise that a player can always attempt a
   * raid. A kit that would not fit the pack it deploys in breaks it in the one
   * place the player has nothing left to trade.
   */
  it('holds the whole wipe restock kit in the starting pack, with room to spare', () => {
    expect(fitsInGrid(MINIMUM_SUPPLIES, RAID_BAG_GRID)).toBe(true);
    const packed = packContents(MINIMUM_SUPPLIES, RAID_BAG_GRID);
    expect(packed.overflow).toEqual([]);
    expect(packed.cellsUsed).toBe(8);
    expect(gridCells(RAID_BAG_GRID) - packed.cellsUsed).toBe(10);
  });

  it('starts the secure container at one parts crate, or four Potions', () => {
    expect(gridCells(BASE_SECURE_GRID)).toBe(4);
    expect(fitsInGrid({ 'parts-crate': 1 }, BASE_SECURE_GRID)).toBe(true);
    expect(fitsInGrid({ 'parts-crate': 1, potion: 1 }, BASE_SECURE_GRID)).toBe(false);
    expect(fitsInGrid({ potion: 4 }, BASE_SECURE_GRID)).toBe(true);
    expect(fitsInGrid({ potion: 5 }, BASE_SECURE_GRID)).toBe(false);
  });

  it('gives the vault a shape only so it can be drawn, never so it can be full', () => {
    expect(gridCells(VAULT_GRID)).toBeGreaterThan(gridCells(RAID_BAG_GRID) * 10);
  });
});
