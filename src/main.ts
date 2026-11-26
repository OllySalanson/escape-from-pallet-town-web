import Phaser from 'phaser';
import './style.css';
import { createGameConfig } from './game/gameConfig';
import { isTestLabRequested } from './game/dev/testLabAccess';
import { installTestModeControls, requestedTestMode } from './game/dev/testMode';
import { installTestReadouts } from './game/dev/testReadouts';
import { mountGame, unmountGame } from './game/gameLifecycle';
import { watchViewport } from './game/display/stageScaler';
import { installFeedbackDesk } from './game/feedback/feedbackDesk';
import { followTesterLink, installPlayCounter, isAutomatedBrowser } from './game/analytics/playCounter';
import { installPixelText } from './game/ui/pixelText';
import { onTouchPlayChange, padWanted, touchPlay, watchTouchPlay } from './game/input/touchPlay';
import { installTouchWording, rewordTexts } from './game/input/touchWords';
import { watchMenuWords } from './game/ui/menuWords';
import { menuLayer } from './game/display/menuStage';
import { installTouchPad } from './game/ui/touchPad';
import { installControlsBar } from './game/ui/controlsBar';
import { fullScreenOffered, isFullScreen, onFullScreenChange, toggleFullScreen, watchFullScreenKey } from './game/display/fullScreen';
import { frameLayout, installStageFrame } from './game/display/stageFrame';
import { openControlsScreen } from './game/scenes/ControlsScene';
import { audioManager } from './game/audio/AudioManager';
import { pausesForWindow, watchWindowFocus } from './game/world/windowPause';
import { keepSavesSafe } from './game/save/keepSavesSafe';
import { SaveManager } from './game/save/SaveManager';
import { guardLeavingDuringRaid } from './game/run/leaveGuard';
import { boutHeartbeat, raidHeartbeat } from './game/run/raidInFlight';

const developmentScenes = import.meta.env.DEV && isTestLabRequested()
  ? [(await import('./game/scenes/TestLabScene')).TestLabScene]
  : [];

if (import.meta.env.DEV) {
  // What has sounded, readable from the console (`__audio.recentlyPlayed`), so
  // "did that play twice?" is a question with an answer on a development build.
  (window as unknown as { __audio: typeof audioManager }).__audio = audioManager;
}

// From the first moment: a finger for a pointer starts the game on the touch
// pad, and a key or a touch while it boots already counts (`input/touchPlay.ts`).
const stopWatchingTouch = watchTouchPlay(window);

// Before the first scene exists, so no text is ever painted the soft way.
installPixelText(Phaser.GameObjects.Text);
// ...and says its keys the touch pad's way while it is played on one (`input/touchWords.ts`).
installTouchWording(Phaser.GameObjects.Text);

const testMode = requestedTestMode();
// Asks the browser to keep the save rather than clear it after a week away
// (Safari) or when the disk is short: now if there is a game, or on the first
// save this page writes. Never in test mode, whose drivers seed and throw away
// saves by the hundred.
if (testMode === 'off') {
  void keepSavesSafe(navigator.storage, new SaveManager().describe().kind !== 'none');
}
const game = mountGame(() => {
  const created = new Phaser.Game(createGameConfig(developmentScenes, testMode));
  // The handle a driver already reaches for gains `pauseLoop`, `stepFrames` and
  // `resumeLoop`, and `describe()`, `eventLog()` and `pressMenu()` for a program
  // that plays it (`dev/testReadouts.ts`) - and only in test mode, so nothing
  // else can stop or read the game.
  return testMode === 'off' ? created : installTestReadouts(installTestModeControls(created));
});
// The FEEDBACK tab and the F key, on every screen. See `feedback/feedbackDesk.ts`.
const feedbackDesk = installFeedbackDesk(game);
// The game played with thumbs, laid out round the window with the game by
// `watchViewport` (`ui/touchPad.ts`, `display/touchLayout.ts`).
const touchPad = installTouchPad({
  document,
  scenes: () => game.scene.getScenes(false).filter((scene) => scene.sys.isActive() || scene.sys.isPaused()),
  openFeedback: () => feedbackDesk.open(),
  toggleSound: () => audioManager.toggleMute(),
  soundMuted: () => audioManager.isMuted,
  wakeSound: () => void audioManager.activate(),
});
// ...and so do the menu screens (`ui/menuWords.ts`).
const menuWords = watchMenuWords(menuLayer(), touchPlay);
const stopRewording = onTouchPlayChange(() => {
  rewordTexts(game.scene.scenes);
  menuWords.reword();
});
// The keys as buttons, the team and SETTINGS and HELP, under or beside the game
// where the window has room for them (`ui/controlsBar.ts`).
const controlsBar = installControlsBar({
  document,
  scenes: () => game.scene.getScenes(false).filter((scene) => scene.sys.isActive() || scene.sys.isPaused()),
  openScreen: (view) => openControlsScreen(game, view, () => feedbackDesk.open()),
  fullScreen: () => (!fullScreenOffered(document) ? 'unavailable' : isFullScreen(document) ? 'on' : 'off'),
  toggleFullScreen: () => void toggleFullScreen(document),
});
// What the whole-pixel game leaves of the window is a frame in the game's own
// pixel, and where the controls bar has no room it holds the FULL SCREEN
// button (`display/stageFrame.ts`, `display/fullScreen.ts`). ALT ENTER toggles
// full screen on any screen.
const stageFrame = installStageFrame({
  document,
  fullScreen: () => isFullScreen(document),
  toggleFullScreen: () => void toggleFullScreen(document),
});
const stopWatchingFullScreenKey = watchFullScreenKey(window, document);
const stopWatchingFullScreen = onFullScreenChange(document, () => stageFrame.refresh());
const stopWatchingViewport = watchViewport(
  game,
  {
    playing: () => padWanted(),
    // Laid out again when touch play starts or stops, and when the screen up
    // names more keys than the tray's rows hold.
    onChange: (listener) => {
      const stopPlay = onTouchPlayChange(listener);
      const stopRows = touchPad.onTrayRowsChange(listener);
      return () => {
        stopPlay();
        stopRows();
      };
    },
    place: (layout) => touchPad.place(layout),
    trayRows: () => touchPad.trayRows(),
  },
  'app',
  controlsBar,
  {
    place: (fit) =>
      stageFrame.draw(
        frameLayout({
          ...fit,
          fullScreenButton: fit.barSide === null && !fit.touch && fullScreenOffered(document),
          ornaments: !fit.touch,
        }),
      ),
  },
);
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
          page: document,
          ignores: (event) =>
            game.scene.isActive('feedback') ||
            (event.target instanceof Element && event.target.closest('.feedback-panel, .feedback-tab') !== null),
        },
      )
    : () => undefined;
// Leaving the page mid-raid costs the pack, and mid-bout the bout, so the
// browser asks first - only while this page is playing the raid or the bout the
// save holds, and never in test mode, whose drivers reload mid-raid on purpose.
// See `game/run/leaveGuard.ts`.
const stopGuardingLeave =
  testMode === 'off'
    ? guardLeavingDuringRaid(window, () => {
        const saves = new SaveManager();
        const raid = raidHeartbeat.playing();
        // A bout left half way counts as lost, and a rental's lost bout is the
        // day's paying run gone (break-it test, 23 Nov 2026), so it is asked too.
        const bout = boutHeartbeat.playing();
        return (raid !== null && saves.raidInFlightId() === raid) || (bout !== null && saves.boutUnderWayId() === bout);
      })
    : () => undefined;
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopWatchingViewport();
    stopWatchingTouch();
    stopRewording();
    menuWords.stop();
    touchPad.destroy();
    controlsBar.destroy();
    stageFrame.destroy();
    stopWatchingFullScreenKey();
    stopWatchingFullScreen();
    feedbackDesk.destroy();
    stopWatchingFocus();
    stopGuardingLeave();
    stopCountingPlay();
    unmountGame();
  });
}
