import { getItemById } from '../items/items';
import { basicsRowAttributes, pickerFindField, type PickerBasics } from '../ui/boxPicker';
import {
  COLUMN_MEASURES,
  escapeAttribute,
  pixelColumns,
  pixelCommitBar,
  pixelPokemonName,
  pixelScreen,
  pixelTag,
  pixelWindow,
} from '../ui/pixelUi';
import { payoutWords, type GamePayout } from './tickets';

/**
 * The promenade's three outdoor games' one DOM screen, as pure markup: choose
 * who plays - from every box, best fits first, the box named on each row
 * (`ui/boxPicker.ts`) - see in a few words what each would do well or badly,
 * then play; and, after a game, what it paid. The games themselves are drawn
 * on the canvas by `scenes/DerbyScene.ts`, `DigScene.ts` and
 * `FishingDerbyScene.ts`.
 */

const number = (value: number): string => value.toLocaleString('en-GB');

/** One of the player's Pokémon, as an outdoor game lists it. */
export interface OutdoorCandidate extends PickerBasics {
  /** What it would do well or badly here, in a few words each. */
  readonly notes: readonly string[];
  /** Whether it suits the game: a good word in green, a poor one plain. */
  readonly suits: boolean;
}

export interface OutdoorPickState {
  /** The screen's title: `PROMENADE DERBY`. */
  readonly title: string;
  /** Where it is, before the title in the bar: `Promenade · `. */
  readonly place: string;
  /** The list's heading: `Who races?`. */
  readonly heading: string;
  /** What the chosen one is doing, for its tag: `Racing`. */
  readonly doing: string;
  readonly candidates: readonly OutdoorCandidate[];
  readonly chosen: string | null;
  readonly tickets: number;
  /** The day's best, as the game words it, or null if not played today. */
  readonly best: string | null;
  /** The rules in a line, under the bar's title. */
  readonly rules: string;
  /** What PLAY's help says once somebody is chosen. */
  readonly playHelp: string;
  /** A line about the day the game is played on (the going, the field), if it has one. */
  readonly today?: string;
  readonly status?: string;
  /** What the last game came to and what it paid, shown until the next one starts. */
  readonly last?: { readonly headline: string; readonly payout: GamePayout; readonly kept: readonly string[] };
  /** The levels a game has, if it has more than one (THE PROMENADE DERBY's courses), and which is chosen. */
  readonly course?: OutdoorCourse;
  /** What PLAY says after a game when it is not the same game again: `Race THE SANDS`. */
  readonly again?: string;
}

/** A game's levels, one after another: each opened by finishing the one before it. */
export interface OutdoorCourse {
  /** The window's note: `LEVEL 2 OF 4`. */
  readonly note: string;
  readonly levels: readonly {
    readonly number: number;
    readonly name: string;
    readonly open: boolean;
    readonly chosen: boolean;
    /** What the help bar says of it: what it is, or what opens it. */
    readonly help: string;
  }[];
  /** The chosen level in a line, and what is next. */
  readonly line: string;
}

/** The levels, as a row of buttons and the chosen one's line. */
function courseMarkup(course: OutdoorCourse): string {
  const buttons = course.levels
    .map(
      (level) =>
        `<button class="px-window px-button${level.chosen ? ' is-primary' : ''}" data-course-level="${level.number}"${level.open ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(level.help)}">${level.number} ${escapeAttribute(level.open ? level.name : 'LOCKED')}</button>`,
    )
    .join('');
  return pixelWindow(`<div class="outdoor-course-levels">${buttons}</div><small class="px-wrap">${escapeAttribute(course.line)}</small>`, {
    heading: 'Course',
    note: course.note,
    className: 'outdoor-course',
  });
}

/** What a game paid, as a line under the bar's title. */
export function outdoorResultLine(last: NonNullable<OutdoorPickState['last']>): string {
  const won: string[] = [];
  if (last.payout.tickets > 0) won.push(`${last.payout.tickets} tickets`);
  for (const itemId of new Set(last.kept)) {
    const count = last.kept.filter((other) => other === itemId).length;
    won.push(`${count > 1 ? `${count} ` : ''}${getItemById(itemId)?.displayName ?? itemId}`);
  }
  return `<small class="px-wrap${won.length > 0 ? ' px-good' : ''}">${escapeAttribute(payoutWords(last.payout, won))}</small>`;
}

/** The game's own screen: pick who plays, then play. */
export function outdoorPickMarkup(state: OutdoorPickState): string {
  const row = (candidate: OutdoorCandidate, index: number): string => {
    const chosen = state.chosen === candidate.id;
    const notes = candidate.notes.join(', ');
    const help = chosen ? `${candidate.name} is ${state.doing.toLowerCase()}.` : `${candidate.name}: ${notes}.`;
    const tag = pixelTag(chosen ? state.doing : candidate.suits ? 'Suits it' : 'Plain', chosen || candidate.suits ? 'good' : 'plain', chosen);
    return `<button class="px-row${chosen ? ' is-selected' : ''}" data-player-pick="${candidate.id}" ${basicsRowAttributes(candidate)}${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(candidate)}</span><small>Lv ${candidate.level} · ${escapeAttribute(notes)} · ${escapeAttribute(candidate.box)}</small></span>${tag}</button>`;
  };
  const list =
    state.candidates.length > 0
      ? state.candidates.map(row).join('')
      : '<p class="px-empty px-wrap">Nobody to play with: everybody you keep is somewhere else.</p>';
  const ready = state.chosen !== null;
  const play = `<button class="px-window px-button is-primary" data-play${ready ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(ready ? state.playHelp : 'Choose who plays first.')}">${escapeAttribute(state.last ? (state.again ?? 'Again') : 'Play')}</button>`;
  const body = `<main class="px-body game-corner-layout${state.course ? ' has-course' : ''}">${state.course ? courseMarkup(state.course) : ''}${pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${pickerFindField()}${list}</div>`,
    { heading: state.heading, note: ready ? '1 of 1' : '0 of 1' },
  )}${pixelCommitBar({
    title: state.last ? state.last.headline : state.title,
    lines: [
      ...(state.last ? [outdoorResultLine(state.last)] : []),
      // What the player holds, said as held: under a result line, a bare "10 tickets" read as what the game had just paid (playtest 51, finding 6).
      `<small class="px-wrap">You hold ${number(state.tickets)} tickets${state.best ? ` · today’s best ${escapeAttribute(state.best)}` : ''}. ${escapeAttribute(state.rules)}${state.today ? ` ${escapeAttribute(state.today)}` : ''}</small>`,
    ],
    actions: `<button class="px-window px-button" data-close data-help="Back to the promenade.">Done</button>${play}`,
  })}</main>`;
  return pixelScreen({
    title: state.title,
    place: state.place,
    back: { label: 'Done', attribute: 'data-close' },
    aside: pixelTag(`${number(state.tickets)} tickets`, 'secure'),
    body,
    hints: 'Arrows choose · ENTER picks this one · ESC leaves',
    ...(state.status ? { status: state.status } : {}),
  });
}
