import {
  DIRECTION_DELTAS,
  type Direction,
  type GridLink,
  type GridPosition,
} from '../movement/gridMovement';
import type { Rect } from './interiors';
import { applyGates } from './gates';
import {
  fileDoorGates,
  MAP_FILE_FURNITURE,
  sketchMapFile,
  type MapFile,
  type MapFileArea,
  type MapFileAreaKind,
  type MapFileLink,
  type MapFileLinkEnd,
} from './mapFile';
import { MapSketch } from './mapGrid';
import { buildMapLayers, type MapLayers, type TileLayer } from './tiles';
import type { TileSource, TilesetCatalogue } from './tileset/catalogue';
import { INSIDE_TILESETS, insideMat, type InsidePropName } from './tileset/insideTileset';
import { PLAYER_MAP_TILESET } from './tileset/playerMapTileset';
import { MATERIAL_CHARS, type Material } from './tileset/materials';

/**
 * A player's map with its areas in it, laid out as the one grid it is played on.
 *
 * A map file draws its outdoor map and each inside as a little map of its own
 * (`MapFileArea`), but a raid is played on one map: the hunter's pursuit, the
 * walks the checks measure, the loot, the survey and every caption read one
 * collision grid, and a second map would be a place the hunter could not follow
 * into - the safe box `interiors.ts` refuses. So the areas are laid side by side
 * in one grid, the outdoors at the origin and each area packed to its east with
 * a tile of solid dark between, and the ways through are links in that grid
 * (`GridBounds.links`): pressing into a door on one side puts you on the mat on
 * the other. Nothing that walks the grid needs to know an area is there.
 *
 * A file with no areas is laid out as exactly the grid it always was - the
 * same size, the same layers - which `mapFile.test.ts` holds.
 */

/** One place of a composed map: the outdoors, or one of the file's areas. */
export interface PlacedArea {
  /** The area's id in the file; undefined is the outdoors. */
  readonly id: string | undefined;
  /** What it is called on the plate that rises when you walk in. */
  readonly name: string;
  readonly kind: 'outdoors' | MapFileAreaKind;
  /** Where it lies in the composed grid. */
  readonly rect: Rect;
}

/** One way through, as the scene plays it: where you stand, the way you press, and where you come out. */
export interface ComposedDoorway extends GridLink {
  /** The tile pressed into: a door, or the dark past a mat's edge of the room. */
  readonly doorway: GridPosition;
  /** The way you face coming out of the other end: away from its doorway. */
  readonly arrivalFacing: Direction;
  readonly look: MapFileLinkEnd['look'];
}

export interface ComposedMap {
  readonly width: number;
  readonly height: number;
  readonly layers: MapLayers;
  readonly terrain: readonly Material[][];
  /** The outdoors first, then the file's areas in the order it lists them. */
  readonly areas: readonly PlacedArea[];
  /** Two for every link in the file, one each way. */
  readonly doorways: readonly ComposedDoorway[];
  /** Every sheet any area is drawn from, so the scene loads them all. */
  readonly tileset: TilesetCatalogue;
}

/** The solid dark between areas, as the ground under it is reported. */
const VOID: Material = 'wall';

/** Tiles of dark between one area and the next. */
const GAP = 1;

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** The way you face coming out through a doorway you went in by pressing `toward`. */
export function arrivalFacing(toward: Direction): Direction {
  return OPPOSITE[toward];
}

/** The tile a link's end is pressed into. */
export function doorwayOf(end: Pick<MapFileLinkEnd, 'x' | 'y' | 'toward'>): GridPosition {
  const delta = DIRECTION_DELTAS[end.toward];
  return { x: end.x + delta.x, y: end.y + delta.y };
}

/** The area a file names, or undefined for the outdoors or a name it does not have. */
export function areaNamed(file: MapFile, id: string | undefined): MapFileArea | undefined {
  return id === undefined ? undefined : file.areas?.find((area) => area.id === id);
}

/** The sheet an area is drawn from. */
export function areaTileset(area: MapFileArea): TilesetCatalogue<InsidePropName> {
  return INSIDE_TILESETS[area.style];
}

/**
 * An inside as a sketch: its floor and walls, its furniture, and a mat under
 * every way out of it. A mat is three tiles wide with the way out under its
 * middle, slid along the wall where the room is too narrow for it to be
 * centred.
 */
export function sketchArea(
  area: MapFileArea,
  links: readonly MapFileLink[] = [],
): MapSketch<InsidePropName> {
  const sketch = new MapSketch<InsidePropName>({
    width: area.width,
    height: area.height,
    fill: MATERIAL_CHARS.paving,
  });
  sketch.draw(0, 0, area.ground);
  for (const piece of area.buildings) {
    const name = MAP_FILE_FURNITURE[piece.kind as keyof typeof MAP_FILE_FURNITURE];
    if (name !== undefined) {
      sketch.plant(piece.x, piece.y, name);
    }
  }
  const mat = insideMat(area.style);
  for (const link of links) {
    for (const end of link.ends) {
      if (end.area !== area.id) {
        continue;
      }
      if (end.look === 'mat') {
        const x = Math.max(0, Math.min(area.width - 3, end.x - 1));
        sketch.plant(x, end.y, mat);
      } else if (end.look === 'stairs-up' || end.look === 'stairs-down') {
        const at = stairsAt(end);
        if (at.x >= 0 && at.y >= 0 && at.x + STAIRS_SIZE.width <= area.width) {
          sketch.plant(at.x, at.y, end.look === 'stairs-up' ? 'stairsUp' : 'stairsDown');
        }
      }
    }
  }
  return sketch;
}

/** How much of a room a staircase takes: two tiles wide and three deep, its top row against the back wall. */
export const STAIRS_SIZE = { width: 2, height: 3 } as const;

/**
 * Where a staircase stands, from the end of the way through that is gone up
 * it: the tile in front of its foot, pressing up into its bottom-left cell.
 */
export function stairsAt(end: Pick<MapFileLinkEnd, 'x' | 'y'>): { x: number; y: number } {
  return { x: end.x, y: end.y - STAIRS_SIZE.height };
}

/** Where each area lies in the composed grid, and how big that grid is. */
export function layOutMapFile(file: MapFile): {
  readonly width: number;
  readonly height: number;
  readonly areas: readonly PlacedArea[];
} {
  const placed: PlacedArea[] = [
    {
      id: undefined,
      name: file.name,
      kind: 'outdoors',
      rect: { x: 0, y: 0, width: file.width, height: file.height },
    },
  ];
  // Columns of areas east of the outdoors, each column as tall as the outdoors
  // (and never shorter than a big room), so the grid stays close to square.
  const columnLimit = Math.max(file.height, 32);
  let columnX = file.width + GAP;
  let columnWidth = 0;
  let y = 0;
  let width = file.width;
  let height = file.height;
  for (const area of file.areas ?? []) {
    if (y > 0 && y + area.height > columnLimit) {
      columnX += columnWidth + GAP;
      columnWidth = 0;
      y = 0;
    }
    placed.push({
      id: area.id,
      name: area.name,
      kind: area.kind,
      rect: { x: columnX, y, width: area.width, height: area.height },
    });
    columnWidth = Math.max(columnWidth, area.width);
    width = Math.max(width, columnX + area.width);
    height = Math.max(height, y + area.height);
    y += area.height + GAP;
  }
  return { width, height, areas: placed };
}

function blank(width: number, height: number): TileLayer {
  return {
    tiles: Array.from({ length: height }, () => Array<number>(width).fill(-1)),
    tints: Array.from({ length: height }, () => Array<number>(width).fill(-1)),
    flips: Array.from({ length: height }, () => Array<boolean>(width).fill(false)),
  };
}

const LAYER_NAMES = [
  'ground',
  'overlay',
  'detail',
  'canopy',
  'brim',
  'roofGround',
  'roof',
] as const satisfies readonly (keyof MapLayers)[];

/** One area's own layers, copied into the composed grid at its place. */
function paste(
  into: MapLayers,
  terrain: Material[][],
  from: MapLayers,
  sketch: MapSketch<string>,
  at: Rect,
): void {
  for (let y = 0; y < at.height; y += 1) {
    for (let x = 0; x < at.width; x += 1) {
      const tx = at.x + x;
      const ty = at.y + y;
      for (const name of LAYER_NAMES) {
        into[name].tiles[ty][tx] = from[name].tiles[y][x];
        into[name].tints[ty][tx] = from[name].tints[y][x];
        into[name].flips[ty][tx] = from[name].flips[y][x];
      }
      into.brimDepth[ty][tx] = from.brimDepth[y][x];
      into.collision[ty][tx] = from.collision[y][x];
      into.tallGrass[ty][tx] = from.tallGrass[y][x];
      into.crowned[ty][tx] = from.crowned[y][x];
      terrain[ty][tx] = sketch.surfaceAt(x, y);
    }
  }
}

/** Every sheet the catalogues draw from, each once. */
function joinedTileset(catalogues: readonly TilesetCatalogue[]): TilesetCatalogue {
  const sources = new Map<string, TileSource>();
  for (const catalogue of catalogues) {
    for (const source of catalogue.sources) {
      sources.set(source.textureKey, source);
    }
  }
  return { ...PLAYER_MAP_TILESET, sources: [...sources.values()] };
}

/**
 * The file as the one grid it is played on, with the doors named in `opened`
 * open (`gateKey`) and every other Cut tree and Surf water shut. Assumes
 * `readMapFile` accepted it: an end in an area the file does not have is a bug
 * in the caller.
 */
export function composeMapFile(file: MapFile, opened: readonly string[] = []): ComposedMap {
  // A field-move door stands outdoors, which is laid out at the origin, so its
  // tiles are the grid's own.
  const outdoors = applyGates(sketchMapFile(file), fileDoorGates(file), opened);
  const outdoorLayers = buildMapLayers(outdoors, PLAYER_MAP_TILESET);
  const areas = file.areas ?? [];
  if (areas.length === 0 && (file.links ?? []).length === 0) {
    return {
      width: file.width,
      height: file.height,
      layers: outdoorLayers,
      terrain: Array.from({ length: file.height }, (_, y) =>
        Array.from({ length: file.width }, (_, x) => outdoors.surfaceAt(x, y)),
      ),
      areas: layOutMapFile(file).areas,
      doorways: [],
      tileset: PLAYER_MAP_TILESET,
    };
  }

  const layout = layOutMapFile(file);
  const { width, height } = layout;
  const layers: MapLayers = {
    ground: blank(width, height),
    overlay: blank(width, height),
    detail: blank(width, height),
    canopy: blank(width, height),
    brim: blank(width, height),
    brimDepth: Array.from({ length: height }, () => Array<number>(width).fill(0)),
    roofGround: blank(width, height),
    roof: blank(width, height),
    collision: Array.from({ length: height }, () => Array<boolean>(width).fill(true)),
    tallGrass: Array.from({ length: height }, () => Array<boolean>(width).fill(false)),
    crowned: Array.from({ length: height }, () => Array<boolean>(width).fill(false)),
  };
  const terrain = Array.from({ length: height }, () => Array<Material>(width).fill(VOID));
  paste(layers, terrain, outdoorLayers, outdoors, layout.areas[0].rect);
  const catalogues: TilesetCatalogue[] = [PLAYER_MAP_TILESET];
  areas.forEach((area, index) => {
    const sketch = sketchArea(area, file.links);
    const catalogue = areaTileset(area);
    catalogues.push(catalogue);
    paste(layers, terrain, buildMapLayers(sketch, catalogue), sketch, layout.areas[index + 1].rect);
  });

  const origin = new Map(layout.areas.map((placed) => [placed.id, placed.rect]));
  const toGrid = (end: MapFileLinkEnd): GridPosition => {
    const rect = origin.get(end.area);
    if (!rect) {
      throw new Error(`a way through ends in '${String(end.area)}', which the map does not have`);
    }
    return { x: rect.x + end.x, y: rect.y + end.y };
  };
  const doorways: ComposedDoorway[] = [];
  for (const link of file.links ?? []) {
    const [a, b] = link.ends;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const landing = toGrid(from);
      const delta = DIRECTION_DELTAS[from.toward];
      const doorway = { x: landing.x + delta.x, y: landing.y + delta.y };
      // What a doorway is pressed into is solid, whatever was drawn there: an
      // open door in a house front is a pocket you step into until it leads
      // somewhere, and from then on it is the way through and nothing else.
      if (layers.collision[doorway.y]?.[doorway.x] !== undefined) {
        layers.collision[doorway.y][doorway.x] = true;
      }
      doorways.push({
        from: landing,
        toward: from.toward,
        to: toGrid(to),
        doorway,
        arrivalFacing: arrivalFacing(to.toward),
        look: from.look,
      });
    }
  }
  return {
    width,
    height,
    layers,
    terrain,
    areas: layout.areas,
    doorways,
    tileset: joinedTileset(catalogues),
  };
}

/** The place of a composed map a tile of it is in, or undefined in the dark between. */
export function placedAreaAt(
  areas: readonly PlacedArea[],
  tile: GridPosition,
): PlacedArea | undefined {
  return areas.find(
    ({ rect }) =>
      tile.x >= rect.x &&
      tile.y >= rect.y &&
      tile.x < rect.x + rect.width &&
      tile.y < rect.y + rect.height,
  );
}
