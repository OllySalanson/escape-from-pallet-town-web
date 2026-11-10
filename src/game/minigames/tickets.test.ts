import { describe, expect, it } from 'vitest';
import { getItemById } from '../items/items';
import { TRADER_BARTERS, TRADER_STOCK } from '../hub/trader';
import { machineForItemId } from '../items/teaching';
import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { partyOf, trainerWinRate } from '../world/trainerMeasure';
import { createRunTrainerEncounters } from '../world/trainers';
import { MISTY_BOSS_ID } from '../world/valeQuarters';
import { DERBY_LEVELS, derbyScore } from './derby';
import {
  BERRIES_A_DAY,
  buyPrize,
  isoWeekKey,
  prizeById,
  prizeItemId,
  DAILY_TICKET_CEILING,
  DERBY_SOURCES,
  DERBY_TICKET_TIERS,
  derbySource,
  derbyTiers,
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
  type PrizeSituation,
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
    expect(last.firstTier).toBe('On THE FRONT, 3rd or better pays 10 tickets.');
    expect(payoutWords(last, [])).toBe('No tickets. On THE FRONT, 3rd or better pays 10 tickets.');
    const third = payGame(last.record, 'derby', 4, NOON);
    expect(third.firstTier).toBeNull();
    expect(payoutWords(third, ['10 tickets'])).toBe('A new best! Won 10 tickets.');
    expect(payoutWords(payGame(third.record, 'derby', 4, EVENING), [])).toBe('Nothing more today: THE FRONT has paid this tier.');
    // What a tier pays is said with what it asks, so it is never read off the tickets a player holds (playtest 51, finding 6).
    expect(payoutWords(payJump(NO_GAME_CORNER, 100, NOON), [])).toBe('No tickets. A score of 250 pays 10 tickets.');
    expect(payoutWords(payGame(NO_GAME_CORNER, 'fishing-derby', 58, NOON), [])).toBe('No tickets. A tally of 60 pays 10 tickets.');
  });
});

describe('THE PROMENADE DERBY, a level at a time', () => {
  it('has a source for every level, and nothing for a level it does not have', () => {
    expect(DERBY_SOURCES).toHaveLength(DERBY_LEVELS.length);
    expect(DERBY_LEVELS.map((level) => derbySource(level.number))).toEqual([...DERBY_SOURCES]);
    expect(() => derbySource(DERBY_LEVELS.length + 1)).toThrow();
  });

  it('pays every place on a harder level more than the same place on an easier one', () => {
    for (let level = 2; level <= DERBY_LEVELS.length; level += 1) {
      derbyTiers(level).forEach((rung, index) => expect(rung.tickets).toBeGreaterThan(derbyTiers(level - 1)[index].tickets));
    }
    // 3rd on the last course is worth more than a win on the first.
    const first = derbyTiers(1);
    expect(derbyTiers(DERBY_LEVELS.length)[0].tickets).toBeGreaterThan(first[first.length - 1].tickets);
    expect(first).toEqual(DERBY_TICKET_TIERS);
  });

  it('pays THE GRAND DERBY after a win on THE FRONT, and names the course in its line (playtest 51, finding 1)', () => {
    const front = payGame(NO_GAME_CORNER, derbySource(1), derbyScore(1), NOON);
    expect(front.tickets).toBe(30);
    const grand = payGame(front.record, derbySource(4), derbyScore(2), NOON);
    expect(grand.tickets).toBe(derbyTiers(4)[1].tickets);
    expect(grand.course).toBe('THE GRAND DERBY');
    // The same place again: that course has paid its tier, and the line says which course.
    const again = payGame(grand.record, derbySource(4), derbyScore(2), EVENING);
    expect(again.tickets).toBe(0);
    expect(payoutWords(again, [])).toBe('Nothing more today: THE GRAND DERBY has paid this tier.');
    // Worse than today's best there: beat that course's best, not THE FRONT's win.
    const worse = payGame(again.record, derbySource(4), derbyScore(3), EVENING);
    expect(payoutWords(worse, [])).toBe('Beat today’s best on THE GRAND DERBY to win more.');
    // Each level keeps its own best, today and ever.
    expect(today(worse.record, EVENING).best).toMatchObject({ derby: 6, 'derby-4': 5 });
    expect(worse.record.best).toMatchObject({ derby: 6, 'derby-4': 5 });
    // And off the podium a level says what its own first tier pays.
    expect(payGame(NO_GAME_CORNER, derbySource(3), derbyScore(5), NOON).firstTier).toBe(
      `On THE BREAKWATER, 3rd or better pays ${derbyTiers(3)[0].tickets} tickets.`,
    );
  });

  it('reads every level’s ledger back out of a save', () => {
    const played = payGame(NO_GAME_CORNER, derbySource(4), derbyScore(1), NOON).record;
    const read = readGameCorner(JSON.parse(JSON.stringify(played)));
    expect(read?.best).toEqual({ 'derby-4': 6 });
    expect(read?.day?.best).toEqual({ 'derby-4': 6 });
    expect(read?.day?.paid).toEqual({ 'derby-4': derbyTiers(4)[2].tickets });
  });
});

const NOTHING_HELD: PrizeSituation = { holding: () => 0, rumourToTell: true };

describe('the prize window', () => {
  const misty = createRunTrainerEncounters().find((encounter) => encounter.bossId === MISTY_BOSS_ID)!.trainer;

  it('sells nothing a raid is kept alive by or rewards, and nothing Bill deals', () => {
    const barterGoods = new Set<string>(TRADER_BARTERS.map((barter) => barter.gives.itemId));
    const shelf = new Set(TRADER_STOCK.map((stock) => stock.itemId as string));
    for (const prize of TICKET_PRIZES) {
      const itemId = prizeItemId(prize);
      if (itemId === undefined) continue;
      const item = getItemById(itemId);
      expect([itemId, item !== undefined]).toEqual([itemId, true]);
      expect([itemId, neverForTickets(item!)]).toEqual([itemId, null]);
      expect([itemId, barterGoods.has(itemId) || shelf.has(itemId)]).toEqual([itemId, false]);
    }
  });

  it('refuses a Potion, a Poké Ball, a pack, money, a material, a stone, a damaging disc and gear that fights', () => {
    for (const id of ['potion', 'poke-ball', 'raid-pack', 'money', 'parts-crate', 'fire-stone', 'tm13-ice-beam', 'tm28-dig', 'leftovers', 'life-orb']) {
      const item = getItemById(id);
      expect([id, item !== undefined && neverForTickets(item) !== null]).toEqual([id, true]);
    }
  });

  it('sells a disc only if it is a setter, and only one of each a week', () => {
    const discs = TICKET_PRIZES.filter((prize) => getItemById(prizeItemId(prize) ?? '')?.effect.type === 'machine');
    expect(discs.map((prize) => prize.id).sort()).toEqual(['tm11-sunny-day', 'tm18-rain-dance']);
    for (const prize of discs) {
      const move = machineForItemId(prize.id)!.move;
      expect([prize.id, move.power, move.effects.weather !== undefined, prize.perWeek]).toEqual([prize.id, 0, true, 1]);
    }
  });

  it('sells held gear only if it buys clock - getting away from a wild one - and one at a time', () => {
    const gear = TICKET_PRIZES.filter((prize) => getItemById(prizeItemId(prize) ?? '')?.effect.type === 'held');
    expect(gear.map((prize) => prize.id)).toEqual(['smoke-ball']);
    for (const prize of gear) {
      const item = getItemById(prize.id)!;
      expect(item.effect.type === 'held' && item.effect.held.type).toBe('always-escape');
      expect(prize.oneHeld).toBe(true);
    }
  });

  it('sells the flute and the Smoke Ball again only once the one before is lost', () => {
    const rich: GameCornerRecord = { ...NO_GAME_CORNER, tickets: 5000 };
    for (const id of ['poke-flute', 'smoke-ball']) {
      const holding: PrizeSituation = { holding: (itemId) => (itemId === id ? 1 : 0), rumourToTell: true };
      expect(prizeRefusal(prizeById(id)!, rich, NOON, holding), id).toMatch(/once it is lost/);
      expect(buyPrize(rich, id, NOON, holding), id).toBeNull();
      expect(buyPrize(rich, id, NOON, NOTHING_HELD), id).not.toBeNull();
    }
  });

  it('sells each weather disc once a week, by the player’s own calendar, a week starting on a Monday', () => {
    const rich: GameCornerRecord = { ...NO_GAME_CORNER, tickets: 5000 };
    const sunday = new Date(2026, 10, 8, 12);
    const monday = new Date(2026, 10, 9, 12);
    expect(isoWeekKey(sunday)).not.toBe(isoWeekKey(monday));
    const once = buyPrize(rich, 'tm11-sunny-day', new Date(2026, 10, 2, 12), NOTHING_HELD)!;
    expect(buyPrize(once, 'tm11-sunny-day', sunday, NOTHING_HELD)).toBeNull();
    expect(prizeRefusal(prizeById('tm11-sunny-day')!, once, sunday, NOTHING_HELD)).toMatch(/a week/);
    // The other disc has its own week.
    expect(buyPrize(once, 'tm18-rain-dance', sunday, NOTHING_HELD)).not.toBeNull();
    expect(buyPrize(once, 'tm11-sunny-day', monday, NOTHING_HELD)?.tickets).toBe(5000 - 1200);
  });

  it('gives each prize Pokémon once a save, for good', () => {
    const rich: GameCornerRecord = { ...NO_GAME_CORNER, tickets: 99_999 };
    const had = buyPrize(rich, 'dratini', NOON, NOTHING_HELD)!;
    expect(had.taken).toEqual(['dratini']);
    expect(buyPrize(had, 'dratini', TOMORROW, NOTHING_HELD)).toBeNull();
    expect(prizeRefusal(prizeById('dratini')!, had, TOMORROW, NOTHING_HELD)).toMatch(/Already yours/);
    expect(buyPrize(had, 'porygon', NOON, NOTHING_HELD)).not.toBeNull();
  });

  it.each(TICKET_PRIZES.flatMap((prize) => (prize.gives.kind === 'pokemon' ? [[prize.id, prize.gives] as const] : [])))(
    '%s is FireRed’s, can fight from the day it is had, and is a partner against Misty, never the answer alone',
    (_id, gives) => {
      // FireRed's Celadon prize room sells these two (pret/pokefirered,
      // `CeladonCity_GameCorner_PrizeRoom/scripts.inc`).
      expect(['dratini', 'porygon']).toContain(gives.speciesId);
      const pokemon = new Pokemon(getSpeciesById(gives.speciesId)!, gives.level);
      expect(pokemon.moves.some((move) => move.base.power > 0), `${gives.speciesId} has nothing to hit with`).toBe(true);
      // The reward is the species: at most the level its first attacking move
      // comes at, never a starter's evolved level.
      expect(gives.level).toBeLessThanOrEqual(15);
      const party = partyOf(`${gives.speciesId} alone`, [gives.speciesId, gives.level]);
      expect(trainerWinRate(party, misty, 200, 0x7e57, null, 3)).toBeLessThan(0.75);
    },
  );

  it('sells one rumour a day, and none when the mill has nothing new', () => {
    const rich: GameCornerRecord = { ...NO_GAME_CORNER, tickets: 500 };
    const heard = buyPrize(rich, 'rumour', NOON, NOTHING_HELD)!;
    expect(heard.tickets).toBe(450);
    expect(prizeRefusal(prizeById('rumour')!, heard, EVENING, NOTHING_HELD)).toMatch(/One rumour a day/);
    expect(buyPrize(heard, 'rumour', TOMORROW, NOTHING_HELD)).not.toBeNull();
    expect(prizeRefusal(prizeById('rumour')!, rich, NOON, { holding: () => 0, rumourToTell: false })).toMatch(/no rumour/);
  });

  it(`sells ${BERRIES_A_DAY} berries a day, any mix, and nothing it cannot be paid for`, () => {
    let record: GameCornerRecord = { ...NO_GAME_CORNER, tickets: 1000 };
    const berries = TICKET_PRIZES.filter((prize) => prize.limitGroup === 'berries');
    for (let bought = 0; bought < BERRIES_A_DAY; bought += 1) {
      record = buyPrize(record, berries[bought % berries.length].id, NOON, NOTHING_HELD)!;
      expect(record).not.toBeNull();
    }
    expect(buyPrize(record, berries[0].id, NOON, NOTHING_HELD)).toBeNull();
    expect(prizeRefusal(berries[0], record, NOON, NOTHING_HELD)).toMatch(/a day/);
    expect(buyPrize(record, berries[0].id, TOMORROW, NOTHING_HELD)).not.toBeNull();
    expect(record.tickets).toBe(1000 - 20 * BERRIES_A_DAY);
    expect(buyPrize({ ...NO_GAME_CORNER, tickets: 10 }, 'cute-tv', NOON, NOTHING_HELD)).toBeNull();
  });

  it('sells every berry as a held berry: something a Pokémon can be given and eats by itself', () => {
    for (const prize of TICKET_PRIZES.filter((one) => one.shelf === 'berries')) {
      expect([prize.id, getItemById(prize.id)?.holdable]).toEqual([prize.id, true]);
    }
  });
});

describe('a Game Corner record out of a save', () => {
  it('reads what it wrote, and nothing it does not know', () => {
    const played = payJump(NO_GAME_CORNER, 7000, NOON).record;
    const bought = buyPrize(played, 'oran-berry', NOON, NOTHING_HELD)!;
    expect(readGameCorner(JSON.parse(JSON.stringify(bought)))).toEqual(bought);
    const rich: GameCornerRecord = { ...NO_GAME_CORNER, tickets: 99_999 };
    const weekly = buyPrize(buyPrize(rich, 'tm18-rain-dance', NOON, NOTHING_HELD)!, 'porygon', NOON, NOTHING_HELD)!;
    expect(readGameCorner(JSON.parse(JSON.stringify(weekly)))).toEqual(weekly);
    expect(readGameCorner({ tickets: 1, best: {}, taken: ['cute-tv', 'porygon', 7], week: { week: 'soon', bought: {} } })).toEqual({
      tickets: 1,
      best: {},
      day: null,
      taken: ['porygon'],
    });
    expect(readGameCorner('tickets')).toBeUndefined();
    expect(readGameCorner({ tickets: 2.5, best: { 'pokemon-jump': -1 } })).toEqual({ tickets: 0, best: {}, day: null });
  });
});
