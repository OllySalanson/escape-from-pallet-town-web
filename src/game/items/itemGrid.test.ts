import { describe, expect, it } from 'vitest';
import { RAID_BAG_GRID, BASE_SECURE_GRID, VAULT_GRID } from './containers';
import { ITEM_DEFINITIONS, isPack } from './items';
import { FALLBACK_PACK_ID, packGridFor } from './packs';
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
   *
   * The kit's own pack is not packed into itself - it is worn - so what has to
   * fit is the supplies, and the container they have to fit is the *Satchel*,
   * because that is the pack a player who has nothing else is handed.
   */
  it('holds the whole wipe restock kit in the starting pack, with room to spare', () => {
    const kit = Object.fromEntries(
      Object.entries(MINIMUM_SUPPLIES).filter(([itemId]) => !isPack(itemId)),
    );
    expect(fitsInGrid(kit, RAID_BAG_GRID)).toBe(true);
    const packed = packContents(kit, RAID_BAG_GRID);
    expect(packed.overflow).toEqual([]);
    expect(packed.cellsUsed).toBe(8);
    expect(gridCells(RAID_BAG_GRID) - packed.cellsUsed).toBe(10);

    // And in the last-resort pack, which is the one the restock hands out.
    const satchel = packGridFor(FALLBACK_PACK_ID);
    expect(fitsInGrid(kit, satchel)).toBe(true);
    expect(gridCells(satchel) - packContents(kit, satchel).cellsUsed).toBe(4);
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

/**
 * Cargo is the one piece in a container that is not a supply: a Pokemon being
 * carried home, four squares, six or nine by its evolution stage. It is packed
 * by the same packer and drawn on the same squares.
 */
describe('a pack carrying a Pokemon home', () => {
  const pidgey = { cargoId: 'a', name: 'Pidgey', width: 2, height: 2 };
  const ivysaur = { cargoId: 'b', name: 'Ivysaur', width: 3, height: 2 };
  const venusaur = { cargoId: 'c', name: 'Venusaur', width: 3, height: 3 };

  it('seats cargo before any supply, so Potions never crowd a Pokemon out', () => {
    // Fourteen one-square Potions leave four squares, but scattered ones: the
    // 3x3 only fits because it is seated first.
    const packed = packContents({ potion: 9 }, RAID_BAG_GRID, [venusaur]);
    expect(packed.cargoOverflow).toEqual([]);
    expect(packed.cargo[0]).toMatchObject({ cargoId: 'c', x: 0, y: 0 });
    expect(packed.cellsUsed).toBe(18);
    expect(packed.overflow).toEqual([]);
  });

  it('counts three first-stage catches as twelve of the pack\'s eighteen squares', () => {
    const three = [pidgey, { ...pidgey, cargoId: 'b' }, { ...pidgey, cargoId: 'c' }];
    const packed = packContents({}, RAID_BAG_GRID, three);
    expect(packed.cargoOverflow).toEqual([]);
    expect(packed.cellsUsed).toBe(12);
    expect(roomFor({}, RAID_BAG_GRID, 'potion', 99, three)).toBe(6);
    // A fourth does not go in: three catches is the pack's limit on its own.
    expect(fitsInGrid({}, RAID_BAG_GRID, [...three, { ...pidgey, cargoId: 'd' }])).toBe(false);
  });

  /**
   * A full pack and one more Pokemon is one question with one answer, and the
   * answer is no whichever list the packer happens to put the overflow in -
   * cargo is seated first, so it is the Potions that will not go back.
   */
  it('answers no when a full pack is asked to take one more Pokemon', () => {
    expect(fitsInGrid({ potion: 18 }, RAID_BAG_GRID, [pidgey])).toBe(false);
    expect(fitsInGrid({ potion: 14 }, RAID_BAG_GRID, [pidgey])).toBe(true);
    // And no when nothing is packed but the cargo itself will not go in.
    const packed = packContents({}, { width: 2, height: 2 }, [pidgey, ivysaur]);
    expect(packed.cargo.map(({ cargoId }) => cargoId)).toEqual(['a']);
    expect(packed.cargoOverflow).toEqual([ivysaur]);
  });

  it('holds exactly one first-stage Pokemon in the container every save starts with', () => {
    expect(fitsInGrid({}, BASE_SECURE_GRID, [pidgey])).toBe(true);
    // And nothing else: four squares of four.
    expect(fitsInGrid({ potion: 1 }, BASE_SECURE_GRID, [pidgey])).toBe(false);
    // An evolved one does not go in at all until the container has grown.
    expect(fitsInGrid({}, BASE_SECURE_GRID, [ivysaur])).toBe(false);
    expect(fitsInGrid({}, { width: 3, height: 2 }, [ivysaur])).toBe(true);
    // A fully evolved one is three squares tall, and the container never is:
    // it grows by columns, so a Venusaur can never be secured.
    expect(fitsInGrid({}, { width: 9, height: 2 }, [venusaur])).toBe(false);
  });
});
