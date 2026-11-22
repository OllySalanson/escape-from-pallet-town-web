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
const antidote: BillGood = { kind: 'stock', itemId: 'antidote' };
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
    expect(shelfState(counter(), antidote)).toBe('sheeted');
    expect(shelfState(counter({}, REGULAR), antidote)).toBe('out');
    // Potions and Poké Balls are out for anybody (AI playtest 3, 22 Nov 2026).
    expect(shelfState(counter(), potion)).toBe('out');
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

  it('says what is under a sheet and what would take it off', () => {
    const quote = billQuote(counter(), antidote);
    expect(quote.lines[0]).toBe('Under the sheet? Antidote. I keep it back until you are regular.');
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
  it('reads the player, says what is left till the next raid, and offers the whole list', () => {
    const stranger = billFromTheMat(counter({ money: 40 }));
    expect(stranger.lines[0]).toContain("I don't know you");
    expect(stranger.lines[1]).toBe('You have ₽40. Potions and Poké Balls I sell anybody, the rest once I know you.');
    // What gets him to sell more, counted.
    expect(stranger.lines[2]).toBe("Bank 3 jobs off Oak's board, or beat a boss, and I'll sell you more.");
    expect(stranger.question).toBe('See my whole list?');
    // One count of jobs, not 'a job' and then '3 jobs' (AI playtest, 22 Nov 2026).
    expect(stranger.lines.join(' ').match(/\bjobs?\b/g)).toHaveLength(1);

    // Two jobs banked is not yet a regular, and he says he has counted them.
    const started = billFromTheMat(counter({ money: 40 }, { standingContractsBanked: 2 }));
    expect(started.lines[0]).not.toContain("I don't know you");
    expect(started.lines[2]).toBe("Bank 1 more job off Oak's board, or beat a boss, and I'll sell you more.");

    const partner = billFromTheMat(counter({ money: 40 }, PARTNER, { rationUsed: 1 }));
    expect(partner.lines).toHaveLength(2);
    expect(partner.lines[1]).toBe('You have ₽40. Potions and Poké Balls any time, and 2 other things till you raid again.');
    // Never 'I'll sell you 0 more things' (AI playtest, 22 Nov 2026).
    const spent = billFromTheMat(counter({ money: 0 }, PARTNER, { rationUsed: 3 }));
    expect(spent.lines[1]).toBe('You have ₽0. Potions and Poké Balls any time. The rest waits till you raid again.');
  });

  // AI playtest, 22 Nov 2026: a regular who had just beaten MISTY heard 'beat a
  // boss and I show you more' and found every locked row still locked.
  it('tells a regular how far it is to his trust, and what a job, a boss and money are worth', () => {
    // A boss (3) and three contracts banked (6): 9 points, 5 short of trusted.
    const regular = billFromTheMat(counter({ money: 40 }, { defeatedBosses: ['vale-gym-misty'], standingContractsBanked: 3 }));
    expect(regular.lines[2]).toBe("5 more points and I'll show you more. A job's worth 2, a boss 3, and every ₽200 you spend with me 1.");
  });
});
