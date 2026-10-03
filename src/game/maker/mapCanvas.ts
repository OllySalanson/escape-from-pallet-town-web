import { publicAssetUrl } from '../publicAssetUrl';
import { TILE_SIZE } from '../worldMap';
import type { MapFile } from '../world/mapFile';
import { sketchMapFile } from '../world/mapFile';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import { KANTO_TILESET } from '../world/tileset/kantoTileset';
import { buildingSize, type GridPoint, type ThingRef } from './draft';

/**
 * Draws a map file onto a canvas exactly as the game will draw it.
 *
 * The picture is the game's own layer builder run on the draft (`buildMapLayers`
 * on the file's sketch, the same call `getWorldMap` makes), blitted from the
 * same Kanto sheets the raid scene draws from - so the edges, corners, whole
 * trees and building roofs the maker sees are the ones a raid on the map shows.
 * A whole 128x128 map builds in about twenty milliseconds, so it is simply
 * rebuilt after every stroke rather than patched.
 */

const sheets = new Map<string, HTMLImageElement>();

/** Loads the sheets the Kanto catalogue draws from, once. */
export function loadMakerSheets(): Promise<void> {
  return Promise.all(
    KANTO_TILESET.sources.map(
      (source) =>
        new Promise<void>((resolve) => {
          if (sheets.has(source.imagePath)) {
            resolve();
            return;
          }
          const image = new Image();
          image.onload = () => resolve();
          // A sheet that will not load leaves a hole in the picture rather
          // than an editor that never opens.
          image.onerror = () => resolve();
          image.src = publicAssetUrl(source.imagePath);
          sheets.set(source.imagePath, image);
        }),
    ),
  ).then(() => undefined);
}

export function layersFor(file: MapFile): MapLayers {
  return buildMapLayers(sketchMapFile(file), KANTO_TILESET);
}

/** Colours for what is placed on the map, the same three the drop-in screen marks them in. */
const MARK_COLOURS = {
  'drop-in': '#5fd6f0',
  exit: '#ff7a6b',
  item: '#8fe08a',
  building: '#ffd65c',
} as const;

/**
 * Each place is a frame and a glyph in its own colour - a way in is an arrow
 * pointing down onto the tile, a way out a cross, a find a gem - drawn in whole
 * pixels of the tile rather than in text, which the game's face cannot set this
 * small.
 */
const MARK_GLYPHS: Readonly<Record<'drop-in' | 'exit' | 'item', readonly string[]>> = {
  'drop-in': ['#######', '.#####.', '..###..', '...#...'],
  exit: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  item: ['..#..', '.###.', '#####', '.###.', '..#..'],
};

/** Draws the whole map, then everything placed on it. */
export function drawMap(
  context: CanvasRenderingContext2D,
  file: MapFile,
  layers: MapLayers,
  selected: ThingRef | undefined,
): void {
  const { canvas } = context;
  const width = file.width * TILE_SIZE;
  const height = file.height * TILE_SIZE;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#0b1220';
  context.fillRect(0, 0, width, height);
  const spans = KANTO_TILESET.sources.map((source) => ({
    image: sheets.get(source.imagePath),
    from: source.firstIndex,
    to: source.firstIndex + source.columns * source.rows,
    columns: source.columns,
  }));
  for (const layer of [layers.ground, layers.overlay, layers.detail, layers.canopy, layers.brim]) {
    for (let y = 0; y < file.height; y += 1) {
      const row = layer.tiles[y];
      for (let x = 0; x < file.width; x += 1) {
        const tile = row[x];
        if (tile < 0) {
          continue;
        }
        const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
        if (!span?.image?.complete || span.image.naturalWidth === 0) {
          continue;
        }
        const index = tile - span.from;
        const sx = (index % span.columns) * TILE_SIZE;
        const sy = Math.floor(index / span.columns) * TILE_SIZE;
        if (layer.flips[y][x]) {
          context.save();
          context.translate((x + 1) * TILE_SIZE, y * TILE_SIZE);
          context.scale(-1, 1);
          context.drawImage(span.image, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
          context.restore();
        } else {
          context.drawImage(span.image, sx, sy, TILE_SIZE, TILE_SIZE, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }
  }
  const mark = (kind: keyof typeof MARK_GLYPHS, spot: GridPoint, index: number): void => {
    const chosen = selected?.kind === kind && selected.index === index;
    const left = spot.x * TILE_SIZE;
    const top = spot.y * TILE_SIZE;
    context.fillStyle = 'rgba(11, 18, 32, 0.45)';
    context.fillRect(left, top, TILE_SIZE, TILE_SIZE);
    ring(context, left, top, TILE_SIZE, TILE_SIZE, MARK_COLOURS[kind], chosen);
    const glyph = MARK_GLYPHS[kind];
    const gx = left + Math.floor((TILE_SIZE - glyph[0].length) / 2);
    const gy = top + Math.floor((TILE_SIZE - glyph.length) / 2);
    context.fillStyle = MARK_COLOURS[kind];
    glyph.forEach((row, dy) => {
      [...row].forEach((pixel, dx) => {
        if (pixel === '#') {
          context.fillRect(gx + dx, gy + dy, 1, 1);
        }
      });
    });
  };
  file.itemSpots.forEach((spot, index) => mark('item', spot, index));
  file.exits.forEach((spot, index) => mark('exit', spot, index));
  file.dropIns.forEach((spot, index) => mark('drop-in', spot, index));
  if (selected?.kind === 'building') {
    const building = file.buildings[selected.index];
    if (building) {
      const size = buildingSize(building.kind);
      ring(
        context,
        building.x * TILE_SIZE,
        building.y * TILE_SIZE,
        size.width * TILE_SIZE,
        size.height * TILE_SIZE,
        MARK_COLOURS.building,
        true,
      );
    }
  }
}

/** A frame round some tiles: two pixels when it is the chosen thing, one otherwise. */
function ring(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: string,
  chosen: boolean,
): void {
  context.fillStyle = colour;
  const weight = chosen ? 2 : 1;
  context.fillRect(x, y, width, weight);
  context.fillRect(x, y + height - weight, width, weight);
  context.fillRect(x, y, weight, height);
  context.fillRect(x + width - weight, y, weight, height);
}

/** What the pointer is about to do, drawn on the layer over the map: a tile, a rectangle or a building's footprint. */
export function drawPreview(
  context: CanvasRenderingContext2D,
  file: MapFile,
  area: { readonly from: GridPoint; readonly to: GridPoint } | undefined,
  valid: boolean,
): void {
  const { canvas } = context;
  const width = file.width * TILE_SIZE;
  const height = file.height * TILE_SIZE;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.clearRect(0, 0, width, height);
  if (!area) {
    return;
  }
  const left = Math.min(area.from.x, area.to.x);
  const top = Math.min(area.from.y, area.to.y);
  const right = Math.max(area.from.x, area.to.x);
  const bottom = Math.max(area.from.y, area.to.y);
  context.fillStyle = valid ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 90, 80, 0.25)';
  context.fillRect(left * TILE_SIZE, top * TILE_SIZE, (right - left + 1) * TILE_SIZE, (bottom - top + 1) * TILE_SIZE);
  ring(
    context,
    left * TILE_SIZE,
    top * TILE_SIZE,
    (right - left + 1) * TILE_SIZE,
    (bottom - top + 1) * TILE_SIZE,
    valid ? '#ffffff' : '#ff5a50',
    false,
  );
}

const swatchPatches = new Map<string, { readonly file: MapFile; readonly layers: MapLayers }>();

/**
 * A brush's swatch: the middle tile of a little patch of it, drawn by the same
 * builder as the map, so the palette shows the very tile the brush will paint.
 */
export function drawSwatch(canvas: HTMLCanvasElement, letter: string): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  let patch = swatchPatches.get(letter);
  if (!patch) {
    // Three wide, so a stamp stands on grass with grass either side of it and
    // a ledge has its two ends.
    const middle = letter === '=' ? '<=>' : `.${letter}.`;
    const file: MapFile = {
      format: 1,
      id: 'swatch',
      name: 'swatch',
      maker: 'swatch',
      width: 3,
      height: 3,
      ground: ['<', '=', '>', 'f', 'r', 'o', 'u', 'k'].includes(letter)
        ? ['...', middle, '...']
        : [letter.repeat(3), letter.repeat(3), letter.repeat(3)],
      buildings: [],
      dropIns: [],
      exits: [],
      itemSpots: [],
      wildlife: 'meadow',
    };
    patch = { file, layers: layersFor(file) };
    swatchPatches.set(letter, patch);
  }
  const scratch = document.createElement('canvas');
  const scratchContext = scratch.getContext('2d');
  if (!scratchContext) {
    return;
  }
  drawMap(scratchContext, patch.file, patch.layers, undefined);
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  context.drawImage(scratch, TILE_SIZE, TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
}
