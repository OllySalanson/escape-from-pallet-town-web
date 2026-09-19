/**
 * The prop atlas: every landmark in a catalogue, drawn on grass with its
 * collision shown.
 *
 * A prop is a rectangle lifted off a sheet, and getting the rectangle wrong
 * produces half a house with a stripe of the next one down its side. That is
 * something to see, not something to find in a map three hours later. Solid
 * cells are hatched red, cells you may stand on are left clear.
 *
 *   npx vite-node tools/tileset/props.mts -- <out.png> [zoom]
 */
import { readPng, writePng, TILE_SIZE } from './tileSheet.mjs';
import { box, canvas, drawTile, label, plot, upscale } from './draw.mjs';
import { fillTile } from '../../src/game/world/tileset/catalogue';
import { FRLG_TILESET } from '../../src/game/world/tileset/frlgTileset';

const [, , target = 'props.png', zoomArgument = '3'] = process.argv;
const zoom = Number(zoomArgument);
const catalogue = FRLG_TILESET;
const spans = catalogue.sources.map((source) => ({
  sheet: readPng(`public/${source.imagePath}`),
  from: source.firstIndex,
  to: source.firstIndex + source.columns * source.rows,
}));
function put(image: ReturnType<typeof canvas>, tile: number, x: number, y: number, tint?: number) {
  if (tile < 0) return;
  const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
  if (!span) throw new Error(`tile ${tile} is on none of this catalogue's sheets`);
  drawTile(image, span.sheet, tile - span.from, x, y, tint);
}

const names = Object.keys(catalogue.props).sort();
const widest = Math.max(...names.map((name) => catalogue.props[name].width)) + 2;
const tallest = Math.max(...names.map((name) => catalogue.props[name].height)) + 2;
const COLUMNS = 8;
const rows = Math.ceil(names.length / COLUMNS);
const TEXT = 16;
const cellWidth = widest * TILE_SIZE * zoom + 8;
const cellHeight = tallest * TILE_SIZE * zoom + TEXT + 8;
const image = canvas(COLUMNS * cellWidth + 8, rows * cellHeight + 8, [20, 22, 28]);

for (const [ordinal, name] of names.entries()) {
  const prop = catalogue.props[name];
  const column = ordinal % COLUMNS;
  const row = Math.floor(ordinal / COLUMNS);
  const left = 8 + column * cellWidth;
  const top = 8 + row * cellHeight;

  const patch = canvas(widest * TILE_SIZE, tallest * TILE_SIZE, [20, 22, 28]);
  const grass = catalogue.materials.grass;
  for (let y = 0; y < tallest; y += 1) {
    for (let x = 0; x < widest; x += 1) put(patch, fillTile(grass, x, y), x, y, grass.tint);
  }
  for (let y = 0; y < prop.height; y += 1) {
    for (let x = 0; x < prop.width; x += 1) {
      const cell = prop.cells[y * prop.width + x];
      put(patch, cell.tile, x + 1, y + 1);
      if (cell.solid) {
        // Hatch the solid cells: the wall has to agree with the art.
        for (let py = 0; py < TILE_SIZE; py += 1) {
          for (let px = 0; px < TILE_SIZE; px += 1) {
            if ((px + py) % 6 !== 0) continue;
            plot(patch, (x + 1) * TILE_SIZE + px, (y + 1) * TILE_SIZE + py, [255, 80, 80], 150);
          }
        }
      }
    }
  }

  const drawn = upscale(patch, zoom);
  for (let y = 0; y < drawn.height; y += 1) {
    for (let x = 0; x < drawn.width; x += 1) {
      const i = (y * drawn.width + x) * 4;
      const j = ((top + TEXT + y) * image.width + left + x) * 4;
      image.data[j] = drawn.data[i];
      image.data[j + 1] = drawn.data[i + 1];
      image.data[j + 2] = drawn.data[i + 2];
      image.data[j + 3] = 255;
    }
  }
  box(image, left, top, drawn.width, TEXT, [12, 13, 17]);
  label(image, `${name} ${prop.width}X${prop.height}`, left + 2, top + 4, 1, [255, 214, 92]);
}

writePng(target, image);
console.log(`${target}  ${image.width}x${image.height}  ${names.length} props`);
