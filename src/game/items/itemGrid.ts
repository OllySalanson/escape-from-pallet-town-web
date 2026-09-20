import { getItemById, type ItemFootprint } from './items';

/**
 * The bag is chequered squares, and each item takes a different number of them.
 *
 * What a container *holds* is still `BagContents` - one record of id to
 * quantity - so everything that settles a raid counts items exactly as it did
 * before a grid existed: the wipe ledger, the supply delta and the result
 * screen never learn that a grid exists. The grid is a constraint and a picture
 * of one; it is not a second copy of the inventory waiting to disagree.
 *
 * What a container *looks like* is a `GridArrangement`: a list of seats the
 * player chose. It is an overlay on the contents and never a replacement for
 * them - it can only say where a piece sits, never that a piece is there - so a
 * seat for something no longer carried is simply dropped, and a piece with no
 * seat is packed automatically into whatever is left. That is the rule the
 * whole feature turns on: **a seat the player chose is honoured before anything
 * is packed automatically**, so adding a Potion can never re-shuffle the pack
 * around it. An empty arrangement is the old behaviour exactly.
 *
 * The automatic pack is two passes. First-fit, biggest piece first, no
 * rotation - which is fast, stable and what the containers have always drawn.
 * Only when that leaves something over does `searchSeats` run: an exact
 * backtracking search, rotation allowed, over the pieces first-fit could not
 * seat. The captain's own pack is why - a caught Pokemon, a cable coil, a Super
 * Potion and a Potion leave seven of eighteen squares free in a 6x3 pack and no
 * two adjacent rows anywhere, so a mooring rope was refused with room for it on
 * the board. Three 2x2 blocks in a 6x3 fill two whole rows between them, so the
 * 1x2 Super Potion has to lie down: the case cannot be solved without rotation,
 * which is why rotation is part of the model and not a convenience.
 */

export interface GridSize {
  readonly width: number;
  readonly height: number;
}

/** Where one piece sits, and which way round it is standing. */
export interface GridSeat {
  readonly x: number;
  readonly y: number;
  /** True when the piece is turned a quarter: a 1x2 drawn as a 2x1. */
  readonly rotated: boolean;
}

/** A seat the player chose for one block of a supply. */
export interface ItemSeat extends GridSeat {
  readonly itemId: string;
}

/** A seat the player chose for one piece of cargo. */
export interface CargoSeat extends GridSeat {
  readonly cargoId: string;
}

/**
 * How a player has laid a container out.
 *
 * Blocks of one id are interchangeable - a Potion is a Potion - so supplies are
 * seated by id and in order rather than by identity: the first seat listed for
 * an id takes the first block of it, and a seat with no block left to take is
 * dropped. That is what makes an arrangement survive spending a Potion without
 * the rest of the pack moving.
 */
export interface GridArrangement {
  readonly items: readonly ItemSeat[];
  readonly cargo: readonly CargoSeat[];
}

/** No seats chosen: every piece is packed automatically, as it always was. */
export const EMPTY_ARRANGEMENT: GridArrangement = { items: [], cargo: [] };

/** One packed piece: where it sits and how much of the id it accounts for. */
export interface GridPlacement extends ItemFootprint {
  readonly itemId: string;
  /** How many of `itemId` this one square block holds - one, unless it stacks. */
  readonly quantity: number;
  readonly x: number;
  readonly y: number;
  /** True when it is lying down. `width`/`height` are already the drawn shape. */
  readonly rotated: boolean;
}

/**
 * A piece in a container that is not a supply: a Pokemon being carried home.
 *
 * It is a separate kind rather than a catalogue row because it is not one - a
 * Pokemon has no id, no stack size and no icon in `items.ts`, and inventing one
 * so the packer could count it would put a living thing in the supply ledger
 * that settles a raid. What the packer needs is a rectangle and something to
 * call it, and that is all this is. See `../pokemon/pokemonCargo.ts` for what
 * decides the rectangle.
 */
export interface GridCargo extends ItemFootprint {
  /** Identifies the piece to whoever holds the list it came from. */
  readonly cargoId: string;
  /** What a refusal or a square-count calls it: a species name. */
  readonly name: string;
  /**
   * A picture for the square, when the thing has one. The grid does not care
   * what it is a picture of; the screens that draw a container do, and this is
   * how one code path draws the pack and the secure container alike.
   */
  readonly art?: string;
}

export interface GridCargoPlacement extends GridCargo {
  readonly x: number;
  readonly y: number;
  readonly rotated: boolean;
}

export interface GridPacking {
  readonly size: GridSize;
  readonly placements: readonly GridPlacement[];
  /**
   * The cargo seated in this container, in the order it was seated. It is a
   * list of its own rather than a placement with an empty `itemId`, so every
   * screen that draws supplies keeps working and a screen that draws cargo has
   * to say so.
   */
  readonly cargo: readonly GridCargoPlacement[];
  /** What would not go in, by id and quantity. Empty when everything fits. */
  readonly overflow: readonly { readonly itemId: string; readonly quantity: number }[];
  /** Cargo that would not go in. Empty when everything fits. */
  readonly cargoOverflow: readonly GridCargo[];
  readonly cellsUsed: number;
  readonly cellsTotal: number;
}

export function gridCells(size: GridSize): number {
  return Math.max(0, size.width) * Math.max(0, size.height);
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

/** Whether a piece is a different shape lying down - a square never is. */
export function canRotate(piece: ItemFootprint): boolean {
  return piece.width !== piece.height;
}

/** The shape a piece is drawn as, standing or lying down. */
export function rotatedFootprint(piece: ItemFootprint, rotated: boolean): ItemFootprint {
  return rotated ? { width: piece.height, height: piece.width } : { width: piece.width, height: piece.height };
}

interface Piece extends ItemFootprint {
  readonly itemId: string;
  readonly quantity: number;
}

/**
 * Packs a container's whole contents, honouring the seats the player chose.
 *
 * Pass one seats everything the arrangement names, in the order the arrangement
 * names it, dropping any seat that no longer fits the container or that would
 * land on a piece already seated. Pass two packs whatever is left: big pieces
 * first, then tall ones, then by id, each dropped into the first free square
 * reading left to right and top to bottom. That order is what makes it stable -
 * the same contents always draw the same picture, so a bag does not reshuffle
 * itself under the player when they add a Potion.
 *
 * First-fit is greedy and cannot turn a piece on its side, so on an awkward mix
 * it can report no room where a human with tweezers would find some. When it
 * does, `searchSeats` runs an exact backtracking search with rotation over the
 * pieces it could not seat: the pack never claims room it does not have, and it
 * no longer refuses room it does. Cargo is seated before any supply, and that
 * ordering is the rule rather than an accident of size - what you are carrying
 * home is the thing the raid was for, so the Potions pack around it.
 */
export function packContents(
  contents: Readonly<Record<string, number>>,
  size: GridSize,
  cargo: readonly GridCargo[] = [],
  arrangement: GridArrangement = EMPTY_ARRANGEMENT,
): GridPacking {
  const width = Math.max(0, Math.trunc(size.width));
  const height = Math.max(0, Math.trunc(size.height));
  const occupied: boolean[] = Array.from({ length: width * height }, () => false);
  const placements: GridPlacement[] = [];
  const seatedCargo: GridCargoPlacement[] = [];

  const cargoSeats = seatQueues(arrangement.cargo, (seat) => seat.cargoId);
  const pendingCargo: GridCargo[] = [];
  for (const piece of cargo) {
    const seat = takeSeat(cargoSeats, piece.cargoId, occupied, width, height, piece);
    if (seat) {
      const shape = rotatedFootprint(piece, seat.rotated);
      fill(occupied, width, seat, shape);
      seatedCargo.push({ ...piece, ...shape, x: seat.x, y: seat.y, rotated: seat.rotated });
    } else {
      pendingCargo.push(piece);
    }
  }

  const itemSeats = seatQueues(arrangement.items, (seat) => seat.itemId);
  const pendingItems: Piece[] = [];
  for (const piece of piecesOf(contents)) {
    const seat = takeSeat(itemSeats, piece.itemId, occupied, width, height, piece);
    if (seat) {
      const shape = rotatedFootprint(piece, seat.rotated);
      fill(occupied, width, seat, shape);
      placements.push({ ...piece, ...shape, x: seat.x, y: seat.y, rotated: seat.rotated });
    } else {
      pendingItems.push(piece);
    }
  }

  const rest = seatRemaining(occupied, width, height, pendingCargo, pendingItems);
  const cargoOverflow: GridCargo[] = [];
  pendingCargo.forEach((piece, index) => {
    const seat = rest.cargo[index];
    if (!seat) {
      cargoOverflow.push(piece);
      return;
    }
    const shape = rotatedFootprint(piece, seat.rotated);
    seatedCargo.push({ ...piece, ...shape, x: seat.x, y: seat.y, rotated: seat.rotated });
  });

  const overflow: { itemId: string; quantity: number }[] = [];
  pendingItems.forEach((piece, index) => {
    const seat = rest.items[index];
    if (!seat) {
      const existing = overflow.find((entry) => entry.itemId === piece.itemId);
      if (existing) {
        existing.quantity += piece.quantity;
      } else {
        overflow.push({ itemId: piece.itemId, quantity: piece.quantity });
      }
      return;
    }
    const shape = rotatedFootprint(piece, seat.rotated);
    placements.push({ ...piece, ...shape, x: seat.x, y: seat.y, rotated: seat.rotated });
  });

  return {
    size: { width, height },
    placements,
    cargo: seatedCargo,
    overflow,
    cargoOverflow,
    cellsUsed: rest.occupied.filter(Boolean).length,
    cellsTotal: width * height,
  };
}

/** Whether a whole set of contents, and any cargo, goes into a container. */
export function fitsInGrid(
  contents: Readonly<Record<string, number>>,
  size: GridSize,
  cargo: readonly GridCargo[] = [],
  arrangement: GridArrangement = EMPTY_ARRANGEMENT,
): boolean {
  const packing = packContents(contents, size, cargo, arrangement);
  return packing.overflow.length === 0 && packing.cargoOverflow.length === 0;
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
  cargo: readonly GridCargo[] = [],
  arrangement: GridArrangement = EMPTY_ARRANGEMENT,
): number {
  let room = 0;
  const trial: Record<string, number> = { ...contents };
  while (room < limit) {
    trial[itemId] = (trial[itemId] ?? 0) + 1;
    if (!fitsInGrid(trial, size, cargo, arrangement)) {
      return room;
    }
    room += 1;
  }
  return room;
}

/** The squares one piece of cargo takes up, whether or not they are free. */
export function cargoCells(piece: ItemFootprint): number {
  return piece.width * piece.height;
}

/**
 * A packed container read back as the seats that made it.
 *
 * This is what freezes a layout: the moment the player moves one piece, every
 * other piece is written down where it already stood, so nothing else shifts
 * under the one they moved.
 */
export function arrangementOf(packing: GridPacking): GridArrangement {
  return {
    items: packing.placements.map((placement) => ({
      itemId: placement.itemId,
      x: placement.x,
      y: placement.y,
      rotated: placement.rotated,
    })),
    cargo: packing.cargo.map((placement) => ({
      cargoId: placement.cargoId,
      x: placement.x,
      y: placement.y,
      rotated: placement.rotated,
    })),
  };
}

/**
 * The tidiest seating of a container: everything packed from scratch, rotation
 * allowed where first-fit cannot manage without it.
 *
 * It is what the TIDY control does, and it is deliberately not what happens on
 * its own: an auto-tidy that undoes a player's arranging is worse than no
 * arranging at all.
 */
export function tidyArrangement(
  contents: Readonly<Record<string, number>>,
  size: GridSize,
  cargo: readonly GridCargo[] = [],
): GridArrangement {
  return arrangementOf(packContents(contents, size, cargo));
}

/**
 * Whether a tidy would seat what the container as it stands will not.
 *
 * It is the difference between "there is no room" and "there is no room *the
 * way you have packed it*", and a refusal that cannot tell those apart is the
 * refusal the captain met: seven squares free and a four-square find turned
 * away with nothing said about why.
 */
export function tidyWouldFit(
  contents: Readonly<Record<string, number>>,
  size: GridSize,
  cargo: readonly GridCargo[] = [],
  arrangement: GridArrangement = EMPTY_ARRANGEMENT,
): boolean {
  return !fitsInGrid(contents, size, cargo, arrangement) && fitsInGrid(contents, size, cargo);
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

function seatQueues<T extends GridSeat>(
  seats: readonly T[],
  keyOf: (seat: T) => string,
): Map<string, T[]> {
  const queues = new Map<string, T[]>();
  for (const seat of seats) {
    const key = keyOf(seat);
    const queue = queues.get(key);
    if (queue) {
      queue.push(seat);
    } else {
      queues.set(key, [seat]);
    }
  }
  return queues;
}

/**
 * The first seat this queue offers that the container can honour.
 *
 * A seat is dropped rather than shuffled when it has stopped working - the
 * container shrank under it, or a piece seated earlier is standing there - so
 * the piece falls through to the automatic pack instead of displacing anything.
 */
function takeSeat<T extends GridSeat>(
  queues: Map<string, T[]>,
  key: string,
  occupied: readonly boolean[],
  width: number,
  height: number,
  piece: ItemFootprint,
): GridSeat | null {
  const queue = queues.get(key);
  while (queue && queue.length > 0) {
    const seat = queue.shift()!;
    const shape = rotatedFootprint(piece, seat.rotated);
    if (
      Number.isInteger(seat.x) &&
      Number.isInteger(seat.y) &&
      seat.x >= 0 &&
      seat.y >= 0 &&
      seat.x + shape.width <= width &&
      seat.y + shape.height <= height &&
      isClear(occupied, width, seat.x, seat.y, shape)
    ) {
      return seat;
    }
  }
  return null;
}

/**
 * Seats everything the arrangement left over, first-fit and then - only if that
 * turned something away - by exact search with rotation.
 */
function seatRemaining(
  occupied: readonly boolean[],
  width: number,
  height: number,
  cargo: readonly GridCargo[],
  items: readonly Piece[],
): {
  readonly cargo: readonly (GridSeat | null)[];
  readonly items: readonly (GridSeat | null)[];
  readonly occupied: readonly boolean[];
} {
  const greedyGrid = [...occupied];
  const cargoSeats: (GridSeat | null)[] = [];
  const itemSeats: (GridSeat | null)[] = [];
  let turnedAway = false;
  for (const piece of cargo) {
    const seat = firstFreeSeat(greedyGrid, width, height, piece);
    cargoSeats.push(seat);
    if (seat) {
      fill(greedyGrid, width, seat, piece);
    } else {
      turnedAway = true;
    }
  }
  for (const piece of items) {
    const seat = firstFreeSeat(greedyGrid, width, height, piece);
    itemSeats.push(seat);
    if (seat) {
      fill(greedyGrid, width, seat, piece);
    } else {
      turnedAway = true;
    }
  }
  if (!turnedAway) {
    return { cargo: cargoSeats, items: itemSeats, occupied: greedyGrid };
  }

  const rects = [...cargo, ...items].map((piece) => ({
    width: piece.width,
    height: piece.height,
    rotatable: canRotate(piece),
  }));
  const found = searchSeats(occupied, width, height, rects);
  if (!found) {
    return { cargo: cargoSeats, items: itemSeats, occupied: greedyGrid };
  }
  const searchGrid = [...occupied];
  found.forEach((seat, index) => {
    const piece = rects[index];
    fill(searchGrid, width, seat, rotatedFootprint(piece, seat.rotated));
  });
  return {
    cargo: found.slice(0, cargo.length),
    items: found.slice(cargo.length),
    occupied: searchGrid,
  };
}

interface SearchRect {
  readonly width: number;
  readonly height: number;
  readonly rotatable: boolean;
}

/**
 * How far the exact search is allowed to go.
 *
 * It only ever runs when first-fit has already turned something away, so its
 * cost is paid on the awkward mixes and nowhere else. The container limit keeps
 * it off the vault, which has no size and can hold hundreds of pieces; the node
 * budget is the promise that a pathological mix cannot hang a frame. Running
 * out of either is answered by keeping first-fit's verdict, which errs towards
 * "full" - the safe direction, because the pack never claims room it lacks.
 */
const SEARCH_CELL_LIMIT = 64;
const SEARCH_PIECE_LIMIT = 24;
const SEARCH_NODE_BUDGET = 40000;

/**
 * Seats every rectangle or reports that no seating exists.
 *
 * Biggest first, every orientation and every free square tried, failures
 * remembered by (piece, occupancy) so the same dead end is not walked twice.
 * Exhaustive within its budget, which is what lets a refusal mean "a human
 * could not fit this either".
 */
function searchSeats(
  occupied: readonly boolean[],
  width: number,
  height: number,
  rects: readonly SearchRect[],
): (GridSeat)[] | null {
  const cells = width * height;
  if (cells === 0 || cells > SEARCH_CELL_LIMIT || rects.length === 0 || rects.length > SEARCH_PIECE_LIMIT) {
    return null;
  }
  const order = rects
    .map((_, index) => index)
    .sort(
      (a, b) =>
        rects[b].width * rects[b].height - rects[a].width * rects[a].height || a - b,
    );
  const remainingArea: number[] = Array.from({ length: order.length + 1 }, () => 0);
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const rect = rects[order[index]];
    remainingArea[index] = remainingArea[index + 1] + rect.width * rect.height;
  }
  const grid = [...occupied];
  const seats: (GridSeat | null)[] = Array.from({ length: rects.length }, () => null);
  const deadEnds = new Set<string>();
  let nodes = 0;
  let aborted = false;

  const freeCells = (): number => grid.reduce((count, cell) => (cell ? count : count + 1), 0);

  const step = (at: number): boolean => {
    if (at >= order.length) {
      return true;
    }
    if (aborted) {
      return false;
    }
    nodes += 1;
    if (nodes > SEARCH_NODE_BUDGET) {
      aborted = true;
      return false;
    }
    if (remainingArea[at] > freeCells()) {
      return false;
    }
    const key = `${at}|${grid.map((cell) => (cell ? '1' : '0')).join('')}`;
    if (deadEnds.has(key)) {
      return false;
    }
    const rect = rects[order[at]];
    const orientations =
      rect.rotatable && rect.width !== rect.height ? [false, true] : [false];
    for (const rotated of orientations) {
      const shape = rotatedFootprint(rect, rotated);
      for (let y = 0; y + shape.height <= height; y += 1) {
        for (let x = 0; x + shape.width <= width; x += 1) {
          if (!isClear(grid, width, x, y, shape)) {
            continue;
          }
          fill(grid, width, { x, y }, shape);
          seats[order[at]] = { x, y, rotated };
          if (step(at + 1)) {
            return true;
          }
          clear(grid, width, { x, y }, shape);
          seats[order[at]] = null;
          if (aborted) {
            return false;
          }
        }
      }
    }
    deadEnds.add(key);
    return false;
  };

  return step(0) ? (seats as GridSeat[]) : null;
}

function fill(
  occupied: boolean[],
  width: number,
  seat: { readonly x: number; readonly y: number },
  piece: ItemFootprint,
): void {
  for (let dy = 0; dy < piece.height; dy += 1) {
    for (let dx = 0; dx < piece.width; dx += 1) {
      occupied[(seat.y + dy) * width + seat.x + dx] = true;
    }
  }
}

function clear(
  occupied: boolean[],
  width: number,
  seat: { readonly x: number; readonly y: number },
  piece: ItemFootprint,
): void {
  for (let dy = 0; dy < piece.height; dy += 1) {
    for (let dx = 0; dx < piece.width; dx += 1) {
      occupied[(seat.y + dy) * width + seat.x + dx] = false;
    }
  }
}

function firstFreeSeat(
  occupied: readonly boolean[],
  width: number,
  height: number,
  piece: ItemFootprint,
): GridSeat | null {
  for (let y = 0; y + piece.height <= height; y += 1) {
    for (let x = 0; x + piece.width <= width; x += 1) {
      if (isClear(occupied, width, x, y, piece)) {
        return { x, y, rotated: false };
      }
    }
  }
  return null;
}

/** Whether a rectangle standing at `x,y` would land on nothing already seated. */
export function isClear(
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
