import { tileReader } from '../world/tileset/catalogue';
import { pieceSheet } from './baseSheet';
import { HOME_PIECES, HOME_SHEET, type HomePieceName } from './generated/homePieces';

/**
 * THE BOLTHOLE's own sheet: the player's house from FireRed/LeafGreen, drawn
 * out of the game's own interior tileset by `scripts/cut-frlg-home.mjs`.
 *
 * Nothing here knows a coordinate on the sheet: the script writes where each
 * named piece landed (`generated/homePieces.ts`) and everything asks by name.
 * Numbered from 7000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const HOME_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgHome',
    imagePath: HOME_SHEET.imagePath,
    columns: HOME_SHEET.columns,
    rows: HOME_SHEET.rows,
  },
  7000,
);

export const HOME_SHEET_PIECES = pieceSheet<HomePieceName>(HOME_SHEET_SOURCE, HOME_PIECES);
