import { getItemById, type ItemFootprint } from './items';

/**
 * The bag is chequered squares, and each item takes a different number of them.
 *
 * That is the whole of it, and it is deliberately the whole of it. What a
 * container holds is still `BagContents` - one record of id to quantity - and
 * where each piece *sits* is derived here, every time it is asked for, from
 * nothing but those contents and the container's size. No coordinate is stored,
 * passed between scenes or written to a save, so the wipe ledger, the supply
 * delta and the result screen all keep counting items and never learn that a
 * grid exists. The grid is a constraint and a picture of one; it is not a second
 * copy of the inventory waiting to disagree with the first.
 *
 * The other half of that decision is that the player never places anything.
 * Manual placement would need stored coordinates and a cursor that drags, and on
 * a 320x240 stage that is mouse Tetris - slower than the list it replaced, which
 * would lose the packing decision rather than sharpen it. The decision this is
 * built to create is *what to carry*, which is exactly the one a Tarkov player
 * makes over a crate: the auto-pack answers "does it fit", the player answers
 * "then what comes out".
 */

export interface GridSize {
  readonly width: number;
  readonly height: number;
}

/** One packed piece: where it sits and how much of the id it accounts for. */
export interface GridPlacement extends ItemFootprint {
  readonly itemId: string;
  /** How many of `itemId` this one square block holds - one, unless it stacks. */
  readonly quantity: number;
  readonly x: number;
  readonly y: number;
}

export interface GridPacking {
  readonly size: GridSize;
  readonly placements: readonly GridPlacement[];
  /** What would not go in, by id and quantity. Empty when everything fits. */
  readonly overflow: readonly { readonly itemId: string; readonly quantity: number }[];
  readonly cellsUsed: number;
  readonly cellsTotal: number;
}

export function gridCells(size: GridSize): number {
  return Math.max(0, size.width) * Math.max(0, size.height);
}

/** A container one row taller, for the rungs that grow one. */
export function growGridRows(size: GridSize, rows: number): GridSize {
  return { width: size.width, height: size.height + Math.max(0, rows) };
}

/** A container one column wider. */
export function growGridColumns(size: GridSize, columns: number): GridSize {
  return { width: size.width + Math.max(0, columns), height: size.height };
}

/** The squares one of `itemId` takes; an id the catalogue does not know takes one. */
export function footprintOf(itemId: string): ItemFootprint {
  return getItemById(itemId)?.footprint ?? { width: 1, height: 1 };
}

/** How many of one id share a single square block. One unless the item says so. */
export function stackSizeOf(itemId: string): number {
  return Math.max(1, getItemById(itemId)?.stackSize ?? 1);
}

/** How many square blocks a quantity of one id is packed as. */
export function blocksFor(itemId: string, quantity: number): number {
  return quantity <= 0 ? 0 : Math.ceil(quantity / stackSizeOf(itemId));
}

/** The squares a quantity of one id takes up, ignoring whether they are free. */
export function cellsFor(itemId: string, quantity: number): number {
  const footprint = footprintOf(itemId);
  return blocksFor(itemId, quantity) * footprint.width * footprint.height;
}

interface Piece extends ItemFootprint {
  readonly itemId: string;
  readonly quantity: number;
}

/**
 * Packs a container's whole contents.
 *
 * Big pieces first, then tall ones, then by id, and each is dropped into the
 * first free square reading left to right and top to bottom. That order is what
 * makes it stable: the same contents always draw the same picture, so a bag does
 * not reshuffle itself under the player when they add a Potion.
 *
 * It is greedy, so on a truly awkward mix it can report no room where a human
 * with tweezers would find some. Every footprint in the catalogue is at most two
 * squares on a side and every container is an even number of squares wide, which
 * is the case greedy packs perfectly - and erring towards "full" is the safe
 * direction anyway: the pack never claims room it does not have.
 */
export function packContents(contents: Readonly<Record<string, number>>, size: GridSize): GridPacking {
  const width = Math.max(0, Math.trunc(size.width));
  const height = Math.max(0, Math.trunc(size.height));
  const occupied: boolean[] = Array.from({ length: width * height }, () => false);
  const placements: GridPlacement[] = [];
  const overflow: { itemId: string; quantity: number }[] = [];

  for (const piece of piecesOf(contents)) {
    const seat = firstFreeSeat(occupied, width, height, piece);
    if (!seat) {
      const existing = overflow.find((entry) => entry.itemId === piece.itemId);
      if (existing) {
        existing.quantity += piece.quantity;
      } else {
        overflow.push({ itemId: piece.itemId, quantity: piece.quantity });
      }
      continue;
    }
    for (let dy = 0; dy < piece.height; dy += 1) {
      for (let dx = 0; dx < piece.width; dx += 1) {
        occupied[(seat.y + dy) * width + seat.x + dx] = true;
      }
    }
    placements.push({ ...piece, x: seat.x, y: seat.y });
  }

  return {
    size: { width, height },
    placements,
    overflow,
    cellsUsed: occupied.filter(Boolean).length,
    cellsTotal: width * height,
  };
}

/** Whether a whole set of contents goes into a container of this size. */
export function fitsInGrid(contents: Readonly<Record<string, number>>, size: GridSize): boolean {
  return packContents(contents, size).overflow.length === 0;
}

/**
 * How many more of one id a container holding `contents` would take.
 *
 * Asked rather than assumed, because a square counted free is not the same as a
 * square a parts crate can stand on: the answer for a 2x2 in a bag with four
 * scattered singles left is none.
 */
export function roomFor(
  contents: Readonly<Record<string, number>>,
  size: GridSize,
  itemId: string,
  limit = 99,
): number {
  let room = 0;
  const trial: Record<string, number> = { ...contents };
  while (room < limit) {
    trial[itemId] = (trial[itemId] ?? 0) + 1;
    if (!fitsInGrid(trial, size)) {
      return room;
    }
    room += 1;
  }
  return room;
}

/** The pieces of a set of contents, in the order they are seated. */
function piecesOf(contents: Readonly<Record<string, number>>): readonly Piece[] {
  const pieces: Piece[] = [];
  for (const [itemId, quantity] of Object.entries(contents)) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      continue;
    }
    const footprint = footprintOf(itemId);
    const stackSize = stackSizeOf(itemId);
    let remaining = quantity;
    while (remaining > 0) {
      const held = Math.min(stackSize, remaining);
      pieces.push({ itemId, quantity: held, width: footprint.width, height: footprint.height });
      remaining -= held;
    }
  }
  return pieces.sort(
    (a, b) =>
      b.width * b.height - a.width * a.height ||
      b.height - a.height ||
      b.width - a.width ||
      a.itemId.localeCompare(b.itemId),
  );
}

function firstFreeSeat(
  occupied: readonly boolean[],
  width: number,
  height: number,
  piece: ItemFootprint,
): { readonly x: number; readonly y: number } | null {
  for (let y = 0; y + piece.height <= height; y += 1) {
    for (let x = 0; x + piece.width <= width; x += 1) {
      if (isClear(occupied, width, x, y, piece)) {
        return { x, y };
      }
    }
  }
  return null;
}

function isClear(
  occupied: readonly boolean[],
  width: number,
  x: number,
  y: number,
  piece: ItemFootprint,
): boolean {
  for (let dy = 0; dy < piece.height; dy += 1) {
    for (let dx = 0; dx < piece.width; dx += 1) {
      if (occupied[(y + dy) * width + x + dx]) {
        return false;
      }
    }
  }
  return true;
}
