import { afterEach, describe, expect, it } from 'vitest';
import {
  dismissKeyboardNotice,
  keyboardSeen,
  looksTouchOnly,
  needsKeyboardNotice,
  resetKeyboardSeen,
  watchForKeyboard,
} from './keyboardSeen';

afterEach(() => resetKeyboardSeen());

describe('the needs-a-keyboard notice', () => {
  it('is shown only to a finger with no key seen and not yet waved past', () => {
    expect(needsKeyboardNotice({ coarsePointer: true, keyboardSeen: false, dismissed: false })).toBe(true);
    expect(needsKeyboardNotice({ coarsePointer: false, keyboardSeen: false, dismissed: false })).toBe(false);
    expect(needsKeyboardNotice({ coarsePointer: true, keyboardSeen: true, dismissed: false })).toBe(false);
    expect(needsKeyboardNotice({ coarsePointer: true, keyboardSeen: false, dismissed: true })).toBe(false);
  });

  it('counts any key pressed on the page as a keyboard, from the moment it is watched', () => {
    const target = new EventTarget();
    const stop = watchForKeyboard(target);
    expect(keyboardSeen()).toBe(false);
    target.dispatchEvent(new Event('keydown'));
    expect(keyboardSeen()).toBe(true);
    stop();
  });

  it('stays away for the page once it has been waved past by touch', () => {
    dismissKeyboardNotice();
    // No window in the suite reads as no coarse pointer, so ask the rule directly.
    expect(needsKeyboardNotice()).toBe(false);
  });

  it('still looks touch-only in the harbour after the notice is waved past, until a key goes down', () => {
    // A tablet tapped past the notice and through Oak's lab and stood in the
    // yard under "[ARROWS] WALK" (persona playtest, 23 Nov 2026).
    dismissKeyboardNotice();
    expect(looksTouchOnly(true)).toBe(true);
    expect(looksTouchOnly(false)).toBe(false);
    const target = new EventTarget();
    const stop = watchForKeyboard(target);
    target.dispatchEvent(new Event('keydown'));
    expect(looksTouchOnly(true)).toBe(false);
    stop();
  });
});
