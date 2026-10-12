/**
 * A map drawn exactly as the game draws it: the real layers from the real
 * builder, tile by tile from the sheets they name, with the same tints and
 * flips. `renderMap.mts` prints it from the command line; `tools/mapcraft`
 * draws a map program's picture with it, so a district is judged on what a
 * player will see rather than on a diagram of it.
 */
import { readPng, TILE_SIZE } from './tileSheet.mjs';
import { canvas, drawTile } from './draw.mjs';
import { getWorldMap, type WorldMapId } from '../../src/game/worldMap';

export type MapImage = ReturnType<typeof canvas>;

/** A rectangle of a map in tiles: x, y, width, height. */
export type TileCrop = readonly [number, number, number, number];

const sheets = new Map<string, ReturnType<typeof readPng>>();
function sheetFor(path: string) {
  const existing = sheets.get(path);
  if (existing) return existing;
  const loaded = readPng(`public/${path}`);
  sheets.set(path, loaded);
  return loaded;
}

/** One map at one game pixel a pixel, cropped to `crop` when given. */
export function drawWorldMap(id: WorldMapId, crop?: TileCrop | null): MapImage {
  const map = getWorldMap(id);
  // A map may draw from several sheets under one numbering, exactly as the
  // scene does, so the tile has to be resolved back to the sheet it came from.
  const spans = map.tileset.sources.map((source) => ({
    sheet: sheetFor(source.imagePath),
    from: source.firstIndex,
    to: source.firstIndex + source.columns * source.rows,
  }));
  const [cx, cy, cw, ch] = crop ?? [0, 0, map.width, map.height];
  const image = canvas(cw * TILE_SIZE, ch * TILE_SIZE, [8, 10, 14]);
  const { ground, overlay, detail, canopy, brim } = map.layers;
  for (const layer of [ground, overlay, detail, canopy, brim]) {
    for (let y = cy; y < Math.min(cy + ch, map.height); y += 1) {
      for (let x = cx; x < Math.min(cx + cw, map.width); x += 1) {
        const tile = layer.tiles[y][x];
        if (tile < 0) continue;
        const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
        if (!span) throw new Error(`tile ${tile} on ${id} is on none of its sheets`);
        const tint = layer.tints[y][x];
        drawTile(
          image,
          span.sheet,
          tile - span.from,
          x - cx,
          y - cy,
          tint >= 0 ? tint : undefined,
          layer.flips[y][x],
        );
      }
    }
  }
  return image;
}
