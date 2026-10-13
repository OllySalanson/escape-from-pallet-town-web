import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/gameConfig';
import { isTestLabRequested } from './game/dev/testLabAccess';
import { installTestModeControls, requestedTestMode } from './game/dev/testMode';
import { mountGame, unmountGame } from './game/gameLifecycle';
import { watchViewport } from './game/display/stageScaler';
import { installFeedbackDesk } from './game/feedback/feedbackDesk';
import { followTesterLink, installPlayCounter, isAutomatedBrowser } from './game/analytics/playCounter';
import { installPixelText } from './game/ui/pixelText';
import { watchForKeyboard } from './game/input/keyboardSeen';
import { pausesForWindow, watchWindowFocus } from './game/world/windowPause';

const developmentScenes = import.meta.env.DEV && isTestLabRequested()
  ? [(await import('./game/scenes/TestLabScene')).TestLabScene]
  : [];

if (import.meta.env.DEV) {
  // What has sounded, readable from the console (`__audio.recentlyPlayed`), so
  // "did that play twice?" is a question with an answer on a development build.
  const { audioManager } = await import('./game/audio/AudioManager');
  (window as unknown as { __audio: typeof audioManager }).__audio = audioManager;
}

// From the first moment, so a key pressed while the game boots still counts.
const stopWatchingForKeyboard = watchForKeyboard(window);

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
// The FEEDBACK tab and the F key, on every screen. See `feedback/feedbackDesk.ts`.
const feedbackDesk = installFeedbackDesk(game);
// Counts play for the owner's STATS page, only on the published game, never for
// a browser a program drives or one that asks not to be tracked, and a tester's
// (`?tester` once, or the STATS page's switch) apart. See `game/analytics/playCounter.ts`.
followTesterLink();
const stopCountingPlay = installPlayCounter({
  production: import.meta.env.PROD,
  testMode: testMode !== 'off',
  hostname: window.location.hostname,
  pathname: window.location.pathname,
  automated: isAutomatedBrowser(navigator),
  doNotTrack: navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack,
  globalPrivacyControl: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
});
// A raid stops while the window is not in use, and waits for a click or a key.
// Never in test mode, whose drivers step a stopped loop and open second tabs.
// See `game/world/windowPause.ts`.
const stopWatchingFocus =
  testMode === 'off'
    ? watchWindowFocus(
        window,
        () => {
          const world = game.scene.getScene('world');
          return pausesForWindow(world) ? world : null;
        },
        {
          ignores: (event) =>
            game.scene.isActive('feedback') ||
            (event.target instanceof Element && event.target.closest('.feedback-panel, .feedback-tab') !== null),
        },
      )
    : () => undefined;
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopWatchingViewport();
    stopWatchingForKeyboard();
    feedbackDesk.destroy();
    stopWatchingFocus();
    stopCountingPlay();
    unmountGame();
  });
}
