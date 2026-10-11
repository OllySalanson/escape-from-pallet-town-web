/**
 * A raid stops when the window it is played in stops being the one in use.
 *
 * The raid clock and the hunter run off the game loop, and the game loop keeps
 * running while the window is on screen and not in use - a second monitor, a
 * chat window over the corner of it - so a player who looked away to answer a
 * message came back to a hunter beside them and a minute gone (playtest 14).
 * Hiding the tab already stopped everything, because the browser stops the
 * frames; an unfocused window that is still drawn did not. The captain's call
 * was to pause, with a plate that says so, and to resume only on a click or a
 * key: focus coming back on its own is not the player being ready, because
 * alt-tabbing back to read the screen is exactly when they are not.
 *
 * Only a raid being walked pauses. The base has no clock; a fight, the pack,
 * the party and the field guide already stop the raid clock by design (the
 * clock only runs in `WorldScene.update`); and a menu screen is the player's to
 * look at for as long as they like. Test mode never pauses: the drivers that
 * play the game headless open second tabs and step a stopped loop, and a plate
 * waiting for a click would stand in the way of every one of them.
 *
 * Phaser-free, so the rule is tested on a stand-in window; the scene does the
 * pausing and draws the plate (`WorldScene.pauseForWindow`).
 */

/** What the plate says: a title, and the two lines under it. */
export const WINDOW_PAUSE_TITLE = 'PAUSED';
export const WINDOW_PAUSE_LINES = [
  'The clock and the hunter are waiting.',
  'Click or press any key to play on.',
] as const;

/** A scene a raid is walked in, which can be stopped while the window is not in use. */
export interface PausesForWindow {
  /** Whether a raid is being walked here right now, so losing the window would cost it. */
  canPauseForWindow(): boolean;
  /** Stop the raid where it stands and put the plate up. */
  pauseForWindow(): void;
  /** Take the plate down and carry on from exactly where it stopped. */
  resumeFromWindowPause(): void;
}

export function pausesForWindow(scene: unknown): scene is PausesForWindow {
  return (
    typeof scene === 'object' &&
    scene !== null &&
    typeof (scene as Partial<PausesForWindow>).canPauseForWindow === 'function' &&
    typeof (scene as Partial<PausesForWindow>).pauseForWindow === 'function' &&
    typeof (scene as Partial<PausesForWindow>).resumeFromWindowPause === 'function'
  );
}

/** The parts of a key or pointer event the rule reads. */
interface InputEventLike {
  readonly type: string;
  readonly code?: string;
  readonly target?: unknown;
  preventDefault(): void;
  stopImmediatePropagation(): void;
}

export interface WindowPauseOptions {
  /**
   * An event that belongs to something else on the page and must not resume
   * the raid: the FEEDBACK panel, which can be opened over the plate and is
   * typed into, or its tab.
   */
  readonly ignores?: (event: InputEventLike) => boolean;
}

/**
 * Watches `target` (the window) for losing focus and pauses whatever raid
 * `raid()` names; then the next key press or click resumes it. Returns the
 * function that stops watching.
 *
 * The key that resumes is spent on the plate: it is stopped before Phaser or
 * any menu sees it, and so is every repeat of it until it comes up, so an arrow
 * pressed to come back does not also walk a tile - or, held, walk a corridor -
 * the same rule `spentPresses.ts` keeps for a box closed with a direction key.
 */
export function watchWindowFocus(
  target: EventTarget,
  raid: () => PausesForWindow | null,
  options: WindowPauseOptions = {},
): () => void {
  let paused: PausesForWindow | null = null;
  let spentCode: string | null = null;
  const ignored = (event: InputEventLike): boolean => options.ignores?.(event) === true;

  const resume = (): void => {
    const scene = paused;
    paused = null;
    scene?.resumeFromWindowPause();
  };

  const onBlur = (): void => {
    // A key held while the window went is never seen to come up here.
    spentCode = null;
    if (paused) {
      return;
    }
    const scene = raid();
    if (scene?.canPauseForWindow()) {
      paused = scene;
      scene.pauseForWindow();
    }
  };

  const onKeyDown = (raw: Event): void => {
    const event = raw as unknown as InputEventLike;
    const code = event.code ?? '';
    if (spentCode !== null && code === spentCode) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!paused || ignored(event)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    spentCode = code === '' ? null : code;
    resume();
  };

  const onKeyUp = (raw: Event): void => {
    if ((raw as unknown as InputEventLike).code === spentCode) {
      spentCode = null;
    }
  };

  const onPointerDown = (raw: Event): void => {
    const event = raw as unknown as InputEventLike;
    if (paused && !ignored(event)) {
      resume();
    }
  };

  target.addEventListener('blur', onBlur);
  // Capture, so the key is the plate's before Phaser's own window listener or
  // any overlay's sees it.
  target.addEventListener('keydown', onKeyDown, true);
  target.addEventListener('keyup', onKeyUp, true);
  target.addEventListener('pointerdown', onPointerDown, true);
  return () => {
    target.removeEventListener('blur', onBlur);
    target.removeEventListener('keydown', onKeyDown, true);
    target.removeEventListener('keyup', onKeyUp, true);
    target.removeEventListener('pointerdown', onPointerDown, true);
  };
}
