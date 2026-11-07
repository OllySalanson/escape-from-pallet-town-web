import { getItemById } from '../items/items';
import { getSpeciesById } from '../pokemon/species';
import { isLibraryControl, LIBRARY_CONTROLS } from './controls';

/**
 * What a book's words say about the game, read out of the game.
 *
 * A page names a key as `{key:pack}`, a thing as `{item:potion}` and a kind
 * of Pokémon as `{pokemon:gyarados}`, and each is looked up when the page is
 * drawn: the key in `LIBRARY_CONTROLS`, which reads the game's own bindings,
 * the thing in the item catalogue and the Pokémon in the species list, by
 * their own names. So a page cannot teach a key the game no longer binds or name a
 * thing the game no longer has - `books.test.ts` fails a token that does not
 * resolve, and a bracket written by hand (`[B]`), which would bypass the table.
 */

const TOKEN = /\{(key|item|pokemon):([a-z0-9-]+)\}/gi;

export interface BookToken {
  readonly kind: 'key' | 'item' | 'pokemon';
  readonly name: string;
}

/** Every token in a page's words, in order. */
export function bookTokens(text: string): readonly BookToken[] {
  return [...text.matchAll(TOKEN)].map((match) => ({ kind: match[1].toLowerCase() as BookToken['kind'], name: match[2] }));
}

/** Whether a token names something the game has. */
export function tokenResolves(token: BookToken): boolean {
  switch (token.kind) {
    case 'key':
      return isLibraryControl(token.name);
    case 'item':
      return getItemById(token.name) !== undefined;
    case 'pokemon':
      return getSpeciesById(token.name) !== undefined;
  }
}

/**
 * A page's words as they are printed: each key in brackets as every hint in
 * the game writes one, each thing by its own name. A token that does not
 * resolve is printed as it was written, which the test refuses before it ships.
 */
export function resolveBookText(text: string): string {
  return text.replace(TOKEN, (whole, kind: string, name: string) => {
    if (kind.toLowerCase() === 'key') {
      return isLibraryControl(name) ? `[${LIBRARY_CONTROLS[name]}]` : whole;
    }
    if (kind.toLowerCase() === 'pokemon') {
      return getSpeciesById(name)?.name.toUpperCase() ?? whole;
    }
    return getItemById(name)?.displayName ?? whole;
  });
}

/** Anything in a page's words that looks like a key or a token but is neither: a hand-written `[B]`, or a stray brace. */
export function looseMarks(text: string): readonly string[] {
  const rest = text.replace(TOKEN, '');
  return [...rest.matchAll(/[[\]{}]/g)].map((match) => match[0]);
}
