/**
 * THE HARBOUR BOUTIQUE and the wardrobe at home, as one screen: the mirror
 * down one side, walking in whatever is being tried on, and the shelves across
 * the rest of the window, every piece on a card of its own worn on the player.
 * Pointing at a card shows it in the mirror; ENTER tries it on; the bar along
 * the foot says what the try-on costs and buys it, or puts it on.
 *
 * The shop sells; the wardrobe only changes into what is owned. Both are the
 * same markup so a piece looks the same in either, and so a player learns one
 * screen. Pure markup, so every word is tested without a browser;
 * `scenes/BoutiqueScene.ts` draws it and wires the keys.
 */
import { formatMoney } from '../items/items';
import { COLUMN_MEASURES, escapeAttribute, pixelColumns, pixelCommitBar, pixelScreen, pixelTag, pixelWindow } from '../ui/pixelUi';
import { lookKey, LOOK_SLOTS, sameLook, wearing, type LookSlot, type PlayerLook } from './look';
import { billFor, billLine, checkBill, priceLine, SHELF_ORDER, shelfPieces, unownedIn, WHOLE_LOOKS, type WholeLook } from './wardrobe';
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

export const BOUTIQUE_HINTS = 'ARROWS look along the shelves · ENTER try it on · ESC leave';
export const WARDROBE_HINTS = 'ARROWS look through your clothes · ENTER put it on · ESC close the wardrobe';

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
  const jumps = shelfJumps(shelves);
  const count = shop ? WEARABLES.length : WEARABLES.filter((piece) => state.owned.has(piece.id)).length;
  const body = `<main class="px-body boutique-layout"><div class="boutique-panes">${mirror(state)}${pixelWindow(
    `${jumps}<div class="px-list px-scroll boutique-shelves" data-shelves ${pixelColumns(COLUMN_MEASURES.wearable)}>${shelves}</div>`,
    {
      heading: shop ? 'The shelves' : 'Your clothes',
      note: shop ? `${count} pieces` : `${count} piece${count === 1 ? '' : 's'} of ${WEARABLES.length}`,
      className: 'boutique-shelves-window',
    },
  )}</div>${commitBar(state)}</main>`;
  return pixelScreen({
    title: shop ? BOUTIQUE_NAME : 'Your wardrobe',
    place: shop ? 'The Green' : 'The Bolthole',
    back: { label: shop ? 'Shop' : 'Bedroom', attribute: 'data-close' },
    aside: `${formatMoney(state.held('money'))} in the vault`,
    body,
    hints: shop ? BOUTIQUE_HINTS : WARDROBE_HINTS,
    ...(state.status ? { status: state.status } : {}),
  });
}

/** The mirror: the try-on walking in all four facings, and what it is made of. */
export function mirror(state: BoutiqueState): string {
  return pixelWindow(`<div class="boutique-mirror" data-mirror>${mirrorFigures(state.sheet(state.trying))}</div><div class="px-list px-scroll boutique-worn" data-worn data-reads tabindex="-1">${wornRows(state)}</div>`, {
    heading: 'The mirror',
    note: sameLook(state.trying, state.wearing) ? 'what you have on' : 'trying on',
    className: 'boutique-mirror-window',
  });
}

/** The four walking figures in the mirror, redrawn alone as the cursor moves. */
export function mirrorFigures(sheet: string): string {
  return MIRROR_ROWS.map((row) => lookFigure(sheet, { row, walking: true, label: 'You, in the mirror' })).join('');
}

/** What the mirror's look is made of, piece by piece, owned or priced. */
export function wornRows(state: Pick<BoutiqueState, 'trying' | 'owned'>): string {
  const look = state.trying;
  if (!look) {
    return `<p class="px-empty px-wrap">The classic look: the clothes you came to the harbour in.</p>`;
  }
  return LOOK_SLOTS.filter((slot) => slot !== 'body' || look.body)
    .filter((slot) => !(look.body && (slot === 'top' || slot === 'legs')))
    .map((slot) => {
      const piece = wearableById(look[slot] ?? '');
      if (!piece) return '';
      // Owned is a tag; a price goes under the name, where a barter's goods have room to wrap.
      const owned = state.owned.has(piece.id);
      const price = owned ? '' : `<small class="px-wrap${piece.rarity === 'raid' ? ' px-warning' : ''}">${priceLine(piece)}</small>`;
      return `<div class="px-row boutique-worn-row"><span class="px-row-main"><small>${SLOT_WORDS[slot]}</small><strong class="px-name">${piece.name}</strong>${price}</span>${owned ? pixelTag('Yours', 'secure', true) : ''}</div>`;
    })
    .join('');
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

/** A shelf's heading, marked so its jump chip can find it. */
function shelfHeading(key: string, words: string): string {
  return `<h3 class="px-subheading" data-shelf="${key}">${words}</h3>`;
}

/**
 * A chip for every shelf the screen shows, over the shelves: ENTER on one takes
 * the cursor to that shelf's first card, so the last shelf of two hundred
 * pieces is one press away rather than a long walk down the list.
 */
function shelfJumps(shelves: string): string {
  const keys = [...shelves.matchAll(/data-shelf="([a-z]+)"/g)].map((match) => match[1]);
  const chips = keys
    .map(
      (key) =>
        `<button class="px-window px-chip" data-jump="${key}" data-help="${escapeAttribute(`Go to ${SHELF_JUMPS[key]}. Page Down and Page Up go a shelf at a time.`)}">${SHELF_JUMPS[key]}</button>`,
    )
    .join('');
  return `<div class="boutique-jumps">${chips}</div>`;
}

function shopShelves(state: BoutiqueState): string {
  const looks = `${shelfHeading('looks', 'Whole looks')}${classicCard(state)}${WHOLE_LOOKS.map((entry) => wholeCard(state, entry)).join('')}`;
  const shelves = SHELF_ORDER.map(
    (kind) => `${shelfHeading(kind, SHELF_HEADINGS[kind])}${shelfPieces(kind, false).map((piece) => pieceCard(state, piece)).join('')}`,
  ).join('');
  const raid = WEARABLES.filter((piece) => piece.rarity === 'raid');
  const found = `${shelfHeading('raid', 'Found on raids')}<p class="px-note px-wrap">Never on a shelf: legendary colours and shiny ones turn up on raids. Try them on all the same.</p>${raid.map((piece) => pieceCard(state, piece)).join('')}`;
  return `${looks}${shelves}${found}`;
}

function wardrobeShelves(state: BoutiqueState): string {
  const looks = WHOLE_LOOKS.filter((entry) => unownedIn(entry.look, state.owned).length === 0);
  const head = `${shelfHeading('looks', 'Whole looks')}${classicCard(state)}${looks.map((entry) => wholeCard(state, entry)).join('')}`;
  const shelves = SHELF_ORDER.map((kind) => {
    const pieces = WEARABLES.filter((piece) => piece.kind === kind && state.owned.has(piece.id));
    return pieces.length === 0 ? '' : `${shelfHeading(kind, SHELF_HEADINGS[kind])}${pieces.map((piece) => pieceCard(state, piece)).join('')}`;
  }).join('');
  const more = WEARABLES.length - WEARABLES.filter((piece) => state.owned.has(piece.id)).length;
  const tail = more > 0 ? `<p class="px-note px-wrap">${more} more on the shelves of ${BOUTIQUE_NAME}, at the top of THE GREEN, and a few that only turn up on raids.</p>` : '';
  return `${head}${shelves}${tail}`;
}

function classicCard(state: BoutiqueState): string {
  const on = state.trying === null;
  const help = 'The clothes you came to the harbour in. Free, and always yours.';
  return `<button class="px-window px-card boutique-card${on ? ' is-selected' : ''}" data-classic data-cursor-start data-help="${escapeAttribute(help)}">${lookFigure(state.sheet(null), { label: 'The classic look' })}<strong>The classic look</strong><small class="px-wrap">${on ? 'On in the mirror' : 'Free'}</small></button>`;
}

function wholeCard(state: BoutiqueState, entry: WholeLook): string {
  const on = sameLook(state.trying, entry.look);
  const missing = unownedIn(entry.look, state.owned);
  const price = missing.length === 0 ? 'All yours' : billLine(billFor(missing));
  return `<button class="px-window px-card boutique-card${on ? ' is-selected' : ''}" data-whole="${entry.id}" data-help="${escapeAttribute(`${entry.name}: ${entry.note}`)}">${lookFigure(state.sheet(entry.look), { label: entry.name })}<strong>${entry.name}</strong><small class="px-wrap">${price}</small></button>`;
}

function pieceCard(state: BoutiqueState, piece: Wearable): string {
  const look = wearing(state.wearing, piece.id);
  const on = state.trying !== null && Object.values(state.trying).includes(piece.id);
  const owned = state.owned.has(piece.id);
  const line = owned ? 'Yours' : priceLine(piece);
  const help = `${piece.name}: ${piece.note}${owned ? '' : piece.rarity === 'raid' ? ' Only ever found on a raid.' : ` ${priceLine(piece)}.`}`;
  return `<button class="px-window px-card boutique-card${on ? ' is-selected' : ''}${piece.rarity === 'raid' ? ' is-raid' : ''}" data-wear="${piece.id}" data-help="${escapeAttribute(help)}">${lookFigure(state.sheet(look), { label: piece.name })}<strong>${piece.name}</strong><small class="px-wrap${owned ? ' px-note' : ''}">${line}</small></button>`;
}

/** The bar along the foot: what the try-on costs, and the one thing to do about it. */
export function commitBar(state: BoutiqueState): string {
  const changed = !sameLook(state.trying, state.wearing);
  const missing = unownedIn(state.trying, state.owned);
  const putBack = `<button class="px-window px-button" data-put-back${changed ? '' : ' aria-disabled="true"'} data-help="Take it all off and put it back on the shelves.">Put it back</button>`;
  if (missing.length === 0) {
    return pixelCommitBar({
      title: changed ? 'This all fits' : 'What you have on',
      lines: [`<small class="px-wrap">${changed ? 'Everything in the mirror is yours. Put it on and walk out in it.' : 'Try something on from the shelves: it shows in the mirror first.'}</small>`],
      actions: `<button class="px-window px-button is-primary" data-wear-it${changed ? '' : ' aria-disabled="true"'} data-help="${escapeAttribute(changed ? 'Wear this look from now on.' : 'You are already wearing this.')}">Wear this</button>${putBack}`,
    });
  }
  const check = checkBill(billFor(missing), { itemCount: state.held });
  const names = missing.map((piece) => piece.name).join(', ');
  if (state.mode === 'wardrobe') {
    return pixelCommitBar({
      title: 'Not yours yet',
      lines: [`<small class="px-wrap">${names}: from ${BOUTIQUE_NAME}, at the top of THE GREEN.</small>`],
      actions: putBack,
    });
  }
  const buy = check.refusal
    ? `<button class="px-window px-button is-primary" data-buy aria-disabled="true" data-help="${escapeAttribute(check.why ?? 'Not today.')}">Buy and wear</button>`
    : `<button class="px-window px-button is-primary" data-buy data-help="${escapeAttribute(`Pay ${billLine(check.bill)} and wear it out of the shop.`)}">Buy and wear</button>`;
  return pixelCommitBar({
    title: `Trying on ${missing.length} new piece${missing.length === 1 ? '' : 's'}`,
    lines: [
      `<small class="px-wrap">${names}</small>`,
      `<small class="px-wrap${check.refusal ? ' px-warning' : ''}">${check.refusal ? (check.why ?? '') : `Comes to ${billLine(check.bill)}.`}</small>`,
    ],
    actions: `${buy}${putBack}`,
  });
}

/** Whether the shelves show a piece, for whoever is shopping or dressing. */
export function lookOnShelf(state: Pick<BoutiqueState, 'mode' | 'owned'>, pieceId: string): boolean {
  return state.mode === 'shop' || state.owned.has(pieceId);
}

/** The mirror's key, so the scene redraws only what changed. */
export function mirrorKey(look: PlayerLook): string {
  return lookKey(look);
}
