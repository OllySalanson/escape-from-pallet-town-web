import { MAP_FILE_LIMITS, readMapFile, type MapFile } from '../world/mapFile';
import { blankMap, keepOnMap, setMaker } from './draft';
import { isGeneratedMapName } from './mapNames';

/**
 * The maps a player is drawing, kept in this browser.
 *
 * Drafts live under a key of their own, beside the two saves and never inside
 * either: a map is not progress in a game, and starting a new game must not
 * be able to erase one. Every read and write is guarded, because storage can
 * be full, blocked or missing (a private window), and a maker who cannot save
 * a draft can still draw, try and download one.
 */

export const MAKER_STORAGE_KEY = 'escape-from-pallet-town.maker.v1';

export interface StoredDraft {
  /** Which draft this is. Not the map's id, which follows its name. */
  readonly key: string;
  readonly file: MapFile;
  readonly updatedAt: number;
  /**
   * The version of the map its maker last walked out of in TRY IT, by its
   * `walkedVersion`. The check is cleared by any edit that changes the map
   * a raid would walk, and kept through a rename.
   */
  readonly walkedOut?: string;
  /** The receipt this draft was last sent in under, so its fate can be asked after. */
  readonly sentAs?: string;
}

export interface MakerStore {
  readonly drafts: readonly StoredDraft[];
  /** The draft the editor opens on, if it still exists. */
  readonly current?: string;
  /**
   * Whatever was in storage that the editor cannot open, exactly as it was
   * stored, and written back with every save. A draft is somebody's work: one
   * this version cannot read is kept for a version that can - or for a person
   * to recover by hand - and never quietly dropped by the next autosave.
   */
  readonly unreadable?: readonly unknown[];
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A stored map as a draft the editor can open: as it is, or with whatever
 * stands off the map taken off it. An older editor could leave a person or a
 * building off the edge when a map was made smaller, and a file is only ever
 * readable whole, so without this one stray person lost the whole draft.
 */
function openable(value: unknown): MapFile | undefined {
  const reading = readMapFile(value, { draft: true });
  if (reading.ok) {
    return reading.file;
  }
  try {
    const rescued = readMapFile(keepOnMap(value as MapFile), { draft: true });
    return rescued.ok ? rescued.file : undefined;
  } catch {
    // Not enough of a map to trim: kept as it was stored instead.
    return undefined;
  }
}

/**
 * Every draft in storage that can be opened. Anything else is kept aside, as
 * stored, in `unreadable` - never thrown, and never dropped.
 */
export function loadMakerStore(storage: Storage | undefined = defaultStorage()): MakerStore {
  return readMakerStore(storage) ?? { drafts: [] };
}

/** The drafts as stored, or undefined when there is no storage to read them from. */
function readMakerStore(storage: Storage | undefined): MakerStore | undefined {
  let raw: string | null;
  try {
    if (!storage) {
      return undefined;
    }
    raw = storage.getItem(MAKER_STORAGE_KEY);
  } catch {
    return undefined;
  }
  if (!raw) {
    return { drafts: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { drafts: [], unreadable: [raw] };
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.drafts)) {
    return { drafts: [], unreadable: [parsed] };
  }
  const unreadable: unknown[] = Array.isArray(parsed.unreadable)
    ? [...(parsed.unreadable as unknown[])]
    : [];
  const drafts = parsed.drafts.flatMap((entry): StoredDraft[] => {
    const file =
      isRecord(entry) && typeof entry.key === 'string' ? openable(entry.file) : undefined;
    if (!isRecord(entry) || typeof entry.key !== 'string' || !file) {
      unreadable.push(entry);
      return [];
    }
    return [
      {
        key: entry.key,
        file,
        updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
        ...(typeof entry.walkedOut === 'string' ? { walkedOut: entry.walkedOut } : {}),
        ...(typeof entry.sentAs === 'string' ? { sentAs: entry.sentAs } : {}),
      },
    ];
  });
  const current =
    typeof parsed.current === 'string' && drafts.some((draft) => draft.key === parsed.current)
      ? parsed.current
      : undefined;
  return {
    drafts,
    ...(current ? { current } : {}),
    ...(unreadable.length > 0 ? { unreadable } : {}),
  };
}

/** Writes the store. Returns whether it was kept. */
export function saveMakerStore(
  store: MakerStore,
  storage: Storage | undefined = defaultStorage(),
): boolean {
  try {
    if (!storage) {
      return false;
    }
    storage.setItem(MAKER_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/**
 * One change a tab makes to the drafts, said as what it does rather than as
 * the whole store after it, so that it can be made to the drafts as they are
 * stored now. Two tabs of the maker share one storage: a tab that wrote back
 * the copy it read when it opened put away every map the other tab had made
 * since, and rolled back the other tab's edits (bug hunt, 10 Nov 2026).
 */
export interface DraftChange {
  /** The draft the change is about. */
  readonly key: string;
  /**
   * Whether it says all there is about that draft - it is stored as this, or
   * it is gone - so that an earlier change to the same draft is moot.
   */
  readonly whole: boolean;
  readonly apply: (store: MakerStore) => MakerStore;
}

/**
 * Stores this draft, newest first, and opens it. What the stored one was
 * told since - its walk tick, its receipt, which another tab may have
 * written - is kept unless the draft says otherwise.
 */
export function putDraft(draft: StoredDraft): DraftChange {
  return {
    key: draft.key,
    whole: true,
    apply: (store) =>
      withDraft(store, { ...store.drafts.find((stored) => stored.key === draft.key), ...draft }),
  };
}

/** Takes the draft out of the store. */
export function dropDraft(key: string): DraftChange {
  return { key, whole: true, apply: (store) => withoutDraft(store, key) };
}

/** Makes the draft the one the editor opens on, if it is still stored. */
export function openOn(key: string): DraftChange {
  return {
    key,
    whole: false,
    apply: (store) =>
      store.drafts.some((draft) => draft.key === key) ? { ...store, current: key } : store,
  };
}

/** Notes the receipt the draft was sent in under. */
export function markSent(key: string, receipt: string): DraftChange {
  return {
    key,
    whole: false,
    apply: (store) => ({
      ...store,
      drafts: store.drafts.map((draft) => (draft.key === key ? { ...draft, sentAs: receipt } : draft)),
    }),
  };
}

/**
 * Makes `changes`, in order, to the drafts as they are stored now, and stores
 * the result: every draft the changes do not name stays exactly as stored,
 * whoever stored it. With no storage to read, they are made to `held` - the
 * drafts as the tab holds them - instead. Hands back the drafts after the
 * changes and whether they were kept.
 */
export function storeDraftChanges(
  changes: readonly DraftChange[],
  held: MakerStore,
  storage: Storage | undefined = defaultStorage(),
): { readonly store: MakerStore; readonly saved: boolean } {
  const store = changes.reduce(
    (changed, change) => change.apply(changed),
    readMakerStore(storage) ?? held,
  );
  return { store, saved: saveMakerStore(store, storage) };
}

/** The store with this draft in it, newest first, and opened. */
export function withDraft(store: MakerStore, draft: StoredDraft): MakerStore {
  return {
    ...store,
    drafts: [draft, ...store.drafts.filter((other) => other.key !== draft.key)],
    current: draft.key,
  };
}

/**
 * Where a file opened from disk goes in the drafts. The very map already
 * there is opened again, walk tick and all, rather than standing beside itself;
 * a different map of the same name is a new draft with a number after its
 * name, so the drafts list tells the two apart (playtest 50 found two TIDAL
 * CULVERTs with nothing to say which was which). Its id is kept: the file is
 * the map it says it is.
 */
export function placeOpenedFile(
  store: MakerStore,
  file: MapFile,
): { readonly existing: string } | { readonly file: MapFile } {
  const same = store.drafts.find((draft) => sameMapFile(draft.file, file));
  if (same) return { existing: same.key };
  const names = new Set(store.drafts.map((draft) => draft.file.name.trim().toLowerCase()));
  if (!names.has(file.name.trim().toLowerCase())) return { file };
  for (let number = 2; ; number += 1) {
    const suffix = ` ${number}`;
    const name = `${file.name.slice(0, MAP_FILE_LIMITS.maxNameLength - suffix.length).trimEnd()}${suffix}`;
    if (!names.has(name.toLowerCase())) return { file: { ...file, name } };
  }
}

export function withoutDraft(store: MakerStore, key: string): MakerStore {
  const { current, ...rest } = store;
  const drafts = store.drafts.filter((draft) => draft.key !== key);
  return current === key || !current ? { ...rest, drafts } : { ...rest, drafts, current };
}

/**
 * The name the maker last signed a map with: the newest draft that carries
 * one. A new map starts signed with it, because a maker is the same person
 * from one map to the next and an empty name is a check every new map fails.
 */
export function lastMakerName(store: MakerStore): string {
  return store.drafts.find((draft) => draft.file.maker.trim() !== '')?.file.maker ?? '';
}

/**
 * Whether a map is still exactly the blank NEW made it: nothing drawn, placed
 * or renamed. Pressing NEW on one puts nothing away, so it is replaced rather
 * than left in the drafts list beside the new one. A name the generator gave
 * it - the first one or a reroll (`mapNames.ts`) - is not a rename.
 */
export function isUntouchedBlank(file: MapFile): boolean {
  return (
    isGeneratedMapName(file.name) &&
    mapFileText(file) === mapFileText(setMaker(blankMap(undefined, undefined, file.name), file.maker))
  );
}

/** A key no draft in the store has yet. */
export function newDraftKey(store: MakerStore, now = Date.now()): string {
  let key = `draft-${now.toString(36)}`;
  for (let suffix = 1; store.drafts.some((draft) => draft.key === key); suffix += 1) {
    key = `draft-${now.toString(36)}-${suffix}`;
  }
  return key;
}

/**
 * What a map's words are: none of them changes how a raid on it is walked, so
 * none is in its walked fingerprint. Everything else is, at every depth, so a
 * part added to the format is counted without anyone remembering to list it
 * here (playtest 50: trainers, boulders and insides were left out, and a walk
 * taken before they were placed still said READY).
 */
const WORDING = new Set(['name', 'description', 'lines', 'calls', 'look', 'maker']);

/**
 * A fingerprint of everything about a map that changes how a raid on it is
 * walked - the ground, everything placed on it, its insides and when each exit
 * opens - and nothing that does not: renaming a map or an exit, rewording a
 * drop-in or a sign, or dressing a person keeps the walk the maker already did.
 */
export function walkedVersion(file: MapFile): string {
  // The file's own format and id say nothing of the ground; an inside's id does.
  const map: Partial<Record<keyof MapFile, unknown>> = { ...file, format: undefined, id: undefined };
  const walked = JSON.stringify(map, (key, field: unknown) => {
    if (WORDING.has(key)) return undefined;
    return isRecord(field)
      ? Object.fromEntries(Object.entries(field).sort(([a], [b]) => a.localeCompare(b)))
      : field;
  });
  // FNV-1a, 32 bits: a fingerprint, not a secret.
  let hash = 0x811c9dc5;
  for (let index = 0; index < walked.length; index += 1) {
    hash ^= walked.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Whether two files are the same map. The reader hands back every object's
 * fields in its own order while the maker's tools build them in theirs (a
 * link's inside end is written `area` first), so the text of the two is
 * compared with every object's keys sorted: the order of a list is the map,
 * the order of an object's keys is not.
 */
export function sameMapFile(a: MapFile, b: MapFile): boolean {
  return a === b || canonicalText(a) === canonicalText(b);
}

function canonicalText(value: unknown): string {
  return JSON.stringify(value, (_key, field: unknown) =>
    isRecord(field)
      ? Object.fromEntries(Object.entries(field).sort(([a], [b]) => a.localeCompare(b)))
      : field,
  );
}

/** The file a maker downloads: the map, pretty-printed, as the game reads it. */
export function mapFileText(file: MapFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
