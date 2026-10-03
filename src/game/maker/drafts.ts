import { readMapFile, type MapFile } from '../world/mapFile';

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
}

export interface MakerStore {
  readonly drafts: readonly StoredDraft[];
  /** The draft the editor opens on, if it still exists. */
  readonly current?: string;
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

/** Every draft in storage that can still be opened; anything else is left out rather than thrown. */
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
    return { drafts: [] };
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.drafts)) {
    return { drafts: [] };
  }
  const drafts = parsed.drafts.flatMap((entry): StoredDraft[] => {
    if (!isRecord(entry) || typeof entry.key !== 'string') {
      return [];
    }
    const reading = readMapFile(entry.file, { draft: true });
    if (!reading.ok) {
      return [];
    }
    return [
      {
        key: entry.key,
        file: reading.file,
        updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
        ...(typeof entry.walkedOut === 'string' ? { walkedOut: entry.walkedOut } : {}),
      },
    ];
  });
  const current =
    typeof parsed.current === 'string' && drafts.some((draft) => draft.key === parsed.current)
      ? parsed.current
      : undefined;
  return current ? { drafts, current } : { drafts };
}

/** Writes the store. Returns whether it was kept. */
export function saveMakerStore(store: MakerStore, storage: Storage | undefined = defaultStorage()): boolean {
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
    drafts: [draft, ...store.drafts.filter((other) => other.key !== draft.key)],
    current: draft.key,
  };
}

export function withoutDraft(store: MakerStore, key: string): MakerStore {
  const drafts = store.drafts.filter((draft) => draft.key !== key);
  return store.current === key || !store.current ? { drafts } : { drafts, current: store.current };
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
