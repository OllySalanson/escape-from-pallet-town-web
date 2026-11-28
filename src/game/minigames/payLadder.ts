import { getItemById } from '../items/items';
import { courseTime } from './gameCornerTalk';
import { BERRY_PICKING_PRIZE_SCORE } from './generated/berryPicking';
import { POKEMON_JUMP_PRIZES } from './generated/pokemonJump';
import {
  BERRY_TICKET_TIERS,
  COURSE_TICKET_TIERS,
  derbyTiers,
  DIG_TICKET_TIERS,
  FISHING_DERBY_TICKET_TIERS,
  JUMP_TICKET_TIERS,
  type GamePayout,
} from './tickets';

/**
 * What a harbour minigame pays, as its result card draws it: a ladder of gold
 * tickets, each under what it asks, the rungs today's best has reached lit.
 * It is the one place a game's pay table is shown - after a game, never
 * before one, and once (the harbour audit, 27 Nov 2026, fault 3: the cabinet's
 * form printed it before play, and its result said the first rung twice).
 *
 * Pure: the tiers are `tickets.ts`'s, untouched.
 */

/** One rung: what it asks, as the game counts it, and what it pays. */
export interface PayRung {
  /** `250`, `0:18.00`, `2ND`. */
  readonly ask: string;
  readonly tickets: number;
  /** Whether today's best has reached it. */
  readonly reached: boolean;
}

export interface PayLadder {
  readonly rungs: readonly PayRung[];
  /** The score a BERRY is won from too, for the cabinets that pay one, as the game counts it. */
  readonly berryFrom: string | null;
}

/** The game a ladder is for. THE DERBY's names its level: each pays its own. */
export type LadderGame =
  | { readonly kind: 'pokemon-jump' }
  | { readonly kind: 'berry-picking' }
  | { readonly kind: 'field-course' }
  | { readonly kind: 'derby'; readonly level: number }
  | { readonly kind: 'dig' }
  | { readonly kind: 'fishing-derby' };

const number = (value: number): string => value.toLocaleString('en-GB');

/** A DERBY rung's place, by `derbyScore` (six for a win). */
const PLACE: Readonly<Record<number, string>> = { 6: '1ST', 5: '2ND', 4: '3RD' };

/**
 * The game's ladder against today's best (0, or nothing, for a day not yet
 * played): a score or a place reaches a rung at or above it, a time round
 * the course one at or under it.
 */
export function payLadder(game: LadderGame, best: number | undefined): PayLadder {
  const today = best ?? 0;
  const scored = (tiers: readonly { readonly score: number; readonly tickets: number }[], ask: (score: number) => string): PayRung[] =>
    tiers.map((tier) => ({ ask: ask(tier.score), tickets: tier.tickets, reached: today >= tier.score }));
  switch (game.kind) {
    case 'pokemon-jump':
      return { rungs: scored(JUMP_TICKET_TIERS, number), berryFrom: number(POKEMON_JUMP_PRIZES[0]?.score ?? 0) };
    case 'berry-picking':
      return { rungs: scored(BERRY_TICKET_TIERS, number), berryFrom: number(BERRY_PICKING_PRIZE_SCORE) };
    case 'field-course':
      return {
        rungs: COURSE_TICKET_TIERS.map((tier) => ({ ask: courseTime(tier.ms), tickets: tier.tickets, reached: today > 0 && today <= tier.ms })),
        berryFrom: null,
      };
    case 'derby':
      return { rungs: scored(derbyTiers(game.level), (score) => PLACE[score] ?? `${score}`), berryFrom: null };
    case 'dig':
      return { rungs: scored(DIG_TICKET_TIERS, number), berryFrom: null };
    case 'fishing-derby':
      return { rungs: scored(FISHING_DERBY_TICKET_TIERS, number), berryFrom: null };
  }
}

/**
 * What a game won, in a line over its ladder: what came home, or that nothing
 * did. Never what the first rung asks - the ladder under it shows that - so
 * the card says the pay rule once (`tickets.payoutWords` says it in words,
 * where there is no ladder).
 */
export function wonLine(payout: GamePayout, won: readonly string[]): string {
  if (won.length > 0) return `${payout.newBest ? 'A new best! ' : ''}Won ${won.join(', ')}.`;
  if (payout.firstTier !== null) return 'No tickets.';
  const course = payout.course;
  const unpaid = payout.bestToday
    ? `Nothing more today: ${course ?? 'the day'} has paid this tier.`
    : `Beat today’s best${course ? ` on ${course}` : ''} to win more.`;
  return `${payout.newBest ? 'A new best! ' : ''}${unpaid}`;
}

/** What came home from a game, each thing once with how many: `10 tickets`, `2 Oran Berry`. */
export function wonThings(tickets: number, itemIds: readonly string[]): string[] {
  const won: string[] = [];
  if (tickets > 0) won.push(`${tickets} tickets`);
  for (const itemId of new Set(itemIds)) {
    const count = itemIds.filter((other) => other === itemId).length;
    won.push(`${count > 1 ? `${count} ` : ''}${getItemById(itemId)?.displayName ?? itemId}`);
  }
  return won;
}
