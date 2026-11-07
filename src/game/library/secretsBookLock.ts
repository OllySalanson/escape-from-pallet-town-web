import { activeSaveSlot } from '../dev/playtestMode';
import type { RaidProgress } from '../save/SaveManager';

/**
 * Whether THE GREAT LIBRARY's golden book, VALE SECRETS (`secretsBook.ts`),
 * opens - the one place that is decided.
 *
 * In the explorer run (`dev/playtestMode.ts`) it always opens, so it can be
 * read and checked. In the game proper it is locked, and **how it unlocks is
 * not decided yet**: `unlockedInPlay` is the rule, and it says locked for every
 * save until the captain picks one. Picking one is changing that function's
 * body - a badge, a number of secrets found, a raid count - and nothing else:
 * the room draws the plinth locked or open from `secretsBookOpens`, and the
 * book's screen refuses to open while it says no.
 */

/** How a save unlocks the secrets book in normal play. Not decided yet: locked. */
export function unlockedInPlay(progress: RaidProgress | undefined): boolean {
  void progress;
  return false;
}

/** Whether the secrets book opens for this save, in this game. */
export function secretsBookOpens(progress: RaidProgress | undefined, explorerRun: boolean = activeSaveSlot() === 'playtest'): boolean {
  return explorerRun || unlockedInPlay(progress);
}

/** What the plinth says while it is locked. */
export const SECRETS_BOOK_LOCKED_LINES: readonly string[] = [
  'A golden book, chained shut to its plinth. VALE SECRETS, it says on the spine.',
  'The LIBRARIAN keeps the key. She will not say yet what it takes to earn it.',
];
