/**
 * The games the console in the player's room plays.
 *
 * Every game lives in a repository of its own and is built there; its module
 * is vendored here at a pinned commit by `scripts/fetch-console-games.mjs` and
 * imported only when somebody picks it, so the game costs nobody a byte until
 * they sit down to play. A row here is the whole of what this game knows about
 * one: its leaderboard id, what the GAMES menu calls it, and `mount`, which
 * translates the console's one contract (`ConsoleGameHost`) into that game's
 * own embed API.
 *
 * Adding a game is a row in the fetch script, a row here, and a migration that
 * gives it a board - see AGENTS.md. `console/vendor.test.ts` fails a row with
 * no vendored build or no board.
 */

/**
 * The class of the element a console game is played in, full-window over
 * everything. The FEEDBACK key leaves a key pressed inside it alone
 * (`feedback/feedbackDesk.ts`), as it does a text field.
 */
export const CONSOLE_GAME_CLASS = 'console-game';

/** A finished game, as every console game reports one to the console. */
export interface ConsoleGameResult {
  readonly score: number;
  readonly lines: number;
  readonly level: number;
  /** Time spent playing, not counting pauses. */
  readonly durationMs: number;
}

/** What the console hands a game it starts. */
export interface ConsoleGameHost {
  /** The name typed at the console (`console/playerName.ts`): the game asks for none. */
  readonly playerName: string;
  /** Called once at the end of every game. */
  readonly onGameOver: (result: ConsoleGameResult) => Promise<void>;
  /** The board the game shows on its own screens in place of its own high scores. */
  readonly loadLeaderboard: () => Promise<readonly { readonly name: string; readonly score: number }[]>;
  /** The player is done: the console takes the game down and goes back to the house. */
  readonly onExit: () => void;
}

/** A running game, as the console holds it. */
export interface ConsoleGameHandle {
  /** Stops the game and leaves its element as the game found it. */
  destroy(): void;
}

export interface ConsoleGame {
  /** The leaderboard's id for it, and its vendor folder's name. */
  readonly id: string;
  /** What the GAMES menu calls it. */
  readonly name: string;
  /** One line about it, under its name. */
  readonly blurb: string;
  /** How to play, said on the help bar when the cursor is on it. */
  readonly help: string;
  /** Starts it in `element`, which it fills. */
  mount(element: HTMLElement, host: ConsoleGameHost): Promise<ConsoleGameHandle>;
}

export const CONSOLE_GAMES: readonly ConsoleGame[] = [
  {
    id: 'pallet-blocks',
    name: 'PALLET BLOCKS',
    blurb: 'Falling blocks. Fill a row to clear it.',
    help: 'ARROWS move, UP turns, SPACE drops, C holds. ESC on its title screen comes back to the house.',
    async mount(element, host) {
      const { mountPalletBlocks } = await import('./vendor/pallet-blocks/pallet-blocks.js');
      return mountPalletBlocks(element, {
        playerName: host.playerName,
        onGameOver: ({ score, lines, level, durationMs }) => host.onGameOver({ score, lines, level, durationMs }),
        loadLeaderboard: host.loadLeaderboard,
        onExit: host.onExit,
        // Its own high-score table is kept under a key of ours: the standalone
        // game is served from the same origin (ollysalanson.github.io) and
        // would otherwise share one table with this console.
        storageKey: 'escape-from-pallet-town.console.pallet-blocks.scores',
      });
    },
  },
];

export function consoleGame(id: string): ConsoleGame | undefined {
  return CONSOLE_GAMES.find((game) => game.id === id);
}
