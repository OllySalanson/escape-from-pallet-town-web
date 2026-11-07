import { tileReader } from '../world/tileset/catalogue';
import { DOJO_PIECES, DOJO_SHEET, type DojoPieceName } from './generated/dojoPieces';
import { pieceSheet } from './baseSheet';

/**
 * The sheet THE BATTLE ARENA's room is drawn from: Saffron's own Fighting Dojo,
 * cut out of pret's disassembly by `scripts/cut-frlg-areas.mjs` onto a sheet of
 * its own, so neither the area sheet nor the Game Corner's moves when it does.
 * Numbered from 21500, between the Game Corner's sheet and the boardwalk's
 * planks at 22000 (`catalogue.test.ts` holds the whole list apart).
 */
export const DOJO_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgDojo',
    imagePath: DOJO_SHEET.imagePath,
    columns: DOJO_SHEET.columns,
    rows: DOJO_SHEET.rows,
  },
  21500,
);

/** The pieces by name, as a room's catalogue asks for them. */
export const DOJO_SHEET_PIECES = pieceSheet<DojoPieceName>(DOJO_SHEET_SOURCE, DOJO_PIECES);
