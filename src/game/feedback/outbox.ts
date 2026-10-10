import type { DailyCount, FeedbackNote } from './feedbackNote';

/**
 * Where a message waits until it can be sent - the player's "pack".
 *
 * A message is never lost to a failed send: it is kept here first and only
 * forgotten once the server has it. IndexedDB rather than `localStorage`,
 * because a message carries a picture (and, from the voice stage, a clip) as a
 * Blob, and `localStorage` holds strings only and shares its few megabytes with
 * the save itself - a pack of pictures must never be what stops a game saving.
 */
export interface FeedbackOutbox {
  keep(note: FeedbackNote): Promise<void>;
  /** Oldest first. */
  waiting(): Promise<readonly FeedbackNote[]>;
  forget(tag: string): Promise<void>;
}

/** An outbox that lasts as long as the page: the fallback, and what tests use. */
export function memoryOutbox(): FeedbackOutbox {
  const notes = new Map<string, FeedbackNote>();
  return {
    keep: (note) => {
      notes.set(note.tag, note);
      return Promise.resolve();
    },
    waiting: () => Promise.resolve([...notes.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))),
    forget: (tag) => {
      notes.delete(tag);
      return Promise.resolve();
    },
  };
}

const DATABASE = 'escape-from-pallet-town.feedback';
const STORE = 'outbox';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'tag' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('feedback outbox would not open'));
    request.onblocked = () => reject(new Error('feedback outbox is open in an older tab'));
  });
}

function run<T>(database: IDBDatabase, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request.result);
    const fail = (): void => reject(transaction.error ?? new Error('feedback outbox transaction failed'));
    transaction.onerror = fail;
    transaction.onabort = fail;
  });
}

/**
 * The browser's own outbox. A browser that refuses IndexedDB (some private
 * windows do) gets one that lasts the session, which is still better than a
 * message refused at SEND.
 */
export function browserOutbox(): FeedbackOutbox {
  const fallback = memoryOutbox();
  let database: Promise<IDBDatabase | null> | undefined;
  const open = (): Promise<IDBDatabase | null> => {
    database ??= typeof indexedDB === 'undefined' ? Promise.resolve(null) : openDatabase().catch(() => null);
    return database;
  };
  return {
    keep: async (note) => {
      const db = await open();
      if (!db) {
        return fallback.keep(note);
      }
      await run(db, 'readwrite', (store) => store.put(note)).catch(() => fallback.keep(note));
    },
    waiting: async () => {
      const db = await open();
      const kept = db ? await run(db, 'readonly', (store) => store.getAll() as IDBRequest<FeedbackNote[]>).catch(() => []) : [];
      const session = await fallback.waiting();
      return [...kept, ...session].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    forget: async (tag) => {
      await fallback.forget(tag);
      const db = await open();
      if (db) {
        await run(db, 'readwrite', (store) => store.delete(tag)).catch(() => undefined);
      }
    },
  };
}

/** Today's send count, kept beside the save but never in it. */
export const DAILY_COUNT_KEY = 'escape-from-pallet-town.feedback.today';

export function readDailyCount(storage: Pick<Storage, 'getItem'> | undefined): DailyCount | null {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(DAILY_COUNT_KEY) ?? 'null');
    const record = parsed as Partial<DailyCount> | null;
    return record && typeof record.day === 'string' && typeof record.count === 'number'
      ? { day: record.day, count: record.count }
      : null;
  } catch {
    return null;
  }
}

export function writeDailyCount(storage: Pick<Storage, 'setItem'> | undefined, record: DailyCount): void {
  try {
    storage?.setItem(DAILY_COUNT_KEY, JSON.stringify(record));
  } catch {
    // A browser that cannot store the count cannot be told it is over it; the
    // server's own limit still holds.
  }
}
