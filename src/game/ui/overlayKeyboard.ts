/**
 * Who owns the keyboard while a DOM overlay is on screen.
 *
 * Phaser's key captures are global. `addCapture` - and `addKey`, which captures
 * by default - register on the game's KeyboardManager rather than on the scene
 * that asked, and the manager keeps calling `preventDefault()` on every captured
 * key for the life of the game, including while that scene sits paused behind an
 * overlay. `WorldScene` captures O, P, B, K, SPACE and ENTER, so the instant it
 * paused itself to open the field guide it was still eating the very key the HUD
 * advertises for closing it again, and the overlay's own window listener - which
 * ran after Phaser's, in the bubble phase - dropped the event as already handled.
 * The overlay could only be closed with the mouse.
 *
 * The answer is ownership rather than a list of key exceptions: the topmost
 * overlay owns the keyboard outright. Every overlay claims through here, one
 * shared listener sits on the window in the *capture* phase - ahead of Phaser's -
 * and it stops propagation, so nothing underneath sees the key at all: not the
 * paused world scene, not Phaser's global captures, not an overlay further down
 * the stack. Because the overlay is first rather than last, it also no longer
 * needs anything to have refrained from `preventDefault()`, and the browser's own
 * default - Enter or Space activating the focused Close button - survives, since
 * stopping propagation is not preventing the default.
 *
 * A held Enter or Space is one press, not a stream of them. Holding a key sends
 * one keydown and then a keydown marked `repeat` at the keyboard's own rate, and
 * Chromium works the focused button on every one: the drop-in step's `Review &
 * deploy` re-rendered into the final check with the cursor on `Enter the raid`
 * and the next repeat started the raid, and a Potion in the raid pack was given
 * away once per repeat until the pack ran out. So a repeated Enter or Space is
 * swallowed here, default and all, before any screen or the browser sees it -
 * the commit keys commit once per press, as they do in the games this is
 * dressed as. Every other key still repeats: holding an arrow walks a list.
 *
 * Key *up* is deliberately left alone. Phaser tracks `Key.isDown` from it, and a
 * swallowed keyup would hand the resumed world a key the player has released.
 * That is also why Space works a button here, on its keydown, rather than being
 * left to the browser: Chromium activates a focused button with Enter on keydown
 * but with Space on *keyup*, and Phaser `preventDefault()`s the keyup of every
 * key it captures - SPACE among them - which cancels the activation. Space is
 * the A button on the title, in dialogue and at every door, so every menu was
 * dead to it. `pressFocusedButton` gives it Enter's meaning and Enter's moment.
 */

/** The part of `window` this module needs, so a test can supply its own. */
export interface OverlayKeyboardHost {
  addEventListener(
    type: 'keydown',
    listener: (event: KeyboardEvent) => void,
    useCapture: boolean,
  ): void;
  removeEventListener(
    type: 'keydown',
    listener: (event: KeyboardEvent) => void,
    useCapture: boolean,
  ): void;
}

interface OverlayClaim {
  readonly handler: (event: KeyboardEvent) => void;
}

const claims: OverlayClaim[] = [];
let host: OverlayKeyboardHost | undefined;

function onKeyDown(event: KeyboardEvent): void {
  const owner = claims[claims.length - 1];
  if (!owner) {
    return;
  }
  // The overlay on top owns this key whatever it does with it, so the world
  // beneath it can neither act on it nor preventDefault it.
  event.stopPropagation();
  // A field being typed into is its own owner: the overlay reads no key of a
  // keystroke meant for the text.
  if (isTypingTarget(event.target)) {
    return;
  }
  if (isHeldCommitKey(event)) {
    event.preventDefault();
    return;
  }
  owner.handler(event);
  pressFocusedButton(event);
}

/**
 * Space on a focused button presses it on the keydown, as Enter does, unless
 * the screen already took the key (a pack being arranged reads Space itself).
 * The default is prevented so the browser does not press it a second time on
 * the keyup in a page where nothing cancels that.
 */
function pressFocusedButton(event: KeyboardEvent): void {
  if (event.key !== ' ' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const button = event.target as { tagName?: unknown; click?: unknown } | null;
  if (!button || typeof button.tagName !== 'string' || button.tagName.toUpperCase() !== 'BUTTON') {
    return;
  }
  if (typeof button.click !== 'function') {
    return;
  }
  event.preventDefault();
  (button as { click(): void }).click();
}

/**
 * Puts `handler` on top of the overlay stack. Returns the release, which is
 * idempotent so a scene that both shuts down and is destroyed releases once.
 */
export function claimOverlayKeyboard(
  handler: (event: KeyboardEvent) => void,
  target: OverlayKeyboardHost,
): () => void {
  const claim: OverlayClaim = { handler };
  claims.push(claim);
  if (!host) {
    host = target;
    host.addEventListener('keydown', onKeyDown, true);
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const index = claims.indexOf(claim);
    if (index >= 0) {
      claims.splice(index, 1);
    }
    if (claims.length === 0 && host) {
      host.removeEventListener('keydown', onKeyDown, true);
      host = undefined;
    }
  };
}

/**
 * A repeat of the key that works a focused control. Not a typing target's:
 * a held Space in a text field is a row of spaces, and the field is asked
 * first, so a held Enter in one never reaches a button either.
 */
export function isHeldCommitKey(event: KeyboardEvent): boolean {
  return event.repeat === true && (event.key === 'Enter' || event.key === ' ');
}

/** How many overlays currently hold the keyboard. Zero means the game has it. */
export function overlayKeyboardDepth(): number {
  return claims.length;
}

/**
 * Duck-typed rather than `instanceof HTMLInputElement`, because the project's
 * tests run without a browser and that global would not exist to compare against.
 */
export function isTypingTarget(target: unknown): boolean {
  const element = target as { tagName?: unknown; isContentEditable?: unknown } | null | undefined;
  if (!element || typeof element !== 'object') {
    return false;
  }
  if (element.isContentEditable === true) {
    return true;
  }
  const tagName = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : '';
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

/**
 * Escape always closes an overlay, and so does the key that opened it - the HUD
 * says "[O] FIELD GUIDE", so O is the key the player will press to put it away.
 * A key held with a modifier belongs to the browser (Ctrl+P, Cmd+B), never here.
 */
export function isOverlayDismissKey(
  event: KeyboardEvent,
  ...keys: readonly string[]
): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  const pressed = event.key.toLowerCase();
  return pressed === 'escape' || keys.some((key) => key.toLowerCase() === pressed);
}
