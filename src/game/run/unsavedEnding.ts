/**
 * A raid's ending that could not be written, held in this page and tried again
 * when the base opens.
 *
 * A raid's ending is one write (`bankRun`, `bankContract`, `settleWipe`), and
 * when the browser refused it the result screen said COULD NOT SAVE - and the
 * base it led back to found the raid still in flight in storage and settled it
 * as abandoned: a raid the screen had just called "You got out clean" lost its
 * Satchel and the Balls in it (break-it test, 23 Nov 2026, storage refusing one
 * write and taking the next). This page knows how its raid ended, so it says so
 * to the base: the ending is written as it happened if storage takes it now, and
 * while it still will not, the raid is not settled as abandoned by this page.
 *
 * Phaser-free and in memory only: it is this page's knowledge, and a page that
 * closes takes it away, leaving the raid to be settled as abandoned as before.
 */

/** The write that ended this page's raid, waiting for storage to take it. */
let waiting: (() => boolean) | null = null;

/** Holds an ending whose write failed, to be tried again at base. */
export function holdUnsavedEnding(write: () => boolean): void {
  waiting = write;
}

/**
 * Tries a held ending again: `none` with nothing held, `saved` once storage
 * has taken it (and it is let go), `unsaved` while storage still refuses.
 */
export function retryUnsavedEnding(): 'none' | 'saved' | 'unsaved' {
  if (waiting === null) {
    return 'none';
  }
  let saved: boolean;
  try {
    saved = waiting();
  } catch {
    saved = false;
  }
  if (saved) {
    waiting = null;
    return 'saved';
  }
  return 'unsaved';
}

/**
 * What the base does with a raid it finds in flight as it opens: a held ending
 * is written first, and the raid is settled as abandoned (`settleAbandoned`)
 * only if this page holds no ending storage is still refusing.
 */
export function settleAtBase<Abandoned>(settleAbandoned: () => Abandoned | null): Abandoned | null {
  return retryUnsavedEnding() === 'unsaved' ? null : settleAbandoned();
}

/** Lets go of a held ending without writing it - for tests. */
export function forgetUnsavedEnding(): void {
  waiting = null;
}
