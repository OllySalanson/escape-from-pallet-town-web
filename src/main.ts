import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/gameConfig';
import { isTestLabRequested } from './game/dev/testLabAccess';
import { mountGame, unmountGame } from './game/gameLifecycle';
import { watchViewport } from './game/display/stageScaler';

const developmentScenes = import.meta.env.DEV && isTestLabRequested()
  ? [(await import('./game/scenes/TestLabScene')).TestLabScene]
  : [];

const game = mountGame(() => new Phaser.Game(createGameConfig(developmentScenes)));
const stopWatchingViewport = watchViewport(game);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopWatchingViewport();
    unmountGame();
  });
}
