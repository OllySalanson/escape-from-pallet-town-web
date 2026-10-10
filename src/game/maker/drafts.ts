import { readMapFile, type MapFile } from '../world/mapFile';
import { keepOnMap } from './draft';

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
  let raw: string | null;
  try {
    raw = storage?.getItem(MAKER_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
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

/** The store with this draft in it, newest first, and opened. */
export function withDraft(store: MakerStore, draft: StoredDraft): MakerStore {
  return {
    ...store,
    drafts: [draft, ...store.drafts.filter((other) => other.key !== draft.key)],
    current: draft.key,
  };
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

/** A key no draft in the store has yet. */
export function newDraftKey(store: MakerStore, now = Date.now()): string {
  let key = `draft-${now.toString(36)}`;
  for (let suffix = 1; store.drafts.some((draft) => draft.key === key); suffix += 1) {
    key = `draft-${now.toString(36)}-${suffix}`;
  }
  return key;
}

/**
 * A fingerprint of everything about a map that changes how a raid on it is
 * walked - the ground, the buildings, where every place is and when each exit
 * opens - and nothing that does not: renaming a map or an exit, or rewording a
 * drop-in, keeps the walk the maker already did.
 */
export function walkedVersion(file: MapFile): string {
  const walked = JSON.stringify([
    file.width,
    file.height,
    file.ground,
    file.buildings,
    file.dropIns.map(({ x, y }) => [x, y]),
    file.exits.map(({ x, y, opens }) => [x, y, opens]),
    file.itemSpots,
    file.wildlife,
  ]);
  // FNV-1a, 32 bits: a fingerprint, not a secret.
  let hash = 0x811c9dc5;
  for (let index = 0; index < walked.length; index += 1) {
    hash ^= walked.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** The file a maker downloads: the map, pretty-printed, as the game reads it. */
export function mapFileText(file: MapFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
