/**
 * What a save keeps of THE BATTLE ARENA's two runs (`cups.ts`, `rentals.ts`),
 * as types and readers with no imports, because `dojoRecord.ts` reads them and
 * everything else in `arena/` reads `dojoRecord.ts`. Both are optional in the
 * dojo's record with no version bump: absent is a player who has never run one.
 */

/** Bouts in a run, cup or rental: the Battle Factory's seven. */
export const RUN_BOUTS = 7;

/** What a save keeps of the cups: this week's run and best, what the week has paid, and every cup won. */
export interface CupRecord {
  /** The week the run and the best are for, `YYYY-Www`. */
  readonly week: string;
  /** Wins in a row in the run going now. */
  readonly run: number;
  /** The best run this week. */
  readonly best: number;
  /** Tickets this week's cup has paid. */
  readonly paid: number;
  /** Every cup won, all seven in a row, as `cup@week`. */
  readonly won?: readonly string[];
}

/** A rental run going now: the day it is for, the three on loan, how far it has got, and whose team may be swapped from. */
export interface RentalRun {
  /** The player's date, `YYYY-MM-DD`: a run is for its day only. */
  readonly day: string;
  /** The three on loan, by kind, in the order they go out. */
  readonly team: readonly string[];
  /** Bouts won in a row. */
  readonly won: number;
  /** Whether this is the day's one scored run, which pays. */
  readonly scored: boolean;
  /** The team just beaten, by kind: one of them may be swapped in for the next bout. */
  readonly swapFrom?: readonly string[];
}

export interface RentalRecord {
  readonly run?: RentalRun;
  /** The day the scored run was used. */
  readonly scoredDay?: string;
  /** The best scored run ever, in wins. */
  readonly best?: number;
}

const count = (raw: unknown, most: number): number =>
  Number.isInteger(raw) && (raw as number) >= 0 ? Math.min(raw as number, most) : 0;

const isDay = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const kinds = (value: unknown, most: number): readonly string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string' && /^[a-z][a-z0-9-]{1,23}$/.test(one)).slice(0, most) : [];

/** A cup record out of a save, or nothing if it is not one. */
export function readCupRecord(value: unknown): CupRecord | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { week, run, best, paid, won } = value as Record<string, unknown>;
  if (typeof week !== 'string' || !/^\d{4}-W\d{2}$/.test(week)) {
    return undefined;
  }
  const wonList = Array.isArray(won)
    ? [...new Set(won.filter((one): one is string => typeof one === 'string' && /^[a-z]{3,8}@\d{4}-W\d{2}$/.test(one)))].slice(-64)
    : [];
  return {
    week,
    run: count(run, RUN_BOUTS),
    best: count(best, RUN_BOUTS),
    paid: count(paid, 200),
    ...(wonList.length > 0 ? { won: wonList } : {}),
  };
}

/** A rental record out of a save, or nothing if it is not one. */
export function readRentalRecord(value: unknown): RentalRecord | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { run, scoredDay, best } = value as Record<string, unknown>;
  let liveRun: RentalRun | undefined;
  if (typeof run === 'object' && run !== null) {
    const raw = run as Record<string, unknown>;
    const team = kinds(raw.team, 3);
    const swapFrom = kinds(raw.swapFrom, 3);
    if (isDay(raw.day) && team.length > 0) {
      liveRun = {
        day: raw.day,
        team,
        won: count(raw.won, RUN_BOUTS),
        scored: raw.scored === true,
        ...(swapFrom.length > 0 ? { swapFrom } : {}),
      };
    }
  }
  const out: RentalRecord = {
    ...(liveRun ? { run: liveRun } : {}),
    ...(isDay(scoredDay) ? { scoredDay } : {}),
    ...(count(best, RUN_BOUTS) > 0 ? { best: count(best, RUN_BOUTS) } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}
