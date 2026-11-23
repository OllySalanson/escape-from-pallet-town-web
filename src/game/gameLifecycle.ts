const GAME_INSTANCE_KEY = '__escapeFromPalletTownGame__';

export interface MountedGame {
  destroy(removeCanvas?: boolean): void;
}

interface GameHost {
  [GAME_INSTANCE_KEY]?: MountedGame;
}

export type GameFactory = () => MountedGame;

/**
 * Replaces an existing game before mounting a new one. Vite re-evaluates entry
 * modules during HMR, so module-local state alone cannot enforce this invariant.
 */
export function mountGame<TGame extends MountedGame>(
  createGame: () => TGame,
  host: GameHost = window as unknown as GameHost,
): TGame {
  host[GAME_INSTANCE_KEY]?.destroy(true);
  removePreviousGameDom();
  const game = createGame();
  host[GAME_INSTANCE_KEY] = game;
  return game;
}

export function unmountGame(host: GameHost = window as unknown as GameHost): void {
  host[GAME_INSTANCE_KEY]?.destroy(true);
  delete host[GAME_INSTANCE_KEY];
  removePreviousGameDom();
}

function removePreviousGameDom(): void {
  if (typeof document === 'undefined') {
    return;
  }
  // The canvas lives in `#app` and the DOM screens in the menu layer beside it,
  // so a remount has two places to sweep rather than one. The first mount also
  // takes away index.html's "loading" line, which only stood in for the canvas.
  document
    .querySelectorAll('#app > canvas, #app > .boot-wait, .menu-overlay')
    .forEach((element) => element.remove());
}
