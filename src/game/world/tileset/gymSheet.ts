import { GYM_PIECES, GYM_SHEET, type GymPieceName } from '../generated/gymPieces';
import { tileReader, type PropCell, type PropDefinition } from './catalogue';

/**
 * The sheet a room dressed as Cerulean Gym or Fuchsia Gym is drawn from, cut
 * out of pret's disassembly by `scripts/cut-frlg-gyms.mjs`: Cerulean's pool -
 * its water, its rim, the shadows its walkways throw and the walkways
 * themselves - its floor, its back wall and side walls, the dais, the statues
 * and the ladders; and Fuchsia's floor, its back wall with its pillars and
 * windows, Koga's dais, and the partitions of its maze. Nothing here knows a
 * coordinate on the sheet: the cut script writes where each named piece
 * landed (`generated/gymPieces.ts`).
 *
 * Numbered from 28000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const GYM_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgGyms',
    imagePath: GYM_SHEET.imagePath,
    columns: GYM_SHEET.columns,
    rows: GYM_SHEET.rows,
  },
  28000,
);

/** One cell of a named piece, as a tile number in the shared index space. */
export function gymTile(name: GymPieceName, dx = 0, dy = 0): number {
  const piece = GYM_PIECES[name];
  if (dx < 0 || dy < 0 || dx >= piece.width || dy >= piece.height) {
    throw new Error(`cell ${dx},${dy} is outside '${name}'`);
  }
  return GYM_SHEET_SOURCE.at(piece.column + dx, piece.row + dy);
}

/**
 * A named piece as a landmark, its collision drawn beside it as rows of `#`
 * (solid), `.` (stood on) and `^` (walked under: the leaves of a plant or the
 * lid of a barrel, drawn over whoever stands behind it, as FireRed draws them
 * on the layer above the player); solid all over unless it says otherwise.
 */
export function gymProp(
  name: GymPieceName,
  label: string,
  solid?: readonly string[],
): PropDefinition {
  const piece = GYM_PIECES[name];
  const mask = solid ?? Array.from({ length: piece.height }, () => '#'.repeat(piece.width));
  if (mask.length !== piece.height || mask.some((row) => row.length !== piece.width)) {
    throw new Error(`the collision drawn for '${name}' is not ${piece.width}x${piece.height}`);
  }
  const cells: PropCell[] = [];
  for (let y = 0; y < piece.height; y += 1) {
    for (let x = 0; x < piece.width; x += 1) {
      const letter = mask[y][x];
      cells.push(
        letter === '^'
          ? { tile: gymTile(name, x, y), solid: false, canopy: true, walkedUnder: true }
          : { tile: gymTile(name, x, y), solid: letter === '#' },
      );
    }
  }
  return { label, width: piece.width, height: piece.height, cells };
}
