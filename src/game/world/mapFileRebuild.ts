import type {
  MapFile,
  MapFileArea,
  MapFileBerryTree,
  MapFileBoulder,
  MapFileBuilding,
  MapFileDistrict,
  MapFileDoor,
  MapFileDropIn,
  MapFileExit,
  MapFileItemSpot,
  MapFileLandmark,
  MapFileLink,
  MapFileLinkEnd,
  MapFileOpens,
  MapFilePerson,
  MapFilePokemon,
  MapFileSign,
  MapFileTrainer,
} from './mapFile';

/**
 * A map file as the format has it, and nothing else.
 *
 * `readMapFile` checks every field the format knows and used to hand back the
 * very object it was given, so anything else in it - a key at the top, or
 * inside a person, an exit, an area - travelled on unseen: through review
 * (the reviewer sees only what the game draws), approval and publishing into
 * the public repo and every player's download (the security review's M3).
 * Every reading now ends here, so only known fields leave it, at every depth.
 *
 * Each list below is the exact keys of its type: a field added to a type and
 * not listed here, or listed and not on the type, fails to compile - so the
 * format cannot grow a part this quietly drops.
 */

type MissingFrom<T, K extends readonly PropertyKey[]> = Exclude<keyof T, K[number]>;

/** Exactly the keys of `T`, checked by the compiler both ways. */
function keysOf<T>() {
  return <const K extends readonly (keyof T)[]>(
    keys: K & ([MissingFrom<T, K>] extends [never] ? unknown : { readonly missing: MissingFrom<T, K> }),
  ): readonly (keyof T)[] => keys;
}

/** Every key any variant of a union has. */
type EveryKey<T> = T extends unknown ? keyof T : never;

/** Exactly the keys of every variant of `T` together, checked both ways like `keysOf`. */
function keysOfEvery<T>() {
  return <const K extends readonly EveryKey<T>[]>(
    keys: K & ([Exclude<EveryKey<T>, K[number]>] extends [never] ? unknown : { readonly missing: Exclude<EveryKey<T>, K[number]> }),
  ): readonly EveryKey<T>[] => keys;
}

const FILE = keysOf<MapFile>()([
  'format', 'id', 'name', 'maker', 'width', 'height', 'ground', 'buildings', 'dropIns', 'exits', 'itemSpots',
  'wildlife', 'people', 'signs', 'landmarks', 'districts', 'trainers', 'doors', 'pokemon', 'areas', 'links',
  'berryTrees', 'boulders',
]);
const BUILDING = keysOf<MapFileBuilding>()(['x', 'y', 'area', 'kind']);
const DROP_IN = keysOf<MapFileDropIn>()(['x', 'y', 'area', 'name', 'description']);
const EXIT = keysOf<MapFileExit>()(['x', 'y', 'area', 'name', 'opens']);
const ITEM_SPOT = keysOf<MapFileItemSpot>()(['x', 'y', 'area', 'hidden']);
const PERSON = keysOf<MapFilePerson>()(['x', 'y', 'area', 'name', 'look', 'facing', 'lines']);
const SIGN = keysOf<MapFileSign>()(['x', 'y', 'area', 'lines']);
const LANDMARK = keysOf<MapFileLandmark>()(['x', 'y', 'area', 'name', 'kind']);
const DISTRICT = keysOf<MapFileDistrict>()(['area', 'name', 'x', 'y', 'width', 'height', 'wildlife', 'rain']);
const TRAINER = keysOf<MapFileTrainer>()(['x', 'y', 'area', 'name', 'team', 'look', 'facing', 'sight', 'lines']);
const DOOR = keysOf<MapFileDoor>()(['kind', 'x', 'y', 'width', 'height']);
const POKEMON = keysOf<MapFilePokemon>()(['x', 'y', 'area', 'species', 'level']);
const AREA = keysOf<MapFileArea>()(['id', 'name', 'kind', 'style', 'width', 'height', 'ground', 'buildings']);
const LINK = keysOf<MapFileLink>()(['ends']);
const LINK_END = keysOf<MapFileLinkEnd>()(['x', 'y', 'area', 'toward', 'look']);
const BERRY_TREE = keysOf<MapFileBerryTree>()(['x', 'y', 'area', 'berry']);
const BOULDER = keysOf<MapFileBoulder>()(['x', 'y', 'area']);
const OPENS = keysOfEvery<MapFileOpens>()(['when', 'seconds']);

/** The listed keys of `value` that it has, and no others. A list of strings is copied. */
function pick<T>(value: T, keys: readonly (keyof T)[]): T {
  const out: Partial<Record<keyof T, unknown>> = {};
  for (const key of keys) {
    const field = value[key];
    if (field !== undefined) {
      out[key] = Array.isArray(field) && field.every((item) => typeof item === 'string') ? [...field] : field;
    }
  }
  return out as T;
}

const each = <T>(list: readonly T[] | undefined, keys: readonly (keyof T)[]): T[] | undefined =>
  list?.map((item) => pick(item, keys));

/**
 * When an exit opens, whichever kind of opening it is. It used to turn every
 * kind but 'after' into 'always', which opened a buried exit the day 'dug'
 * arrived; it keeps the kind now, and a kind with a field of its own fails to
 * compile until `OPENS` lists it.
 */
function opens(value: MapFileOpens): MapFileOpens {
  return pick(value as Record<EveryKey<MapFileOpens>, unknown>, OPENS) as unknown as MapFileOpens;
}

/**
 * Only the format's own fields of a map file that `readMapFile` has already
 * checked, at every depth. A file that holds nothing else comes back equal.
 */
export function onlyMapFileFields(file: MapFile): MapFile {
  const rebuilt = pick(file, FILE) as MapFile & Record<string, unknown>;
  const lists: Partial<Record<keyof MapFile, unknown>> = {
    buildings: each(file.buildings, BUILDING),
    dropIns: each(file.dropIns, DROP_IN),
    exits: file.exits.map((exit) => ({ ...pick(exit, EXIT), opens: opens(exit.opens) })),
    itemSpots: each(file.itemSpots, ITEM_SPOT),
    people: each(file.people, PERSON),
    signs: each(file.signs, SIGN),
    landmarks: each(file.landmarks, LANDMARK),
    districts: each(file.districts, DISTRICT),
    trainers: each(file.trainers, TRAINER),
    doors: each(file.doors, DOOR),
    pokemon: each(file.pokemon, POKEMON),
    areas: file.areas?.map((area) => ({ ...pick(area, AREA), buildings: each(area.buildings, BUILDING) })),
    berryTrees: each(file.berryTrees, BERRY_TREE),
    boulders: each(file.boulders, BOULDER),
    links: file.links?.map((link) => ({
      ...pick(link, LINK),
      ends: [pick(link.ends[0], LINK_END), pick(link.ends[1], LINK_END)],
    })),
  };
  for (const [key, value] of Object.entries(lists)) {
    if (value !== undefined) {
      rebuilt[key] = value;
    }
  }
  return rebuilt;
}
