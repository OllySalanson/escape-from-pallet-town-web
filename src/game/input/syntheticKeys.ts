/**
 * Keys pressed by something other than a keyboard - the touch pad
 * (`ui/touchPad.ts`) - delivered exactly as a keyboard delivers them, so every
 * scene, overlay and screen that already answers a key answers the pad with no
 * code of its own: Phaser's KeyboardManager, `overlayKeyboard.ts`'s capture
 * listener and each screen's own handler all read the same event.
 *
 * Phaser reads `keyCode`, which a constructed `KeyboardEvent` does not carry in
 * every browser, so it is written onto the event. The event is dispatched at
 * the focused element, as a real key is, so a screen that presses its focused
 * button on SPACE (`pressFocusedButton`) finds the button it would have found.
 * A synthetic event is never `isTrusted`, which is how `input/touchPlay.ts`
 * tells a pad press from a keyboard's.
 */

/** A key the pad can press: what `KeyboardEvent.code`, `key` and `keyCode` say for it. */
export interface SyntheticKey {
  readonly code: string;
  readonly key: string;
  readonly keyCode: number;
}

const NAMED: Readonly<Record<string, SyntheticKey>> = {
  ArrowUp: { code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 },
  ArrowDown: { code: 'ArrowDown', key: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39 },
  Space: { code: 'Space', key: ' ', keyCode: 32 },
  Enter: { code: 'Enter', key: 'Enter', keyCode: 13 },
  Escape: { code: 'Escape', key: 'Escape', keyCode: 27 },
  Backspace: { code: 'Backspace', key: 'Backspace', keyCode: 8 },
  Tab: { code: 'Tab', key: 'Tab', keyCode: 9 },
};

/**
 * The key a `KeyboardEvent.code` names: an arrow, SPACE, ENTER, ESC,
 * BACKSPACE, a letter (`KeyB`) or a digit (`Digit1`). Letters arrive lower
 * case, as a keyboard without Shift or Caps Lock sends them.
 */
export function syntheticKey(code: string): SyntheticKey {
  const named = NAMED[code];
  if (named) {
    return named;
  }
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) {
    return { code, key: letter[1].toLowerCase(), keyCode: letter[1].charCodeAt(0) };
  }
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) {
    return { code, key: digit[1], keyCode: digit[1].charCodeAt(0) };
  }
  throw new Error(`no synthetic key for ${code}`);
}

/** The `code` of the key a hint writes as `[B]` or `[1]`: a letter or a digit, else undefined. */
export function codeForHintKey(name: string): string | undefined {
  if (/^[A-Z]$/.test(name)) {
    return `Key${name}`;
  }
  if (/^[0-9]$/.test(name)) {
    return `Digit${name}`;
  }
  return undefined;
}

/** The part of a document the pad presses keys into. */
export interface KeyTarget {
  readonly activeElement: Element | null;
  readonly body: HTMLElement | null;
}

/**
 * Presses (`keydown`) or lets go of (`keyup`) a key, at the focused element as
 * a keyboard does. `repeat` marks a held key's repeats, which a commit key's
 * owner swallows (`overlayKeyboard.isHeldCommitKey`) and a list walks on.
 */
export function sendKey(
  host: KeyTarget,
  code: string,
  type: 'keydown' | 'keyup',
  repeat = false,
): KeyboardEvent {
  const key = syntheticKey(code);
  const event = new KeyboardEvent(type, {
    key: key.key,
    code: key.code,
    bubbles: true,
    cancelable: true,
    composed: true,
    repeat,
  });
  for (const field of ['keyCode', 'which'] as const) {
    if (event[field] !== key.keyCode) {
      Object.defineProperty(event, field, { get: () => key.keyCode });
    }
  }
  const target = host.activeElement ?? host.body;
  (target ?? window).dispatchEvent(event);
  return event;
}
