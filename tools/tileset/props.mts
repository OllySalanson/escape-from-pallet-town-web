/**
 * The prop atlas: every landmark in a catalogue, drawn on grass with its
 * collision shown.
 *
 * A prop is a rectangle lifted off a sheet, and getting the rectangle wrong
 * produces half a house with a stripe of the next one down its side. That is
 * something to see, not something to find in a map three hours later. Solid
 * cells are hatched red, cells you may stand on are left clear.
 *
 *   npx vite-node tools/tileset/props.mts -- <catalogue> <out.png> [zoom]
 *
 * `<catalogue>` is `frlg`, `overworld` or `flood-town`. A composed catalogue is
 * the one worth looking at: it is where an object from one sheet first stands
 * on another sheet's grass, and where a numbering clash between the two shows.
 *
 * `--only=house,barn` draws just those, which is what you want while choosing
 * between four landmarks rather than auditing a whole catalogue.
 */
import { readPng, writePng, TILE_SIZE } from './tileSheet.mjs';
import { box, canvas, drawTile, label, plot, upscale } from './draw.mjs';
import { fillTile } from '../../src/game/world/tileset/catalogue';
import type { TilesetCatalogue } from '../../src/game/world/tileset/catalogue';
import { FLOOD_TOWN_TILESET } from '../../src/game/world/tileset/floodTownTileset';
import { FRLG_TILESET } from '../../src/game/world/tileset/frlgTileset';
import { OVERWORLD_TILESET } from '../../src/game/world/tileset/overworldTileset';

const CATALOGUES: Record<string, TilesetCatalogue<string>> = {
  frlg: FRLG_TILESET,
  overworld: OVERWORLD_TILESET,
  'flood-town': FLOOD_TOWN_TILESET,
};

const args = process.argv.slice(2).filter((value) => value !== '--');
const onlyArgument = args.find((value) => value.startsWith('--only='));
const [which = 'flood-town', target = 'props.png', zoomArgument = '3'] = args.filter(
  (value) => !value.startsWith('--'),
);
/** A shortlist, so a question about four landmarks is not a 3000-pixel sheet. */
const only = onlyArgument ? new Set(onlyArgument.slice('--only='.length).split(',')) : undefined;
const zoom = Number(zoomArgument);
const catalogue = CATALOGUES[which];
if (!catalogue) throw new Error(`no catalogue '${which}': ${Object.keys(CATALOGUES).join(', ')}`);
const spans = catalogue.sources.map((source) => ({
  sheet: readPng(`public/${source.imagePath}`),
  from: source.firstIndex,
  to: source.firstIndex + source.columns * source.rows,
}));
function put(
  image: ReturnType<typeof canvas>,
  tile: number,
  x: number,
  y: number,
  tint?: number,
  flipX = false,
) {
  if (tile < 0) return;
  const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
  if (!span) throw new Error(`tile ${tile} is on none of this catalogue's sheets`);
  drawTile(image, span.sheet, tile - span.from, x, y, tint, flipX);
}

const names = Object.keys(catalogue.props)
  .filter((name) => !only || only.has(name))
  .sort();
if (names.length === 0) throw new Error('no prop matched --only=');
const widest = Math.max(...names.map((name) => catalogue.props[name].width)) + 2;
const tallest = Math.max(...names.map((name) => catalogue.props[name].height)) + 2;
const COLUMNS = Math.min(8, names.length);
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
      put(patch, cell.tile, x + 1, y + 1, undefined, cell.flipX === true);
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
