import { ICE_PIECES, ICE_SHEET, type IcePieceName } from '../generated/icePieces';
import { tileReader, type PropCell, type PropDefinition } from './catalogue';

/**
 * The sheet a cave dressed as ice is drawn from: FireRed's Icefall Cave, cut
 * out of pret's disassembly by `scripts/cut-frlg-ice.mjs` - its floor, its
 * sheet of ice, the rock and snow round them and the boulders standing on the
 * ice. Nothing here knows a coordinate on the sheet: the cut script writes
 * where each named piece landed (`generated/icePieces.ts`).
 *
 * Numbered from 15000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const ICE_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgIce',
    imagePath: ICE_SHEET.imagePath,
    columns: ICE_SHEET.columns,
    rows: ICE_SHEET.rows,
  },
  15000,
);

/** One cell of a named piece, as a tile number in the shared index space. */
export function iceTile(name: IcePieceName, dx = 0, dy = 0): number {
  const piece = ICE_PIECES[name];
  if (dx < 0 || dy < 0 || dx >= piece.width || dy >= piece.height) {
    throw new Error(`cell ${dx},${dy} is outside '${name}'`);
  }
  return ICE_SHEET_SOURCE.at(piece.column + dx, piece.row + dy);
}

/**
 * A named piece as a landmark, its collision drawn beside it as rows of `#`
 * (solid) and `.` (stood on); solid all over unless it says otherwise.
 */
export function iceProp(name: IcePieceName, label: string, solid?: readonly string[]): PropDefinition {
  const piece = ICE_PIECES[name];
  const mask = solid ?? Array.from({ length: piece.height }, () => '#'.repeat(piece.width));
  if (mask.length !== piece.height || mask.some((row) => row.length !== piece.width)) {
    throw new Error(`the collision drawn for '${name}' is not ${piece.width}x${piece.height}`);
  }
  const cells: PropCell[] = [];
  for (let y = 0; y < piece.height; y += 1) {
    for (let x = 0; x < piece.width; x += 1) {
      cells.push({ tile: iceTile(name, x, y), solid: mask[y][x] === '#' });
    }
  }
  return { label, width: piece.width, height: piece.height, cells };
}
