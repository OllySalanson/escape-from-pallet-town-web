import { itemIcon } from '../ui/icons';
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
import { Pokemon } from '../pokemon/Pokemon';
import { EVOLUTIONS } from '../pokemon/evolution';
import { getSpeciesById } from '../pokemon/species';
import { pixelMonIconForDex } from '../ui/monIcon';
import { MAX_JUMPERS, type JumpType } from './pokemonJump';
import { cabinetRates } from './gameCornerTalk';
import { publicAssetUrl } from '../publicAssetUrl';
import { pokemonSpritePath } from '../pokemon/pokemonSprites';
import {
  BERRIES_A_DAY,
  DAILY_TICKET_CEILING,
  paidToday,
  payoutWords,
  prizeById,
  prizeItemId,
  prizeLeftThisWeek,
  prizeLeftToday,
  prizeName,
  prizeRefusal,
  prizeTaken,
  RUMOURS_A_DAY,
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

/**
 * Which kinds can jump, in words a player can go and catch by. "Not on
 * FireRed's list" told a new player nothing about which Pokémon to fetch (AI
 * playtest, 20 Nov 2026). FireRed's list (`generated/pokemonJump.ts`) is no
 * one shape - Pidgey and Diglett are off it, Oddish and Psyduck on - so the
 * line names kinds on it that the vale's grass holds rather than a rule.
 */
export const JUMPERS_ARE = 'Only some kinds can jump: RATTATA, ODDISH, PSYDUCK, PIKACHU and the like.';

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
      : `${candidate.name} cannot play. ${JUMPERS_ARE}`;
    const tag = type
      ? pixelTag(chosen ? 'Jumping' : JUMP_WORDS[type].label, chosen ? 'good' : 'plain', chosen)
      : pixelTag('Cannot jump', 'risk');
    return `<button class="px-row${chosen ? ' is-selected' : ''}" ${type ? `data-jumper="${candidate.id}"` : 'aria-disabled="true"'} ${basicsRowAttributes(candidate)}${index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"${full ? ' aria-disabled="true"' : ''}><span class="px-row-main"><span class="px-row-line">${pixelPokemonName(candidate)}</span><small>Lv ${candidate.level}${type ? ` · ${JUMP_WORDS[type].label} jumper` : ''} · ${escapeAttribute(candidate.box)}</small></span>${tag}</button>`;
  };
  const rows = [
    ...jumpers.map(row),
    ...(grounded.length > 0 ? ['<h3 class="px-subheading">Can’t jump</h3>', ...grounded.map((candidate, index) => row(candidate, jumpers.length + index))] : []),
  ].join('');
  const empty =
    jumpers.length === 0
      ? '<p class="px-empty px-wrap">Nobody here can jump.</p>'
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
      `<small class="px-wrap">${number(state.tickets)} tickets · best ${number(state.best)}</small>`,
      `<small class="px-wrap">${cabinetRates('pokemon-jump')}</small>`,
    ],
    actions: play,
  })}</main>`;
  return pixelScreen({
    title: 'POKéMON JUMP',
    place: 'Game Corner · ',
    close: { attribute: 'data-close' },
    aside: pixelTag(`${number(state.tickets)} tickets`, 'secure'),
    body,
    hints: 'ARROWS move · ENTER takes one in or out · ESC back',
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

/**
 * The prize room's wall, top to bottom: a shelf a line, and a shelf may hold
 * two groups side by side (FOR RAIDS and the RUMOUR MILL's bottle). Each group
 * is named on a brass plate under its plank. THE GAME CORNER's prize window is
 * drawn as things standing on shelves, each with a gold ticket for its price,
 * and the clerk's counter beside them answers for the one under the cursor
 * (Olly's pick of 26 Nov 2026, `docs/screens/prize-shelves/`).
 */
const WALL: readonly (readonly PrizeShelf[])[] = [['berries'], ['raids', 'rumours'], ['pokemon'], ['house']];

/** What a group's plate says: its name, and what is left of the day where that is the whole group's. */
function plateWords(shelf: PrizeShelf, state: PrizeWindowState): string {
  switch (shelf) {
    case 'berries': {
      const berry = TICKET_PRIZES.find((prize) => prize.shelf === 'berries');
      const left = berry ? prizeLeftToday(berry, today(state.record, state.now)) : 0;
      return `Held berries · ${left} of ${BERRIES_A_DAY} left today`;
    }
    case 'raids':
      return 'For raids';
    case 'pokemon':
      return 'POKéMON · once each';
    case 'rumours':
      return `Rumour mill · ${RUMOURS_A_DAY} a day`;
    case 'house':
      return `For the house · ${TICKET_PRIZES.filter((prize) => prize.shelf === 'house').length}`;
  }
}

/** What a prize is, said on its help line after its price. */
function prizeAbout(prize: TicketPrize): string {
  switch (prize.gives.kind) {
    case 'item':
      // A berry's own description already says what it does held.
      return getItemById(prize.gives.itemId)?.description ?? '';
    case 'pokemon':
      if (prize.gives.shiny) {
        return `Gold all over, at Lv ${prize.gives.level}: the one shiny anybody sells. Walk it in front, and whatever in the vale waits for a shiny will see it. One to a trainer: it goes to your boxes.${prizeMovesNote(
          prize.gives.speciesId,
          prize.gives.level,
        )}`;
      }
      return `FireRed's own prize, at Lv ${prize.gives.level}. One to a trainer: it goes to your boxes.${prizeMovesNote(
        prize.gives.speciesId,
        prize.gives.level,
      )}`;
    case 'rumour':
      return 'A slip from THE RUMOUR MILL: two of where, when and what to bring for a secret in the vale. One a day.';
  }
}

/**
 * Said of a prize Pokémon that knows no move at its level - ABRA, whose
 * Teleport is a move the engine leaves out - so nobody buys it thinking it can
 * fight: it Struggles until it grows into a form that learns something.
 */
export function prizeMovesNote(speciesId: string, level: number): string {
  const species = getSpeciesById(speciesId);
  if (!species || new Pokemon(species, level).moves.length > 0) return '';
  const grows = EVOLUTIONS.find((rule) => rule.from === speciesId && rule.trigger.kind === 'level');
  const into = grows ? getSpeciesById(grows.to) : undefined;
  return grows?.trigger.kind === 'level' && into
    ? ` It knows no move yet and Struggles until it grows into ${into.name.toUpperCase()} at Lv ${grows.trigger.level}.`
    : ' It knows no move yet and Struggles.';
}

/** A prize's picture: the item's own icon, the Pokémon's own front (in gold for the shiny), or the rumour's bottle. */
function prizeArt(prize: TicketPrize, name: string): string {
  switch (prize.gives.kind) {
    case 'item':
      return itemIcon(prize.gives.itemId, name);
    case 'pokemon': {
      const species = getSpeciesById(prize.gives.speciesId);
      if (!species) return itemIcon('poke-ball', name);
      const src = publicAssetUrl(pokemonSpritePath('front', species.dexId, prize.gives.shiny === true));
      return `<span class="prize-mon"><img src="${src}" alt="" aria-hidden="true" /><span class="visually-hidden">${name}</span></span>`;
    }
    case 'rumour':
      return itemIcon('bottled-chart', name);
  }
}

/**
 * The chosen prize as it stands on the counter by the clerk: an item at the
 * shelf's size, and a Pokémon as its party icon, which is the size the counter
 * has room for at one game pixel a source pixel.
 */
function counterArt(prize: TicketPrize, name: string): string {
  if (prize.gives.kind !== 'pokemon') return prizeArt(prize, name);
  const species = getSpeciesById(prize.gives.speciesId);
  return species ? pixelMonIconForDex(species.dexId, name) : itemIcon('poke-ball', name);
}

/** A ticket: gold with notched ends, the price on it. `is-off` greys it for a price not yet in reach. */
function ticket(text: string, tone: 'plain' | 'off' | 'rest' = 'plain'): string {
  return `<span class="prize-ticket${tone === 'plain' ? '' : ` is-${tone}`}">${text}</span>`;
}

/** How a prize stands on the shelf: on offer, out of reach for tickets, out for another reason (with that reason in two words), or had. */
type ThingState =
  | { readonly kind: 'open' }
  | { readonly kind: 'short'; readonly short: number }
  | { readonly kind: 'out'; readonly note: string }
  | { readonly kind: 'yours' };

function thingState(prize: TicketPrize, state: PrizeWindowState): ThingState {
  if (prizeTaken(prize, state.record)) return { kind: 'yours' };
  const itemId = prizeItemId(prize);
  if (prize.oneHeld && itemId !== undefined && state.situation.holding(itemId) > 0) return { kind: 'out', note: 'At home' };
  if (prize.gives.kind === 'rumour' && !state.situation.rumourToTell) return { kind: 'out', note: 'Heard' };
  if (prizeLeftToday(prize, today(state.record, state.now)) <= 0) return { kind: 'out', note: 'Tomorrow' };
  if (prizeLeftThisWeek(prize, thisWeek(state.record, state.now)) <= 0) return { kind: 'out', note: 'Next week' };
  if (state.record.tickets < prize.tickets) return { kind: 'short', short: prize.tickets - state.record.tickets };
  return { kind: 'open' };
}

/** What is left of a prize, as the counter card's chips: today's, this week's, how many are at home, or that it is once only. */
function prizeChips(prize: TicketPrize, state: PrizeWindowState): string[] {
  const itemId = prizeItemId(prize);
  const held = itemId !== undefined ? state.situation.holding(itemId) : 0;
  const left = prizeLeftToday(prize, today(state.record, state.now));
  const week = prizeLeftThisWeek(prize, thisWeek(state.record, state.now));
  return [
    prize.gives.kind === 'pokemon' ? `Lv ${prize.gives.level}` : null,
    held > 0 ? `${held} at home` : null,
    Number.isFinite(left) ? `${left} left today` : null,
    Number.isFinite(week) ? (week > 0 ? `${week} this week` : 'Next week') : null,
    prize.once ? 'Once' : null,
    prize.oneHeld && held === 0 ? 'One at a time' : null,
  ].filter((chip): chip is string => chip !== null);
}

/** The clerk's counter card for one prize: its picture, its name, what is left of it, and the sum it comes to - or, asked about, the question. */
function counterCard(prize: TicketPrize, state: PrizeWindowState, shown: boolean): string {
  const name = prizeName(prize);
  const standing = thingState(prize, state);
  const asking = state.asking === prize.id && standing.kind === 'open';
  const chips = prizeChips(prize, state)
    .map((chip) => `<span class="prize-chip">${chip}</span>`)
    .join('');
  const have = state.record.tickets;
  const sum =
    standing.kind === 'yours'
      ? '<span class="prize-stamp">Yours</span>'
      : standing.kind === 'out'
        ? `<span class="prize-chip is-out">${standing.note}</span>`
        : `<span class="prize-sum">${ticket(number(have))}<span>−</span>${ticket(number(prize.tickets), standing.kind === 'short' ? 'off' : 'plain')}<span>=</span>${
            standing.kind === 'short' ? `<span class="prize-chip is-out">${number(standing.short)} short</span>` : ticket(number(have - prize.tickets), 'rest')
          }</span>`;
  const go = asking
    ? `<p class="prize-question px-wrap">Buy ${escapeAttribute(name)}?</p><div class="prize-answers"><button class="px-window px-button" data-prize-cancel data-cursor-start data-shows="${prize.id}" data-help="Nothing is spent.">Not now</button><button class="px-window px-button is-primary" data-prize-confirm="${prize.id}" data-shows="${prize.id}" data-help="${escapeAttribute(`${name} for ${number(prize.tickets)} tickets.`)}">Buy</button></div>`
    : standing.kind === 'open'
      ? '<p class="prize-go"><span class="prize-key">ENTER</span><span>Buy</span></p>'
      : '';
  return `<div class="px-detail prize-card${asking ? ' is-asking' : ''}" data-shown-by="${prize.id}"${shown ? '' : ' hidden'}><div class="prize-card-art">${counterArt(prize, name)}</div><strong class="prize-card-name">${name}</strong>${
    chips ? `<div class="prize-chips">${chips}</div>` : ''
  }${sum}${go}</div>`;
}

/** One prize as it stands on the shelf: its picture, its gold ticket (or YOURS), and what keeps it if something does. */
function shelfThing(prize: TicketPrize, state: PrizeWindowState, start: boolean): string {
  const name = prizeName(prize);
  const standing = thingState(prize, state);
  const refusal = prizeRefusal(prize, state.record, state.now, state.situation);
  const help = refusal ? `${name}: ${refusal}` : `${name} for ${number(prize.tickets)} tickets. ${prizeAbout(prize)}`;
  const foot =
    standing.kind === 'yours'
      ? '<span class="prize-stamp">Yours</span>'
      : standing.kind === 'out'
        ? ''
        : ticket(number(prize.tickets), standing.kind === 'open' ? 'plain' : 'off');
  // Out for a reason that is not tickets, the reason stands where the price would.
  const note = standing.kind === 'out' ? `<span class="prize-note">${standing.note}</span>` : '';
  const label = prize.gives.kind === 'pokemon' ? `<span class="prize-label">${prizeName(prize).replace('SHINY ', '')}<small>${prize.gives.shiny ? 'gold' : `Lv ${prize.gives.level}`}</small></span>` : '';
  const shiny = prize.gives.kind === 'pokemon' && prize.gives.shiny ? ' is-shiny' : '';
  // The thing asked about carries a mark of its own while its question is open, so
  // the redraw does not put the cursor back on it (`MenuOverlay.refocus` keeps a
  // control it can find again) and NOT NOW is the one cursor on the screen.
  const asked = state.asking === prize.id ? ' data-asked' : '';
  return `<button class="prize-thing is-${prize.gives.kind} is-${standing.kind}${shiny}" data-prize="${prize.id}"${asked} data-shows="${prize.id}"${refusal ? ' aria-disabled="true"' : ''}${start ? ' data-cursor-start' : ''} data-help="${escapeAttribute(help)}"><span class="prize-art">${prizeArt(prize, name)}</span>${foot}${note}${label}</button>`;
}

/** The prize window: the wall of prizes on shelves, and the clerk's counter answering for the one under the cursor. */
export function prizeWindowMarkup(state: PrizeWindowState): string {
  const asked = state.asking ? prizeById(state.asking) : undefined;
  const first = asked ?? TICKET_PRIZES.find((prize) => prize.shelf === WALL[0][0]) ?? TICKET_PRIZES[0];
  const wall = WALL.map(
    (shelves) =>
      `<div class="prize-shelf">${shelves
        .map((shelf) => {
          const things = TICKET_PRIZES.filter((prize) => prize.shelf === shelf)
            .map((prize) => shelfThing(prize, state, !state.asking && prize === first))
            .join('');
          return `<section class="prize-group is-${shelf}"><div class="prize-things">${things}</div><h3 class="prize-plate">${plateWords(shelf, state)}</h3></section>`;
        })
        .join('')}</div>`,
  ).join('');
  const cards = TICKET_PRIZES.map((prize) => counterCard(prize, state, prize === first)).join('');
  const won = paidToday(today(state.record, state.now));
  const meter = `<div class="prize-won"><span>Won today</span><span class="prize-meter"><i style="width:${Math.min(100, Math.round((won / DAILY_TICKET_CEILING) * 100))}%"></i></span><span>${won} / ${DAILY_TICKET_CEILING}</span></div>`;
  const rumour = state.rumour ? `<p class="prize-rumour px-wrap px-good">${escapeAttribute(state.rumour)}</p>` : '';
  const clerk = `<span class="prize-clerk" style="background-image:url('${publicAssetUrl('assets/characters/clerk.png')}')" aria-hidden="true"></span>`;
  const body = `<main class="px-body prize-room"><section class="px-window prize-room-window"><div class="prize-wall px-scroll"><div class="prize-shelves">${wall}</div></div><div class="prize-counter">${clerk}<div class="prize-counter-top">${cards}${rumour}</div>${meter}</div></section></main>`;
  return pixelScreen({
    title: 'PRIZE WINDOW',
    place: 'Game Corner · ',
    close: { attribute: 'data-close' },
    aside: pixelTag(`${number(state.record.tickets)} tickets`, 'secure'),
    body,
    hints: 'ARROWS move · ENTER buy · ESC back',
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
      ? '<p class="px-empty px-wrap">Nobody here can pick.</p>'
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
      `<small class="px-wrap">${cabinetRates('berry-picking')}</small>`,
    ],
    actions: play,
  })}</main>`;
  return pixelScreen({
    title: 'BERRY PICKING',
    place: 'Game Corner · ',
    close: { attribute: 'data-close' },
    aside: pixelTag(`${number(state.tickets)} tickets`, 'secure'),
    body,
    hints: 'ARROWS move · ENTER picks this one · ESC back',
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
      ...(ready || state.best
        ? [`<small class="px-wrap">${ready ? `This team: ${moves}.${state.fastest ? ` Its fastest round is ${state.fastest}.` : ''}` : ''}${state.best ? `${ready ? ' ' : ''}Your best round is ${state.best}.` : ''}</small>`]
        : []),
    ],
    actions: play,
  })}</main>`;
  return pixelScreen({
    title: 'FIELD-MOVE COURSE',
    place: 'Promenade · ',
    close: { attribute: 'data-close' },
    aside: pixelTag(`${number(state.tickets)} tickets`, 'secure'),
    body,
    hints: 'ARROWS move · ENTER takes one in or out · ESC back',
    ...(state.status ? { status: state.status } : {}),
  });
}
