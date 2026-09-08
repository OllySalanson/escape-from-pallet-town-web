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
 * Key *up* is deliberately left alone. Phaser tracks `Key.isDown` from it, and a
 * swallowed keyup would hand the resumed world a key the player has released.
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
  owner.handler(event);
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
