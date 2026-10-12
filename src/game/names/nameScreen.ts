/**
 * FireRed's YOUR NAME? screen, where a player chooses the name that is theirs
 * alone in Pallet Town (`names/nameService.ts`): at NEW GAME, at CONTINUE for a
 * player who has none yet, and at THE BOLTHOLE's door for anybody who somehow
 * still has none.
 *
 * Phaser-free, so the words and the markup are tested without a browser; the
 * DOM half is `ui/PlayerNameOverlay.ts`.
 */
import { PLAYER_NAME_MAX_LENGTH, type PlayerNameCheck } from '../console/playerName';
import { escapeAttribute, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';
import type { NameCheck, NameClaim } from './nameService';

/** FireRed's `gText_YourName`, the line its naming screen asks the player. */
export const YOUR_NAME_TITLE = 'YOUR NAME?';

/** Where the name is being asked. */
export type NameScreenWhere = 'new-game' | 'continue' | 'house';

interface NameScreenWords {
  readonly place: string;
  readonly lead: string;
  readonly bar: string;
  readonly hints: string;
  /** The button that is not OK: back to the title, later, or back out of the door. */
  readonly away: { readonly label: string; readonly help: string };
  /** A NEW GAME may also be started without a name, to be asked next time. */
  readonly later?: { readonly label: string; readonly help: string };
}

const EVERYWHERE = 'on your door, over your head in the harbour and on every Pallet Town board';

const WORDS: Readonly<Record<NameScreenWhere, NameScreenWords>> = {
  'new-game': {
    place: 'NEW GAME',
    lead: `First things first: what do people call you? It goes ${EVERYWHERE}, and nobody else can have it.`,
    bar: 'One name each',
    hints: 'TYPE your name · ENTER OK · ESC back',
    away: { label: 'Back', help: 'Back to the title.' },
    later: { label: 'Later', help: 'Play now without a name; you are asked again next time.' },
  },
  continue: {
    place: 'PALLET TOWN',
    lead: `Names have started again, one each. Pick yours: it goes ${EVERYWHERE}, and nobody else can have it.`,
    bar: 'One name each',
    hints: 'TYPE your name · ENTER OK · ESC later',
    away: { label: 'Later', help: 'Play now without a name; you are asked again next time.' },
  },
  house: {
    place: 'THE BOLTHOLE',
    lead: `Nobody lives here yet. Type the name that goes ${EVERYWHERE} - nobody else can have it.`,
    bar: 'Type a name to come in',
    hints: 'TYPE your name · ENTER OK · ESC back outside',
    away: { label: 'Back outside', help: 'Back out of the door, without a name.' },
  },
};

/** What the foot of the screen says the keys do, wherever it is asked. */
export function nameScreenHints(where: NameScreenWhere): string {
  return WORDS[where].hints;
}

/** How many of the ten letters a typed name uses, and what the harbour says of it so far. */
export function nameCountLine(typed: string, heard: NameCheck | 'asking' | null = null): string {
  const count = `${typed.length} of ${PLAYER_NAME_MAX_LENGTH} letters`;
  if (!typed || heard === null || heard === 'invalid' || heard === 'unkind') {
    return count;
  }
  const said = { asking: 'asking...', free: 'free', yours: 'yours', taken: 'taken' } as const;
  return `${count} · ${said[heard]}`;
}

/** What the screen says about a name the rules would not take. */
export function nameProblemLine(problem: Extract<PlayerNameCheck, { ok: false }>['problem']): string {
  return problem === 'empty'
    ? 'Type a name first: letters and numbers, up to ten.'
    : 'Not that name. Everybody who plays sees it - pick another.';
}

/** What the screen says when a name could not be had. */
export function nameClaimLine(claim: Exclude<NameClaim, 'claimed'>, where: NameScreenWhere): string {
  switch (claim) {
    case 'taken':
      return 'Somebody already has that name. Pick another.';
    case 'refused':
      return nameProblemLine('unkind');
    case 'offline':
      return where === 'house'
        ? "Pallet Town isn't answering, so the name can't be checked. Try again in a moment."
        : "Pallet Town isn't answering, so the name can't be checked. Try again, or LATER to pick it next time.";
  }
}

export interface NameScreenView {
  readonly where: NameScreenWhere;
  /** What is in the line so far, already held to the name rule. */
  readonly value: string;
}

export function nameScreenMarkup(view: NameScreenView): string {
  const words = WORDS[view.where];
  const field = `<input class="px-window px-field naming-field" data-name-field name="name" value="${escapeAttribute(
    view.value,
  )}" maxlength="${PLAYER_NAME_MAX_LENGTH}" autocomplete="off" spellcheck="false" aria-label="Your name" placeholder="NAME" data-help="${escapeAttribute(
    `Type your name: capitals, numbers and . ! ? ' - up to ${PLAYER_NAME_MAX_LENGTH}.`,
  )}" />`;
  const entry = `<form class="naming-body is-single" data-name-form><div class="naming-entry"><p class="px-wrap">${words.lead}</p>${field}<small data-name-count aria-live="polite">${nameCountLine(
    view.value,
  )}</small></div></form>`;
  const button = (data: string, label: string, help: string, primary = false): string =>
    `<button class="px-window px-button${primary ? ' is-primary' : ''}" ${data} data-help="${escapeAttribute(help)}">${label}</button>`;
  const bar = pixelCommitBar({
    title: words.bar,
    className: 'naming-actions',
    actions:
      button('data-name-away', words.away.label, words.away.help) +
      (words.later ? button('data-name-later', words.later.label, words.later.help) : '') +
      button('data-name-ok', 'OK', 'This is my name.', true),
  });
  const body = `<main class="px-body naming-screen">${pixelWindow(entry, {
    className: 'naming-window px-tone-primary',
    heading: YOUR_NAME_TITLE,
    note: `up to ${PLAYER_NAME_MAX_LENGTH} letters`,
    tag: 'div',
  })}${bar}</main>`;
  return pixelScreen({ title: 'Your name', place: words.place, body, hints: words.hints });
}
