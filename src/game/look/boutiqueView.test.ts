import { describe, expect, it } from 'vitest';
import { boutiqueMarkup, commitBar, honoursIfChosen, shelfStep, type BoutiqueState } from './boutiqueView';
import { GYM_HONOURS } from './gymHonours';
import { STARTER_LOOK, wearing } from './look';
import { ownedWearables } from './wardrobe';
import { BOUTIQUE_NAME, WEARABLES } from './wearables';

function state(overrides: Partial<BoutiqueState> = {}): BoutiqueState {
  return {
    mode: 'shop',
    trying: null,
    wearing: null,
    owned: ownedWearables([]),
    held: (itemId) => ({ money: 500 })[itemId] ?? 0,
    sheet: () => 'data:,',
    honours: { earned: [], worn: [] },
    ...overrides,
  };
}

const cards = (markup: string, attribute: string): string[] =>
  [...markup.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map((match) => match[1]);

describe("the boutique's screen", () => {
  it('puts every piece on its shelves, and the raid finds on a shelf of their own', () => {
    const markup = boutiqueMarkup(state());
    expect(markup).toContain(BOUTIQUE_NAME);
    expect(new Set(cards(markup, 'data-wear'))).toEqual(new Set(WEARABLES.map((piece) => piece.id)));
    expect(markup).toContain('Found on raids');
  });

  it("counts on the shelves' heading every card its MORE strip counts", () => {
    const markup = boutiqueMarkup(state());
    // Every piece, every whole look, and the classic look's own card.
    expect(markup.match(/data-classic /g)).toHaveLength(1);
    const onShelves = cards(markup, 'data-wear').length + cards(markup, 'data-whole').length + 1;
    const [, looks, pieces] = /(\d+) looks · (\d+) pieces/.exec(markup) ?? [];
    expect(Number(looks) + Number(pieces)).toBe(onShelves);
  });

  it('shows the wardrobe only what the save owns, with no line about the shop', () => {
    const markup = boutiqueMarkup(state({ mode: 'wardrobe', owned: ownedWearables(['red-cap']) }));
    expect(cards(markup, 'data-wear').sort()).toEqual(['plain-tee', 'plain-trousers', 'red-cap', 'short-crop']);
    expect(markup).not.toContain('more on the shelves');
  });

  it('prices a try-on, and offers to buy it only when the vault can pay', () => {
    const coat = wearing(STARTER_LOOK, 'lab-coat');
    expect(commitBar(state({ trying: coat }))).toContain('Comes to ₽400.');
    expect(commitBar(state({ trying: coat }))).not.toMatch(/data-buy aria-disabled/);
    const gown = wearing(STARTER_LOOK, 'beauty-gown');
    expect(commitBar(state({ trying: gown }))).toMatch(/data-buy aria-disabled="true"/);
    expect(commitBar(state({ trying: gown }))).toContain('That comes to ₽1500, and you have ₽500.');
  });

  it('never sells a raid find, however much is in the vault', () => {
    const bar = commitBar(state({ trying: wearing(STARTER_LOOK, 'zapdos-jacket'), held: () => 99_999 }));
    expect(bar).toMatch(/data-buy aria-disabled="true"/);
    expect(bar).toContain('turn up on raids');
  });

  it('prices a whole look with a raid find in it as needing the find, not as a plain price (the arenas hunt, finding 3)', () => {
    const markup = boutiqueMarkup(state());
    const card = (id: string): string => {
      const start = markup.indexOf(`data-whole="${id}"`);
      return markup.slice(start, markup.indexOf('</button>', start));
    };
    // Said as the things themselves on the card, and in words for a reader.
    expect(card('mon-mewtwo')).toMatch(/aria-label="₽\d+ \+ a raid find"/);
    expect(card('mon-mewtwo')).toContain('<span class="boutique-cost">+ a raid find</span>');
    // Bought everything but the robe: the card needs only the find.
    const all = ownedWearables(WEARABLES.filter((piece) => piece.rarity !== 'raid').map((piece) => piece.id));
    const owned = boutiqueMarkup(state({ owned: all }));
    const start = owned.indexOf('data-whole="mon-mewtwo"');
    expect(owned.slice(start, owned.indexOf('</button>', start))).toContain('<span class="boutique-cost">Needs a raid find</span>');
  });

  it('wears what is owned without a till, and puts back a try-on', () => {
    const bar = commitBar(state({ trying: STARTER_LOOK }));
    expect(bar).toContain('data-wear-it');
    expect(bar).not.toContain('data-buy');
    expect(bar).not.toMatch(/data-put-back aria-disabled/);
    expect(commitBar(state())).toMatch(/data-put-back aria-disabled="true"/);
  });
});

describe("the shelves' pager", () => {
  it('names every shelf the screen shows on its pager, in shelf order, the first on show', () => {
    const markup = boutiqueMarkup(state());
    expect(markup).toMatch(/data-pager-name="looks">Looks<small> 1 of 8<\/small>/);
    expect(markup).toMatch(/data-pager-name="hat" hidden>/);
    expect(markup).toContain('data-shelf-step="-1"');
    expect(markup).toContain('data-shelf-step="1"');
    expect(cards(boutiqueMarkup(state()), 'data-pager-name')).toEqual(['looks', 'hat', 'hair', 'top', 'legs', 'outfit', 'raid', 'honours']);
    // The wardrobe shows only the shelves something owned stands on, a gym honour won first.
    expect(cards(boutiqueMarkup(state({ mode: 'wardrobe' })), 'data-pager-name')).toEqual(['looks', 'hair', 'top', 'legs']);
    expect(cards(boutiqueMarkup(state({ mode: 'wardrobe', honours: { earned: ['cascade'], worn: [] } })), 'data-pager-name')).toEqual([
      'honours',
      'looks',
      'hair',
      'top',
      'legs',
    ]);
  });

  it('steps a shelf at a time with Page Down and Page Up, held at both ends', () => {
    expect(shelfStep(2, false, 7, 1)).toBe(3);
    expect(shelfStep(6, true, 7, 1)).toBe(6);
    // Up goes to the start of this shelf first, and only then to the one before.
    expect(shelfStep(2, false, 7, -1)).toBe(2);
    expect(shelfStep(2, true, 7, -1)).toBe(1);
    expect(shelfStep(0, true, 7, -1)).toBe(0);
  });

  it('shows every gym honour in the shop, never for sale, with whom it is won from', () => {
    const markup = boutiqueMarkup(state());
    expect(cards(markup, 'data-honour')).toEqual(GYM_HONOURS.map((honour) => honour.id));
    expect(markup).toContain('Gym honours');
    expect(markup).toContain('Beat MISTY');
    expect(markup).not.toMatch(/data-honour="cascade"[^>]*>[^<]*₽/);
  });

  it('puts only the honours won in the wardrobe, each saying whether it is worn', () => {
    const none = boutiqueMarkup(state({ mode: 'wardrobe' }));
    expect(cards(none, 'data-honour')).toEqual([]);
    expect(none).not.toContain('Gym honours');
    const won = boutiqueMarkup(state({ mode: 'wardrobe', honours: { earned: ['cascade', 'soul'], worn: ['cascade'] } }));
    expect(cards(won, 'data-honour')).toEqual(['cascade', 'soul']);
    expect(won).toMatch(/data-honour="cascade"[\s\S]*?MISTY's · On/);
    expect(won).toMatch(/data-honour="soul"[\s\S]*?KOGA's · Off/);
  });

  it('shows an honour on in the shop mirror, and the wardrobe mirror as you are', () => {
    const wardrobe = { mode: 'wardrobe' as const, honours: { earned: ['cascade', 'soul'] as const, worn: ['cascade'] as const } };
    expect(honoursIfChosen(wardrobe, 'cascade')).toEqual(['cascade']);
    expect(honoursIfChosen(wardrobe, 'soul')).toEqual(['cascade']);
    expect(honoursIfChosen({ mode: 'shop', honours: { earned: [], worn: [] } }, 'soul')).toEqual(['soul']);
  });

  it('opens the wardrobe on the honours won, so they are never scrolled out of sight', () => {
    const won = boutiqueMarkup(state({ mode: 'wardrobe', honours: { earned: ['cascade'], worn: ['cascade'] } }));
    expect(won.match(/data-cursor-start/g)).toHaveLength(1);
    expect(won).toMatch(/data-honour="cascade" data-cursor-start/);
    expect(boutiqueMarkup(state({ mode: 'wardrobe' }))).toMatch(/data-classic data-cursor-start/);
  });
});
