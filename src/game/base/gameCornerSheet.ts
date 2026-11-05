import { tileReader } from '../world/tileset/catalogue';
import { GAME_CORNER_PIECES, GAME_CORNER_SHEET, type GameCornerPieceName } from './generated/gameCornerPieces';
import { pieceSheet } from './baseSheet';

/**
 * The sheet THE GAME CORNER's two rooms are drawn from: Celadon's own Game
 * Corner and the prize room across the street from it, cut out of pret's
 * disassembly by `scripts/cut-frlg-areas.mjs` onto a sheet of their own, so
 * the area sheet a player's map furnishes from never moves when they grow.
 * Numbered from 21000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const GAME_CORNER_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgGameCorner',
    imagePath: GAME_CORNER_SHEET.imagePath,
    columns: GAME_CORNER_SHEET.columns,
    rows: GAME_CORNER_SHEET.rows,
  },
  21000,
);

/** The pieces by name, as a room's catalogue asks for them. */
export const GAME_CORNER_SHEET_PIECES = pieceSheet<GameCornerPieceName>(GAME_CORNER_SHEET_SOURCE, GAME_CORNER_PIECES);
