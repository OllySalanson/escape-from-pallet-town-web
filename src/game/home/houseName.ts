/**
 * The name a player is asked for on the way into THE BOLTHOLE, and FireRed's
 * screen that asks it.
 *
 * The house is where a name belongs: it is the player's own place, the console
 * that posts scores under a name stands in it, and the name is what the house
 * is known by to everybody else who plays. So the first time anybody walks in
 * they are asked who lives there, and they do not walk about inside until they
 * have said (`BaseScene.askHouseName`). It is the console's name and the
 * console's rule exactly (`console/playerName.ts`): one name per device, typed
 * once, kept under the console's own key, so a player who already named
 * themselves at the console is never asked again and the console never asks
 * anybody who has been through the door.
 *
 * Phaser-free, so the words and the markup are tested without a browser; the
 * DOM half is `ui/HouseNameOverlay.ts`.
 */
import { PLAYER_NAME_MAX_LENGTH, type PlayerNameCheck } from '../console/playerName';
import { escapeAttribute, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';

/** FireRed's `gText_YourName`, the line its naming screen asks the player. */
export const YOUR_NAME_TITLE = 'YOUR NAME?';

/** What the screen's foot says the keys do. */
export const HOUSE_NAME_HINTS = 'TYPE your name · ENTER OK · ESC back outside';

/** Whether walking into the house has to stop and ask: nobody has named this device yet. */
export function houseNameNeeded(name: string | null): boolean {
  return name === null;
}

/** How many of the ten letters a typed name uses, said under the line as it is typed. */
export const houseNameCountLine = (typed: string): string =>
  `${typed.length} of ${PLAYER_NAME_MAX_LENGTH} letters`;

/** What the screen says about a name it would not take. */
export function houseNameProblemLine(problem: Extract<PlayerNameCheck, { ok: false }>['problem']): string {
  return problem === 'empty'
    ? 'Type a name first: letters and numbers, up to ten.'
    : 'Not that name. Everybody who plays sees it - pick another.';
}

/** What the house says once it has a name. */
export function welcomeHomeLines(name: string): readonly string[] {
  return [`Welcome home, ${name}!`, 'The console knows your name now, and puts your scores up under it.'];
}

export interface HouseNameView {
  /** What is in the line so far, already held to the name rule. */
  readonly value: string;
}

export function houseNameMarkup(view: HouseNameView): string {
  const field = `<input class="px-window px-field naming-field" data-house-name-field name="name" value="${escapeAttribute(
    view.value,
  )}" maxlength="${PLAYER_NAME_MAX_LENGTH}" autocomplete="off" spellcheck="false" aria-label="Your name" placeholder="NAME" data-help="${escapeAttribute(
    `Type your name: capitals, numbers and . ! ? ' - up to ${PLAYER_NAME_MAX_LENGTH}.`,
  )}" />`;
  const entry = `<form class="naming-body is-single" data-house-name-form><div class="naming-entry"><p class="px-wrap">Nobody lives here yet. Type the name that goes on the door - and on every Pallet Town board, for everybody who plays to see.</p>${field}<small data-house-name-count aria-live="polite">${houseNameCountLine(
    view.value,
  )}</small></div></form>`;
  const bar = pixelCommitBar({
    title: 'Type a name to come in',
    className: 'naming-actions',
    actions:
      '<button class="px-window px-button" data-house-name-leave data-help="Back out of the door, without a name.">Back outside</button>' +
      '<button class="px-window px-button is-primary" data-house-name-ok data-help="Live here under the name typed above.">OK</button>',
  });
  const body = `<main class="px-body naming-screen">${pixelWindow(entry, {
    className: 'naming-window px-tone-primary',
    heading: YOUR_NAME_TITLE,
    note: `up to ${PLAYER_NAME_MAX_LENGTH} letters`,
    tag: 'div',
  })}${bar}</main>`;
  return pixelScreen({ title: 'Your name', place: 'THE BOLTHOLE', body, hints: HOUSE_NAME_HINTS });
}
