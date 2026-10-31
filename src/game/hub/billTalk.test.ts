import { describe, expect, it } from 'vitest';
import { CHARMANDER } from '../pokemon';
import { createStartingStash } from '../stash';
import { GOODS_ON_SHELVES, goodName, shelfState } from '../base/billGoods';
import { TRADER_BARTERS, TRADER_STOCK, type TraderCounter } from './trader';
import { billFromTheMat, billQuote, type BillGood } from './billTalk';

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
const fire: BillGood = { kind: 'barter', barterId: 'barter-fire-stone' };
const claw: BillGood = { kind: 'barter', barterId: 'barter-quick-claw' };

describe("everything Bill deals in stands on his shelves", () => {
  it('has a seat for every deal, and one only', () => {
    const named = GOODS_ON_SHELVES.map(({ good }) =>
      good.kind === 'stock' ? good.itemId : good.kind === 'barter' ? good.barterId : 'berth',
    );
    expect(named).toHaveLength(new Set(named).size);
    expect([...named].sort()).toEqual(
      ['berth', ...TRADER_STOCK.map((item) => item.itemId), ...TRADER_BARTERS.map((barter) => barter.id)].sort(),
    );
    expect(new Set(GOODS_ON_SHELVES.map(({ tile }) => `${tile.x},${tile.y}`)).size).toBe(named.length);
  });

  it('keeps under a sheet what the player has not earned, and leaves a gap for what he only had one of', () => {
    expect(shelfState(counter(), potion)).toBe('sheeted');
    expect(shelfState(counter({}, REGULAR), potion)).toBe('out');
    expect(shelfState(counter({}, { ...REGULAR, traderBarters: ['barter-quick-claw'] }), claw)).toBe('gone');
    // An HM comes back while the vault holds none: it is out again, not a gap.
    const hm: BillGood = { kind: 'barter', barterId: 'barter-hm01' };
    expect(shelfState(counter({}, { ...REGULAR, traderBarters: ['barter-hm01'] }), hm)).toBe('out');
    expect(shelfState(counter({ 'hm01-cut': 1 }, { ...REGULAR, traderBarters: ['barter-hm01'] }), hm)).toBe('gone');
  });

  it('names every one', () => {
    for (const { good } of GOODS_ON_SHELVES) {
      expect(goodName(good).length).toBeGreaterThan(0);
    }
  });
});

describe('Bill on a thing on his shelves', () => {
  it('names a shelf price, and YES is under the cursor: a Potion for money is ordinary', () => {
    const quote = billQuote(counter({ money: 500 }, REGULAR), potion);
    expect(quote.lines[1]).toBe('₽120, and 1 left for you this trip.');
    expect(quote.question).toBe('Buy one for ₽120?');
    expect(quote.spendsForGood).toBeUndefined();
  });

  it('says so when the purse is short, or the ration spent, and asks nothing', () => {
    expect(billQuote(counter({ money: 50 }, REGULAR), potion).question).toBeUndefined();
    expect(billQuote(counter({ money: 50 }, REGULAR), potion).lines[1]).toContain('you have ₽50');
    const spent = billQuote(counter({ money: 500 }, REGULAR, { rationUsed: 1 }), potion);
    expect(spent.question).toBeUndefined();
    expect(spent.lines[1]).toContain('your lot this trip');
  });

  it('says what is under a sheet and what would take it off', () => {
    const quote = billQuote(counter(), potion);
    expect(quote.lines[0]).toBe('Under the sheet? Potion. I keep it back until you are regular.');
    expect(quote.question).toBeUndefined();
  });

  it('names a barter in goods, and it opens on NOT NOW because it cannot be taken back', () => {
    const quote = billQuote(counter({ 'lamp-oil': 2, 'parts-crate': 2, 'radio-valve': 1 }, PARTNER), fire);
    expect(quote.lines[1]).toBe('I want 2 Lamp oils, 2 Parts crates and 1 Radio valve. Money does not buy this.');
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
    for (const { good } of GOODS_ON_SHELVES) {
      const rich = Object.fromEntries(
        ['money', 'lamp-oil', 'parts-crate', 'radio-valve', 'mooring-rope', 'linen-roll', 'cable-coil'].map((id) => [id, 99999]),
      );
      const { question } = billQuote(counter(rich, PARTNER), good);
      expect(question, goodName(good)).toBeDefined();
      expect(question?.length ?? 0, question).toBeLessThanOrEqual(34);
    }
  });
});

describe('Bill from the mat', () => {
  it('reads the player, says what is left this trip, and offers the whole list', () => {
    const stranger = billFromTheMat(counter({ money: 40 }));
    expect(stranger.lines[0]).toContain('I do not know you');
    expect(stranger.lines[1]).toBe('You have ₽40, and I am selling you nothing yet.');
    expect(stranger.question).toBe('See my whole list?');

    const partner = billFromTheMat(counter({ money: 40 }, PARTNER, { rationUsed: 1 }));
    expect(partner.lines).toHaveLength(2);
    expect(partner.lines[1]).toBe('You have ₽40, and 2 of 3 left off the deck this trip.');
  });
});
