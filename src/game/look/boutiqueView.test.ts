import { describe, expect, it } from 'vitest';
import { boutiqueMarkup, commitBar, type BoutiqueState } from './boutiqueView';
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

  it('shows the wardrobe only what the save owns, and says how much more there is', () => {
    const markup = boutiqueMarkup(state({ mode: 'wardrobe', owned: ownedWearables(['red-cap']) }));
    expect(cards(markup, 'data-wear').sort()).toEqual(['plain-tee', 'plain-trousers', 'red-cap', 'short-crop']);
    expect(markup).toContain(`${WEARABLES.length - 4} more on the shelves of ${BOUTIQUE_NAME}`);
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

  it('wears what is owned without a till, and puts back a try-on', () => {
    const bar = commitBar(state({ trying: STARTER_LOOK }));
    expect(bar).toContain('data-wear-it');
    expect(bar).not.toContain('data-buy');
    expect(bar).not.toMatch(/data-put-back aria-disabled/);
    expect(commitBar(state())).toMatch(/data-put-back aria-disabled="true"/);
  });
});

describe("the shelves' jump chips", () => {
  it('gives every shelf the screen shows a chip, in shelf order', () => {
    expect(cards(boutiqueMarkup(state()), 'data-jump')).toEqual(['looks', 'hat', 'hair', 'top', 'legs', 'outfit', 'raid']);
    // The wardrobe shows only the shelves something owned stands on.
    expect(cards(boutiqueMarkup(state({ mode: 'wardrobe' })), 'data-jump')).toEqual(['looks', 'hair', 'top', 'legs']);
  });
});
