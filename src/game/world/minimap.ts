import type { GridPosition } from '../movement/gridMovement';
import type { Material } from './tileset/materials';
import type { WorldMapDefinition } from '../worldMap';

/**
 * A map drawn a whole number of game pixels to the tile, with everywhere
 * nobody has walked still dark.
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
 * greens, tans and stone so the picture reads as the map it is of; the darks
 * are the menus' backdrop blue taken down in three steps, so the unexplored
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
  /**
   * How many tiles each pixel of the picture stands for, on a side. One unless
   * the picture has less room than the map has tiles - see `fitPicture`.
   */
  readonly step?: number;
}

export interface Minimap {
  /** The picture's size in its own pixels, which is the map's size in tiles / `tilesPerPixel`. */
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

  const step = Math.max(1, Math.floor(request.step ?? 1));
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
 * How big a picture is drawn in the room a screen has for it.
 *
 * A picture is drawn at a whole number of game pixels to the tile, because a
 * pixel that is not whole is a blurred one - so it is the largest whole zoom
 * that fits. Only a room smaller than the map has tiles draws several tiles to
 * the pixel, and then the fewest that fit, condensed by `CONDENSE_ORDER` so a
 * way in or out is never lost to the ground beside it.
 *
 * What it is fitted *to* is the caller's to say, and that is the one design
 * decision in it. The wall map in Oak's Lab fits every map to the biggest one,
 * so four pictures side by side are one scale and the Floodplain reads as four
 * times Route 1 because it is; the drop-in screen shows one place at a time and
 * fits that place to the window, because what it is for is reading the place.
 */
export interface PictureFit {
  /** Tiles to a pixel of the picture, on a side. */
  readonly step: number;
  /** Game pixels to a pixel of the picture, on a side. */
  readonly zoom: number;
}

export interface PictureSize {
  readonly width: number;
  readonly height: number;
}

export function fitPicture(size: PictureSize, room: PictureSize): PictureFit {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const zoom = Math.floor(Math.min(room.width / width, room.height / height));
  if (zoom >= 1) {
    return { step: 1, zoom };
  }
  const largest = Math.max(width, height);
  let step = 2;
  while (
    step < largest &&
    (Math.ceil(width / step) > room.width || Math.ceil(height / step) > room.height)
  ) {
    step += 1;
  }
  return { step, zoom: 1 };
}

/** The size a map comes out at under a fit, in game pixels. */
export function fittedSize(size: PictureSize, fit: PictureFit): PictureSize {
  return {
    width: Math.ceil(size.width / fit.step) * fit.zoom,
    height: Math.ceil(size.height / fit.step) * fit.zoom,
  };
}

/** The characters that stand on a map rather than being the map. */
export const MINIMAP_MARKS: ReadonlySet<MinimapChar> = new Set(['i', 'I', 'X', 'O', 'H', 'K']);

/** The ink a mark is ringed with once a pixel is big enough to ring. */
export const MARK_RING = '#0b1119';

export interface PaintedPicture {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major: what an `ImageData` holds and a PNG writer takes. */
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * The picture as pixels, at a whole zoom.
 *
 * At one game pixel to the tile a mark is one pixel of its own ink, which on a
 * picture this size is all it can be. Drawn bigger, a mark earns a ring of
 * `MARK_RING` round it, a pixel wide and outside its own tile: at four screen
 * pixels to a tile an exit is a dot, and a dot of orange on a field of green
 * earth is lost, where a ringed one is a pin in a map. Every ring goes down
 * before any mark does, so two marks side by side - the tiles of one gate -
 * read as one pinned thing rather than two with a line through them.
 */
export function paintMinimap(picture: Minimap, zoom: number): PaintedPicture {
  const scale = Math.max(1, Math.floor(zoom));
  const width = picture.width * scale;
  const height = picture.height * scale;
  const data = new Uint8ClampedArray(width * height * 4);
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    const red = Number.parseInt(ink.slice(1, 3), 16);
    const green = Number.parseInt(ink.slice(3, 5), 16);
    const blue = Number.parseInt(ink.slice(5, 7), 16);
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(width, x + w); px += 1) {
        const at = (py * width + px) * 4;
        data[at] = red;
        data[at + 1] = green;
        data[at + 2] = blue;
        data[at + 3] = 255;
      }
    }
  };
  const marks: { x: number; y: number; ink: string }[] = [];
  for (let y = 0; y < picture.height; y += 1) {
    for (let x = 0; x < picture.width; x += 1) {
      const char = picture.rows[y][x];
      const ink = MINIMAP_PALETTE[char] ?? '#000000';
      if (scale > 1 && MINIMAP_MARKS.has(char)) {
        marks.push({ x: x * scale, y: y * scale, ink });
      }
      fill(x * scale, y * scale, scale, scale, ink);
    }
  }
  for (const mark of marks) {
    fill(mark.x - 1, mark.y - 1, scale + 2, scale + 2, MARK_RING);
  }
  for (const mark of marks) {
    fill(mark.x, mark.y, scale, scale, mark.ink);
  }
  return { width, height, data };
}
