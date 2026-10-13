/**
 * A map drawn exactly as the game draws it: the real layers from the real
 * builder, tile by tile from the sheets they name, with the same tints and
 * flips. `renderMap.mts` prints it from the command line; `tools/mapcraft`
 * draws a map program's picture with it, so a district is judged on what a
 * player will see rather than on a diagram of it.
 */
import { readPng, TILE_SIZE } from './tileSheet.mjs';
import { blit, canvas, drawTile } from './draw.mjs';
import { getWorldMap, type WorldMapId } from '../../src/game/worldMap';
import { AREA_PIECES, AREA_SHEET } from '../../src/game/world/generated/areaPieces';
import { TOWN_PIECES, TOWN_SHEET } from '../../src/game/world/generated/townPieces';
import { BERRY_TREE_SHEET } from '../../src/game/world/generated/berryTrees';
import { berryTreeFrames } from '../../src/game/world/berries';
import { switchesOn } from '../../src/game/world/switches';

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
  drawStanding(id, image, [cx, cy, cw, ch]);
  return image;
}

/**
 * What stands on a map as a figure rather than a tile, drawn as the scene
 * stands it at the start of a raid: Strength boulders, berry trees, floor
 * switches and rock barriers. People and Pokemon are left out - they move,
 * and a picture is of the place.
 */
function drawStanding(id: WorldMapId, image: MapImage, [cx, cy, cw, ch]: TileCrop): void {
  const map = getWorldMap(id);
  const inside = (x: number, y: number) => x >= cx && y >= cy && x < cx + cw && y < cy + ch;
  const piece = (
    sheet: ReturnType<typeof readPng>,
    column: number,
    row: number,
    x: number,
    y: number,
  ) => blit(image, sheet, column * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE, (x - cx) * TILE_SIZE, (y - cy) * TILE_SIZE);
  const areas = sheetFor(AREA_SHEET.imagePath);
  for (const plate of switchesOn(id)) {
    if (plate.kind !== 'plate' || !inside(plate.position.x, plate.position.y)) continue;
    const at = AREA_PIECES['cave.switch'];
    piece(areas, at.column, at.row, plate.position.x, plate.position.y);
  }
  for (const entity of map.entities) {
    const { x, y } = entity.position;
    if (!inside(x, y)) continue;
    if (entity.boulder) {
      const at = TOWN_PIECES.strengthBoulder;
      piece(sheetFor(TOWN_SHEET.imagePath), at.column, at.row, x, y);
    } else if (entity.barrier) {
      const at = AREA_PIECES['cave.barrier'];
      piece(areas, at.column, at.row + (entity.barrier.top ? 0 : 1), x, y);
    } else if (entity.berry) {
      const sheet = sheetFor(BERRY_TREE_SHEET.imagePath);
      const frame = berryTreeFrames(entity.berry).ripe[0];
      const columns = sheet.width / BERRY_TREE_SHEET.frameWidth;
      const width = BERRY_TREE_SHEET.frameWidth;
      const height = BERRY_TREE_SHEET.frameHeight;
      blit(
        image,
        sheet,
        (frame % columns) * width,
        Math.floor(frame / columns) * height,
        width,
        height,
        (x - cx) * TILE_SIZE + TILE_SIZE / 2 - width / 2,
        (y - cy + 1) * TILE_SIZE - height,
      );
    }
  }
}
