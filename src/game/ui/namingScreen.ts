/**
 * FireRed's naming screen, for a Pokemon just caught: "PIDGEY's nickname?",
 * one line of up to ten letters, and OK. Phaser-free, so the words and the
 * structure are testable; the DOM half is `NamingScreenOverlay`.
 *
 * FireRed draws a keyboard of letters to walk a cursor over because a Game Boy
 * has no keys to type with. This game is played on a keyboard, so the line is a
 * field that is typed into, and everything else is FireRed's: the title
 * (`gText_PkmnsNickname`), the ten-letter limit (`POKEMON_NAME_LENGTH`), the
 * Pokemon drawn beside the line, and a blank line keeping the species name
 * (`nickname.ts` holds the rules).
 */
import { NICKNAME_LENGTH, type Pokemon } from '../pokemon';
import { escapeAttribute, pixelCommitBar, pixelPortrait, pixelScreen, pixelWindow } from './pixelUi';

export interface NamingView {
  /** The Pokemon being named. Its species name is the name it keeps if none is given. */
  readonly pokemon: Pokemon;
}

/** FireRed's `gText_PkmnsNickname`, after the species name. */
export const namingTitle = (speciesName: string): string => `${speciesName.toUpperCase()}'s nickname?`;

/** How many of the ten letters a typed name uses, said under the line as it is typed. */
export const namingCountLine = (typed: string): string => `${typed.length} of ${NICKNAME_LENGTH} letters`;

export function namingScreenMarkup(view: NamingView): string {
  const species = view.pokemon.base.name.toUpperCase();
  const title = namingTitle(view.pokemon.base.name);
  const field = `<input class="px-window px-field naming-field" data-naming-field name="nickname" value="" maxlength="${NICKNAME_LENGTH}" autocomplete="off" spellcheck="false" aria-label="${escapeAttribute(title)}" placeholder="${escapeAttribute(species)}" data-help="${escapeAttribute(
    `Type a nickname of up to ${NICKNAME_LENGTH} letters. Left blank, it goes by ${species}.`,
  )}" />`;
  const entry = `<form class="naming-body" data-naming-form>${pixelPortrait(view.pokemon.base.dexId, species)}<div class="naming-entry">${field}<small data-naming-count aria-live="polite">${namingCountLine('')}</small></div></form>`;
  const bar = pixelCommitBar({
    title: `Left blank, it goes by ${species}`,
    className: 'naming-actions',
    actions: `<button class="px-window px-button" data-naming-skip data-help="${escapeAttribute(
      `No nickname. It goes by ${species}.`,
    )}">No nickname</button><button class="px-window px-button is-primary" data-naming-ok data-help="Give it the name typed above.">OK</button>`,
  });
  const body = `<main class="px-body naming-screen">${pixelWindow(entry, {
    className: 'naming-window px-tone-primary',
    heading: title,
    note: `up to ${NICKNAME_LENGTH} letters`,
    tag: 'div',
  })}${bar}</main>`;
  return pixelScreen({
    title: 'Nickname',
    place: species,
    body,
    hints: 'TYPE a name · ENTER OK · ESC no nickname',
  });
}
