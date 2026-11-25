import { describe, expect, it } from 'vitest';
import { DPAD_DEAD_ZONE, dpadDirection, padPixel, padTextSize, shareKeys, shortcutsFrom } from './touchPad';

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
});
