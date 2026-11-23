import { describe, expect, it } from 'vitest';
import {
  BASE_STAGE_HEIGHT,
  BASE_STAGE_WIDTH,
  MAX_STAGE_HEIGHT,
  MAX_STAGE_WIDTH,
  MAX_STAGE_ZOOM,
  MIN_STAGE_ZOOM,
  baseCompositionOffset,
  centredStart,
  computeStage,
  cssLength,
  onWholeScreenPixels,
} from './stage';

const VIEWPORTS = [
  [640, 480],
  [800, 600],
  [1024, 700],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
] as const;

describe('fitting the game screen to a window', () => {
  it('always draws whole pixels', () => {
    for (const [width, height] of VIEWPORTS) {
      const stage = computeStage(width, height);
      expect(Number.isInteger(stage.zoom)).toBe(true);
      expect(stage.zoom).toBeGreaterThanOrEqual(MIN_STAGE_ZOOM);
      expect(stage.zoom).toBeLessThanOrEqual(MAX_STAGE_ZOOM);
    }
  });

  it('never asks a scene to compose into less than the authored screen', () => {
    for (const [width, height] of VIEWPORTS) {
      const stage = computeStage(width, height);
      expect(stage.width).toBeGreaterThanOrEqual(BASE_STAGE_WIDTH);
      expect(stage.height).toBeGreaterThanOrEqual(BASE_STAGE_HEIGHT);
      expect(stage.width).toBeLessThanOrEqual(MAX_STAGE_WIDTH);
      expect(stage.height).toBeLessThanOrEqual(MAX_STAGE_HEIGHT);
    }
  });

  it('fits inside the window at every size that can hold the base screen', () => {
    for (const [width, height] of VIEWPORTS) {
      const stage = computeStage(width, height);
      expect(stage.width * stage.zoom).toBeLessThanOrEqual(width);
      expect(stage.height * stage.zoom).toBeLessThanOrEqual(height);
    }
  });

  it('uses a large display instead of parking a small screen in the middle of it', () => {
    // The shipped behaviour before this: a 960x720 canvas whatever the window,
    // which is a third of a 1080p browser and an eighth of a 1440p one.
    const cases: readonly (readonly [number, number, number])[] = [
      [1440, 900, 0.6],
      [1920, 1080, 0.7],
      [2560, 1440, 0.9],
    ];
    for (const [width, height, minimumShare] of cases) {
      const stage = computeStage(width, height);
      const share = (stage.width * stage.zoom * stage.height * stage.zoom) / (width * height);
      expect(share).toBeGreaterThan(minimumShare);
      expect(stage.width * stage.zoom).toBeGreaterThan(960);
    }
  });

  it('fits a window too small for 2x whole, at 1x, so nothing has to squeeze the canvas', () => {
    for (const [width, height] of [[390, 844], [844, 390], [480, 320], [639, 480], [640, 479]]) {
      const stage = computeStage(width, height);
      expect(stage.zoom, `${width}x${height}`).toBe(MIN_STAGE_ZOOM);
      expect(stage.width * stage.zoom, `${width}x${height} width`).toBeLessThanOrEqual(width);
      expect(stage.height * stage.zoom, `${width}x${height} height`).toBeLessThanOrEqual(height);
    }
    expect(computeStage(640, 480)).toEqual({ width: BASE_STAGE_WIDTH, height: BASE_STAGE_HEIGHT, zoom: 2 });
  });

  it('centres the authored composition on whole pixels', () => {
    for (const [width, height] of VIEWPORTS) {
      const offset = baseCompositionOffset(computeStage(width, height));
      expect(Number.isInteger(offset.x)).toBe(true);
      expect(Number.isInteger(offset.y)).toBe(true);
      expect(offset.x).toBeGreaterThanOrEqual(0);
      expect(offset.y).toBeGreaterThanOrEqual(0);
    }
  });
});

/** Windows' display scaling steps, and a Mac's 2. */
const PIXEL_RATIOS = [1, 1.25, 1.5, 1.75, 2, 2.25];
const wholeOnScreen = (zoom: number, ratio: number): boolean =>
  Math.abs(zoom * ratio - Math.round(zoom * ratio)) < 1e-9;

describe('fitting the game screen to a display scaled to 125% or 150%', () => {
  // Break-it test, 23 Nov 2026: 1920x1080 at 125% is a 1536-wide window whose
  // 3x was 3.75 screen pixels a game pixel, so every stroke came out three or
  // four pixels wide by turns.
  it('draws every game pixel as a whole number of screen pixels, at every ratio', () => {
    for (const ratio of PIXEL_RATIOS) {
      for (const [width, height] of VIEWPORTS) {
        const stage = computeStage(width / ratio, height / ratio, ratio);
        expect({ ratio, width, zoom: stage.zoom, whole: wholeOnScreen(stage.zoom, ratio) }).toMatchObject({ whole: true });
      }
    }
  });

  it('still fits the authored screen in the window, and never composes into less', () => {
    for (const ratio of PIXEL_RATIOS) {
      for (const [width, height] of VIEWPORTS) {
        const cssWidth = Math.floor(width / ratio);
        const cssHeight = Math.floor(height / ratio);
        if (cssWidth < BASE_STAGE_WIDTH || cssHeight < BASE_STAGE_HEIGHT) {
          continue; // a phone: nothing holds the authored screen, at any zoom
        }
        const stage = computeStage(cssWidth, cssHeight, ratio);
        expect(stage.width).toBeGreaterThanOrEqual(BASE_STAGE_WIDTH);
        expect(stage.height).toBeGreaterThanOrEqual(BASE_STAGE_HEIGHT);
        expect(cssLength(stage.width, stage.zoom, ratio)).toBeLessThanOrEqual(cssWidth);
        expect(cssLength(stage.height, stage.zoom, ratio)).toBeLessThanOrEqual(cssHeight);
      }
    }
  });

  it('draws a display at 1x or 2x exactly as before', () => {
    for (const ratio of [1, 2]) {
      for (const [width, height] of VIEWPORTS) {
        expect(computeStage(width, height, ratio)).toEqual(computeStage(width, height));
      }
    }
  });

  it('draws a 1080p laptop at 125% (a 1536x730 window) at 3 screen pixels a game pixel: 3.2 would not fit 730', () => {
    const stage = computeStage(1536, 730, 1.25);
    expect(stage.zoom).toBe(2.4);
    expect(cssLength(stage.width, stage.zoom, 1.25) * 1.25).toBe(stage.width * 3);
    // With the room, it goes up a screen pixel rather than down.
    expect(computeStage(1536, 800, 1.25).zoom).toBe(3.2);
  });

  it('moves a zoom down rather than up when up would not fit', () => {
    expect(onWholeScreenPixels(3, 1.25, () => false)).toBe(2.4);
    expect(onWholeScreenPixels(3, 1.25, () => true)).toBe(3.2);
    expect(onWholeScreenPixels(3, 1, () => false)).toBe(3);
    expect(onWholeScreenPixels(3, Number.NaN, () => true)).toBe(3);
  });

  it('starts a centred box on a whole screen pixel', () => {
    expect(centredStart(1536, 1280, 1.25) * 1.25).toBe(Math.floor(((1536 - 1280) / 2) * 1.25));
    expect(Number.isInteger(centredStart(1537, 1280, 1.5) * 1.5)).toBe(true);
    expect(centredStart(100, 300, 1.25)).toBe(0);
  });
});
