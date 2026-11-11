import { tileReader, withDoorway, type PropDefinition } from '../world/tileset/catalogue';

/**
 * THE PROMENADE's own art, drawn by `scripts/draw-promenade.mjs` onto
 * `public/assets/promenade.png`: THE GAME CORNER (Celadon's own, with a lit
 * GAME CORNER marquee across its front and a gold PRIZES ticket over its prize
 * window) and the things a seaside front has that no FireRed town does -
 * lamps, parasols, deckchairs, beach huts, railings, a lifebuoy, pennants,
 * flower troughs and an ice-cream cart - THE FIELD-MOVE COURSE's gate (COURSE
 * over its posts, the four field moves painted under the word) and its TIMES
 * board, THE PROMENADE DERBY's start board, THE DIG's sign on the sand and
 * THE FISHING DERBY's board at the pier head, the POKéMON JUMP and BERRY PICKING cabinets inside, and THE BATTLE
 * ARENA (Saffron's Fighting Dojo with BATTLE ARENA on a board across its front).
 * Numbered from 20000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const PROMENADE_SHEET = {
  imagePath: 'assets/promenade.png',
  columns: 16,
  rows: 17,
} as const;

export const PROMENADE_SHEET_SOURCE = tileReader({ textureKey: 'promenade', ...PROMENADE_SHEET }, 20000);

/** Where each piece sits on the sheet, in tiles. The script draws them there. */
export const PROMENADE_PIECES = {
  gameCorner: { column: 0, row: 0, width: 10, height: 6 },
  lamp: { column: 10, row: 0, width: 1, height: 2 },
  lifebuoy: { column: 11, row: 0, width: 1, height: 2 },
  pennantRed: { column: 12, row: 0, width: 1, height: 2 },
  pennantBlue: { column: 13, row: 0, width: 1, height: 2 },
  pennantYellow: { column: 14, row: 0, width: 1, height: 2 },
  pennantGreen: { column: 15, row: 0, width: 1, height: 2 },
  parasolRed: { column: 10, row: 2, width: 2, height: 2 },
  parasolBlue: { column: 12, row: 2, width: 2, height: 2 },
  parasolYellow: { column: 14, row: 2, width: 2, height: 2 },
  iceCart: { column: 10, row: 4, width: 2, height: 2 },
  jumpCabinet: { column: 12, row: 4, width: 2, height: 3 },
  railing: { column: 14, row: 4, width: 1, height: 1 },
  deckchairRed: { column: 15, row: 4, width: 1, height: 1 },
  deckchairBlue: { column: 14, row: 5, width: 1, height: 1 },
  deckchairYellow: { column: 15, row: 5, width: 1, height: 1 },
  hutRed: { column: 0, row: 6, width: 2, height: 3 },
  hutBlue: { column: 2, row: 6, width: 2, height: 3 },
  hutYellow: { column: 4, row: 6, width: 2, height: 3 },
  hutGreen: { column: 6, row: 6, width: 2, height: 3 },
  hutPink: { column: 8, row: 6, width: 2, height: 3 },
  hutTeal: { column: 10, row: 6, width: 2, height: 3 },
  troughPink: { column: 12, row: 7, width: 2, height: 1 },
  troughYellow: { column: 14, row: 7, width: 2, height: 1 },
  troughRed: { column: 12, row: 8, width: 2, height: 1 },
  troughBlue: { column: 14, row: 8, width: 2, height: 1 },
  berryCabinet: { column: 0, row: 9, width: 2, height: 3 },
  courseGate: { column: 2, row: 9, width: 3, height: 3 },
  timeBoard: { column: 5, row: 9, width: 1, height: 2 },
  derbyBoard: { column: 6, row: 9, width: 3, height: 3 },
  digSign: { column: 9, row: 9, width: 2, height: 2 },
  fishingBoard: { column: 11, row: 9, width: 2, height: 2 },
  dojo: { column: 0, row: 12, width: 6, height: 5 },
} as const;

export type PromenadePieceName = keyof typeof PROMENADE_PIECES;

/**
 * A piece as a landmark, its collision drawn beside it as rows of `#` (solid)
 * and `.` (stood on); solid in every cell when none is given.
 */
export function promenadeProp(name: PromenadePieceName, label: string, solid?: readonly string[]): PropDefinition {
  const place = PROMENADE_PIECES[name];
  const mask = solid ?? Array.from({ length: place.height }, () => '#'.repeat(place.width));
  if (mask.length !== place.height || mask.some((row) => row.length !== place.width)) {
    throw new Error(`the collision drawn for '${name}' is not ${place.width}x${place.height}`);
  }
  return {
    label,
    width: place.width,
    height: place.height,
    cells: Array.from({ length: place.width * place.height }, (_cell, index) => {
      const x = index % place.width;
      const y = Math.floor(index / place.width);
      return { tile: PROMENADE_SHEET_SOURCE.at(place.column + x, place.row + y), solid: mask[y][x] === '#' };
    }),
  };
}

/**
 * A post two tiles tall that stands on one: a lamp. Its footing is the tile its
 * post stands on, and its head is drawn in the row above as a brim
 * (`PropDefinition.brim`), over whoever walks behind it - so a lamp in the
 * railing leaves the boardwalk above it walkable, where a lamp solid on both
 * tiles stood across the whole boardwalk every six tiles.
 */
export function promenadePost(name: PromenadePieceName, label: string): PropDefinition {
  const place = PROMENADE_PIECES[name];
  if (place.width !== 1 || place.height !== 2) {
    throw new Error(`'${name}' is not a post one tile wide and two tall`);
  }
  return {
    label,
    width: 1,
    height: 1,
    cells: [{ tile: PROMENADE_SHEET_SOURCE.at(place.column, place.row + 1), solid: true }],
    brim: { tiles: [PROMENADE_SHEET_SOURCE.at(place.column, place.row)], depth: 16 },
  };
}

/**
 * A rectangle of a piece as a landmark of its own, its collision drawn beside
 * it: THE GAME CORNER's cut is one picture of two buildings, the hall and the
 * prize window beside it, and each is a door with its own name.
 */
function promenadePart(
  name: PromenadePieceName,
  label: string,
  [x0, y0, width, height]: readonly [number, number, number, number],
  solid: readonly string[],
): PropDefinition {
  const place = PROMENADE_PIECES[name];
  if (solid.length !== height || solid.some((row) => row.length !== width)) {
    throw new Error(`the collision drawn for '${label}' is not ${width}x${height}`);
  }
  return {
    label,
    width,
    height,
    cells: Array.from({ length: width * height }, (_cell, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return { tile: PROMENADE_SHEET_SOURCE.at(place.column + x0 + x, place.row + y0 + y), solid: solid[y][x] === '#' };
    }),
  };
}

/**
 * THE GAME CORNER's hall, 7x6, with its door open under the purple arch where
 * Celadon's is. FireRed's cut leaves the front step walkable either side of
 * the arch's two pillars, which stand.
 */
export const GAME_CORNER_HALL: PropDefinition = withDoorway(
  promenadePart('gameCorner', 'game corner', [0, 0, 7, 6], [
    '#######',
    '#######',
    '#######',
    '#######',
    '#######',
    '..#.#..',
  ]),
  [[3, 4]],
);

/**
 * THE GAME CORNER's prize window, the little building beside the hall under
 * its gold PRIZES ticket, 3x4, with its door open where Celadon's is. It
 * stands against the hall, so the two read as the one front FireRed drew.
 */
export const PRIZE_WINDOW_BUILDING: PropDefinition = withDoorway(
  promenadePart('gameCorner', 'prize window', [7, 0, 3, 4], ['###', '###', '###', '###']),
  [[1, 3]],
);

/**
 * THE BATTLE ARENA, 6x5: Saffron's Fighting Dojo with its name board, its door
 * open at the foot of its middle where FireRed's is.
 */
export const BATTLE_ARENA_BUILDING: PropDefinition = withDoorway(promenadeProp('dojo', 'battle arena'), [[3, 4]]);
