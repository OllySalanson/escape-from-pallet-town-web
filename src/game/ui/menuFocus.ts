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
  /** This render was caused by picking an item, so its action is what is next. */
  readonly itemJustChosen: boolean;
}

/**
 * The raid bag's focus, by what the player is in the middle of.
 *
 * The back button is only ever the last resort - an empty pocket - because it
 * is the one control whose Enter costs something: it resumes the raid clock.
 */
export function bagFocusPreference(state: BagFocusState): readonly string[] {
  const selectedItem = '[data-item-index].selected';
  if (state.choosingPokemon) {
    return ['[data-target]', selectedItem, '[data-close]'];
  }
  return state.itemJustChosen
    ? ['[data-use]:not([disabled])', selectedItem, '[data-close]']
    : [selectedItem, '[data-item-index]', '[data-category].active', '[data-close]'];
}
