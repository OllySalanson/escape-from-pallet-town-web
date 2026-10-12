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
 * Nothing here knows Phaser, the DOM or the network: the remote half is handed
 * in, so the rules are tested as they are.
 */

/** How many places a board shows. */
export const BOARD_SIZE = 10;

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

/** The shared board, as `console/remoteScores.ts` reaches it. Either call may throw. */
export interface PalletTownBoards {
  load(game: string): Promise<readonly BoardEntry[]>;
  post(game: string, name: string, score: ConsoleScore): Promise<void>;
}

/** Where a posted score went: onto the shared board, or only onto this device's. */
export type Posted = 'pallet-town' | 'device' | 'not-postable';

/**
 * The one answer the console asks for: a game's board, from Pallet Town when it
 * answers and from this device when it does not; and a score, kept here and
 * sent there.
 */
export class Leaderboards {
  private readonly remote: PalletTownBoards;
  private readonly device: DeviceBoard;
  private readonly now: () => number;

  public constructor(remote: PalletTownBoards, device: DeviceBoard, now: () => number = Date.now) {
    this.remote = remote;
    this.device = device;
    this.now = now;
  }

  public async load(game: string, me: string | null): Promise<Board> {
    try {
      const entries = await this.remote.load(game);
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
    this.device.record(game, name, score.score, this.now());
    try {
      await this.remote.post(game, name, score);
      return 'pallet-town';
    } catch {
      return 'device';
    }
  }
}

/** A score as a board prints it: grouped in threes, as the games print them. */
export function formatScore(score: number): string {
  return Math.floor(score)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
