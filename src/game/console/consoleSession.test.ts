import { describe, expect, it, vi } from 'vitest';
import type { ConsoleGame, ConsoleGameHost } from './consoleGames';
import { ConsoleSession } from './consoleSession';
import type { Board, ConsoleScore, Posted } from './leaderboard';

/** A stand-in game that remembers what the console handed it. */
function fakeGame(options: { fails?: boolean } = {}) {
  const seen: { element?: HTMLElement; host?: ConsoleGameHost; destroyed: number } = { destroyed: 0 };
  const game: ConsoleGame = {
    id: 'pallet-blocks',
    name: 'PALLET BLOCKS',
    blurb: '',
    help: '',
    mount: (element, host) => {
      if (options.fails) {
        return Promise.reject(new Error('no such module'));
      }
      seen.element = element;
      seen.host = host;
      return Promise.resolve({ destroy: () => void (seen.destroyed += 1) });
    },
  };
  return { game, seen };
}

function harness(
  board: Board = { where: 'pallet-town', entries: [{ name: 'BROCK', score: 900, mine: false }] },
  claims: Readonly<Record<string, string | null>> = {},
) {
  const log: string[] = [];
  const posted: { game: string; name: string; score: ConsoleScore }[] = [];
  const hosts: { removed: boolean }[] = [];
  const queued: (() => void)[] = [];
  const session = new ConsoleSession({
    leaderboards: {
      load: () => Promise.resolve(board),
      post: (game, name, score): Promise<Posted> => {
        posted.push({ game, name, score });
        return Promise.resolve('pallet-town');
      },
    },
    hideMenu: () => log.push('menu down'),
    showMenu: (status) => log.push(`menu up: ${status}`),
    makeHost: () => {
      const host = { removed: false, remove: () => void (host.removed = true) };
      hosts.push(host);
      return host as unknown as HTMLElement;
    },
    boardRead: (game, read) => log.push(`board ${game.id} ${read.where}`),
    leave: () => log.push('back to the house'),
    later: (run) => void queued.push(run),
    claimName: (typed) => Promise.resolve(typed in claims ? claims[typed] : typed),
    scoreUnnamed: (game, score, typed) => log.push(`unnamed ${game.id} ${score} ${typed}`),
  });
  return { session, log, posted, hosts, queued };
}

describe('handing a game over from the console and back', () => {
  it('takes the menu down and starts the game in its own element, under the typed name', async () => {
    const { game, seen } = fakeGame();
    const { session, log, hosts } = harness();
    await session.play(game, 'ASH');
    expect(log).toEqual(['menu down']);
    expect(seen.element).toBe(hosts[0]);
    expect(seen.host?.playerName).toBe('ASH');
    expect(session.playing).toBe(game);
  });

  it('puts every finished game on the boards under that name', async () => {
    const { game, seen } = fakeGame();
    const { session, posted } = harness();
    await session.play(game, 'ASH');
    await seen.host!.onGameOver({ score: 4200, lines: 12, level: 2, durationMs: 95_000 });
    expect(posted).toEqual([{ game: 'pallet-blocks', name: 'ASH', score: { score: 4200, lines: 12, level: 2, durationMs: 95_000 } }]);
  });

  /**
   * A console in your own room plays at once: named nowhere yet, the game asks
   * at its end, and only for a score that earns a place (the harbour re-critic).
   */
  it('plays with no name, and posts a score under the name the game asked for once it is claimed', async () => {
    const { game, seen } = fakeGame();
    const { session, posted } = harness();
    await session.play(game, null);
    expect(seen.host?.playerName).toBeNull();
    await seen.host!.onGameOver({ score: 4200, lines: 12, level: 2, durationMs: 95_000, name: 'MAY' });
    expect(posted).toEqual([{ game: 'pallet-blocks', name: 'MAY', score: { score: 4200, lines: 12, level: 2, durationMs: 95_000 } }]);
    // The next game in the sitting goes under it too, without asking.
    await seen.host!.onGameOver({ score: 100, lines: 1, level: 1, durationMs: 9_000, name: null });
    expect(posted.map((each) => each.name)).toEqual(['MAY', 'MAY']);
  });

  it('posts nothing under a name it could not claim, and says so; nor a score the game asked no name for', async () => {
    const { game, seen } = fakeGame();
    const { session, posted, log } = harness(undefined, { BROCK: null });
    await session.play(game, null);
    await seen.host!.onGameOver({ score: 300, lines: 2, level: 1, durationMs: 9_000, name: null });
    await seen.host!.onGameOver({ score: 4200, lines: 12, level: 2, durationMs: 95_000, name: 'BROCK' });
    expect(posted).toEqual([]);
    expect(log).toContain('unnamed pallet-blocks 4200 BROCK');
    expect(log.filter((line) => line.startsWith('unnamed'))).toHaveLength(1);
  });

  it("shows the console's board on the game's own screens", async () => {
    const { game, seen } = fakeGame();
    const { session, log } = harness();
    await session.play(game, 'ASH');
    expect(await seen.host!.loadLeaderboard()).toEqual([{ name: 'BROCK', score: 900, mine: false }]);
    expect(log).toContain('board pallet-blocks pallet-town');
  });

  it("leaves after the game's key has been handled, taking the game down and going back to the house", async () => {
    const { game, seen } = fakeGame();
    const { session, log, hosts, queued } = harness();
    await session.play(game, 'ASH');
    seen.host!.onExit();
    // Nothing is torn down inside the game's own key handler.
    expect(seen.destroyed).toBe(0);
    expect(hosts[0].removed).toBe(false);
    queued.forEach((run) => run());
    expect(seen.destroyed).toBe(1);
    expect(hosts[0].removed).toBe(true);
    expect(log.at(-1)).toBe('back to the house');
    expect(session.playing).toBeUndefined();
  });

  it('goes back to the menu, saying so, when a game will not start', async () => {
    const { game } = fakeGame({ fails: true });
    const { session, log, hosts } = harness();
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await session.play(game, 'ASH');
    quiet.mockRestore();
    expect(hosts[0].removed).toBe(true);
    expect(log.at(-1)).toBe('menu up: PALLET BLOCKS would not start. Try again in a moment.');
    expect(session.playing).toBeUndefined();
  });

  it('starts one game at a time', async () => {
    const { game } = fakeGame();
    const { session, hosts } = harness();
    await session.play(game, 'ASH');
    await session.play(game, 'ASH');
    expect(hosts).toHaveLength(1);
  });

  it('takes a game down that finishes loading after the player has already left', async () => {
    let release!: () => void;
    const destroyed: string[] = [];
    const slow: ConsoleGame = {
      ...fakeGame().game,
      mount: () =>
        new Promise((resolve) => {
          release = () => resolve({ destroy: () => void destroyed.push('destroyed') });
        }),
    };
    const { session, hosts } = harness();
    const starting = session.play(slow, 'ASH');
    session.leave();
    release();
    await starting;
    expect(hosts[0].removed).toBe(true);
    expect(destroyed).toEqual(['destroyed']);
  });
});
