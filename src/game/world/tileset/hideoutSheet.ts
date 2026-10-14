import { HIDEOUT_PIECES, HIDEOUT_SHEET, type HideoutPieceName } from '../generated/hideoutPieces';
import { tileReader, type PropCell, type PropDefinition } from './catalogue';

/**
 * The sheet a room dressed as the Rocket Hideout or the Power Plant is drawn
 * from, cut out of pret's disassembly by `scripts/cut-frlg-hideout.mjs`: the
 * hideout's floor and walls and the white rule FireRed draws round its rooms
 * in the dark, the partitions of its maze, its spinner arrows, its stairs, its
 * lift and its shutter, and what stands in it; and the Power Plant's floor,
 * its wall of machinery and its generators. Nothing here knows a coordinate
 * on the sheet: the cut script writes where each named piece landed
 * (`generated/hideoutPieces.ts`).
 *
 * Numbered from 17000, clear of every other sheet the loader fetches
 * (`catalogue.test.ts` holds the whole list apart).
 */
export const HIDEOUT_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgHideout',
    imagePath: HIDEOUT_SHEET.imagePath,
    columns: HIDEOUT_SHEET.columns,
    rows: HIDEOUT_SHEET.rows,
  },
  17000,
);

/** One cell of a named piece, as a tile number in the shared index space. */
export function hideoutTile(name: HideoutPieceName, dx = 0, dy = 0): number {
  const piece = HIDEOUT_PIECES[name];
  if (dx < 0 || dy < 0 || dx >= piece.width || dy >= piece.height) {
    throw new Error(`cell ${dx},${dy} is outside '${name}'`);
  }
  return HIDEOUT_SHEET_SOURCE.at(piece.column + dx, piece.row + dy);
}

/**
 * A named piece as a landmark, its collision drawn beside it as rows of `#`
 * (solid), `.` (stood on) and `^` (walked under: the leaves of a plant or the
 * lid of a barrel, drawn over whoever stands behind it, as FireRed draws them
 * on the layer above the player); solid all over unless it says otherwise.
 */
export function hideoutProp(
  name: HideoutPieceName,
  label: string,
  solid?: readonly string[],
): PropDefinition {
  const piece = HIDEOUT_PIECES[name];
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
          ? { tile: hideoutTile(name, x, y), solid: false, canopy: true, walkedUnder: true }
          : { tile: hideoutTile(name, x, y), solid: letter === '#' },
      );
    }
  }
  return { label, width: piece.width, height: piece.height, cells };
}
