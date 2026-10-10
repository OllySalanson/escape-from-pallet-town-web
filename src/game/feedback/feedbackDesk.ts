import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { activeSaveSlot } from '../dev/playtestMode';
import { SaveManager } from '../save/SaveManager';
import type { FeedbackSceneData } from '../scenes/FeedbackScene';
import { isTypingTarget } from '../ui/overlayKeyboard';
import { actionLog, buttonWords, errorLine, recordAction } from './actionLog';
import { createCourier, type FeedbackCourier } from './courier';
import {
  buildFeedbackContext,
  providesFeedbackContext,
  screenName,
  type FeedbackDetail,
} from './feedbackContext';
import { FEEDBACK_TAB_LABEL } from './feedbackWords';
import { sendToTheLab } from './feedbackSender';
import { browserOutbox } from './outbox';

/**
 * The FEEDBACK tab, the F key, and what happens between pressing either and
 * the panel being up.
 *
 * The tab is its own element on the page - not in the canvas box, not in the
 * menu layer - so it is on every screen there is, including the ones that are
 * not the game's (a menu a scene has not drawn yet, the moment a raid ends).
 * It stands half way down the right edge of the window, where the game itself
 * puts nothing: the raid's chips are in the corners and its talk box along the
 * bottom. On a window the game does not fill it sits in the empty margin; on
 * one it does, it covers a strip of map edge and never the clock, the chips,
 * the box or the player.
 *
 * Pressing it, in this order: the picture is asked for (it is taken a frame
 * later, so what the player saw is what is attached - the panel is drawn in the
 * page, never in the canvas, so it is never in the picture); where they are is
 * written down; every running scene is paused, which stops the raid clock with
 * the raid; and the panel opens. Closing resumes exactly the scenes it paused
 * and nothing else, so a raid paused under the pack stays paused under the pack.
 */
export interface FeedbackDesk {
  open(): void;
  destroy(): void;
}

/** How long to wait for the picture before sending without one. */
const PICTURE_WAIT_MS = 1500;

export function installFeedbackDesk(game: Phaser.Game, courier: FeedbackCourier = defaultCourier()): FeedbackDesk {
  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'feedback-tab';
  tab.textContent = FEEDBACK_TAB_LABEL;
  tab.title = 'Tell us what happened (F)';
  tab.setAttribute('aria-label', 'Send feedback (F)');
  // Out of the page's tab order, and never focused by a click: a focused button
  // takes Enter and Space, which in this game are the A button, so a player who
  // had once clicked the tab would open it again with every line of dialogue.
  tab.tabIndex = -1;
  tab.addEventListener('mousedown', (event) => event.preventDefault());
  tab.addEventListener('click', () => desk.open());
  document.body.append(tab);

  let paused: string[] = [];
  const open = (): void => {
    if (game.scene.isActive('feedback') || game.scene.isActive('boot') || !game.scene.getScene('feedback')) {
      return;
    }
    // A menu screen is drawn in the page, over the canvas, so a picture of the
    // canvas is the game behind it - usually black. None is better than one
    // that shows nothing; the screen is named under SEE IT ALL either way.
    const onAMenu = document.querySelector('#screens > .menu-overlay:not(.feedback-panel)') !== null;
    const picture = onAMenu ? Promise.resolve(null) : takePicture(game);
    const present = game.scene
      .getScenes(false)
      .filter((scene) => scene.sys.isActive() || scene.sys.isPaused())
      .map((scene) => scene.sys.settings.key);
    const details: FeedbackDetail[] = [];
    for (const key of present) {
      const scene = game.scene.getScene(key);
      if (providesFeedbackContext(scene)) {
        try {
          details.push(...scene.feedbackContext());
        } catch (error) {
          recordAction(errorLine(error));
        }
      }
    }
    recordAction('Opened FEEDBACK');
    const context = buildFeedbackContext({
      scenes: present,
      details,
      viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 },
      stage: { width: game.scale.width, height: game.scale.height, zoom: game.scale.zoom },
      browser: navigator.userAgent,
      mode: activeSaveSlot(),
      now: new Date(),
    });
    paused = game.scene
      .getScenes(true)
      .map((scene) => scene.sys.settings.key)
      .filter((key) => key !== 'feedback');
    for (const key of paused) {
      game.scene.pause(key);
    }
    tab.hidden = true;
    audioManager.play('menuOpen');
    const data: FeedbackSceneData = {
      context,
      actions: actionLog.recent(),
      picture,
      pictureSkipped: onAMenu,
      save: readSave(),
      courier,
      onClose: () => {
        for (const key of paused) {
          if (game.scene.isPaused(key)) {
            game.scene.resume(key);
          }
        }
        paused = [];
        tab.hidden = false;
      },
    };
    game.scene.run('feedback', data);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() !== 'f' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    // F in a text field is a letter, and with the panel up it is the panel's to read.
    if (isTypingTarget(event.target) || game.scene.isActive('feedback')) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  };
  // Capture, on the window, and before any overlay has claimed the keyboard:
  // `overlayKeyboard.ts` adds its own capture listener when the first menu
  // opens, after this one, so F reaches here first on every screen there is.
  window.addEventListener('keydown', onKeyDown, true);

  const stopLogging = logWhatHappens(game);
  // A message kept in the pack - no internet then, or the lab not switched on
  // yet - goes the next time the game is opened, or the moment the browser is
  // back online. Nothing is loaded for this unless something is waiting.
  const flush = (): void => {
    void courier.flush(new Date()).then((sent) => {
      if (sent > 0) {
        recordAction(`Sent ${sent} kept message${sent === 1 ? '' : 's'}`);
      }
    });
  };
  const firstFlush = window.setTimeout(flush, FLUSH_DELAY_MS);
  window.addEventListener('online', flush);
  const desk: FeedbackDesk = {
    open,
    destroy: () => {
      window.clearTimeout(firstFlush);
      window.removeEventListener('online', flush);
      window.removeEventListener('keydown', onKeyDown, true);
      stopLogging();
      tab.remove();
    },
  };
  return desk;
}

function defaultCourier(): FeedbackCourier {
  return createCourier({ outbox: browserOutbox(), storage: safeLocalStorage(), send: sendToTheLab });
}

/** How long after the game starts it looks in the pack, so a boot is never slowed by it. */
const FLUSH_DELAY_MS = 5000;

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readSave(): string | null {
  try {
    return new SaveManager().stamp();
  } catch {
    return null;
  }
}

/**
 * The canvas as it is drawn, at the game's own pixels: a 400x256 picture is a
 * few tens of kilobytes as a PNG and every pixel of it is the game's. Resolves
 * null rather than waiting for ever - a stopped render loop never answers.
 */
function takePicture(game: Phaser.Game): Promise<Blob | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), PICTURE_WAIT_MS);
    try {
      game.renderer.snapshot((image) => {
        window.clearTimeout(timer);
        if (!(image instanceof HTMLImageElement)) {
          resolve(null);
          return;
        }
        fetch(image.src)
          .then((response) => response.blob())
          .then(resolve, () => resolve(null));
      }, 'image/png');
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });
}

/**
 * What goes in the log on its own: every screen that starts, every menu button
 * pressed (by the words on it), and every error the page throws. Scenes add
 * what only they know - the place walked into, the fight that started.
 */
function logWhatHappens(game: Phaser.Game): () => void {
  const onClick = (event: MouseEvent): void => {
    const button = (event.target as Element | null)?.closest?.('button');
    if (!button || !button.closest('#screens') || button.closest('.feedback-panel')) {
      return;
    }
    const words = buttonWords(button);
    if (words) {
      recordAction(`Pressed ${words}`);
    }
  };
  const onError = (event: ErrorEvent): void => {
    recordAction(errorLine(event.error ?? event.message, { file: event.filename, line: event.lineno }));
  };
  const onRejection = (event: PromiseRejectionEvent): void => {
    recordAction(errorLine(event.reason));
  };
  document.addEventListener('click', onClick, true);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  const watchScenes = (): void => {
    for (const scene of game.scene.getScenes(false)) {
      const key = scene.sys.settings.key;
      if (key === 'feedback' || key === 'boot') {
        continue;
      }
      scene.sys.events.on(Phaser.Scenes.Events.START, () => recordAction(`Opened ${screenName([key])}`));
    }
  };
  if (game.isBooted) {
    watchScenes();
  } else {
    game.events.once(Phaser.Core.Events.READY, watchScenes);
  }
  return () => {
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
