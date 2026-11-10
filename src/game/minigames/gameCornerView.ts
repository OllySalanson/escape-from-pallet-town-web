import { iconMarkup, itemIcon, WORLD_ICONS } from '../ui/icons';
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
import { getItemById } from '../items/items';
import { MAX_JUMPERS, type JumpType } from './pokemonJump';
import { PRIZE_WINDOW_NOTE } from './gameCornerTalk';
import {
  payoutWords,
  prizeItemId,
  prizeLeftThisWeek,
  prizeLeftToday,
  prizeName,
  prizeRefusal,
  prizeTaken,
  thisWeek,
  TICKET_PRIZES,
  today,
  type GameCornerRecord,
  type GamePayout,
  type PrizeShelf,
  type PrizeSituation,
  type TicketPrize,
} from './tickets';

/**
 * THE GAME CORNER's two DOM screens, as pure markup: choosing who jumps at the
 * POKéMON JUMP cabinet (and what a game paid, after), and the PRIZE WINDOW.
 * The vine itself is drawn on the canvas by `scenes/GameCornerScene.ts`.
 */

const number = (value: number): string => value.toLocaleString('en-GB');

/**
 * One of the player's Pokémon, as the cabinet lists it: from every box, with
 * the box named on its row (`ui/boxPicker.ts`).
 */
export interface JumpCandidate extends PickerBasics {
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
    return `<button class="px-row${chosen ? ' is-selected' : ''}" ${type ? `data-jumper="${candidate.id}"` : 'aria-disabled="true"'} ${basicsRowAttributes(candidate)}${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"${full ? ' aria-disabled="true"' : ''}><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(candidate)}</span><small>Lv ${candidate.level}${type ? ` · ${JUMP_WORDS[type].label} jumper` : ' · not on FireRed’s list'} · ${escapeAttribute(candidate.box)}</small></span>${tag}</button>`;
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
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${pickerFindField()}${empty}${rows}</div>`,
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
  return [`<small class="px-wrap${won.length > 0 ? ' px-good' : ''}">${escapeAttribute(payoutWords(payout, won))}</small>`];
}

// --- THE PRIZE WINDOW ---------------------------------------------------------

export interface PrizeWindowState {
  readonly record: GameCornerRecord;
  readonly now: Date;
  readonly situation: PrizeSituation;
  /** THE RUMOUR MILL's slip just bought, said in the bar until the next purchase. */
  readonly rumour?: string;
  readonly status?: string;
  /**
   * The prize whose row has become its question: tickets are spent for good,
   * so a press asks and a second, on another button, buys. The cursor opens on
   * the one that keeps them, so a double ENTER buys nothing (the harbour bug
   * hunt of 9 Nov 2026: it bought two Surf Mats).
   */
  readonly asking?: string;
}

/** The window's shelves, in the order they are listed, with what each is for. */
const SHELVES: readonly { readonly shelf: PrizeShelf; readonly heading: string }[] = [
  { shelf: 'berries', heading: 'Held berries' },
  { shelf: 'raids', heading: 'For raids' },
  { shelf: 'pokemon', heading: 'POKéMON' },
  { shelf: 'rumours', heading: 'The rumour mill' },
  { shelf: 'house', heading: 'For the house' },
];

/** What a prize is, said on its help line after its price. */
function prizeAbout(prize: TicketPrize): string {
  switch (prize.gives.kind) {
    case 'item':
      // A berry's own description already says what it does held.
      return getItemById(prize.gives.itemId)?.description ?? '';
    case 'pokemon':
      return `FireRed's own prize, at Lv ${prize.gives.level}. One to a trainer: it goes to your boxes.`;
    case 'rumour':
      return 'A slip from THE RUMOUR MILL: two of where, when and what to bring for a secret in the vale. One a day.';
  }
}

/** The icon a prize row stands by. */
function prizeIcon(prize: TicketPrize, name: string): string {
  switch (prize.gives.kind) {
    case 'item':
      return itemIcon(prize.gives.itemId, name);
    case 'pokemon':
      return itemIcon('poke-ball', name);
    case 'rumour':
      return iconMarkup(WORLD_ICONS.signPost, name);
  }
}

/** What is left of a prize, under its name: today's, this week's, or that it is yours. */
function prizeNote(prize: TicketPrize, state: PrizeWindowState): string {
  if (prizeTaken(prize, state.record)) return 'Yours';
  const itemId = prizeItemId(prize);
  const held = itemId !== undefined ? state.situation.holding(itemId) : 0;
  const left = prizeLeftToday(prize, today(state.record, state.now));
  const week = prizeLeftThisWeek(prize, thisWeek(state.record, state.now));
  return [
    Number.isFinite(left) ? `${left} left today` : null,
    Number.isFinite(week) ? (week > 0 ? `${week} this week` : 'Next week') : null,
    prize.once ? 'Once' : null,
    prize.oneHeld && held === 0 ? 'One at a time' : null,
    held > 0 ? `${held} at home` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The prize window: every prize, its price and what is left of it. */
export function prizeWindowMarkup(state: PrizeWindowState): string {
  let first = true;
  const row = (prize: TicketPrize): string => {
    const name = prizeName(prize);
    const refusal = prizeRefusal(prize, state.record, state.now, state.situation);
    const help = refusal ? `${name}: ${refusal}` : `${name} for ${number(prize.tickets)} tickets. ${prizeAbout(prize)}`;
    const note = prizeNote(prize, state);
    const asking = state.asking === prize.id && !refusal;
    const start = first && !state.asking ? ' data-cursor-start' : '';
    first = false;
    if (asking) {
      const question = `Spend ${number(prize.tickets)} of your ${number(state.record.tickets)} tickets on ${name}?`;
      return `<div class="px-pair px-arming" data-shows="${prize.id}"><div class="px-row has-icon px-tall">${prizeIcon(prize, name)}<span class="px-row-main"><strong class="px-name">${name}</strong><small class="px-wrap px-warning">${escapeAttribute(question)}</small></span></div><div class="px-bar-actions"><button class="px-window px-button" data-prize-cancel data-cursor-start data-shows="${prize.id}" data-help="Nothing is spent.">Keep them</button><button class="px-window px-button is-primary" data-prize-confirm="${prize.id}" data-shows="${prize.id}" data-help="${escapeAttribute(`${name} for ${number(prize.tickets)} tickets.`)}">Buy</button></div></div>`;
    }
    return `<button class="px-row has-icon" data-prize="${prize.id}"${refusal ? ' aria-disabled="true"' : ''}${start} data-help="${escapeAttribute(help)}">${prizeIcon(prize, name)}<span class="px-row-main"><strong>${name}</strong>${note ? `<small>${note}</small>` : ''}</span>${pixelTag(`${number(prize.tickets)} tickets`, refusal ? 'risk' : 'plain')}</button>`;
  };
  const list = SHELVES.flatMap(({ shelf, heading }) => {
    const prizes = TICKET_PRIZES.filter((prize) => prize.shelf === shelf);
    return prizes.length === 0 ? [] : [`<h3 class="px-subheading">${heading}</h3>`, ...prizes.map(row)];
  }).join('');
  const lines = state.rumour
    ? [`<small class="px-wrap px-good">${escapeAttribute(state.rumour)}</small>`]
    : [`<small class="px-wrap">${PRIZE_WINDOW_NOTE}</small>`];
  const body = `<main class="px-body game-corner-layout">${pixelWindow(`<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.supply)}>${list}</div>`, {
    heading: 'Prizes',
    note: 'Price in tickets',
  })}${pixelCommitBar({
    title: state.rumour ? 'THE RUMOUR MILL says' : `${number(state.record.tickets)} tickets`,
    lines,
    actions: '<button class="px-window px-button" data-close data-help="Back to the promenade.">Done</button>',
  })}</main>`;
  return pixelScreen({
    title: 'PRIZE WINDOW',
    place: 'Game Corner · ',
    back: { label: 'Done', attribute: 'data-close' },
    aside: pixelTag(`${number(state.record.tickets)} tickets`, 'secure'),
    body,
    hints: 'Arrows choose · ENTER asks to buy one · ESC leaves',
    ...(state.status ? { status: state.status } : {}),
  });
}

// --- BERRY PICKING ------------------------------------------------------------

/** One of the player's Pokémon, as the BERRY PICKING cabinet lists it, from every box. */
export interface BerryCandidate extends PickerBasics {
  /** How many heads it picks with, or undefined for a kind that cannot play. */
  readonly heads: 2 | 3 | undefined;
}

export interface BerryTeamState {
  readonly candidates: readonly BerryCandidate[];
  readonly chosen: string | null;
  readonly tickets: number;
  readonly best: number;
  readonly status?: string;
  readonly last?: { readonly score: number; readonly payout: GamePayout; readonly berries: readonly string[] };
}

/** The cabinet's own screen: pick the bird, then play. */
export function berryTeamMarkup(state: BerryTeamState): string {
  const birds = state.candidates.filter((candidate) => candidate.heads !== undefined);
  const grounded = state.candidates.filter((candidate) => candidate.heads === undefined);
  const row = (candidate: BerryCandidate, index: number): string => {
    const chosen = state.chosen === candidate.id;
    const heads = candidate.heads;
    const help = heads
      ? chosen
        ? `${candidate.name} is picking.`
        : heads === 3
          ? `${candidate.name}: three heads, one for each column.`
          : `${candidate.name}: two heads. It reaches the middle and one side, and turns to reach the other.`
      : `${candidate.name} cannot play: BERRY PICKING wants a DODRIO, or a DODUO at a push.`;
    const tag = heads ? pixelTag(chosen ? 'Picking' : `${heads} heads`, chosen ? 'good' : 'plain', chosen) : pixelTag('Cannot pick', 'risk');
    return `<button class="px-row${chosen ? ' is-selected' : ''}" ${heads ? `data-picker="${candidate.id}"` : 'aria-disabled="true"'} ${basicsRowAttributes(candidate)}${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(candidate)}</span><small>Lv ${candidate.level}${heads ? ` · ${heads === 3 ? 'one head a column' : 'two heads, turns to reach'}` : ' · no beak for it'} · ${escapeAttribute(candidate.box)}</small></span>${tag}</button>`;
  };
  const rows = [
    ...birds.map(row),
    ...(grounded.length > 0 ? ['<h3 class="px-subheading">Not a picker</h3>', ...grounded.map((candidate, index) => row(candidate, birds.length + index))] : []),
  ].join('');
  const empty =
    birds.length === 0
      ? '<p class="px-empty px-wrap">Nobody here can pick. A DODUO stands about the vale - catch one, and it is a DODRIO at 31.</p>'
      : '';
  const ready = state.chosen !== null;
  const play = `<button class="px-window px-button is-primary" data-play${ready ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(ready ? 'LEFT, UP and RIGHT reach for the berry over that head. Ten on the ground ends it.' : 'Choose who picks first.')}">${state.last ? 'Again' : 'Play'}</button>`;
  const body = `<main class="px-body game-corner-layout">${pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${pickerFindField()}${empty}${rows}</div>`,
    { heading: 'Who picks?', note: ready ? '1 of 1' : '0 of 1' },
  )}${pixelCommitBar({
    title: state.last ? `Scored ${number(state.last.score)}` : 'BERRY PICKING',
    lines: [
      ...(state.last ? resultLines(state.last) : []),
      `<small class="px-wrap">${number(state.tickets)} tickets · best ${number(state.best)}. Blue 10, green 30, gold 50; every one that lands costs 50.</small>`,
    ],
    actions: `<button class="px-window px-button" data-close data-help="Back to the arcade.">Done</button>${play}`,
  })}</main>`;
  return pixelScreen({
    title: 'BERRY PICKING',
    place: 'Game Corner · ',
    back: { label: 'Done', attribute: 'data-close' },
    aside: pixelTag(`${number(state.tickets)} tickets`, 'secure'),
    body,
    hints: 'Arrows choose · ENTER picks this one · ESC leaves',
    ...(state.status ? { status: state.status } : {}),
  });
}

// --- THE FIELD-MOVE COURSE ------------------------------------------------------

/** One of the player's Pokémon, as the course keeper looks them over, from every box. */
export interface CourseCandidate extends PickerBasics {
  /** The field moves it could do on the course, in the keeper's words. */
  readonly moves: readonly string[];
}

export interface CourseTeamState {
  readonly candidates: readonly CourseCandidate[];
  readonly chosen: readonly string[];
  readonly most: number;
  /** What the chosen team can do between them. */
  readonly teamMoves: readonly string[];
  /** The fastest the chosen team could possibly go, as the board writes it. */
  readonly fastest: string | null;
  readonly tickets: number;
  readonly best: string | null;
  readonly status?: string;
  readonly last?: { readonly time: string; readonly payout: GamePayout };
}

/** The course keeper's screen: choose up to three to go round with, then run. */
export function courseTeamMarkup(state: CourseTeamState): string {
  const row = (candidate: CourseCandidate, index: number): string => {
    const chosen = state.chosen.includes(candidate.id);
    const full = !chosen && state.chosen.length >= state.most;
    const can = candidate.moves.length > 0 ? candidate.moves.join(', ') : 'no field moves';
    const help = chosen
      ? `${candidate.name} is going round. Choose again to leave it out.`
      : full
        ? `${state.most} are going round already. Take one out first.`
        : `${candidate.name} could do: ${can}.`;
    return `<button class="px-row${chosen ? ' is-selected' : ''}" data-runner="${candidate.id}" ${basicsRowAttributes(candidate)}${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"${full ? ' aria-disabled="true"' : ''}><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(candidate)}</span><small>Lv ${candidate.level} · ${can} · ${escapeAttribute(candidate.box)}</small></span>${pixelTag(chosen ? 'Going' : `${candidate.moves.length} of 4`, chosen ? 'good' : candidate.moves.length > 0 ? 'plain' : 'risk', chosen)}</button>`;
  };
  // Best fits first is the scene's order already (`ui/boxPicker.ts`).
  const sorted = state.candidates;
  const list = sorted.length > 0 ? sorted.map(row).join('') : '<p class="px-empty px-wrap">Nobody to go round with.</p>';
  const ready = state.chosen.length > 0;
  const play = `<button class="px-window px-button is-primary" data-play${ready ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(ready ? 'ARROWS walk, SPACE uses a field move on what you face. The clock starts on your first step.' : 'Choose who goes round first.')}">${state.last ? 'Again' : 'Run'}</button>`;
  const moves = state.teamMoves.length > 0 ? state.teamMoves.join(' · ') : 'no field moves - it is the long way round everywhere';
  const body = `<main class="px-body game-corner-layout">${pixelWindow(
    `<div class="px-list px-scroll" ${pixelColumns(COLUMN_MEASURES.pokemon)}>${pickerFindField()}${list}</div>`,
    { heading: 'Who goes round?', note: `${state.chosen.length} of ${state.most}` },
  )}${pixelCommitBar({
    title: state.last ? `Round in ${state.last.time}` : 'FIELD-MOVE COURSE',
    lines: [
      ...(state.last ? resultLines({ score: 1, payout: state.last.payout, berries: [] }) : []),
      `<small class="px-wrap">${ready ? `This team: ${moves}.${state.fastest ? ` Its fastest round is ${state.fastest}.` : ''}` : `Choose up to ${state.most} to go round with.`}${state.best ? ` Your best round is ${state.best}.` : ''}</small>`,
    ],
    actions: `<button class="px-window px-button" data-close data-help="Back to the promenade.">Done</button>${play}`,
  })}</main>`;
  return pixelScreen({
    title: 'FIELD-MOVE COURSE',
    place: 'Promenade · ',
    back: { label: 'Done', attribute: 'data-close' },
    aside: pixelTag(`${number(state.tickets)} tickets`, 'secure'),
    body,
    hints: 'Arrows choose · ENTER takes one in or out · ESC leaves',
    ...(state.status ? { status: state.status } : {}),
  });
}
