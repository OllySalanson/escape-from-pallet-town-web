import { getItemById, type ItemDefinition } from '../items/items';
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
 * A source of tickets, each capped by the day: the cabinets, the course, bouts
 * won in THE BATTLE ARENA, and the promenade's three outdoor games - the race,
 * the dig and the fishing derby.
 */
export type TicketSource =
  | 'pokemon-jump'
  | 'berry-picking'
  | 'field-course'
  | 'battle-arena'
  | 'derby'
  | 'dig'
  | 'fishing-derby';

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

type Tiers = readonly { readonly score: number; readonly tickets: number }[];

function tierTickets(tiers: Tiers, score: number): number {
  return tiers.reduce((won, tier) => (score >= tier.score ? tier.tickets : won), 0);
}

/**
 * THE PROMENADE DERBY's tiers, by place (`derbyScore`: six for a win, five for
 * second, four for third): a podium pays, a win pays most. Set with
 * `tools/minigames/outdoor.mts` so that the right racer ridden well wins
 * often, and the wrong one still makes the podium now and then.
 */
export const DERBY_TICKET_TIERS: Tiers = [
  { score: 4, tickets: 10 },
  { score: 5, tickets: 20 },
  { score: 6, tickets: 30 },
];

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

export const derbyTickets = (score: number): number => tierTickets(DERBY_TICKET_TIERS, score);
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

/** The tickets a day's bout wins are worth. */
export function dojoWinTickets(winsToday: number): number {
  return Math.max(0, Math.min(DOJO_PAID_WINS_A_DAY, winsToday)) * DOJO_WIN_TICKETS;
}

/**
 * How each source is scored: which of two results is better (a score up, a
 * time down; nothing played is 0 for both), and what a day's best is worth.
 */
const SOURCE_RULES: Readonly<
  Record<TicketSource, { readonly better: (a: number, b: number) => boolean; readonly tickets: (best: number) => number; readonly berries: (best: number) => number }>
> = {
  'pokemon-jump': { better: (a, b) => a > b, tickets: jumpTickets, berries: berriesForScore },
  'berry-picking': { better: (a, b) => a > b, tickets: berryTickets, berries: (best) => (winsPrizeBerry(best) ? 1 : 0) },
  'field-course': { better: (a, b) => a > 0 && (b <= 0 || a < b), tickets: courseTickets, berries: () => 0 },
  'battle-arena': { better: (a, b) => a > b, tickets: dojoWinTickets, berries: () => 0 },
  // The dig's berries are what it turns up, sent home through `digBerriesAllowed`, not paid by score.
  derby: { better: (a, b) => a > b, tickets: derbyTickets, berries: () => 0 },
  dig: { better: (a, b) => a > b, tickets: digTickets, berries: () => 0 },
  'fishing-derby': { better: (a, b) => a > b, tickets: fishingDerbyTickets, berries: () => 0 },
};

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

/** What a save remembers of the Game Corner: the tickets in hand, the day's ledger and the best scores ever. */
export interface GameCornerRecord {
  readonly tickets: number;
  readonly day: TicketDay | null;
  readonly best: Readonly<Partial<Record<TicketSource, number>>>;
}

export const NO_GAME_CORNER: GameCornerRecord = { tickets: 0, day: null, best: {} };

/** The player's date as the ledger keys it: their own clock, as the house's window is. */
export function ticketDayKey(now: Date): string {
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
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

/** A row of the prize window: an item, its price in tickets, and how many a day (none for no limit). */
export interface TicketPrize {
  readonly itemId: string;
  readonly tickets: number;
  readonly perDay?: number;
  /** Which daily limit it shares, if several prizes share one: the berries do. */
  readonly limitGroup?: string;
}

/** The berries share one limit, as the plan has it: five a day, any mix. */
export const BERRIES_A_DAY = 5;

/**
 * What tickets buy, for now: the berries a cabinet already pays (a raid tool
 * at the berry trees' rate), and furniture for THE BOLTHOLE, which is the
 * bottomless sink. Raid prizes - the shields, the Glitter Mat, the Gorgeous
 * Plant - stay raid prizes, so a find is still a find.
 */
export const TICKET_PRIZES: readonly TicketPrize[] = [
  ...['oran-berry', 'sitrus-berry', 'pecha-berry', 'cheri-berry', 'rawst-berry', 'chesto-berry', 'aspear-berry'].map(
    (itemId): TicketPrize => ({ itemId, tickets: 20, perDay: BERRIES_A_DAY, limitGroup: 'berries' }),
  ),
  { itemId: 'pretty-flowers', tickets: 100 },
  { itemId: 'tropical-plant', tickets: 120 },
  { itemId: 'pika-cushion', tickets: 150 },
  { itemId: 'ball-cushion', tickets: 150 },
  { itemId: 'fire-cushion', tickets: 150 },
  { itemId: 'water-cushion', tickets: 150 },
  { itemId: 'surf-mat', tickets: 200 },
  { itemId: 'thunder-mat', tickets: 200 },
  { itemId: 'fire-blast-mat', tickets: 200 },
  { itemId: 'powder-snow-mat', tickets: 200 },
  { itemId: 'pokemon-chair', tickets: 250 },
  { itemId: 'comfort-chair', tickets: 250 },
  { itemId: 'big-plant', tickets: 300 },
  { itemId: 'pokemon-desk', tickets: 400 },
  { itemId: 'heavy-desk', tickets: 400 },
  { itemId: 'cute-tv', tickets: 600 },
];

/**
 * What tickets must never buy, by what an item does: everything that keeps a
 * raid alive or is a raid's own reward. A berry is medicine, and is the one
 * medicine sold, because a berry tree gives as many in a raid.
 */
export function neverForTickets(item: ItemDefinition): string | null {
  const effect = item.effect.type;
  if (item.id.endsWith('-berry')) return null;
  const refused: Readonly<Record<string, string>> = {
    heal: 'medicine',
    'cure-status': 'medicine',
    'capture-modifier': 'a Poké Ball',
    pack: 'a pack',
    currency: 'money',
    material: "Brock's materials",
    'evolution-stone': 'an evolution stone',
    machine: 'a machine',
    held: 'held gear',
    errand: 'an errand',
    rod: 'a rod',
    pickaxe: 'a Pickaxe',
    lockpick: 'a Lockpick',
    key: 'a key',
    bike: 'the Bicycle',
    wearable: 'a raid find',
  };
  return refused[effect] ?? null;
}

/** How many of a prize may still be bought today, or Infinity for one with no limit. */
export function prizeLeftToday(prize: TicketPrize, day: TicketDay): number {
  if (prize.perDay === undefined) return Number.POSITIVE_INFINITY;
  const group = prize.limitGroup;
  const bought = group
    ? TICKET_PRIZES.filter((other) => other.limitGroup === group).reduce((sum, other) => sum + (day.bought[other.itemId] ?? 0), 0)
    : (day.bought[prize.itemId] ?? 0);
  return Math.max(0, prize.perDay - bought);
}

/** Why a prize cannot be had right now, or null if it can. */
export function prizeRefusal(prize: TicketPrize, record: GameCornerRecord, now: Date): string | null {
  if (prizeLeftToday(prize, today(record, now)) <= 0) {
    return prize.limitGroup === 'berries' ? `${BERRIES_A_DAY} berries a day. Come back tomorrow.` : 'None left today.';
  }
  if (record.tickets < prize.tickets) {
    return `${prize.tickets - record.tickets} more tickets.`;
  }
  return null;
}

/** A prize bought: the tickets spent and the day's count raised. Null if it could not be. */
export function buyPrize(record: GameCornerRecord, itemId: string, now: Date): GameCornerRecord | null {
  const prize = TICKET_PRIZES.find((row) => row.itemId === itemId);
  if (!prize || prizeRefusal(prize, record, now) !== null) {
    return null;
  }
  const day = today(record, now);
  return {
    ...record,
    tickets: record.tickets - prize.tickets,
    day: { ...day, bought: { ...day.bought, [itemId]: (day.bought[itemId] ?? 0) + 1 } },
  };
}

/** A prize's name as the window says it. */
export function prizeName(prize: TicketPrize): string {
  return getItemById(prize.itemId)?.displayName ?? prize.itemId;
}

// --- reading a save -------------------------------------------------------------

const SOURCES: readonly TicketSource[] = [
  'pokemon-jump',
  'berry-picking',
  'field-course',
  'battle-arena',
  'derby',
  'dig',
  'fishing-derby',
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
  const raw = value as { tickets?: unknown; day?: unknown; best?: unknown };
  let day: TicketDay | null = null;
  if (typeof raw.day === 'object' && raw.day !== null) {
    const stored = raw.day as { day?: unknown; paid?: unknown; berries?: unknown; bought?: unknown; best?: unknown };
    if (typeof stored.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored.day)) {
      const bought: Record<string, number> = {};
      if (typeof stored.bought === 'object' && stored.bought !== null) {
        for (const prize of TICKET_PRIZES) {
          const count = wholeCount((stored.bought as Record<string, unknown>)[prize.itemId], 999);
          if (count > 0) bought[prize.itemId] = count;
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
  return { tickets: wholeCount(raw.tickets), day, best: bySource(raw.best) };
}
