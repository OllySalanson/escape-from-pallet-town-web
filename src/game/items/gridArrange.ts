import {
  arrangementOf,
  canRotate,
  isClear,
  rotatedFootprint,
  type GridArrangement,
  type GridCargoPlacement,
  type GridPacking,
  type GridPlacement,
  type GridSeat,
} from './itemGrid';
import { currentItemId } from './items';

/**
 * Moving a piece by hand: the rules, with no screen in them.
 *
 * Every one of these is asked of a *packed* container rather than of an
 * arrangement, because what the player is pointing at is what is drawn, and
 * what is drawn includes everything the automatic pack seated. Picking a piece
 * up therefore freezes the whole layout first (`arrangementOf`), so the one
 * thing that moves is the thing the player moved - the promise the whole
 * feature turns on, and the one an auto-tidy would break.
 *
 * A move is committed by returning a new `GridArrangement`, never by mutating
 * one: the caller re-packs with it and sees where everything landed, which is
 * also the check that the move was legal. Nothing here knows about a pointer, a
 * key or a pixel.
 */

/** One piece of a container, addressed the way a screen points at one. */
export type GridPieceRef =
  | { readonly kind: 'item'; readonly itemId: string; readonly index: number }
  | { readonly kind: 'cargo'; readonly cargoId: string };

/** A piece's address as one attribute value, so markup can carry it. */
export function pieceRefKey(ref: GridPieceRef): string {
  return ref.kind === 'cargo' ? `cargo:${ref.cargoId}` : `item:${ref.index}:${ref.itemId}`;
}

/** Reads back what `pieceRefKey` wrote. Null for anything it did not write. */
export function parsePieceRef(key: string | undefined): GridPieceRef | null {
  if (!key) {
    return null;
  }
  if (key.startsWith('cargo:')) {
    return { kind: 'cargo', cargoId: key.slice('cargo:'.length) };
  }
  const match = /^item:(\d+):(.+)$/.exec(key);
  return match ? { kind: 'item', itemId: match[2], index: Number(match[1]) } : null;
}

/**
 * How a screen names the block it is drawing.
 *
 * A supply block is addressed by its id and its ordinal among that id's blocks,
 * because two Potions are the same Potion and nothing else distinguishes them.
 * The ordinal is the order the packing lists them in - which depends on the
 * contents and not on where anything sits, so it survives a piece being moved -
 * and it is why every caller re-reads the packing rather than keeping a
 * reference across a change.
 */
export function itemRefAt(packing: GridPacking, index: number): GridPieceRef {
  const itemId = packing.placements[index].itemId;
  let ordinal = 0;
  for (let at = 0; at < index; at += 1) {
    if (packing.placements[at].itemId === itemId) {
      ordinal += 1;
    }
  }
  return { kind: 'item', itemId, index: ordinal };
}

/** The block a ref is about, as the packing drew it. */
export function placementOf(
  packing: GridPacking,
  ref: GridPieceRef,
): GridPlacement | GridCargoPlacement | null {
  if (ref.kind === 'cargo') {
    return packing.cargo.find((piece) => piece.cargoId === ref.cargoId) ?? null;
  }
  let seen = 0;
  for (const placement of packing.placements) {
    if (placement.itemId !== ref.itemId) {
      continue;
    }
    if (seen === ref.index) {
      return placement;
    }
    seen += 1;
  }
  return null;
}

/** Whichever piece is standing on one square, cargo first. Null for bare ground. */
export function pieceAt(packing: GridPacking, x: number, y: number): GridPieceRef | null {
  for (const piece of packing.cargo) {
    if (covers(piece, x, y)) {
      return { kind: 'cargo', cargoId: piece.cargoId };
    }
  }
  const counts = new Map<string, number>();
  for (const placement of packing.placements) {
    const index = counts.get(placement.itemId) ?? 0;
    counts.set(placement.itemId, index + 1);
    if (covers(placement, x, y)) {
      return { kind: 'item', itemId: placement.itemId, index };
    }
  }
  return null;
}

function covers(
  placement: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
): boolean {
  return (
    x >= placement.x &&
    y >= placement.y &&
    x < placement.x + placement.width &&
    y < placement.y + placement.height
  );
}

/** The shape a piece would be, standing or lying down, whatever it is now. */
export function shapeOf(
  packing: GridPacking,
  ref: GridPieceRef,
  rotated: boolean,
): { readonly width: number; readonly height: number } | null {
  const placement = placementOf(packing, ref);
  if (!placement) {
    return null;
  }
  // A placement is already drawn rotated, so its upright shape is read back off
  // it rather than from the catalogue - which is what lets cargo, whose shape
  // has no catalogue row at all, be turned by exactly the same rule.
  const upright = placement.rotated
    ? { width: placement.height, height: placement.width }
    : { width: placement.width, height: placement.height };
  return rotatedFootprint(upright, rotated);
}

/**
 * Whether a piece would sit at `x,y` without landing on anything else.
 *
 * Its own squares are cleared first, so nudging a 2x2 one column along is a
 * legal move rather than a collision with itself.
 */
export function canSeat(
  packing: GridPacking,
  ref: GridPieceRef,
  x: number,
  y: number,
  rotated: boolean,
): boolean {
  const shape = shapeOf(packing, ref, rotated);
  if (!shape) {
    return false;
  }
  const { width, height } = packing.size;
  if (x < 0 || y < 0 || x + shape.width > width || y + shape.height > height) {
    return false;
  }
  return isClear(occupancyWithout(packing, ref), width, x, y, shape);
}

/**
 * The arrangement that results from seating one piece at `x,y`.
 *
 * Null when the seat is off the container or already taken - a refusal the
 * screen turns into the red square under the piece rather than into a message,
 * because the answer is visible before the player lets go.
 */
export function seatPiece(
  packing: GridPacking,
  ref: GridPieceRef,
  x: number,
  y: number,
  rotated: boolean,
): GridArrangement | null {
  if (!canSeat(packing, ref, x, y, rotated)) {
    return null;
  }
  return withSeat(arrangementOf(packing), ref, { x, y, rotated });
}

/**
 * Turning a piece where it stands.
 *
 * The anchor is tried first, then every seat inside the piece's own footprint,
 * so a Super Potion at the foot of a column turns into the row beside it rather
 * than refusing because its top-left corner has nowhere to go. Null only when
 * the piece genuinely has no room to lie down anywhere it already covers.
 */
export function turnPiece(
  packing: GridPacking,
  ref: GridPieceRef,
): { readonly arrangement: GridArrangement; readonly seat: GridSeat } | null {
  const placement = placementOf(packing, ref);
  if (!placement || !canRotate(placement)) {
    return null;
  }
  const rotated = !placement.rotated;
  const shape = shapeOf(packing, ref, rotated);
  if (!shape) {
    return null;
  }
  for (const seat of nudgesAround(placement, shape)) {
    const arrangement = seatPiece(packing, ref, seat.x, seat.y, rotated);
    if (arrangement) {
      return { arrangement, seat: { ...seat, rotated } };
    }
  }
  return null;
}

/** The anchor, then the seats that still overlap where the piece was standing. */
function nudgesAround(
  placement: { x: number; y: number; width: number; height: number },
  shape: { width: number; height: number },
): readonly { readonly x: number; readonly y: number }[] {
  const seats: { x: number; y: number }[] = [{ x: placement.x, y: placement.y }];
  for (let dy = -(shape.height - 1); dy <= placement.height - 1; dy += 1) {
    for (let dx = -(shape.width - 1); dx <= placement.width - 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      seats.push({ x: placement.x + dx, y: placement.y + dy });
    }
  }
  return seats;
}

/** Replaces one piece's seat in an arrangement, leaving every other alone. */
function withSeat(
  arrangement: GridArrangement,
  ref: GridPieceRef,
  seat: GridSeat,
): GridArrangement {
  if (ref.kind === 'cargo') {
    return {
      items: arrangement.items,
      cargo: arrangement.cargo.map((entry) =>
        entry.cargoId === ref.cargoId ? { ...entry, ...seat } : entry,
      ),
    };
  }
  // `arrangementOf` lists item seats in the packing's own order, so the ref's
  // ordinal picks out the same block here that it picks out on screen.
  let seen = -1;
  return {
    cargo: arrangement.cargo,
    items: arrangement.items.map((entry) => {
      if (entry.itemId !== ref.itemId) {
        return entry;
      }
      seen += 1;
      return seen === ref.index ? { ...entry, ...seat } : entry;
    }),
  };
}

/** Every square the container has, with one piece's own squares given back. */
function occupancyWithout(packing: GridPacking, ref: GridPieceRef): boolean[] {
  const { width, height } = packing.size;
  const occupied = new Array<boolean>(width * height).fill(false);
  const mark = (
    placement: { x: number; y: number; width: number; height: number },
  ): void => {
    for (let dy = 0; dy < placement.height; dy += 1) {
      for (let dx = 0; dx < placement.width; dx += 1) {
        occupied[(placement.y + dy) * width + placement.x + dx] = true;
      }
    }
  };
  const held = placementOf(packing, ref);
  for (const piece of packing.cargo) {
    if (piece !== held) {
      mark(piece);
    }
  }
  for (const placement of packing.placements) {
    if (placement !== held) {
      mark(placement);
    }
  }
  return occupied;
}


/**
 * An arrangement read back off a save, with every seat that is not one dropped.
 *
 * A layout is stored because the captain asked for one that comes back the way
 * he left it (2026-09-20), and it is stored as *seats* rather than as a grid
 * for the same reason everything else in this save is a list of ids: a blob can
 * disagree with the contents it describes, and a list of seats cannot - the
 * packer drops a seat that no longer works and packs what is left. Absent on
 * every save written before it, which reads as a container nobody has arranged.
 */
export function readArrangement(value: unknown): GridArrangement {
  if (typeof value !== 'object' || value === null) {
    return { items: [], cargo: [] };
  }
  const record = value as Record<string, unknown>;
  const seat = (entry: unknown): GridSeat | null => {
    if (typeof entry !== 'object' || entry === null) {
      return null;
    }
    const row = entry as Record<string, unknown>;
    return Number.isSafeInteger(row.x) &&
      Number.isSafeInteger(row.y) &&
      (row.x as number) >= 0 &&
      (row.y as number) >= 0
      ? { x: row.x as number, y: row.y as number, rotated: row.rotated === true }
      : null;
  };
  const items = Array.isArray(record.items)
    ? record.items.flatMap((entry) => {
        const where = seat(entry);
        const itemId = (entry as Record<string, unknown>)?.itemId;
        return where && typeof itemId === 'string' ? [{ ...where, itemId: currentItemId(itemId) }] : [];
      })
    : [];
  const cargo = Array.isArray(record.cargo)
    ? record.cargo.flatMap((entry) => {
        const where = seat(entry);
        const cargoId = (entry as Record<string, unknown>)?.cargoId;
        return where && typeof cargoId === 'string' ? [{ ...where, cargoId }] : [];
      })
    : [];
  return { items, cargo };
}
