import { getItemById, type ItemDefinition } from '../items/items';
import { machineForItem } from '../items/teaching';
import { DERBY_LEVELS } from './derby';
import { berriesForScore } from './pokemonJump';
import { winsPrizeBerry } from './berryPicking';

/**
 * TICKETS, THE GAME CORNER's prize token (the harbour arenas plan, section 5):
 * earned at the cabinets, kept at home, spent at the PRIZE WINDOW.
 *
 * - **Kept at home, never in the pack.** A ticket is a number in the save
 *   (`raidProgress.tickets`), not loot: it cannot be carried, dropped or lost
 *   on a wipe. That is exactly why it must never buy raid power.
 * - **Not money.** The Pokédollar is loot in the pack (`hub/trader.ts`); a
 *   ticket never turns into one, and Bill never takes them.
 * - **Capped by the day.** Each cabinet pays once a day at the tier of the best
 *   score played that day - playing more is for the score, not the purse -
 *   and every source together pays at most `DAILY_TICKET_CEILING`. The day is
 *   the player's own, by their clock, as THE BOLTHOLE's window is.
 * - **Spent on what sends a player back out, or on the house** - a berry, or
 *   furniture - and never on Potions, Poké Balls, packs, money, Brock's
 *   materials, stones or anything Bill barters (`NEVER_FOR_TICKETS`, held by
 *   `tickets.test.ts`).
 *
 * Phaser-free and pure: what a game pays and what a prize costs are worked out
 * here; `SaveManager` writes them, one write each.
 */

/**
 * THE PROMENADE DERBY's sources, one a level (`minigames/derbyLevels.ts`), in
 * the order they open: each level pays its own tiers, once a day, so a podium
 * on a harder course is worth more and is never "already paid" by a win on an
 * easier one (playtest 51, finding 1). THE FRONT keeps the plain `derby`, the
 * source every save before the levels paid into.
 */
export const DERBY_SOURCES = ['derby', 'derby-2', 'derby-3', 'derby-4'] as const;
export type DerbySource = (typeof DERBY_SOURCES)[number];

/** The source a DERBY level pays from, by its number (1 for THE FRONT). */
export function derbySource(level: number): DerbySource {
  const source = DERBY_SOURCES[level - 1];
  if (source === undefined) throw new Error(`No DERBY level ${level} pays tickets.`);
  return source;
}

/**
 * A source of tickets, each capped by the day: the cabinets, the course, bouts
 * won in THE BATTLE ARENA, and the promenade's three outdoor games - the race
 * (a source a level), the dig and the fishing derby.
 */
export type TicketSource =
  | 'pokemon-jump'
  | 'berry-picking'
  | 'field-course'
  | 'battle-arena'
  | DerbySource
  | 'dig'
  | 'fishing-derby'
  | 'rental-run';

/** The most every source together pays in a day (the plan's daily ceiling). */
export const DAILY_TICKET_CEILING = 285;

/**
 * POKéMON JUMP's tiers, this game's: set with `tools/minigames/measure.mts`
 * so that a lone starter that keeps its feet a while earns the first, a team
 * of one jump type the second, and a team of FAST jumpers the third.
 */
export const JUMP_TICKET_TIERS: readonly { readonly score: number; readonly tickets: number }[] = [
  { score: 250, tickets: 10 },
  { score: 2500, tickets: 20 },
  { score: 6000, tickets: 30 },
];

/** The tickets a POKéMON JUMP score is worth, once a day. */
export function jumpTickets(score: number): number {
  return JUMP_TICKET_TIERS.reduce((won, tier) => (score >= tier.score ? tier.tickets : won), 0);
}

/**
 * BERRY PICKING's tiers, this game's, set with `tools/minigames/measure.mts`:
 * a Doduo that keeps up a while earns the first, FireRed's own prize line
 * (3,000) the second - a Dodrio's ordinary game, a Doduo's very good one - and
 * a Dodrio played well the third.
 */
export const BERRY_TICKET_TIERS: readonly { readonly score: number; readonly tickets: number }[] = [
  { score: 1000, tickets: 10 },
  { score: 3000, tickets: 20 },
  { score: 6000, tickets: 30 },
];

/** The tickets a BERRY PICKING score is worth, once a day. */
export function berryTickets(score: number): number {
  return BERRY_TICKET_TIERS.reduce((won, tier) => (score >= tier.score ? tier.tickets : won), 0);
}

/**
 * THE FIELD-MOVE COURSE's tiers, this game's, in milliseconds round, set
 * against the fastest each sort of team can go (`fastestRun`,
 * `tools/minigames/drawCourse.mts`): anybody who gets round in half a minute
 * earns the first; the second wants a team with some field moves, run well;
 * the third wants CUT and SURF both - a Krabby, or a Bulbasaur with a
 * Squirtle - and a clean run, because a perfect starter alone is just short.
 */
export const COURSE_TICKET_TIERS: readonly { readonly ms: number; readonly tickets: number }[] = [
  { ms: 30_000, tickets: 10 },
  { ms: 18_000, tickets: 20 },
  { ms: 14_500, tickets: 30 },
];

/** The tickets a time round THE FIELD-MOVE COURSE is worth, once a day. */
export function courseTickets(ms: number): number {
  if (ms <= 0) return 0;
  return COURSE_TICKET_TIERS.reduce((won, tier) => (ms <= tier.ms ? tier.tickets : won), 0);
}

/** A whole number as the game prints one, with thousands marked. */
const number = (value: number): string => value.toLocaleString('en-GB');

/** The first rung of a ladder of tiers. */
const firstOf = <T>(tiers: readonly T[]): T => {
  const first = tiers[0];
  if (first === undefined) throw new Error('A ladder of tiers needs a first rung.');
  return first;
};

type Tiers = readonly { readonly score: number; readonly tickets: number }[];

function tierTickets(tiers: Tiers, score: number): number {
  return tiers.reduce((won, tier) => (score >= tier.score ? tier.tickets : won), 0);
}

/**
 * THE PROMENADE DERBY's tiers on THE FRONT, by place (`derbyScore`: six for a
 * win, five for second, four for third): a podium pays, a win pays most. Set
 * with `tools/minigames/outdoor.mts` so that the right racer ridden well wins
 * often, and the wrong one still makes the podium now and then.
 */
export const DERBY_TICKET_TIERS: Tiers = [
  { score: 4, tickets: 10 },
  { score: 5, tickets: 20 },
  { score: 6, tickets: 30 },
];

/** How much more every rung of a DERBY level pays than the level before it. */
export const DERBY_LEVEL_STEP = 10;

/**
 * Each DERBY level's own tiers, by place, in the order the levels open: THE
 * FRONT's, and every rung worth `DERBY_LEVEL_STEP` more a level on - so 3rd on
 * THE GRAND DERBY pays more than a win on THE FRONT.
 */
export const DERBY_LEVEL_TICKET_TIERS: readonly Tiers[] = DERBY_SOURCES.map((_source, index) =>
  DERBY_TICKET_TIERS.map((tier) => ({ score: tier.score, tickets: tier.tickets + index * DERBY_LEVEL_STEP })),
);

/** A DERBY level's tiers, by its number. */
export function derbyTiers(level: number): Tiers {
  const tiers = DERBY_LEVEL_TICKET_TIERS[level - 1];
  if (tiers === undefined) throw new Error(`No DERBY level ${level} pays tickets.`);
  return tiers;
}

/** What a podium place is called where a tier is said: `3rd`. */
const PODIUM_WORDS: Readonly<Record<number, string>> = { 6: '1st', 5: '2nd', 4: '3rd' };

/** What a DERBY level's first tier asks and pays, named by its course: `On THE SANDS, 3rd or better pays 20 tickets.` */
function derbyFirstTier(level: number): string {
  const first = firstOf(derbyTiers(level));
  const name = DERBY_LEVELS[level - 1]?.name ?? `level ${level}`;
  return `On ${name}, ${PODIUM_WORDS[first.score] ?? 'the podium'} or better pays ${first.tickets} tickets.`;
}

/** THE DIG's tiers, by points dug: a couple of finds, most of the patch, and all of it. */
export const DIG_TICKET_TIERS: Tiers = [
  { score: 20, tickets: 10 },
  { score: 35, tickets: 20 },
  { score: 45, tickets: 30 },
];

/** THE FISHING DERBY's tiers, by the tally: what a plain lead lands off the deep end, and what Illuminate does. */
export const FISHING_DERBY_TICKET_TIERS: Tiers = [
  { score: 60, tickets: 10 },
  { score: 140, tickets: 20 },
  { score: 220, tickets: 30 },
];

export const derbyTickets = (score: number, level = 1): number => tierTickets(derbyTiers(level), score);
export const digTickets = (score: number): number => tierTickets(DIG_TICKET_TIERS, score);
export const fishingDerbyTickets = (score: number): number => tierTickets(FISHING_DERBY_TICKET_TIERS, score);

/**
 * THE BATTLE ARENA pays for the day's first wins (the harbour arenas plan,
 * section 2.10): ten tickets a win for the first five, so its "score" is the
 * number of bouts won today and a sixth win pays nothing. Moving up a class
 * pays apart from the day (`arena/classes.ts`).
 */
export const DOJO_WIN_TICKETS = 10;
export const DOJO_PAID_WINS_A_DAY = 5;

/**
 * THE BATTLE ARENA's daily rental run (`arena/rentals.ts`, the harbour arenas
 * plan, section 2.10): five tickets a win of the day's one scored run, so its
 * "score" is how far that run got, seven at most.
 */
export const RENTAL_WIN_TICKETS = 5;
export const RENTAL_RUN_BOUTS = 7;

export function rentalRunTickets(won: number): number {
  return Math.max(0, Math.min(RENTAL_RUN_BOUTS, won)) * RENTAL_WIN_TICKETS;
}

/** The tickets a day's bout wins are worth. */
export function dojoWinTickets(winsToday: number): number {
  return Math.max(0, Math.min(DOJO_PAID_WINS_A_DAY, winsToday)) * DOJO_WIN_TICKETS;
}

/**
 * How a source is scored: which of two results is better (a score up, a time
 * down; nothing played is 0 for both), and what a day's best is worth.
 */
interface SourceRule {
  readonly better: (a: number, b: number) => boolean;
  readonly tickets: (best: number) => number;
  readonly berries: (best: number) => number;
  /**
   * What the first tier asks and what it pays, said when a result reaches
   * none: what a player holds is said beside it, so this says only what a
   * game would pay (playtest 51, finding 6).
   */
  readonly firstTier: string;
  /** The course a source is, for a game with several (THE PROMENADE DERBY's levels), named in its result line. */
  readonly course?: string;
}

const SOURCE_RULES: Readonly<Record<TicketSource, SourceRule>> = {
  'pokemon-jump': {
    better: (a, b) => a > b,
    tickets: jumpTickets,
    berries: berriesForScore,
    firstTier: `A score of ${number(firstOf(JUMP_TICKET_TIERS).score)} pays ${firstOf(JUMP_TICKET_TIERS).tickets} tickets.`,
  },
  'berry-picking': {
    better: (a, b) => a > b,
    tickets: berryTickets,
    berries: (best) => (winsPrizeBerry(best) ? 1 : 0),
    firstTier: `A score of ${number(firstOf(BERRY_TICKET_TIERS).score)} pays ${firstOf(BERRY_TICKET_TIERS).tickets} tickets.`,
  },
  'field-course': {
    better: (a, b) => a > 0 && (b <= 0 || a < b),
    tickets: courseTickets,
    berries: () => 0,
    firstTier: `Round in ${firstOf(COURSE_TICKET_TIERS).ms / 1000} seconds pays ${firstOf(COURSE_TICKET_TIERS).tickets} tickets.`,
  },
  'battle-arena': { better: (a, b) => a > b, tickets: dojoWinTickets, berries: () => 0, firstTier: `A win pays ${DOJO_WIN_TICKETS} tickets.` },
  ...derbyRules(),
  // The dig's berries are what it turns up, sent home through `digBerriesAllowed`, not paid by score.
  dig: {
    better: (a, b) => a > b,
    tickets: digTickets,
    berries: () => 0,
    firstTier: `${firstOf(DIG_TICKET_TIERS).score} points dug pays ${firstOf(DIG_TICKET_TIERS).tickets} tickets.`,
  },
  'fishing-derby': {
    better: (a, b) => a > b,
    tickets: fishingDerbyTickets,
    berries: () => 0,
    firstTier: `A tally of ${firstOf(FISHING_DERBY_TICKET_TIERS).score} pays ${firstOf(FISHING_DERBY_TICKET_TIERS).tickets} tickets.`,
  },
  'rental-run': { better: (a, b) => a > b, tickets: rentalRunTickets, berries: () => 0, firstTier: `A win pays ${RENTAL_WIN_TICKETS} tickets.` },
};

/** Each DERBY level's rules: a place, scored the same on every course, paid on the level's own tiers. */
function derbyRules(): Record<DerbySource, SourceRule> {
  const rules = {} as Record<DerbySource, SourceRule>;
  DERBY_SOURCES.forEach((source, index) => {
    const level = index + 1;
    rules[source] = {
      better: (a, b) => a > b,
      tickets: (best) => derbyTickets(best, level),
      berries: () => 0,
      firstTier: derbyFirstTier(level),
      ...(DERBY_LEVELS[index] ? { course: DERBY_LEVELS[index].name } : {}),
    };
  });
  return rules;
}

/** The better of two results at a source: the higher score, or the quicker time. */
export function betterResult(source: TicketSource, a: number, b: number): number {
  return SOURCE_RULES[source].better(a, b) ? a : b;
}

/** What the day has paid and been sold so far, for the caps. */
export interface TicketDay {
  /** The player's own date, `YYYY-MM-DD`. */
  readonly day: string;
  /** Tickets each source has paid today. */
  readonly paid: Readonly<Partial<Record<TicketSource, number>>>;
  /** Berries each source has paid today. */
  readonly berries: Readonly<Partial<Record<TicketSource, number>>>;
  /** Each prize bought today, by id. */
  readonly bought: Readonly<Record<string, number>>;
  /** The best score each cabinet has had today. */
  readonly best: Readonly<Partial<Record<TicketSource, number>>>;
}

/** What the week has sold, for the prizes sold a few a week (the weather discs). */
export interface TicketWeek {
  /** The player's own ISO week, `YYYY-Www` (`isoWeekKey`). */
  readonly week: string;
  /** Each prize bought this week, by id. */
  readonly bought: Readonly<Record<string, number>>;
}

/** What a save remembers of the Game Corner: the tickets in hand, the day's ledger and the best scores ever. */
export interface GameCornerRecord {
  readonly tickets: number;
  readonly day: TicketDay | null;
  readonly best: Readonly<Partial<Record<TicketSource, number>>>;
  /** This week's ledger, once something sold by the week has been bought. */
  readonly week?: TicketWeek;
  /** The once-only prizes had, by id: FireRed's prize Pokémon. */
  readonly taken?: readonly string[];
}

export const NO_GAME_CORNER: GameCornerRecord = { tickets: 0, day: null, best: {} };

/** The player's date as the ledger keys it: their own clock, as the house's window is. */
export function ticketDayKey(now: Date): string {
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/**
 * The ISO week a date is in, as `YYYY-Www`, by the player's own calendar date:
 * a week starts on a Monday, as THE BATTLE ARENA's cup does (`../arena/cups.ts`).
 */
export function isoWeekKey(now: Date): string {
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Today's ledger: the stored one if it is today's, else a fresh one. */
export function today(record: GameCornerRecord, now: Date): TicketDay {
  const day = ticketDayKey(now);
  return record.day?.day === day ? record.day : { day, paid: {}, berries: {}, bought: {}, best: {} };
}

function paidToday(day: TicketDay): number {
  return Object.values(day.paid).reduce((sum, value) => sum + (value ?? 0), 0);
}

/** What a game just played pays, and the record after it. */
export interface GamePayout {
  readonly record: GameCornerRecord;
  readonly tickets: number;
  readonly berries: number;
  /** Whether the score is the best ever at this cabinet. */
  readonly newBest: boolean;
  /** Whether it is the best today. */
  readonly bestToday: boolean;
  /**
   * What the first tier asks, when this result reaches no tier at all - so
   * last place is told what pays rather than that the day has paid it - and
   * null when it reaches one.
   */
  readonly firstTier: string | null;
  /** The course it was played on, for a game with several (`THE GRAND DERBY`), or null. */
  readonly course: string | null;
}

/**
 * What a game paid, as one line: what was won, or why nothing was. A result
 * that reaches no tier is never "a new best" and never "paid": it is told
 * what the first tier asks.
 */
export function payoutWords(payout: GamePayout, won: readonly string[]): string {
  if (won.length > 0) return `${payout.newBest ? 'A new best! ' : ''}Won ${won.join(', ')}.`;
  if (payout.firstTier !== null) return `No tickets. ${payout.firstTier}`;
  // A game of several courses says which one's best it means: a best on another course is no yardstick.
  const course = payout.course;
  const unpaid = payout.bestToday
    ? `Nothing more today: ${course ?? 'the day'} has paid this tier.`
    : `Beat today’s best${course ? ` on ${course}` : ''} to win more.`;
  return `${payout.newBest ? 'A new best! ' : ''}${unpaid}`;
}

/**
 * A result played at a source - a score, or a time round in milliseconds -
 * and what it pays: the day's best raised if it is better, and the tickets and
 * berries the day's best is worth, less what today has already paid. So a
 * better result later in the day pays the difference, and the same result
 * again pays nothing.
 */
export function payGame(record: GameCornerRecord, source: TicketSource, result: number, now: Date): GamePayout {
  const rules = SOURCE_RULES[source];
  const day = today(record, now);
  const best = betterResult(source, result, day.best[source] ?? 0);
  const owedTickets = Math.max(0, rules.tickets(best) - (day.paid[source] ?? 0));
  const tickets = Math.min(owedTickets, Math.max(0, DAILY_TICKET_CEILING - paidToday(day)));
  const berries = Math.max(0, rules.berries(best) - (day.berries[source] ?? 0));
  const everBest = record.best[source] ?? 0;
  return {
    tickets,
    berries,
    newBest: rules.better(result, everBest),
    bestToday: result > 0 && best === result,
    firstTier: rules.tickets(result) > 0 || rules.berries(result) > 0 ? null : rules.firstTier,
    course: rules.course ?? null,
    record: {
      tickets: record.tickets + tickets,
      best: { ...record.best, [source]: betterResult(source, result, everBest) },
      day: {
        ...day,
        best: { ...day.best, [source]: best },
        paid: { ...day.paid, [source]: (day.paid[source] ?? 0) + tickets },
        berries: { ...day.berries, [source]: (day.berries[source] ?? 0) + berries },
      },
    },
  };
}

/** A POKéMON JUMP score played (`payGame`). */
export function payJump(record: GameCornerRecord, score: number, now: Date): GamePayout {
  return payGame(record, 'pokemon-jump', score, now);
}

/** The most berries THE DIG sends home in a day: the prize window's own five. */
export const DIG_BERRIES_A_DAY = 5;

/**
 * How many of the berries a dig turned up may go home, given what the day has
 * already sent: a dig pays in what it finds, up to `DIG_BERRIES_A_DAY`.
 */
export function digBerriesAllowed(record: GameCornerRecord, found: number, now: Date): number {
  const sent = today(record, now).berries.dig ?? 0;
  return Math.max(0, Math.min(found, DIG_BERRIES_A_DAY - sent));
}

/** The record with `count` more berries sent home from a source today. */
export function withBerriesSent(record: GameCornerRecord, source: TicketSource, count: number, now: Date): GameCornerRecord {
  const day = today(record, now);
  return { ...record, day: { ...day, berries: { ...day.berries, [source]: (day.berries[source] ?? 0) + count } } };
}

// --- THE PRIZE WINDOW ---------------------------------------------------------

/** What a prize is: a thing for the vault, a Pokémon for the boxes, or a rumour said there and then. */
export type PrizeGives =
  | { readonly kind: 'item'; readonly itemId: string }
  | { readonly kind: 'pokemon'; readonly speciesId: string; readonly level: number }
  | { readonly kind: 'rumour' };

/** Which part of the window a prize is listed under. */
export type PrizeShelf = 'berries' | 'raids' | 'pokemon' | 'rumours' | 'house';

/**
 * A row of the prize window: what it gives, its price in tickets and how often
 * it may be had. A prize's id is the item's own for an item, so a day's ledger
 * written before the window grew still reads.
 */
export interface TicketPrize {
  readonly id: string;
  readonly gives: PrizeGives;
  readonly shelf: PrizeShelf;
  readonly tickets: number;
  readonly perDay?: number;
  /** Which daily limit it shares, if several prizes share one: the berries do. */
  readonly limitGroup?: string;
  /** How many a week, by the player's own calendar (`isoWeekKey`). */
  readonly perWeek?: number;
  /** Sold once a save, for good: FireRed's prize Pokémon. */
  readonly once?: true;
  /**
   * Sold only while the save holds none, in the vault or in a Pokémon's hand.
   * A thing that rides in the pack can be lost with it, and a prize that was
   * once only for good would then be gone for good; this is Bill's rule for an
   * HM (`reofferedWhenNoneHeld` in `../hub/trader.ts`).
   */
  readonly oneHeld?: true;
}

/** The berries share one limit, as the plan has it: five a day, any mix. */
export const BERRIES_A_DAY = 5;

/** THE RUMOUR MILL sells one rumour a day. */
export const RUMOURS_A_DAY = 1;

const itemPrize = (itemId: string, shelf: PrizeShelf, tickets: number, limits: Partial<TicketPrize> = {}): TicketPrize => ({
  id: itemId,
  gives: { kind: 'item', itemId },
  shelf,
  tickets,
  ...limits,
});

/**
 * What tickets buy (the harbour arenas plan, section 5.3), each with the
 * reason it is safe:
 *
 * - **Held berries**, the berries a cabinet already pays: a raid tool at the
 *   berry trees' rate. Since gyms step 4 every one of them goes in the gear
 *   slot and is eaten by itself (`../pokemon/battle/heldItems.ts`).
 * - **TM11 Sunny Day and TM18 Rain Dance**, one a week each: setters, not
 *   damage, and still a disc read in a raid and lost with the pack.
 * - **The SMOKE BALL**: saves clock, not a fight that matters - the hunter and
 *   trainers pay it no mind - and lost with its holder on a wipe.
 * - **The POKé FLUTE**: never used up, carried in the pack.
 * - **ABRA, DRATINI and PORYGON**, once each: FireRed's own prize Pokémon.
 *   The reward is the species, not the level. ABRA is FireRed's cheapest
 *   prize, at FireRed's Lv 9, and the one way a save comes to own one (the
 *   endgame bug hunt, 12 Nov 2026): it knows only Teleport there, a move the
 *   engine leaves out, so it Struggles until it is a KADABRA at 16.
 * - **A rumour** from THE RUMOUR MILL, one a day: information that sends a
 *   player out on a raid.
 * - **Furniture** for THE BOLTHOLE, the bottomless sink. Raid prizes - the
 *   shields, the Glitter Mat, the Gorgeous Plant - stay raid prizes, so a find
 *   is still a find.
 */
export const TICKET_PRIZES: readonly TicketPrize[] = [
  ...['oran-berry', 'sitrus-berry', 'pecha-berry', 'cheri-berry', 'rawst-berry', 'chesto-berry', 'aspear-berry'].map(
    (itemId): TicketPrize => itemPrize(itemId, 'berries', 20, { perDay: BERRIES_A_DAY, limitGroup: 'berries' }),
  ),
  itemPrize('tm11-sunny-day', 'raids', 600, { perWeek: 1 }),
  itemPrize('tm18-rain-dance', 'raids', 600, { perWeek: 1 }),
  itemPrize('smoke-ball', 'raids', 600, { oneHeld: true }),
  itemPrize('poke-flute', 'raids', 800, { oneHeld: true }),
  { id: 'abra', gives: { kind: 'pokemon', speciesId: 'abra', level: 9 }, shelf: 'pokemon', tickets: 200, once: true },
  { id: 'dratini', gives: { kind: 'pokemon', speciesId: 'dratini', level: 15 }, shelf: 'pokemon', tickets: 2500, once: true },
  { id: 'porygon', gives: { kind: 'pokemon', speciesId: 'porygon', level: 5 }, shelf: 'pokemon', tickets: 4000, once: true },
  { id: 'rumour', gives: { kind: 'rumour' }, shelf: 'rumours', tickets: 50, perDay: RUMOURS_A_DAY },
  itemPrize('pretty-flowers', 'house', 100),
  itemPrize('tropical-plant', 'house', 120),
  itemPrize('pika-cushion', 'house', 150),
  itemPrize('ball-cushion', 'house', 150),
  itemPrize('fire-cushion', 'house', 150),
  itemPrize('water-cushion', 'house', 150),
  itemPrize('surf-mat', 'house', 200),
  itemPrize('thunder-mat', 'house', 200),
  itemPrize('fire-blast-mat', 'house', 200),
  itemPrize('powder-snow-mat', 'house', 200),
  itemPrize('pokemon-chair', 'house', 250),
  itemPrize('comfort-chair', 'house', 250),
  itemPrize('big-plant', 'house', 300),
  itemPrize('pokemon-desk', 'house', 400),
  itemPrize('heavy-desk', 'house', 400),
  itemPrize('cute-tv', 'house', 600),
];

export function prizeById(id: string): TicketPrize | undefined {
  return TICKET_PRIZES.find((prize) => prize.id === id);
}

/** The item a prize puts in the vault, if it is one. */
export function prizeItemId(prize: TicketPrize): string | undefined {
  return prize.gives.kind === 'item' ? prize.gives.itemId : undefined;
}

/**
 * What tickets must never buy, by what an item does: everything that keeps a
 * raid alive or is a raid's own reward. Three things are let through, each by
 * what it does rather than by name, so a new item that does the same is held
 * to the same reason:
 *
 * - a **berry** is medicine, and the one medicine sold, because a berry tree
 *   gives as many in a raid;
 * - a **machine** only if its move does no damage and changes the weather: a
 *   setter, which wins nothing on its own;
 * - **held gear** only if it gets its holder away from a wild Pokémon, which
 *   saves clock and nothing else.
 */
export function neverForTickets(item: ItemDefinition): string | null {
  const effect = item.effect;
  if (item.id.endsWith('-berry')) return null;
  if (effect.type === 'machine') {
    const move = machineForItem(item)?.move;
    return move && move.power === 0 && move.effects?.weather !== undefined ? null : 'a machine that teaches damage';
  }
  if (effect.type === 'held') {
    return effect.held.type === 'always-escape' ? null : 'held gear';
  }
  const refused: Readonly<Record<string, string>> = {
    heal: 'medicine',
    'cure-status': 'medicine',
    'capture-modifier': 'a Poké Ball',
    pack: 'a pack',
    currency: 'money',
    material: "Brock's materials",
    'evolution-stone': 'an evolution stone',
    errand: 'an errand',
    rod: 'a rod',
    pickaxe: 'a Pickaxe',
    lockpick: 'a Lockpick',
    key: 'a key',
    bike: 'the Bicycle',
    wearable: 'a raid find',
    relic: 'a raid find',
  };
  return refused[effect.type] ?? null;
}

/** What a prize's refusal is asked about the save beyond the ledger. */
export interface PrizeSituation {
  /** How many of an item the save holds: in the vault, or in a Pokémon's hand. */
  readonly holding: (itemId: string) => number;
  /** Whether THE RUMOUR MILL has a rumour this save has not heard. */
  readonly rumourToTell: boolean;
}

function boughtIn(prize: TicketPrize, bought: Readonly<Record<string, number>>): number {
  const group = prize.limitGroup;
  return group
    ? TICKET_PRIZES.filter((other) => other.limitGroup === group).reduce((sum, other) => sum + (bought[other.id] ?? 0), 0)
    : (bought[prize.id] ?? 0);
}

/** How many of a prize may still be bought today, or Infinity for one with no daily limit. */
export function prizeLeftToday(prize: TicketPrize, day: TicketDay): number {
  if (prize.perDay === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, prize.perDay - boughtIn(prize, day.bought));
}

/** This week's ledger: the stored one if it is this week's, else a fresh one. */
export function thisWeek(record: GameCornerRecord, now: Date): TicketWeek {
  const week = isoWeekKey(now);
  return record.week?.week === week ? record.week : { week, bought: {} };
}

/** How many of a prize may still be bought this week, or Infinity for one with no weekly limit. */
export function prizeLeftThisWeek(prize: TicketPrize, week: TicketWeek): number {
  if (prize.perWeek === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, prize.perWeek - (week.bought[prize.id] ?? 0));
}

/** Whether a once-only prize has been had. */
export function prizeTaken(prize: TicketPrize, record: GameCornerRecord): boolean {
  return prize.once === true && (record.taken ?? []).includes(prize.id);
}

/** Why a prize cannot be had right now, or null if it can. */
export function prizeRefusal(prize: TicketPrize, record: GameCornerRecord, now: Date, situation: PrizeSituation): string | null {
  if (prizeTaken(prize, record)) {
    return 'Already yours: one to a trainer.';
  }
  const itemId = prizeItemId(prize);
  if (prize.oneHeld && itemId !== undefined && situation.holding(itemId) > 0) {
    return 'You have one already. Another is sold only once it is lost.';
  }
  if (prize.gives.kind === 'rumour' && !situation.rumourToTell) {
    return 'The mill has no rumour you have not heard.';
  }
  if (prizeLeftToday(prize, today(record, now)) <= 0) {
    if (prize.limitGroup === 'berries') return `${BERRIES_A_DAY} berries a day. Come back tomorrow.`;
    return prize.gives.kind === 'rumour' ? 'One rumour a day. Come back tomorrow.' : 'None left today.';
  }
  if (prizeLeftThisWeek(prize, thisWeek(record, now)) <= 0) {
    return 'One a week. Back on Monday.';
  }
  if (record.tickets < prize.tickets) {
    return `${prize.tickets - record.tickets} more tickets.`;
  }
  return null;
}

/** A prize bought: the tickets spent and the day's, week's and save's counts raised. Null if it could not be. */
export function buyPrize(record: GameCornerRecord, id: string, now: Date, situation: PrizeSituation): GameCornerRecord | null {
  const prize = prizeById(id);
  if (!prize || prizeRefusal(prize, record, now, situation) !== null) {
    return null;
  }
  const day = today(record, now);
  const week = thisWeek(record, now);
  return {
    ...record,
    tickets: record.tickets - prize.tickets,
    day: { ...day, bought: { ...day.bought, [id]: (day.bought[id] ?? 0) + 1 } },
    ...(prize.perWeek !== undefined ? { week: { ...week, bought: { ...week.bought, [id]: (week.bought[id] ?? 0) + 1 } } } : {}),
    ...(prize.once ? { taken: [...(record.taken ?? []), id] } : {}),
  };
}

/** A prize's name as the window says it. */
export function prizeName(prize: TicketPrize): string {
  switch (prize.gives.kind) {
    case 'item':
      return getItemById(prize.gives.itemId)?.displayName ?? prize.gives.itemId;
    case 'pokemon':
      return prize.gives.speciesId.toUpperCase();
    case 'rumour':
      return 'A rumour';
  }
}

// --- reading a save -------------------------------------------------------------

const SOURCES: readonly TicketSource[] = [
  'pokemon-jump',
  'berry-picking',
  'field-course',
  'battle-arena',
  ...DERBY_SOURCES,
  'dig',
  'fishing-derby',
  'rental-run',
];

function wholeCount(value: unknown, most = Number.MAX_SAFE_INTEGER): number {
  return Number.isInteger(value) && (value as number) >= 0 ? Math.min(value as number, most) : 0;
}

function bySource(value: unknown, most?: number): Partial<Record<TicketSource, number>> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Partial<Record<TicketSource, number>> = {};
  for (const source of SOURCES) {
    const count = wholeCount((value as Record<string, unknown>)[source], most);
    if (count > 0) out[source] = count;
  }
  return out;
}

/**
 * A Game Corner record out of a save, or undefined if there is none. Anything
 * it does not recognise is dropped rather than believed: a save is somebody's
 * browser, and a prize id or a source this build does not know is nothing.
 */
export function readGameCorner(value: unknown): GameCornerRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as { tickets?: unknown; day?: unknown; best?: unknown; week?: unknown; taken?: unknown };
  let day: TicketDay | null = null;
  if (typeof raw.day === 'object' && raw.day !== null) {
    const stored = raw.day as { day?: unknown; paid?: unknown; berries?: unknown; bought?: unknown; best?: unknown };
    if (typeof stored.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored.day)) {
      const bought: Record<string, number> = {};
      if (typeof stored.bought === 'object' && stored.bought !== null) {
        for (const prize of TICKET_PRIZES) {
          const count = wholeCount((stored.bought as Record<string, unknown>)[prize.id], 999);
          if (count > 0) bought[prize.id] = count;
        }
      }
      day = {
        day: stored.day,
        paid: bySource(stored.paid, DAILY_TICKET_CEILING),
        berries: bySource(stored.berries, 99),
        bought,
        best: bySource(stored.best),
      };
    }
  }
  const week = readWeek(raw.week);
  const taken = Array.isArray(raw.taken)
    ? [...new Set(raw.taken.filter((id): id is string => typeof id === 'string' && prizeById(id)?.once === true))]
    : [];
  return {
    tickets: wholeCount(raw.tickets),
    day,
    best: bySource(raw.best),
    ...(week ? { week } : {}),
    ...(taken.length > 0 ? { taken } : {}),
  };
}

/** A week's ledger out of a save: a week key and counts of prizes sold by the week, or none. */
function readWeek(value: unknown): TicketWeek | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const stored = value as { week?: unknown; bought?: unknown };
  if (typeof stored.week !== 'string' || !/^\d{4}-W\d{2}$/.test(stored.week)) return undefined;
  const bought: Record<string, number> = {};
  if (typeof stored.bought === 'object' && stored.bought !== null) {
    for (const prize of TICKET_PRIZES) {
      if (prize.perWeek === undefined) continue;
      const count = wholeCount((stored.bought as Record<string, unknown>)[prize.id], 99);
      if (count > 0) bought[prize.id] = count;
    }
  }
  return { week: stored.week, bought };
}
