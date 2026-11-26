import { describe, expect, it } from 'vitest';
import { BASE_STAGE_HEIGHT, BASE_STAGE_WIDTH } from './stage';
import { MAX_PAD_SCALE, MIN_PAD_SCALE, computeTouchLayout, type Rect } from './touchLayout';

/** [css width, css height, devicePixelRatio] */
const PHONES: readonly (readonly [number, number, number])[] = [
  [412, 915, 2.625],
  [915, 412, 2.625],
  [915, 360, 2.625],
  [390, 844, 3],
  [844, 390, 3],
  [375, 667, 2],
  [667, 375, 2],
  [360, 640, 3],
  [640, 360, 3],
  [820, 1180, 2],
  [1180, 820, 2],
  [1280, 800, 1],
];

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (inner: Rect, width: number, height: number): boolean =>
  inner.x >= 0 && inner.y >= 0 && inner.x + inner.width <= width + 1e-6 && inner.y + inner.height <= height + 1e-6;

describe('laying a touch screen out round the pad', () => {
  it.each(PHONES)('never puts a thumb over the game, or anything off the screen, at %ix%i', (width, height, ratio) => {
    const layout = computeTouchLayout(width, height, ratio);
    const controls = [layout.dpad, layout.buttons, ...layout.trays, layout.system];
    for (const box of [layout.canvas, ...controls]) {
      expect(inside(box, width, height), JSON.stringify(box)).toBe(true);
    }
    for (const box of controls) {
      expect(overlaps(box, layout.canvas), JSON.stringify(box)).toBe(false);
    }
    expect(overlaps(layout.dpad, layout.buttons)).toBe(false);
    for (const tray of layout.trays) {
      expect(overlaps(tray, layout.buttons)).toBe(false);
      expect(overlaps(tray, layout.dpad)).toBe(false);
      expect(overlaps(tray, layout.system)).toBe(false);
      // Room for at least one row of the screen's keys.
      expect(tray.height).toBeGreaterThanOrEqual(48 * MIN_PAD_SCALE);
    }
  });

  it.each(PHONES)('gives the game at least its smallest screen, and the menus room clear of the pad, at %ix%i', (width, height, ratio) => {
    const layout = computeTouchLayout(width, height, ratio);
    expect(layout.stage.width).toBeGreaterThanOrEqual(BASE_STAGE_WIDTH);
    expect(layout.stage.height).toBeGreaterThanOrEqual(BASE_STAGE_HEIGHT);
    expect(layout.canvas.width).toBeCloseTo(layout.stage.width * layout.stage.zoom, 6);
    for (const control of [layout.dpad, layout.buttons, ...layout.trays]) {
      expect(overlaps(layout.menus, control), JSON.stringify(control)).toBe(false);
    }
    expect(layout.padScale).toBeGreaterThanOrEqual(MIN_PAD_SCALE);
    expect(layout.padScale).toBeLessThanOrEqual(MAX_PAD_SCALE);
  });

  it('places the canvas on whole device pixels', () => {
    for (const [width, height, ratio] of PHONES) {
      const { canvas } = computeTouchLayout(width, height, ratio);
      expect(Math.abs(canvas.x * ratio - Math.round(canvas.x * ratio))).toBeLessThan(1e-6);
      expect(Math.abs(canvas.y * ratio - Math.round(canvas.y * ratio))).toBeLessThan(1e-6);
    }
  });

  it('is a Game Boy upright and a Game Boy Advance on its side', () => {
    const upright = computeTouchLayout(412, 915, 2.625);
    expect(upright.orientation).toBe('portrait');
    expect(upright.dpad.y).toBeGreaterThan(upright.canvas.y + upright.canvas.height);
    expect(upright.dpad.x).toBeLessThan(upright.buttons.x);
    // The game straight under the top bar, never floating mid-screen.
    expect(upright.canvas.y).toBeLessThanOrEqual(upright.system.y + upright.system.height + 16);
    const sideways = computeTouchLayout(915, 412, 2.625);
    expect(sideways.orientation).toBe('landscape');
    expect(sideways.dpad.x + sideways.dpad.width).toBeLessThanOrEqual(sideways.canvas.x);
    expect(sideways.buttons.x).toBeGreaterThanOrEqual(sideways.canvas.x + sideways.canvas.width);
  });

  it('keeps every control a fingertip wide: a d-pad arm and the screen\'s keys at 44px or near it', () => {
    for (const [width, height, ratio] of PHONES) {
      const layout = computeTouchLayout(width, height, ratio);
      expect(layout.dpad.width / 3).toBeGreaterThanOrEqual(44 * MIN_PAD_SCALE);
      expect(layout.buttons.height).toBeGreaterThanOrEqual(100);
    }
  });

  it('keeps the pad clear of a notch and a home bar', () => {
    const insets = { top: 47, right: 0, bottom: 34, left: 0 };
    const layout = computeTouchLayout(390, 844, 3, insets);
    expect(layout.system.y).toBeGreaterThanOrEqual(insets.top);
    expect(layout.dpad.y + layout.dpad.height).toBeLessThanOrEqual(844 - insets.bottom);
    const sideways = computeTouchLayout(844, 390, 3, { top: 0, right: 47, bottom: 21, left: 47 });
    expect(sideways.dpad.x).toBeGreaterThanOrEqual(47);
    expect(sideways.buttons.x + sideways.buttons.width).toBeLessThanOrEqual(844 - 47);
  });

  it.each(PHONES)('gives a screen with more keys another row upright, above the tray and clear of the game, at %ix%i', (width, height, ratio) => {
    // YOUR THINGS names eleven keys with the harbour's; two rows of four held
    // eight, and the third row was drawn under the d-pad.
    const two = computeTouchLayout(width, height, ratio);
    const three = computeTouchLayout(width, height, ratio, undefined, 3);
    // Nothing the thumbs or the eyes have learned moves.
    expect(three.canvas).toEqual(two.canvas);
    expect(three.dpad).toEqual(two.dpad);
    expect(three.buttons).toEqual(two.buttons);
    expect(three.padScale).toBe(two.padScale);
    if (two.orientation === 'landscape') {
      expect(three.trayRows).toBe(2);
      return;
    }
    const tray = three.trays[0];
    expect(tray.y + tray.height).toBe(two.trays[0].y + two.trays[0].height);
    expect(overlaps(tray, three.canvas)).toBe(false);
    expect(overlaps(three.menus, tray)).toBe(false);
    if (three.trayRows === 3) {
      expect(tray.height).toBeGreaterThan(two.trays[0].height);
    } else {
      // A short phone has no room over the tray: it keeps two rows, and the
      // pad draws the keys smaller (`chipHeightIn`).
      expect(three.trayRows).toBe(2);
      expect(tray).toEqual(two.trays[0]);
    }
  });

  it('has the room for a third row on a tall phone', () => {
    expect(computeTouchLayout(412, 915, 2.625, undefined, 3).trayRows).toBe(3);
    expect(computeTouchLayout(412, 915, 2.625, undefined, 1).trayRows).toBe(2);
  });
});
