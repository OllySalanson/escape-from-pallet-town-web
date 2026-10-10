import {
  DIRECTION_DELTAS,
  type Direction,
  type GridLink,
  type GridPosition,
} from '../movement/gridMovement';
import type { Rect } from './interiors';
import { applyGates } from './gates';
import {
  buildingDoorAt,
  doorwayTiles,
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
import {
  INSIDE_TILESETS,
  insideBackDoor,
  insideMat,
  insideSideMat,
  insideStairwell,
  tunnelStairs,
  type InsidePropName,
} from './tileset/insideTileset';
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
  /** What is drawn there to go through, in the composed grid's tiles. */
  readonly art: Rect;
  /**
   * Whether this is the way through's own tile, the one its other end comes
   * out on. A wide door is gone through from every cell of it, as FireRed's
   * is, and the others lead to the same place; only this one is named on the
   * map.
   */
  readonly primary: boolean;
  /**
   * Whether the other end comes back to this tile. A wide door's extra cells
   * lead in but come back out to the way through's own tile, and the
   * searches walk only links that go both ways - a downhill walk over a field
   * of distances depends on it - so a tile that leads out one way only is a way
   * out for a player and nothing more (`searchedLinks`).
   */
  readonly twoWay: boolean;
}

/** The links every search walks: the ones that go both ways. */
export function searchedLinks(doorways: readonly ComposedDoorway[]): readonly ComposedDoorway[] {
  return doorways.filter((doorway) => doorway.twoWay);
}

export interface ComposedMap {
  readonly width: number;
  readonly height: number;
  readonly layers: MapLayers;
  readonly terrain: readonly Material[][];
  /** The outdoors first, then the file's areas in the order it lists them. */
  readonly areas: readonly PlacedArea[];
  /** Every tile of every link's two ends, each going through to the other end. */
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

/**
 * Every tile a way through is gone through from, in order across it, in its
 * own area's tiles: a door as wide as the building draws it - FireRed draws
 * some two cells wide, and both take you in - and one tile for anything else.
 * A mat is three tiles of art and one way out: FireRed puts the arrow that
 * takes you out of a room on its middle tile only (the warps beside it are on
 * plain floor, and a warp only fires on a floor that says it is one).
 */
export function landingsOf(file: MapFile, end: MapFileLinkEnd): readonly GridPosition[] {
  if (end.look === 'door' && end.area === undefined) {
    const door = buildingDoorAt(file, end);
    if (door) {
      return doorwayTiles(door.doorway);
    }
  }
  return [{ x: end.x, y: end.y }];
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
 * An inside as a sketch: its floor and walls, its furniture, and the art of
 * every way through it. A mat is three tiles wide with the way out under its
 * middle, slid along the wall where the room is too narrow for it to be
 * centred. In a cave, the way out is daylight cut into the south wall it is
 * pressed into, a ladder up stands with its foot on the tile it is climbed
 * from, and a ladder down is a hole in the floor beside it.
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
      const doorway = doorwayOf(end);
      const inArea = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < area.width && y < area.height;
      if (end.look === 'mat' && (end.toward === 'left' || end.toward === 'right')) {
        // A mat let into a side wall hangs over the dark beyond it, a column
        // outside the floor it is stood on, as FireRed draws a gatehouse's.
        const side = insideSideMat(area.style, end.toward);
        const x = end.toward === 'left' ? end.x - 1 : end.x;
        if (side && inArea(x, end.y - 1) && inArea(x + 1, end.y + 1)) {
          sketch.plant(x, end.y - 1, side);
        }
      } else if (end.look === 'mat' && mat) {
        const x = Math.max(0, Math.min(area.width - 3, end.x - 1));
        sketch.plant(x, end.y, mat);
      } else if (end.look === 'back-door') {
        // A doorway in the back wall, framed by the wall either side of it.
        const door = insideBackDoor(area.style);
        if (door && inArea(doorway.x - 1, doorway.y - 1) && inArea(doorway.x + 1, doorway.y)) {
          sketch.plant(doorway.x - 1, doorway.y - 1, door);
        }
      } else if (end.look === 'stairwell') {
        // The stairwell down into the Underground Path, stood beside on the
        // floor east of it: its own column of floor is the tile stood on.
        const stairwell = insideStairwell(area.style);
        const at = stairwellAt(end);
        if (stairwell && inArea(at.x, at.y) && inArea(at.x + 2, at.y + 2)) {
          sketch.plant(at.x, at.y, stairwell);
        }
      } else if (end.look === 'tunnel-stairs' && (end.toward === 'left' || end.toward === 'right')) {
        // The stairs up out of a tunnel: eastward from its north end, their
        // top in the north wall, and westward from its south end.
        const stairs = tunnelStairs(area.style, end.toward);
        const at = tunnelStairsAt(end);
        const size = TUNNEL_STAIRS_SIZE[end.toward];
        if (stairs && inArea(at.x, at.y) && inArea(at.x + size.width - 1, at.y + size.height - 1)) {
          sketch.plant(at.x, at.y, stairs);
        }
      } else if (end.look === 'cave-exit') {
        if (inArea(doorway.x - 1, doorway.y) && inArea(doorway.x + 1, doorway.y)) {
          sketch.plant(doorway.x - 1, doorway.y, 'caveExit');
        }
      } else if (end.look === 'ladder-up') {
        if (inArea(end.x, end.y - 1)) {
          sketch.plant(end.x, end.y - 1, 'caveLadder');
        }
      } else if (end.look === 'ladder-down') {
        if (inArea(doorway.x, doorway.y)) {
          sketch.plant(doorway.x, doorway.y, 'caveHole');
        }
      } else if (end.look === 'stairs-up' || end.look === 'stairs-down') {
        const at = stairsAt(end);
        if (
          at.x >= 0 &&
          at.y >= 0 &&
          at.x + STAIRS_SIZE.width <= area.width &&
          end.y + 1 < area.height
        ) {
          sketch.plant(at.x, at.y, end.look === 'stairs-up' ? 'stairsUp' : 'stairsDown');
          // The little rug the way up is stood on, as FireRed lays one beside
          // every staircase in a house.
          sketch.plant(end.x, end.y, 'smallRug');
        }
      }
    }
  }
  return sketch;
}

/**
 * Where the Underground Path's stairwell stands, from the end of the way
 * through that goes down it: three tiles wide and three deep, the end on the
 * middle of its east column, which is floor - FireRed's own stairwell is
 * pressed into westward from there.
 */
export function stairwellAt(end: Pick<MapFileLinkEnd, 'x' | 'y'>): { x: number; y: number } {
  return { x: end.x - 2, y: end.y - 1 };
}

/** How much of a tunnel each of its staircases takes: up eastward four deep, up westward three. */
export const TUNNEL_STAIRS_SIZE = {
  right: { width: 2, height: 4 },
  left: { width: 2, height: 3 },
} as const;

/**
 * Where a tunnel's stairs stand, from the end of the way through that goes up
 * them: east of it with their top two rows above it for the stairs up
 * eastward, west of it and a row above for the stairs up westward, as the
 * Underground Path's own are.
 */
export function tunnelStairsAt(end: Pick<MapFileLinkEnd, 'x' | 'y' | 'toward'>): { x: number; y: number } {
  return end.toward === 'right' ? { x: end.x + 1, y: end.y - 2 } : { x: end.x - 2, y: end.y - 1 };
}

/** How much of a room a staircase takes: two tiles wide and three deep, its top row against the back wall. */
export const STAIRS_SIZE = { width: 2, height: 3 } as const;

/**
 * Where a staircase stands, from the end of the way through that is gone up
 * or down it. FireRed puts the way onto a staircase on a little rug beside its
 * middle row - west of a staircase up, east of one down - and in its own
 * player's house the two rugs are the same tile of the two floors, so going up
 * and coming down never moves you across the room. You stand on the rug and
 * press towards the stairs.
 */
export function stairsAt(end: Pick<MapFileLinkEnd, 'x' | 'y' | 'look'>): { x: number; y: number } {
  return end.look === 'stairs-down'
    ? { x: end.x - STAIRS_SIZE.width, y: end.y - 1 }
    : { x: end.x + 1, y: end.y - 1 };
}

/** The way you press to go onto a staircase from its rug. */
export function stairsToward(look: 'stairs-up' | 'stairs-down'): 'left' | 'right' {
  return look === 'stairs-up' ? 'right' : 'left';
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
  const toGridIn = (area: string | undefined, tile: GridPosition): GridPosition => {
    const rect = origin.get(area);
    if (!rect) {
      throw new Error(`a way through ends in '${String(area)}', which the map does not have`);
    }
    return { x: rect.x + tile.x, y: rect.y + tile.y };
  };
  const toGrid = (end: MapFileLinkEnd): GridPosition => toGridIn(end.area, end);
  const doorways: ComposedDoorway[] = [];
  for (const link of file.links ?? []) {
    const [a, b] = link.ends;
    for (const [from, to] of [
      [a, b],
      [b, a],
    ] as const) {
      const delta = DIRECTION_DELTAS[from.toward];
      const own = toGrid(from);
      const art = artOf(from, own, { x: own.x + delta.x, y: own.y + delta.y });
      const near = landingsOf(file, from).map((tile) => toGridIn(from.area, tile));
      const far = landingsOf(file, to).map((tile) => toGridIn(to.area, tile));
      near.forEach((landing, index) => {
        const doorway = { x: landing.x + delta.x, y: landing.y + delta.y };
        // What a doorway is pressed into is solid, whatever was drawn there: an
        // open door in a house front is a pocket you step into until it leads
        // somewhere, and from then on it is the way through and nothing else.
        if (layers.collision[doorway.y]?.[doorway.x] !== undefined) {
          layers.collision[doorway.y][doorway.x] = true;
        }
        const primary = landing.x === own.x && landing.y === own.y;
        // Two ends as wide as each other are gone through tile for tile, both
        // ways; otherwise every tile comes out on the other end's own.
        const matched = near.length === far.length;
        doorways.push({
          from: landing,
          toward: from.toward,
          to: matched ? far[index] : toGrid(to),
          doorway,
          arrivalFacing: arrivalFacing(to.toward),
          look: from.look,
          art,
          primary,
          twoWay: matched || primary,
        });
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

/** What a way through draws, in the composed grid: the staircase, the mat, or the door. */
function artOf(end: MapFileLinkEnd, landing: GridPosition, doorway: GridPosition): Rect {
  if (end.look === 'stairs-up' || end.look === 'stairs-down') {
    const at = stairsAt(end);
    return {
      x: landing.x + (at.x - end.x),
      y: landing.y + (at.y - end.y),
      ...STAIRS_SIZE,
    };
  }
  if (end.look === 'mat' && (end.toward === 'left' || end.toward === 'right')) {
    return { x: end.toward === 'left' ? landing.x - 1 : landing.x, y: landing.y - 1, width: 2, height: 3 };
  }
  if (end.look === 'mat') {
    return { x: landing.x - 1, y: landing.y, width: 3, height: 1 };
  }
  if (end.look === 'back-door') {
    return { x: doorway.x - 1, y: doorway.y - 1, width: 3, height: 2 };
  }
  if (end.look === 'stairwell') {
    const at = stairwellAt(end);
    return { x: landing.x + (at.x - end.x), y: landing.y + (at.y - end.y), width: 3, height: 3 };
  }
  if (end.look === 'tunnel-stairs' && (end.toward === 'left' || end.toward === 'right')) {
    const at = tunnelStairsAt(end);
    return { x: landing.x + (at.x - end.x), y: landing.y + (at.y - end.y), ...TUNNEL_STAIRS_SIZE[end.toward] };
  }
  if (end.look === 'cave-exit') {
    return { x: doorway.x - 1, y: doorway.y, width: 3, height: 1 };
  }
  if (end.look === 'ladder-up') {
    return { x: landing.x, y: landing.y - 1, width: 1, height: 2 };
  }
  return { ...doorway, width: 1, height: 1 };
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
