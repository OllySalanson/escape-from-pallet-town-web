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

/** Where one named piece sits on a sheet of cut pieces, in tiles. */
export interface PiecePlace {
  readonly column: number;
  readonly row: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A sheet of named pieces, and the four ways a room asks for one. Each sheet
 * the base draws rooms from - the cut rooms here and the player's house
 * (`homeSheet.ts`) - is one of these, so a room asks for a piece by name on
 * whichever sheet it was drawn on and nothing outside the generated module
 * knows a coordinate.
 */
export interface PieceSheet<Name extends string> {
  readonly source: ReturnType<typeof tileReader>['source'];
  /** One cell of a named piece, as a tile number in the shared index space. */
  readonly tile: (name: Name, dx?: number, dy?: number) => number;
  /**
   * A named piece as a landmark, with its collision drawn beside it.
   *
   * `solid` is the piece as rows of `#` (solid) and `.` (stood on), in the
   * shape it has on screen, so a reviewer reads a shelf unit's foot the way
   * they read a map. It has to be the piece's size exactly, or this throws - a
   * mask that drifted from its art is how a bookcase comes to be walked through.
   */
  readonly prop: (name: Name, label: string, solid: readonly string[]) => PropDefinition;
  /** A piece nobody can walk on, which is most furniture. */
  readonly solid: (name: Name, label: string) => PropDefinition;
  /** A piece that is only ever walked over: a mat, a floor emblem. */
  readonly floor: (name: Name, label: string) => PropDefinition;
}

export function pieceSheet<Name extends string>(
  reader: ReturnType<typeof tileReader>,
  pieces: Readonly<Record<Name, PiecePlace>>,
): PieceSheet<Name> {
  const tile = (name: Name, dx = 0, dy = 0): number => {
    const piece = pieces[name];
    if (dx < 0 || dy < 0 || dx >= piece.width || dy >= piece.height) {
      throw new Error(`cell ${dx},${dy} is outside '${name}'`);
    }
    return reader.at(piece.column + dx, piece.row + dy);
  };
  const prop = (name: Name, label: string, solid: readonly string[]): PropDefinition => {
    const piece = pieces[name];
    if (solid.length !== piece.height || solid.some((row) => row.length !== piece.width)) {
      throw new Error(`the collision drawn for '${name}' is not ${piece.width}x${piece.height}`);
    }
    const cells: PropCell[] = [];
    for (let y = 0; y < piece.height; y += 1) {
      for (let x = 0; x < piece.width; x += 1) {
        cells.push({ tile: tile(name, x, y), solid: solid[y][x] === '#' });
      }
    }
    return { label, width: piece.width, height: piece.height, cells };
  };
  const filled = (name: Name, mark: string): string[] =>
    Array.from({ length: pieces[name].height }, () => mark.repeat(pieces[name].width));
  return {
    source: reader.source,
    tile,
    prop,
    solid: (name, label) => prop(name, label, filled(name, '#')),
    floor: (name, label) => prop(name, label, filled(name, '.')),
  };
}

const BASE = pieceSheet<BasePieceName>(BASE_SHEET_SOURCE, BASE_PIECES);

/** One cell of a named piece of the base's sheet, as a tile number in the shared index space. */
export const pieceTile = BASE.tile;
/** A named piece of the base's sheet as a landmark, with its collision drawn beside it. */
export const pieceProp = BASE.prop;
/** A piece of the base's sheet nobody can walk on, which is most furniture. */
export const solidPiece = BASE.solid;
/** A piece of the base's sheet that is only ever walked over: a mat, a floor emblem. */
export const floorPiece = BASE.floor;

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
export function roomCatalogue<PropName extends string, Piece extends string = BasePieceName>(
  shell: {
    readonly floor: Piece;
    readonly floorShade: Piece;
    readonly wallUpper: Piece;
    readonly wallLower: Piece;
  },
  props: Readonly<Record<PropName, PropDefinition>>,
  sheet: PieceSheet<Piece> = BASE as unknown as PieceSheet<Piece>,
): TilesetCatalogue<PropName> {
  const floor: MaterialTiles = {
    roles: { fill: sheet.tile(shell.floor), 'edge-n': sheet.tile(shell.floorShade) },
  };
  const wall: MaterialTiles = {
    roles: { fill: sheet.tile(shell.wallUpper), 'edge-s': sheet.tile(shell.wallLower) },
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
    sources: [sheet.source],
    materials: { ...materials, wall },
    props,
  };
}
