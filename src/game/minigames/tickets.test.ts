import { describe, expect, it } from 'vitest';
import { getItemById } from '../items/items';
import { TRADER_BARTERS, TRADER_STOCK } from '../hub/trader';
import {
  BERRIES_A_DAY,
  buyPrize,
  DAILY_TICKET_CEILING,
  jumpTickets,
  JUMP_TICKET_TIERS,
  neverForTickets,
  NO_GAME_CORNER,
  payGame,
  payJump,
  payoutWords,
  prizeRefusal,
  readGameCorner,
  TICKET_PRIZES,
  today,
  type GameCornerRecord,
} from './tickets';

const NOON = new Date(2026, 10, 5, 12);
const EVENING = new Date(2026, 10, 5, 20);
const TOMORROW = new Date(2026, 10, 6, 9);

describe('tickets earned at the cabinets', () => {
  it('pays once a day at the tier of the day’s best score, a better score paying the difference', () => {
    const first = payJump(NO_GAME_CORNER, 400, NOON);
    expect(first.tickets).toBe(10);
    const again = payJump(first.record, 400, EVENING);
    expect(again.tickets).toBe(0);
    const better = payJump(again.record, 7000, EVENING);
    expect(better.tickets).toBe(20);
    expect(better.berries).toBe(1);
    expect(better.record.tickets).toBe(30);
    expect(payJump(better.record, 9000, EVENING).tickets).toBe(0);
  });

  it('starts every day afresh, by the player’s own clock', () => {
    const played = payJump(NO_GAME_CORNER, 7000, NOON).record;
    expect(payJump(played, 7000, TOMORROW).tickets).toBe(30);
    expect(today(played, TOMORROW).paid).toEqual({});
  });

  it('never pays more in a day than the ceiling, however the ledger was left', () => {
    const full: GameCornerRecord = {
      ...NO_GAME_CORNER,
      day: { day: '2026-11-05', paid: { 'pokemon-jump': DAILY_TICKET_CEILING }, berries: {}, bought: {}, best: {} },
    };
    expect(payJump(full, 9000, NOON).tickets).toBe(0);
  });

  it('keeps the tiers rising, the top one a team’s and the first within a lone starter’s reach', () => {
    const scores = JUMP_TICKET_TIERS.map((tier) => tier.score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(jumpTickets(0)).toBe(0);
    expect(jumpTickets(99999)).toBe(30);
  });

  it('tells a result that reaches no tier what pays, never that it is a new best or that the day has paid', () => {
    // Last of six in the derby on a fresh day: playtest wave 3, finding 2.
    const last = payGame(NO_GAME_CORNER, 'derby', 1, NOON);
    expect(last.tickets).toBe(0);
    expect(last.firstTier).toBe('The podium pays, from 3rd.');
    expect(payoutWords(last, [])).toBe('No tickets. The podium pays, from 3rd.');
    const third = payGame(last.record, 'derby', 4, NOON);
    expect(third.firstTier).toBeNull();
    expect(payoutWords(third, ['10 tickets'])).toBe('A new best! Won 10 tickets.');
    expect(payoutWords(payGame(third.record, 'derby', 4, EVENING), [])).toBe('Nothing more today: the day has paid this tier.');
    expect(payoutWords(payJump(NO_GAME_CORNER, 100, NOON), [])).toBe('No tickets. A score of 250 pays.');
  });
});

describe('the prize window', () => {
  it('sells only berries and furniture: nothing a raid is kept alive by or rewards', () => {
    const barterGoods = new Set<string>(TRADER_BARTERS.map((barter) => barter.gives.itemId));
    const shelf = new Set(TRADER_STOCK.map((stock) => stock.itemId as string));
    for (const prize of TICKET_PRIZES) {
      const item = getItemById(prize.itemId);
      expect([prize.itemId, item !== undefined]).toEqual([prize.itemId, true]);
      expect([prize.itemId, neverForTickets(item!)]).toEqual([prize.itemId, null]);
      expect([prize.itemId, item!.effect.type === 'furniture' || prize.itemId.endsWith('-berry')]).toEqual([prize.itemId, true]);
      expect([prize.itemId, barterGoods.has(prize.itemId) || shelf.has(prize.itemId)]).toEqual([prize.itemId, false]);
    }
  });

  it('refuses a Potion, a Poké Ball, a pack, money, a material and a stone by what they do', () => {
    for (const id of ['potion', 'poke-ball', 'raid-pack', 'money', 'parts-crate', 'fire-stone']) {
      const item = getItemById(id);
      expect([id, item !== undefined && neverForTickets(item) !== null]).toEqual([id, true]);
    }
  });

  it(`sells ${BERRIES_A_DAY} berries a day, any mix, and nothing it cannot be paid for`, () => {
    let record: GameCornerRecord = { ...NO_GAME_CORNER, tickets: 1000 };
    const berries = TICKET_PRIZES.filter((prize) => prize.limitGroup === 'berries');
    for (let bought = 0; bought < BERRIES_A_DAY; bought += 1) {
      record = buyPrize(record, berries[bought % berries.length].itemId, NOON)!;
      expect(record).not.toBeNull();
    }
    expect(buyPrize(record, berries[0].itemId, NOON)).toBeNull();
    expect(prizeRefusal(berries[0], record, NOON)).toMatch(/a day/);
    expect(buyPrize(record, berries[0].itemId, TOMORROW)).not.toBeNull();
    expect(record.tickets).toBe(1000 - 20 * BERRIES_A_DAY);
    expect(buyPrize({ ...NO_GAME_CORNER, tickets: 10 }, 'cute-tv', NOON)).toBeNull();
  });
});

describe('a Game Corner record out of a save', () => {
  it('reads what it wrote, and nothing it does not know', () => {
    const played = payJump(NO_GAME_CORNER, 7000, NOON).record;
    const bought = buyPrize(played, 'oran-berry', NOON)!;
    expect(readGameCorner(JSON.parse(JSON.stringify(bought)))).toEqual(bought);
    expect(readGameCorner('tickets')).toBeUndefined();
    expect(readGameCorner({ tickets: 2.5, best: { 'pokemon-jump': -1 } })).toEqual({ tickets: 0, best: {}, day: null });
  });
});
