import type { ItemId } from '../items';
import {
  FLOODPLAIN_REED_WILDLIFE,
  FLOODPLAIN_TOWN_WILDLIFE,
  FOREST_EDGE_WILDLIFE,
  PALLET_FIELD_WILDLIFE,
  PALLET_SHORE_WILDLIFE,
  ROUTE_MEADOW_WILDLIFE,
  type WildEncounterTable,
} from '../pokemon/encounters';
import type { ExtractionPoint } from './extractionPoints';
import type { WorldLoot } from './loot';
import { MapSketch, type PropStamp } from './mapGrid';
import { KANTO_TILESET, type KantoPropName } from './tileset/kantoTileset';
import { MATERIAL_CHARS } from './tileset/materials';
import type { TilesetCatalogue } from './tileset/catalogue';

/**
 * A raid map as one file.
 *
 * The five maps the game shipped with are each spread across a dozen modules -
 * the drawing in `maps/`, the exits in `extractionPoints.ts`, the landings in
 * `runGeneration.ts`, the loot in `worldMap.ts` - which is fine for a map the
 * game's own authors draw and impossible for a map a player draws. A map file
 * is everything one map is, in one JSON document a player's editor can write,
 * a reviewer can play and the game can load beside the five without any of
 * them knowing it is there (`playerMaps.ts` is the registry that does that).
 *
 * The vocabulary is the one the shipped maps are already authored in, so a file
 * map is drawn by exactly the machinery that draws Viridian City: the ground is
 * rows of material letters (`tileset/materials.ts`) on the Kanto sheet, with
 * the same stamps Viridian City uses for ledges, flowers and bushes; buildings
 * are planted by name. What a file never carries is a tile number, an item or a
 * Pokemon: a maker says *where* there is something to find and *what kind of
 * country* the grass is, and the game decides what is in it (the captain's P2).
 *
 * Every exit carries `opens` from the first version, because the locks, keys
 * and pickaxe planned for later are new values of that one field rather than a
 * new shape of file.
 */

/** The version of the file format this code reads and writes. */
export const MAP_FILE_FORMAT = 1;

/** The smallest and largest map a file may describe, in tiles. */
export const MAP_FILE_LIMITS = {
  minWidth: 20,
  minHeight: 16,
  maxWidth: 128,
  maxHeight: 128,
  /** Bytes of JSON: the submission service holds the same line. */
  maxBytes: 250_000,
  maxNameLength: 24,
  maxMakerLength: 24,
  maxPlaceNameLength: 20,
  maxDescriptionLength: 160,
  maxDropIns: 8,
  maxExits: 12,
  maxItemSpots: 40,
  /** The latest an exit may open: the raid clock is five minutes. */
  maxExitDelaySeconds: 240,
} as const;

/** Every file map's id is its own id with this in front, so none can collide with a shipped map. */
export const PLAYER_MAP_PREFIX = 'player-';

export type PlayerMapId = `${typeof PLAYER_MAP_PREFIX}${string}`;

/**
 * The letters a file's ground may use: every material's own letter, plus the
 * stamps Viridian City is drawn with. A stamp is a landmark drawn as a letter -
 * a ledge's run and its two ends, flowers and a bush - so it travels with the
 * picture rather than in a list beside it.
 */
export const MAP_FILE_STAMPS: Readonly<Record<string, PropStamp<KantoPropName>>> = {
  '<': { prop: 'bankWest', anchor: [0, 0], ground: '.' },
  '=': { prop: 'bank', anchor: [0, 0], ground: '.' },
  '>': { prop: 'bankEast', anchor: [0, 0], ground: '.' },
  f: { prop: 'flowers', anchor: [0, 0], ground: '.' },
  r: { prop: 'flowers', anchor: [0, 0], ground: '"' },
  o: { prop: 'shrub', anchor: [0, 0], ground: '.' },
  u: { prop: 'shrub', anchor: [0, 0], ground: '"' },
  k: { prop: 'shrub', anchor: [0, 0], ground: 'P' },
};

const GROUND_LETTERS = new Set([...Object.values(MATERIAL_CHARS), ...Object.keys(MAP_FILE_STAMPS)]);

/**
 * What a file calls a building, and the Kanto landmark it plants. The file has
 * its own words rather than the catalogue's prop names, so renaming a prop in
 * the code can never break a map somebody has already published.
 */
export const MAP_FILE_BUILDINGS = {
  house: 'house',
  'house-door': 'houseDoor',
  'house-flowers': 'houseFlowers',
  cottage: 'cottage',
  'cottage-door': 'cottageDoor',
  'pokemon-center': 'pokemonCenter',
  'pokemon-center-door': 'pokemonCenterDoor',
  'poke-mart': 'pokeMart',
  'poke-mart-door': 'pokeMartDoor',
  gym: 'gym',
  'forest-gate': 'forestGate',
  'route-gate': 'routeGate',
  'league-gate': 'leagueGate',
  sign: 'signTown',
  'sign-tips': 'signTips',
} as const satisfies Record<string, KantoPropName>;

export type MapFileBuildingKind = keyof typeof MAP_FILE_BUILDINGS;

/**
 * What kind of country a map's tall grass is. The maker chooses the country and
 * the game chooses the Pokemon: each is one of the shipped places' own tables,
 * so a player map is no harder or easier than ground the game already measured
 * (`tools/encounters/report.mts`).
 */
export const MAP_FILE_HABITATS = {
  meadow: ROUTE_MEADOW_WILDLIFE,
  field: PALLET_FIELD_WILDLIFE,
  wetland: FLOODPLAIN_REED_WILDLIFE,
  shore: PALLET_SHORE_WILDLIFE,
  town: FLOODPLAIN_TOWN_WILDLIFE,
  woodland: FOREST_EDGE_WILDLIFE,
} as const satisfies Record<string, WildEncounterTable>;

export type MapFileHabitat = keyof typeof MAP_FILE_HABITATS;

/** When an exit can be left by. Locks and keys will be more values of this. */
export type MapFileOpens =
  | { readonly when: 'always' }
  | { readonly when: 'after'; readonly seconds: number };

export interface MapFileSpot {
  readonly x: number;
  readonly y: number;
}

export interface MapFileBuilding extends MapFileSpot {
  readonly kind: MapFileBuildingKind;
}

export interface MapFileDropIn extends MapFileSpot {
  readonly name: string;
  readonly description?: string;
}

export interface MapFileExit extends MapFileSpot {
  readonly name: string;
  readonly opens: MapFileOpens;
}

export interface MapFile {
  readonly format: typeof MAP_FILE_FORMAT;
  /** Lower-case letters, digits and dashes: it becomes part of the map's id. */
  readonly id: string;
  readonly name: string;
  /** Who drew it, as they want to be credited. */
  readonly maker: string;
  readonly width: number;
  readonly height: number;
  /** `height` rows of `width` ground letters each. */
  readonly ground: readonly string[];
  readonly buildings: readonly MapFileBuilding[];
  /** The first is the map's front door. */
  readonly dropIns: readonly MapFileDropIn[];
  readonly exits: readonly MapFileExit[];
  /** Where something can be found. The game decides what. */
  readonly itemSpots: readonly MapFileSpot[];
  readonly wildlife: MapFileHabitat;
}

export type MapFileReading =
  | { readonly ok: true; readonly file: MapFile }
  | { readonly ok: false; readonly problems: readonly string[] };

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isWholeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

/**
 * Reads a map file, refusing anything the game could not load.
 *
 * This is the shape of the file and nothing else - it never asks whether the
 * map is any good, or even whether it can be walked out of; that is
 * `mapFileChecks.ts`. Every problem is listed rather than the first, because a
 * file is fixed in one sitting or not at all.
 */
export function readMapFile(
  value: unknown,
  /**
   * A draft is a map still being drawn: it may have no name or maker yet and
   * no way in or out, and the editor still has to be able to open it. Every
   * other rule - the shape, the letters, the bounds - holds for a draft too.
   */
  options: { readonly draft?: boolean } = {},
): MapFileReading {
  const draft = options.draft === true;
  const problems: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, problems: ['The file is not a map.'] };
  }
  if (value.format !== MAP_FILE_FORMAT) {
    return {
      ok: false,
      problems: [`The file is format ${String(value.format)}; this game reads format ${MAP_FILE_FORMAT}.`],
    };
  }
  const text = (field: string, what: string, max: number): string | undefined => {
    const raw = value[field];
    if (typeof raw !== 'string' || (raw.trim().length === 0 && !draft)) {
      problems.push(`The map needs ${what}.`);
      return undefined;
    }
    if (raw.length > max) {
      problems.push(`The map's ${field} is longer than ${max} letters.`);
    }
    return raw;
  };

  const id = text('id', 'an id', 40);
  if (id !== undefined && !ID_PATTERN.test(id)) {
    problems.push(`'id' may only hold lower-case letters, digits and single dashes.`);
  }
  text('name', 'a name', MAP_FILE_LIMITS.maxNameLength);
  text('maker', "its maker's name", MAP_FILE_LIMITS.maxMakerLength);

  const { width, height } = value;
  const sized =
    isWholeNumber(width) &&
    isWholeNumber(height) &&
    width >= MAP_FILE_LIMITS.minWidth &&
    height >= MAP_FILE_LIMITS.minHeight &&
    width <= MAP_FILE_LIMITS.maxWidth &&
    height <= MAP_FILE_LIMITS.maxHeight;
  if (!sized) {
    problems.push(
      `A map is ${MAP_FILE_LIMITS.minWidth}x${MAP_FILE_LIMITS.minHeight} to ${MAP_FILE_LIMITS.maxWidth}x${MAP_FILE_LIMITS.maxHeight} tiles.`,
    );
  }

  const ground = value.ground;
  if (!Array.isArray(ground) || !ground.every((row) => typeof row === 'string')) {
    problems.push(`'ground' must be rows of letters.`);
  } else if (sized) {
    if (ground.length !== height) {
      problems.push(`'ground' has ${ground.length} rows; the map is ${height} tall.`);
    }
    ground.forEach((row: string, y) => {
      if (row.length !== width) {
        problems.push(`Ground row ${y} is ${row.length} letters; the map is ${width} wide.`);
      }
      const unknown = [...new Set([...row].filter((letter) => !GROUND_LETTERS.has(letter)))];
      if (unknown.length > 0) {
        problems.push(`Ground row ${y} uses letters the game does not draw: ${unknown.join(' ')}`);
      }
    });
  }

  const inBounds = (spot: Record<string, unknown>): boolean =>
    isWholeNumber(spot.x) &&
    isWholeNumber(spot.y) &&
    sized &&
    spot.x >= 0 &&
    spot.y >= 0 &&
    spot.x < (width) &&
    spot.y < (height);

  const list = (field: string, max: number, min = 0): Record<string, unknown>[] => {
    const raw = value[field];
    if (!Array.isArray(raw) || !raw.every(isRecord)) {
      problems.push(`'${field}' must be a list.`);
      return [];
    }
    if (raw.length < min && !draft) {
      problems.push(`A map needs at least ${min} ${field === 'dropIns' ? 'drop-in' : 'exit'}.`);
    }
    if (raw.length > max) {
      problems.push(`A map holds at most ${max} ${field}.`);
    }
    raw.forEach((spot, index) => {
      if (!inBounds(spot)) {
        problems.push(`${field} ${index + 1} is not on the map.`);
      }
    });
    return raw;
  };

  for (const [index, building] of list('buildings', 200).entries()) {
    if (typeof building.kind !== 'string' || !(building.kind in MAP_FILE_BUILDINGS)) {
      problems.push(`Building ${index + 1} is not a building the game has: ${String(building.kind)}.`);
    }
  }

  const names = (field: 'dropIns' | 'exits', max: number): void => {
    const seen = new Set<string>();
    for (const [index, spot] of list(field, max, 1).entries()) {
      const name = spot.name;
      if (typeof name !== 'string' || name.trim().length === 0) {
        problems.push(`${field === 'dropIns' ? 'Drop-in' : 'Exit'} ${index + 1} needs a name.`);
        continue;
      }
      if (name.length > MAP_FILE_LIMITS.maxPlaceNameLength) {
        problems.push(`'${name}' is longer than ${MAP_FILE_LIMITS.maxPlaceNameLength} letters.`);
      }
      const key = placeSlug(name);
      if (key.length === 0) {
        problems.push(`'${name}' needs at least one letter or digit.`);
      } else if (seen.has(key)) {
        problems.push(`Two ${field === 'dropIns' ? 'drop-ins' : 'exits'} are called '${name}'.`);
      }
      seen.add(key);
      if (
        spot.description !== undefined &&
        (typeof spot.description !== 'string' ||
          spot.description.length > MAP_FILE_LIMITS.maxDescriptionLength)
      ) {
        problems.push(`The description of '${name}' must be text of at most ${MAP_FILE_LIMITS.maxDescriptionLength} letters.`);
      }
    }
  };
  names('dropIns', MAP_FILE_LIMITS.maxDropIns);
  names('exits', MAP_FILE_LIMITS.maxExits);

  for (const exit of Array.isArray(value.exits) ? value.exits.filter(isRecord) : []) {
    const opens = exit.opens;
    const valid =
      isRecord(opens) &&
      (opens.when === 'always' ||
        (opens.when === 'after' &&
          isWholeNumber(opens.seconds) &&
          opens.seconds > 0 &&
          opens.seconds <= MAP_FILE_LIMITS.maxExitDelaySeconds));
    if (!valid) {
      problems.push(
        `Exit '${String(exit.name)}' must open always, or after 1 to ${MAP_FILE_LIMITS.maxExitDelaySeconds} seconds.`,
      );
    }
  }

  list('itemSpots', MAP_FILE_LIMITS.maxItemSpots);

  if (typeof value.wildlife !== 'string' || !(value.wildlife in MAP_FILE_HABITATS)) {
    problems.push(`'wildlife' must be one of: ${Object.keys(MAP_FILE_HABITATS).join(', ')}.`);
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, file: value as unknown as MapFile };
}

/** A place's name as a piece of an id: `North Gate` is `north-gate`. */
export function placeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function playerMapId(file: Pick<MapFile, 'id'>): PlayerMapId {
  return `${PLAYER_MAP_PREFIX}${file.id}`;
}

export function isPlayerMapId(id: string): id is PlayerMapId {
  return id.startsWith(PLAYER_MAP_PREFIX);
}

/**
 * A landing on a file map, in the shape the shipped landings have
 * (`RUN_INSERTIONS`). Its id is the map's id and the place's own name, so it
 * can never be one of the shipped landings' ids.
 */
export interface PlayerMapInsertion {
  readonly id: PlayerMapId;
  readonly label: string;
  readonly mapId: PlayerMapId;
  readonly position: { readonly x: number; readonly y: number };
  readonly description: string;
}

/** Everything the rest of the game needs of one file map, built once. */
export interface PlayerMap {
  readonly id: PlayerMapId;
  readonly name: string;
  readonly maker: string;
  readonly file: MapFile;
  /** A fresh sketch per build, as the shipped maps' are: a gate state is drawn onto one. */
  readonly sketch: () => MapSketch<KantoPropName>;
  readonly tileset: TilesetCatalogue<KantoPropName>;
  readonly encounters: WildEncounterTable;
  readonly loot: readonly WorldLoot[];
  readonly insertions: readonly PlayerMapInsertion[];
  readonly exits: readonly ExtractionPoint[];
}

/**
 * What an item spot holds, in turn. A maker says where; this says what, and it
 * is the shipped maps' own mix - supplies first, then Brock's materials - so a
 * player map pays like ground the game already priced. Pokedollars come twice
 * and never again, which is under every shipped map's bundles: the faucet Bill's
 * prices are set against is measured off the maps (`hub/trader.test.ts`).
 */
const ITEM_SPOT_ROTATION: readonly { readonly itemId: ItemId; readonly quantity: number }[] = [
  { itemId: 'potion', quantity: 1 },
  { itemId: 'poke-ball', quantity: 2 },
  { itemId: 'antidote', quantity: 1 },
  { itemId: 'money', quantity: 30 },
  { itemId: 'parts-crate', quantity: 1 },
  { itemId: 'super-potion', quantity: 1 },
  { itemId: 'great-ball', quantity: 1 },
  { itemId: 'lamp-oil', quantity: 1 },
  { itemId: 'money', quantity: 45 },
  { itemId: 'cable-coil', quantity: 1 },
  { itemId: 'potion', quantity: 1 },
  { itemId: 'linen-roll', quantity: 1 },
  { itemId: 'poke-ball', quantity: 1 },
  { itemId: 'mooring-rope', quantity: 1 },
  { itemId: 'radio-valve', quantity: 1 },
];

/** The pool a file map's item spots are, by the rotation above. */
function lootFor(id: PlayerMapId, spots: readonly MapFileSpot[]): WorldLoot[] {
  const repeating = ITEM_SPOT_ROTATION.filter((entry) => entry.itemId !== 'money');
  return spots.map((spot, index) => {
    const entry =
      index < ITEM_SPOT_ROTATION.length
        ? ITEM_SPOT_ROTATION[index]
        : repeating[(index - ITEM_SPOT_ROTATION.length) % repeating.length];
    return {
      id: `${id}/spot-${index + 1}`,
      position: { x: spot.x, y: spot.y },
      itemId: entry.itemId,
      quantity: entry.quantity,
    };
  });
}

/** The sketch a file's ground and buildings make. */
export function sketchMapFile(file: MapFile): MapSketch<KantoPropName> {
  const sketch = new MapSketch<KantoPropName>({
    width: file.width,
    height: file.height,
    fill: MATERIAL_CHARS.tree,
    stamps: MAP_FILE_STAMPS,
  });
  sketch.draw(0, 0, file.ground);
  for (const building of file.buildings) {
    sketch.plant(building.x, building.y, MAP_FILE_BUILDINGS[building.kind]);
  }
  return sketch;
}

/**
 * Builds the game's view of a file that `readMapFile` has accepted. Throws on a
 * file it has not, because loading one is a bug in the caller rather than
 * something to recover from.
 */
export function buildPlayerMap(file: MapFile): PlayerMap {
  const reading = readMapFile(file);
  if (!reading.ok) {
    throw new Error(`map file '${String(file.id)}' cannot be loaded: ${reading.problems.join(' ')}`);
  }
  const id = playerMapId(file);
  const credit = `Drawn by ${file.maker}.`;
  return {
    id,
    name: file.name,
    maker: file.maker,
    file,
    sketch: () => sketchMapFile(file),
    tileset: KANTO_TILESET,
    encounters: MAP_FILE_HABITATS[file.wildlife],
    loot: lootFor(id, file.itemSpots),
    // The front door carries the map's name, as every shipped map's does - it
    // is the row a map is chosen by - and says which of the map's places it is
    // in its description, the way the Floodplain's says "The Landing:".
    insertions: file.dropIns.map((dropIn, index) => {
      const about = [index === 0 ? `${dropIn.name}.` : '', dropIn.description ?? '', credit]
        .filter((part) => part.length > 0)
        .join(' ');
      return {
        id: `${id}/${placeSlug(dropIn.name)}`,
        label: index === 0 ? file.name : dropIn.name,
        mapId: id,
        position: { x: dropIn.x, y: dropIn.y },
        description: about,
      };
    }),
    exits: file.exits.map((exit) => {
      const unlockAtMs = exit.opens.when === 'after' ? exit.opens.seconds * 1_000 : 0;
      return {
        mapId: id,
        position: { x: exit.x, y: exit.y },
        label: exit.name.toUpperCase(),
        unlockAtMs,
        requirement:
          exit.opens.when === 'after' ? { kind: 'elapsed', unlockAtMs } : { kind: 'always' },
      };
    }),
  };
}
