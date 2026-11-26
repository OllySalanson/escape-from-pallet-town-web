/**
 * Whether the game is being played by touch, and so whether the touch pad
 * (`ui/touchPad.ts`) is on screen and the window is laid out round it
 * (`display/touchLayout.ts`).
 *
 * There is no way to ask a browser whether a keyboard is attached. What a page
 * can see is a primary pointer that is a finger (`(pointer: coarse)`), which
 * is where touch play starts, and what the player actually does: a finger on
 * the screen turns it on, and a key pressed on a real keyboard turns it off -
 * a tablet with a keyboard docked gets the whole window back the moment it is
 * typed on, and the pad back the moment it is touched. Nothing is stored, so a
 * wrong guess costs one press.
 *
 * A key the pad itself pressed is not a keyboard (`syntheticKeys.ts` events
 * are never trusted), and nor is a key typed into a field - a phone's own
 * on-screen keyboard sends real key events, and naming a Pokemon must not take
 * the pad away - nor the `Unidentified`/`Process` keys an on-screen keyboard
 * sends while composing a word.
 */

let playing = false;
const listeners = new Set<(playing: boolean) => void>();

export function touchPlay(): boolean {
  return playing;
}

export function setTouchPlay(on: boolean): void {
  if (on === playing) {
    return;
  }
  playing = on;
  for (const listener of [...listeners]) {
    listener(on);
  }
}

/** Called with the new answer whenever touch play starts or stops. Returns the unsubscribe. */
export function onTouchPlayChange(listener: (playing: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The pointer the browser calls primary is a finger. */
export function primaryPointerIsCoarse(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

/**
 * Whether the touch pad is drawn: while the game is played by touch, and on a
 * device whose primary pointer is a finger whatever was pressed last. A keyboard
 * press turns touch play off, which is right for the words - a hint names the
 * key just used - but it used to take the pad away too, so the next tap where
 * OK had been landed on nothing and only brought the pad back: the first OK
 * after a keyboard press was swallowed (the navigation audit, 25 Nov 2026).
 */
export function padWanted(coarsePointer = primaryPointerIsCoarse()): boolean {
  return playing || coarsePointer;
}

/** The key events that are a keyboard being used, rather than the pad, a phone's own keyboard or a field. */
export function isPhysicalKeyPress(event: Pick<KeyboardEvent, 'key' | 'isTrusted' | 'target'>): boolean {
  if (event.isTrusted === false) {
    return false;
  }
  if (event.key === 'Unidentified' || event.key === 'Process' || event.key === 'Dead') {
    return false;
  }
  const target = event.target as { tagName?: unknown; isContentEditable?: unknown } | null;
  if (target && typeof target === 'object') {
    if (target.isContentEditable === true) {
      return false;
    }
    const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return false;
    }
  }
  return true;
}

/** The part of `window` this needs, so a test can supply its own. */
export interface TouchPlayHost {
  addEventListener(type: 'pointerdown' | 'keydown', listener: (event: Event) => void, capture: boolean): void;
  removeEventListener(type: 'pointerdown' | 'keydown', listener: (event: Event) => void, capture: boolean): void;
}

/**
 * Starts touch play now if the pointer is a finger, then follows the player:
 * on at a touch, off at a keyboard. Listens in the capture phase and changes
 * nothing about either event. Returns the teardown.
 */
export function watchTouchPlay(host: TouchPlayHost, coarsePointer = primaryPointerIsCoarse()): () => void {
  setTouchPlay(coarsePointer);
  const onPointer = (event: Event) => {
    if ((event as PointerEvent).pointerType === 'touch') {
      setTouchPlay(true);
    }
  };
  const onKey = (event: Event) => {
    if (isPhysicalKeyPress(event as KeyboardEvent)) {
      setTouchPlay(false);
    }
  };
  host.addEventListener('pointerdown', onPointer, true);
  host.addEventListener('keydown', onKey, true);
  return () => {
    host.removeEventListener('pointerdown', onPointer, true);
    host.removeEventListener('keydown', onKey, true);
  };
}

/** For tests: back to a page that has seen nothing. */
export function resetTouchPlay(): void {
  playing = false;
  listeners.clear();
}
