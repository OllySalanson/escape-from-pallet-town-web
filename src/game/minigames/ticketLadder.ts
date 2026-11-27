import { courseTime } from './gameCornerTalk';
import {
  BERRY_TICKET_TIERS,
  COURSE_TICKET_TIERS,
  DERBY_SOURCES,
  derbyTiers,
  DIG_TICKET_TIERS,
  FISHING_DERBY_TICKET_TIERS,
  JUMP_TICKET_TIERS,
  today,
  type GameCornerRecord,
  type TicketSource,
} from './tickets';

/**
 * A game's pay table as the result draws it, once, after the game: its
 * tiers as rungs along a bar, the bar filled as far as this result reached,
 * and each rung's lamp lit if today has paid it, as the cabinets' own lamps
 * are (`arcade.ts`, `tiersPaidToday`). Nothing here pays anything - the tiers
 * are `tickets.ts`'s, read, and what was paid is the save's.
 */

/** One tier of a pay table. */
export interface LadderRung {
  /** What it asks, as the game writes a result: `2,500`, `0:18`, `2nd`. */
  readonly asks: string;
  readonly tickets: number;
  /** Whether this result reached it. */
  readonly reached: boolean;
  /** Whether today has paid it: its lamp is lit. */
  readonly lit: boolean;
}

export interface TicketLadder {
  readonly rungs: readonly LadderRung[];
  /** How far along the bar this result reached, 0 to 1, each rung an equal step. */
  readonly fill: number;
}

/** Whether a source is scored by time (lower is better) rather than points. */
const timed = (source: TicketSource): boolean => source === 'field-course';

const PLACE = (score: number): string => ({ 6: '1st', 5: '2nd', 4: '3rd' })[score] ?? `${7 - score}th`;

/** A source's tiers in the order they are climbed, each as what it asks and pays, or null for a source without a ladder. */
export function tiersOf(source: TicketSource): readonly { readonly at: number; readonly asks: string; readonly tickets: number }[] | null {
  const points = (tiers: readonly { readonly score: number; readonly tickets: number }[], words: (score: number) => string = (score) => score.toLocaleString('en-GB')) =>
    tiers.map((tier) => ({ at: tier.score, asks: words(tier.score), tickets: tier.tickets }));
  if (source === 'pokemon-jump') return points(JUMP_TICKET_TIERS);
  if (source === 'berry-picking') return points(BERRY_TICKET_TIERS);
  if (source === 'dig') return points(DIG_TICKET_TIERS);
  if (source === 'fishing-derby') return points(FISHING_DERBY_TICKET_TIERS);
  if (source === 'field-course') {
    // A whole second where the time is one, as a stopwatch is read at a glance.
    return COURSE_TICKET_TIERS.map((tier) => ({ at: tier.ms, asks: courseTime(tier.ms).replace(/\.00$/, ''), tickets: tier.tickets }));
  }
  const derby = (DERBY_SOURCES as readonly string[]).indexOf(source);
  if (derby >= 0) return points(derbyTiers(derby + 1), PLACE);
  return null;
}

/** How far a result is along a source's tiers: 0 at nothing, 1 at the top, each rung an equal step. */
function fillFor(source: TicketSource, tiers: readonly { readonly at: number }[], result: number): number {
  if (tiers.length === 0 || result <= 0) return 0;
  const steps = tiers.length;
  for (let index = 0; index < steps; index += 1) {
    const hi = tiers[index].at;
    if (timed(source)) {
      // A time climbs down: from twice the first rung's time to it, then on.
      const lo = index === 0 ? hi * 2 : tiers[index - 1].at;
      if (result > hi) return Math.max(0, (index + (lo - result) / (lo - hi)) / steps);
    } else {
      const lo = index === 0 ? 0 : tiers[index - 1].at;
      if (result < hi) return Math.max(0, (index + (result - lo) / (hi - lo)) / steps);
    }
  }
  return 1;
}

/**
 * The ladder for a result just played at a source, read against the record
 * after it was written: what it reached, and what today has paid.
 */
export function ticketLadder(source: TicketSource, result: number, record: GameCornerRecord, now: Date): TicketLadder | null {
  const tiers = tiersOf(source);
  if (!tiers) return null;
  const paid = today(record, now).paid[source] ?? 0;
  const reaches = (at: number): boolean => result > 0 && (timed(source) ? result <= at : result >= at);
  return {
    rungs: tiers.map((tier) => ({ asks: tier.asks, tickets: tier.tickets, reached: reaches(tier.at), lit: paid >= tier.tickets })),
    fill: fillFor(source, tiers, result),
  };
}
