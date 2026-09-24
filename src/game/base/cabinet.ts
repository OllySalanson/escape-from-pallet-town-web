import type { Direction, GridPosition } from '../movement/gridMovement';
import { cabinetDayLabel, type Oddity } from '../hub/traderCabinet';

/**
 * Bill's cabinet of oddities: where everything the player has ever bartered to
 * him stands, one thing a unit handed over, in the order it went across.
 *
 * Bill is the collector who trades oddity for oddity, so what he takes turns up
 * on a shelf in his cottage - the mooring rope, the radio valve - and over weeks
 * the cabinet fills with the player's own history (`../hub/traderCabinet.ts` is
 * the book it is read from). It is the captain's rule for the whole base: a
 * thing in a room rather than a line in a ledger.
 *
 * Three things were designed rather than fell out:
 *
 * - **An oddity is drawn at the scale of the shelf it stands on.** The shelf
 *   units are FireRed's own, with their books taken out (`lab.shelvesEmpty`),
 *   and a FireRed book is two pixels by four. A 16px item icon on that shelf
 *   would be a crate the size of the cabinet, so every oddity has a miniature
 *   of its own, four pixels tall, drawn here as a pixel table (the way the
 *   player's ground ring is, `../world/characterPresentation.ts`) and told
 *   apart by silhouette and by the colours its full-size icon already uses.
 * - **Nothing moves once it is on a shelf.** The nth thing ever traded stands
 *   in the nth seat for good, so the first rope you gave him is where it was
 *   the last time you looked. The cabinet fills a unit at a time, west first;
 *   when the two units by the desk are full a second pair is brought in below
 *   them, and when those are full Bill packs what comes next into crates
 *   stacked behind the first - a crate appearing is the room still filling,
 *   and the crates say what is in them.
 * - **It is read one thing at a time, never all at once.** A caption over
 *   every oddity would bury the room it is in, so nothing on a shelf speaks
 *   until it is asked: point at it, or face the cabinet and press the interact
 *   key and walk the arrow keys along the shelves (`nextOddity`). One label is
 *   ever up, and it says what the thing is and what it went for and when.
 *
 * Everything here is derived from the book and from nothing else, so the room
 * and the save can never disagree.
 */

// --- the miniatures -----------------------------------------------------------

/** How tall every miniature is: the lower shelf is four pixels between its planks. */
export const ODDITY_HEIGHT = 4;

/**
 * The colours the miniatures are drawn in, taken from the full-size material
 * icons (`scripts/draw-material-icons.mjs`) so a thing on the shelf is the
 * colour it is in the pack.
 */
export const ODDITY_INK: Readonly<Record<string, number>> = {
  // glass, filament
  L: 0xcdeef5,
  G: 0x7fb4c6,
  c: 0xf2a03d,
  // brass, wood
  B: 0xb98a4e,
  b: 0x8a6234,
  W: 0xd8b070,
  // flame, amber
  A: 0xf7d36b,
  a: 0xe8a33a,
  // steel
  s: 0x7d8794,
  S: 0xb9c2cc,
  // copper
  m: 0xa4552a,
  M: 0xe08a4d,
  n: 0xf2b884,
  // rope
  Q: 0xd9bd8a,
  q: 0x9c7b4e,
  // linen
  l: 0xf4efe2,
  i: 0xc9c1ad,
  v: 0x5b8fd6,
};

/**
 * Each thing Bill takes, as rows of `ODDITY_INK` keys with `.` for nothing,
 * four rows tall and no more than five wide. `curio` is anything his book
 * names that has no miniature of its own, so a barter that one day asks for
 * something new still puts a thing on the shelf.
 */
export const ODDITY_ART: Readonly<Record<string, readonly string[]>> = {
  // A valve standing on its brass base, the filament lit.
  'radio-valve': ['.L.', 'GcG', 'GcG', 'BbB'],
  // A spool of copper wire between two steel cheeks.
  'cable-coil': ['SnnnS', 'sMMMs', 'sMMMs', 'smmms'],
  // A wooden crate with the top of a gear showing over its lid.
  'parts-crate': ['.sSs.', 'WWWWW', 'BbBbB', 'bbbbb'],
  // An oil lamp, lit.
  'lamp-oil': ['.A.', 'BaB', 'BaB', 'bbb'],
  // A coil of rope, lying flat and seen from the side.
  'mooring-rope': ['.QQQ.', 'Qq.qQ', 'Qq.qQ', '.qqq.'],
  // A bolt of linen on its side, with its blue selvedge showing.
  'linen-roll': ['lllli', 'lllli', 'vvvvi', 'iiiii'],
  curio: ['.S.', 'sSs', 'sSs', 'sss'],
};

/** The art an item stands on the shelf as. */
export function oddityArt(itemId: string): readonly string[] {
  return ODDITY_ART[itemId] ?? ODDITY_ART.curio;
}

// --- where things stand -----------------------------------------------------

/**
 * The shelf units, in the order they fill, as the tile each stands at. Every
 * unit is `lab.shelvesEmpty`, five tiles by two. The first two stand either
 * side of Bill's desk from the start, empty, so the cabinet visibly begins at
 * nothing; the second pair is carried in beneath them when the first is full.
 */
export const CABINET_UNITS: readonly GridPosition[] = [
  { x: 1, y: 5 },
  { x: 9, y: 5 },
  { x: 1, y: 8 },
  { x: 9, y: 8 },
];
export const CABINET_UNIT_SIZE = { width: 5, height: 2 } as const;
/** How many units stand before anything is traded. */
export const CABINET_UNITS_AT_START = 2;

/**
 * The two shelves inside a unit, by the pixel row of the plank a thing stands
 * on, measured off the cut (`scripts/cut-frlg-base.mjs` paints the books out of
 * rows 6-9 and 12-15, and the planks are the rows under those).
 */
const SHELF_PLANK_ROWS = [10, 16] as const;
/** Seats along one shelf, and the pixel pitch between them. */
export const SEATS_PER_SHELF = 12;
const SEAT_PITCH = 6;
/** The first seat's left edge: the shelf's dark back runs from pixel 2 to 77. */
const FIRST_SEAT_X = 4;
export const SEATS_PER_UNIT = SEATS_PER_SHELF * SHELF_PLANK_ROWS.length;
export const SHELF_SEATS = SEATS_PER_UNIT * CABINET_UNITS.length;

/**
 * Where the crates go once every shelf is full: behind the first two units, in
 * the row between them and the cell separators, west side first.
 */
export const CABINET_CRATES: readonly GridPosition[] = [
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
  { x: 5, y: 4 },
  { x: 13, y: 4 },
  { x: 12, y: 4 },
  { x: 11, y: 4 },
  { x: 10, y: 4 },
  { x: 9, y: 4 },
];
/** What a crate holds before the next one is brought. The last one holds whatever is left. */
export const ODDITIES_PER_CRATE = 12;

/** One oddity where it stands, in room pixels. */
export interface PlacedOddity {
  /** Its place in the book: the nth thing ever traded. */
  readonly index: number;
  readonly oddity: Oddity;
  readonly unit: number;
  /**
   * Which run of shelf it is on, top of the room first: the upper and lower
   * shelves of the first pair of units, then of the second. A run carries on
   * from a west unit into the east one beside it, which is what the arrow keys
   * walk along.
   */
  readonly run: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A crate stacked behind the cabinet, and which of the book's oddities are in it. */
export interface CabinetCrate {
  readonly tile: GridPosition;
  readonly from: number;
  readonly count: number;
}

export interface CabinetLayout {
  /** How many of `CABINET_UNITS` are standing. */
  readonly units: number;
  readonly placed: readonly PlacedOddity[];
  readonly crates: readonly CabinetCrate[];
}

/** Where everything in the book stands. The nth oddity is always in the nth seat. */
export function cabinetLayout(oddities: readonly Oddity[], tileSize: number): CabinetLayout {
  const onShelves = oddities.slice(0, SHELF_SEATS);
  const placed = onShelves.map((oddity, index): PlacedOddity => {
    const unit = Math.floor(index / SEATS_PER_UNIT);
    const shelf = Math.floor((index % SEATS_PER_UNIT) / SEATS_PER_SHELF);
    const seat = index % SEATS_PER_SHELF;
    const art = oddityArt(oddity.itemId);
    const width = art[0].length;
    const at = CABINET_UNITS[unit];
    return {
      index,
      oddity,
      unit,
      run: Math.floor(unit / 2) * SHELF_PLANK_ROWS.length + shelf,
      x: at.x * tileSize + FIRST_SEAT_X + seat * SEAT_PITCH + Math.floor((SEAT_PITCH - width) / 2),
      y: at.y * tileSize + SHELF_PLANK_ROWS[shelf] - ODDITY_HEIGHT,
      width,
      height: ODDITY_HEIGHT,
    };
  });
  const units = Math.max(
    CABINET_UNITS_AT_START,
    Math.ceil(onShelves.length / SEATS_PER_UNIT),
  );
  const packed = oddities.length - onShelves.length;
  const crates: CabinetCrate[] = [];
  for (let from = 0; from < packed; from += ODDITIES_PER_CRATE) {
    const last = crates.length === CABINET_CRATES.length - 1;
    const count = last ? packed - from : Math.min(ODDITIES_PER_CRATE, packed - from);
    crates.push({ tile: CABINET_CRATES[crates.length], from: SHELF_SEATS + from, count });
    if (last) {
      break;
    }
  }
  return { units, placed, crates };
}

/** Every tile a standing unit covers. */
export function unitTiles(unit: number): GridPosition[] {
  const at = CABINET_UNITS[unit];
  const tiles: GridPosition[] = [];
  for (let dy = 0; dy < CABINET_UNIT_SIZE.height; dy += 1) {
    for (let dx = 0; dx < CABINET_UNIT_SIZE.width; dx += 1) {
      tiles.push({ x: at.x + dx, y: at.y + dy });
    }
  }
  return tiles;
}

/** The unit standing on a tile, if one is. */
export function unitAt(tile: GridPosition, units: number): number | undefined {
  for (let unit = 0; unit < units; unit += 1) {
    const at = CABINET_UNITS[unit];
    if (
      tile.x >= at.x &&
      tile.y >= at.y &&
      tile.x < at.x + CABINET_UNIT_SIZE.width &&
      tile.y < at.y + CABINET_UNIT_SIZE.height
    ) {
      return unit;
    }
  }
  return undefined;
}

// --- looking along the shelves ------------------------------------------------

const middle = (placed: PlacedOddity) => placed.x + placed.width / 2;

/**
 * The first thing looked at when the player faces a unit and asks: whatever
 * on that unit stands nearest the tile they are facing, the upper shelf before
 * the lower. Undefined when that unit is still empty.
 */
export function firstOddityAt(
  placed: readonly PlacedOddity[],
  faced: GridPosition,
  unit: number,
  tileSize: number,
): number | undefined {
  const centre = faced.x * tileSize + tileSize / 2;
  let best: PlacedOddity | undefined;
  for (const candidate of placed) {
    if (candidate.unit !== unit) continue;
    if (
      !best ||
      candidate.run < best.run ||
      (candidate.run === best.run &&
        Math.abs(middle(candidate) - centre) < Math.abs(middle(best) - centre))
    ) {
      best = candidate;
    }
  }
  return best?.index;
}

/**
 * Where an arrow key takes the look from the thing it is on: along the shelf
 * for left and right - carrying on into the unit across the aisle - and to the
 * nearest thing on the next shelf up or down that has anything on it. At the
 * end of a run it stays put rather than wrapping, so a held key stops at the
 * end of the shelf the way a cursor stops at the end of a list.
 */
export function nextOddity(
  placed: readonly PlacedOddity[],
  from: number,
  direction: Direction,
): number {
  const here = placed[from];
  if (!here) {
    return from;
  }
  if (direction === 'left' || direction === 'right') {
    const sign = direction === 'right' ? 1 : -1;
    let best: PlacedOddity | undefined;
    for (const candidate of placed) {
      const ahead = (middle(candidate) - middle(here)) * sign;
      if (candidate.run !== here.run || ahead <= 0) continue;
      if (!best || ahead < (middle(best) - middle(here)) * sign) best = candidate;
    }
    return best?.index ?? from;
  }
  const runs = [...new Set(placed.map((candidate) => candidate.run))].sort((a, b) => a - b);
  const position = runs.indexOf(here.run);
  const run = runs[position + (direction === 'down' ? 1 : -1)];
  if (run === undefined) {
    return from;
  }
  let best: PlacedOddity | undefined;
  for (const candidate of placed) {
    if (candidate.run !== run) continue;
    if (!best || Math.abs(middle(candidate) - middle(here)) < Math.abs(middle(best) - middle(here))) {
      best = candidate;
    }
  }
  return best?.index ?? from;
}

// --- what the cabinet says ----------------------------------------------------

/**
 * The line under a unit's name: how much of the player's history the cabinet
 * holds - all of it, shelves and crates, because it is one collection however
 * many units it has taken - or, on a unit still waiting for its turn, that it is.
 */
export function unitNote(layout: CabinetLayout, unit: number): string {
  const total =
    layout.placed.length + layout.crates.reduce((sum, crate) => sum + crate.count, 0);
  if (total === 0) {
    return 'Waiting on your first trade';
  }
  if (!layout.placed.some((placed) => placed.unit === unit)) {
    return 'Room for more';
  }
  return total === 1 ? 'One thing you traded him' : `${total} things you traded him`;
}

/** What a unit says when it is faced and asked about with nothing on it. */
export const EMPTY_CABINET_LINE =
  'Empty shelves. BILL keeps them for whatever you trade him across the table.';

/** The crates, named once for all of them. */
export function cratesNote(layout: CabinetLayout): string {
  const count = layout.crates.reduce((sum, crate) => sum + crate.count, 0);
  return count === 1 ? 'One more, packed away' : `${count} more, packed away`;
}

/**
 * What the crates say when asked: how many things are in them and across
 * which days they were traded, because a crate is the part of the cabinet
 * you cannot look along.
 */
export function cratesLine(layout: CabinetLayout, oddities: readonly Oddity[], today: Date): string {
  const count = layout.crates.reduce((sum, crate) => sum + crate.count, 0);
  const packed = oddities.slice(SHELF_SEATS);
  const days = packed
    .map((oddity) => cabinetDayLabel(oddity.day, today))
    .filter((day): day is string => day !== undefined);
  const span =
    days.length === 0
      ? ''
      : days[0] === days[days.length - 1]
        ? `, all from ${days[0]}`
        : `, from ${days[0]} to ${days[days.length - 1]}`;
  return `${count === 1 ? 'One more thing' : `${count} more things`} you traded him, packed away when the shelves were full${span}.`;
}
