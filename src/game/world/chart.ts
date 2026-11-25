import type { GridPosition } from '../movement/gridMovement';
import type { TileLayer } from './tiles';
import type { WorldMapDefinition } from '../worldMap';
import { cloudAt } from '../base/arenaPit';

/**
 * THE MAP that M opens (`ui/MapScreen.ts`), as pixels: the real map, drawn from
 * the very tiles the raid is drawn with and shrunk, with fog over every tile the
 * player has never stood on.
 *
 * It is the captain's pick of 25 Nov 2026 ("a real map, fog where Sam has not
 * walked ... just the tiles where Sam has walked, not the entire areas"): not
 * the drop-in screen's character art (`minimap.ts`), which is a diagram of
 * materials, and not the pit's cloud (`base/arenaPit.ts`), which hides whole
 * districts - the shape of the island shows through the fog, so it is learned,
 * and only the ground actually walked is in colour.
 *
 * Each tile is drawn `CHART_CELLS` cells a side, every cell the mean of the
 * sheet pixels it covers, layered as the scene layers them. That is the same
 * picture `tools/tileset/mapPicture.mts` draws at a pixel a pixel and then
 * shrinks, to within the rounding of a cell, but it is made from a per-tile
 * cache in a few milliseconds, in the browser, from the map as it is today - so
 * a redrawn map can never leave a stale picture. Phaser-free, so it is tested
 * without a browser; `ui/chartSheets.ts` reads the sheets' pixels for it.
 */

/** How many cells a side each tile is drawn as: a quarter of a tile, enough for a roof or a lane. */
export const CHART_CELLS = 4;

/** What a chart is drawn on where no tile is drawn at all. */
const NOTHING: readonly [number, number, number] = [8, 10, 14];

/** One sheet's pixels, under the map's numbering (`MapTilesetSource`). */
export interface ChartSheet {
  readonly firstIndex: number;
  readonly columns: number;
  readonly rows: number;
  readonly width: number;
  readonly data: Uint8ClampedArray;
}

/** A picture in plain RGBA, a cell a pixel. */
export interface ChartPicture {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

/** The rectangle of the map a chart is of, in tiles. */
export interface ChartRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const TILE_PIXELS = 16;
const SPAN = TILE_PIXELS / CHART_CELLS;
const CELL_PIXELS = SPAN * SPAN;

/**
 * Each tile's cells, worked out once: premultiplied red, green and blue and the
 * share of the cell covered, four numbers a cell, row by row. A flipped tile is
 * its own entry, because the cells of a flipped tile are not the same cells.
 */
export function tileCells(sheets: readonly ChartSheet[]): (tile: number, flipped: boolean) => Float32Array | null {
  const cache = new Map<number, Float32Array | null>();
  return (tile, flipped) => {
    const key = flipped ? -tile - 1 : tile;
    const held = cache.get(key);
    if (held !== undefined) {
      return held;
    }
    const sheet = sheets.find((each) => tile >= each.firstIndex && tile < each.firstIndex + each.columns * each.rows);
    if (!sheet) {
      cache.set(key, null);
      return null;
    }
    const at = tile - sheet.firstIndex;
    const left = (at % sheet.columns) * TILE_PIXELS;
    const top = Math.floor(at / sheet.columns) * TILE_PIXELS;
    const cells = new Float32Array(CHART_CELLS * CHART_CELLS * 4);
    for (let y = 0; y < TILE_PIXELS; y += 1) {
      for (let x = 0; x < TILE_PIXELS; x += 1) {
        const from = ((top + y) * sheet.width + left + (flipped ? TILE_PIXELS - 1 - x : x)) * 4;
        const alpha = sheet.data[from + 3] / 255;
        if (alpha === 0) {
          continue;
        }
        const cell = (Math.floor(y / SPAN) * CHART_CELLS + Math.floor(x / SPAN)) * 4;
        cells[cell] += sheet.data[from] * alpha;
        cells[cell + 1] += sheet.data[from + 1] * alpha;
        cells[cell + 2] += sheet.data[from + 2] * alpha;
        cells[cell + 3] += alpha;
      }
    }
    for (let index = 0; index < cells.length; index += 1) {
      cells[index] /= CELL_PIXELS;
    }
    cache.set(key, cells);
    return cells;
  };
}

/** The layers a chart draws, bottom first: everything a place is made of, and nothing that walks. */
const CHART_LAYERS = ['ground', 'overlay', 'detail', 'canopy', 'brim'] as const;

/** The map in `rect`, in full colour, `CHART_CELLS` cells to the tile. */
export function paintChart(
  map: Pick<WorldMapDefinition, 'layers'>,
  rect: ChartRect,
  cellsOf: (tile: number, flipped: boolean) => Float32Array | null,
): ChartPicture {
  const width = rect.width * CHART_CELLS;
  const height = rect.height * CHART_CELLS;
  const colour = new Float32Array(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    colour[index * 3] = NOTHING[0];
    colour[index * 3 + 1] = NOTHING[1];
    colour[index * 3 + 2] = NOTHING[2];
  }
  for (const name of CHART_LAYERS) {
    const layer: TileLayer = map.layers[name];
    for (let ty = 0; ty < rect.height; ty += 1) {
      const tiles = layer.tiles[rect.y + ty];
      const flips = layer.flips[rect.y + ty];
      if (!tiles) {
        continue;
      }
      for (let tx = 0; tx < rect.width; tx += 1) {
        const tile = tiles[rect.x + tx];
        if (tile === undefined || tile < 0) {
          continue;
        }
        const cells = cellsOf(tile, flips?.[rect.x + tx] === true);
        if (!cells) {
          continue;
        }
        for (let cy = 0; cy < CHART_CELLS; cy += 1) {
          const row = (ty * CHART_CELLS + cy) * width + tx * CHART_CELLS;
          for (let cx = 0; cx < CHART_CELLS; cx += 1) {
            const cell = (cy * CHART_CELLS + cx) * 4;
            const cover = cells[cell + 3];
            if (cover === 0) {
              continue;
            }
            const to = (row + cx) * 3;
            colour[to] = colour[to] * (1 - cover) + cells[cell];
            colour[to + 1] = colour[to + 1] * (1 - cover) + cells[cell + 1];
            colour[to + 2] = colour[to + 2] * (1 - cover) + cells[cell + 2];
          }
        }
      }
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = Math.round(colour[index * 3]);
    data[index * 4 + 1] = Math.round(colour[index * 3 + 1]);
    data[index * 4 + 2] = Math.round(colour[index * 3 + 2]);
    data[index * 4 + 3] = 255;
  }
  return { width, height, data };
}

/** How each tile of a chart is known: walked, beside the walk, or fog. */
export type TileLight = 'known' | 'shore' | 'fog';

/** The light of every tile of `rect`, row by row: known where `isKnown` says, a shore of one tile round it, fog beyond. */
export function chartLight(rect: ChartRect, isKnown: (tile: GridPosition) => boolean): TileLight[] {
  const known = new Uint8Array(rect.width * rect.height);
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      known[y * rect.width + x] = isKnown({ x: rect.x + x, y: rect.y + y }) ? 1 : 0;
    }
  }
  const light: TileLight[] = [];
  for (let y = 0; y < rect.height; y += 1) {
    for (let x = 0; x < rect.width; x += 1) {
      if (known[y * rect.width + x]) {
        light.push('known');
        continue;
      }
      let beside = false;
      for (let dy = -1; dy <= 1 && !beside; dy += 1) {
        for (let dx = -1; dx <= 1 && !beside; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          beside = nx >= 0 && ny >= 0 && nx < rect.width && ny < rect.height && known[ny * rect.width + nx] === 1;
        }
      }
      light.push(beside ? 'shore' : 'fog');
    }
  }
  return light;
}

/** The fog's two inks: the land under it, read as a grey of its own lightness, and the mist drifting over that. */
const FOG_LAND_DARK = [24, 26, 25] as const;
const FOG_LAND_LIGHT = [50, 54, 51] as const;
const FOG_MIST = [86, 90, 88] as const;

/**
 * How much mist stands over one tile: the pit's own cloud field
 * (`arenaPit.cloudAt`), read a tile to its pixel so a bank of mist is the size
 * of a bank of mist over the pit. Read once a tile rather than once a cell -
 * its smallest lumps are nine tiles across, so a cell would only be asking the
 * same question sixteen times, and it was the slow half of drawing the map.
 */
function mistOver(tileX: number, tileY: number): number {
  return Math.min(1, Math.max(0, (cloudAt(tileX, tileY) - 0.42) * 2.2)) * 0.6;
}

/** The whole chart under fog, worked out once a map: what every tile looks like until it is walked. */
export function foggedChart(picture: ChartPicture, rect: ChartRect): ChartPicture {
  const data = new Uint8ClampedArray(picture.data.length);
  for (let ty = 0; ty < rect.height; ty += 1) {
    for (let tx = 0; tx < rect.width; tx += 1) {
      const mist = mistOver(rect.x + tx, rect.y + ty);
      for (let cy = 0; cy < CHART_CELLS; cy += 1) {
        let at = ((ty * CHART_CELLS + cy) * picture.width + tx * CHART_CELLS) * 4;
        for (let cx = 0; cx < CHART_CELLS; cx += 1, at += 4) {
          // The land's own lightness as a grey, and the mist over it.
          const light = (picture.data[at] * 0.3 + picture.data[at + 1] * 0.59 + picture.data[at + 2] * 0.11) / 255;
          for (let channel = 0; channel < 3; channel += 1) {
            const land = FOG_LAND_DARK[channel] + (FOG_LAND_LIGHT[channel] - FOG_LAND_DARK[channel]) * light;
            data[at + channel] = land + (FOG_MIST[channel] - land) * mist;
          }
          data[at + 3] = 255;
        }
      }
    }
  }
  return { width: picture.width, height: picture.height, data };
}

/** The chart as it is seen: `picture` in colour on known ground, `fogged` everywhere else, half of each on the shore. */
export function fogChart(picture: ChartPicture, fogged: ChartPicture, rect: ChartRect, light: readonly TileLight[]): ChartPicture {
  const data = new Uint8ClampedArray(fogged.data);
  for (let cy = 0; cy < picture.height; cy += 1) {
    const row = Math.floor(cy / CHART_CELLS) * rect.width;
    for (let cx = 0; cx < picture.width; cx += 1) {
      const lit = light[row + Math.floor(cx / CHART_CELLS)];
      if (lit === 'fog') {
        continue;
      }
      const at = (cy * picture.width + cx) * 4;
      if (lit === 'known') {
        data[at] = picture.data[at];
        data[at + 1] = picture.data[at + 1];
        data[at + 2] = picture.data[at + 2];
      } else {
        data[at] = (picture.data[at] + fogged.data[at] + 1) >> 1;
        data[at + 1] = (picture.data[at + 1] + fogged.data[at + 1] + 1) >> 1;
        data[at + 2] = (picture.data[at + 2] + fogged.data[at + 2] + 1) >> 1;
      }
    }
  }
  return { width: picture.width, height: picture.height, data };
}

/** How THE MAP is looked at: close round the player, crisp, or the whole place at once. */
export type ChartZoom = 'close' | 'whole';

/** How many game pixels a tile is drawn in close up: a lane is a lane, and a walk is a road. */
export const CLOSE_TILE_GAME_PIXELS = 4;

/** How far an arrow press moves the close view, in tiles. */
export const CHART_PAN_TILES = 8;

/** Where the chart lands in a frame: device pixels a tile, and where its top-left tile is. */
export interface ChartPlacement {
  readonly tilePixels: number;
  readonly left: number;
  readonly top: number;
}

/**
 * Lays the chart in a frame `width` by `height` device pixels. The whole place
 * is fitted and centred; close up, a tile is a whole number of device pixels a
 * cell (`cellPixels`, so the picture stays crisp) and the view is centred on
 * `centre`, kept inside the map wherever the map is bigger than the frame.
 */
export function placeChart(
  rect: ChartRect,
  frame: { readonly width: number; readonly height: number },
  zoom: ChartZoom,
  centre: GridPosition,
  cellPixels: number,
): ChartPlacement {
  if (zoom === 'whole') {
    const tilePixels = Math.min(frame.width / rect.width, frame.height / rect.height);
    return {
      tilePixels,
      left: Math.round((frame.width - rect.width * tilePixels) / 2),
      top: Math.round((frame.height - rect.height * tilePixels) / 2),
    };
  }
  const tilePixels = cellPixels * CHART_CELLS;
  const along = (span: number, tiles: number, at: number): number => {
    const size = tiles * tilePixels;
    if (size <= span) {
      return Math.round((span - size) / 2);
    }
    const wanted = Math.round(span / 2 - (at + 0.5) * tilePixels);
    return Math.min(0, Math.max(span - size, wanted));
  };
  return {
    tilePixels,
    left: along(frame.width, rect.width, centre.x - rect.x),
    top: along(frame.height, rect.height, centre.y - rect.y),
  };
}

/**
 * Where the player stands on the outdoors, as the chart shows them: the tile
 * itself out of doors (and on a map of one place), and inside a building the
 * tile its way out leads to - found by walking the map's links outwards, room
 * by room, from the place they are in. Null only if no way out is linked.
 */
export function chartTileOf(
  map: Pick<WorldMapDefinition, 'width' | 'areas' | 'links'>,
  tile: GridPosition,
): GridPosition | null {
  const areas = map.areas;
  if (!areas || areas.length === 0) {
    return tile;
  }
  const inRect = (at: GridPosition, rect: ChartRect): boolean =>
    at.x >= rect.x && at.y >= rect.y && at.x < rect.x + rect.width && at.y < rect.y + rect.height;
  const areaOf = (at: GridPosition): number => areas.findIndex((area) => inRect(at, area.rect));
  const start = areaOf(tile);
  if (start <= 0) {
    return start === 0 ? tile : null;
  }
  const width = map.width;
  const crossings: { from: number; to: GridPosition }[] = [];
  for (const [key, to] of map.links ?? new Map<number, number>()) {
    const from = Math.floor(key / 4);
    crossings.push({ from: areaOf({ x: from % width, y: Math.floor(from / width) }), to: { x: to % width, y: Math.floor(to / width) } });
  }
  const seen = new Set<number>([start]);
  let frontier = [start];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const area of frontier) {
      for (const crossing of crossings) {
        if (crossing.from !== area) {
          continue;
        }
        const reached = areaOf(crossing.to);
        if (reached === 0) {
          return crossing.to;
        }
        if (reached > 0 && !seen.has(reached)) {
          seen.add(reached);
          next.push(reached);
        }
      }
    }
    frontier = next;
  }
  return null;
}
