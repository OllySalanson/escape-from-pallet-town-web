import {
  buildPlayerMap,
  readMapFile,
  RESERVED_MAP_FILE_IDS,
  type PlayerMap,
  type PlayerMapId,
} from './mapFile';

/**
 * Every map that came from a file rather than from the game's own source.
 *
 * The game used to know exactly five maps by name. It now asks a list: the five
 * it shipped with (`worldMap.ts`) and whatever is registered here, which is
 * every file under `src/maps/player/` (approved) and `src/maps/sample/` when the
 * game is built - publishing a map is adding one file - and the draft a maker
 * is trying out in the editor. Nothing outside this module and `mapFile.ts` knows a file
 * map is any different from a shipped one: `getWorldMap`, the landings and the
 * exits all answer for both.
 *
 * Registration is lazy so that importing this module costs nothing until a map
 * is asked for. A file that does not load - one written before a change to the
 * format, a second map with an id already taken, a map under an id the game
 * keeps for itself - is left out and said so (`playerMapProblems`), and every
 * other map loads: one map a player made must never be able to stop the game
 * starting for everybody. `mapFile.test.ts` fails on any problem here, so the
 * change that broke a file is the change that has to mend it.
 */

/**
 * The maps players made that the owner approved, and the sample the game ships
 * to show what a file map is. Both load the same way; only a published map is
 * offered to an ordinary save (`isPublishedMap`), while an explorer run, which
 * opens every landing there is, finds the sample too.
 */
const PUBLISHED_FILES: Readonly<Record<string, unknown>> = import.meta.glob(
  '../../maps/player/*.json',
  {
    eager: true,
    import: 'default',
  },
);
const SAMPLE_FILES: Readonly<Record<string, unknown>> = import.meta.glob(
  '../../maps/sample/*.json',
  {
    eager: true,
    import: 'default',
  },
);

const published = new Set<PlayerMapId>();

let registry: Map<PlayerMapId, PlayerMap> | undefined;
let problems: readonly string[] = [];

export interface BundledMapFile {
  readonly path: string;
  readonly value: unknown;
  readonly isPublished: boolean;
}

export interface BundledMaps {
  readonly maps: readonly { readonly map: PlayerMap; readonly isPublished: boolean }[];
  /** One line per file left out, naming the file and why. */
  readonly problems: readonly string[];
}

/**
 * Every bundled file the game can load, in order, and why each of the rest was
 * left out. The first file to claim an id keeps it; samples are read first, so
 * a published map can never take the sample's place.
 */
export function loadBundledMaps(files: readonly BundledMapFile[]): BundledMaps {
  const loaded: { map: PlayerMap; isPublished: boolean }[] = [];
  const found: string[] = [];
  const ids = new Set<PlayerMapId>();
  for (const { path, value, isPublished } of files) {
    const reading = readMapFile(value);
    if (!reading.ok) {
      found.push(`${path} is not a map the game can load: ${reading.problems.join(' ')}`);
      continue;
    }
    if (isPublished && RESERVED_MAP_FILE_IDS.includes(reading.file.id)) {
      found.push(`${path} has an id the game keeps for itself: ${reading.file.id}`);
      continue;
    }
    let map: PlayerMap;
    try {
      map = buildPlayerMap(reading.file);
    } catch (error) {
      found.push(`${path} is not a map the game can load: ${String(error)}`);
      continue;
    }
    if (ids.has(map.id)) {
      found.push(`${path} has the same id as another map: ${map.id}`);
      continue;
    }
    ids.add(map.id);
    loaded.push({ map, isPublished });
  }
  return { maps: loaded, problems: found };
}

function maps(): Map<PlayerMapId, PlayerMap> {
  if (!registry) {
    registry = new Map();
    const bundled = loadBundledMaps([
      ...Object.entries(SAMPLE_FILES).map(([path, value]) => ({
        path,
        value,
        isPublished: false,
      })),
      ...Object.entries(PUBLISHED_FILES).map(([path, value]) => ({
        path,
        value,
        isPublished: true,
      })),
    ]);
    for (const { map, isPublished } of bundled.maps) {
      registry.set(map.id, map);
      if (isPublished) {
        published.add(map.id);
      }
    }
    problems = bundled.problems;
    for (const problem of problems) {
      console.error(problem);
    }
  }
  return registry;
}

/** Every bundled map file left out of the game, and why. Empty in a healthy build. */
export function playerMapProblems(): readonly string[] {
  maps();
  return problems;
}

/**
 * Whether a map is one the owner approved for the game, as opposed to the
 * sample or a draft being tried. Only these are offered to an ordinary save.
 */
export function isPublishedMap(id: string): boolean {
  maps();
  return published.has(id as PlayerMapId);
}

/** Every file map: the samples, then the published maps in the order their files are named. */
export function playerMaps(): readonly PlayerMap[] {
  return [...maps().values()];
}

export function playerMap(id: string): PlayerMap | undefined {
  return maps().get(id as PlayerMapId);
}

/**
 * Adds a map, or replaces the one with the same id - which is how a draft being
 * tried out in the editor is played as it stands after every edit.
 */
export function registerPlayerMap(
  map: PlayerMap,
  options: { readonly published?: boolean } = {},
): void {
  maps().set(map.id, map);
  if (options.published) {
    published.add(map.id);
  } else {
    published.delete(map.id);
  }
}

export function unregisterPlayerMap(id: PlayerMapId): void {
  maps().delete(id);
  published.delete(id);
}
