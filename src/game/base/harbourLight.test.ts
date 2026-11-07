import { describe, expect, it } from 'vitest';
import { BEAM_ARC, BEAM_SWEEP_MS, beamAngle, harbourWash, lightsAreOn } from './harbourLight';
import { findPortholes, findWindows } from './litWindows';

const at = (hour: number): Date => new Date(2026, 9, 25, hour, 30);

describe('the harbour by the clock', () => {
  it('is daylight from seven until six, warm at dusk and deep blue at night, as the house window is', () => {
    expect(harbourWash(at(12))).toBeNull();
    expect(lightsAreOn(at(12))).toBe(false);
    const dusk = harbourWash(at(19));
    const night = harbourWash(at(23));
    expect(dusk && night).toBeTruthy();
    expect(dusk!.alpha).toBeLessThan(night!.alpha);
    // Names and figures stay readable: the wash never hides more than half the picture.
    expect(night!.alpha).toBeLessThanOrEqual(0.5);
    expect(lightsAreOn(at(19))).toBe(true);
    expect(lightsAreOn(at(2))).toBe(true);
    expect(harbourWash(at(6))).toEqual(dusk);
  });

  it('swings the harbour light across the bay and back, never past its arc', () => {
    for (let ms = 0; ms < BEAM_SWEEP_MS * 2; ms += 97) {
      const angle = beamAngle(ms);
      expect(angle).toBeGreaterThanOrEqual(BEAM_ARC.from - 1e-9);
      expect(angle).toBeLessThanOrEqual(BEAM_ARC.to + 1e-9);
    }
    expect(beamAngle(0)).toBeCloseTo(beamAngle(BEAM_SWEEP_MS));
    expect(beamAngle(BEAM_SWEEP_MS / 2)).toBeCloseTo(BEAM_ARC.from);
  });
});

/** A width x height RGBA picture filled with `fill`, with `paint` rectangles laid on it. */
function picture(
  width: number,
  height: number,
  fill: readonly number[],
  paint: readonly { x: number; y: number; w: number; h: number; rgb: readonly number[] }[],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) pixels.set([...fill, 255], i * 4);
  for (const { x, y, w, h, rgb } of paint) {
    for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) pixels.set([...rgb, 255], (py * width + px) * 4);
  }
  return pixels;
}

const GLASS = [152, 208, 248];
const WALL = [200, 216, 232].map((value) => value - 60);
const DARK = [16, 16, 24];

describe('which windows light', () => {
  it('finds a window-sized pane of glass, and reads a glint across it as the same window', () => {
    const pixels = picture(40, 30, WALL, [
      { x: 5, y: 5, w: 9, h: 6, rgb: GLASS },
      { x: 9, y: 5, w: 1, h: 6, rgb: [240, 240, 248] },
    ]);
    expect(findWindows(pixels, 40, 30)).toEqual([{ x: 5, y: 5, width: 9, height: 6 }]);
  });

  it('leaves a roof drawn in the same blue, and flowers smaller than a pane, dark', () => {
    const pixels = picture(80, 40, WALL, [
      { x: 0, y: 0, w: 70, h: 20, rgb: GLASS },
      { x: 5, y: 30, w: 4, h: 4, rgb: GLASS },
    ]);
    expect(findWindows(pixels, 80, 40)).toEqual([]);
  });

  it('finds a ship\'s portholes along its hull, and not the line round its edge', () => {
    const pixels = picture(40, 20, [208, 208, 232], [
      { x: 0, y: 0, w: 40, h: 1, rgb: DARK },
      { x: 5, y: 10, w: 2, h: 2, rgb: DARK },
      { x: 10, y: 10, w: 3, h: 2, rgb: DARK },
    ]);
    expect(findPortholes(pixels, 40, 20)).toEqual([
      { x: 5, y: 10, width: 2, height: 2 },
      { x: 10, y: 10, width: 3, height: 2 },
    ]);
  });
});
