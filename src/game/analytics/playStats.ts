import type { Outcome } from '../maker/submissions';
import { reviewSupabase } from '../maker/supabaseClient';

/**
 * The owner's view of the play counts (`playCounter.ts` sends them): one call,
 * `play_stats`, which the database answers only for a signed-in admin - the
 * same GitHub sign-in and the same admin row that review player maps
 * (`maker/review.ts`). Anyone else is refused by the database, not the game.
 */

export interface PlayDay {
  /** `YYYY-MM-DD`, the owner's own day (Europe/London). */
  readonly day: string;
  readonly players: number;
  readonly newPlayers: number;
  readonly sessions: number;
  readonly seconds: number;
  /** Names first chosen that day at NEW GAME. */
  readonly newNames: number;
  /** Testers' browsers that opened the game that day, counted apart from the players. */
  readonly testers: number;
}

export interface PlayStats {
  readonly today: string;
  readonly playersToday: number;
  readonly playersWeek: number;
  readonly playersAllTime: number;
  readonly returningWeek: number;
  readonly returningAllTime: number;
  /** Browsers marked as testers' (`playCounter.ts`), counted apart and never in the numbers above. */
  readonly testersToday: number;
  readonly testersWeek: number;
  readonly testersAllTime: number;
  /** Browsers found to have been machines and set aside by hand. */
  readonly automatedAllTime: number;
  /** Named players: everyone who has chosen a name at NEW GAME, read from the names themselves. */
  readonly namedToday: number;
  readonly namedWeek: number;
  readonly namedAllTime: number;
  /** The last thirty days, oldest first, today last. */
  readonly days: readonly PlayDay[];
  /** The last thirty days' totals, by `metric` or `metric:detail` (`raid-end:wiped`). */
  readonly month: Readonly<Record<string, number>>;
  /** Every day's totals ever counted, the same way. */
  readonly allTime: Readonly<Record<string, number>>;
  /** The testers' last thirty days' totals, the same way. */
  readonly testerMonth: Readonly<Record<string, number>>;
}

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

const counts = (value: unknown): Record<string, number> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }
  const read: Record<string, number> = {};
  for (const [key, amount] of Object.entries(value)) {
    read[key] = count(amount);
  }
  return read;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The database's answer as the page reads it, or nothing if it is not one. */
export function readPlayStats(raw: unknown): PlayStats | undefined {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const answer = raw as Record<string, unknown>;
  if (typeof answer.today !== 'string' || !DAY.test(answer.today) || !Array.isArray(answer.days)) {
    return undefined;
  }
  const days: PlayDay[] = [];
  for (const entry of answer.days as unknown[]) {
    if (typeof entry !== 'object' || entry === null) {
      return undefined;
    }
    const day = entry as Record<string, unknown>;
    if (typeof day.day !== 'string' || !DAY.test(day.day)) {
      return undefined;
    }
    days.push({
      day: day.day,
      players: count(day.players),
      newPlayers: count(day.newPlayers),
      sessions: count(day.sessions),
      seconds: count(day.seconds),
      newNames: count(day.newNames),
      testers: count(day.testers),
    });
  }
  return {
    today: answer.today,
    playersToday: count(answer.playersToday),
    playersWeek: count(answer.playersWeek),
    playersAllTime: count(answer.playersAllTime),
    returningWeek: count(answer.returningWeek),
    returningAllTime: count(answer.returningAllTime),
    testersToday: count(answer.testersToday),
    testersWeek: count(answer.testersWeek),
    testersAllTime: count(answer.testersAllTime),
    automatedAllTime: count(answer.automatedAllTime),
    namedToday: count(answer.namedToday),
    namedWeek: count(answer.namedWeek),
    namedAllTime: count(answer.namedAllTime),
    days,
    month: counts(answer.month),
    allTime: counts(answer.allTime),
    testerMonth: counts(answer.testerMonth),
  };
}

/** Asks the database for the counts, as whoever is signed in to review. */
export async function loadPlayStats(): Promise<Outcome<PlayStats>> {
  try {
    const { data, error } = await (await reviewSupabase()).rpc('play_stats');
    if (error) {
      return { ok: false, reason: 'The play counts could not be fetched. Try again.' };
    }
    const stats = readPlayStats(data);
    return stats ? { ok: true, value: stats } : { ok: false, reason: 'The play counts came back in a shape this page cannot read.' };
  } catch {
    return { ok: false, reason: 'The play counts could not be fetched. Try again.' };
  }
}
