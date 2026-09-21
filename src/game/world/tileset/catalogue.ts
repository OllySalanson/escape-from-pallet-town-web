import type { Material } from './materials';

/**
 * A tile's job inside its material.
 *
 * Bare seams are what separate a stamped map from a drawn one, and a bare seam
 * is what you get when edges are placed by hand. Naming the job instead lets
 * one rule pick the tile from a neighbourhood, so a brush cannot draw a seam
 * even if the author is careless.
 */
export type TileRole =
  /** Surrounded by its own kind. */
  | 'fill'
  /** One side is something else: the edge faces that way. */
  | 'edge-n'
  | 'edge-s'
  | 'edge-e'
  | 'edge-w'
  /** Two adjacent sides are something else: an outside corner. */
  | 'corner-nw'
  | 'corner-ne'
  | 'corner-sw'
  | 'corner-se'
  /** Every side matches but a diagonal does not: the material turns a notch. */
  | 'inner-nw'
  | 'inner-ne'
  | 'inner-sw'
  | 'inner-se'
  /** Two opposite sides are something else: a one-tile run. */
  | 'run-h'
  | 'run-v'
  /** The end of a one-tile run, and a tile entirely on its own. */
  | 'cap-n'
  | 'cap-s'
  | 'cap-e'
  | 'cap-w'
  | 'single';

export const TILE_ROLES: readonly TileRole[] = [
  'fill',
  'edge-n',
  'edge-s',
  'edge-e',
  'edge-w',
  'corner-nw',
  'corner-ne',
  'corner-sw',
  'corner-se',
  'inner-nw',
  'inner-ne',
  'inner-sw',
  'inner-se',
  'run-h',
  'run-v',
  'cap-n',
  'cap-s',
  'cap-e',
  'cap-w',
  'single',
];

/**
 * A material's tiles. `fill` is the only required role: everything else is what
 * the art happens to provide, and `resolveTile` falls back along a named chain
 * rather than drawing a hole when a sheet is missing a corner.
 */
export interface MaterialTiles {
  /** Extra fill tiles. Variation is chosen by position, never at random, so a
   *  map builds byte-identically every time. Used sparingly on purpose: even
   *  spacing and random scatter both read as generated. */
  readonly fillVariants?: readonly number[];
  /** How often a variant is used, as one tile in N. Higher is calmer. */
  readonly variantRarity?: number;
  readonly roles: Partial<Record<TileRole, number>>;
  /** Drawn on the overlay layer over whatever ground is beneath it. */
  readonly overlay?: boolean;
  /**
   * Other materials this one runs into without drawing an edge. A sheet's
   * shallows are drawn with a bank round them, and a bank is right against
   * land and wrong against the deep water the shallows are part of: a ford
   * across a river came out as a pool of its own with a lip down both sides,
   * and the river either side of it as two more.
   */
  readonly joins?: readonly Material[];
  /** Multiplied into the tile when drawn, the way Phaser tints. */
  readonly tint?: number;
}

export interface PropCell {
  /** -1 leaves the ground showing through. */
  readonly tile: number;
  readonly solid: boolean;
  /** Drawn over figures, so the player passes behind it. */
  readonly canopy?: boolean;
  /**
   * Drawn left for right. A sheet draws the two ends of a symmetrical thing
   * once and expects the other to be mirrored, and now and then it draws
   * something else entirely over the second one - the FireRed shop front has a
   * cat standing in its right-hand pier. A cell that says so is drawn with
   * another cell's art the right way round rather than approximated with a
   * neighbour that is nearly the same.
   */
  readonly flipX?: boolean;
}

/**
 * Something that stands on the ground and is bigger than one tile: a tree, a
 * signpost, a market stall, a bridge. Props carry their own footprint, so the
 * map says `plant(x, y, 'oak')` and collision follows the art.
 */
export interface PropDefinition {
  readonly width: number;
  readonly height: number;
  /** Row-major, `width * height` cells. */
  readonly cells: readonly PropCell[];
  /** What a caption would call it. Kept beside the art so signage cannot drift. */
  readonly label: string;
}

/**
 * The eight ways a tile of ground can touch water, drawn on the land side.
 *
 * A shoreline is the one edge a map must never be asked to place by hand: it
 * changes every time a bank is nudged, and a missed piece is a bare seam.
 * `buildMapLayers` derives all of it from the collision the map already has.
 */
export interface ShoreTiles {
  /** Land with water to the south, and so on round the compass. */
  readonly waterSouth: number;
  readonly waterNorth: number;
  readonly waterEast: number;
  readonly waterWest: number;
  /** Land with water on two sides: the bank turns a corner here. */
  readonly waterNorthWest: number;
  readonly waterNorthEast: number;
  readonly waterSouthWest: number;
  readonly waterSouthEast: number;
  /** Land touching water only at a diagonal: the outside of the bank's corner. */
  readonly diagonalSouthEast: number;
  readonly diagonalSouthWest: number;
  readonly diagonalNorthEast: number;
  readonly diagonalNorthWest: number;
}

export interface ShoreRule {
  /** The material the rim is drawn against. */
  readonly material: Material;
  /** Ground the rim may be drawn over. Paving meets water at a kerb, not a beach. */
  readonly onlyOver: readonly Material[];
  readonly tiles: ShoreTiles;
}

/**
 * One image a catalogue draws from.
 *
 * A catalogue may draw from more than one, because the answer to "which sheet"
 * is different for the ground and for the things standing on it. The ground has
 * to be one palette or it reads as two games stitched together - the shipped
 * `tileset.png` is GBA Pokemon art at hue 152 and the CC0 Zelda-like sheet is
 * hue 123, which is a different colour of green rather than a different shade.
 * Objects travel between them perfectly well, which is not a guess: the sprite
 * every figure in the game is drawn from comes from the second sheet and has
 * been standing on the first sheet's grass since the first commit.
 */
export interface TileSource {
  /** The Phaser texture key this sheet is loaded under. */
  readonly textureKey: string;
  /** Path under `public/`, so the loader and the tools agree on one string. */
  readonly imagePath: string;
  readonly columns: number;
  readonly rows: number;
  /**
   * Where this sheet's tiles begin in the catalogue's own numbering. Phaser
   * calls it a firstgid: one tilemap, several images, one index space.
   */
  readonly firstIndex: number;
}

/** Numbers tiles from a sheet into a catalogue's shared index space. */
export function tileReader(source: Omit<TileSource, 'firstIndex'>, firstIndex: number) {
  const at = (column: number, row: number): number =>
    firstIndex + row * source.columns + column;
  return { source: { ...source, firstIndex }, at };
}

/**
 * The same landmark with one cell drawn from another, mirrored.
 *
 * Used where a sheet's own art is wrong rather than missing: see `flipX`.
 */
export function withMirroredCell(
  prop: PropDefinition,
  at: readonly [number, number],
  from: readonly [number, number],
): PropDefinition {
  const source = prop.cells[from[1] * prop.width + from[0]];
  const index = at[1] * prop.width + at[0];
  const target = prop.cells[index];
  if (source === undefined || target === undefined) {
    throw new Error(`mirrored cell is outside '${prop.label}'`);
  }
  return {
    ...prop,
    cells: prop.cells.map((cell, ordinal) =>
      ordinal === index ? { ...target, tile: source.tile, flipX: true } : cell,
    ),
  };
}

/**
 * The same landmark with named cells opened up to be stood on.
 *
 * A door is the one part of a building that is ground: the player walks into
 * the doorway exactly as they do in the games this is dressed as, and the
 * figure is drawn over the dark of the opening. A prop is the last word on its
 * own tiles (`buildMapLayers`), so this is all it takes.
 */
export function withDoorway(
  prop: PropDefinition,
  cells: readonly (readonly [number, number])[],
): PropDefinition {
  const opened = new Set(cells.map(([x, y]) => y * prop.width + x));
  for (const index of opened) {
    if (prop.cells[index] === undefined) {
      throw new Error(`doorway is outside '${prop.label}'`);
    }
  }
  return {
    ...prop,
    cells: prop.cells.map((cell, ordinal) =>
      opened.has(ordinal) ? { ...cell, solid: false } : cell,
    ),
  };
}

export interface TilesetCatalogue<PropName extends string = string> {
  readonly sources: readonly TileSource[];
  readonly materials: Readonly<Record<Material, MaterialTiles>>;
  readonly props: Readonly<Record<PropName, PropDefinition>>;
  /** Omitted by a sheet with no shoreline art; the bank is then a plain edge. */
  readonly shore?: ShoreRule;
}

/**
 * Which tile draws this material in this role.
 *
 * The fallback chain is deliberate and ordered by how little it lies: a missing
 * corner is drawn as the edge it is most like, a missing edge as fill. A sheet
 * that has no corner art therefore renders as a blunt-cornered mass rather than
 * as a hole, and the map still reads.
 */
const FALLBACKS: Readonly<Record<TileRole, readonly TileRole[]>> = {
  fill: [],
  'edge-n': ['fill'],
  'edge-s': ['fill'],
  'edge-e': ['fill'],
  'edge-w': ['fill'],
  'corner-nw': ['edge-n', 'edge-w', 'fill'],
  'corner-ne': ['edge-n', 'edge-e', 'fill'],
  'corner-sw': ['edge-s', 'edge-w', 'fill'],
  'corner-se': ['edge-s', 'edge-e', 'fill'],
  'inner-nw': ['fill'],
  'inner-ne': ['fill'],
  'inner-sw': ['fill'],
  'inner-se': ['fill'],
  'run-h': ['edge-n', 'fill'],
  'run-v': ['edge-w', 'fill'],
  'cap-n': ['run-v', 'edge-n', 'fill'],
  'cap-s': ['run-v', 'edge-s', 'fill'],
  'cap-e': ['run-h', 'edge-e', 'fill'],
  'cap-w': ['run-h', 'edge-w', 'fill'],
  single: ['cap-n', 'run-v', 'fill'],
};

export function resolveTile(tiles: MaterialTiles, role: TileRole): number {
  const direct = tiles.roles[role];
  if (direct !== undefined) {
    return direct;
  }
  for (const fallback of FALLBACKS[role]) {
    const tile = tiles.roles[fallback];
    if (tile !== undefined) {
      return tile;
    }
  }
  return tiles.roles.fill ?? -1;
}

/**
 * A fill tile that is sometimes a variant.
 *
 * Variation is a function of position so a map is byte-identical on every
 * build, and it is sparse: a sheet's fourteen grass tiles used evenly read as
 * noise, which is its own kind of generated.
 */
export function fillTile(tiles: MaterialTiles, x: number, y: number): number {
  const base = resolveTile(tiles, 'fill');
  const variants = tiles.fillVariants;
  if (!variants || variants.length === 0) {
    return base;
  }
  const rarity = tiles.variantRarity ?? 7;
  const hash = positionHash(x, y);
  if (hash % rarity !== 0) {
    return base;
  }
  return variants[(hash >>> 11) % variants.length];
}

/**
 * A well-mixed hash of a tile position.
 *
 * The obvious version - multiply by two odd numbers and xor - leaves the low
 * bits correlated with the inputs, and the low bits are exactly what a `% n`
 * reads, so "one tile in six" came out as one in three and in a visible
 * diagonal. Two shift-xor-multiply rounds avalanche it properly.
 */
function positionHash(x: number, y: number): number {
  let hash = (Math.imul(x, 0x27d4_eb2d) + Math.imul(y, 0x1656_67b1)) | 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2545_f491);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0x85eb_ca6b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}
