/**
 * Draws a map exactly as the game draws it, to a PNG.
 *
 * Viridian Forest shipped with no forest in it because nobody could see what
 * they had authored. This reads the real `WORLD_MAPS` data through the real
 * layer builder, so what it prints is what the scene prints - the same tiles,
 * the same four bands, the same tints - and a map can be criticised before it
 * is played.
 *
 *   npx vite-node tools/tileset/renderMap.mts -- <map-id|all> <out.png> [zoom]
 *
 * Pass `--grid` for tile coordinates every four tiles, `--content` to mark the
 * insertion, exits, landmarks, loot, signs and trainers on top, and
 * `--crop=x,y,w,h` in tiles to look at one district close up.
 */
import { readPng, writePng, TILE_SIZE } from './tileSheet.mjs';
import { blit, box, canvas, drawTile, label, plot, upscale } from './draw.mjs';
import { WORLD_MAPS, type WorldMapId } from '../../src/game/worldMap';
import { EXTRACTION_POINTS } from '../../src/game/world/extractionPoints';
import { RUN_INSERTIONS } from '../../src/game/run/runGeneration';
import { RAID_CONTRACTS } from '../../src/game/objectives/contracts';
import { createRunTrainerEncounters } from '../../src/game/world/trainers';

const args = process.argv.slice(2);
const flags = new Set(args.filter((value) => value.startsWith('--')));
const cropFlag = args.find((value) => value.startsWith('--crop='));
const crop = cropFlag ? cropFlag.slice(7).split(',').map(Number) : null;
const [which = 'all', target = 'map.png', zoomArgument = '2'] = args.filter(
  (value) => !value.startsWith('--'),
);
const zoom = Number(zoomArgument);

const sheets = new Map<string, ReturnType<typeof readPng>>();
function sheetFor(path: string) {
  const existing = sheets.get(path);
  if (existing) return existing;
  const loaded = readPng(`public/${path}`);
  sheets.set(path, loaded);
  return loaded;
}

function renderMap(id: WorldMapId) {
  const map = WORLD_MAPS[id];
  // A map may draw from several sheets under one numbering, exactly as the
  // scene does, so the tile has to be resolved back to the sheet it came from.
  const spans = map.tileset.sources.map((source) => ({
    sheet: sheetFor(source.imagePath),
    from: source.firstIndex,
    to: source.firstIndex + source.columns * source.rows,
  }));
  const [cx, cy, cw, ch] = crop ?? [0, 0, map.width, map.height];
  const image = canvas(cw * TILE_SIZE, ch * TILE_SIZE, [8, 10, 14]);
  const { ground, overlay, detail, canopy } = map.layers;
  for (const layer of [ground, overlay, detail, canopy]) {
    for (let y = cy; y < Math.min(cy + ch, map.height); y += 1) {
      for (let x = cx; x < Math.min(cx + cw, map.width); x += 1) {
        const tile = layer.tiles[y][x];
        if (tile < 0) continue;
        const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
        if (!span) throw new Error(`tile ${tile} on ${id} is on none of its sheets`);
        const tint = layer.tints[y][x];
        drawTile(image, span.sheet, tile - span.from, x - cx, y - cy, tint >= 0 ? tint : undefined);
      }
    }
  }
  return image;
}

const MARKS: Record<string, [string, [number, number, number]]> = {
  insertion: ['IN', [120, 240, 255]],
  exit: ['EX', [255, 120, 120]],
  poi: ['PO', [255, 214, 92]],
  contract: ['CO', [190, 140, 255]],
  loot: ['LT', [160, 255, 160]],
  sign: ['SI', [220, 220, 220]],
  trainer: ['TR', [255, 160, 80]],
};

function annotate(image: ReturnType<typeof canvas>, id: WorldMapId, scale: number) {
  const map = WORLD_MAPS[id];
  const [ox, oy] = crop ?? [0, 0];
  const marks: { x: number; y: number; kind: keyof typeof MARKS }[] = [];
  for (const insertion of Object.values(RUN_INSERTIONS)) {
    if (insertion.mapId === id) marks.push({ ...insertion.position, kind: 'insertion' });
  }
  for (const point of EXTRACTION_POINTS) {
    if (point.mapId === id) marks.push({ ...point.position, kind: 'exit' });
  }
  for (const poi of map.pois) marks.push({ ...poi.position, kind: 'poi' });
  for (const contract of RAID_CONTRACTS) {
    if (contract.mapId !== id) continue;
    for (const marker of contract.markers) marks.push({ ...marker.position, kind: 'contract' });
  }
  for (const loot of map.loot) marks.push({ ...loot.position, kind: 'loot' });
  for (const entity of map.entities) marks.push({ ...entity.position, kind: 'sign' });
  for (const trainer of createRunTrainerEncounters()) {
    if (trainer.mapId === id) marks.push({ ...trainer.position, kind: 'trainer' });
  }
  for (const mark of marks) {
    const [text, colour] = MARKS[mark.kind];
    const left = (mark.x - ox) * TILE_SIZE * scale;
    const top = (mark.y - oy) * TILE_SIZE * scale;
    for (let i = 0; i < TILE_SIZE * scale; i += 1) {
      plot(image, left + i, top, colour);
      plot(image, left + i, top + TILE_SIZE * scale - 1, colour);
      plot(image, left, top + i, colour);
      plot(image, left + TILE_SIZE * scale - 1, top + i, colour);
    }
    label(image, text, left + 2, top + 2, Math.max(1, Math.floor(scale / 2)), colour);
  }
}

function gridLines(image: ReturnType<typeof canvas>, id: WorldMapId, scale: number) {
  const map = WORLD_MAPS[id];
  const [ox, oy, cw = map.width, ch = map.height] = crop ?? [0, 0, map.width, map.height];
  const ink: [number, number, number] = [255, 255, 255];
  for (let x = ox; x <= ox + cw; x += 4) {
    for (let y = 0; y < image.height; y += 1) plot(image, (x - ox) * TILE_SIZE * scale, y, ink, 44);
  }
  for (let y = oy; y <= oy + ch; y += 4) {
    for (let x = 0; x < image.width; x += 1) plot(image, x, (y - oy) * TILE_SIZE * scale, ink, 44);
  }
  for (let x = ox; x < ox + cw; x += 4) {
    label(image, x, (x - ox) * TILE_SIZE * scale + 2, 2, Math.max(1, Math.floor(scale / 2)), ink);
  }
  for (let y = oy + 4; y < oy + ch; y += 4) {
    label(image, y, 2, (y - oy) * TILE_SIZE * scale + 2, Math.max(1, Math.floor(scale / 2)), ink);
  }
}

const ids = which === 'all' ? (Object.keys(WORLD_MAPS) as WorldMapId[]) : [which as WorldMapId];
const rendered = ids.map((id) => ({ id, image: upscale(renderMap(id), zoom) }));
for (const { id, image } of rendered) {
  if (flags.has('--grid')) gridLines(image, id, zoom);
  if (flags.has('--content')) annotate(image, id, zoom);
}

const gap = 16;
const width = rendered.reduce((total, { image }) => total + image.width + gap, gap);
const height = Math.max(...rendered.map(({ image }) => image.height)) + 30;
const sheetImage = canvas(width, height, [16, 18, 24]);
let cursor = gap;
for (const { id, image } of rendered) {
  blit(sheetImage, image, 0, 0, image.width, image.height, cursor, 26);
  box(sheetImage, cursor, 4, image.width, 18, [16, 18, 24]);
  label(sheetImage, id, cursor + 2, 8, 2, [255, 214, 92]);
  cursor += image.width + gap;
}
writePng(target, sheetImage);
console.log(`${target}  ${sheetImage.width}x${sheetImage.height}  ${ids.join(', ')}`);
