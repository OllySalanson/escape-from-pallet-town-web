import { AREA_PIECES, AREA_SHEET, type AreaPieceName } from '../generated/areaPieces';
import { tileReader, type PropCell, type PropDefinition } from './catalogue';

/**
 * The sheet the insides of a player's buildings are drawn from: FireRed's own
 * rooms, cut out of pret's disassembly by `scripts/cut-frlg-areas.mjs`.
 *
 * Nothing here knows a coordinate on the sheet: the cut script writes where
 * each named piece landed (`generated/areaPieces.ts`), and everything that
 * draws from it asks by name. Numbered from 10000, clear of every other sheet
 * the loader fetches (`catalogue.test.ts` holds the whole list apart).
 */
export const AREA_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgAreas',
    imagePath: AREA_SHEET.imagePath,
    columns: AREA_SHEET.columns,
    rows: AREA_SHEET.rows,
  },
  10000,
);

/** One cell of a named piece, as a tile number in the shared index space. */
export function areaTile(name: AreaPieceName, dx = 0, dy = 0): number {
  const piece = AREA_PIECES[name];
  if (dx < 0 || dy < 0 || dx >= piece.width || dy >= piece.height) {
    throw new Error(`cell ${dx},${dy} is outside '${name}'`);
  }
  return AREA_SHEET_SOURCE.at(piece.column + dx, piece.row + dy);
}

/**
 * A named piece as a landmark, with its collision drawn beside it as rows of
 * `#` (solid) and `.` (stood on), in the shape it has on screen. It has to be
 * the piece's size exactly, or this throws.
 */
export function areaProp(name: AreaPieceName, label: string, solid?: readonly string[]): PropDefinition {
  const piece = AREA_PIECES[name];
  const mask = solid ?? Array.from({ length: piece.height }, () => '#'.repeat(piece.width));
  if (mask.length !== piece.height || mask.some((row) => row.length !== piece.width)) {
    throw new Error(`the collision drawn for '${name}' is not ${piece.width}x${piece.height}`);
  }
  const cells: PropCell[] = [];
  for (let y = 0; y < piece.height; y += 1) {
    for (let x = 0; x < piece.width; x += 1) {
      cells.push({ tile: areaTile(name, x, y), solid: mask[y][x] === '#' });
    }
  }
  return { label, width: piece.width, height: piece.height, cells };
}

/** A piece that is only ever walked over: a mat, a rug. */
export function areaFloorProp(name: AreaPieceName, label: string): PropDefinition {
  const piece = AREA_PIECES[name];
  return areaProp(
    name,
    label,
    Array.from({ length: piece.height }, () => '.'.repeat(piece.width)),
  );
}
