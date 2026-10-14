/**
 * Where the keyboard lands when a DOM menu re-renders.
 *
 * Every menu rebuilds its markup on each change, which drops focus, so each
 * render has to say where focus goes next. A comma-separated selector cannot
 * say it: `querySelector('[data-item-index], [data-close]')` returns whichever
 * match comes first *in the document*, and the back button is first in every
 * menu header. That is how every re-render of the raid bag put the keyboard on
 * "Back to game", and the Enter meant for a recipient closed the bag and
 * restarted the raid clock with nothing used.
 *
 * So a preference is an ordered list, tried one selector at a time. It is
 * Phaser-free and DOM-free so the rule is tested rather than eyeballed.
 */

/** The first selector in `preference` that matches anything, queried in order. */
export function firstMatching<T>(
  query: (selector: string) => T | null,
  preference: readonly string[],
): T | null {
  for (const selector of preference) {
    const match = query(selector);
    if (match !== null) {
      return match;
    }
  }
  return null;
}

export interface BagFocusState {
  /** The recipient list is on screen: the next Enter is meant for a Pokemon. */
  readonly choosingPokemon: boolean;
  /** The list is of who should read a disc: start on the first who can. */
  readonly teaching?: boolean;
}

/**
 * The raid bag's focus, by what the player is in the middle of.
 *
 * The back button is only ever the last resort - an empty pack - because it is
 * the one control whose Enter costs something: it resumes the raid clock. The
 * cursor is otherwise put back on the row it was on by `MenuOverlay.refocus`,
 * which is why this only has to answer "where does a fresh screen start".
 */
export function bagFocusPreference(state: BagFocusState): readonly string[] {
  if (state.teaching) {
    return ['[data-pupil]:not([aria-disabled])', '[data-pupil]', '[data-teach-back]'];
  }
  return state.choosingPokemon
    ? ['[data-target]', '[data-close]']
    : ['[data-item]', '[data-close]'];
}

/**
 * A pane of words that holds no control: the result screen's ledger and its
 * gamble. It opts in with `data-reads`, and only while it has more to show
 * than fits is it a stop for the cursor (`markReadingPane`), lit like a row.
 */
export const READING_PANES = '.px-scroll[data-reads][tabindex]';

/**
 * What the arrow keys can rest on: a field is one, so a keyboard can reach it.
 * A dropdown and a box of lines are fields too: left off this list, the map
 * maker's "Looks like" took one arrow press and the re-render that followed
 * could not find it again, so the cursor went back to the tools (playtest 48).
 */
export const CURSOR_CONTROLS = `button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), ${READING_PANES}`;
