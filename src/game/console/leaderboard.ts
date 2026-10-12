import { BOT_CHECK_TIMEOUT_MS } from '../maker/turnstile';

/**
 * The Pallet Town leaderboards the house console shows: one per game, every
 * player's best score under the name they typed.
 *
 * There are two boards behind one answer. The real one is shared by everybody
 * who plays, kept in the game's own Supabase project
 * (`supabase/migrations/*_console_leaderboards.sql`, `console/remoteScores.ts`);
 * the other is this device's own, kept beside it in `localStorage`. Every score
 * goes on the device board first and then to Pallet Town, and a board is read
 * from Pallet Town whenever it answers - so no internet, a project not yet
 * switched on or a day's limit reached costs a player their score on the shared
 * board, never the game or the score itself. The menu says which board it is
 * showing, because a board that quietly became "only this console" would tell
 * a player they were top of Pallet Town when they were top of their bedroom.
 *
 * A score that does not get there - no answer, or a bot check that did not
 * pass - is kept waiting on this device (`WaitingScores`) and sent the next
 * time the console is sat at, so it reaches the shared board in the end.
 *
 * Nothing here knows Phaser, the DOM or the network: the remote half is handed
 * in, so the rules are tested as they are.
 */

/** How many places a board shows. */
export const BOARD_SIZE = 10;

/**
 * How long Pallet Town has to answer before the console stops waiting and
 * answers from this device. A connection that never fails never answers
 * either, and without a limit the menu said it was asking for as long as the
 * player sat there.
 */
export const BOARD_ANSWER_MS = 8_000;

/**
 * What a score has to be to be posted, the database's own limits
 * (`submit_console_score`): a whole number in eight digits, a game that lasted
 * at least a second, and no more points than fifty thousand a second of play
 * could reach - well past any falling-blocks run, and short of a number nobody
 * could have scored.
 */
export const CONSOLE_SCORE_LIMITS = {
  maxScore: 99_999_999,
  maxLines: 99_999,
  maxLevel: 99,
  minDurationMs: 1_000,
  maxDurationMs: 86_400_000,
  pointsPerSecond: 50_000,
} as const;

export interface ConsoleScore {
  readonly score: number;
  readonly lines: number;
  readonly level: number;
  readonly durationMs: number;
}

export interface BoardEntry {
  readonly name: string;
  readonly score: number;
  /** The entry is this player's own (on the device board: their current name). */
  readonly mine: boolean;
}

export type BoardWhere = 'pallet-town' | 'device';

export interface Board {
  readonly where: BoardWhere;
  readonly entries: readonly BoardEntry[];
}

/** Whether a finished game's numbers are ones the boards take. */
export function postableScore(result: ConsoleScore): boolean {
  const limits = CONSOLE_SCORE_LIMITS;
  const whole = (value: number, low: number, high: number) => Number.isInteger(value) && value >= low && value <= high;
  return (
    whole(result.score, 0, limits.maxScore) &&
    whole(result.lines, 0, limits.maxLines) &&
    whole(result.level, 1, limits.maxLevel) &&
    whole(result.durationMs, limits.minDurationMs, limits.maxDurationMs) &&
    result.score <= (Math.floor(result.durationMs / 1000) + 1) * limits.pointsPerSecond
  );
}

/** A result as the boards are sent it: whole numbers, the time rounded to the millisecond. */
export function toConsoleScore(result: ConsoleScore): ConsoleScore {
  return {
    score: Math.floor(result.score),
    lines: Math.floor(result.lines),
    level: Math.floor(result.level),
    durationMs: Math.round(result.durationMs),
  };
}

interface StoredEntry {
  readonly name: string;
  readonly score: number;
  readonly at: number;
}

type BoardStore = Pick<Storage, 'getItem' | 'setItem'>;

export const DEVICE_BOARD_STORAGE_PREFIX = 'escape-from-pallet-town.console.board.';

/**
 * This device's own board for one game: the best score under each name, best
 * first, ten of them - the same rule the shared board keeps per player. A
 * storage that is missing, refuses or holds rubbish is an empty board.
 */
export class DeviceBoard {
  private readonly store: BoardStore | undefined;

  public constructor(store: BoardStore | undefined) {
    this.store = store;
  }

  public entries(game: string, me: string | null): BoardEntry[] {
    return this.read(game).map((entry) => ({ name: entry.name, score: entry.score, mine: entry.name === me }));
  }

  public record(game: string, name: string, score: number, at: number): void {
    const others = this.read(game).filter((entry) => entry.name !== name);
    const previous = this.read(game).find((entry) => entry.name === name);
    const best = previous && previous.score >= score ? previous : { name, score, at };
    const table = rankBoard([...others, best]).slice(0, BOARD_SIZE);
    try {
      this.store?.setItem(DEVICE_BOARD_STORAGE_PREFIX + game, JSON.stringify(table));
    } catch {
      // A full or refusing storage keeps the board it had.
    }
  }

  private read(game: string): StoredEntry[] {
    try {
      const raw: unknown = JSON.parse(this.store?.getItem(DEVICE_BOARD_STORAGE_PREFIX + game) ?? '[]');
      if (!Array.isArray(raw)) {
        return [];
      }
      const entries = raw.filter(
        (entry): entry is StoredEntry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as StoredEntry).name === 'string' &&
          Number.isFinite((entry as StoredEntry).score) &&
          Number.isFinite((entry as StoredEntry).at),
      );
      return rankBoard(entries).slice(0, BOARD_SIZE);
    } catch {
      return [];
    }
  }
}

/** Best first; an equal score goes to whoever got there first. */
function rankBoard(entries: readonly StoredEntry[]): StoredEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.at - b.at);
}

/**
 * The shared board, as `console/remoteScores.ts` reaches it. Either call may
 * throw; `post` throws a `BoardTrouble` when it knows why.
 */
export interface PalletTownBoards {
  load(game: string): Promise<readonly BoardEntry[]>;
  post(game: string, name: string, score: ConsoleScore): Promise<void>;
}

/**
 * Why a score did not reach Pallet Town: this browser did not get past the bot
 * check (`check`), it may go another time - no answer, a day's limit
 * (`later`) - or Pallet Town will never take it (`refused`: a name or a score
 * it turns down).
 */
export class BoardTrouble extends Error {
  public readonly kind: 'check' | 'later' | 'refused';

  public constructor(kind: 'check' | 'later' | 'refused', message: string) {
    super(message);
    this.kind = kind;
  }
}

/**
 * Where a posted score went: onto the shared board; or kept on this device and
 * waiting to go up, because the bot check did not pass (`bot-check`) or
 * Pallet Town did not answer (`device`); or nowhere, not being a score a game
 * could finish on.
 */
export type Posted = 'pallet-town' | 'device' | 'bot-check' | 'not-postable';

/**
 * How long a post may take in all, a bot check asked of the player included:
 * past it the score is kept and waits. A game shows its results the moment it
 * ends and only refreshes its board once the post has answered, so nobody
 * waits on this.
 */
export const POST_ANSWER_MS = BOT_CHECK_TIMEOUT_MS + BOARD_ANSWER_MS;

interface WaitingScore {
  readonly game: string;
  readonly name: string;
  readonly score: ConsoleScore;
  readonly at: number;
}

export const WAITING_SCORES_STORAGE_KEY = 'escape-from-pallet-town.console.waiting';

/** The most scores kept waiting at once: one per game and name, and never more than this. */
export const MAX_WAITING_SCORES = 20;

/**
 * Scores that are on this device's board but have not reached Pallet Town's
 * yet, kept until they do: the best under each name for each game, because
 * the shared board keeps a player's best and nothing else. Never lost by a
 * bot check that did not pass or a connection that did not answer - only by
 * reaching the board, or by Pallet Town refusing them for good.
 */
export class WaitingScores {
  private readonly store: BoardStore | undefined;

  public constructor(store: BoardStore | undefined) {
    this.store = store;
  }

  public all(): readonly WaitingScore[] {
    try {
      const raw: unknown = JSON.parse(this.store?.getItem(WAITING_SCORES_STORAGE_KEY) ?? '[]');
      return Array.isArray(raw) ? raw.filter(isWaitingScore) : [];
    } catch {
      return [];
    }
  }

  public keep(game: string, name: string, score: ConsoleScore, at: number): void {
    const previous = this.all().find((entry) => entry.game === game && entry.name === name);
    if (previous && previous.score.score >= score.score) {
      return;
    }
    const others = this.all().filter((entry) => !(entry.game === game && entry.name === name));
    this.write([...others, { game, name, score, at }].slice(-MAX_WAITING_SCORES));
  }

  /** Takes a score off the list once it has reached the board, or never will. */
  public forget(game: string, name: string, score: number): void {
    this.write(this.all().filter((entry) => !(entry.game === game && entry.name === name && entry.score.score <= score)));
  }

  private write(entries: readonly WaitingScore[]): void {
    try {
      this.store?.setItem(WAITING_SCORES_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // A full or refusing storage keeps the list it had.
    }
  }
}

function isWaitingScore(entry: unknown): entry is WaitingScore {
  const candidate = entry as WaitingScore;
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof candidate.game === 'string' &&
    typeof candidate.name === 'string' &&
    Number.isFinite(candidate.at) &&
    typeof candidate.score === 'object' &&
    candidate.score !== null &&
    postableScore(candidate.score)
  );
}

/** What a try at the waiting scores came to. */
export interface WaitingSent {
  readonly sent: number;
  readonly left: number;
  /** Why the rest are still waiting, when some are. */
  readonly stopped?: 'bot-check' | 'device';
}

/**
 * The one answer the console asks for: a game's board, from Pallet Town when it
 * answers and from this device when it does not; and a score, kept here and
 * sent there.
 */
export class Leaderboards {
  private readonly remote: PalletTownBoards;
  private readonly device: DeviceBoard;
  private readonly waiting: WaitingScores;
  private readonly now: () => number;

  public constructor(
    remote: PalletTownBoards,
    device: DeviceBoard,
    now: () => number = Date.now,
    waiting: WaitingScores = new WaitingScores(undefined),
  ) {
    this.remote = remote;
    this.device = device;
    this.now = now;
    this.waiting = waiting;
  }

  /** How many scores are on this device waiting to reach Pallet Town. */
  public waitingCount(): number {
    return this.waiting.all().length;
  }

  public async load(game: string, me: string | null): Promise<Board> {
    try {
      const entries = await answeredWithin(this.remote.load(game), BOARD_ANSWER_MS);
      return { where: 'pallet-town', entries: entries.slice(0, BOARD_SIZE) };
    } catch {
      return { where: 'device', entries: this.device.entries(game, me) };
    }
  }

  public async post(game: string, name: string, result: ConsoleScore): Promise<Posted> {
    const score = toConsoleScore(result);
    if (!postableScore(score)) {
      return 'not-postable';
    }
    const at = this.now();
    this.device.record(game, name, score.score, at);
    const posted = await this.send(game, name, score);
    if (posted !== 'pallet-town' && posted !== 'not-postable') {
      this.waiting.keep(game, name, score, at);
    }
    return posted;
  }

  /**
   * Sends the scores waiting on this device, oldest first, stopping at the
   * first that cannot go now - what stops one stops the rest. A score Pallet
   * Town refuses for good is let go so it never stands in front of the others.
   */
  public async sendWaiting(): Promise<WaitingSent> {
    let sent = 0;
    for (const entry of [...this.waiting.all()].sort((a, b) => a.at - b.at)) {
      const posted = await this.send(entry.game, entry.name, entry.score);
      if (posted === 'bot-check' || posted === 'device') {
        return { sent, left: this.waiting.all().length, stopped: posted };
      }
      this.waiting.forget(entry.game, entry.name, entry.score.score);
      if (posted === 'pallet-town') {
        sent += 1;
      }
    }
    return { sent, left: this.waiting.all().length };
  }

  /** One try at the shared board; `not-postable` here is Pallet Town refusing it for good. */
  private async send(game: string, name: string, score: ConsoleScore): Promise<Posted> {
    try {
      await answeredWithin(this.remote.post(game, name, score), POST_ANSWER_MS);
      return 'pallet-town';
    } catch (error) {
      if (error instanceof BoardTrouble) {
        return error.kind === 'check' ? 'bot-check' : error.kind === 'refused' ? 'not-postable' : 'device';
      }
      return 'device';
    }
  }
}

/** What was asked, or a throw once `ms` has passed with no answer. */
async function answeredWithin<T>(asked: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const silence = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Pallet Town did not answer')), ms);
  });
  try {
    return await Promise.race([asked, silence]);
  } finally {
    clearTimeout(timer);
  }
}

/** A score as a board prints it: grouped in threes, as the games print them. */
export function formatScore(score: number): string {
  return Math.floor(score)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
