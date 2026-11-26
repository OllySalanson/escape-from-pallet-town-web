import { activeSaveSlot } from '../dev/playtestMode';
import type { RaidProgress } from '../save/SaveManager';
import { MISTY_BOSS_ID } from '../world/valeQuarters';

/**
 * Whether THE GREAT LIBRARY's golden book, VALE SECRETS (`secretsBook.ts`),
 * opens - the one place that is decided.
 *
 * In the explorer run (`dev/playtestMode.ts`) it always opens, so it can be
 * read and checked. In the game proper it opens once MISTY is beaten
 * (`unlockedInPlay`): her gate is the first a save walks through, two of the
 * vale's secrets lie past it, and a player who has beaten her knows the vale
 * well enough to want its nooks spelled out (the harbour critic tour of
 * 26 Nov 2026, which found it chained shut for every save). THE LIBRARIAN
 * says so (`LIBRARIAN_LINES` in `base/rooms.ts`), the plinth says so while it
 * is locked, and THE GREAT LIBRARY's door counts it only once it opens
 * (`base/doorStatus.ts`). The room draws the plinth locked or open from
 * `secretsBookOpens`, and the book's screen refuses to open while it says no.
 */

/** How a save unlocks the secrets book in normal play: MISTY beaten. */
export function unlockedInPlay(progress: RaidProgress | undefined): boolean {
  return progress?.defeatedBosses.includes(MISTY_BOSS_ID) === true;
}

/** Whether the secrets book opens for this save, in this game. */
export function secretsBookOpens(progress: RaidProgress | undefined, explorerRun: boolean = activeSaveSlot() === 'playtest'): boolean {
  return explorerRun || unlockedInPlay(progress);
}

/** What the plinth says while it is locked. */
export const SECRETS_BOOK_LOCKED_LINES: readonly string[] = [
  'A golden book, chained shut to its plinth. VALE SECRETS, it says on the spine.',
  'The LIBRARIAN unchains it for whoever beats MISTY.',
];
