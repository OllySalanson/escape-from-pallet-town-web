import { tileReader, withDoorway, type PropDefinition } from '../world/tileset/catalogue';
import { pieceSheet, type PiecePlace } from './baseSheet';

/**
 * THE GREAT LIBRARY's own art, drawn for this game by
 * `scripts/draw-great-library.mjs` onto `public/assets/great-library.png`: the
 * building's front, and everything in its room - the boards, the panelled
 * walls, the bookcases, the lecterns its books lie open on, the librarian's
 * desk. Numbered from 30000, past THE RAID ARENA's hall, which is the sheet
 * that grows (`catalogue.test.ts` holds the whole list apart).
 */
export const LIBRARY_SHEET = {
  imagePath: 'assets/great-library.png',
  columns: 16,
  rows: 6,
} as const;

export const LIBRARY_SHEET_SOURCE = tileReader({ textureKey: 'greatLibrary', ...LIBRARY_SHEET }, 30000);

/** The colours a lectern's book is bound in, one lectern piece each (`library/books.ts`). */
export const LECTERN_COLOURS = ['red', 'blue', 'green', 'gold', 'purple', 'teal'] as const;
export type LecternColour = (typeof LECTERN_COLOURS)[number];

/** Where each piece sits on the sheet, in tiles. The script draws them there. */
export const LIBRARY_PIECES = {
  building: { column: 0, row: 0, width: 5, height: 4 },
  floor: { column: 5, row: 0, width: 1, height: 1 },
  floorShade: { column: 6, row: 0, width: 1, height: 1 },
  wallUpper: { column: 7, row: 0, width: 1, height: 1 },
  wallLower: { column: 8, row: 0, width: 1, height: 1 },
  runner: { column: 9, row: 0, width: 1, height: 1 },
  mat: { column: 10, row: 0, width: 1, height: 1 },
  wallCase: { column: 5, row: 1, width: 2, height: 2 },
  stack: { column: 7, row: 1, width: 3, height: 2 },
  backWindow: { column: 10, row: 1, width: 1, height: 2 },
  globe: { column: 11, row: 1, width: 1, height: 2 },
  fern: { column: 12, row: 1, width: 1, height: 2 },
  lecternRed: { column: 0, row: 4, width: 1, height: 2 },
  lecternBlue: { column: 1, row: 4, width: 1, height: 2 },
  lecternGreen: { column: 2, row: 4, width: 1, height: 2 },
  lecternGold: { column: 3, row: 4, width: 1, height: 2 },
  lecternPurple: { column: 4, row: 4, width: 1, height: 2 },
  lecternTeal: { column: 5, row: 4, width: 1, height: 2 },
  desk: { column: 6, row: 4, width: 3, height: 2 },
  goldenPlinth: { column: 9, row: 4, width: 1, height: 2 },
  goldenPlinthLocked: { column: 10, row: 4, width: 1, height: 2 },
  // THE TREASURE MAP's (`../treasure/treasureMap.ts`): the end bookcase swung
  // open onto THE CHART ROOM, and the smugglers' chest opened in it.
  secretCaseOpen: { column: 13, row: 1, width: 2, height: 2 },
  seaChestOpen: { column: 11, row: 4, width: 2, height: 2 },
} as const satisfies Readonly<Record<string, PiecePlace>>;

export type LibraryPieceName = keyof typeof LIBRARY_PIECES;

/** The pieces by name, as the room's catalogue asks for them. */
export const LIBRARY_SHEET_PIECES = pieceSheet<LibraryPieceName>(LIBRARY_SHEET_SOURCE, LIBRARY_PIECES);

/** The lectern piece a book of this colour lies open on. */
export function lecternPiece(colour: LecternColour): LibraryPieceName {
  return `lectern${colour[0].toUpperCase()}${colour.slice(1)}` as LibraryPieceName;
}

/**
 * The building, 5x4, a portico of four columns under a pediment with GREAT
 * LIBRARY cut into its frieze; its oak doors open in the middle of its foot,
 * between the columns, over the steps.
 */
export const GREAT_LIBRARY_BUILDING: PropDefinition = withDoorway(LIBRARY_SHEET_PIECES.solid('building', 'great library'), [[2, 3]]);
