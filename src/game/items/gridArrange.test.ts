import { describe, expect, it } from 'vitest';
import { Bag } from './Bag';
import { RAID_BAG_GRID } from './containers';
import {
  canSeat,
  parsePieceRef,
  pieceAt,
  pieceRefKey,
  placementOf,
  readArrangement,
  seatPiece,
  turnPiece,
  type GridPieceRef,
} from './gridArrange';
import {
  arrangementOf,
  fitsInGrid,
  packContents,
  tidyArrangement,
  tidyWouldFit,
  type GridCargo,
} from './itemGrid';

/**
 * The captain's own pack, on his first raid with the grid (2026-09-20).
 *
 * A caught Pidgey at four squares, a cable coil at four, a Super Potion at two
 * and a Potion at one: eleven of eighteen. He then found a mooring rope, also
 * four, and the pack refused it with seven squares free - and said so in a way
 * that gave him nothing to do about it.
 */
const CAPTAIN_PACK = { 'cable-coil': 1, 'super-potion': 1, potion: 1 } as const;
const CAUGHT_PIDGEY: GridCargo = { cargoId: 'carried-0', name: 'Pidgey', width: 2, height: 2 };

describe("the captain's pack", () => {
  it('fills eleven of eighteen squares, with no seat for a 2x2 among them', () => {
    // His pack, laid out the way first-fit laid it out for him: everything
    // upright, biggest first, left to right.
    const upright = {
      items: [
        { itemId: 'cable-coil', x: 2, y: 0, rotated: false },
        { itemId: 'super-potion', x: 4, y: 0, rotated: false },
        { itemId: 'potion', x: 5, y: 0, rotated: false },
      ],
      cargo: [{ cargoId: 'carried-0', x: 0, y: 0, rotated: false }],
    };
    const packing = packContents(CAPTAIN_PACK, RAID_BAG_GRID, [CAUGHT_PIDGEY], upright);
    expect(packing.cellsUsed).toBe(11);
    expect(packing.cellsTotal).toBe(18);
    // Seven squares free and not one pair of adjacent rows among them, so a
    // four-square find is refused with room for it on the board.
    expect(fitsInGrid({ ...CAPTAIN_PACK, 'mooring-rope': 1 }, RAID_BAG_GRID, [CAUGHT_PIDGEY], upright)).toBe(
      false,
    );
  });

  it('seats the mooring rope once the pack is tidied, by laying the Super Potion down', () => {
    const withRope = { ...CAPTAIN_PACK, 'mooring-rope': 1 };
    expect(fitsInGrid(withRope, RAID_BAG_GRID, [CAUGHT_PIDGEY])).toBe(true);
    const packing = packContents(withRope, RAID_BAG_GRID, [CAUGHT_PIDGEY]);
    expect(packing.overflow).toEqual([]);
    expect(packing.cargoOverflow).toEqual([]);
    expect(packing.cellsUsed).toBe(15);
    const superPotion = packing.placements.find((piece) => piece.itemId === 'super-potion');
    expect(superPotion?.rotated).toBe(true);
    expect(superPotion).toMatchObject({ width: 2, height: 1 });
  });

  it('tells a pack that has no room from a pack that is only packed badly', () => {
    const bag = new Bag(CAPTAIN_PACK, RAID_BAG_GRID);
    bag.setCargo([CAUGHT_PIDGEY]);
    // Arranged his way - everything upright, first-fit - the rope will not go
    // in; tidied, it will. The refusal has to be able to say which.
    bag.arrange({
      items: [
        { itemId: 'cable-coil', x: 2, y: 0, rotated: false },
        { itemId: 'super-potion', x: 4, y: 0, rotated: false },
        { itemId: 'potion', x: 5, y: 0, rotated: false },
      ],
      cargo: [{ cargoId: 'carried-0', x: 0, y: 0, rotated: false }],
    });
    expect(bag.add('mooring-rope')).toBe(false);
    expect(bag.tidyWouldFit('mooring-rope')).toBe(true);
    // A find is not on a screen the player can rearrange from, so the pack
    // re-seats itself around it rather than turning it away, and says so.
    expect(bag.takeFind('mooring-rope')).toBe('reseated');
    expect(bag.count('mooring-rope')).toBe(1);
  });

  it('never claims room a tidy could not find either', () => {
    // Fill the pack outright: then no arrangement, tidied or not, seats more.
    const bag = new Bag({ 'parts-crate': 4, potion: 2 }, RAID_BAG_GRID);
    expect(bag.fits('potion')).toBe(false);
    expect(bag.tidyWouldFit('potion')).toBe(false);
    expect(bag.takeFind('potion')).toBe('refused');
  });
});

describe('an arrangement the player chose', () => {
  it('is honoured before anything is packed automatically', () => {
    const arrangement = {
      items: [{ itemId: 'parts-crate', x: 4, y: 1, rotated: false }],
      cargo: [],
    };
    const packing = packContents({ 'parts-crate': 1, potion: 3 }, RAID_BAG_GRID, [], arrangement);
    expect(packing.placements.find((piece) => piece.itemId === 'parts-crate')).toMatchObject({
      x: 4,
      y: 1,
    });
    // The Potions pack around it rather than taking the seat it holds.
    for (const potion of packing.placements.filter((piece) => piece.itemId === 'potion')) {
      expect(potion.x < 4 || potion.y < 1).toBe(true);
    }
  });

  it('keeps every other piece still when one more is added', () => {
    const bag = new Bag({ 'parts-crate': 1, potion: 1 }, RAID_BAG_GRID);
    const crate: GridPieceRef = { kind: 'item', itemId: 'parts-crate', index: 0 };
    bag.arrange(seatPiece(bag.layout(), crate, 4, 1, false)!);
    const before = bag.layout();
    expect(bag.add('super-potion')).toBe(true);
    const after = bag.layout();
    for (const piece of before.placements) {
      const still = after.placements.find(
        (other) => other.itemId === piece.itemId && other.x === piece.x && other.y === piece.y,
      );
      expect(still, `${piece.itemId} moved`).toBeDefined();
    }
  });

  it('drops a seat for something no longer carried, and moves nothing else', () => {
    const bag = new Bag({ potion: 2, 'super-potion': 1 }, RAID_BAG_GRID);
    const potion: GridPieceRef = { kind: 'item', itemId: 'potion', index: 0 };
    bag.arrange(seatPiece(bag.layout(), potion, 5, 2, false)!);
    const superPotionBefore = bag.layout().placements.find((p) => p.itemId === 'super-potion')!;
    bag.remove('potion', 2);
    expect(bag.layout().placements.some((piece) => piece.itemId === 'potion')).toBe(false);
    expect(bag.layout().placements.find((p) => p.itemId === 'super-potion')).toMatchObject({
      x: superPotionBefore.x,
      y: superPotionBefore.y,
    });
  });

  it('gives a seat back when the container shrinks under it', () => {
    const arrangement = { items: [{ itemId: 'potion', x: 5, y: 2, rotated: false }], cargo: [] };
    const packing = packContents({ potion: 1 }, { width: 2, height: 2 }, [], arrangement);
    expect(packing.overflow).toEqual([]);
    expect(packing.placements[0]).toMatchObject({ x: 0, y: 0 });
  });
});

describe('moving a piece by hand', () => {
  const bag = () => new Bag({ 'parts-crate': 1, 'super-potion': 1, potion: 1 }, RAID_BAG_GRID);

  it('refuses a seat off the container or already taken', () => {
    const packing = bag().layout();
    const crate: GridPieceRef = { kind: 'item', itemId: 'parts-crate', index: 0 };
    expect(canSeat(packing, crate, 5, 0, false)).toBe(false);
    expect(canSeat(packing, crate, -1, 0, false)).toBe(false);
    expect(canSeat(packing, crate, 2, 0, false)).toBe(false);
    expect(seatPiece(packing, crate, 5, 0, false)).toBeNull();
  });

  it('lets a piece be nudged one square onto ground it already covers', () => {
    const packing = bag().layout();
    const crate: GridPieceRef = { kind: 'item', itemId: 'parts-crate', index: 0 };
    expect(canSeat(packing, crate, 0, 1, false)).toBe(true);
  });

  it('turns a 1x2 into a 2x1 where it stands', () => {
    const pack = bag();
    const packing = pack.layout();
    const superPotion: GridPieceRef = { kind: 'item', itemId: 'super-potion', index: 0 };
    const turned = turnPiece(packing, superPotion)!;
    pack.arrange(turned.arrangement);
    const drawn = placementOf(pack.layout(), superPotion)!;
    expect(drawn.rotated).toBe(true);
    expect({ width: drawn.width, height: drawn.height }).toEqual({ width: 2, height: 1 });
  });

  it('never offers to turn a square', () => {
    const packing = bag().layout();
    const crate: GridPieceRef = { kind: 'item', itemId: 'parts-crate', index: 0 };
    expect(turnPiece(packing, crate)).toBeNull();
  });

  it('answers which piece is standing on a square, and cargo before a supply', () => {
    const pack = bag();
    pack.setCargo([CAUGHT_PIDGEY]);
    const packing = pack.layout();
    expect(pieceAt(packing, 0, 0)).toEqual({ kind: 'cargo', cargoId: 'carried-0' });
    expect(pieceAt(packing, 5, 2)).toBeNull();
  });

  it('writes a piece address that reads back as itself', () => {
    for (const ref of [
      { kind: 'item', itemId: 'super-potion', index: 3 },
      { kind: 'cargo', cargoId: 'carried-1' },
    ] as const) {
      expect(parsePieceRef(pieceRefKey(ref))).toEqual(ref);
    }
    expect(parsePieceRef(undefined)).toBeNull();
    expect(parsePieceRef('nonsense')).toBeNull();
  });
});

describe('tidying', () => {
  it('is only ever asked for, never done to a pack on its own', () => {
    const pack = new Bag({ potion: 1, 'super-potion': 1 }, RAID_BAG_GRID);
    const potion: GridPieceRef = { kind: 'item', itemId: 'potion', index: 0 };
    pack.arrange(seatPiece(pack.layout(), potion, 5, 2, false)!);
    pack.add('antidote');
    expect(placementOf(pack.layout(), potion)).toMatchObject({ x: 5, y: 2 });
    pack.tidy();
    expect(placementOf(pack.layout(), potion)!.x).toBeLessThan(5);
  });

  it('reads a packed container back as the seats that made it', () => {
    const packing = packContents({ potion: 2, 'parts-crate': 1 }, RAID_BAG_GRID);
    const arrangement = arrangementOf(packing);
    const again = packContents({ potion: 2, 'parts-crate': 1 }, RAID_BAG_GRID, [], arrangement);
    expect(again.placements).toEqual(packing.placements);
  });

  it('reads a stored layout back and drops whatever is not a seat', () => {
    expect(
      readArrangement({
        items: [
          { itemId: 'potion', x: 5, y: 2, rotated: true },
          { itemId: 'potion', x: 1 },
          { x: 0, y: 0 },
        ],
        cargo: [{ cargoId: 'carried-0', x: 0, y: 0 }],
      }),
    ).toEqual({
      items: [{ itemId: 'potion', x: 5, y: 2, rotated: true }],
      cargo: [{ cargoId: 'carried-0', x: 0, y: 0, rotated: false }],
    });
    expect(readArrangement(null)).toEqual({ items: [], cargo: [] });
  });

  it('says nothing is wrong with a pack that already fits', () => {
    expect(tidyWouldFit({ potion: 1 }, RAID_BAG_GRID)).toBe(false);
    expect(tidyArrangement({ potion: 1 }, RAID_BAG_GRID).items).toHaveLength(1);
  });
});
