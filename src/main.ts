import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/gameConfig';
import { isTestLabRequested } from './game/dev/testLabAccess';
import { installTestModeControls, requestedTestMode } from './game/dev/testMode';
import { mountGame, unmountGame } from './game/gameLifecycle';
import { watchViewport } from './game/display/stageScaler';
import { installPixelText } from './game/ui/pixelText';

const developmentScenes = import.meta.env.DEV && isTestLabRequested()
  ? [(await import('./game/scenes/TestLabScene')).TestLabScene]
  : [];

if (import.meta.env.DEV) {
  // What has sounded, readable from the console (`__audio.recentlyPlayed`), so
  // "did that play twice?" is a question with an answer on a development build.
  const { audioManager } = await import('./game/audio/AudioManager');
  (window as unknown as { __audio: typeof audioManager }).__audio = audioManager;
}

// Before the first scene exists, so no text is ever painted the soft way.
installPixelText(Phaser.GameObjects.Text);

const testMode = requestedTestMode();
const game = mountGame(() => {
  const created = new Phaser.Game(createGameConfig(developmentScenes, testMode));
  // The handle a driver already reaches for gains `pauseLoop`, `stepFrames` and
  // `resumeLoop` - and only in test mode, so nothing else can stop the game.
  return testMode === 'off' ? created : installTestModeControls(created);
});
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
