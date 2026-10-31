import { BOARDS_SHEET } from '../generated/boardPieces';
import { tileReader, type MaterialTiles } from './catalogue';

/**
 * The sheet a boardwalk is drawn from: FireRed's plank decking, cut out of pret's
 * disassembly by `scripts/cut-frlg-boards.mjs`, three cells by three as a deck is
 * laid.
 *
 * Numbered from 22000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const BOARDS_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgBoards',
    imagePath: BOARDS_SHEET.imagePath,
    columns: BOARDS_SHEET.columns,
    rows: BOARDS_SHEET.rows,
  },
  22000,
);

const cell = (x: number, y: number): number => BOARDS_SHEET_SOURCE.at(x, y);

/** The deck as a material: its edges face whatever it is laid over. */
export const BOARDS: MaterialTiles = {
  roles: {
    fill: cell(1, 1),
    'edge-n': cell(1, 0),
    'edge-s': cell(1, 2),
    'edge-w': cell(0, 1),
    'edge-e': cell(2, 1),
    'corner-nw': cell(0, 0),
    'corner-ne': cell(2, 0),
    'corner-sw': cell(0, 2),
    'corner-se': cell(2, 2),
  },
};
