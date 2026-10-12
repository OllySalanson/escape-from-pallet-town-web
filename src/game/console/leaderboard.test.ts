import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_ANSWER_MS,
  BOARD_SIZE,
  BoardTrouble,
  CONSOLE_SCORE_LIMITS,
  DEVICE_BOARD_STORAGE_PREFIX,
  DeviceBoard,
  formatScore,
  Leaderboards,
  MAX_WAITING_SCORES,
  POST_ANSWER_MS,
  postableScore,
  WaitingScores,
  type BoardEntry,
  type ConsoleScore,
  type PalletTownBoards,
} from './leaderboard';

function memoryStore() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

const game = (score: number, extra: Partial<ConsoleScore> = {}): ConsoleScore => ({
  score,
  lines: 10,
  level: 2,
  durationMs: 120_000,
  ...extra,
});

/** A Pallet Town that answers, or does not. */
function palletTown(answers: boolean, entries: BoardEntry[] = []) {
  const posted: { game: string; name: string; score: ConsoleScore }[] = [];
  const remote: PalletTownBoards = {
    load: () => (answers ? Promise.resolve(entries) : Promise.reject(new Error('offline'))),
    post: (gameId, name, score) => {
      if (!answers) return Promise.reject(new Error('offline'));
      posted.push({ game: gameId, name, score });
      return Promise.resolve();
    },
  };
  return { remote, posted };
}

describe("this device's own board", () => {
  it('keeps the best score under each name, best first, ten of them', () => {
    const board = new DeviceBoard(memoryStore());
    board.record('pallet-blocks', 'ASH', 500, 1);
    board.record('pallet-blocks', 'ASH', 300, 2);
    board.record('pallet-blocks', 'MISTY', 900, 3);
    board.record('pallet-blocks', 'ASH', 1200, 4);
    expect(board.entries('pallet-blocks', 'ASH')).toEqual([
      { name: 'ASH', score: 1200, mine: true },
      { name: 'MISTY', score: 900, mine: false },
    ]);
    for (let index = 0; index < 15; index += 1) {
      board.record('pallet-blocks', `P${index}`, index * 10, 10 + index);
    }
    expect(board.entries('pallet-blocks', null)).toHaveLength(BOARD_SIZE);
    expect(board.entries('pallet-blocks', null)[0].name).toBe('ASH');
  });

  it('gives an equal score to whoever got there first', () => {
    const board = new DeviceBoard(memoryStore());
    board.record('pallet-blocks', 'LATE', 100, 20);
    board.record('pallet-blocks', 'EARLY', 100, 10);
    expect(board.entries('pallet-blocks', null).map((entry) => entry.name)).toEqual(['EARLY', 'LATE']);
  });

  it('keeps each game apart', () => {
    const store = memoryStore();
    const board = new DeviceBoard(store);
    board.record('pallet-blocks', 'ASH', 100, 1);
    expect(board.entries('another-game', null)).toEqual([]);
    expect([...store.values.keys()]).toEqual([`${DEVICE_BOARD_STORAGE_PREFIX}pallet-blocks`]);
  });

  it('reads rubbish or a refusing storage as an empty board, and never throws', () => {
    const store = memoryStore();
    store.values.set(`${DEVICE_BOARD_STORAGE_PREFIX}pallet-blocks`, '{not json');
    expect(new DeviceBoard(store).entries('pallet-blocks', null)).toEqual([]);
    store.values.set(`${DEVICE_BOARD_STORAGE_PREFIX}pallet-blocks`, JSON.stringify([{ name: 1 }, 'x', null]));
    expect(new DeviceBoard(store).entries('pallet-blocks', null)).toEqual([]);
    const refusing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const board = new DeviceBoard(refusing);
    expect(() => board.record('pallet-blocks', 'ASH', 1, 1)).not.toThrow();
    expect(board.entries('pallet-blocks', 'ASH')).toEqual([]);
  });
});

describe('which scores the boards take', () => {
  it('takes an honest game', () => {
    expect(postableScore(game(12_340))).toBe(true);
    expect(postableScore(game(0, { lines: 0, level: 1, durationMs: 1_000 }))).toBe(true);
  });

  it('refuses what no game could finish on, as the database does', () => {
    expect(postableScore(game(-1))).toBe(false);
    expect(postableScore(game(1.5))).toBe(false);
    expect(postableScore(game(CONSOLE_SCORE_LIMITS.maxScore + 1, { durationMs: CONSOLE_SCORE_LIMITS.maxDurationMs }))).toBe(false);
    expect(postableScore(game(100, { level: 0 }))).toBe(false);
    expect(postableScore(game(100, { durationMs: 999 }))).toBe(false);
    // Fifty thousand points a second of play, and not a point more.
    expect(postableScore(game(100_000, { durationMs: 1_000 }))).toBe(true);
    expect(postableScore(game(100_001, { durationMs: 1_000 }))).toBe(false);
    expect(postableScore(game(1, { score: Number.NaN }))).toBe(false);
  });
});

describe('the board the console shows', () => {
  it("is Pallet Town's whenever Pallet Town answers", async () => {
    const town = palletTown(true, [{ name: 'BROCK', score: 4000, mine: false }]);
    const boards = new Leaderboards(town.remote, new DeviceBoard(memoryStore()));
    expect(await boards.load('pallet-blocks', 'ASH')).toEqual({
      where: 'pallet-town',
      entries: [{ name: 'BROCK', score: 4000, mine: false }],
    });
  });

  it("falls back on this device's board, and says so, when Pallet Town does not", async () => {
    const device = new DeviceBoard(memoryStore());
    device.record('pallet-blocks', 'ASH', 700, 1);
    const boards = new Leaderboards(palletTown(false).remote, device);
    expect(await boards.load('pallet-blocks', 'ASH')).toEqual({
      where: 'device',
      entries: [{ name: 'ASH', score: 700, mine: true }],
    });
  });

  describe('when Pallet Town never answers at all', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    // A connection that hangs rather than fails: the menu used to say it was
    // asking for the board for as long as anybody sat there.
    const silent: PalletTownBoards = {
      load: () => new Promise(() => undefined),
      post: () => new Promise(() => undefined),
    };

    it("stops waiting and shows this device's board", async () => {
      vi.useFakeTimers();
      const device = new DeviceBoard(memoryStore());
      device.record('pallet-blocks', 'ASH', 700, 1);
      let shown: unknown;
      void new Leaderboards(silent, device).load('pallet-blocks', 'ASH').then((board) => (shown = board));
      await vi.advanceTimersByTimeAsync(BOARD_ANSWER_MS);
      expect(shown).toEqual({ where: 'device', entries: [{ name: 'ASH', score: 700, mine: true }] });
    });

    it('keeps the score here, stops waiting to send it - a bot check asked included - and sends it another time', async () => {
      vi.useFakeTimers();
      const device = new DeviceBoard(memoryStore());
      const waiting = new WaitingScores(memoryStore());
      let posted: unknown;
      void new Leaderboards(silent, device, () => 5, waiting)
        .post('pallet-blocks', 'ASH', game(800))
        .then((where) => (posted = where));
      await vi.advanceTimersByTimeAsync(BOARD_ANSWER_MS);
      expect(posted).toBeUndefined();
      await vi.advanceTimersByTimeAsync(POST_ANSWER_MS - BOARD_ANSWER_MS);
      expect(posted).toBe('device');
      expect(device.entries('pallet-blocks', 'ASH')).toEqual([{ name: 'ASH', score: 800, mine: true }]);
      expect(waiting.all()).toEqual([{ game: 'pallet-blocks', name: 'ASH', score: game(800), at: 5 }]);
    });
  });

  it('keeps every score here and sends it to Pallet Town, whole numbers only', async () => {
    const device = new DeviceBoard(memoryStore());
    const town = palletTown(true);
    const boards = new Leaderboards(town.remote, device, () => 5);
    expect(await boards.post('pallet-blocks', 'ASH', game(1234.9, { durationMs: 60_000.4 }))).toBe('pallet-town');
    expect(town.posted).toEqual([
      { game: 'pallet-blocks', name: 'ASH', score: { score: 1234, lines: 10, level: 2, durationMs: 60_000 } },
    ]);
    expect(device.entries('pallet-blocks', 'ASH')).toEqual([{ name: 'ASH', score: 1234, mine: true }]);
  });

  it('keeps a score on this device when Pallet Town cannot take it', async () => {
    const device = new DeviceBoard(memoryStore());
    const boards = new Leaderboards(palletTown(false).remote, device);
    expect(await boards.post('pallet-blocks', 'ASH', game(800))).toBe('device');
    expect(device.entries('pallet-blocks', 'ASH')).toEqual([{ name: 'ASH', score: 800, mine: true }]);
  });

  it('sends nowhere a score no game could finish on', async () => {
    const device = new DeviceBoard(memoryStore());
    const town = palletTown(true);
    const boards = new Leaderboards(town.remote, device);
    expect(await boards.post('pallet-blocks', 'ASH', game(99_999_999, { durationMs: 2_000 }))).toBe('not-postable');
    expect(town.posted).toEqual([]);
    expect(device.entries('pallet-blocks', 'ASH')).toEqual([]);
  });
});

describe('a score on a board', () => {
  it('is grouped in threes', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
    expect(formatScore(12_340)).toBe('12,340');
    expect(formatScore(99_999_999)).toBe('99,999,999');
  });
});

describe('a score that did not reach Pallet Town', () => {
  const refusing = (trouble: BoardTrouble): PalletTownBoards => ({
    load: () => Promise.resolve([]),
    post: () => Promise.reject(trouble),
  });

  it('is kept waiting, and says whether the bot check is why', async () => {
    const waiting = new WaitingScores(memoryStore());
    const check = new Leaderboards(refusing(new BoardTrouble('check', 'no check')), new DeviceBoard(memoryStore()), () => 1, waiting);
    expect(await check.post('pallet-blocks', 'ASH', game(800))).toBe('bot-check');
    const later = new Leaderboards(refusing(new BoardTrouble('later', 'limit')), new DeviceBoard(memoryStore()), () => 2, waiting);
    expect(await later.post('pallet-blocks', 'MAY', game(500))).toBe('device');
    expect(waiting.all().map((entry) => entry.name)).toEqual(['ASH', 'MAY']);
    expect(check.waitingCount()).toBe(2);
  });

  it('is let go when Pallet Town refuses it for good, and is still on this device', async () => {
    const waiting = new WaitingScores(memoryStore());
    const device = new DeviceBoard(memoryStore());
    const boards = new Leaderboards(refusing(new BoardTrouble('refused', 'Pick another name.')), device, () => 1, waiting);
    expect(await boards.post('pallet-blocks', 'ASH', game(800))).toBe('not-postable');
    expect(waiting.all()).toEqual([]);
    expect(device.entries('pallet-blocks', 'ASH')[0]?.score).toBe(800);
  });

  it('keeps only the best waiting under each name, and never more than the cap', () => {
    const waiting = new WaitingScores(memoryStore());
    waiting.keep('pallet-blocks', 'ASH', game(800), 1);
    waiting.keep('pallet-blocks', 'ASH', game(300), 2);
    waiting.keep('pallet-blocks', 'ASH', game(900), 3);
    expect(waiting.all()).toEqual([{ game: 'pallet-blocks', name: 'ASH', score: game(900), at: 3 }]);
    for (let index = 0; index < MAX_WAITING_SCORES + 5; index += 1) {
      waiting.keep('pallet-blocks', `P${index}`, game(100), index);
    }
    expect(waiting.all()).toHaveLength(MAX_WAITING_SCORES);
  });

  it('reads a list that is rubbish, or a score no game could finish on, as nothing waiting', () => {
    const store = memoryStore();
    store.setItem('escape-from-pallet-town.console.waiting', '{"not":"a list"}');
    expect(new WaitingScores(store).all()).toEqual([]);
    store.setItem(
      'escape-from-pallet-town.console.waiting',
      JSON.stringify([{ game: 'pallet-blocks', name: 'ASH', score: game(99_999_999, { durationMs: 1000 }), at: 1 }]),
    );
    expect(new WaitingScores(store).all()).toEqual([]);
  });

  it('goes up the next time, oldest first, and the rest wait behind the first that cannot', async () => {
    const waiting = new WaitingScores(memoryStore());
    waiting.keep('pallet-blocks', 'MAY', game(500), 2);
    waiting.keep('pallet-blocks', 'ASH', game(800), 1);
    waiting.keep('pallet-blocks', 'GARY', game(700), 3);
    const posted: string[] = [];
    let open = true;
    const remote: PalletTownBoards = {
      load: () => Promise.resolve([]),
      post: (_game, name) => {
        if (name === 'GARY' && open) {
          return Promise.reject(new BoardTrouble('check', 'no check'));
        }
        posted.push(name);
        return Promise.resolve();
      },
    };
    const boards = new Leaderboards(remote, new DeviceBoard(memoryStore()), () => 9, waiting);
    expect(await boards.sendWaiting()).toEqual({ sent: 2, left: 1, stopped: 'bot-check' });
    expect(posted).toEqual(['ASH', 'MAY']);
    open = false;
    expect(await boards.sendWaiting()).toEqual({ sent: 1, left: 0 });
    expect(boards.waitingCount()).toBe(0);
  });

  it('lets a score Pallet Town refuses for good go, so it never stands in front of the rest', async () => {
    const waiting = new WaitingScores(memoryStore());
    waiting.keep('pallet-blocks', 'BAD', game(500), 1);
    waiting.keep('pallet-blocks', 'ASH', game(800), 2);
    const remote: PalletTownBoards = {
      load: () => Promise.resolve([]),
      post: (_game, name) => (name === 'BAD' ? Promise.reject(new BoardTrouble('refused', 'Pick another name.')) : Promise.resolve()),
    };
    expect(await new Leaderboards(remote, new DeviceBoard(memoryStore()), () => 9, waiting).sendWaiting()).toEqual({ sent: 1, left: 0 });
  });
});
