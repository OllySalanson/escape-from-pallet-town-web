import type { GridPosition } from '../movement/gridMovement';
import type { Material } from './tileset/materials';
import type { WorldMapDefinition } from '../worldMap';

/**
 * A map drawn one game pixel to the tile, with everywhere nobody has walked
 * still dark.
 *
 * It is character art, exactly as the maps themselves are (`mapGrid.ts`): one
 * character a tile, and a palette that says what ink each character is. That is
 * not decoration - it makes the picture diffable, testable without a browser
 * and readable in a failure message, and it lets the minimap use the map's own
 * alphabet, so `T` is a tree here for the same reason it is a tree in the
 * drawing this was built from.
 *
 * Everything is derived from the live map: the materials come off the sketch
 * through `WorldMapDefinition.terrain` and solidity off its collision, so a
 * redrawn map draws a new picture on the next frame and no image can go stale.
 *
 * The dark is not blank. Blank black is a wall; what a player should feel
 * looking at an unexplored map is that there is somewhere to go. So unwalked
 * ground is quantised into blocks of `HINT_BLOCK` tiles and shaded by how much
 * of each block is solid - the river reads as a dark band, a wood as a mass,
 * open fields as the lightest dark - which gives the map a coastline and a
 * treeline without giving away a single lane, door or clearing. The tiles right
 * at the edge of what is known are lifted one step further, so the known
 * country has a shore rather than a cut edge.
 */

/** What one tile of the picture is. The ground characters are the map's own. */
export type MinimapChar = string;

/** How many tiles wide a block of the hinted dark is. */
export const HINT_BLOCK = 4;

/** How far a seeded light - an insertion, a door you opened - reaches. */
export const LIT_RADIUS = 4;

/** How far the player's own walk surveys. */
export const SURVEY_RADIUS = 3;

/**
 * The ink each character is drawn in.
 *
 * Eight grounds and three darks. The grounds are the sheet's own family of
 * greens, tans and stone so the thumbnail reads as the map it is of; the darks
 * are the lobby's backdrop blue taken down in three steps, so the unexplored
 * part of a map reads as part of the screen it is on rather than as a hole
 * punched in it.
 */
export const MINIMAP_PALETTE: Readonly<Record<MinimapChar, string>> = {
  // -- ground, in the map's own characters ---------------------------------
  '.': '#7cb15a', // grass and turf
  g: '#4a8a38', // tall grass: the ground that costs fights
  ',': '#c2a672', // earth, sand, gravel - a lane
  P: '#d2cdb2', // paving and stone - somewhere built
  w: '#79c2d6', // ford: water you can wade
  W: '#2d6ba4', // deep water
  T: '#2c5429', // wood and hedge
  C: '#7d7263', // rock, cliff, fence
  B: '#5b4c42', // the wall of a building

  // -- the dark, by what is mostly in the block behind it ------------------
  // A ramp rather than one black: open country is the lightest, a wood or a
  // wall the darkest, and water is the one dark drawn in a different colour, so
  // a river and a coastline read through the dark as themselves. What is drawn
  // is a block of `HINT_BLOCK` tiles at a time, which is coarse enough that no
  // lane, door or clearing shows through it.
  '0': '#2c4558', // open country nobody has walked
  1: '#21374a', // broken ground
  2: '#16232f', // wood, rock, wall
  3: '#1d3d5d', // shallows and banks
  4: '#22496f', // open water
  '+': '#4a7b98', // the shore of what is known

  // -- marks ---------------------------------------------------------------
  I: '#f0c454', // a way in you have
  i: '#ffffff', // the way in you are looking at
  X: '#ff8f6b', // a way out
  O: '#9be27a', // a door you opened
  H: '#b0201c', // a door somebody is holding
  K: '#8fd8ff', // a landmark you finished with, and the world kept
};

/** A mark stood on one tile of the picture, over whatever ground is there. */
export interface MinimapMark {
  readonly position: GridPosition;
  readonly char: MinimapChar;
  /** Drawn even on ground nobody has walked - a front door always is. */
  readonly always?: boolean;
}

export interface MinimapRequest {
  readonly map: Pick<WorldMapDefinition, 'width' | 'height' | 'terrain' | 'collision'>;
  /** Tiles walked in some raid, as row-major indices at the map's width. */
  readonly surveyed?: ReadonlySet<number>;
  /** Ground that is known without being walked: your own doors, the ones you opened. */
  readonly lit?: readonly GridPosition[];
  readonly marks?: readonly MinimapMark[];
}

export interface Minimap {
  /** The picture's size in game pixels, which is the map's size in tiles / `tilesPerPixel`. */
  readonly width: number;
  readonly height: number;
  /** How many tiles of the map each pixel of the picture stands for. */
  readonly tilesPerPixel: number;
  /** One character a tile, top row first. */
  readonly rows: readonly string[];
  /** Tiles of the map that are known, and how many there are to know. */
  readonly known: number;
  readonly walkable: number;
  /** Walkable tiles that are known: what "how much have I seen" is counted in. */
  readonly knownWalkable: number;
}

const GROUND: Readonly<Record<Material, MinimapChar>> = {
  grass: '.',
  turf: '.',
  'tall-grass': 'g',
  earth: ',',
  sand: ',',
  gravel: ',',
  beach: ',',
  paving: 'P',
  stone: 'P',
  ford: 'w',
  water: 'W',
  hedge: 'T',
  tree: 'T',
  cliff: 'C',
  fence: 'C',
  wall: 'B',
};

/**
 * What a tile is drawn as. A prop stands on ground - a wood is grass with trees
 * planted on it - so the material alone would draw Viridian Forest as a lawn:
 * a walkable material that the collision says is solid is the thing standing on
 * it, and takes the growth or the wall ink that goes with its ground.
 */
function groundChar(material: Material, solid: boolean): MinimapChar {
  const char = GROUND[material];
  if (!solid || char === 'T' || char === 'C' || char === 'B' || char === 'W') {
    return char;
  }
  return char === 'P' ? 'B' : 'T';
}

const within = (radius: number, dx: number, dy: number): boolean =>
  dx * dx + dy * dy <= radius * radius + 1;

/** Every tile within `radius` of `centre`, as row-major indices. */
export function tilesAround(
  centre: GridPosition,
  radius: number,
  width: number,
  height: number,
): readonly number[] {
  const tiles: number[] = [];
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = centre.x + dx;
      const y = centre.y + dy;
      if (x < 0 || y < 0 || x >= width || y >= height || !within(radius, dx, dy)) {
        continue;
      }
      tiles.push(y * width + x);
    }
  }
  return tiles;
}

export function buildMinimap(request: MinimapRequest): Minimap {
  const { map } = request;
  const { width, height } = map;
  const known = new Set(request.surveyed ?? []);
  for (const point of request.lit ?? []) {
    for (const tile of tilesAround(point, LIT_RADIUS, width, height)) {
      known.add(tile);
    }
  }

  // What is mostly in each block of the dark, counted once rather than per
  // tile. Water is counted apart from the rest of what is solid because a
  // coastline is the shape most worth hinting at: a wood and a river are both
  // walls, and a map whose dark told them apart by nothing would be a mass with
  // no geography in it.
  const blockCols = Math.ceil(width / HINT_BLOCK);
  const blockSolid = new Uint32Array(blockCols * Math.ceil(height / HINT_BLOCK));
  const blockWater = new Uint32Array(blockSolid.length);
  const blockTotal = new Uint32Array(blockSolid.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const block = Math.floor(y / HINT_BLOCK) * blockCols + Math.floor(x / HINT_BLOCK);
      blockTotal[block] += 1;
      if (map.collision[y][x]) {
        blockSolid[block] += 1;
      }
      const material = map.terrain[y][x];
      if (material === 'water' || material === 'ford') {
        blockWater[block] += 1;
      }
    }
  }

  const marks = new Map<number, MinimapMark>();
  for (const mark of request.marks ?? []) {
    marks.set(mark.position.y * width + mark.position.x, mark);
  }

  let walkable = 0;
  let knownWalkable = 0;
  const rows: string[] = [];
  for (let y = 0; y < height; y += 1) {
    let row = '';
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const solid = map.collision[y][x];
      if (!solid) {
        walkable += 1;
      }
      const lit = known.has(index);
      if (lit && !solid) {
        knownWalkable += 1;
      }
      const mark = marks.get(index);
      if (mark && (lit || mark.always)) {
        row += mark.char;
        continue;
      }
      if (lit) {
        row += groundChar(map.terrain[y][x], solid);
        continue;
      }
      // Unwalked. A tile beside somewhere known is the shore of it; everything
      // else takes its block's shade, so what shows through the dark is mass
      // and coastline and never a lane.
      const beside =
        known.has(index - 1) ||
        known.has(index + 1) ||
        known.has(index - width) ||
        known.has(index + width);
      if (beside) {
        row += '+';
        continue;
      }
      const block = Math.floor(y / HINT_BLOCK) * blockCols + Math.floor(x / HINT_BLOCK);
      const total = blockTotal[block] === 0 ? 1 : blockTotal[block];
      const water = blockWater[block] / total;
      const share = blockSolid[block] / total;
      row +=
        water >= 0.5 ? '4' : water >= 0.25 ? '3' : share >= 0.7 ? '2' : share >= 0.35 ? '1' : '0';
    }
    rows.push(row);
  }

  const step = tilesPerPixel(map);
  const picture = step === 1 ? rows : condense(rows, step);
  return {
    width: picture[0]?.length ?? 0,
    height: picture.length,
    tilesPerPixel: step,
    rows: picture,
    known: known.size,
    walkable,
    knownWalkable,
  };
}

/**
 * The banner the lobby draws this in is a fixed size, and a picture bigger than
 * it would be clipped rather than scaled - so a map too big for it is drawn at
 * two tiles to the pixel, or four, until it fits.
 *
 * It is not a scale chosen per map to fill the box: the first thing a player
 * should read off these pictures is that one map is four times another, and
 * sizing them all alike would take that away. What it is instead is the
 * coarsest step that keeps the biggest map inside the frame - and the dark is
 * already quantised into blocks of `HINT_BLOCK` tiles, so at two tiles to the
 * pixel nothing in the picture was ever finer than the picture is. The two
 * sides are asked separately because the banner is not square: a route is
 * taller than it is wide and the pane is wider than it is tall.
 */
export function tilesPerPixel(map: { readonly width: number; readonly height: number }): number {
  return Math.max(
    1,
    Math.ceil(map.width / MINIMAP_MAX_WIDTH),
    Math.ceil(map.height / MINIMAP_MAX_HEIGHT),
  );
}

/**
 * What a block of tiles is drawn as when several of them share a pixel: the
 * one thing in it a player most needs to see. A way in or a way out is never
 * lost to the ground beside it, known ground beats the dark, and water beats
 * the rest of the dark, because a coastline is what the dark is for.
 */
const CONDENSE_ORDER: readonly MinimapChar[] = [
  'i', 'I', 'X', 'O', 'K', 'H', '*',
  'W', 'w', 'P', 'B', 'C', ',', 'g', '.', 'T',
  '+', '4', '3', '2', '1', '0',
];

function condense(rows: readonly string[], step: number): string[] {
  const rank = new Map(CONDENSE_ORDER.map((char, index) => [char, index]));
  const out: string[] = [];
  for (let y = 0; y < rows.length; y += step) {
    let row = '';
    for (let x = 0; x < rows[y].length; x += step) {
      let best = rows[y][x];
      for (let dy = 0; dy < step; dy += 1) {
        for (let dx = 0; dx < step; dx += 1) {
          const char = rows[y + dy]?.[x + dx];
          if (char === undefined) {
            continue;
          }
          if ((rank.get(char) ?? 99) < (rank.get(best) ?? 99)) {
            best = char;
          }
        }
      }
      row += best;
    }
    out.push(row);
  }
  return out;
}

/**
 * One game pixel to the tile wherever a map fits in the banner, and two where
 * it does not.
 *
 * Scaling each map to fill the same box would make the Floodplain and Route 1
 * the same size on screen, and the first thing a player should read off these
 * pictures is that one of them is four times the other. So the step is the
 * same for every map that fits and only coarsens for one that cannot: Pallet
 * Town, Route 1 and Viridian Forest are all drawn tile for tile, and only the
 * Floodplain at 128 tiles square goes to two, coming out 64 pixels square -
 * the size it was when it was 64 tiles across, and still visibly the biggest
 * picture in the lobby.
 */
export const MINIMAP_TILE = 1;

/**
 * What the lobby's banner can draw without clipping. It is 100 game pixels
 * tall (the `.dropin-layout` rows in `style.css`), of which the picture's own
 * lid and frame take 24, and the pane it sits in is 64 across.
 */
export const MINIMAP_MAX_WIDTH = 64;
export const MINIMAP_MAX_HEIGHT = 76;
