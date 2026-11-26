import { describe, expect, it } from 'vitest';
import { DPAD_DEAD_ZONE, chipFit, chipHeightIn, chipWordParts, padSmallTextSize, dpadDirection, trayOrder, padPixel, padTextSize, rowsFor, shareKeys, shortcutsFrom } from './touchPad';

describe('the touch pad', () => {
  it('reads a thumb on the d-pad by the axis it is further along, with a still middle', () => {
    expect(dpadDirection(50, 5, 100)).toBe('ArrowUp');
    expect(dpadDirection(50, 95, 100)).toBe('ArrowDown');
    expect(dpadDirection(5, 50, 100)).toBe('ArrowLeft');
    expect(dpadDirection(95, 50, 100)).toBe('ArrowRight');
    // A thumb rolled up and to the right is still more up than right.
    expect(dpadDirection(70, 10, 100)).toBe('ArrowUp');
    expect(dpadDirection(50 + 100 * DPAD_DEAD_ZONE * 0.9, 50, 100)).toBeNull();
    // Off the square, a held thumb keeps steering.
    expect(dpadDirection(-40, 50, 100)).toBe('ArrowLeft');
  });

  it('offers the keys of the topmost scene that has any', () => {
    const world = { touchShortcuts: () => [{ code: 'KeyB', label: 'PACK' }] };
    const battle = { touchShortcuts: () => [] };
    expect(shortcutsFrom([world, battle])).toEqual([{ code: 'KeyB', label: 'PACK' }]);
    expect(shortcutsFrom([world, { touchShortcuts: () => [{ code: 'KeyH', label: 'DECORATE' }] }])).toEqual([
      { code: 'KeyH', label: 'DECORATE' },
    ]);
    expect(shortcutsFrom([{}, {}])).toEqual([]);
    // A battle over a raid keeps the raid's keys in their places, dimmed.
    const pack = { code: 'KeyB', label: 'PACK' };
    const drop = { code: 'KeyX', label: 'DROP', extra: true };
    expect(shortcutsFrom([{ dimsTouchTray: true }], [pack, drop])).toEqual([{ ...pack, inert: true }]);
  });

  it('draws its art on whole device pixels', () => {
    expect(padPixel(2.2857, 2.625) * 2.625).toBeCloseTo(6, 9);
    expect(padPixel(4, 2)).toBe(4);
    expect(padPixel(0.1, 3)).toBeCloseTo(1 / 3, 9);
  });

  it('sets its words at a whole-device-pixel stem, near 18 CSS pixels', () => {
    for (const ratio of [1, 2, 2.625, 3]) {
      const size = padTextSize(ratio);
      expect(Number.isInteger(Math.round((size / 12.5) * ratio * 1e9) / 1e9)).toBe(true);
      expect(size).toBeGreaterThanOrEqual(16);
      expect(size).toBeLessThanOrEqual(26);
    }
  });

  it('keeps every standing key in its place, with the keys a moment adds after them', () => {
    const oak = { code: 'KeyO', label: 'OAK' };
    const look = { code: 'KeyL', label: 'LOOK' };
    const pack = { code: 'KeyB', label: 'PACK' };
    const team = { code: 'KeyP', label: 'TEAM' };
    const drop = { code: 'KeyX', label: 'DROP', extra: true };
    expect(shareKeys([oak, look, pack, team], 2)).toEqual([[oak, look], [pack, team]]);
    // DROP joins without moving PACK across the screen.
    expect(shareKeys([oak, look, pack, team, drop], 2)).toEqual([[oak, look], [pack, team, drop]]);
    expect(shareKeys([oak, drop, look], 1)).toEqual([[oak, look, drop]]);
  });
});

describe('a sentence of a menu\'s help on the touch pad', () => {
  it('names the screen\'s letter keys by their tray words, and no other capital', async () => {
    const { namingTrayKeys } = await import('./menuWords');
    const keys = [{ code: 'KeyX', label: 'DROP' }];
    expect(namingTrayKeys('Restores 20 HP. X drops one Potion.', keys)).toBe('Restores 20 HP. [DROP] drops one Potion.');
    expect(namingTrayKeys('A stronger hunter.', keys)).toBe('A stronger hunter.');
    expect(namingTrayKeys('I will go.', keys)).toBe('I will go.');
  });

  it('asks for a row for every four keys upright, and never fewer than two', () => {
    expect(rowsFor(0, 4)).toBe(2);
    expect(rowsFor(8, 4)).toBe(2);
    // The harbour's seven and YOUR THINGS' OUT, LOCK, < TAB and TAB >.
    expect(rowsFor(11, 4)).toBe(3);
  });

  it('draws keys smaller only when there is no room for their rows, never past the tray', () => {
    // Two rows of 48 and a gap: as designed.
    expect(chipHeightIn(104, 8, 4, 48)).toBe(48);
    // Three rows in the same tray, on a phone with no room above it.
    const squeezed = chipHeightIn(104, 11, 4, 48);
    expect(squeezed * 3 + 8 * 2).toBeLessThanOrEqual(104);
    expect(squeezed).toBeGreaterThanOrEqual(29);
    // Never taller than designed, however few.
    expect(chipHeightIn(400, 2, 2, 36)).toBe(36);
  });

  it('puts keys past two rows above them, so the first two rows never move', () => {
    const keys = ['LOOK', 'FAVOURS', 'THINGS', 'TEAM', 'DEX', 'MAP', 'SAY', 'OUT', 'LOCK', '< TAB', 'TAB >'];
    expect(trayOrder(keys, 4, 3)).toEqual([
      'LOCK', '< TAB', 'TAB >', null,
      'LOOK', 'FAVOURS', 'THINGS', 'TEAM',
      'DEX', 'MAP', 'SAY', 'OUT',
    ]);
    // A tray that got no third row (a short phone) keeps its order, drawn smaller.
    expect(trayOrder(keys, 4, 2)).toEqual(keys);
    expect(trayOrder(keys.slice(0, 8), 4, 2)).toEqual(keys.slice(0, 8));
  });

  it('fits a long word into its key on two lines, and a stem thinner only if two do not fit', () => {
    // A phone playtest (26 Nov 2026): FULL REPORT, TOSS A COIN, YOUR NAME and
    // SHELVES/BAR ran past their keys' edges on a 375-wide phone, cut off.
    const fits = (fitting: readonly string[]) => chipFit((tried) => !fitting.includes(tried));
    expect(fits(['line', 'wrap', 'small'])).toBe('line');
    expect(fits(['wrap', 'small'])).toBe('wrap');
    expect(fits(['small'])).toBe('small');
    // Two lines need somewhere to break: a slash is one.
    expect(chipWordParts('SHELVES/BAR')).toEqual(['SHELVES/', 'BAR']);
    expect(chipWordParts('FULL REPORT')).toEqual(['FULL REPORT']);
  });

  it('draws the thinner words on whole device pixels, one stem under the pad\'s own', () => {
    for (const ratio of [1, 2, 2.625, 3]) {
      const small = padSmallTextSize(ratio);
      expect(small).toBeLessThan(padTextSize(ratio));
      expect(Number.isInteger(Math.round(((small / 12.5) * ratio) * 1e6) / 1e6)).toBe(true);
    }
    expect(padSmallTextSize(2)).toBe(12.5);
  });
});
