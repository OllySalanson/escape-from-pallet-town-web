import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/gameConfig';
import { isTestLabRequested } from './game/dev/testLabAccess';
import { mountGame, unmountGame } from './game/gameLifecycle';
import { watchViewport } from './game/display/stageScaler';

const developmentScenes = import.meta.env.DEV && isTestLabRequested()
  ? [(await import('./game/scenes/TestLabScene')).TestLabScene]
  : [];

if (import.meta.env.DEV) {
  // What has sounded, readable from the console (`__audio.recentlyPlayed`), so
  // "did that play twice?" is a question with an answer on a development build.
  const { audioManager } = await import('./game/audio/AudioManager');
  (window as unknown as { __audio: typeof audioManager }).__audio = audioManager;
}

const game = mountGame(() => new Phaser.Game(createGameConfig(developmentScenes)));
const stopWatchingViewport = watchViewport(game);
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopWatchingViewport();
    unmountGame();
  });
}
