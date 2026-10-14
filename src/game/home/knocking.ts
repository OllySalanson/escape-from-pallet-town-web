import type { HarbourHouse, KnockOutcome, KnockState } from '../harbour/houseService';
import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelScreen, pixelTag, pixelWindow } from '../ui/pixelUi';

/**
 * Knocking on somebody else's door in the shared harbour: the list of houses,
 * what is said at each step of a knock, and what a visitor is told inside.
 *
 * Phaser-free, so the words and the markup are tested without a browser; the
 * screen is `ui/KnockOverlay.ts`, the owner's side `harbour/houseDoor.ts`.
 */

/**
 * How often a knock asks whether it has been answered, and for how long: a
 * little longer than the database holds a knock (a minute), so the screen hears
 * it say 'gone' rather than giving up first.
 */
export const KNOCK_ASK_EVERY_MS = 1_500;
export const KNOCK_WAIT_MS = 65_000;

/** What the foot of the knock screen says the keys do. */
export const KNOCK_HINTS = 'ARROWS choose · ENTER knock · ESC back';

export type KnockView =
  /** Asking the harbour who has a house. */
  | { readonly kind: 'asking' }
  | { readonly kind: 'houses'; readonly houses: readonly HarbourHouse[]; readonly status?: string }
  | { readonly kind: 'knocking'; readonly name: string }
  | { readonly kind: 'trouble' };

/**
 * Where ESC takes the knock screen: back into the house it was opened in, or
 * out into the yard when it was opened on the step outside.
 */
export type KnockOpenedFrom = 'house' | 'step';

export function knockScreenMarkup(view: KnockView, from: KnockOpenedFrom = 'house'): string {
  const pane =
    view.kind === 'asking'
      ? '<p class="px-empty px-wrap">Asking the harbour whose doors there are...</p>'
      : view.kind === 'trouble'
        ? `<p class="px-empty px-wrap">${KNOCK_TROUBLE}</p>`
        : view.kind === 'knocking'
          ? `<p class="px-empty px-wrap">Knocking on ${view.name}'s door... Somebody's coming?</p>`
          : houseRows(view.houses);
  const note = view.kind === 'houses' ? `${view.houses.length} house${view.houses.length === 1 ? '' : 's'}` : '';
  const body = `<main class="px-body knock-screen">${pixelWindow(pane, { heading: 'Doors in the harbour', note })}</main>`;
  return pixelScreen({
    title: 'Knock on a door',
    place: 'The harbour',
    back: { label: from === 'step' ? 'Yard' : 'House', attribute: 'data-knock-close' },
    body,
    hints: view.kind === 'knocking' ? 'ESC stop knocking' : KNOCK_HINTS,
    ...(view.kind === 'houses' && view.status ? { status: view.status } : {}),
  });
}

function houseRows(houses: readonly HarbourHouse[]): string {
  if (houses.length === 0) {
    return '<p class="px-empty px-wrap">Nobody else has a house yet. When somebody names theirs at their door, it is here.</p>';
  }
  const rows = houses
    .map(
      (house, index) =>
        `<button class="px-row" data-knock="${escapeAttribute(house.id)}" data-name="${escapeAttribute(house.name)}"${
          index === 0 ? ' data-cursor-start' : ''
        } data-help="${escapeAttribute(
          house.atHome ? `Knock on ${house.name}'s door: they are in.` : `${house.name} is out. Come back when they are home.`,
        )}"><span class="px-row-main"><strong class="px-name">${house.name}'s house</strong></span>${pixelTag(
          house.atHome ? 'Home' : 'Out',
          house.atHome ? 'good' : 'plain',
        )}</button>`,
    )
    .join('');
  return `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.brief)}>${rows}</div>`;
}

export const KNOCK_TROUBLE = "The harbour isn't answering. Try again in a moment.";

/** What the screen says when a knock is not answered with a yes. */
export function knockOutcomeLine(name: string, outcome: Exclude<KnockOutcome, 'knocking'> | Exclude<KnockState, 'waiting' | 'in'>): string {
  switch (outcome) {
    case 'not-home':
      return `${name} isn't home. Try again when they are.`;
    case 'busy':
      return `Somebody's already at ${name}'s door. Try again in a minute.`;
    case 'not-now':
      return `${name} didn't let you in this time.`;
    case 'gone':
      return 'Nobody came to the door.';
  }
}

/**
 * What the owner is asked when somebody knocks: one line, because the question
 * stands over its two answers in one dialogue box, and the answers - LET THEM
 * IN, NOT NOW - say what is being asked. Ten letters of name still fit.
 */
export function knockQuestion(knockerName: string): string {
  return `${knockerName} is at your door.`;
}

/** Said in place of the question once the knock is no longer at the door. */
export function knockGoneLine(knockerName: string): string {
  return `${knockerName} has gone from the step.`;
}

export const LET_IN = 'LET THEM IN';
export const NOT_NOW = 'NOT NOW';

/** What a visitor is told as they step in. */
export function visitWelcomeLines(ownerName: string): readonly string[] {
  return [`${ownerName} lets you in.`, `Have a look round ${ownerName}'s house. Down off the mat is the way home.`];
}

/** What a visitor is told about something that is the owner's to use. */
export function notYoursLine(ownerName: string): string {
  return `That's ${ownerName}'s. Better not touch.`;
}

/** What a visitor is told who tries to decorate the owner's house. */
export function notYoursToMoveLine(ownerName: string): string {
  return `This is ${ownerName}'s house - nothing here is yours to move.`;
}

/** A thing's name as a visitor reads it: the owner's, not "YOUR". */
export function visitorThingName(name: string, ownerName: string): string {
  return name.startsWith('YOUR ') ? `${ownerName}'S ${name.slice('YOUR '.length)}` : name;
}
