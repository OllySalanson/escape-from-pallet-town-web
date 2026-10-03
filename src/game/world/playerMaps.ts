import { buildPlayerMap, readMapFile, type PlayerMap, type PlayerMapId } from './mapFile';

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
 * is asked for, and a file that does not load is a build that does not start:
 * a broken map is a broken game, and `playerMaps.test.ts` reads every bundled
 * file so the suite fails first.
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

function maps(): Map<PlayerMapId, PlayerMap> {
  if (!registry) {
    registry = new Map();
    const bundled = [
      ...Object.entries(PUBLISHED_FILES).map(([path, value]) => ({
        path,
        value,
        isPublished: true,
      })),
      ...Object.entries(SAMPLE_FILES).map(([path, value]) => ({ path, value, isPublished: false })),
    ];
    for (const { path, value, isPublished } of bundled) {
      const reading = readMapFile(value);
      if (!reading.ok) {
        throw new Error(`${path} is not a map the game can load: ${reading.problems.join(' ')}`);
      }
      const map = buildPlayerMap(reading.file);
      if (registry.has(map.id)) {
        throw new Error(`${path} has the same id as another map: ${map.id}`);
      }
      registry.set(map.id, map);
      if (isPublished) {
        published.add(map.id);
      }
    }
  }
  return registry;
}

/**
 * Whether a map is one the owner approved for the game, as opposed to the
 * sample or a draft being tried. Only these are offered to an ordinary save.
 */
export function isPublishedMap(id: string): boolean {
  maps();
  return published.has(id as PlayerMapId);
}

/** Every file map, in the order the files are named. */
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
