import { roleFor } from './tileset/autotile';
import {
  fillTile,
  resolveTile,
  type ShoreTiles,
  type TilesetCatalogue,
} from './tileset/catalogue';
import { MATERIALS, type Material } from './tileset/materials';
import type { MapSketch } from './mapGrid';
import type { Rect } from './interiors';

/**
 * A finished sketch plus a tileset catalogue becomes the layers the world scene
 * draws and the collision the engine walks.
 *
 * Nothing here knows a tile number. Materials come off the sketch, the
 * catalogue says which tile draws a material in a given role, and the role is
 * read off the neighbours - so edges, corners and shorelines are derived rather
 * than placed, and a map cannot ship with a bare seam in it.
 */

export interface TileLayer {
  readonly tiles: number[][];
  /** -1 where the tile is drawn exactly as the art has it. */
  readonly tints: number[][];
}

export interface MapLayers {
  /** The opaque base: what the tile is made of. */
  readonly ground: TileLayer;
  /** Growth and structure standing on the ground, under every figure. */
  readonly overlay: TileLayer;
  /** Planted landmarks, under every figure. */
  readonly detail: TileLayer;
  /** The part of a landmark a figure walks behind - a tree's crown. */
  readonly canopy: TileLayer;
  /**
   * The lid over an interior, in two layers because it has to be **opaque**
   * (`interiors.ts`). Every wall material on this sheet is an *overlay* - one
   * rock or one bush drawn over whatever ground is beneath it - so a lid drawn
   * from one of them alone is a rock field with the cave's own floor showing
   * between the stones. `roofGround` is the hillside and `roof` is what is
   * standing on it. Both are blank on a map with no interior, which is every
   * map but one.
   */
  readonly roofGround: TileLayer;
  readonly roof: TileLayer;
  readonly collision: boolean[][];
  readonly tallGrass: boolean[][];
}

const NONE = -1;

function blankLayer(width: number, height: number): TileLayer {
  return {
    tiles: Array.from({ length: height }, () => Array<number>(width).fill(NONE)),
    tints: Array.from({ length: height }, () => Array<number>(width).fill(NONE)),
  };
}

/**
 * What an overlay material stands on.
 *
 * A hedge is growth on ground, not ground, so something has to be drawn under
 * it. Taking the commonest solid-free neighbour means a fence across a causeway
 * has earth beneath it and the same fence across a bank has grass, with nothing
 * in the map having to say so.
 */
function groundUnder(
  sketch: MapSketch,
  catalogue: TilesetCatalogue,
  x: number,
  y: number,
): Material {
  const tally = new Map<Material, number>();
  for (const [dx, dy] of [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ] as const) {
    const neighbour = sketch.materialAt(x + dx, y + dy);
    if (neighbour === undefined || catalogue.materials[neighbour].overlay) {
      continue;
    }
    if (neighbour === 'water') {
      continue;
    }
    tally.set(neighbour, (tally.get(neighbour) ?? 0) + 1);
  }
  let best: Material = 'grass';
  let bestCount = 0;
  for (const [material, count] of tally) {
    // Ties go to the built surface: a fence laid across a lane belongs on the
    // lane rather than on the grass it separates, and grass is the fallback
    // already, so preferring it twice would be preferring it always.
    const wins = count > bestCount || (count === bestCount && best === 'grass' && material !== 'grass');
    if (wins) {
      best = material;
      bestCount = count;
    }
  }
  return best;
}

/** Which of the eight shoreline pieces this tile of bank is. */
export function shoreTile(
  tiles: ShoreTiles,
  water: {
    readonly north: boolean;
    readonly south: boolean;
    readonly east: boolean;
    readonly west: boolean;
    readonly northEast: boolean;
    readonly northWest: boolean;
    readonly southEast: boolean;
    readonly southWest: boolean;
  },
): number {
  const { north, south, east, west } = water;
  if (north && west) return tiles.waterNorthWest;
  if (north && east) return tiles.waterNorthEast;
  if (south && west) return tiles.waterSouthWest;
  if (south && east) return tiles.waterSouthEast;
  if (north) return tiles.waterNorth;
  if (south) return tiles.waterSouth;
  if (east) return tiles.waterEast;
  if (west) return tiles.waterWest;
  // Only a corner touches the water: the bank turns around it.
  if (water.southEast) return tiles.diagonalSouthEast;
  if (water.southWest) return tiles.diagonalSouthWest;
  if (water.northEast) return tiles.diagonalNorthEast;
  if (water.northWest) return tiles.diagonalNorthWest;
  return NONE;
}

export function buildMapLayers(
  sketch: MapSketch,
  catalogue: TilesetCatalogue,
  roofs: readonly RoofPatch[] = [],
): MapLayers {
  const { width, height } = sketch;
  const surface = Array.from({ length: height }, (_row, y) =>
    Array.from({ length: width }, (_column, x) => sketch.surfaceAt(x, y)),
  );
  const materialAt = (x: number, y: number): Material | undefined => surface[y]?.[x];

  const ground = blankLayer(width, height);
  const overlay = blankLayer(width, height);
  const detail = blankLayer(width, height);
  const canopy = blankLayer(width, height);
  const roofGround = blankLayer(width, height);
  const roof = blankLayer(width, height);
  const collision = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
  const tallGrass = Array.from({ length: height }, () => Array<boolean>(width).fill(false));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const material = surface[y][x];
      const traits = MATERIALS[material];
      collision[y][x] = traits.solid;
      tallGrass[y][x] = traits.encounters;

      const tiles = catalogue.materials[material];
      const isOverlay = tiles.overlay === true;
      const base = isOverlay ? groundUnder(sketch, catalogue, x, y) : material;
      const baseTiles = catalogue.materials[base];
      ground.tiles[y][x] = fillTile(baseTiles, x, y);
      if (baseTiles.tint !== undefined) {
        ground.tints[y][x] = baseTiles.tint;
      }

      if (!isOverlay && material !== base) {
        continue;
      }
      if (!isOverlay) {
        // A non-overlay material still wants its own edges: water, cliff and
        // paving all change tile where they stop. The diagonals are asked too,
        // because a lane that turns a corner is whole on all four sides and
        // missing only a diagonal: without them that tile drew as plain fill,
        // and the fringe either side of it stopped dead in a square notch.
        const joins = tiles.joins ?? [];
        const continues = (dx: number, dy: number): boolean =>
          materialAt(x + dx, y + dy) === material ||
          joins.includes(materialAt(x + dx, y + dy) as Material) ||
          x + dx < 0 ||
          y + dy < 0 ||
          x + dx >= width ||
          y + dy >= height;
        const role = roleFor({
          north: continues(0, -1),
          south: continues(0, 1),
          east: continues(1, 0),
          west: continues(-1, 0),
          northEast: continues(1, -1),
          northWest: continues(-1, -1),
          southEast: continues(1, 1),
          southWest: continues(-1, 1),
        });
        if (role !== 'fill') {
          ground.tiles[y][x] = resolveTile(tiles, role);
        }
        continue;
      }

      const same = (dx: number, dy: number): boolean => materialAt(x + dx, y + dy) === material;
      const role = roleFor({
        north: same(0, -1),
        south: same(0, 1),
        east: same(1, 0),
        west: same(-1, 0),
      });
      overlay.tiles[y][x] = role === 'fill' ? fillTile(tiles, x, y) : resolveTile(tiles, role);
      if (tiles.tint !== undefined) {
        overlay.tints[y][x] = tiles.tint;
      }
    }
  }

  applyShoreline(sketch, catalogue, surface, ground);
  plantProps(sketch, catalogue, detail, canopy, collision, tallGrass);
  paintRoofs(catalogue, roofs, roofGround, roof);

  return { ground, overlay, detail, canopy, roofGround, roof, collision, tallGrass };
}

/**
 * One interior's lid: the rectangle it covers, and what it draws on each tile
 * of it - a ground, optionally with a wall standing on it, or nothing at all
 * where the hill has a mouth in it. The drawing lives with the interior
 * (`interiors.ts`); this only paints it.
 */
export interface RoofPatch {
  readonly area: Rect;
  readonly at: (
    x: number,
    y: number,
  ) => { readonly ground: Material; readonly standing: Material | null } | null;
}

/**
 * Paints each interior's lid through the ordinary autotiler.
 *
 * A roof is not a new kind of art: it is the materials the sheet already draws,
 * asked for their own edges and corners against what the lid itself draws - so
 * a scree apron takes its rim from where the scree stops rather than from
 * whatever the cave is cut through. Collision is untouched on purpose: the rock
 * the passages are driven through is solid because the *sketch* drew it solid,
 * and the lid is only ever a picture. That is what keeps every structural rule
 * and the hunter's search looking at exactly the map they looked at before.
 */
function paintRoofs(
  catalogue: TilesetCatalogue,
  roofs: readonly RoofPatch[],
  roofGround: TileLayer,
  roof: TileLayer,
): void {
  for (const patch of roofs) {
    const { area } = patch;
    // A lid's ground takes its edges from the lid, not from the map beneath:
    // a hill has a rim where it stops, and a scree apron inside one does not
    // want the shoreline of whatever the cave is cut through.
    const drawn = (x: number, y: number): Material | null => patch.at(x, y)?.ground ?? null;
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) {
        if (y < 0 || x < 0 || y >= roof.tiles.length || x >= roof.tiles[y].length) {
          throw new Error(`roof at ${area.x},${area.y} runs off the map`);
        }
        const cell = patch.at(x, y);
        // A mouth is left bare in both layers: from outside it is the one gap
        // in the hill, which is the whole of how a cave is ever found.
        if (cell === null) {
          continue;
        }
        const ground = catalogue.materials[cell.ground];
        const same = (dx: number, dy: number): boolean => drawn(x + dx, y + dy) === cell.ground;
        const role = roleFor({
          north: same(0, -1),
          south: same(0, 1),
          east: same(1, 0),
          west: same(-1, 0),
          northEast: same(1, -1),
          northWest: same(-1, -1),
          southEast: same(1, 1),
          southWest: same(-1, 1),
        });
        roofGround.tiles[y][x] = role === 'fill' ? fillTile(ground, x, y) : resolveTile(ground, role);
        if (ground.tint !== undefined) {
          roofGround.tints[y][x] = ground.tint;
        }
        if (cell.standing === null) {
          continue;
        }
        const standing = catalogue.materials[cell.standing];
        roof.tiles[y][x] = fillTile(standing, x, y);
        if (standing.tint !== undefined) {
          roof.tints[y][x] = standing.tint;
        }
      }
    }
  }
}

function applyShoreline(
  sketch: MapSketch,
  catalogue: TilesetCatalogue,
  surface: Material[][],
  ground: TileLayer,
): void {
  const shore = catalogue.shore;
  if (!shore) {
    return;
  }
  const { width, height } = sketch;
  const allowed = new Set<Material>(shore.onlyOver);
  const isShoreable = (x: number, y: number): boolean => {
    const material = surface[y]?.[x];
    if (material === undefined) {
      return false;
    }
    if (allowed.has(material)) {
      return true;
    }
    // Growth standing on shoreable ground is shoreable too: a reed bed at the
    // water's edge has a bank under it like anything else.
    return catalogue.materials[material].overlay === true;
  };
  const isWater = (x: number, y: number): boolean => surface[y]?.[x] === shore.material;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isShoreable(x, y)) {
        continue;
      }
      const tile = shoreTile(shore.tiles, {
        north: isWater(x, y - 1),
        south: isWater(x, y + 1),
        east: isWater(x + 1, y),
        west: isWater(x - 1, y),
        northEast: isWater(x + 1, y - 1),
        northWest: isWater(x - 1, y - 1),
        southEast: isWater(x + 1, y + 1),
        southWest: isWater(x - 1, y + 1),
      });
      if (tile !== NONE) {
        ground.tiles[y][x] = tile;
      }
    }
  }
}

function plantProps(
  sketch: MapSketch,
  catalogue: TilesetCatalogue,
  detail: TileLayer,
  canopy: TileLayer,
  collision: boolean[][],
  tallGrass: boolean[][],
): void {
  for (const planted of sketch.props()) {
    const prop = catalogue.props[planted.name];
    if (!prop) {
      throw new Error(`no prop named '${planted.name}' in this tileset`);
    }
    for (let row = 0; row < prop.height; row += 1) {
      for (let column = 0; column < prop.width; column += 1) {
        const cell = prop.cells[row * prop.width + column];
        if (cell.tile === NONE) {
          continue;
        }
        const x = planted.x + column;
        const y = planted.y + row;
        if (x < 0 || y < 0 || y >= collision.length || x >= collision[y].length) {
          throw new Error(`prop '${planted.name}' at ${planted.x},${planted.y} runs off the map`);
        }
        const layer = cell.canopy ? canopy : detail;
        layer.tiles[y][x] = cell.tile;
        // A canopy is drawn *over* the figures, so a figure can be under it:
        // the crown of a tree may never also be a wall. Enforced here rather
        // than trusted to each catalogue, because the two contradict silently.
        if (cell.canopy) {
          continue;
        }
        // Anything else a landmark draws is the last word on its own tile. A
        // solid cell is a wall; a cell the catalogue marks as one you may stand
        // on is ground, whatever is under it - the deck of a bridge is laid
        // over water, and a deck the river still blocked is a drawing of a
        // bridge. Crowns are left out above for the opposite reason: they hang
        // over things, and a tree on the map's edge must not open the edge.
        collision[y][x] = cell.solid;
        if (!cell.solid) {
          tallGrass[y][x] = false;
        }
      }
    }
  }
}
