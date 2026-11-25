import { describe, expect, it } from 'vitest';
import {
  boutiqueMarkup,
  CARD_GAP,
  CARD_HEIGHT,
  CARD_MIN_WIDTH,
  commitBar,
  gridMove,
  pageCount,
  pageShape,
  pageWords,
  priceChips,
  shelfPage,
  shelvesFor,
  wornRows,
  type BoutiqueState,
  type ShelfView,
} from './boutiqueView';
import { STARTER_LOOK, wearing } from './look';
import { billFor, ownedWearables, WHOLE_LOOKS } from './wardrobe';
import { BOUTIQUE_NAME, wearableById, WEARABLES } from './wearables';

function state(overrides: Partial<BoutiqueState> = {}): BoutiqueState {
  return {
    mode: 'shop',
    trying: null,
    wearing: null,
    owned: ownedWearables([]),
    held: (itemId) => ({ money: 500 })[itemId] ?? 0,
    sheet: () => 'data:,',
    ...overrides,
  };
}

const VIEW: ShelfView = { shelf: 0, page: 0, perPage: 12, columns: 4 };

const cards = (markup: string, attribute: string): string[] =>
  [...markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map((match) => match[1]);

const cardIds = (shelf: ReturnType<typeof shelvesFor>[number]): string[] =>
  shelf.cards.map((card) => (card.kind === 'classic' ? 'classic' : card.kind === 'whole' ? card.look.id : card.piece.id));

describe("the boutique's shelves", () => {
  it('puts every piece on a shelf of its kind, and the raid finds on a shelf of their own', () => {
    const shelves = shelvesFor(state());
    expect(shelves.map((shelf) => shelf.tab)).toEqual(['Looks', 'Hats', 'Hair', 'Tops', 'Bottoms', 'Outfits', 'Raid finds']);
    const pieces = shelves.slice(1).flatMap(cardIds);
    expect(pieces.sort()).toEqual(WEARABLES.map((piece) => piece.id).sort());
    expect(cardIds(shelves[0])).toEqual(['classic', ...WHOLE_LOOKS.map((look) => look.id)]);
    expect(shelves.at(-1)?.cards.every((card) => card.kind === 'piece' && card.piece.rarity === 'raid')).toBe(true);
  });

  it('shows the wardrobe only the shelves something owned stands on, and only what is owned', () => {
    const shelves = shelvesFor(state({ mode: 'wardrobe', owned: ownedWearables(['red-cap']) }));
    expect(shelves.map((shelf) => shelf.key)).toEqual(['looks', 'hat', 'hair', 'top', 'legs']);
    expect(shelves.slice(1).flatMap(cardIds).sort()).toEqual(['plain-tee', 'plain-trousers', 'red-cap', 'short-crop']);
  });

  it('counts each shelf on its tab, and says the page over the shelf only when there is more than one', () => {
    const markup = boutiqueMarkup(state(), VIEW);
    const shelves = shelvesFor(state());
    expect(markup).toContain(`Looks<small>${shelves[0].cards.length}</small>`);
    expect(markup).toContain(`Raid<span class="boutique-tab-more"> finds</span><small>`);
    expect(markup).toContain(`Page 1 of ${pageCount(shelves[0].cards.length, 12)}`);
    expect(pageWords({ cards: shelves[5].cards }, { page: 0, perPage: 100 })).toBe('');
  });

  it('draws one page of the shelf that is out, and no other card', () => {
    const shelves = shelvesFor(state());
    const view = { ...VIEW, shelf: 2, page: 1 };
    const page = shelfPage(state(), shelves[2], view);
    expect(cards(page, 'data-wear')).toEqual(cardIds(shelves[2]).slice(12, 24));
    expect(cards(page, 'data-index')).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']);
    // The screen holds the same page, and nothing from the shelves beside it.
    expect(cards(boutiqueMarkup(state(), view), 'data-wear')).toEqual(cardIds(shelves[2]).slice(12, 24));
  });

  it('names the shop and its place, and how much the vault holds', () => {
    const markup = boutiqueMarkup(state(), VIEW);
    expect(markup).toContain(BOUTIQUE_NAME);
    expect(markup).toContain('The Docks');
    expect(markup).toContain('₽500 in the vault');
  });

  it('keeps its keys on a line of their own, whatever the help line says', () => {
    expect(boutiqueMarkup(state(), VIEW)).toMatch(/<span class="px-keys">ARROWS choose[^<]*ESC leave<\/span>/);
    expect(boutiqueMarkup(state({ mode: 'wardrobe' }), VIEW)).toMatch(/<span class="px-keys">[^<]*then wear[^<]*<\/span>/);
  });
});

describe('a page of cards', () => {
  it('holds as many whole cards as the room does, and at least one', () => {
    // The shelf at 1280x800: four across and three down.
    expect(pageShape(442, 256, { height: CARD_HEIGHT, minWidth: CARD_MIN_WIDTH, gap: CARD_GAP })).toEqual({ columns: 4, rows: 3 });
    expect(pageShape(10, 10, { height: CARD_HEIGHT, minWidth: CARD_MIN_WIDTH, gap: CARD_GAP })).toEqual({ columns: 1, rows: 1 });
    expect(pageCount(0, 12)).toBe(1);
    expect(pageCount(78, 12)).toBe(7);
  });

  const shelf = { count: 30, perPage: 12, columns: 4 };

  it('walks a row with Left and Right, over the edge onto the next page or the last', () => {
    expect(gridMove({ page: 0, index: 5 }, 'right', shelf)).toEqual({ to: 'card', page: 0, index: 6, turned: 0 });
    // The end of the middle row goes on to the start of the same row over the page.
    expect(gridMove({ page: 0, index: 7 }, 'right', shelf)).toEqual({ to: 'card', page: 1, index: 4, turned: 1 });
    expect(gridMove({ page: 1, index: 4 }, 'left', shelf)).toEqual({ to: 'card', page: 0, index: 7, turned: -1 });
    // The last page holds 6: a row it does not have lands on its last card.
    expect(gridMove({ page: 1, index: 11 }, 'right', shelf)).toEqual({ to: 'card', page: 2, index: 5, turned: 1 });
  });

  it('never wraps: the first card and the last stay put', () => {
    expect(gridMove({ page: 0, index: 0 }, 'left', shelf)).toEqual({ to: 'stay' });
    expect(gridMove({ page: 2, index: 5 }, 'right', shelf)).toEqual({ to: 'stay' });
  });

  it('goes up from the top row to the tabs, and down from the bottom row to the bar', () => {
    expect(gridMove({ page: 1, index: 2 }, 'up', shelf)).toEqual({ to: 'tabs' });
    expect(gridMove({ page: 1, index: 6 }, 'up', shelf)).toEqual({ to: 'card', page: 1, index: 2, turned: 0 });
    expect(gridMove({ page: 0, index: 9 }, 'down', shelf)).toEqual({ to: 'bar' });
    // A short last page's bottom row is its own, and a column it lacks is its last card.
    expect(gridMove({ page: 2, index: 3 }, 'down', shelf)).toEqual({ to: 'card', page: 2, index: 5, turned: 0 });
    expect(gridMove({ page: 2, index: 5 }, 'down', shelf)).toEqual({ to: 'bar' });
  });
});

describe('a price', () => {
  it('is the money and the materials themselves, at most two of them on a card', () => {
    const look = WHOLE_LOOKS.find((entry) => entry.id === 'champion-red')!;
    const bill = billFor(Object.values(look.look ?? {}).flatMap((id) => (id ? [wearableById(id)!] : [])));
    const goods = Object.keys(bill.goods).length;
    expect(goods).toBeGreaterThan(2);
    const card = priceChips(bill, { most: 2 });
    expect(card.match(/class="item-icon"/g)).toHaveLength(2);
    expect(card).toContain(`+${goods - 2}`);
    // Said whole for a reader.
    expect(card).toMatch(/aria-label="₽\d+ and /);
  });

  it('prices a whole look with a raid find in it as needing the find (the arenas hunt, finding 3)', () => {
    const markup = shelfPage(state(), shelvesFor(state())[0], { page: 0, perPage: 100 });
    const card = (source: string, id: string): string => {
      const start = source.indexOf(`data-whole="${id}"`);
      return source.slice(start, source.indexOf('</button>', start));
    };
    expect(card(markup, 'mon-mewtwo')).toMatch(/aria-label="₽\d+ \+ a raid find"/);
    expect(card(markup, 'mon-mewtwo')).toContain('<span class="boutique-cost">+ a raid find</span>');
    // Bought everything but the robe: the card needs only the find.
    const all = ownedWearables(WEARABLES.filter((piece) => piece.rarity !== 'raid').map((piece) => piece.id));
    const owned = shelfPage(state({ owned: all }), shelvesFor(state({ owned: all }))[0], { page: 0, perPage: 100 });
    expect(card(owned, 'mon-mewtwo')).toContain('<span class="boutique-cost">Needs a raid find</span>');
  });

  it('marks in red what the vault is short of, under the mirror and on the bar', () => {
    const gown = wearing(STARTER_LOOK, 'beauty-gown');
    expect(wornRows({ trying: gown, owned: ownedWearables([]), held: () => 0 })).toContain('boutique-cost is-short');
    expect(wornRows({ trying: gown, owned: ownedWearables([]), held: () => 99_999 })).not.toContain('is-short');
  });

  it('stamps what is already owned rather than pricing it', () => {
    const markup = shelfPage(state(), shelvesFor(state())[2], { page: 0, perPage: 100 });
    const start = markup.indexOf('data-wear="short-crop"');
    const crop = markup.slice(start, markup.indexOf('</button>', start));
    expect(crop).toContain('Yours');
    expect(crop).not.toContain('boutique-costs');
  });
});

describe('the bar along the foot', () => {
  it('prices a try-on, and offers to buy it only when the vault can pay', () => {
    const coat = wearing(STARTER_LOOK, 'lab-coat');
    expect(commitBar(state({ trying: coat }))).toContain('₽400');
    expect(commitBar(state({ trying: coat }))).not.toMatch(/data-buy aria-disabled/);
    const gown = wearing(STARTER_LOOK, 'beauty-gown');
    expect(commitBar(state({ trying: gown }))).toMatch(/data-buy aria-disabled="true"/);
    // Why, for the help line, and the money in red on the bar.
    expect(commitBar(state({ trying: gown }))).toContain('That comes to ₽1500, and you have ₽500.');
    expect(commitBar(state({ trying: gown }))).toContain('<span class="boutique-cost is-short">₽1500</span>');
  });

  it('never sells a raid find, however much is in the vault', () => {
    const bar = commitBar(state({ trying: wearing(STARTER_LOOK, 'zapdos-jacket'), held: () => 99_999 }));
    expect(bar).toMatch(/data-buy aria-disabled="true"/);
    expect(bar).toContain('turn up on raids');
  });

  it('wears what is owned without a till, and puts back a try-on', () => {
    const bar = commitBar(state({ trying: STARTER_LOOK }));
    expect(bar).toContain('data-wear-it');
    expect(bar).not.toContain('data-buy');
    expect(bar).not.toMatch(/data-put-back aria-disabled/);
    expect(commitBar(state())).toMatch(/data-put-back aria-disabled="true"/);
  });
});
