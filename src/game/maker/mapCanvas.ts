import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getIdleFrame,
} from '../playerFrames';
import { publicAssetUrl } from '../publicAssetUrl';
import { characterDesignAssetPath } from '../world/characterDesigns';
import {
  MAP_FILE_LOOKS,
  type MapFileBuildingKind,
  type MapFileLook,
} from '../world/mapFile';
import {
  POKEMON_ICON_PATH,
  POKEMON_ICON_SIZE,
  pokemonIconFrames,
  pokemonSoleDrop,
  type FigureSpeciesId,
} from '../world/pokemonFigures';
import { trainerSightTiles } from '../world/trainerSight';
import {
  BERRY_TREE_FRAME_HEIGHT,
  BERRY_TREE_FRAME_WIDTH,
  BERRY_TREE_PATH,
  berryTreeFrames,
  type BerryId,
} from '../world/berries';
import { iconUrl, WORLD_ICONS } from '../ui/icons';
import { TILE_SIZE } from '../worldMap';
import type { MapFile, MapFileArea, MapFileLink, MapFileLinkEnd } from '../world/mapFile';
import { fileDoorGates, plantedProp, sketchMapFile } from '../world/mapFile';
import { applyGates } from '../world/gates';
import { areaTileset, sketchArea } from '../world/mapAreas';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import type { TileSource } from '../world/tileset/catalogue';
import { INSIDE_TILESETS } from '../world/tileset/insideTileset';
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

/**
 * Every sheet a player's map is drawn from: its outdoors and the rooms
 * its buildings open into, each once.
 */
const MAKER_SOURCES: readonly TileSource[] = [
  ...new Map(
    [PLAYER_MAP_TILESET, ...Object.values(INSIDE_TILESETS)]
      .flatMap((catalogue) => catalogue.sources)
      .map((source) => [source.textureKey, source] as const),
  ).values(),
];

/** Loads every sheet a map is drawn from, and every figure a person can look like, once. */
export function loadMakerSheets(): Promise<void> {
  return Promise.all([
    ...MAKER_SOURCES.map((source) => loadImage(source.imagePath)),
    ...MAP_FILE_LOOKS.map((look) => loadImage(characterDesignAssetPath(look))),
    loadImage(POKEMON_ICON_PATH),
    loadImage(BERRY_TREE_PATH),
    loadRubble(),
  ]).then(() => undefined);
}

/** The rubble a buried exit is drawn as, which is an icon rather than a sheet. */
let rubble: HTMLImageElement | undefined;
function loadRubble(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (rubble) {
      resolve();
      return;
    }
    rubble = new Image();
    rubble.onload = () => resolve();
    rubble.onerror = () => resolve();
    rubble.src = iconUrl(WORLD_ICONS.rubble);
  });
}

/** A berry tree on a tile, drawn as the game draws it: ripe, feet on the tile's last row, crown in the row above. */
function drawBerryTree(context: CanvasRenderingContext2D, berry: BerryId, spot: GridPoint): void {
  const image = sheets.get(BERRY_TREE_PATH);
  if (!image?.complete || image.naturalWidth === 0) {
    return;
  }
  const [frame] = berryTreeFrames(berry).ripe;
  const columns = image.naturalWidth / BERRY_TREE_FRAME_WIDTH;
  context.drawImage(
    image,
    (frame % columns) * BERRY_TREE_FRAME_WIDTH,
    Math.floor(frame / columns) * BERRY_TREE_FRAME_HEIGHT,
    BERRY_TREE_FRAME_WIDTH,
    BERRY_TREE_FRAME_HEIGHT,
    spot.x * TILE_SIZE + (TILE_SIZE - BERRY_TREE_FRAME_WIDTH) / 2,
    (spot.y + 1) * TILE_SIZE - BERRY_TREE_FRAME_HEIGHT,
    BERRY_TREE_FRAME_WIDTH,
    BERRY_TREE_FRAME_HEIGHT,
  );
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

/** A Pokemon standing on a tile, drawn as the game draws it: its first icon frame, feet on the tile's last row. */
function drawPokemon(context: CanvasRenderingContext2D, species: FigureSpeciesId, spot: GridPoint): void {
  const image = sheets.get(POKEMON_ICON_PATH);
  if (!image?.complete || image.naturalWidth === 0) {
    return;
  }
  const [frame] = pokemonIconFrames(species);
  const columns = image.naturalWidth / POKEMON_ICON_SIZE;
  context.drawImage(
    image,
    (frame % columns) * POKEMON_ICON_SIZE,
    Math.floor(frame / columns) * POKEMON_ICON_SIZE,
    POKEMON_ICON_SIZE,
    POKEMON_ICON_SIZE,
    spot.x * TILE_SIZE + (TILE_SIZE - POKEMON_ICON_SIZE) / 2,
    (spot.y + 1) * TILE_SIZE + pokemonSoleDrop(species) - POKEMON_ICON_SIZE,
    POKEMON_ICON_SIZE,
    POKEMON_ICON_SIZE,
  );
}

/** Draws one tile of a player map's sheets by its number. */
function drawTileAt(context: CanvasRenderingContext2D, tile: number, x: number, y: number): void {
  const source = MAKER_SOURCES.find(
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

/**
 * The layers a map file draws, its doors shut as a fresh save first meets
 * them, or - given the inside it is a view of - that inside's, drawn from its
 * own room's art with a mat under every way out.
 */
export function layersFor(
  file: MapFile,
  inside?: { readonly area: MapFileArea; readonly links: readonly MapFileLink[] },
): MapLayers {
  if (!inside) {
    return buildMapLayers(
      applyGates(sketchMapFile(file), fileDoorGates(file), []),
      PLAYER_MAP_TILESET,
    );
  }
  const area: MapFileArea = {
    ...inside.area,
    width: file.width,
    height: file.height,
    ground: file.ground,
    buildings: file.buildings,
  };
  return buildMapLayers(sketchArea(area, inside.links), areaTileset(area));
}

/** A way through, as the canvas marks it: where it is stood on, which way it goes, whether it is chosen. */
export interface DoorwayMark {
  readonly at: MapFileLinkEnd;
  readonly chosen: boolean;
  /** Its other end, when that is in the same place: the two are joined by a line. */
  readonly pair?: MapFileLinkEnd;
}

/**
 * A dotted line between the middles of two tiles, in the map's own pixels, so
 * it zooms as the art does: every other pixel of a line drawn the way a pixel
 * line is drawn, one pixel a step along its longer axis.
 */
function dottedLine(context: CanvasRenderingContext2D, from: GridPoint, to: GridPoint): void {
  const x0 = from.x * TILE_SIZE + TILE_SIZE / 2;
  const y0 = from.y * TILE_SIZE + TILE_SIZE / 2;
  const x1 = to.x * TILE_SIZE + TILE_SIZE / 2;
  const y1 = to.y * TILE_SIZE + TILE_SIZE / 2;
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let step = 0; step <= steps; step += 2) {
    const x = Math.round(x0 + ((x1 - x0) * step) / Math.max(1, steps));
    const y = Math.round(y0 + ((y1 - y0) * step) / Math.max(1, steps));
    context.fillRect(x, y, 1, 1);
  }
}

/** Colours for what is placed on the map, the same three the drop-in screen marks them in. */
const MARK_COLOURS = {
  'drop-in': '#5fd6f0',
  exit: '#ff7a6b',
  item: '#8fe08a',
  landmark: '#ffd65c',
  building: '#ffd65c',
  door: '#9ff0ff',
  district: '#f8f7dd',
  figure: '#c9a6ff',
  doorway: '#ffa95c',
} as const;

/** An arrow pointing the way a doorway is gone through, drawn up and turned for the other three. */
const DOORWAY_ARROW = ['...#...', '..###..', '.#####.', '#######', '..###..', '..###..'];

function turned(glyph: readonly string[], toward: MapFileLinkEnd['toward']): readonly string[] {
  if (toward === 'up') {
    return glyph;
  }
  if (toward === 'down') {
    return [...glyph].reverse();
  }
  const width = glyph[0].length;
  const columns = Array.from({ length: width }, (_, x) => glyph.map((row) => row[x]).join(''));
  return toward === 'left' ? columns : columns.map((row) => [...row].reverse().join(''));
}

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
  doorways: readonly DoorwayMark[] = [],
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
  const spans = MAKER_SOURCES.map((source) => ({
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
    ...(file.pokemon ?? []).map((standing, index) => ({
      ...standing,
      kind: 'pokemon' as const,
      index,
    })),
    ...(file.berryTrees ?? []).map((tree, index) => ({
      ...tree,
      kind: 'berry-tree' as const,
      index,
    })),
    ...(file.boulders ?? []).map((boulder, index) => ({
      ...boulder,
      kind: 'boulder' as const,
      index,
    })),
  ].sort((a, b) => a.y - b.y);
  const boulderTile = PLAYER_MAP_TILESET.props.strengthBoulder.cells[0]?.tile;
  for (const figure of figures) {
    if (figure.kind === 'pokemon') {
      drawPokemon(context, figure.species, figure);
    } else if (figure.kind === 'berry-tree') {
      drawBerryTree(context, figure.berry, figure);
    } else if (figure.kind === 'boulder') {
      if (boulderTile !== undefined) {
        drawTileAt(context, boulderTile, figure.x, figure.y);
      }
    } else {
      drawFigure(context, figure.look, figure.facing, figure);
    }
  }
  for (const [kind, list] of [
    ['sign', file.signs ?? []],
    ['person', file.people ?? []],
    ['pokemon', file.pokemon ?? []],
    ['berry-tree', file.berryTrees ?? []],
    ['boulder', file.boulders ?? []],
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
  // A buried exit is drawn as the rubble it is under, framed in the exit's
  // colour: the cross would say "a way out" of something that is a wall until
  // a Pickaxe meets it.
  file.exits.forEach((spot, index) => {
    if (spot.opens.when !== 'dug') {
      mark('exit', spot, index);
      return;
    }
    if (rubble?.complete && rubble.naturalWidth > 0) {
      context.drawImage(rubble, spot.x * TILE_SIZE, spot.y * TILE_SIZE);
    }
    ring(
      context,
      spot.x * TILE_SIZE,
      spot.y * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      MARK_COLOURS.exit,
      selected?.kind === 'exit' && selected.index === index,
    );
  });
  file.dropIns.forEach((spot, index) => mark('drop-in', spot, index));
  // A door is framed, because a stretch of Surf water is otherwise just water.
  (file.doors ?? []).forEach((door, index) =>
    ring(
      context,
      door.x * TILE_SIZE,
      door.y * TILE_SIZE,
      door.width * TILE_SIZE,
      door.height * TILE_SIZE,
      MARK_COLOURS.door,
      selected?.kind === 'door' && selected.index === index,
    ),
  );
  // A way through whose two ends are both here is joined end to end, under
  // the marks, so the pair can be seen as one.
  context.fillStyle = MARK_COLOURS.doorway;
  for (const doorway of doorways) {
    if (doorway.pair) {
      dottedLine(context, doorway.at, doorway.pair);
    }
  }
  // Each way through, on the tile it is gone through from: a ring and an
  // arrow pressing the way it goes - up into a door, down off a mat.
  for (const doorway of doorways) {
    const left = doorway.at.x * TILE_SIZE;
    const top = doorway.at.y * TILE_SIZE;
    ring(context, left, top, TILE_SIZE, TILE_SIZE, MARK_COLOURS.doorway, doorway.chosen);
    const glyph = turned(DOORWAY_ARROW, doorway.at.toward);
    const gx = left + Math.floor((TILE_SIZE - glyph[0].length) / 2);
    const gy = top + Math.floor((TILE_SIZE - glyph.length) / 2);
    context.fillStyle = MARK_COLOURS.doorway;
    glyph.forEach((row, dy) => {
      [...row].forEach((pixel, dx) => {
        if (pixel === '#') {
          context.fillRect(gx + dx, gy + dy, 1, 1);
        }
      });
    });
  }
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
 * Indoors the patch is a corner of a room in the style on screen - a wall
 * stood on floor, so the swatch is the wall's face with its skirting.
 */
export function drawSwatch(
  canvas: HTMLCanvasElement,
  letter: string,
  style?: MapFileArea['style'],
): void {
  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }
  const key = style ? `${style}:${letter}` : letter;
  let patch = swatchPatches.get(key);
  if (!patch && style) {
    // A wall stood on floor, so the swatch is the wall's face with its
    // skirting; anything else is a patch of itself.
    const ground = letter === 'B' ? ['BBB', 'BBB', 'PPP'] : [letter.repeat(3), letter.repeat(3), letter.repeat(3)];
    const file: MapFile = {
      format: 1,
      id: 'swatch',
      name: 'swatch',
      maker: 'swatch',
      width: 3,
      height: 3,
      ground,
      buildings: [],
      dropIns: [],
      exits: [],
      itemSpots: [],
      wildlife: 'meadow',
    };
    const area: MapFileArea = {
      id: 'swatch',
      name: 'swatch',
      kind: 'inside',
      style,
      width: 3,
      height: 3,
      ground,
      buildings: [],
    };
    patch = { file, layers: layersFor(file, { area, links: [] }) };
    swatchPatches.set(key, patch);
  }
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
    swatchPatches.set(key, patch);
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
  /** A piece of furniture is pictured on the floor of a room in this style. */
  style?: MapFileArea['style'],
): void {
  const context = canvas.getContext('2d');
  const prop = plantedProp(kind);
  if (!context || !prop) {
    return;
  }
  const { width, height } = prop;
  const key = style ? `${style}:${kind}` : kind;
  let patch = plantPatches.get(key);
  if (!patch && style) {
    const rows = Array.from({ length: height + 3 }, () => 'P'.repeat(width + 2));
    const file: MapFile = {
      format: 1,
      id: 'plant',
      name: 'plant',
      maker: 'plant',
      width: width + 2,
      height: height + 3,
      ground: rows,
      buildings: [{ kind, x: 1, y: 2 }],
      dropIns: [],
      exits: [],
      itemSpots: [],
      wildlife: 'meadow',
    };
    const area: MapFileArea = {
      id: 'plant',
      name: 'plant',
      kind: 'inside',
      style,
      width: width + 2,
      height: height + 3,
      ground: rows,
      buildings: file.buildings,
    };
    patch = { file, layers: layersFor(file, { area, links: [] }) };
    plantPatches.set(key, patch);
  }
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
    plantPatches.set(key, patch);
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
