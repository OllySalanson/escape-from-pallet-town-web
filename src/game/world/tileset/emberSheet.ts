import { EMBER_PIECES, EMBER_SHEET, type EmberPieceName } from '../generated/emberPieces';
import { tileReader, type PropCell, type PropDefinition } from './catalogue';

/**
 * The sheet a cave dressed as a volcano is drawn from: FireRed's Mt. Ember,
 * the Ruby Path under it, cut out of pret's disassembly by
 * `scripts/cut-frlg-ember.mjs` - its ash floor, the red rock round it, the
 * boulders standing on the floor and its ladder, hole and way out. Nothing
 * here knows a coordinate on the sheet: the cut script writes where each named
 * piece landed (`generated/emberPieces.ts`).
 *
 * Numbered from 16000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const EMBER_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgEmber',
    imagePath: EMBER_SHEET.imagePath,
    columns: EMBER_SHEET.columns,
    rows: EMBER_SHEET.rows,
  },
  16000,
);

/** One cell of a named piece, as a tile number in the shared index space. */
export function emberTile(name: EmberPieceName, dx = 0, dy = 0): number {
  const piece = EMBER_PIECES[name];
  if (dx < 0 || dy < 0 || dx >= piece.width || dy >= piece.height) {
    throw new Error(`cell ${dx},${dy} is outside '${name}'`);
  }
  return EMBER_SHEET_SOURCE.at(piece.column + dx, piece.row + dy);
}

/**
 * A named piece as a landmark, its collision drawn beside it as rows of `#`
 * (solid) and `.` (stood on); solid all over unless it says otherwise.
 */
export function emberProp(name: EmberPieceName, label: string, solid?: readonly string[]): PropDefinition {
  const piece = EMBER_PIECES[name];
  const mask = solid ?? Array.from({ length: piece.height }, () => '#'.repeat(piece.width));
  if (mask.length !== piece.height || mask.some((row) => row.length !== piece.width)) {
    throw new Error(`the collision drawn for '${name}' is not ${piece.width}x${piece.height}`);
  }
  const cells: PropCell[] = [];
  for (let y = 0; y < piece.height; y += 1) {
    for (let x = 0; x < piece.width; x += 1) {
      cells.push({ tile: emberTile(name, x, y), solid: mask[y][x] === '#' });
    }
  }
  return { label, width: piece.width, height: piece.height, cells };
}
