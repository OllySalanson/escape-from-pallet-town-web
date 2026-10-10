import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getIdleFrame,
} from '../playerFrames';
import { publicAssetUrl } from '../publicAssetUrl';
import { characterDesignAssetPath } from '../world/characterDesigns';
import {
  MAP_FILE_BUILDINGS,
  MAP_FILE_LOOKS,
  type MapFileBuildingKind,
  type MapFileLook,
} from '../world/mapFile';
import { trainerSightTiles } from '../world/trainerSight';
import { TILE_SIZE } from '../worldMap';
import type { MapFile } from '../world/mapFile';
import { sketchMapFile } from '../world/mapFile';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import { PLAYER_MAP_TILESET } from '../world/tileset/playerMapTileset';
import { buildingSize, type GridPoint, type ThingRef } from './draft';
import type { TileRect } from './layerPatch';

/**
 * Draws a map file onto a canvas exactly as the game will draw it.
 *
 * The picture is the game's own layer builder run on the draft (`buildMapLayers`
 * on the file's sketch, the same call `getWorldMap` makes), blitted from the
 * same sheets the raid scene draws from - so the edges, corners, whole
 * trees and building roofs the maker sees are the ones a raid on the map shows.
 * A whole 128x128 map builds in about twenty milliseconds, so it is simply
 * rebuilt after every stroke rather than patched.
 */

const sheets = new Map<string, HTMLImageElement>();

function loadImage(path: string): Promise<void> {
  return new Promise<void>((resolve) => {
    if (sheets.has(path)) {
      resolve();
      return;
    }
    const image = new Image();
    image.onload = () => resolve();
    // A sheet that will not load leaves a hole in the picture rather than an
    // editor that never opens.
    image.onerror = () => resolve();
    image.src = publicAssetUrl(path);
    sheets.set(path, image);
  });
}

/** Loads the sheets a player map draws from, and every figure a person can look like, once. */
export function loadMakerSheets(): Promise<void> {
  return Promise.all([
    ...PLAYER_MAP_TILESET.sources.map((source) => loadImage(source.imagePath)),
    ...MAP_FILE_LOOKS.map((look) => loadImage(characterDesignAssetPath(look))),
  ]).then(() => undefined);
}

/** The columns a cut character sheet has: four, a frame per step of its walk. */
const FIGURE_SHEET_COLUMNS = 4;

/**
 * A person or a trainer standing on a tile, drawn as the game draws them: the
 * figure's idle frame for the way they face, soles on the tile's bottom row.
 */
function drawFigure(
  context: CanvasRenderingContext2D,
  look: MapFileLook,
  facing: 'down' | 'up' | 'left' | 'right',
  spot: GridPoint,
): void {
  const image = sheets.get(characterDesignAssetPath(look));
  if (!image?.complete || image.naturalWidth === 0) {
    return;
  }
  const frame = getIdleFrame(facing, FIGURE_SHEET_COLUMNS);
  const sx = (frame % FIGURE_SHEET_COLUMNS) * CHARACTER_FRAME_WIDTH;
  const sy = Math.floor(frame / FIGURE_SHEET_COLUMNS) * CHARACTER_FRAME_HEIGHT;
  const left = spot.x * TILE_SIZE + Math.floor((TILE_SIZE - CHARACTER_FRAME_WIDTH) / 2);
  const top = (spot.y + 1) * TILE_SIZE - 1 - CHARACTER_FEET_PIXEL_Y;
  context.drawImage(
    image,
    sx,
    sy,
    CHARACTER_FRAME_WIDTH,
    CHARACTER_FRAME_HEIGHT,
    left,
    top,
    CHARACTER_FRAME_WIDTH,
    CHARACTER_FRAME_HEIGHT,
  );
}

/** Draws one tile of a player map's sheets by its number. */
function drawTileAt(context: CanvasRenderingContext2D, tile: number, x: number, y: number): void {
  const source = PLAYER_MAP_TILESET.sources.find(
    (candidate) =>
      tile >= candidate.firstIndex &&
      tile < candidate.firstIndex + candidate.columns * candidate.rows,
  );
  const image = source ? sheets.get(source.imagePath) : undefined;
  if (!source || !image?.complete || image.naturalWidth === 0) {
    return;
  }
  const index = tile - source.firstIndex;
  context.drawImage(
    image,
    (index % source.columns) * TILE_SIZE,
    Math.floor(index / source.columns) * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    x * TILE_SIZE,
    y * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
  );
}

export function layersFor(file: MapFile): MapLayers {
  return buildMapLayers(sketchMapFile(file), PLAYER_MAP_TILESET);
}

/** Colours for what is placed on the map, the same three the drop-in screen marks them in. */
const MARK_COLOURS = {
  'drop-in': '#5fd6f0',
  exit: '#ff7a6b',
  item: '#8fe08a',
  landmark: '#ffd65c',
  building: '#ffd65c',
  district: '#f8f7dd',
  figure: '#c9a6ff',
} as const;

/**
 * Each place is a frame and a glyph in its own colour - a way in is an arrow
 * pointing down onto the tile, a way out a cross, a find a gem - drawn in whole
 * pixels of the tile rather than in text, which the game's face cannot set this
 * small.
 */
const MARK_GLYPHS: Readonly<Record<'drop-in' | 'exit' | 'item' | 'landmark', readonly string[]>> = {
  'drop-in': ['#######', '.#####.', '..###..', '...#...'],
  exit: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  item: ['..#..', '.###.', '#####', '.###.', '..#..'],
  landmark: ['...#...', '..###..', '#######', '.#####.', '.##.##.', '#.....#'],
};

/**
 * Draws the map, then everything placed on it: the whole of it, or only the
 * tiles of `region`, which leaves the rest of the canvas as it was - how
 * `MapPainter` keeps a 256x256 picture up to date one stroke at a time.
 */
export function drawMap(
  context: CanvasRenderingContext2D,
  file: MapFile,
  layers: MapLayers,
  selected: ThingRef | undefined,
  region?: TileRect,
): void {
  const { canvas } = context;
  const width = file.width * TILE_SIZE;
  const height = file.height * TILE_SIZE;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const area = region ?? { x: 0, y: 0, width: file.width, height: file.height };
  context.save();
  if (region) {
    context.beginPath();
    context.rect(
      area.x * TILE_SIZE,
      area.y * TILE_SIZE,
      area.width * TILE_SIZE,
      area.height * TILE_SIZE,
    );
    context.clip();
  }
  context.imageSmoothingEnabled = false;
  context.fillStyle = '#0b1220';
  context.fillRect(
    area.x * TILE_SIZE,
    area.y * TILE_SIZE,
    area.width * TILE_SIZE,
    area.height * TILE_SIZE,
  );
  const spans = PLAYER_MAP_TILESET.sources.map((source) => ({
    image: sheets.get(source.imagePath),
    from: source.firstIndex,
    to: source.firstIndex + source.columns * source.rows,
    columns: source.columns,
  }));
  for (const layer of [layers.ground, layers.overlay, layers.detail, layers.canopy, layers.brim]) {
    for (let y = area.y; y < area.y + area.height; y += 1) {
      const row = layer.tiles[y];
      for (let x = area.x; x < area.x + area.width; x += 1) {
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
          context.drawImage(
            span.image,
            sx,
            sy,
            TILE_SIZE,
            TILE_SIZE,
            x * TILE_SIZE,
            y * TILE_SIZE,
            TILE_SIZE,
            TILE_SIZE,
          );
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
  // Districts first and faintest: they are the parts of the map everything
  // else stands in. The chosen one is drawn heavier.
  (file.districts ?? []).forEach((district, index) => {
    const chosen = selected?.kind === 'district' && selected.index === index;
    context.fillStyle = chosen ? 'rgba(248, 247, 221, 0.16)' : 'rgba(248, 247, 221, 0.06)';
    context.fillRect(
      district.x * TILE_SIZE,
      district.y * TILE_SIZE,
      district.width * TILE_SIZE,
      district.height * TILE_SIZE,
    );
    ring(
      context,
      district.x * TILE_SIZE,
      district.y * TILE_SIZE,
      district.width * TILE_SIZE,
      district.height * TILE_SIZE,
      MARK_COLOURS.district,
      chosen,
    );
  });
  // What a trainer watches is the price on the ground, so it is shown as the
  // game shows it: the tiles shaded.
  const blocked = (tile: GridPoint): boolean => layers.collision[tile.y]?.[tile.x] ?? true;
  for (const trainer of file.trainers ?? []) {
    context.fillStyle = 'rgba(255, 90, 80, 0.28)';
    for (const tile of trainerSightTiles(
      { position: trainer, facing: trainer.facing, sightRange: trainer.sight },
      blocked,
    )) {
      context.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
  file.itemSpots.forEach((spot, index) => mark('item', spot, index));
  (file.landmarks ?? []).forEach((spot, index) => mark('landmark', spot, index));
  const signTile = PLAYER_MAP_TILESET.props.signTown.cells[0]?.tile;
  for (const sign of file.signs ?? []) {
    if (signTile !== undefined) {
      drawTileAt(context, signTile, sign.x, sign.y);
    }
  }
  // Figures in the order they stand, top of the map first, so a head drawn
  // into the row above is behind whoever stands in that row.
  const figures = [
    ...(file.people ?? []).map((person, index) => ({ ...person, kind: 'person' as const, index })),
    ...(file.trainers ?? []).map((trainer, index) => ({
      ...trainer,
      kind: 'trainer' as const,
      index,
    })),
  ].sort((a, b) => a.y - b.y);
  for (const figure of figures) {
    drawFigure(context, figure.look, figure.facing, figure);
  }
  for (const [kind, list] of [
    ['sign', file.signs ?? []],
    ['person', file.people ?? []],
    ['trainer', file.trainers ?? []],
  ] as const) {
    list.forEach((spot, index) => {
      if (selected?.kind === kind && selected.index === index) {
        ring(
          context,
          spot.x * TILE_SIZE,
          spot.y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
          MARK_COLOURS.figure,
          true,
        );
      }
    });
  }
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
  context.restore();
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
  context.drawImage(
    scratch,
    TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    0,
    0,
    TILE_SIZE,
    TILE_SIZE,
  );
}

const plantPatches = new Map<string, { readonly file: MapFile; readonly layers: MapLayers }>();

/**
 * The picture beside a thing to plant: the thing itself, planted on a patch of
 * grass (or water, for a jetty) by the same builder as the map, and drawn
 * whole into the row's square - a broadleaf's crown rises above its block, and
 * a picture that cut it off would be a picture of a different tree.
 */
export function drawPlantSwatch(
  canvas: HTMLCanvasElement,
  kind: MapFileBuildingKind,
  on: 'grass' | 'water' = 'grass',
): void {
  const context = canvas.getContext('2d');
  const prop = PLAYER_MAP_TILESET.props[MAP_FILE_BUILDINGS[kind]];
  if (!context || !prop) {
    return;
  }
  const { width, height } = prop;
  let patch = plantPatches.get(kind);
  if (!patch) {
    // A tile of ground all round, and a second row above for a crown's brim.
    const ground = (on === 'water' ? 'W' : '.').repeat(width + 2);
    const file: MapFile = {
      format: 1,
      id: 'plant',
      name: 'plant',
      maker: 'plant',
      width: width + 2,
      height: height + 3,
      ground: Array.from({ length: height + 3 }, () => ground),
      buildings: [{ kind, x: 1, y: 2 }],
      dropIns: [],
      exits: [],
      itemSpots: [],
      wildlife: 'meadow',
    };
    patch = { file, layers: layersFor(file) };
    plantPatches.set(kind, patch);
  }
  const scratch = document.createElement('canvas');
  const scratchContext = scratch.getContext('2d');
  if (!scratchContext) {
    return;
  }
  drawMap(scratchContext, patch.file, patch.layers, undefined);
  const brim = prop.brim?.depth ?? 0;
  const sourceX = TILE_SIZE;
  const sourceY = 2 * TILE_SIZE - brim;
  const sourceWidth = width * TILE_SIZE;
  const sourceHeight = height * TILE_SIZE + brim;
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const scale = Math.min(TILE_SIZE / sourceWidth, TILE_SIZE / sourceHeight);
  const drawnWidth = Math.max(1, Math.round(sourceWidth * scale));
  const drawnHeight = Math.max(1, Math.round(sourceHeight * scale));
  // Shrunk, a picture is read better smoothed than with every other pixel dropped.
  context.imageSmoothingEnabled = scale < 1;
  context.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
  context.drawImage(
    scratch,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    Math.floor((TILE_SIZE - drawnWidth) / 2),
    Math.floor((TILE_SIZE - drawnHeight) / 2),
    drawnWidth,
    drawnHeight,
  );
}
