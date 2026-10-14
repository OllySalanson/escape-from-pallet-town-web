import {
  buildingDoorways,
  doorwayTiles,
  isFurniture,
  plantedProp,
  type MapFile,
  type MapFileBuilding,
  type MapFileBuildingKind,
  type MapFileDoorKind,
  type MapFileLinkEnd,
  type MapFileSpot,
} from '../world/mapFile';
import {
  doorwayOf,
  landingsOf,
  STAIRS_SIZE,
  stairsAt,
  stairwellAt,
  TUNNEL_STAIRS_SIZE,
  tunnelStairsAt,
} from '../world/mapAreas';
import { berryName } from '../world/berries';
import { pokemonName } from '../world/pokemonFigures';
import { MATERIAL_CHARS, MATERIALS, materialForChar } from '../world/tileset/materials';
import {
  BUILDING_CHOICES,
  FURNITURE_CHOICES,
  groundUnder,
  type GroundBrush,
  type PlantGroup,
} from './palette';
import type { GridPoint, SpotKind, ThingRef } from './draft';

/**
 * Where a thing may go on a map, and what putting it there does to whatever is
 * there already - the map maker's collisions (the captain, 2026-10-12: a Gym
 * dropped on a block of trees came out with the trees' tips through its roof,
 * half-trees round its walls and its door opening onto a wood).
 *
 * The rules, the way the editors that do this well do it - Mario Maker's red
 * cross, The Sims' green and red footprint, a city builder's trees cleared
 * under a building and its "can't build here" over another one, Minecraft's
 * replaceable grass, Animal Crossing's clear plot in front of a house's door:
 *
 * - **Everything has a footprint, an overhang and, if it has a door, a
 *   doorstep.** The footprint is every tile it draws that it stands on (solid
 *   or walked, like a bridge's deck); the overhang is what it draws over other
 *   tiles without standing on them - a tree's crown, an arch's span (a
 *   broadleaf's brim decides nothing, as in the game); a doorstep is the tile
 *   its door is stood at from, which has to be ground somebody can stand on.
 * - **One thing to a tile.** Nothing stands on anything else's footprint or
 *   doorstep, and a crown hangs over nothing but ground - never over a roof,
 *   which is what keeps the drawing order right: a crown on the canopy layer
 *   is drawn over everything under it, so it may only be over what is behind
 *   it, and the only thing never in front of a crown is open ground.
 * - **Soft things give way to bigger ones.** Growth - a wood, a hedge, a
 *   bush - is cleared from under anything planted and from its doorstep; loose
 *   things - the Nature and Things pieces, a tree, a stump, a crate - are
 *   cleared from under a building. Either is one step of undo. A wood is cut a
 *   whole tree at a time, never leaving half of one, and a tree whose tip
 *   would hang over a new building's wall goes too. Nothing smaller clears
 *   anything: a berry tree in a hedge, a tree on a stump, a crate on a bench
 *   are refused.
 * - **Hard things refuse.** Another building, the places a raid is for (a
 *   drop-in, an exit, an item, a landmark, a person, a Pokemon, a berry tree, a
 *   boulder, a sign, a trainer), a field move's door, deep and shallow water,
 *   rock, a fence, a wall and a ledge refuse a building, with the tiles at
 *   fault shown red and one line saying why. Only the pieces made for water -
 *   a jetty, a bridge, a ship - stand on it.
 * - **Nothing may be boxed in.** A thing a player walks onto or up to needs a
 *   side to be reached from, and an edit that would take the last one away - a
 *   person stood beside a berry tree, a stroke of trees painted round it - is
 *   refused, or in a stroke that tile is left alone.
 *
 * Inside a building only the footprint rules apply: furniture stands on walls
 * by design (a window, a poster), and a room has no growth to clear.
 *
 * Everything here is a pure function of a map file - the place on screen, as
 * `maker/areas.ts` focuses it - so the ghost the maker sees before a click and
 * the edit the click makes are the same answer, and the tests ask it directly.
 */

/** The list in a file each kind of one-tile thing is kept in. */
export const SPOT_LISTS = {
  'drop-in': 'dropIns',
  exit: 'exits',
  item: 'itemSpots',
  person: 'people',
  pokemon: 'pokemon',
  'berry-tree': 'berryTrees',
  boulder: 'boulders',
  sign: 'signs',
  landmark: 'landmarks',
  trainer: 'trainers',
} as const satisfies Record<SpotKind, keyof MapFile>;

/** Every one-tile thing on a map, the one drawn on top first. */
export const SPOT_ORDER: readonly SpotKind[] = [
  'drop-in',
  'exit',
  'trainer',
  'person',
  'pokemon',
  'berry-tree',
  'boulder',
  'sign',
  'landmark',
  'item',
];

export function spotsOf(file: MapFile, kind: SpotKind): readonly MapFileSpot[] {
  return file[SPOT_LISTS[kind]] ?? [];
}

/**
 * The one-tile things nobody walks through for good: a person, a Pokemon, a
 * berry tree and a sign. A trainer is walked into - the fight - and beaten
 * stays out of the way; a boulder is pushed aside with Strength; a door of
 * Cut, Rock Smash or Surf opens: none of those shuts a side for good.
 */
const BLOCKERS: ReadonlySet<SpotKind> = new Set(['person', 'pokemon', 'berry-tree', 'sign']);

/** What a planted piece is, for what it may stand on and what it may clear. */
export type PieceClass = 'building' | 'structure' | 'clutter' | 'furniture';

const CLASS_OF_GROUP: Readonly<Record<PlantGroup, PieceClass>> = {
  Buildings: 'building',
  Landmarks: 'building',
  Nature: 'clutter',
  Things: 'clutter',
  Town: 'structure',
  Signs: 'structure',
};

export function pieceClass(kind: MapFileBuildingKind): PieceClass {
  if (isFurniture(kind)) {
    return 'furniture';
  }
  // A cave mouth is a way into a cave, cut into rock: nothing clears it away.
  if (kind === 'cave-mouth') {
    return 'structure';
  }
  const choice = BUILDING_CHOICES.find((candidate) => candidate.kind === kind);
  return choice ? CLASS_OF_GROUP[choice.group] : 'structure';
}

/** The pieces made to stand in water or over it, which are let stand on it. */
const WATER_PIECES: ReadonlySet<string> = new Set([
  ...BUILDING_CHOICES.filter((choice) => choice.on === 'water').map((choice) => choice.kind),
  'pier',
]);

const key = (x: number, y: number): string => `${x},${y}`;
const at = ({ x, y }: GridPoint): string => `${x},${y}`;

/** The ground letters that stand on ground rather than being it, and whether each is solid. */
const STAMP_SOLID: Readonly<Record<string, boolean>> = {
  f: false,
  r: false,
  o: true,
  u: true,
  k: true,
  '<': true,
  '=': true,
  '>': true,
};

/** Whether a ground letter is something nobody walks on. */
export function letterIsSolid(letter: string | undefined): boolean {
  if (letter === undefined) {
    return true;
  }
  if (Object.hasOwn(STAMP_SOLID, letter)) {
    return STAMP_SOLID[letter];
  }
  const material = materialForChar(letter);
  return material === undefined ? true : MATERIALS[material].solid;
}

/** Growth: a wood, a hedge and a bush, which a building clears from under itself. */
const GROWTH: ReadonlySet<string> = new Set([
  MATERIAL_CHARS.tree,
  MATERIAL_CHARS.hedge,
  'o',
  'u',
  'k',
]);

/** What a cleared tile of growth goes back to: the ground it stood on. */
function clearedLetter(letter: string): string {
  return letter === MATERIAL_CHARS.tree || letter === MATERIAL_CHARS.hedge
    ? MATERIAL_CHARS.grass
    : groundUnder(letter);
}

/** How a tile of ground is named when it is in the way, outdoors. */
const GROUND_IN_THE_WAY: Readonly<Record<string, string>> = {
  [MATERIAL_CHARS.tree]: 'Trees are in the way',
  [MATERIAL_CHARS.hedge]: 'A hedge is in the way',
  o: 'A bush is in the way',
  u: 'A bush is in the way',
  k: 'A bush is in the way',
  [MATERIAL_CHARS.water]: 'That is deep water',
  [MATERIAL_CHARS.ford]: 'That is shallow water',
  [MATERIAL_CHARS.cliff]: 'Rock is in the way',
  [MATERIAL_CHARS.fence]: 'A fence is in the way',
  [MATERIAL_CHARS.wall]: 'A wall is in the way',
  '<': 'A ledge is in the way',
  '=': 'A ledge is in the way',
  '>': 'A ledge is in the way',
};

/** And what a door would open onto. */
const GROUND_AT_A_DOOR: Readonly<Record<string, string>> = {
  [MATERIAL_CHARS.water]: 'deep water',
  [MATERIAL_CHARS.ford]: 'shallow water',
  [MATERIAL_CHARS.cliff]: 'rock',
  [MATERIAL_CHARS.fence]: 'a fence',
  [MATERIAL_CHARS.wall]: 'a wall',
  '<': 'a ledge',
  '=': 'a ledge',
  '>': 'a ledge',
};

/** Indoors, the two solid grounds are the room's walls and the dark beyond them. */
function indoorGround(letter: string, cave: boolean): string {
  return letter === MATERIAL_CHARS.cliff
    ? 'That is outside the room'
    : cave
      ? "That is the cave's rock"
      : "That is the room's wall";
}

/** A thing by the name a maker knows it by, as it would be said mid-sentence. */
export function spotName(file: MapFile, kind: SpotKind, index: number): string {
  const spot = spotsOf(file, kind)[index] as MapFileSpot & {
    readonly name?: string;
    readonly berry?: Parameters<typeof berryName>[0];
    readonly species?: Parameters<typeof pokemonName>[0];
  };
  // A name the maker never changed already says what it is: Drop-in 1, Exit 2.
  const named = (word: string): string =>
    spot.name === undefined
      ? `the ${word}`
      : spot.name.toLowerCase().startsWith(word)
        ? spot.name
        : `the ${word} ${spot.name}`;
  switch (kind) {
    case 'drop-in':
      return named('drop-in');
    case 'exit':
      return named('exit');
    case 'item':
      return 'an item spot';
    case 'landmark':
      return named('landmark');
    case 'person':
    case 'trainer':
      return spot.name ?? kind;
    case 'pokemon':
      return spot.species ? `the ${pokemonName(spot.species)}` : 'the Pokémon';
    case 'berry-tree':
      return spot.berry ? `the ${berryName(spot.berry)} tree` : 'the berry tree';
    case 'boulder':
      return 'a boulder';
    case 'sign':
      return 'a sign';
  }
}

/** Names that are names, not kinds of thing, and keep their capital mid-sentence. */
const PROPER =
  /^(Pokémon|Poké|Pewter|Silph|Game Corner|Cerulean|Vermilion|Celadon|Fuchsia|Saffron|Cinnabar|Safari|Underground|League|Fighting|S\.S\.|Seagallop|Lapras)/;

/** A planted piece by the name the Paint list gives it, mid-sentence: "the house". */
export function pieceName(kind: MapFileBuildingKind): string {
  const label =
    [...BUILDING_CHOICES, ...FURNITURE_CHOICES].find((choice) => choice.kind === kind)?.label ??
    plantedProp(kind).label;
  return `the ${PROPER.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1)}`;
}

const DOOR_NAMES: Readonly<Record<MapFileDoorKind, string>> = {
  'cut-tree': 'the small tree',
  'smash-rock': 'the cracked rock',
  surf: 'the deep water',
  night: 'the night track',
  boss: "the keeper's gate",
};

/** A name said at the start of a sentence: "the house" as "The house". */
export const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** A piece's cells, relative to its corner, read once per kind. */
interface Shape {
  /** Every cell it draws that it stands on: a wall, a floor, a deck. */
  readonly claimed: readonly { readonly x: number; readonly y: number; readonly solid: boolean }[];
  /** Cells drawn over whatever is under them that nobody is meant to walk under: a crown. */
  readonly crowns: readonly GridPoint[];
  /** Cells drawn over a way that is walked under: an arch's span, a gatehouse's ridge. */
  readonly spans: readonly GridPoint[];
}

const shapes = new Map<string, Shape>();

function shapeOfKind(kind: MapFileBuildingKind): Shape {
  const known = shapes.get(kind);
  if (known) {
    return known;
  }
  const prop = plantedProp(kind);
  const claimed: { x: number; y: number; solid: boolean }[] = [];
  const crowns: GridPoint[] = [];
  const spans: GridPoint[] = [];
  prop.cells.forEach((cell, index) => {
    if (cell.tile < 0) {
      return;
    }
    const x = index % prop.width;
    const y = Math.floor(index / prop.width);
    if (cell.canopy) {
      (cell.walkedUnder ? spans : crowns).push({ x, y });
    } else {
      claimed.push({ x, y, solid: cell.solid });
    }
  });
  const shape = { claimed, crowns, spans };
  shapes.set(kind, shape);
  return shape;
}

/** Where a piece stands, once planted: its footprint, its overhang and its doorsteps, on the map. */
export interface PieceFootprint {
  readonly claimed: readonly { readonly x: number; readonly y: number; readonly solid: boolean }[];
  readonly crowns: readonly GridPoint[];
  readonly spans: readonly GridPoint[];
  readonly doorsteps: readonly GridPoint[];
  /** The row above it a broadleaf's crown rises into: drawn, and deciding nothing. */
  readonly brim: readonly GridPoint[];
}

export function footprintOf(building: MapFileBuilding): PieceFootprint {
  const shape = shapeOfKind(building.kind);
  const move = <T extends GridPoint>(cell: T): T => ({
    ...cell,
    x: building.x + cell.x,
    y: building.y + cell.y,
  });
  const claimed = shape.claimed.map(move);
  return {
    claimed,
    crowns: shape.crowns.map(move),
    spans: shape.spans.map(move),
    doorsteps: isFurniture(building.kind) ? [] : buildingDoorways(building).flatMap(doorwayTiles),
    brim: (plantedProp(building.kind).brim?.tiles ?? []).flatMap((tile, column) =>
      tile < 0 ? [] : [{ x: building.x + column, y: building.y - 1 }],
    ),
  };
}

/**
 * The tiles the art of a way through a room covers - a mat, a staircase and
 * its rug, a ladder, a hole, a notch of daylight - where nothing else may stand.
 */
export function doorwayArt(at: MapFileLinkEnd): readonly GridPoint[] {
  const ahead = doorwayOf(at);
  const rect = (x: number, y: number, width: number, height: number): GridPoint[] =>
    Array.from({ length: width * height }, (_, cell) => ({
      x: x + (cell % width),
      y: y + Math.floor(cell / width),
    }));
  switch (at.look) {
    case 'mat':
      return at.toward === 'left' || at.toward === 'right'
        ? rect(at.toward === 'left' ? at.x - 1 : at.x, at.y - 1, 2, 3)
        : rect(Math.max(0, at.x - 1), at.y, 3, 1);
    case 'back-door':
      return rect(ahead.x - 1, ahead.y - 1, 3, 2);
    case 'stairwell': {
      const corner = stairwellAt(at);
      return rect(corner.x, corner.y, 3, 3);
    }
    case 'tunnel-stairs': {
      if (at.toward !== 'left' && at.toward !== 'right') {
        return [];
      }
      const corner = tunnelStairsAt(at);
      const size = TUNNEL_STAIRS_SIZE[at.toward];
      return rect(corner.x, corner.y, size.width, size.height);
    }
    case 'stairs-up':
    case 'stairs-down': {
      const corner = stairsAt(at);
      return [
        ...rect(corner.x, corner.y, STAIRS_SIZE.width, STAIRS_SIZE.height),
        ...rect(at.x, at.y, 1, 2),
      ];
    }
    case 'cave-exit':
      return rect(ahead.x - 1, ahead.y, 3, 1);
    case 'ladder-up':
      return rect(at.x, at.y - 1, 1, 2);
    case 'ladder-down':
      return rect(ahead.x, ahead.y, 1, 1);
    default:
      return [{ x: at.x, y: at.y }];
  }
}

/** The place on screen a placement is asked of: the outdoors, or one inside of the file. */
export interface PlacementPlace {
  /** The inside on screen, by id; absent is the outdoors. */
  readonly area?: string;
  /** The building being carried to a new tile, by its place in the list: it is not in its own way. */
  readonly moving?: ThingRef;
}

type SpotAt = { readonly kind: SpotKind; readonly index: number };

/** What stands where in one place of a map: every footprint, overhang and doorstep on it. */
class Survey {
  public readonly file: MapFile;
  public readonly width: number;
  public readonly height: number;
  private readonly spots = new Map<string, SpotAt>();
  /** The footprint on a tile, the piece planted last on top, as the layer builder draws it. */
  private readonly claims = new Map<string, { readonly piece: number; readonly solid: boolean }>();
  private readonly crowns = new Map<string, number>();
  private readonly spans = new Map<string, number>();
  private readonly doors = new Map<string, number>();
  /** A door's doorstep, by the piece whose door it is - or, indoors, the way through it is. */
  private readonly doorsteps = new Map<
    string,
    { readonly piece?: number; readonly link?: number }
  >();
  /** Indoors, the tiles the art of a way through covers. */
  private readonly art = new Set<string>();

  public constructor(file: MapFile, place: PlacementPlace) {
    this.file = file;
    this.width = file.width;
    this.height = file.height;
    const moving = place.moving;
    for (const kind of SPOT_ORDER) {
      spotsOf(file, kind).forEach((spot, index) => {
        if (moving?.kind === kind && moving.index === index) {
          return;
        }
        if (!this.spots.has(at(spot))) {
          this.spots.set(at(spot), { kind, index });
        }
      });
    }
    file.buildings.forEach((building, piece) => {
      const footprint = footprintOf(building);
      if (moving?.kind === 'building' && moving.index === piece) {
        return;
      }
      for (const cell of footprint.claimed) {
        this.claims.set(at(cell), { piece, solid: cell.solid });
      }
      for (const cell of footprint.crowns) {
        this.crowns.set(at(cell), piece);
      }
      for (const cell of footprint.spans) {
        this.spans.set(at(cell), piece);
      }
      for (const step of footprint.doorsteps) {
        this.doorsteps.set(at(step), { piece });
      }
    });
    (file.doors ?? []).forEach((door, index) => {
      if (moving?.kind === 'door' && moving.index === index) {
        return;
      }
      for (let y = door.y; y < door.y + door.height; y += 1) {
        for (let x = door.x; x < door.x + door.width; x += 1) {
          this.doors.set(key(x, y), index);
        }
      }
    });
    // Outdoors every way through stands at a building's door, whose doorstep
    // is already marked; indoors each one's landing and its art are the room's.
    if (place.area !== undefined) {
      (file.links ?? []).forEach((link, index) =>
        link.ends.forEach((end) => {
          if (end.area !== place.area) {
            return;
          }
          for (const tile of landingsOf(file, end)) {
            this.doorsteps.set(at(tile), { link: index });
          }
          for (const tile of doorwayArt(end)) {
            this.art.add(at(tile));
          }
        }),
      );
    }
  }

  public onMap(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  public letter(x: number, y: number): string | undefined {
    return this.file.ground[y]?.[x];
  }

  public spot(x: number, y: number): SpotAt | undefined {
    return this.spots.get(key(x, y));
  }

  public claim(
    x: number,
    y: number,
  ): { readonly piece: number; readonly solid: boolean } | undefined {
    return this.claims.get(key(x, y));
  }

  public crown(x: number, y: number): number | undefined {
    return this.crowns.get(key(x, y));
  }

  public span(x: number, y: number): number | undefined {
    return this.spans.get(key(x, y));
  }

  public door(x: number, y: number): number | undefined {
    return this.doors.get(key(x, y));
  }

  public doorstep(
    x: number,
    y: number,
  ): { readonly piece?: number; readonly link?: number } | undefined {
    return this.doorsteps.get(key(x, y));
  }

  public isArt(x: number, y: number): boolean {
    return this.art.has(key(x, y));
  }

  /** Whether somebody can stand on a tile to reach the thing beside it. */
  public standable(x: number, y: number): boolean {
    if (!this.onMap(x, y)) {
      return false;
    }
    const claim = this.claim(x, y);
    if (claim) {
      return !claim.solid;
    }
    if (letterIsSolid(this.letter(x, y))) {
      return false;
    }
    const spot = this.spot(x, y);
    return !(spot && BLOCKERS.has(spot.kind));
  }

  /** How many sides of a tile can be stood on. */
  public openSides({ x, y }: GridPoint): number {
    return [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ].filter(([nx, ny]) => this.standable(nx, ny)).length;
  }

  /** The doorstep of a piece, or of a way through a room, by name. */
  public doorstepName(step: { readonly piece?: number; readonly link?: number }): string {
    return step.piece !== undefined
      ? `the doorstep of ${pieceName(this.file.buildings[step.piece].kind)}`
      : 'the way out of the room';
  }
}

/** Every spot on a map that the change from `before` to `after` boxed in, by the tiles that changed. */
function boxedIn(before: Survey, after: Survey, changed: readonly GridPoint[]): SpotAt | undefined {
  const near = new Set<string>();
  for (const { x, y } of changed) {
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
      [x, y],
    ]) {
      near.add(key(nx, ny));
    }
  }
  for (const tile of near) {
    const [x, y] = tile.split(',').map(Number);
    const spot = after.spot(x, y);
    if (
      spot &&
      before.spot(x, y) &&
      after.openSides({ x, y }) === 0 &&
      before.openSides({ x, y }) > 0
    ) {
      return spot;
    }
  }
  return undefined;
}

/** What a placement would do, asked before it is done: the ghost a maker sees, and the edit. */
export interface PlacementPlan {
  readonly ok: boolean;
  /** Why not, in one line, when it is refused. */
  readonly reason?: string;
  /** The tiles it would stand on. */
  readonly footprint: readonly GridPoint[];
  /** The tiles it would hang over: its crown, its span. */
  readonly overhang: readonly GridPoint[];
  /** The row above it the top of a broadleaf's crown is drawn into, deciding nothing. */
  readonly brim: readonly GridPoint[];
  /** The tiles its doors would be stood at from. */
  readonly doorsteps: readonly GridPoint[];
  /** The tiles that refuse it. */
  readonly blocked: readonly GridPoint[];
  /** The tiles whose growth it would clear, and the tiles of every piece it would clear away. */
  readonly clears: readonly GridPoint[];
  /** Said beside the ghost when it clears anything: "Clears 4 trees and a crate." */
  readonly note?: string;
  /** The map with it placed, when it can be. */
  readonly file?: MapFile;
  /** Where it ended up in its list, when it could be placed. */
  readonly index?: number;
  /** The pieces it cleared away, by their place in the list it was given. */
  readonly felled?: readonly number[];
}

const refused = (
  reason: string,
  blocked: readonly GridPoint[],
  footprint: readonly GridPoint[] = [],
  doorsteps: readonly GridPoint[] = [],
  overhang: readonly GridPoint[] = [],
  brim: readonly GridPoint[] = [],
): PlacementPlan => ({
  ok: false,
  reason,
  blocked,
  footprint,
  overhang,
  brim,
  doorsteps,
  clears: [],
});

/** Every tile of the lattice tree a tile of wood stands in: a wood is felled a whole tree at a time. */
function treeOf(file: MapFile, { x, y }: GridPoint): GridPoint[] {
  const left = x - (x % 2);
  const top = y - (y % 2);
  return [
    { x: left, y: top },
    { x: left + 1, y: top },
    { x: left, y: top + 1 },
    { x: left + 1, y: top + 1 },
  ].filter((tile) => file.ground[tile.y]?.[tile.x] === MATERIAL_CHARS.tree);
}

/**
 * The map with the wood it has just grown felled from under some tiles. A map
 * grows by drawing past its edge, and the ground it grows is a wood, so the map
 * never opens a hole in its edge; but ground grown to hold a thing is that
 * thing's, and a drop-in placed past the edge would otherwise land in trees and
 * be refused for it. Whole trees, as anywhere, and only trees outside `kept` -
 * the map as it was, in the grown map's tiles - so nothing the maker drew goes.
 */
export function clearGrownWood(
  file: MapFile,
  tiles: readonly GridPoint[],
  kept: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): MapFile {
  const grown = (tile: GridPoint): boolean =>
    tile.x < kept.x ||
    tile.y < kept.y ||
    tile.x >= kept.x + kept.width ||
    tile.y >= kept.y + kept.height;
  const felled = new Map<string, GridPoint>();
  for (const tile of tiles) {
    if (grown(tile) && file.ground[tile.y]?.[tile.x] === MATERIAL_CHARS.tree) {
      for (const cell of treeOf(file, tile).filter(grown)) {
        felled.set(at(cell), cell);
      }
    }
  }
  if (felled.size === 0) {
    return file;
  }
  return {
    ...file,
    ground: file.ground.map((row, y) =>
      [...row].map((letter, x) => (felled.has(key(x, y)) ? MATERIAL_CHARS.grass : letter)).join(''),
    ),
  };
}

/** A tile of growth a placement cleared, and the letter that grew there. */
export interface ClearedGrowth {
  readonly x: number;
  readonly y: number;
  readonly letter: string;
}

/** The growth a placement cleared: every tile of ground it changed, and what stood there before. */
export function growthCleared(before: MapFile, after: MapFile): ClearedGrowth[] {
  if (before.width !== after.width || before.height !== after.height) {
    return [];
  }
  const cleared: ClearedGrowth[] = [];
  before.ground.forEach((row, y) => {
    const now = after.ground[y];
    if (now === row) {
      return;
    }
    for (let x = 0; x < row.length; x += 1) {
      if (now[x] !== row[x] && GROWTH.has(row[x])) {
        cleared.push({ x, y, letter: row[x] });
      }
    }
  });
  return cleared;
}

/**
 * The map with the growth a building cleared grown back, once the building
 * has gone from there: a clearing is the building's, so carried out of a wood
 * it takes its clearing with it rather than leaving a hole in the trees. Only
 * where the ground is still the cleared ground and nothing else has come to
 * stand on it, under it or at its door since - a tree whole or not at all, and
 * never with its tip over anything - and nothing grows back if it would box a
 * thing in.
 */
export function regrowCleared(
  file: MapFile,
  cleared: readonly ClearedGrowth[],
  place: PlacementPlace = {},
): MapFile {
  const survey = new Survey(file, place);
  const taken = (x: number, y: number): boolean =>
    !survey.onMap(x, y) ||
    survey.claim(x, y) !== undefined ||
    survey.crown(x, y) !== undefined ||
    survey.span(x, y) !== undefined ||
    survey.door(x, y) !== undefined ||
    survey.doorstep(x, y) !== undefined ||
    survey.spot(x, y) !== undefined ||
    survey.isArt(x, y);
  const groups = new Map<string, ClearedGrowth[]>();
  for (const tile of cleared) {
    const group =
      tile.letter === MATERIAL_CHARS.tree
        ? `tree ${tile.x - (tile.x % 2)},${tile.y - (tile.y % 2)}`
        : at(tile);
    groups.set(group, [...(groups.get(group) ?? []), tile]);
  }
  const regrown = new Map<string, ClearedGrowth>();
  for (const group of groups.values()) {
    const fits = group.every(
      (tile) =>
        survey.letter(tile.x, tile.y) === clearedLetter(tile.letter) && !taken(tile.x, tile.y),
    );
    if (!fits) {
      continue;
    }
    if (group[0].letter === MATERIAL_CHARS.tree) {
      const left = group[0].x - (group[0].x % 2);
      const top = group[0].y - (group[0].y % 2);
      const whole = [
        [left, top],
        [left + 1, top],
        [left, top + 1],
        [left + 1, top + 1],
      ].every(
        ([x, y]) =>
          survey.letter(x, y) === MATERIAL_CHARS.tree ||
          group.some((tile) => tile.x === x && tile.y === y),
      );
      // A whole tree's tip hangs on the row above, and a crown hangs over nothing but ground.
      if (whole && top > 0 && (taken(left, top - 1) || taken(left + 1, top - 1))) {
        continue;
      }
    }
    for (const tile of group) {
      regrown.set(at(tile), tile);
    }
  }
  if (regrown.size === 0) {
    return file;
  }
  const next: MapFile = {
    ...file,
    ground: file.ground.map((row, y) =>
      [...row].map((letter, x) => regrown.get(key(x, y))?.letter ?? letter).join(''),
    ),
  };
  return boxedIn(survey, new Survey(next, place), [...regrown.values()]) ? file : next;
}

/** Whether a whole tree stands with its body's west cell at an even tile: its tip hangs on the row above. */
function wholeTreeAt(file: MapFile, left: number, top: number): boolean {
  return [
    [left, top],
    [left + 1, top],
    [left, top + 1],
    [left + 1, top + 1],
  ].every(([x, y]) => file.ground[y]?.[x] === MATERIAL_CHARS.tree);
}

/** The whole tree whose tip would hang over a tile, if one stands below it. */
function treeTippedOver(file: MapFile, { x, y }: GridPoint): GridPoint[] {
  // A tip is drawn on the row above a tree's body, and bodies stand on even rows.
  if (y % 2 === 0) {
    return [];
  }
  const left = x - (x % 2);
  return wholeTreeAt(file, left, y + 1) ? treeOf(file, { x: left, y: y + 1 }) : [];
}

/** Counted, for a note: "4 trees", "a crate". */
function counted(count: number, one: string, many: string): string {
  return count === 1 ? one : `${count} ${many}`;
}

/** Parts of a sentence as a list: "a, b and c". */
function listed(parts: readonly string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/**
 * Planting a piece with its top-left corner on a tile: whether it may go, and
 * the map with it there and whatever it clears gone.
 */
export function planPiece(
  file: MapFile,
  kind: MapFileBuildingKind,
  corner: GridPoint,
  place: PlacementPlace = {},
): PlacementPlan {
  const survey = new Survey(file, place);
  const prop = plantedProp(kind);
  const piece: MapFileBuilding = { x: corner.x, y: corner.y, kind };
  const footprint = footprintOf(piece);
  const claimed = footprint.claimed;
  const tiles = claimed.map(({ x, y }) => ({ x, y }));
  const overhang = [...footprint.crowns, ...footprint.spans];
  const brim = footprint.brim;
  if (
    corner.x < 0 ||
    corner.y < 0 ||
    corner.x + prop.width > file.width ||
    corner.y + prop.height > file.height
  ) {
    return refused(
      'It does not fit there: part of it is off the map.',
      [],
      tiles,
      footprint.doorsteps,
      overhang,
      brim,
    );
  }
  const role = pieceClass(kind);
  const indoors = place.area !== undefined || role === 'furniture';
  const clearsClutter = role === 'building';
  const onWater = WATER_PIECES.has(kind);
  const own = new Set(tiles.map(at));
  const felled = new Set<number>();
  const groundCleared = new Map<string, GridPoint>();
  const blocked: GridPoint[] = [];
  let reason: string | undefined;
  const refuse = (tile: GridPoint, why: string): void => {
    blocked.push(tile);
    reason ??= why;
  };
  /** The things standing where it would stand, by name: all of them are said, not only the first. */
  const inTheWay = new Set<string>();
  const standsThere = (tile: GridPoint, name: string): void => {
    blocked.push(tile);
    inTheWay.add(name);
  };
  /** Another piece in the way: cleared, if it is clutter and this is a building. */
  const pieceInTheWay = (tile: GridPoint, other: number, why: (name: string) => string): void => {
    const otherKind = file.buildings[other].kind;
    if (clearsClutter && pieceClass(otherKind) === 'clutter') {
      felled.add(other);
    } else {
      refuse(tile, why(pieceName(otherKind)));
    }
  };
  /** Growth on a tile a building needs clear: a whole tree of a wood, or the one tile of anything else. */
  const clearGrowth = (tile: GridPoint): void => {
    const letter = survey.letter(tile.x, tile.y) ?? '';
    for (const cleared of letter === MATERIAL_CHARS.tree ? treeOf(file, tile) : [tile]) {
      groundCleared.set(at(cleared), cleared);
    }
  };

  // The tiles it stands on.
  for (const cell of claimed) {
    const spot = survey.spot(cell.x, cell.y);
    const claim = survey.claim(cell.x, cell.y);
    const overhead = survey.crown(cell.x, cell.y) ?? survey.span(cell.x, cell.y);
    const door = survey.door(cell.x, cell.y);
    const step = survey.doorstep(cell.x, cell.y);
    if (spot) {
      standsThere(cell, spotName(file, spot.kind, spot.index));
    } else if (door !== undefined) {
      standsThere(cell, DOOR_NAMES[file.doors![door].kind]);
    } else if (survey.isArt(cell.x, cell.y)) {
      refuse(cell, 'The way out of the room is there.');
    } else if (step) {
      refuse(cell, `That is ${survey.doorstepName(step)}: keep it clear.`);
    }
    if (claim) {
      const otherKind = file.buildings[claim.piece].kind;
      if (clearsClutter && pieceClass(otherKind) === 'clutter') {
        felled.add(claim.piece);
      } else {
        standsThere(cell, pieceName(otherKind));
      }
    }
    if (overhead !== undefined) {
      pieceInTheWay(cell, overhead, (name) => `It would stand under ${name}.`);
    }
    if (indoors || kind === 'cave-mouth') {
      continue;
    }
    const letter = survey.letter(cell.x, cell.y) ?? '';
    if (GROWTH.has(letter)) {
      clearGrowth(cell);
    } else if (
      !onWater &&
      letterIsSolid(letter === MATERIAL_CHARS.ford ? MATERIAL_CHARS.water : letter)
    ) {
      refuse(cell, `${GROUND_IN_THE_WAY[letter] ?? 'Something solid is in the way'}.`);
    }
  }

  // A cave mouth is cut into the foot of a rock face, as FireRed cuts its own.
  if (kind === 'cave-mouth') {
    const rock = (x: number, y: number): boolean => survey.letter(x, y) === MATERIAL_CHARS.cliff;
    if (
      !rock(corner.x, corner.y) ||
      !rock(corner.x - 1, corner.y) ||
      !rock(corner.x + 1, corner.y) ||
      !rock(corner.x, corner.y - 1)
    ) {
      refuse(
        corner,
        'A cave mouth is cut into the foot of a rock face: paint rock there first, with rock either side and above.',
      );
    }
  }

  // What it hangs over.
  for (const cell of footprint.crowns) {
    if (!survey.onMap(cell.x, cell.y)) {
      continue;
    }
    const spot = survey.spot(cell.x, cell.y);
    const claim = survey.claim(cell.x, cell.y);
    const overhead = survey.crown(cell.x, cell.y) ?? survey.span(cell.x, cell.y);
    const step = survey.doorstep(cell.x, cell.y);
    if (spot) {
      refuse(cell, `Its leaves would hide ${spotName(file, spot.kind, spot.index)}.`);
    } else if (step) {
      refuse(cell, `Its leaves would hang over ${survey.doorstepName(step)}.`);
    }
    if (claim && !own.has(at(cell))) {
      pieceInTheWay(cell, claim.piece, (name) => `Its leaves would hang over ${name}.`);
    }
    if (overhead !== undefined) {
      pieceInTheWay(cell, overhead, (name) => `Its leaves would tangle with ${name}'s.`);
    }
  }
  for (const cell of footprint.spans) {
    if (!survey.onMap(cell.x, cell.y)) {
      continue;
    }
    const claim = survey.claim(cell.x, cell.y);
    const overhead = survey.crown(cell.x, cell.y) ?? survey.span(cell.x, cell.y);
    if (claim && !own.has(at(cell))) {
      pieceInTheWay(cell, claim.piece, (name) => `It would stand over ${name}.`);
    }
    if (overhead !== undefined) {
      pieceInTheWay(cell, overhead, (name) => `It would stand under ${name}.`);
    }
  }

  // Its doorsteps: ground somebody can stand on, with nothing on it.
  for (const step of footprint.doorsteps) {
    if (!survey.onMap(step.x, step.y)) {
      refuse(step, 'Its door would open off the edge of the map.');
      continue;
    }
    const spot = survey.spot(step.x, step.y);
    const claim = own.has(at(step)) ? undefined : survey.claim(step.x, step.y);
    const ownCell = claimed.find((cell) => cell.x === step.x && cell.y === step.y);
    const door = survey.door(step.x, step.y);
    const other = survey.doorstep(step.x, step.y);
    const overhead = survey.crown(step.x, step.y);
    if (spot) {
      refuse(step, `${capital(spotName(file, spot.kind, spot.index))} stands at its door.`);
    } else if (door !== undefined) {
      refuse(step, `${capital(DOOR_NAMES[file.doors![door].kind])} stands at its door.`);
    } else if (other) {
      refuse(step, `Its door would open onto ${survey.doorstepName(other)}.`);
    }
    if (claim?.solid) {
      pieceInTheWay(step, claim.piece, (name) => `Its door would open onto ${name}.`);
    }
    if (overhead !== undefined) {
      pieceInTheWay(step, overhead, (name) => `Its door would open under ${name}.`);
    }
    // A floor of its own - a gatehouse's, the Museum's step - is ground whatever is under it.
    if (claim || (ownCell && !ownCell.solid)) {
      continue;
    }
    const letter = survey.letter(step.x, step.y) ?? '';
    if (GROWTH.has(letter)) {
      clearGrowth(step);
    } else if (letterIsSolid(letter === MATERIAL_CHARS.ford ? MATERIAL_CHARS.water : letter)) {
      refuse(step, `Its door would open onto ${GROUND_AT_A_DOOR[letter] ?? 'something solid'}.`);
    }
  }

  // A building in a wood stands in a clearing: every tree whose tip would hang
  // over its walls goes too, so no crown is drawn over a roof.
  if (clearsClutter && !indoors) {
    for (const cell of claimed) {
      for (const cleared of treeTippedOver(file, cell)) {
        groundCleared.set(at(cleared), cleared);
      }
    }
  }

  // What stands where it would stand is said first, and all of it: "The house,
  // the Oran Berry tree and Person 1 are in the way."
  if (inTheWay.size > 0) {
    const names = [...inTheWay];
    const said =
      names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} more things`] : names;
    reason = `${capital(listed(said))} ${names.length === 1 ? 'is' : 'are'} in the way.`;
  }
  if (reason !== undefined) {
    return refused(reason, blocked, tiles, footprint.doorsteps, overhang, brim);
  }

  // The map with it there.
  const removed = [...felled].sort((a, b) => b - a);
  const buildings = file.buildings.filter((_building, index) => !felled.has(index));
  const ground =
    groundCleared.size === 0
      ? file.ground
      : file.ground.map((row, y) => {
          let next: string[] | undefined;
          for (let x = 0; x < row.length; x += 1) {
            if (groundCleared.has(key(x, y))) {
              next ??= [...row];
              next[x] = clearedLetter(row[x]);
            }
          }
          return next ? next.join('') : row;
        });
  const next: MapFile = { ...file, ground, buildings: [...buildings, piece] };
  const after = new Survey(next, { area: place.area });
  const changed = [
    ...tiles,
    ...groundCleared.values(),
    ...removed.flatMap((index) => footprintOf(file.buildings[index]).claimed),
  ];
  const boxed = boxedIn(survey, after, changed);
  if (boxed) {
    const spot = spotsOf(file, boxed.kind)[boxed.index];
    return refused(
      `It would box in ${spotName(file, boxed.kind, boxed.index)}: leave it a side to be reached from.`,
      [spot],
      tiles,
      footprint.doorsteps,
      overhang,
      brim,
    );
  }
  const trees = new Set(
    [...groundCleared.values()]
      .filter((tile) => file.ground[tile.y][tile.x] === MATERIAL_CHARS.tree)
      .map((tile) => at({ x: tile.x - (tile.x % 2), y: tile.y - (tile.y % 2) })),
  ).size;
  const otherGrowth = [...groundCleared.values()].filter(
    (tile) => file.ground[tile.y][tile.x] !== MATERIAL_CHARS.tree,
  ).length;
  // Named in the order they were planted.
  const pieces = [...removed]
    .reverse()
    .map((index) => pieceName(file.buildings[index].kind).replace(/^the /, 'a '));
  const parts = [
    trees > 0 ? counted(trees, 'a tree', 'trees') : '',
    otherGrowth > 0 ? counted(otherGrowth, 'a bush', 'bushes') : '',
    ...(pieces.length <= 3 ? pieces : [`${pieces.length} things`]),
  ].filter((part) => part.length > 0);
  return {
    ok: true,
    footprint: tiles,
    overhang,
    brim,
    doorsteps: footprint.doorsteps,
    blocked: [],
    clears: [
      ...groundCleared.values(),
      ...removed.flatMap((index) => {
        const gone = footprintOf(file.buildings[index]);
        return [
          ...gone.claimed.map(({ x, y }) => ({ x, y })),
          ...gone.crowns,
          ...gone.spans,
          ...gone.brim,
        ];
      }),
    ],
    ...(parts.length > 0 ? { note: `Clears ${listed(parts)}.` } : {}),
    file: next,
    index: next.buildings.length - 1,
    felled: removed,
  };
}

/** Putting a one-tile thing on a tile: whether it may go there. Undefined when it may. */
export function spotRefusal(
  file: MapFile,
  kind: SpotKind,
  tile: GridPoint,
  place: PlacementPlace = {},
): { readonly reason: string; readonly blocked: readonly GridPoint[] } | undefined {
  const survey = new Survey(file, place);
  if (!survey.onMap(tile.x, tile.y)) {
    return { reason: 'That is off the map.', blocked: [tile] };
  }
  const spot = survey.spot(tile.x, tile.y);
  if (spot) {
    return {
      reason: `${capital(spotName(file, spot.kind, spot.index))} is already there.`,
      blocked: [tile],
    };
  }
  const door = survey.door(tile.x, tile.y);
  if (door !== undefined) {
    return {
      reason: `${capital(DOOR_NAMES[file.doors![door].kind])} is in the way.`,
      blocked: [tile],
    };
  }
  if (survey.isArt(tile.x, tile.y)) {
    return { reason: 'The way out of the room is there: keep it clear.', blocked: [tile] };
  }
  const step = survey.doorstep(tile.x, tile.y);
  if (step) {
    return { reason: `That is ${survey.doorstepName(step)}: keep it clear.`, blocked: [tile] };
  }
  const crown = survey.crown(tile.x, tile.y);
  if (crown !== undefined) {
    return {
      reason: `It would be hidden under ${pieceName(file.buildings[crown].kind)}'s leaves.`,
      blocked: [tile],
    };
  }
  const claim = survey.claim(tile.x, tile.y);
  if (claim?.solid) {
    return {
      reason: `${capital(pieceName(file.buildings[claim.piece].kind))} is in the way.`,
      blocked: [tile],
    };
  }
  const letter = survey.letter(tile.x, tile.y) ?? '';
  if (!claim && letterIsSolid(letter)) {
    const indoors = place.area !== undefined;
    const area = indoors ? file.areas?.find((candidate) => candidate.id === place.area) : undefined;
    const why = indoors
      ? indoorGround(letter, area?.kind === 'cave')
      : (GROUND_IN_THE_WAY[letter] ?? 'Something solid is in the way');
    return { reason: `${why}.`, blocked: [tile] };
  }
  // It needs a side to be reached from, and may not take the last one of anything beside it.
  const after = new Survey(withSpotAt(file, kind, tile, place.moving), {});
  const self = { x: tile.x, y: tile.y };
  if (after.openSides(self) === 0) {
    return {
      reason: 'Nothing could reach it there: give it a side to be walked up to.',
      blocked: [tile],
    };
  }
  const before = new Survey(file, { moving: place.moving });
  const boxed = boxedIn(before, after, [self]);
  if (boxed) {
    const other = spotsOf(file, boxed.kind)[boxed.index];
    return {
      reason: `It would box in ${spotName(file, boxed.kind, boxed.index)}: leave it a side to be reached from.`,
      blocked: [tile, { x: other.x, y: other.y }],
    };
  }
  return undefined;
}

/** The file with a spot standing on a tile, for asking what it would do there - carried, or new. */
function withSpotAt(
  file: MapFile,
  kind: SpotKind,
  tile: GridPoint,
  moving: ThingRef | undefined,
): MapFile {
  const list = spotsOf(file, kind);
  const spots =
    moving?.kind === kind
      ? list.map((spot, index) =>
          index === moving.index ? { ...spot, x: tile.x, y: tile.y } : spot,
        )
      : [...list, { x: tile.x, y: tile.y }];
  return { ...file, [SPOT_LISTS[kind]]: spots };
}

/**
 * Putting a door a field move opens - a Cut tree, a Rock Smash rock, a
 * stretch of Surf water - on some tiles: whether it may go there.
 */
export function doorRefusal(
  file: MapFile,
  kind: MapFileDoorKind,
  tiles: readonly GridPoint[],
  place: PlacementPlace = {},
): { readonly reason: string; readonly blocked: readonly GridPoint[] } | undefined {
  const survey = new Survey(file, place);
  const blocked: GridPoint[] = [];
  let reason: string | undefined;
  for (const tile of tiles) {
    const spot = survey.spot(tile.x, tile.y);
    const claim = survey.claim(tile.x, tile.y);
    const door = survey.door(tile.x, tile.y);
    const step = survey.doorstep(tile.x, tile.y);
    const crown = survey.crown(tile.x, tile.y);
    const why = spot
      ? `${capital(spotName(file, spot.kind, spot.index))} is in the way.`
      : claim
        ? `${capital(pieceName(file.buildings[claim.piece].kind))} is in the way.`
        : door !== undefined
          ? `${capital(DOOR_NAMES[file.doors![door].kind])} is in the way.`
          : step
            ? `That is ${survey.doorstepName(step)}: keep it clear.`
            : crown !== undefined
              ? `It would be hidden under ${pieceName(file.buildings[crown].kind)}'s leaves.`
              : kind !== 'surf' && letterIsSolid(survey.letter(tile.x, tile.y))
                ? `${GROUND_IN_THE_WAY[survey.letter(tile.x, tile.y) ?? ''] ?? 'Something solid is in the way'}: it stands on open ground.`
                : undefined;
    if (why) {
      blocked.push(tile);
      reason ??= why;
    }
  }
  return reason === undefined ? undefined : { reason, blocked };
}

/** What a stroke of a brush did: the map, and what it left alone and why. */
export interface PaintOutcome {
  readonly file: MapFile;
  readonly skipped: readonly GridPoint[];
  readonly reason?: string;
}

/** What a solid brush is called when it is refused somewhere, outdoors. */
const PAINT_NAMES: Readonly<Record<string, string>> = {
  [MATERIAL_CHARS.tree]: 'Trees',
  [MATERIAL_CHARS.hedge]: 'A hedge',
  o: 'A bush',
  u: 'A bush',
  k: 'A bush',
  [MATERIAL_CHARS.water]: 'Water',
  [MATERIAL_CHARS.cliff]: 'Rock',
  [MATERIAL_CHARS.fence]: 'A fence',
  [MATERIAL_CHARS.wall]: 'A wall',
  '<': 'A ledge',
  '=': 'A ledge',
  '>': 'A ledge',
};

/**
 * Paints ground with a brush the way the rules let it: nothing solid under a
 * building, a thing, a field move's door or a doorstep, no tree grown with its
 * tip into a building's wall, and nothing boxed in. Every other tile is
 * painted, so a stroke simply skips the tiles it may not touch, and says why
 * once. `paint` is the plain brush (`draft.ts`'s `paintWith`).
 */
export function paintAround(
  file: MapFile,
  tiles: readonly GridPoint[],
  brush: GroundBrush,
  paint: (file: MapFile, tiles: readonly GridPoint[], brush: GroundBrush) => MapFile,
  place: PlacementPlace = {},
): PaintOutcome {
  const survey = new Survey(file, place);
  const indoors = place.area !== undefined;
  const skipped = new Map<string, GridPoint>();
  let reason: string | undefined;
  const skip = (tile: GridPoint, why: string): void => {
    skipped.set(at(tile), tile);
    reason ??= why;
  };
  for (const tile of tiles) {
    if (!survey.onMap(tile.x, tile.y)) {
      continue;
    }
    const letter = brush.letterFor(survey.letter(tile.x, tile.y) ?? '');
    if (!letterIsSolid(letter)) {
      continue;
    }
    const what = indoors ? 'That' : (PAINT_NAMES[letter] ?? 'That');
    const spot = survey.spot(tile.x, tile.y);
    const claim = survey.claim(tile.x, tile.y);
    const door = survey.door(tile.x, tile.y);
    const step = survey.doorstep(tile.x, tile.y);
    // Water under a jetty or a bridge is what it was planted over.
    const underAWaterPiece =
      claim !== undefined &&
      WATER_PIECES.has(file.buildings[claim.piece].kind) &&
      (letter === MATERIAL_CHARS.water || letter === MATERIAL_CHARS.ford);
    if (spot) {
      skip(tile, `${what} cannot go under ${spotName(file, spot.kind, spot.index)}.`);
    } else if (claim && !underAWaterPiece && !indoors) {
      skip(tile, `${what} cannot go under ${pieceName(file.buildings[claim.piece].kind)}.`);
    } else if (door !== undefined && file.doors![door].kind !== 'surf') {
      skip(tile, `${what} cannot go under ${DOOR_NAMES[file.doors![door].kind]}.`);
    } else if (step) {
      skip(tile, `${capital(survey.doorstepName(step))} is kept clear.`);
    } else if (survey.isArt(tile.x, tile.y)) {
      skip(tile, 'The way out of the room is kept clear.');
    }
  }
  // Painted, then asked again until nothing is left that walls a thing in or
  // grows a tree into a wall: each pass leaves alone the tiles that did.
  for (;;) {
    const painting = tiles.filter((tile) => !skipped.has(at(tile)));
    const next = paint(file, painting, brush);
    if (next === file) {
      return { file, skipped: [...skipped.values()], ...(reason ? { reason } : {}) };
    }
    const intoAWall = indoors ? undefined : treeIntoAWall(file, next, painting, survey);
    if (intoAWall) {
      for (const tile of intoAWall.tiles) {
        skip(tile, `Trees there would grow into ${intoAWall.wall}'s wall.`);
      }
      continue;
    }
    const boxed = boxedIn(survey, new Survey(next, place), painting);
    if (boxed) {
      const spot = spotsOf(file, boxed.kind)[boxed.index];
      const beside = painting.filter(
        (tile) => Math.abs(tile.x - spot.x) + Math.abs(tile.y - spot.y) === 1,
      );
      for (const tile of beside) {
        skip(
          tile,
          `A side of ${spotName(file, boxed.kind, boxed.index)} is left open, so it can be reached.`,
        );
      }
      continue;
    }
    return { file: next, skipped: [...skipped.values()], ...(reason ? { reason } : {}) };
  }
}

/**
 * The tiles of a stroke that finish a whole tree right in front of a
 * building, whose tip would hang over its wall - and the building.
 */
function treeIntoAWall(
  before: MapFile,
  after: MapFile,
  painted: readonly GridPoint[],
  survey: Survey,
): { readonly tiles: readonly GridPoint[]; readonly wall: string } | undefined {
  const blocks = new Set(
    painted
      .filter((tile) => after.ground[tile.y]?.[tile.x] === MATERIAL_CHARS.tree)
      .map((tile) => at({ x: tile.x - (tile.x % 2), y: tile.y - (tile.y % 2) })),
  );
  for (const block of blocks) {
    const [left, top] = block.split(',').map(Number);
    if (!wholeTreeAt(after, left, top)) {
      continue;
    }
    for (const x of [left, left + 1]) {
      const claim = survey.claim(x, top - 1);
      if (claim !== undefined && pieceClass(before.buildings[claim.piece].kind) === 'building') {
        return {
          tiles: treeOf(after, { x: left, y: top }).filter(
            (tile) => before.ground[tile.y]?.[tile.x] !== MATERIAL_CHARS.tree,
          ),
          wall: pieceName(before.buildings[claim.piece].kind),
        };
      }
    }
  }
  return undefined;
}
