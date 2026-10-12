import type { ConsoleGame, ConsoleGameHandle } from './consoleGames';
import type { Board, Leaderboards, Posted } from './leaderboard';

/** What the session asks of whoever hosts it - the scene, or a test. */
export interface ConsoleSessionHooks {
  readonly leaderboards: Pick<Leaderboards, 'load' | 'post'>;
  /** Takes the menu down - and its hold on the keyboard - for a game to play. */
  readonly hideMenu: () => void;
  /** Puts the menu back up, saying why, when a game would not start. */
  readonly showMenu: (status: string) => void;
  /** Makes the full-window element a game is played in. */
  readonly makeHost: (game: ConsoleGame) => HTMLElement;
  /** A board has been read again; the menu shows it. */
  readonly boardRead: (game: ConsoleGame, board: Board) => void;
  /** The player is done with the console: back to the house. */
  readonly leave: () => void;
  /** Runs a function once the current event has finished. */
  readonly later: (run: () => void) => void;
  /** A line for the feedback log. */
  readonly record?: (line: string) => void;
}

/**
 * One sitting at the console: the game being played, if one is, and the
 * handoff between it and the console.
 *
 * Kept apart from the Phaser scene so the handoff is tested as it is: a game is
 * started with the name typed at the console, every finished game goes onto the
 * boards, the board it shows is the console's, and leaving takes the game down
 * and goes back to the house - however the game ends, and even if it never
 * started.
 */
export class ConsoleSession {
  private readonly hooks: ConsoleSessionHooks;
  private current: { game: ConsoleGame; host: HTMLElement; handle: ConsoleGameHandle | undefined } | undefined;

  public constructor(hooks: ConsoleSessionHooks) {
    this.hooks = hooks;
  }

  /** The game being played, if one is. */
  public get playing(): ConsoleGame | undefined {
    return this.current?.game;
  }

  /** A game's board, from Pallet Town when it answers and this device when not. */
  public async readBoard(game: ConsoleGame, playerName: string | null): Promise<Board> {
    const board = await this.hooks.leaderboards.load(game.id, playerName);
    this.hooks.boardRead(game, board);
    return board;
  }

  /** Starts a game under a name. Returns once it is mounted, or has failed to. */
  public async play(game: ConsoleGame, playerName: string): Promise<void> {
    if (this.current) {
      return;
    }
    this.hooks.record?.(`Played ${game.name}`);
    this.hooks.hideMenu();
    const host = this.hooks.makeHost(game);
    const sitting: NonNullable<ConsoleSession['current']> = { game, host, handle: undefined };
    this.current = sitting;
    try {
      const handle = await game.mount(host, {
        playerName,
        onGameOver: async (result) => {
          const posted: Posted = await this.hooks.leaderboards.post(game.id, playerName, result);
          this.hooks.record?.(`Finished ${game.name}: ${result.score} (${posted})`);
        },
        loadLeaderboard: async () => (await this.readBoard(game, playerName)).entries,
        // After the game's own key handler has finished with the key that
        // asked to leave, never in the middle of it.
        onExit: () => this.hooks.later(() => this.leave()),
      });
      if (this.current === sitting) {
        sitting.handle = handle;
      } else {
        handle.destroy();
      }
    } catch (error) {
      console.error(`console: ${game.name} would not start`, error);
      if (this.current !== sitting) {
        return;
      }
      this.takeDown();
      this.hooks.showMenu(`${game.name} would not start. Try again in a moment.`);
    }
  }

  /** Back to the house, with any game taken down first. */
  public leave(): void {
    this.takeDown();
    this.hooks.leave();
  }

  /** Stops the game being played, if one is, and removes its element. */
  public takeDown(): void {
    const sitting = this.current;
    this.current = undefined;
    sitting?.handle?.destroy();
    sitting?.host.remove();
  }
}
