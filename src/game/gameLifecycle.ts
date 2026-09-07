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
export function mountGame(
  createGame: GameFactory,
  host: GameHost = window as unknown as GameHost,
): MountedGame {
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
  document.getElementById('app')?.querySelectorAll('canvas, .menu-overlay').forEach((element) => {
    element.remove();
  });
}
