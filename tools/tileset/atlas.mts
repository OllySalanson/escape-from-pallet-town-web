/**
 * The materials atlas: every material in the catalogue, drawn.
 *
 * A catalogue is a list of numbers until you look at it. This renders each
 * material as a patch big enough to show its corners, edges and one-tile runs,
 * with the constant's own name printed beside it - so a wrong index is a thing
 * you see rather than a thing you find in a map three hours later.
 *
 *   npx vite-node tools/tileset/atlas.mts -- <out.png>
 */
import { readPng, writePng, TILE_SIZE } from './tileSheet.mjs';
import { canvas, drawTile, label, box } from './draw.mjs';
import { roleFor } from '../../src/game/world/tileset/autotile';
import { fillTile, resolveTile } from '../../src/game/world/tileset/catalogue';
import { OVERWORLD_TILESET } from '../../src/game/world/tileset/overworldTileset';
import { CLASSIC_TILESET } from '../../src/game/world/tileset/classicTileset';
import { POKEMON_GROUND_TILESET } from '../../src/game/world/tileset/pokemonGround';
import { FRLG_TILESET } from '../../src/game/world/tileset/frlgTileset';
import { MATERIALS, type Material } from '../../src/game/world/tileset/materials';

const CATALOGUES = {
  frlg: FRLG_TILESET,
  overworld: OVERWORLD_TILESET,
  classic: CLASSIC_TILESET,
  'pokemon-ground': POKEMON_GROUND_TILESET,
} as const;

const [, , which = 'overworld', target = 'atlas.png'] = process.argv;
const catalogue = CATALOGUES[which as keyof typeof CATALOGUES] ?? FRLG_TILESET;
const spans = catalogue.sources.map((source) => ({
  sheet: readPng(`public/${source.imagePath}`),
  from: source.firstIndex,
  to: source.firstIndex + source.columns * source.rows,
}));
function put(image: Parameters<typeof drawTile>[0], tile: number, x: number, y: number, tint?: number) {
  if (tile < 0) return;
  const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
  if (!span) throw new Error(`tile ${tile} is on none of this catalogue's sheets`);
  drawTile(image, span.sheet, tile - span.from, x, y, tint);
}

const PATCH = 7;
const ZOOM = 3;
const GUTTER = 10;
const TEXT = 26;
const COLUMNS = 4;

const materials = Object.keys(catalogue.materials) as Material[];
const rows = Math.ceil(materials.length / COLUMNS);
const cellWidth = PATCH * TILE_SIZE * ZOOM + GUTTER;
const cellHeight = PATCH * TILE_SIZE * ZOOM + TEXT + GUTTER;
const image = canvas(COLUMNS * cellWidth + GUTTER, rows * cellHeight + GUTTER, [20, 22, 28]);

/** A patch shaped to show every role at once: a blob with a notch, a spur and a lone tile. */
const SHAPE = [
  '.#####.',
  '.##.##.',
  '.#####.',
  '...#...',
  '...#...',
  '.#...#.',
  '..###..',
];

for (const [ordinal, material] of materials.entries()) {
  const column = ordinal % COLUMNS;
  const row = Math.floor(ordinal / COLUMNS);
  const left = GUTTER + column * cellWidth;
  const top = GUTTER + row * cellHeight;

  const patch = canvas(PATCH * TILE_SIZE, PATCH * TILE_SIZE, [24, 30, 24]);
  const tiles = catalogue.materials[material];
  const ground = catalogue.materials.grass;
  const has = (x: number, y: number): boolean => SHAPE[y]?.[x] === '#';

  for (let y = 0; y < PATCH; y += 1) {
    for (let x = 0; x < PATCH; x += 1) {
      if (tiles.overlay || !has(x, y)) {
        put(patch, fillTile(ground, x, y), x, y, ground.tint);
      }
      if (!has(x, y)) continue;
      const role = roleFor({
        north: has(x, y - 1),
        south: has(x, y + 1),
        east: has(x + 1, y),
        west: has(x - 1, y),
      });
      const tile = role === 'fill' ? fillTile(tiles, x, y) : resolveTile(tiles, role);
      put(patch, tile, x, y, tiles.tint);
    }
  }

  for (let y = 0; y < patch.height * ZOOM; y += 1) {
    for (let x = 0; x < patch.width * ZOOM; x += 1) {
      const i = (Math.floor(y / ZOOM) * patch.width + Math.floor(x / ZOOM)) * 4;
      const j = ((top + TEXT + y) * image.width + left + x) * 4;
      image.data[j] = patch.data[i];
      image.data[j + 1] = patch.data[i + 1];
      image.data[j + 2] = patch.data[i + 2];
      image.data[j + 3] = 255;
    }
  }

  const traits = MATERIALS[material];
  box(image, left, top, PATCH * TILE_SIZE * ZOOM, TEXT, [12, 13, 17]);
  label(image, material, left + 3, top + 3, 2, traits.solid ? [255, 150, 150] : [170, 255, 180]);
  label(
    image,
    `FILL ${resolveTile(tiles, 'fill')}${traits.encounters ? ' GRASS' : ''}`,
    left + 3,
    top + 15,
    1,
    [200, 200, 210],
  );
}

writePng(target, image);
console.log(`${target}  ${image.width}x${image.height}  ${materials.length} materials`);
