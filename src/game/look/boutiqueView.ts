/**
 * THE HARBOUR BOUTIQUE and the wardrobe at home, as one screen: the mirror
 * down one side, walking in whatever is being tried on, and the shelves across
 * the rest of the window, every piece on a card of its own worn on the player.
 * Pointing at a card shows it in the mirror; ENTER tries it on and takes the
 * cursor to the bar along the foot, which says what the try-on costs and buys it,
 * or puts it on.
 *
 * The shop sells; the wardrobe only changes into what is owned. Both are the
 * same markup so a piece looks the same in either, and so a player learns one
 * screen. Pure markup, so every word is tested without a browser;
 * `scenes/BoutiqueScene.ts` draws it and wires the keys.
 */
import { formatMoney } from '../items/items';
import { itemIcon } from '../ui/icons';
import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelScreen, pixelWindow } from '../ui/pixelUi';
import { lookKey, sameLook, wearing, type LookSlot, type PlayerLook } from './look';
import { billFor, billLine, checkBill, lookPriceLine, priceLine, SHELF_ORDER, shelfPieces, unownedIn, WHOLE_LOOKS, type WearableBill, type WholeLook } from './wardrobe';
import { BOUTIQUE_NAME, wearableById, WEARABLES, type Wearable } from './wearables';
import { GYM_HONOURS, honourById, type GymHonour, type HonourId } from './gymHonours';

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
  /**
   * A look's sheet as something a page can draw: a data URL of its 64x128 grid,
   * in `honours`, or in the gym honours the player wears when none are named.
   */
  readonly sheet: (look: PlayerLook, honours?: readonly HonourId[]) => string;
  /** The gym honours this save has won, and the ones it has on (`gymHonours.ts`). */
  readonly honours: { readonly earned: readonly HonourId[]; readonly worn: readonly HonourId[] };
  readonly status?: string;
}

/** The shelves' headings, in the order they stand. */
export const SHELF_HEADINGS: Readonly<Record<(typeof SHELF_ORDER)[number], string>> = {
  hat: 'Hats and caps',
  hair: 'Hair',
  top: 'Tops and jackets',
  legs: 'Trousers and shorts',
  outfit: 'Whole outfits',
};

const SLOT_WORDS: Readonly<Record<LookSlot, string>> = {
  head: 'Head',
  top: 'Top',
  legs: 'Bottoms',
  body: 'Outfit',
};

// Short enough to stand whole on the smallest stage's keys line (the harbour re-critic).
export const BOUTIQUE_HINTS = 'ARROWS move · ENTER try on, again to buy · Q E shelf · TAB bar · ESC back';
export const WARDROBE_HINTS = 'ARROWS move · ENTER try on, again to wear · Q E shelf · TAB bar · ESC back';

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

export function boutiqueMarkup(state: BoutiqueState): string {
  const shop = state.mode === 'shop';
  const shelves = shop ? shopShelves(state) : wardrobeShelves(state);
  // The wardrobe counts what is yours, the honours too, and not out of all 209:
  // "3 pieces of 209" said how little a newcomer had (the harbour re-critic).
  const count = shop ? WEARABLES.length : WEARABLES.filter((piece) => state.owned.has(piece.id)).length + state.honours.earned.length;
  const body = `<main class="px-body boutique-layout"><div class="boutique-panes">${mirror(state)}${pixelWindow(
    `${shelfPager(shelves)}<div class="px-list px-scroll boutique-shelves" data-shelves ${pixelColumns(COLUMN_MEASURES.wearable)}>${shelves}</div>`,
    {
      heading: shop ? 'The shelves' : 'Your clothes',
      // The heading counts the looks too, as the MORE strip counts every card:
      // "209 PIECES" over "240 MORE" read as two counts that could not both be
      // right (veteran playtest, 20 Nov 2026).
      note: shop ? `${WHOLE_LOOKS.length + 1} looks · ${count} pieces` : `${count} piece${count === 1 ? '' : 's'} yours`,
      className: 'boutique-shelves-window',
    },
  )}</div>${commitBar(state)}</main>`;
  return pixelScreen({
    title: shop ? BOUTIQUE_NAME : 'Your wardrobe',
    place: shop ? 'The Docks' : 'The Bolthole',
    close: { attribute: 'data-close' },
    // Money only where something is sold: the wardrobe sells nothing (the harbour re-critic).
    ...(shop ? { aside: formatMoney(state.held('money')) } : {}),
    body,
    hints: shop ? BOUTIQUE_HINTS : WARDROBE_HINTS,
    ...(state.status ? { status: state.status } : {}),
  });
}

/**
 * The mirror: the try-on big in the middle, what it has on its head, top and
 * legs on three cards down one side and a full kit on the other, and along
 * the foot what you have on now beside the try-on turning round.
 */
export function mirror(state: BoutiqueState): string {
  const now = lookFigure(state.sheet(state.wearing), { label: 'What you have on now', scale: 2 });
  return pixelWindow(
    `<div class="bq-mirror"><div class="bq-slots" data-worn>${wornRows({ ...state, honours: state.honours.worn })}</div><div class="bq-glass" data-mirror>${mirrorFigures(state.sheet(state.trying))}</div></div>`
      + `<div class="bq-turn"><span class="bq-now" title="What you have on now">${now}</span><span class="bq-to" aria-label="to"></span><span class="bq-turns" data-mirror-turns title="Trying on">${turningFigures(state.sheet(state.trying))}</span></div>`,
    {
      heading: 'The mirror',
      note: sameLook(state.trying, state.wearing) ? 'what you have on' : 'trying on',
      className: 'boutique-mirror-window',
    },
  );
}

/** The try-on in the glass: big, facing out, walking on the spot. */
export function mirrorFigures(sheet: string): string {
  return lookFigure(sheet, { row: 0, walking: true, label: 'You, in the mirror', scale: 4 });
}

/** The try-on turning round: its four facings, small, at the size the screen's room sets (`.bq-turns`). */
export function turningFigures(sheet: string): string {
  return MIRROR_ROWS.map((row) => lookFigure(sheet, { row, label: 'You, turning round' })).join('');
}

/** One part of a look on a card of its own: what is on, and its price when it is not yours. */
function slotCard(slot: LookSlot, piece: Wearable | undefined, owned: ReadonlySet<string>): string {
  // What it costs is the card along the foot's to say; a slot says what is on, and whether it is yours.
  const mine = piece !== undefined && owned.has(piece.id);
  // A part not yours yet has a gold head: gold is a price, and the card at the foot says it.
  const fresh = piece !== undefined && !mine;
  return `<div class="bq-slot${piece ? '' : ' is-empty'}${slot === 'body' ? ' is-kit' : ''}${fresh ? ' is-new' : ''}" title="${escapeAttribute(piece ? `${piece.name}${mine ? '' : `: ${priceLine(piece)}`}` : SLOT_WORDS[slot])}"><span class="bq-slot-head">${SLOT_WORDS[slot]}${fresh ? (piece.rarity === 'raid' ? ' · raid find' : ' · new') : ''}</span><span class="bq-slot-name">${piece ? piece.name : 'None'}</span></div>`;
}

/**
 * What the mirror's look is made of, a card a part: head, top, legs and a full
 * kit, and the gym honours on over it. The classic look is one card of its
 * own: four NONEs under "what you have on" read as wearing nothing, and the
 * honour the player won was nowhere (the harbour re-critic).
 */
export function wornRows(state: Pick<BoutiqueState, 'trying' | 'owned'> & { readonly honours?: readonly HonourId[] }): string {
  const look = state.trying;
  const piece = (slot: LookSlot): Wearable | undefined => wearableById(look?.[slot] ?? '');
  const honours = (state.honours ?? []).flatMap((id) => honourById(id)?.name ?? []);
  const won = honours.length === 0
    ? ''
    : `<div class="bq-slot is-kit" title="${escapeAttribute(honours.join(', '))}"><span class="bq-slot-head">Honours</span><span class="bq-slot-name">${honours.join(', ')}</span></div>`;
  if (!look) {
    return `<div class="bq-slot is-kit" title="The clothes you came to the harbour in"><span class="bq-slot-head">Outfit</span><span class="bq-slot-name">The classic look</span></div>${won}`;
  }
  const kit = piece('body');
  return [
    slotCard('head', piece('head'), state.owned),
    slotCard('top', kit ? undefined : piece('top'), state.owned),
    slotCard('legs', kit ? undefined : piece('legs'), state.owned),
    slotCard('body', kit, state.owned),
  ].join('') + won;
}

/** The short word each shelf's jump chip says, by the shelf it goes to. */
export const SHELF_JUMPS: Readonly<Record<string, string>> = {
  looks: 'Looks',
  hat: 'Hats',
  hair: 'Hair',
  top: 'Tops',
  legs: 'Bottoms',
  outfit: 'Outfits',
  raid: 'Raid finds',
  honours: 'Honours',
};

/**
 * Which shelf Page Down or Page Up goes to, from the shelf the cursor is in:
 * Down is always the next one; Up is the start of this one, or the one before
 * when the cursor is already at its start. Held at both ends.
 */
export function shelfStep(current: number, atStart: boolean, count: number, direction: 1 | -1): number {
  if (direction === 1) return Math.min(count - 1, current + 1);
  return atStart ? Math.max(0, current - 1) : current;
}

/** A shelf's heading, marked so the pager can find it. */
function shelfHeading(key: string, words: string): string {
  return `<h3 class="px-subheading" data-shelf="${key}">${words}</h3>`;
}

/** A shelf: its heading and its cards, shown one shelf at a time (`BoutiqueScene.showShelf`). */
function shelfGroup(key: string, words: string, inner: string): string {
  return `<div class="boutique-shelf" data-shelf-group="${key}">${shelfHeading(key, words)}${inner}</div>`;
}

/**
 * The pager over the shelves: the shelf on show between two arrows that walk
 * to the one before and after (Q and E, or Page Up and Page Down), and where
 * it stands among them - one shelf at a time, as FireRed's PC walks its boxes,
 * so the shelves never scroll to a sliver of a card. Every shelf's name is in
 * it, and the scene shows the one the cursor is in.
 */
export function shelfPager(shelves: string): string {
  const keys = [...shelves.matchAll(/data-shelf-group="([a-z]+)"/g)].map((match) => match[1]);
  const names = keys.map((key, index) => `<span class="bq-pager-name" data-pager-name="${key}"${index === 0 ? '' : ' hidden'}>${SHELF_JUMPS[key]}<small> ${index + 1} of ${keys.length}</small></span>`).join('');
  return `<div class="bq-pager"><button class="px-window px-chip bq-step" data-shelf-step="-1" aria-label="The shelf before" data-help="The shelf before. Q or Page Up does the same.">Q</button>${names}<button class="px-window px-chip bq-step" data-shelf-step="1" aria-label="The next shelf" data-help="The next shelf. E or Page Down does the same.">E</button></div>`;
}

function shopShelves(state: BoutiqueState): string {
  const looks = shelfGroup('looks', 'Whole looks', `${classicCard(state)}${WHOLE_LOOKS.map((entry) => wholeCard(state, entry)).join('')}`);
  const shelves = SHELF_ORDER.map((kind) =>
    shelfGroup(kind, SHELF_HEADINGS[kind], shelfPieces(kind, false).map((piece) => pieceCard(state, piece)).join('')),
  ).join('');
  const raid = WEARABLES.filter((piece) => piece.rarity === 'raid');
  const found = shelfGroup('raid', 'Found on raids', raid.map((piece) => pieceCard(state, piece)).join(''));
  return `${looks}${shelves}${found}${honourShelf(state)}`;
}

/**
 * The gym honours (`gymHonours.ts`): in the wardrobe, the ones won, each put on
 * or taken off by ENTER; in the shop, every one, on the player, with whom it is
 * won from - never sold, and the shop is where a player learns they exist.
 */
function honourShelf(state: BoutiqueState): string {
  const shop = state.mode === 'shop';
  const shown = shop ? GYM_HONOURS : GYM_HONOURS.filter((honour) => state.honours.earned.includes(honour.id));
  if (shown.length === 0) return '';
  return shelfGroup('honours', 'Gym honours', shown.map((honour) => honourCard(state, honour)).join(''));
}

/**
 * The honours the mirror shows with the cursor on an honour's card: in the
 * shop, it put on, to see; in the wardrobe, what is worn now - the card says
 * whether it is on, and ENTER changes it in the mirror and on the card at once.
 */
export function honoursIfChosen(state: Pick<BoutiqueState, 'mode' | 'honours'>, id: HonourId): readonly HonourId[] {
  const { worn } = state.honours;
  return state.mode === 'wardrobe' ? worn : [...worn.filter((each) => each !== id), id];
}

function honourCard(state: BoutiqueState, honour: GymHonour): string {
  const earned = state.honours.earned.includes(honour.id);
  const worn = state.honours.worn.includes(honour.id);
  const leader = honour.leader.toUpperCase();
  const shop = state.mode === 'shop';
  const line = !earned ? `Beat ${leader}` : shop ? `${leader}'s · Yours` : `${leader}'s · ${worn ? 'On' : 'Off'}`;
  const help = !earned
    ? `${honour.name}: ${honour.note} Not for sale: ${leader} gives it to whoever beats them.`
    : shop
      ? `${honour.name}: won from ${leader}. Put it on or take it off at YOUR WARDROBE.`
      : `${honour.name}: won from ${leader}. ${worn ? 'Everybody sees you wear it. ENTER takes it off.' : 'Taken off, so nobody sees it. ENTER puts it back on.'}`;
  const look = earned && (shop || worn) ? ' is-honour' : earned ? ' is-honour-off' : '';
  const start = state.mode === 'wardrobe' && state.honours.earned[0] === honour.id ? ' data-cursor-start' : '';
  return `<button class="px-window px-card boutique-card${look}" data-honour="${honour.id}"${start} data-help="${escapeAttribute(help)}">${lookFigure(state.sheet(state.wearing, [honour.id]), { label: honour.name })}<strong>${honour.name}</strong><small class="px-wrap${earned ? ' px-note' : ''}">${line}</small></button>`;
}

function wardrobeShelves(state: BoutiqueState): string {
  const looks = WHOLE_LOOKS.filter((entry) => unownedIn(entry.look, state.owned).length === 0);
  const head = `${honourShelf(state)}${shelfGroup('looks', 'Whole looks', `${classicCard(state)}${looks.map((entry) => wholeCard(state, entry)).join('')}`)}`;
  const shelves = SHELF_ORDER.map((kind) => {
    const pieces = WEARABLES.filter((piece) => piece.kind === kind && state.owned.has(piece.id));
    return pieces.length === 0 ? '' : shelfGroup(kind, SHELF_HEADINGS[kind], pieces.map((piece) => pieceCard(state, piece)).join(''));
  }).join('');
  return `${head}${shelves}`;
}

function classicCard(state: BoutiqueState): string {
  const on = state.trying === null;
  const help = 'The clothes you came to the harbour in. Free, and always yours.';
  const start = state.mode === 'wardrobe' && state.honours.earned.length > 0 ? '' : ' data-cursor-start';
  return `<button class="px-window px-card boutique-card${on ? ' is-selected' : ''}" data-classic${start} data-help="${escapeAttribute(help)}">${lookFigure(state.sheet(null), { label: 'The classic look' })}<strong>The classic look</strong><small class="px-wrap">${on ? 'On in the mirror' : 'Always yours'}</small></button>`;
}

/**
 * A card's price as the things themselves: the money, then each material as
 * its icon and a count, as the workshop's cards show theirs. Said in words it
 * ran to three centred lines on a card ("₽400 and 10 Linen rolls, 6 Mooring
 * ropes and 4 Radio valves"); the words stay on the help bar and for a reader.
 */
function priceChips(bill: WearableBill): string {
  const parts = [
    ...(bill.money > 0 ? [`<span class="boutique-cost is-money">${formatMoney(bill.money)}</span>`] : []),
    ...Object.entries(bill.goods).map(
      ([itemId, quantity]) => `<span class="boutique-cost">${itemIcon(itemId)}<small>×${quantity}</small></span>`,
    ),
  ];
  if (bill.raidOnly.length > 0) {
    const finds = bill.raidOnly.length === 1 ? 'a raid find' : `${bill.raidOnly.length} raid finds`;
    parts.push(`<span class="boutique-cost">${parts.length === 0 ? `Needs ${finds}` : `+ ${finds}`}</span>`);
  }
  return `<span class="boutique-costs" role="img" aria-label="${escapeAttribute(lookPriceLine(bill))}">${parts.join('')}</span>`;
}

function wholeCard(state: BoutiqueState, entry: WholeLook): string {
  const on = sameLook(state.trying, entry.look);
  const missing = unownedIn(entry.look, state.owned);
  const bill = billFor(missing);
  const price = missing.length === 0 ? '<small class="px-wrap">All yours</small>' : priceChips(bill);
  const said = missing.length === 0 ? '' : ` ${lookPriceLine(bill)}.`;
  return `<button class="px-window px-card boutique-card${on ? ' is-selected' : ''}" data-whole="${entry.id}" data-help="${escapeAttribute(`${entry.name}: ${entry.note}${said}`)}">${lookFigure(state.sheet(entry.look), { label: entry.name })}<strong>${entry.name}</strong>${price}</button>`;
}

function pieceCard(state: BoutiqueState, piece: Wearable): string {
  const look = wearing(state.wearing, piece.id);
  const on = state.trying !== null && Object.values(state.trying).includes(piece.id);
  const owned = state.owned.has(piece.id);
  const sold = !owned && piece.rarity !== 'raid' && piece.rarity !== 'starter';
  const line = owned ? (Object.values(state.wearing ?? {}).includes(piece.id) ? 'Yours · on' : 'Yours') : priceLine(piece);
  const help = `${piece.name}: ${piece.note}${owned ? '' : piece.rarity === 'raid' ? ' Only ever found on a raid.' : ` ${priceLine(piece)}.`}`;
  return `<button class="px-window px-card boutique-card${on ? ' is-selected' : ''}${piece.rarity === 'raid' ? ' is-raid' : ''}" data-wear="${piece.id}" data-help="${escapeAttribute(help)}">${lookFigure(state.sheet(look), { label: piece.name })}<strong>${piece.name}</strong>${sold ? priceChips(billFor([piece])) : `<small class="px-wrap${owned ? ' px-note' : ''}">${line}</small>`}</button>`;
}

/** A button with its key inside it, as every button in the look says it. */
function keyed(attributes: string, key: string, words: string, primary = false): string {
  return `<button class="px-window px-button${primary ? ' is-primary' : ''} bq-key" ${attributes}><span class="px-keycap">${key}</span>${words}</button>`;
}

/**
 * What the try-on costs, as the things themselves: the money, and each of the
 * goods a barter asks for, each with how many you have under it - green when
 * there is enough, grey when not.
 */
function takesTags(bill: WearableBill, held: (itemId: string) => number): string {
  const tag = (picture: string, amount: string, have: number, enough: boolean): string =>
    `<span class="bq-take${enough ? ' is-enough' : ' is-short'}">${picture}<span class="bq-take-amount">${amount}</span><span class="bq-have">Have ${have}</span></span>`;
  const money = held('money');
  return [
    ...(bill.money > 0 ? [tag(itemIcon('money'), formatMoney(bill.money), money, money >= bill.money).replace(`Have ${money}`, `Have ${formatMoney(money)}`)] : []),
    ...Object.entries(bill.goods).map(([itemId, quantity]) => tag(itemIcon(itemId), `×${quantity}`, held(itemId), held(itemId) >= quantity)),
  ].join('');
}

/**
 * The card along the foot: what the try-on is made of that is not yours yet,
 * what it takes, and the one thing to do about it.
 */
export function commitBar(state: BoutiqueState): string {
  const changed = !sameLook(state.trying, state.wearing);
  const missing = unownedIn(state.trying, state.owned);
  const putBack = `<button class="px-window px-button bq-key" data-put-back${changed ? '' : ' aria-disabled="true"'} data-help="Take it all off and put it back on the shelves.">Put it back</button>`;
  const card = (title: string, note: string, inner: string, tone = ''): string =>
    `<section class="px-window confirm-bar bq-takes${tone}"><header class="px-heading"><span>${title}</span><small>${note}</small></header>${inner}</section>`;
  if (missing.length === 0) {
    return card(
      changed ? 'This all fits' : 'What you have on',
      changed ? 'All yours' : '',
      `<div class="bq-takes-body"><div class="bq-actions">${keyed(`data-wear-it${changed ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(changed ? 'Wear this look from now on.' : 'You are already wearing this.')}"`, 'ENTER', 'Wear this', true)}${putBack}</div></div>`,
    );
  }
  const names = missing.map((piece) => piece.name).join(', ');
  if (state.mode === 'wardrobe') {
    return card('Not yours yet', '', `<div class="bq-takes-body"><p class="px-wrap bq-takes-line">${names}: from ${BOUTIQUE_NAME}, on THE DOCKS.</p><div class="bq-actions">${putBack}</div></div>`);
  }
  const check = checkBill(billFor(missing), { itemCount: state.held });
  const buy = check.refusal
    ? keyed(`data-buy aria-disabled="true" data-help="${escapeAttribute(check.why ?? 'Not today.')}"`, 'ENTER', 'Buy', true)
    : keyed(`data-buy data-help="${escapeAttribute(`Pay ${billLine(check.bill)} and wear it out of the shop.`)}"`, 'ENTER', 'Buy', true);
  return card(
    names,
    'It takes',
    `<div class="bq-takes-body"><div class="bq-takes-tags">${takesTags(check.bill, state.held)}</div>`
      + `<p class="px-wrap bq-takes-line${check.refusal ? ' px-warning' : ''}">${check.refusal ? (check.why ?? '') : `Comes to ${billLine(check.bill)}.`}</p>`
      + `<div class="bq-actions">${buy}${putBack}</div></div>`,
    ' is-gold',
  );
}

/** Whether the shelves show a piece, for whoever is shopping or dressing. */
export function lookOnShelf(state: Pick<BoutiqueState, 'mode' | 'owned'>, pieceId: string): boolean {
  return state.mode === 'shop' || state.owned.has(pieceId);
}

/** The mirror's key, so the scene redraws only what changed. */
export function mirrorKey(look: PlayerLook): string {
  return lookKey(look);
}
