import { HARBOUR_BOTS, rngFor, type HarbourBot } from '../base/harbourBots';
import type { RaidProgress } from '../save/SaveManager';
import { courseTime } from './gameCornerTalk';
import { betterResult, NO_GAME_CORNER, ticketDayKey, today, type TicketSource } from './tickets';

/**
 * THE GAME CORNER's HIGH SCORES board: today's best at every game on the
 * promenade, the player's own beside the harbour's regulars'.
 *
 * - **Today only.** The board is wiped every morning by the player's own clock,
 *   the day the ticket ledger keeps (`ticketDayKey`), so a score just made goes
 *   straight up and a good day is worth something.
 * - **The regulars play too.** Each day a few of `HARBOUR_BOTS` have played each
 *   game, and what they scored is a pure function of the day and who they are -
 *   every browser shows the same board, as every browser sees the same
 *   regulars about the yard. Their scores sit between the games' own ticket
 *   tiers, so a player who earns the top tier usually tops the board, and a
 *   good regular now and then beats them to it.
 * - **The player is YOU**, and only their today's best is on it: the save's
 *   best-ever is the cabinet's own caption.
 *
 * Phaser-free and pure, so the board's words are held by `highScores.test.ts`.
 */

/**
 * A game the board keeps: every ticket source but THE BATTLE ARENA's, whose
 * wins are on its own class and cup boards (`arena/classBoard.ts`, `arena/cups.ts`).
 */
export type BoardGame = Exclude<TicketSource, 'battle-arena' | 'rental-run'>;

/** The games on the board, in the order it lists them: the two cabinets first, then the promenade's. */
export const BOARD_GAMES: readonly BoardGame[] = ['pokemon-jump', 'berry-picking', 'field-course', 'derby', 'dig', 'fishing-derby'];

/** What each game is called on the board: short, because the board is five tiles wide. */
export const BOARD_GAME_NAMES: Readonly<Record<BoardGame, string>> = {
  'pokemon-jump': 'JUMP',
  'berry-picking': 'BERRY',
  'field-course': 'COURSE',
  derby: 'DERBY',
  dig: 'DIG',
  'fishing-derby': 'FISHING',
};

/** How many of the regulars have played each game on any one day. */
export const REGULARS_A_GAME = 3;

/** How many places the board shows a game, read aloud. */
export const PLACES_SHOWN = 3;

/** The name the player goes by on the board. */
export const YOU = 'YOU';

/**
 * What a regular scores at each game, as the low and high of what they might
 * do on a day: from a little past the first ticket tier to round the top one
 * (`tickets.ts`), on each game's own scale - points, a time in milliseconds
 * (lower is better), the derby's place points (six for a win), the dig's
 * points and the fishing tally.
 */
const REGULAR_RANGE: Readonly<Record<BoardGame, { readonly low: number; readonly high: number; readonly step: number }>> = {
  'pokemon-jump': { low: 400, high: 6800, step: 10 },
  'berry-picking': { low: 1100, high: 6400, step: 10 },
  'field-course': { low: 14_800, high: 29_000, step: 10 },
  derby: { low: 3, high: 6, step: 1 },
  dig: { low: 15, high: 45, step: 5 },
  'fishing-derby': { low: 60, high: 230, step: 5 },
};

/** One line of the board. */
export interface HighScore {
  readonly name: string;
  readonly result: number;
  /** Whether it is the player's own. */
  readonly yours: boolean;
}

/** A number of the day: the same for every browser on the same date. */
function dayNumber(now: Date): number {
  const [year, month, day] = ticketDayKey(now).split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Which regulars played a game today. */
export function regularsWhoPlayed(game: BoardGame, now: Date): readonly HarbourBot[] {
  const rng = rngFor(41, dayNumber(now), BOARD_GAMES.indexOf(game));
  return rng.shuffle(HARBOUR_BOTS).slice(0, REGULARS_A_GAME);
}

/** What a regular scored at a game today: their own result, the same on every screen. */
export function regularResult(bot: HarbourBot, game: BoardGame, now: Date): number {
  const range = REGULAR_RANGE[game];
  const rng = rngFor(42, dayNumber(now), BOARD_GAMES.indexOf(game), HARBOUR_BOTS.indexOf(bot));
  // Two rolls averaged: most days are middling, a few are very good or poor.
  const share = (rng.next() + rng.next()) / 2;
  const raw = range.low + share * (range.high - range.low);
  return Math.round(raw / range.step) * range.step;
}

/** The board's lines for one game today, best first: the regulars who played it, and the player if they did. */
export function highScoresFor(game: BoardGame, progress: Pick<RaidProgress, 'gameCorner'>, now: Date): readonly HighScore[] {
  const lines: HighScore[] = regularsWhoPlayed(game, now).map((bot) => ({ name: bot.name, result: regularResult(bot, game, now), yours: false }));
  const yours = today(progress.gameCorner ?? NO_GAME_CORNER, now).best[game] ?? 0;
  if (yours > 0) {
    lines.push({ name: YOU, result: yours, yours: true });
  }
  // Better first; on a tie the player's own goes first, since they made it last.
  return lines.sort((a, b) => {
    if (a.result === b.result) return Number(b.yours) - Number(a.yours);
    return betterResult(game, a.result, b.result) === a.result ? -1 : 1;
  });
}

/** A result as the board writes it: points with commas, a time on a stopwatch, a derby place. */
export function boardResult(game: BoardGame, result: number): string {
  if (game === 'field-course') return courseTime(result);
  if (game === 'derby') return ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH'][Math.max(0, Math.min(5, 6 - result))];
  return result.toLocaleString('en-GB');
}

/** The top of the board for one game, as one short line: `JUMP 4,210 YOU`. */
export function boardLine(game: BoardGame, progress: Pick<RaidProgress, 'gameCorner'>, now: Date): { readonly game: string; readonly result: string; readonly name: string; readonly yours: boolean } {
  const [top] = highScoresFor(game, progress, now);
  return { game: BOARD_GAME_NAMES[game], result: boardResult(game, top.result), name: top.name, yours: top.yours };
}

/** Where the player stands at a game today: 1 for the top of the board, or null if they have not played it. */
export function yourPlace(game: BoardGame, progress: Pick<RaidProgress, 'gameCorner'>, now: Date): number | null {
  const at = highScoresFor(game, progress, now).findIndex((line) => line.yours);
  return at < 0 ? null : at + 1;
}

/**
 * What the board says when it is read: a line a game, its top three today in order,
 * and a last word on where the player stands. Each line fits the dialogue box.
 */
export function highScoresLines(progress: Pick<RaidProgress, 'gameCorner'>, now: Date): readonly string[] {
  const lines = BOARD_GAMES.map((game) => {
    const places = highScoresFor(game, progress, now)
      .slice(0, PLACES_SHOWN)
      .map((line) => `${line.name} ${boardResult(game, line.result)}`);
    return `${BOARD_GAME_NAMES[game]}: ${places.join(', ')}`;
  });
  const tops = BOARD_GAMES.filter((game) => yourPlace(game, progress, now) === 1).map((game) => BOARD_GAME_NAMES[game]);
  const played = BOARD_GAMES.some((game) => yourPlace(game, progress, now) !== null);
  const last = tops.length > 0
    ? `You top the board at ${tops.join(', ')} today. It is wiped every morning.`
    : played
      ? 'Not top of anything yet today. The board is wiped every morning.'
      : 'Nothing of yours on it today. Play anything on the promenade.';
  // The caption over the board already says what it is, so the first line is a score.
  return [...lines, last];
}
