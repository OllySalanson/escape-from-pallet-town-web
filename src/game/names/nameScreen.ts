/**
 * FireRed's YOUR NAME? screen, where a player chooses the name that is theirs
 * alone in Pallet Town (`names/nameService.ts`): in the hall as the first raid
 * comes home, and at CONTINUE for a player who has none yet. THE BOLTHOLE
 * never asks: it carries the name once there is one (`home/houseName.ts`).
 *
 * Phaser-free, so the words and the markup are tested without a browser; the
 * DOM half is `ui/PlayerNameOverlay.ts`.
 */
import { NAME_CHARACTERS_WORDS, PLAYER_NAME_MAX_LENGTH, type PlayerNameCheck } from '../console/playerName';
import { escapeAttribute, pixelCommitBar, pixelScreen, pixelWindow } from '../ui/pixelUi';
import type { NameCheck, NameClaim } from './nameService';

/** FireRed's `gText_YourName`, the line its naming screen asks the player. */
export const YOUR_NAME_TITLE = 'YOUR NAME?';

/** Where the name is being asked. */
export type NameScreenWhere = 'first-raid' | 'continue';

interface NameScreenWords {
  readonly place: string;
  readonly lead: string;
  readonly bar: string;
  readonly hints: string;
  /** The button that is not OK: play on without a name, and be asked again next time. */
  readonly away: { readonly label: string; readonly help: string };
}

const EVERYWHERE = 'on your door, over your head in the harbour and on every Pallet Town board';

const WORDS: Readonly<Record<NameScreenWhere, NameScreenWords>> = {
  'first-raid': {
    place: 'THE RAID ARENA',
    lead: `The stands want a name to shout. It goes ${EVERYWHERE}, and nobody else can have it.`,
    bar: 'One name each',
    hints: 'TYPE your name · ENTER OK · ESC later',
    away: { label: 'Later', help: 'Play on without a name; you are asked again next time.' },
  },
  continue: {
    place: 'PALLET TOWN',
    lead: `Names have started again, one each. Pick yours: it goes ${EVERYWHERE}, and nobody else can have it.`,
    bar: 'One name each',
    hints: 'TYPE your name · ENTER OK · ESC later',
    away: { label: 'Later', help: 'Play now without a name; you are asked again next time.' },
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

/**
 * What the screen says when a name could not be had. The console's own
 * "Change name" has no LATER to point at, so it is only told to try again.
 */
export function nameClaimLine(claim: Exclude<NameClaim, 'claimed'>, where: NameScreenWhere | 'console'): string {
  switch (claim) {
    case 'taken':
      return 'Somebody already has that name. Pick another.';
    case 'refused':
      return nameProblemLine('unkind');
    case 'offline':
      return where === 'console'
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
    `Type your name, up to ${PLAYER_NAME_MAX_LENGTH}: ${NAME_CHARACTERS_WORDS}`,
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
