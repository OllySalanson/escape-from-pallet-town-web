/**
 * THE HARBOUR BOUTIQUE and the wardrobe at home, as one screen: the mirror
 * down one side, walking in whatever is being tried on, and the shelves beside
 * it as tabs, one shelf at a time, laid out a page at a time - every card on a
 * page the same size, every page whole, and how many pages there are said over
 * them. The shelves used to be one list of two hundred cards in a window two
 * rows deep, scrolled to wherever the browser left it: a sliver of the row
 * above, two rows, or one and a band of empty paper, under a scroll bar a pixel
 * wide (the captain, 25 Nov 2026: "I didn't even realize you could scroll
 * down").
 *
 * Pointing at a card shows it in the mirror; ENTER tries it on and takes the
 * cursor to the bar along the foot, which says what the try-on costs, as the
 * things themselves, and buys it, or puts it on.
 *
 * The shop sells; the wardrobe only changes into what is owned. Both are the
 * same markup so a piece looks the same in either, and so a player learns one
 * screen. Pure markup and pure moves, so every word and every key is tested
 * without a browser; `scenes/BoutiqueScene.ts` draws it and wires the keys.
 */
import { formatMoney } from '../items/items';
import { itemIcon } from '../ui/icons';
import { escapeAttribute, pixelScreen, pixelTag, pixelWindow } from '../ui/pixelUi';
import { LOOK_SLOTS, sameLook, wearing, type LookSlot, type PlayerLook } from './look';
import { billFor, checkBill, lookPriceLine, priceLine, SHELF_ORDER, shelfPieces, unownedIn, WHOLE_LOOKS, type WearableBill, type WholeLook } from './wardrobe';
import { BOUTIQUE_NAME, wearableById, WEARABLES, type Wearable } from './wearables';

export type BoutiqueMode = 'shop' | 'wardrobe';

export interface BoutiqueState {
  readonly mode: BoutiqueMode;
  /** What is on in the mirror. */
  readonly trying: PlayerLook;
  /** What the player walked in wearing, which is what the save says. */
  readonly wearing: PlayerLook;
  readonly owned: ReadonlySet<string>;
  /** How many of an item the vault holds: money, and the goods a barter asks for. */
  readonly held: (itemId: string) => number;
  /** A look's sheet as something a page can draw: a data URL of its 64x128 grid. */
  readonly sheet: (look: PlayerLook) => string;
  readonly status?: string;
}

/** Where the shelves stand: which shelf is out, which page of it, and how many cards a page holds. */
export interface ShelfView {
  readonly shelf: number;
  readonly page: number;
  readonly perPage: number;
  readonly columns: number;
}

/** One card on a shelf: the classic look, a whole look, or one piece. */
export type ShelfCard =
  | { readonly kind: 'classic' }
  | { readonly kind: 'whole'; readonly look: WholeLook }
  | { readonly kind: 'piece'; readonly piece: Wearable };

export interface Shelf {
  readonly key: string;
  /** The tab's word. */
  readonly tab: string;
  /** What the shelf holds, in a sentence: its tab's help. */
  readonly help: string;
  readonly cards: readonly ShelfCard[];
}

/** The tabs' words, in the order the shelves stand. */
export const SHELF_TABS: Readonly<Record<string, string>> = {
  looks: 'Looks',
  hat: 'Hats',
  hair: 'Hair',
  top: 'Tops',
  legs: 'Bottoms',
  outfit: 'Outfits',
  raid: 'Raid finds',
};

const SHELF_HELP: Readonly<Record<string, string>> = {
  looks: 'Whole looks, head to toe, and the classic look you came in.',
  hat: 'Hats and caps.',
  hair: 'Hair.',
  top: 'Tops and jackets.',
  legs: 'Trousers, shorts and skirts.',
  outfit: 'Whole outfits: one piece from the neck down.',
  raid: 'Never on a shelf: legendary colours and shiny ones turn up on raids. Try them on all the same.',
};

const SLOT_WORDS: Readonly<Record<LookSlot, string>> = {
  head: 'Head',
  top: 'Top',
  legs: 'Bottoms',
  body: 'Outfit',
};

/** The keys, on a line of their own under the help line, whatever the cursor is on. */
export const BOUTIQUE_KEYS = 'ARROWS choose · ENTER try on, then buy · TAB shelves or bar · ESC leave';
export const WARDROBE_KEYS = 'ARROWS choose · ENTER try on, then wear · TAB clothes or bar · ESC close';

/**
 * A card's size in game pixels. Its height is fixed, so a page is whole rows
 * and a row is one height whatever is on it: a figure (46), its name (12) and
 * a price line as tall as an item's icon (16), with three over and under and
 * one between. Its width is the narrowest it may be; the cards share out the
 * rest of the shelf. At 1280x800 the shelf is 256 high: three rows.
 */
export const CARD_HEIGHT = 82;
export const CARD_MIN_WIDTH = 100;
export const CARD_GAP = 3;
/**
 * At the smallest stage a card's figure is the game's own size (23), and the
 * card is its name and price under it with a pixel over and under: 53, so the
 * shelf's 112 holds two rows. Two cards across, at the least.
 */
export const TIGHT_CARD_HEIGHT = 53;
export const TIGHT_CARD_MIN_WIDTH = 72;

/** The rows of the figure's sheet the mirror shows, one facing each: down, left, up, right. */
const MIRROR_ROWS = [0, 3, 2, 1] as const;
/** Where a look's figure starts, in its frame: a hat stands a row or two taller than any head. */
export const LOOK_FIGURE_TOP = 6;

/** A look's figure, one facing, walking or standing, at `scale` game pixels a pixel. */
export function lookFigure(sheet: string, options: { readonly row?: number; readonly scale?: number; readonly walking?: boolean; readonly label: string }): string {
  const row = options.row ?? 0;
  const top = row * 32 + LOOK_FIGURE_TOP;
  const height = 27 + 2 - LOOK_FIGURE_TOP;
  // A figure with no scale of its own takes its box's (the mirror's, which the screen's room sets).
  const scale = options.scale === undefined ? '' : `--figure-scale:${options.scale};`;
  const style = `--figure-top:${top};--figure-height:${height};${scale}--figure-sheet:url('${sheet}')`;
  return `<span class="px-figure look-figure${options.walking ? ' is-walking' : ''}" role="img" aria-label="${escapeAttribute(options.label)}" style="${style}"></span>`;
}

/** The shelves this screen shows, in order: the shop's every one, the wardrobe's only what is owned. */
export function shelvesFor(state: Pick<BoutiqueState, 'mode' | 'owned'>): readonly Shelf[] {
  const shelf = (key: string, cards: readonly ShelfCard[]): Shelf => ({ key, tab: SHELF_TABS[key], help: SHELF_HELP[key], cards });
  const piece = (each: Wearable): ShelfCard => ({ kind: 'piece', piece: each });
  if (state.mode === 'shop') {
    return [
      shelf('looks', [{ kind: 'classic' }, ...WHOLE_LOOKS.map((look): ShelfCard => ({ kind: 'whole', look }))]),
      ...SHELF_ORDER.map((kind) => shelf(kind, shelfPieces(kind, false).map(piece))),
      shelf('raid', WEARABLES.filter((each) => each.rarity === 'raid').map(piece)),
    ];
  }
  const looks = WHOLE_LOOKS.filter((entry) => unownedIn(entry.look, state.owned).length === 0);
  return [
    shelf('looks', [{ kind: 'classic' }, ...looks.map((look): ShelfCard => ({ kind: 'whole', look }))]),
    ...SHELF_ORDER.map((kind) => shelf(kind, WEARABLES.filter((each) => each.kind === kind && state.owned.has(each.id)).map(piece))),
  ].filter((each) => each.cards.length > 0);
}

/** How many pages a shelf of `count` cards takes, at `perPage` a page: always at least one. */
export function pageCount(count: number, perPage: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, perPage)));
}

/** How many cards a page holds in a shelf of this many game pixels: whole rows of whole cards. */
export function pageShape(width: number, height: number, card: { readonly height: number; readonly minWidth: number; readonly gap: number }): { readonly columns: number; readonly rows: number } {
  const columns = Math.max(1, Math.floor((width + card.gap) / (card.minWidth + card.gap)));
  const rows = Math.max(1, Math.floor((height + card.gap) / (card.height + card.gap)));
  return { columns, rows };
}

/** Where an arrow key takes the cursor from a card. */
export type GridMove =
  | { readonly to: 'card'; readonly page: number; readonly index: number; readonly turned: -1 | 0 | 1 }
  | { readonly to: 'tabs' }
  | { readonly to: 'bar' }
  | { readonly to: 'stay' };

/**
 * An arrow key from the card at `index` on `page` (counted on the page). The
 * arrows only ever move the cursor: Left and Right walk a row and go over the
 * page's edge onto the next page or the last, as its arrows either side say;
 * Up from the top row is the shelf's tab, and Down from the bottom row the bar
 * along the foot. Nothing wraps.
 */
export function gridMove(
  at: { readonly page: number; readonly index: number },
  direction: 'up' | 'down' | 'left' | 'right',
  shelf: { readonly count: number; readonly perPage: number; readonly columns: number },
): GridMove {
  const { count, perPage, columns } = shelf;
  const pages = pageCount(count, perPage);
  const onPage = (page: number): number => Math.min(perPage, count - page * perPage);
  const here = onPage(at.page);
  const column = at.index % columns;
  const row = Math.floor(at.index / columns);
  const card = (page: number, index: number, turned: -1 | 0 | 1): GridMove => ({ to: 'card', page, index, turned });
  switch (direction) {
    case 'right':
      if (column < columns - 1 && at.index + 1 < here) return card(at.page, at.index + 1, 0);
      if (at.page + 1 < pages) return card(at.page + 1, Math.min(row * columns, onPage(at.page + 1) - 1), 1);
      return { to: 'stay' };
    case 'left':
      if (column > 0) return card(at.page, at.index - 1, 0);
      if (at.page > 0) return card(at.page - 1, Math.min(row * columns + columns - 1, onPage(at.page - 1) - 1), -1);
      return { to: 'stay' };
    case 'up':
      return row > 0 ? card(at.page, at.index - columns, 0) : { to: 'tabs' };
    case 'down': {
      const lastRow = Math.floor((here - 1) / columns);
      if (row >= lastRow) return { to: 'bar' };
      return card(at.page, Math.min(at.index + columns, here - 1), 0);
    }
  }
}

export function boutiqueMarkup(state: BoutiqueState, view: ShelfView): string {
  const shop = state.mode === 'shop';
  const shelves = shelvesFor(state);
  const body = `<main class="px-body boutique-layout"><div class="boutique-panes">${mirror(state)}${shelvesWindow(state, shelves, view)}</div>${commitBar(state)}</main>`;
  return pixelScreen({
    title: shop ? BOUTIQUE_NAME : 'Your wardrobe',
    place: shop ? 'The Docks' : 'The Bolthole',
    back: { label: shop ? 'Shop' : 'Bedroom', attribute: 'data-close' },
    aside: `${formatMoney(state.held('money'))} in the vault`,
    body,
    hints: shop ? 'Everything on the shelves shows in the mirror first.' : 'Everything you own shows in the mirror first.',
    keys: shop ? BOUTIQUE_KEYS : WARDROBE_KEYS,
    ...(state.status ? { status: state.status } : {}),
  });
}

/** The shelves' window: a tab a shelf, the page between its two arrows, and which page it is. */
function shelvesWindow(state: BoutiqueState, shelves: readonly Shelf[], view: ShelfView): string {
  const shelf = shelves[view.shelf] ?? shelves[0];
  const tabs = shelves
    .map(
      (each, index) =>
        `<button class="boutique-tab${index === view.shelf ? ' is-here' : ''}" data-tab="${index}" data-help="${escapeAttribute(each.help)}">${tabWords(each.tab)}<small>${each.cards.length}</small></button>`,
    )
    .join('');
  return pixelWindow(
    `<div class="boutique-tabs" role="tablist">${tabs}</div><div class="boutique-shelf"><button class="boutique-turn is-back" data-turn="-1" aria-label="The page before" tabindex="-1"></button><div class="boutique-page" data-page-grid>${shelfPage(state, shelf, view)}</div><button class="boutique-turn is-next" data-turn="1" aria-label="The next page" tabindex="-1"></button></div>`,
    {
      heading: shop(state) ? 'The shelves' : 'Your clothes',
      note: pageWords(shelf, view),
      className: 'boutique-shelves-window',
    },
  );
}

/** A tab's word, its second word set apart so the smallest stage can keep only the first ("RAID"). */
function tabWords(words: string): string {
  const [first, ...rest] = words.split(' ');
  return rest.length === 0 ? first : `${first}<span class="boutique-tab-more"> ${rest.join(' ')}</span>`;
}

function shop(state: Pick<BoutiqueState, 'mode'>): boolean {
  return state.mode === 'shop';
}

/** "Page 2 of 7", or nothing for a shelf that fits on one. */
export function pageWords(shelf: Pick<Shelf, 'cards'>, view: Pick<ShelfView, 'page' | 'perPage'>): string {
  const pages = pageCount(shelf.cards.length, view.perPage);
  return pages > 1 ? `Page ${view.page + 1} of ${pages}` : '';
}

/** One page of a shelf's cards. */
export function shelfPage(state: BoutiqueState, shelf: Shelf | undefined, view: Pick<ShelfView, 'page' | 'perPage'>): string {
  if (!shelf) {
    return '';
  }
  const start = view.page * view.perPage;
  return shelf.cards
    .slice(start, start + view.perPage)
    .map((card, index) => cardMarkup(state, card, index))
    .join('');
}

function cardMarkup(state: BoutiqueState, card: ShelfCard, index: number): string {
  switch (card.kind) {
    case 'classic':
      return classicCard(state, index);
    case 'whole':
      return wholeCard(state, card.look, index);
    case 'piece':
      return pieceCard(state, card.piece, index);
  }
}

/** A card: the figure, its name, what it costs, and a stamp in its corner for what is already true. */
function card(options: {
  readonly index: number;
  readonly attribute: string;
  readonly figure: string;
  readonly name: string;
  readonly price: string;
  readonly stamp: string;
  readonly help: string;
  readonly classes?: string;
  readonly selected: boolean;
}): string {
  return `<button class="px-window px-card boutique-card${options.selected ? ' is-selected' : ''}${options.classes ?? ''}" ${options.attribute} data-index="${options.index}"${options.index === 0 ? ' data-cursor-start' : ''} data-help="${escapeAttribute(options.help)}">${options.figure}<strong class="boutique-card-name">${options.name}</strong><span class="boutique-card-price">${options.price}</span>${options.stamp}</button>`;
}

/** What a card wears in its corner: ON while it is in the mirror, YOURS once it is owned. */
function stamp(on: boolean, owned: boolean): string {
  if (on) return `<span class="boutique-stamp">${pixelTag('On', 'good')}</span>`;
  return owned ? `<span class="boutique-stamp">${pixelTag('Yours', 'secure', true)}</span>` : '';
}

function classicCard(state: BoutiqueState, index: number): string {
  const on = state.trying === null;
  return card({
    index,
    attribute: 'data-classic',
    figure: lookFigure(state.sheet(null), { label: 'The classic look' }),
    name: 'The classic look',
    price: '<small class="boutique-free">Free</small>',
    stamp: stamp(on, !on),
    help: 'The clothes you came to the harbour in. Free, and always yours.',
    selected: on,
  });
}

/**
 * A card's price as the things themselves: the money, then each material as
 * its icon and a count, as the workshop's cards show theirs. A card has room for
 * the money and two materials; a third is "+1", and the whole of it is under the
 * mirror when the card is pointed at. Said in words it ran to three centred
 * lines on a card ("₽400 and 10 Linen rolls, 6 Mooring ropes and 4 Radio
 * valves"); the words stay for a reader.
 */
export function priceChips(bill: WearableBill, options: { readonly most?: number; readonly held?: (itemId: string) => number } = {}): string {
  const short = (itemId: string, quantity: number): string => (options.held && options.held(itemId) < quantity ? ' is-short' : '');
  const goods = Object.entries(bill.goods);
  const most = options.most ?? goods.length;
  const shown = goods.slice(0, most);
  const parts = [
    ...(bill.money > 0 ? [`<span class="boutique-cost${short('money', bill.money)}">${formatMoney(bill.money)}</span>`] : []),
    ...shown.map(([itemId, quantity]) => `<span class="boutique-cost${short(itemId, quantity)}">${itemIcon(itemId)}<small>×${quantity}</small></span>`),
    ...(goods.length > shown.length ? [`<span class="boutique-cost"><small>+${goods.length - shown.length}</small></span>`] : []),
  ];
  if (bill.raidOnly.length > 0) {
    const finds = bill.raidOnly.length === 1 ? 'a raid find' : `${bill.raidOnly.length} raid finds`;
    parts.push(`<span class="boutique-cost${options.held ? ' is-short' : ''}">${parts.length === 0 ? `Needs ${finds}` : `+ ${finds}`}</span>`);
  }
  return `<span class="boutique-costs" role="img" aria-label="${escapeAttribute(lookPriceLine(bill))}">${parts.join('')}</span>`;
}

/** Room on a card for the money and this many materials. */
const CARD_GOODS = 2;

function wholeCard(state: BoutiqueState, entry: WholeLook, index: number): string {
  const on = sameLook(state.trying, entry.look);
  const missing = unownedIn(entry.look, state.owned);
  const bill = billFor(missing);
  const said = missing.length === 0 ? '' : ` ${lookPriceLine(bill)}.`;
  return card({
    index,
    attribute: `data-whole="${entry.id}"`,
    figure: lookFigure(state.sheet(entry.look), { label: entry.name }),
    name: entry.name,
    price: missing.length === 0 ? '' : priceChips(bill, { most: CARD_GOODS }),
    stamp: stamp(on, missing.length === 0),
    help: `${entry.name}: ${entry.note}${said}`,
    selected: on,
  });
}

function pieceCard(state: BoutiqueState, piece: Wearable, index: number): string {
  const look = wearing(state.wearing, piece.id);
  const on = state.trying !== null && Object.values(state.trying).includes(piece.id);
  const owned = state.owned.has(piece.id);
  const sold = !owned && piece.rarity !== 'raid' && piece.rarity !== 'starter';
  const price = owned ? '' : sold ? priceChips(billFor([piece]), { most: CARD_GOODS }) : '<small class="boutique-free px-warning">Raid find</small>';
  const help = `${piece.name}: ${piece.note}${owned ? '' : piece.rarity === 'raid' ? ' Only ever found on a raid.' : ` ${priceLine(piece)}.`}`;
  return card({
    index,
    attribute: `data-wear="${piece.id}"`,
    figure: lookFigure(state.sheet(look), { label: piece.name }),
    name: piece.name,
    price,
    stamp: stamp(on, owned),
    help,
    classes: piece.rarity === 'raid' ? ' is-raid' : '',
    selected: on,
  });
}

/** The mirror: the try-on walking in all four facings, and what it is made of. */
export function mirror(state: BoutiqueState): string {
  return pixelWindow(`<div class="boutique-mirror" data-mirror>${mirrorFigures(state.sheet(state.trying))}</div><div class="boutique-worn" data-worn>${wornRows(state)}</div>`, {
    heading: 'The mirror',
    note: sameLook(state.trying, state.wearing) ? 'You' : 'Trying on',
    className: 'boutique-mirror-window',
  });
}

/** The four walking figures in the mirror, redrawn alone as the cursor moves. */
export function mirrorFigures(sheet: string): string {
  return MIRROR_ROWS.map((row) => lookFigure(sheet, { row, walking: true, label: 'You, in the mirror' })).join('');
}

/**
 * What the mirror's look is made of, piece by piece: owned, or its whole price
 * as the things themselves, with whatever the vault is short of in red.
 */
export function wornRows(state: Pick<BoutiqueState, 'trying' | 'owned' | 'held'>): string {
  const look = state.trying;
  if (!look) {
    return `<p class="px-empty px-wrap">The classic look: the clothes you came to the harbour in.</p>`;
  }
  return LOOK_SLOTS.filter((slot) => slot !== 'body' || look.body)
    .filter((slot) => !(look.body && (slot === 'top' || slot === 'legs')))
    .map((slot) => {
      const piece = wearableById(look[slot] ?? '');
      if (!piece) return '';
      const owned = state.owned.has(piece.id);
      const price = owned ? pixelTag('Yours', 'secure', true) : priceChips(billFor([piece]), { held: state.held });
      return `<div class="boutique-worn-row"><small>${SLOT_WORDS[slot]}</small><strong class="px-name">${piece.name}</strong>${price}</div>`;
    })
    .join('');
}

/** The bar along the foot: what the try-on comes to, as the things themselves, and the one thing to do about it. */
export function commitBar(state: BoutiqueState): string {
  const changed = !sameLook(state.trying, state.wearing);
  const missing = unownedIn(state.trying, state.owned);
  const putBack = `<button class="px-window px-button" data-put-back${changed ? '' : ' aria-disabled="true"'} data-help="Take it all off and put it back on the shelves.">Put it back</button>`;
  const bar = (title: string, middle: string, actions: string): string =>
    `<div class="px-window confirm-bar boutique-bar"><div class="px-bar-head"><strong>${title}</strong>${middle}<div class="px-bar-actions">${actions}</div></div></div>`;
  if (missing.length === 0) {
    const wear = `<button class="px-window px-button is-primary" data-wear-it${changed ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(changed ? 'Wear this look from now on.' : 'You are already wearing this.')}">Wear this</button>`;
    return bar(changed ? 'This all fits' : 'What you have on', changed ? '<small class="boutique-bill">All yours</small>' : '', `${wear}${putBack}`);
  }
  if (state.mode === 'wardrobe') {
    return bar('Not yours yet', `<small class="boutique-bill">From ${BOUTIQUE_NAME}, on THE DOCKS</small>`, putBack);
  }
  const check = checkBill(billFor(missing), { itemCount: state.held });
  const buy = check.refusal
    ? `<button class="px-window px-button is-primary" data-buy aria-disabled="true" data-help="${escapeAttribute(check.why ?? 'Not today.')}">Buy and wear</button>`
    : `<button class="px-window px-button is-primary" data-buy data-help="${escapeAttribute(`Pay ${lookPriceLine(check.bill)} and wear it out of the shop.`)}">Buy and wear</button>`;
  const title = `${missing.length} new piece${missing.length === 1 ? '' : 's'}`;
  return bar(title, `<span class="boutique-bill">${priceChips(check.bill, { held: state.held })}</span>`, `${buy}${putBack}`);
}

/** Whether the shelves show a piece, for whoever is shopping or dressing. */
export function lookOnShelf(state: Pick<BoutiqueState, 'mode' | 'owned'>, pieceId: string): boolean {
  return state.mode === 'shop' || state.owned.has(pieceId);
}
