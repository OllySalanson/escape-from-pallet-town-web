import { itemIcon } from '../ui/icons';
import { escapeAttribute, pixelScreen, pixelTag } from '../ui/pixelUi';
import { getItemById } from '../items/items';
import { Pokemon } from '../pokemon/Pokemon';
import { EVOLUTIONS } from '../pokemon/evolution';
import { getSpeciesById } from '../pokemon/species';
import { pixelMonIconForDex } from '../ui/monIcon';
import { publicAssetUrl } from '../publicAssetUrl';
import { pokemonSpritePath } from '../pokemon/pokemonSprites';
import {
  BERRIES_A_DAY,
  DAILY_TICKET_CEILING,
  paidToday,
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
  type PrizeShelf,
  type PrizeSituation,
  type TicketPrize,
} from './tickets';

/**
 * THE GAME CORNER's one DOM screen, as pure markup: the PRIZE WINDOW. Its
 * games open straight onto their own canvas, with nothing to choose first
 * (`scenes/GameCornerScene.ts`, `BerryPickingScene.ts`, `minigames/whoPlays.ts`).
 */

const number = (value: number): string => value.toLocaleString('en-GB');

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
    case 'item': {
      // A berry's own description already says what it does held. Furniture's
      // was written for a raid find ("bring it home"): from the window it is
      // home already (the harbour critic tour, 26 Nov 2026).
      const item = getItemById(prize.gives.itemId);
      if (item?.effect.type === 'furniture') return `Furniture for THE BOLTHOLE: it goes straight home. Put it down with [H].`;
      const disc = item?.effect.type === 'machine' ? ' Read it from your pack on a raid.' : '';
      return `${item?.description ?? ''}${disc}`;
    }
    case 'pokemon':
      if (prize.gives.shiny) {
        return `A gold one, Lv ${prize.gives.level}. Lead your team with it and the vale's shy things will notice. One a trainer.${prizeMovesNote(
          prize.gives.speciesId,
          prize.gives.level,
        )}`;
      }
      // Not "FireRed's own prize, at Lv 15": only ABRA's level is FireRed's,
      // and a clerk in Kanto has not heard of FireRed (the critic tour).
      return `Lv ${prize.gives.level}, for your boxes. One a trainer.${prizeMovesNote(
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
  // What it is, always: with no tickets the line said only "600 more
  // tickets", so a window full of prizes gave no reason to earn one (the
  // harbour critic tour, 26 Nov 2026).
  const help = refusal ? `${name}: ${refusal} ${prizeAbout(prize)}` : `${name} for ${number(prize.tickets)} tickets. ${prizeAbout(prize)}`;
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
    place: 'Game Corner',
    close: { attribute: 'data-close' },
    aside: pixelTag(`${number(state.record.tickets)} tickets`, 'secure'),
    body,
    hints: 'ARROWS move · ENTER buy · ESC back',
    ...(state.status ? { status: state.status } : {}),
  });
}
