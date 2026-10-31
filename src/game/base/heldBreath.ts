import { ARENA_TILE } from './arenaHall';

/**
 * The moment on the rail, before a jump: the player climbs up and stands there,
 * the fires drop low, nothing is heard, and what is going over with them stamps
 * across the screen a word at a time. Then the horn, and they go. The fear of a
 * raid was one row of a small panel and then gone at a key press (the third Arena
 * sweep), and this is the same row, felt.
 *
 * It asks no third press and any key cuts it short, because the two presses from
 * home to the fall are what going again costs. And it says everything only for a
 * team's first raids: after that it stops for one thing, a Pokémon that would not
 * come back or a pack that would be missed, and with neither there is no hold at
 * all, so when it does stop it means something. Phaser-free, so all of it can be
 * asked of a number.
 */

/** How many raids in a row a team has everything named. */
export const RAIDS_NAMED_IN_FULL = 3;
/** The most words the screen is asked to hold, which a team and a full rack can pass. */
export const MOST_WORDS = 6;

/** The key that jumped is still on its way up as this starts, and is not a request to skip it. */
export const BREATH_LISTENS_AFTER_MS = 240;
/** How long before the first word: the view comes back to the player first. */
const WORDS_FROM_MS = 260;
/** How long each word is on its own before the next. */
const WORD_MS = 170;
/** How long it all holds, after the last word. */
const HOLD_MS = 420;
/** How long the climb on to the rail takes. */
const CLIMB_MS = 150;
/** How far over the fence the rail is, in tiles, and how far up its top. */
const CLIMB_REACH = 0.7;
const CLIMB_RISE = 7;

/** What goes if the raid does: the same things the rim's panel lists as lost. */
export interface AtRisk {
  /** Most at stake first. */
  readonly pokemon: readonly { readonly name: string; readonly level: number }[];
  /** The pack worn, unless it is the Satchel nobody is ever left without. */
  readonly pack: string | null;
  /** Whether that pack is more than the one a new save is issued, and would be missed. */
  readonly packIsBetter: boolean;
  /** Already worded, biggest stack first. */
  readonly items: readonly string[];
}

const NOTHING_TO_LOSE = 'NOTHING TO LOSE';

/**
 * What the screen says. On a team's first raids everything at risk, up to what
 * the screen holds; after that whoever is most at stake, else a pack worth more
 * than the one everybody is issued, else nothing, and nothing is no hold.
 */
export function stakeWords(risk: AtRisk, raidsWithThisTeam: number): readonly string[] {
  const pokemon = [...risk.pokemon].sort((one, other) => other.level - one.level).map(({ name }) => name);
  if (raidsWithThisTeam <= RAIDS_NAMED_IN_FULL) {
    const all = [...pokemon, ...(risk.pack ? [risk.pack] : []), ...risk.items].map((word) => word.toUpperCase());
    return all.length === 0 ? [NOTHING_TO_LOSE] : all.slice(0, MOST_WORDS);
  }
  const hurts = [...pokemon, ...(risk.pack && risk.packIsBetter ? [risk.pack] : [])];
  return hurts.slice(0, 1).map((word) => word.toUpperCase());
}

/** How long the breath is held, for so many words. */
export function breathMs(words: number): number {
  return WORDS_FROM_MS + words * WORD_MS + HOLD_MS;
}

/** How many of the words are up, and how long the newest has been: it pops in by whole steps of scale. */
export function wordsUpAt(elapsedMs: number, words: number): { readonly count: number; readonly newestMs: number } {
  const count = Math.max(0, Math.min(words, Math.floor((elapsedMs - WORDS_FROM_MS) / WORD_MS) + 1));
  return { count, newestMs: count === 0 ? 0 : elapsedMs - WORDS_FROM_MS - (count - 1) * WORD_MS };
}

/** The figure on its way up on to the rail, as an offset from where it stood. Whole pixels. */
export function climbAt(elapsedMs: number, over: { readonly x: number; readonly y: number }): { readonly x: number; readonly y: number } {
  const share = Math.max(0, Math.min(1, elapsedMs / CLIMB_MS));
  return {
    x: Math.round(over.x * ARENA_TILE * CLIMB_REACH * share),
    y: Math.round(over.y * ARENA_TILE * CLIMB_REACH * share - CLIMB_RISE * share),
  };
}
