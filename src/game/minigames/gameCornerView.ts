import { itemIcon } from '../ui/icons';
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
import { getItemById } from '../items/items';
import { MAX_JUMPERS, type JumpType } from './pokemonJump';
import { PRIZE_WINDOW_NOTE } from './gameCornerTalk';
import { prizeLeftToday, prizeName, prizeRefusal, TICKET_PRIZES, today, type GameCornerRecord, type GamePayout } from './tickets';

/**
 * THE GAME CORNER's two DOM screens, as pure markup: choosing who jumps at the
 * POKéMON JUMP cabinet (and what a game paid, after), and the PRIZE WINDOW.
 * The vine itself is drawn on the canvas by `scenes/GameCornerScene.ts`.
 */

const number = (value: number): string => value.toLocaleString('en-GB');

/** One of the player's Pokémon, as the cabinet lists it. */
export interface JumpCandidate {
  readonly id: string;
  readonly name: string;
  readonly dexId: number;
  readonly shiny: boolean;
  readonly level: number;
  /** How it jumps, or undefined for a kind FireRed does not let jump. */
  readonly jumpType: JumpType | undefined;
}

export interface JumpTeamState {
  readonly candidates: readonly JumpCandidate[];
  readonly chosen: readonly string[];
  readonly tickets: number;
  readonly best: number;
  readonly status?: string;
  /** What the last game paid, shown over the list until the next one starts. */
  readonly last?: { readonly score: number; readonly payout: GamePayout; readonly berries: readonly string[] };
}

const JUMP_WORDS: Readonly<Record<JumpType, { readonly label: string; readonly help: string }>> = {
  fast: { label: 'Fast', help: 'A short, quick jump: back on its feet in time for a fast vine.' },
  normal: { label: 'Normal', help: 'A middling jump.' },
  slow: { label: 'Slow', help: 'Floats at the top: easy while the vine is slow, too slow once it is fast.' },
};

/** The cabinet's own screen: pick up to three jumpers, then play. */
export function jumpTeamMarkup(state: JumpTeamState): string {
  const jumpers = state.candidates.filter((candidate) => candidate.jumpType !== undefined);
  const grounded = state.candidates.filter((candidate) => candidate.jumpType === undefined);
  const row = (candidate: JumpCandidate, index: number): string => {
    const chosen = state.chosen.includes(candidate.id);
    const type = candidate.jumpType;
    const full = !chosen && state.chosen.length >= MAX_JUMPERS;
    const help = type
      ? chosen
        ? `${candidate.name} is jumping. Choose again to sit it out.`
        : full
          ? `Three are jumping already. Take one out first.`
          : `${candidate.name}: ${JUMP_WORDS[type].help}`
      : `${candidate.name} cannot play: FireRed's POKéMON JUMP has no ${candidate.name.toUpperCase()} on its list.`;
    const tag = type
      ? pixelTag(chosen ? 'Jumping' : JUMP_WORDS[type].label, chosen ? 'good' : 'plain', chosen)
      : pixelTag('Cannot jump', 'risk');
    return `<button class="px-row${chosen ? ' is-selected' : ''}" ${type ? `data-jumper="${candidate.id}"` : 'aria-disabled="true"'}${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"${full ? ' aria-disabled="true"' : ''}><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(candidate)}</span><small>Lv ${candidate.level}${type ? ` · ${JUMP_WORDS[type].label} jumper` : ' · not on FireRed’s list'}</small></span>${tag}</button>`;
  };
  const rows = [
    ...jumpers.map(row),
    ...(grounded.length > 0 ? ['<h3 class="px-subheading">Not on the list</h3>', ...grounded.map((candidate, index) => row(candidate, jumpers.length + index))] : []),
  ].join('');
  const empty =
    jumpers.length === 0
      ? '<p class="px-empty px-wrap">Nobody here can jump. RATTATA, CHARMANDER, KRABBY and their like can: catch one on a raid.</p>'
      : '';
  const last = state.last ? resultLines(state.last) : [];
  const chosen = state.chosen.length;
  const play = `<button class="px-window px-button is-primary" data-play${chosen === 0 ? ' aria-disabled="true"' : ''} data-help="${escapeAttribute(chosen === 0 ? 'Choose who jumps first.' : 'SPACE jumps everyone on the ground. A vine under somebody ends the game.')}">${state.last ? 'Again' : 'Play'}</button>`;
  const body = `<main class="px-body game-corner-layout">${pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${empty}${rows}</div>`,
    { heading: 'Who jumps?', note: `${chosen} of ${MAX_JUMPERS}` },
  )}${pixelCommitBar({
    title: state.last ? `Scored ${number(state.last.score)}` : 'POKéMON JUMP',
    lines: [
      ...last,
      `<small class="px-wrap">${number(state.tickets)} tickets · best ${number(state.best)}. One key jumps everyone on the ground; a team of one kind lands together.</small>`,
    ],
    actions: `<button class="px-window px-button" data-close data-help="Back to the arcade.">Done</button>${play}`,
  })}</main>`;
  return pixelScreen({
    title: 'POKéMON JUMP',
    place: 'Game Corner · ',
    back: { label: 'Done', attribute: 'data-close' },
    aside: pixelTag(`${number(state.tickets)} tickets`, 'secure'),
    body,
    hints: 'Arrows choose · ENTER takes one in or out · ESC leaves',
    ...(state.status ? { status: state.status } : {}),
  });
}

/** What a game paid, as lines under the bar's title. */
function resultLines(last: NonNullable<JumpTeamState['last']>): string[] {
  const { payout, berries } = last;
  const won: string[] = [];
  if (payout.tickets > 0) won.push(`${payout.tickets} tickets`);
  for (const berry of new Set(berries)) {
    const count = berries.filter((other) => other === berry).length;
    won.push(`${count > 1 ? `${count} ` : ''}${getItemById(berry)?.displayName ?? berry}`);
  }
  const paid = won.length > 0 ? `Won ${won.join(', ')}.` : payout.bestToday ? 'Nothing more today: the day has paid this tier.' : 'Beat today’s best to win more.';
  return [`<small class="px-wrap${won.length > 0 ? ' px-good' : ''}">${payout.newBest ? 'A new best! ' : ''}${paid}</small>`];
}

// --- THE PRIZE WINDOW ---------------------------------------------------------

export interface PrizeWindowState {
  readonly record: GameCornerRecord;
  readonly now: Date;
  readonly held: (itemId: string) => number;
  readonly status?: string;
}

/** The prize window: every prize, its price and what is left of it today. */
export function prizeWindowMarkup(state: PrizeWindowState): string {
  const day = today(state.record, state.now);
  const row = (index: number) => (prize: (typeof TICKET_PRIZES)[number]): string => {
    const name = prizeName(prize);
    const refusal = prizeRefusal(prize, state.record, state.now);
    const left = prizeLeftToday(prize, day);
    const held = state.held(prize.itemId);
    const description = getItemById(prize.itemId)?.description ?? '';
    const help = refusal ? `${name}: ${refusal}` : `${name} for ${prize.tickets} tickets. ${description}`;
    const note = [Number.isFinite(left) ? `${left} left today` : null, held > 0 ? `${held} at home` : null].filter(Boolean).join(' · ');
    return `<button class="px-row has-icon" data-prize="${prize.itemId}"${refusal ? ' aria-disabled="true"' : ''}${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}">${itemIcon(prize.itemId, name)}<span class="px-row-main"><strong>${name}</strong>${note ? `<small>${note}</small>` : ''}</span>${pixelTag(`${prize.tickets} tickets`, refusal ? 'risk' : 'plain')}</button>`;
  };
  const berries = TICKET_PRIZES.filter((prize) => prize.limitGroup === 'berries');
  const house = TICKET_PRIZES.filter((prize) => prize.limitGroup === undefined);
  const list = [
    '<h3 class="px-subheading">Berries</h3>',
    ...berries.map((prize, index) => row(index)(prize)),
    '<h3 class="px-subheading">For the house</h3>',
    ...house.map((prize) => row(-1)(prize)),
  ].join('');
  const body = `<main class="px-body game-corner-layout">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.supply)}>${list}</div>`, {
    heading: 'Prizes',
    note: 'Price in tickets',
  })}${pixelCommitBar({
    title: `${number(state.record.tickets)} tickets`,
    lines: [`<small class="px-wrap">${PRIZE_WINDOW_NOTE}</small>`],
    actions: '<button class="px-window px-button" data-close data-help="Back to the promenade.">Done</button>',
  })}</main>`;
  return pixelScreen({
    title: 'PRIZE WINDOW',
    place: 'Game Corner · ',
    back: { label: 'Done', attribute: 'data-close' },
    aside: pixelTag(`${number(state.record.tickets)} tickets`, 'secure'),
    body,
    hints: 'Arrows choose · ENTER buys one · ESC leaves',
    ...(state.status ? { status: state.status } : {}),
  });
}
