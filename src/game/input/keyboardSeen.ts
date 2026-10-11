/**
 * Whether this browser has a keyboard, as far as the page can tell.
 *
 * The game is played on the keyboard and has no touch controls yet, so a
 * touch-only device reached the title, walked into a raid and found nothing on
 * screen to move with (playtest 37, D2). There is no way to ask a browser
 * whether a keyboard is attached; what the page *can* see is a primary pointer
 * that is a finger (`(pointer: coarse)`) and whether any key has been pressed
 * since it opened. A tablet with a keyboard is told once and is through the
 * moment a key goes down, and nothing is ever stored, so a wrong guess costs
 * one keypress.
 *
 * The listener is on the window in the capture phase and changes nothing about
 * the event, so it sees a key before Phaser or any overlay does - which is what
 * lets the title read `keyboardSeen()` from inside its own key handlers.
 */

let seen = false;
let dismissed = false;

export function watchForKeyboard(target: Pick<Window, 'addEventListener' | 'removeEventListener'>): () => void {
  const note = () => {
    seen = true;
  };
  target.addEventListener('keydown', note, true);
  return () => target.removeEventListener('keydown', note, true);
}

export function keyboardSeen(): boolean {
  return seen;
}

/** The notice was waved past by touch: it is not shown again this page. */
export function dismissKeyboardNotice(): void {
  dismissed = true;
}

/** The pointer the browser calls primary is a finger. */
export function primaryPointerIsCoarse(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

/**
 * Whether the title opens on the notice: a finger for a pointer, no key seen,
 * and not already waved past.
 */
export function needsKeyboardNotice(
  state: { readonly coarsePointer: boolean; readonly keyboardSeen: boolean; readonly dismissed: boolean } = {
    coarsePointer: primaryPointerIsCoarse(),
    keyboardSeen: seen,
    dismissed,
  },
): boolean {
  return state.coarsePointer && !state.keyboardSeen && !state.dismissed;
}

/** For tests: back to a page that has seen nothing. */
export function resetKeyboardSeen(): void {
  seen = false;
  dismissed = false;
}
