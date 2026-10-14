import { describe, expect, it } from 'vitest';
import { pricePart, shopDetailPane, shopPaidColumn, shopPriceColumn, SHORT_MARK, SHORT_MARK_LEGEND } from './shopDetail';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { TRADER_BARTERS } from '../hub/trader';
import { getItemById } from '../items';

/**
 * The shelves' one rule, held where it is cheap to hold: what a thing does and
 * what it costs are two facts, and a screen never shows one in place of the
 * other. Brock used to - a rung's line was its price until it was
 * built and its effect afterwards - which is the fault this module exists for.
 */
describe('a priced row', () => {
  it('gives every part of a price its own line, and marks only what is short', () => {
    const column = shopPriceColumn([
      { ask: '2 Pokémon' },
      { ask: '2× Parts crate', short: true },
    ]);

    expect(column).toBe(
      `<span class="px-price"><small>2 Pokémon</small><small class="cost-short">${SHORT_MARK}2× Parts crate</small></span>`,
    );
  });

  /**
   * Playtest 40 #4: Brock's heading said "Red is not yet spare at base" and the
   * short part was told apart by red alone, which is ink to a protan eye and
   * the same grey as a covered part to an achromat. A short part carries a
   * drawn cross, and the legend names the cross rather than the colour.
   */
  it('marks a short part with a drawn cross, not by colour alone', () => {
    const column = shopPriceColumn([{ ask: '1× Radio valve', short: true }, { ask: '1× Cable coil' }]);
    expect(column.match(/class="cost-mark"/g)).toHaveLength(1);
    expect(SHORT_MARK).toContain('aria-hidden="true"');
    expect(SHORT_MARK_LEGEND).toContain(SHORT_MARK);
    expect(SHORT_MARK_LEGEND.toLowerCase()).not.toContain('red');

    const detail = shopDetailPane({
      id: 'radio-mast',
      shown: true,
      effect: 'x',
      detail: 'y',
      priceLabel: 'Price',
      price: [pricePart('1× Radio valve', 0, 1, 'spare at base'), pricePart('1× Cable coil', 3, 1, 'spare at base')],
    });
    expect(detail).toContain(`<dd>${SHORT_MARK}0 spare at base</dd>`);
    expect(detail).toContain('<dd>3 spare at base</dd>');
  });

  it('says a bought thing is paid for rather than dropping its price column', () => {
    expect(shopPaidColumn('Paid')).toContain('is-paid');
    expect(shopPaidColumn('Paid')).toContain('Paid');
  });
});

describe('the pane under a shelf', () => {
  const pane = (overrides: Partial<Parameters<typeof shopDetailPane>[0]> = {}): string =>
    shopDetailPane({
      id: 'secure-locker-1',
      shown: true,
      effect: 'One more column of the secure container.',
      detail: 'More of what you carry comes home from every raid.',
      priceLabel: 'Price',
      price: [pricePart('2 Pokémon', 3, 2, 'you can release')],
      ...overrides,
    });

  it('leads with what the thing does, whatever it costs', () => {
    expect(pane()).toContain('What it does');
    expect(pane()).toContain('One more column of the secure container.');
    expect(pane()).toContain('More of what you carry comes home from every raid.');
  });

  it('prices every ask against what is held towards it', () => {
    const detail = pane({
      price: [
        pricePart('2 Pokémon', 3, 2, 'you can release'),
        pricePart('2× Parts crate', 1, 2, 'spare at base'),
      ],
    });

    expect(detail).toContain('<dd>3 you can release</dd>');
    // Short, so the row is marked - and only the held half is drawn in red.
    expect(detail).toContain('<div class="is-short"><dt>');
    expect(detail).toContain(`<dd>${SHORT_MARK}1 spare at base</dd>`);
  });

  it('draws an icon slot on a price with no icon, so the asks line up', () => {
    expect(pane()).toContain('<dt><span class="shop-price-nib" aria-hidden="true"></span>');
  });

  /**
   * `.pixel-ui small` is soft ink with more weight than `.px-warning`, so a
   * refusal written in a `small` came out grey - the opposite of what it is for.
   */
  it('writes what is stopping the deal in the ink a refusal is written in', () => {
    expect(pane({ blocked: 'He keeps that back until you are partner.' })).toContain(
      '<span class="px-wrap px-warning">He keeps that back until you are partner.</span>',
    );
  });

  it('is hidden until its own row is pointed at, and answers to that row by id', () => {
    expect(pane({ shown: false })).toContain('data-shown-by="secure-locker-1" hidden');
    expect(pane()).toContain('data-shown-by="secure-locker-1">');
  });
});

/**
 * The pane prints the effect and the detail one above the other, so a detail
 * that restated its effect said the same thing twice under two headings - which
 * is what every barter's did while the row showed only the price.
 */
describe('what the two shelves are written to say', () => {
  const sentences = (text: string): string[] =>
    text
      .split(/(?<=\.)\s+/)
      .map((sentence) => sentence.trim().toLowerCase())
      .filter(Boolean);

  it('never repeats a rung’s effect in its own detail', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(sentences(upgrade.detail)).not.toContain(upgrade.effect.toLowerCase());
    }
  });

  it('never repeats the item’s own line in the detail of the deal for it', () => {
    for (const barter of TRADER_BARTERS) {
      const description = getItemById(barter.gives.itemId)?.description ?? '';
      for (const sentence of sentences(description)) {
        expect(sentences(barter.detail)).not.toContain(sentence);
      }
    }
  });
});
