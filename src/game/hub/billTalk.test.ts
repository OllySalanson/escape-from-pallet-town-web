import { describe, expect, it } from 'vitest';
import { CHARMANDER } from '../pokemon';
import { createStartingStash } from '../stash';
import { EVERY_GOOD, ON_SHOW_AT_MOST, SHELF_TILES, goodName, goodsOnShelves, goodsOnShow, isOnShow } from '../base/billGoods';
import { TRADER_BARTERS, TRADER_STOCK, type TraderCounter } from './trader';
import { billQuote, type BillGood } from './billTalk';

const counter = (
  items: Readonly<Record<string, number>> = {},
  progress: Partial<TraderCounter['progress']> = {},
  rest: Partial<Pick<TraderCounter, 'rationUsed' | 'berthPaid'>> = {},
): TraderCounter => {
  const stash = createStartingStash(CHARMANDER);
  for (const [itemId, quantity] of Object.entries(items)) {
    stash.addItem(itemId, quantity);
  }
  return {
    stash,
    progress: {
      completedContracts: [],
      standingContractsBanked: 0,
      defeatedBosses: [],
      traderMoneySpent: 0,
      traderBarters: [],
      ...progress,
    },
    rationUsed: rest.rationUsed ?? 0,
    berthPaid: rest.berthPaid ?? false,
  };
};
/** Enough turned over to be a partner, with nothing else to show for it. */
const PARTNER = { traderMoneySpent: 5200 };
const REGULAR = { traderMoneySpent: 1200 };

const potion: BillGood = { kind: 'stock', itemId: 'potion' };
const antidote: BillGood = { kind: 'stock', itemId: 'antidote' };
const fire: BillGood = { kind: 'barter', barterId: 'barter-fire-stone' };
const claw: BillGood = { kind: 'barter', barterId: 'barter-quick-claw' };

describe("Bill's small counter", () => {
  it('knows every deal he has, once each', () => {
    const named = EVERY_GOOD.map((good) =>
      good.kind === 'stock' ? good.itemId : good.kind === 'barter' ? good.barterId : 'berth',
    );
    expect(named).toHaveLength(new Set(named).size);
    expect([...named].sort()).toEqual(
      ['berth', ...TRADER_STOCK.map((item) => item.itemId), ...TRADER_BARTERS.map((barter) => barter.id)].sort(),
    );
  });

  it('shows a newcomer a Poké Ball and a Potion, and nothing else', () => {
    expect(goodsOnShow(counter())).toEqual([
      { kind: 'stock', itemId: 'poke-ball' },
      { kind: 'stock', itemId: 'potion' },
    ]);
  });

  it('shows only what he sells this player, and a trade only once a part of it is brought home', () => {
    expect(isOnShow(counter(), antidote)).toBe(false);
    expect(isOnShow(counter({}, REGULAR), antidote)).toBe(true);
    // The ration spent, the Antidote is off the counter till the next raid.
    expect(isOnShow(counter({}, REGULAR, { rationUsed: 1 }), antidote)).toBe(false);
    expect(isOnShow(counter({}, REGULAR), claw)).toBe(false);
    expect(isOnShow(counter({ 'cable-coil': 1 }, REGULAR), claw)).toBe(true);
    expect(isOnShow(counter({ 'cable-coil': 1 }, { ...REGULAR, traderBarters: ['barter-quick-claw'] }), claw)).toBe(false);
    // Parts in hand do not open a deal his standing keeps back.
    expect(isOnShow(counter({ 'lamp-oil': 2 }, REGULAR), fire)).toBe(false);
  });

  it('never has more than a handful out, the trades that can be struck first', () => {
    const rich = Object.fromEntries(
      ['money', 'lamp-oil', 'radio-valve', 'mooring-rope', 'linen-roll', 'cable-coil'].map((id) => [id, 99]),
    );
    // Everything but parts crates: the deals that want none can be struck, and come first.
    const shown = goodsOnShow(counter(rich, PARTNER));
    expect(shown.length).toBeLessThanOrEqual(ON_SHOW_AT_MOST);
    const firstTrade = shown.find((good) => good.kind === 'barter');
    expect(firstTrade?.kind === 'barter' && TRADER_BARTERS.find((each) => each.id === firstTrade.barterId)?.takes.every(({ itemId }) => itemId !== 'parts-crate')).toBe(true);
  });

  it('stands each thing on show on its own shelf tile', () => {
    const seats = goodsOnShelves(counter({ 'cable-coil': 3, 'parts-crate': 3 }, PARTNER));
    expect(new Set(seats.map(({ tile }) => `${tile.x},${tile.y}`)).size).toBe(seats.length);
    for (const { tile } of seats) {
      expect(SHELF_TILES.some((shelf) => shelf.x === tile.x && shelf.y === tile.y)).toBe(true);
    }
  });

  it('names every one', () => {
    for (const good of EVERY_GOOD) {
      expect(goodName(good).length).toBeGreaterThan(0);
    }
  });
});

describe('Bill on a thing on his shelves', () => {
  it('names a shelf price, and opens on NOT NOW: a double press on his price must not buy', () => {
    const quote = billQuote(counter({ money: 500 }, REGULAR), antidote);
    expect(quote.lines[1]).toBe('₽80, and 1 more for you till you raid.');
    expect(quote.question).toBe('Buy one for ₽80?');
    expect(quote.spendsForGood).toBe(true);
    // Off the ration, a stranger's Potion is priced and nothing more.
    const anybody = billQuote(counter({ money: 500 }), potion);
    expect(anybody.lines[1]).toBe('₽120 each, and as many as you can pay for.');
    expect(anybody.question).toBe('Buy one for ₽120?');
    expect(anybody.spendsForGood).toBe(true);
  });

  it('says so when the purse is short, or the ration spent, and asks nothing', () => {
    expect(billQuote(counter({ money: 50 }, REGULAR), potion).question).toBeUndefined();
    expect(billQuote(counter({ money: 50 }, REGULAR), potion).lines[1]).toContain('you have ₽50');
    const spent = billQuote(counter({ money: 500 }, REGULAR, { rationUsed: 1 }), antidote);
    expect(spent.question).toBeUndefined();
    expect(spent.lines[1]).toContain('your lot till you raid again');
  });

  it('names no tier for a thing he keeps back', () => {
    const quote = billQuote(counter(), antidote);
    expect(quote.lines[0]).toBe("Antidote? I've none of that for you.");
    expect(quote.question).toBeUndefined();
  });

  it('names a barter in goods, and it opens on NOT NOW because it cannot be taken back', () => {
    const quote = billQuote(counter({ 'lamp-oil': 2, 'parts-crate': 2, 'radio-valve': 1 }, PARTNER), fire);
    expect(quote.lines[1]).toBe("I want 2 Lamp oils, 2 Parts crates and 1 Radio valve. Money won't buy this one.");
    expect(quote.spendsForGood).toBe(true);
  });

  it('says what a barter is still short of', () => {
    const quote = billQuote(counter({ 'lamp-oil': 2 }, PARTNER), fire);
    expect(quote.question).toBeUndefined();
    expect(quote.lines[1]).toContain('short 2 Parts crates and 1 Radio valve');
  });

  it('says a deal he only had one of is done', () => {
    const quote = billQuote(counter({}, { ...PARTNER, traderBarters: ['barter-quick-claw'] }), claw);
    expect(quote.lines[0]).toContain('only had the one Quick Claw');
    expect(quote.question).toBeUndefined();
  });

  it('rents a berth for one raid, opening on NOT NOW, and says once it is paid', () => {
    const quote = billQuote(counter({ money: 300 }, REGULAR), { kind: 'berth' });
    expect(quote.question).toBe('Pay ₽250 for one raid?');
    expect(quote.spendsForGood).toBe(true);
    expect(billQuote(counter({ money: 300 }, REGULAR, { berthPaid: true }), { kind: 'berth' }).question).toBeUndefined();
  });

  it('asks in one row of the box, or the question runs into YES and NOT NOW', () => {
    for (const good of EVERY_GOOD) {
      const rich = Object.fromEntries(
        ['money', 'lamp-oil', 'parts-crate', 'radio-valve', 'mooring-rope', 'linen-roll', 'cable-coil'].map((id) => [id, 99999]),
      );
      const { question } = billQuote(counter(rich, PARTNER), good);
      expect(question, goodName(good)).toBeDefined();
      expect(question?.length ?? 0, question).toBeLessThanOrEqual(34);
    }
  });
});
