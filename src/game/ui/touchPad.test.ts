import { describe, expect, it } from 'vitest';
import { DPAD_DEAD_ZONE, dpadDirection, padPixel, padTextSize, shareKeys, shortcutsFrom, trayColumns } from './touchPad';

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

  it('lays a tray out in even rows, and shares the keys between two trays', () => {
    expect(trayColumns(4, 4)).toBe(4);
    expect(trayColumns(6, 4)).toBe(3);
    expect(trayColumns(5, 4)).toBe(3);
    expect(trayColumns(8, 4)).toBe(4);
    expect(trayColumns(3, 2)).toBe(2);
    expect(shareKeys([1, 2, 3, 4], 1)).toEqual([[1, 2, 3, 4]]);
    expect(shareKeys([1, 2, 3, 4, 5], 2)).toEqual([[1, 2, 3], [4, 5]]);
  });
});
