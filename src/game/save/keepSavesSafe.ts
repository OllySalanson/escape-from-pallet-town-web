/**
 * Asks the browser to keep the save, so it is not cleared to make room or
 * after a spell away. Without asking, a site's storage is "best effort": Safari
 * deletes it after seven days without a visit, and any browser may clear it
 * when the disk runs low. The whole game is one `localStorage` entry, so that
 * is the whole game gone.
 *
 * It asks when there is something to keep: as the page opens when a game is
 * already saved, and otherwise on the first save the page writes, never on a
 * title with nothing behind it, where a browser that asks the player (Firefox
 * does; Chrome and Safari decide for themselves) would be asking about nothing.
 * Once a page: a browser remembers its answer, and a refusal is not worth
 * asking again in the same sitting.
 */
export interface StorageManagerLike {
  persisted?(): Promise<boolean>;
  persist?(): Promise<boolean>;
}

let askOnNextWrite: (() => Promise<void>) | null = null;

/**
 * Asks now when a game is already saved, or arms the request for the first
 * save written after this (`main.ts`, outside test mode).
 */
export function keepSavesSafe(storage: StorageManagerLike | undefined, gameSaved: boolean): Promise<void> {
  if (typeof storage?.persist !== 'function') {
    askOnNextWrite = null;
    return Promise.resolve();
  }
  askOnNextWrite = async () => {
    try {
      if (await storage.persisted?.()) {
        return;
      }
      await storage.persist!();
    } catch {
      // A browser that will not say is a browser that keeps the save best-effort, as before.
    }
  };
  return gameSaved ? saveWritten() : Promise.resolve();
}

/** Called by `SaveManager.save` after every write that landed. Asks at most once. */
export function saveWritten(): Promise<void> {
  const ask = askOnNextWrite;
  askOnNextWrite = null;
  return ask ? ask() : Promise.resolve();
}
