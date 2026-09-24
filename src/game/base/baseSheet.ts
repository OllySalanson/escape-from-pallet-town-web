import {
  tileReader,
  type MaterialTiles,
  type PropCell,
  type PropDefinition,
  type TilesetCatalogue,
} from '../world/tileset/catalogue';
import type { Material } from '../world/tileset/materials';
import { BASE_PIECES, BASE_SHEET, type BasePieceName } from './generated/basePieces';

/**
 * The base's own sheet: the four rooms and Bill's cottage, cut out of
 * FireRed/LeafGreen by `scripts/cut-frlg-base.mjs`.
 *
 * Nothing here knows a coordinate on the sheet. The cut script writes where
 * each named piece landed (`generated/basePieces.ts`), and everything that
 * draws from it asks by name, so a re-cut cannot leave a room drawing from
 * the wrong cell. Numbered from 5000, clear of every other sheet the loader
 * fetches (`catalogue.test.ts` holds the whole list apart).
 */
export const BASE_SHEET_SOURCE = tileReader(
  {
    textureKey: 'frlgBase',
    imagePath: BASE_SHEET.imagePath,
    columns: BASE_SHEET.columns,
    rows: BASE_SHEET.rows,
  },
  5000,
);

/** One cell of a named piece, as a tile number in the shared index space. */
export function pieceTile(name: BasePieceName, dx = 0, dy = 0): number {
  const piece = BASE_PIECES[name];
  if (dx < 0 || dy < 0 || dx >= piece.width || dy >= piece.height) {
    throw new Error(`cell ${dx},${dy} is outside '${name}'`);
  }
  return BASE_SHEET_SOURCE.at(piece.column + dx, piece.row + dy);
}

/**
 * A named piece as a landmark, with its collision drawn beside it.
 *
 * `solid` is the piece as rows of `#` (solid) and `.` (stood on), in the shape
 * it has on screen, so a reviewer reads a shelf unit's foot the way they read
 * a map. It has to be the piece's size exactly, or this throws - a mask that
 * drifted from its art is how a bookcase comes to be walked through.
 */
export function pieceProp(
  name: BasePieceName,
  label: string,
  solid: readonly string[],
): PropDefinition {
  const piece = BASE_PIECES[name];
  if (solid.length !== piece.height || solid.some((row) => row.length !== piece.width)) {
    throw new Error(`the collision drawn for '${name}' is not ${piece.width}x${piece.height}`);
  }
  const cells: PropCell[] = [];
  for (let y = 0; y < piece.height; y += 1) {
    for (let x = 0; x < piece.width; x += 1) {
      cells.push({ tile: pieceTile(name, x, y), solid: solid[y][x] === '#' });
    }
  }
  return { label, width: piece.width, height: piece.height, cells };
}

/** A piece nobody can walk on, which is most furniture. */
export function solidPiece(name: BasePieceName, label: string): PropDefinition {
  const { width, height } = BASE_PIECES[name];
  return pieceProp(
    name,
    label,
    Array.from({ length: height }, () => '#'.repeat(width)),
  );
}

/** A piece that is only ever walked over: a mat, a floor emblem. */
export function floorPiece(name: BasePieceName, label: string): PropDefinition {
  const { width, height } = BASE_PIECES[name];
  return pieceProp(
    name,
    label,
    Array.from({ length: height }, () => '.'.repeat(width)),
  );
}

/**
 * The shell of a room: a floor and a back wall, and nothing else.
 *
 * A room is drawn with two materials. `paving` (`P`) is its floor, which takes
 * the shaded tile along the foot of the wall as its north edge; `wall` (`B`)
 * is the back wall, two rows deep, whose lower row is the one with the skirting
 * on it. Nothing beyond the room is drawn at all - the camera's own black is
 * what a FireRed room stands in. Every other material is the floor, because the
 * catalogue type asks for all sixteen and a room uses two.
 */
export function roomCatalogue<PropName extends string>(
  shell: {
    readonly floor: BasePieceName;
    readonly floorShade: BasePieceName;
    readonly wallUpper: BasePieceName;
    readonly wallLower: BasePieceName;
  },
  props: Readonly<Record<PropName, PropDefinition>>,
): TilesetCatalogue<PropName> {
  const floor: MaterialTiles = {
    roles: { fill: pieceTile(shell.floor), 'edge-n': pieceTile(shell.floorShade) },
  };
  const wall: MaterialTiles = {
    roles: { fill: pieceTile(shell.wallUpper), 'edge-s': pieceTile(shell.wallLower) },
  };
  const materials = Object.fromEntries(
    (
      [
        'grass',
        'turf',
        'tall-grass',
        'earth',
        'sand',
        'beach',
        'paving',
        'stone',
        'gravel',
        'ford',
        'water',
        'hedge',
        'tree',
        'cliff',
        'fence',
      ] as const
    ).map((material) => [material, floor]),
  ) as Record<Exclude<Material, 'wall'>, MaterialTiles>;
  return {
    sources: [BASE_SHEET_SOURCE.source],
    materials: { ...materials, wall },
    props,
  };
}
