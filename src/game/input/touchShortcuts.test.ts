import { describe, expect, it } from 'vitest';
import { hasTouchShortcuts, letterShortcut, sameShortcuts, shortcutsInHint, withMoment } from './touchShortcuts';

describe('the screen\'s own keys on the touch pad', () => {
  it('reads every letter and digit key a hint line names, with its words', () => {
    expect(shortcutsInHint('[H] DECORATE')).toEqual([{ code: 'KeyH', label: 'DECORATE' }]);
    expect(shortcutsInHint('[R] TURN   [X] PUT AWAY')).toEqual([
      { code: 'KeyR', label: 'TURN' },
      { code: 'KeyX', label: 'PUT AWAY' },
    ]);
    expect(shortcutsInHint('[1] OVER HERE!\n[2] HELP!')).toEqual([
      { code: 'Digit1', label: 'OVER HERE!' },
      { code: 'Digit2', label: 'HELP!' },
    ]);
  });

  it('leaves the keys that are the pad\'s own buttons to the pad', () => {
    expect(shortcutsInHint('[SPACE] FISH')).toEqual([]);
    expect(shortcutsInHint('[ARROWS] WALK   [ESC] SKIP')).toEqual([]);
    expect(shortcutsInHint('[DOWN] OUT')).toEqual([]);
    expect(shortcutsInHint('')).toEqual([]);
  });

  it('keeps a standing key in its place, dead, when the moment takes its letter, and adds the moment\'s after', () => {
    const standing = [letterShortcut('L', 'LOOK'), letterShortcut('X', 'DEX')];
    expect(withMoment(standing, [letterShortcut('L', 'LEAD'), letterShortcut('H', 'DECORATE')])).toEqual([
      { code: 'KeyL', label: 'LOOK', inert: true },
      { code: 'KeyX', label: 'DEX' },
      { code: 'KeyL', label: 'LEAD', extra: true },
      { code: 'KeyH', label: 'DECORATE', extra: true },
    ]);
    // The same key named the same way is one key, where it stands.
    expect(withMoment(standing, [letterShortcut('L', 'LOOK')])).toEqual(standing);
  });

  it('knows a scene that offers keys and two lists that draw the same', () => {
    expect(hasTouchShortcuts({ touchShortcuts: () => [] })).toBe(true);
    expect(hasTouchShortcuts({})).toBe(false);
    expect(hasTouchShortcuts(null)).toBe(false);
    expect(sameShortcuts([letterShortcut('B', 'PACK')], [letterShortcut('B', 'PACK')])).toBe(true);
    expect(sameShortcuts([letterShortcut('B', 'PACK')], [letterShortcut('B', 'THINGS')])).toBe(false);
  });
});
