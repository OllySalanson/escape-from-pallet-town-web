import { describe, expect, it } from 'vitest';
import {
  BASE_STAGE_HEIGHT,
  BASE_STAGE_WIDTH,
  MAX_STAGE_HEIGHT,
  MAX_STAGE_WIDTH,
  MAX_STAGE_ZOOM,
  MIN_STAGE_ZOOM,
  baseCompositionOffset,
  computeStage,
  onDevicePixel,
  phonePixelZoom,
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

  it('zooms a phone in its own pixels: whole device pixels, larger than 1x, and still inside the window', () => {
    // [css width, css height, devicePixelRatio, device pixels a game pixel]
    const phones: readonly (readonly [number, number, number, number])[] = [
      [412, 915, 2.625, 3],
      [915, 412, 2.625, 4],
      [390, 844, 3, 3],
      [844, 390, 3, 4],
      [375, 667, 2, 2],
      [360, 800, 3, 3],
    ];
    for (const [width, height, ratio, devicePerPixel] of phones) {
      const stage = computeStage(width, height, ratio);
      const label = `${width}x${height}@${ratio}`;
      expect(stage.zoom * ratio, label).toBeCloseTo(devicePerPixel, 9);
      expect(stage.zoom, label).toBeGreaterThanOrEqual(1);
      expect(stage.width * stage.zoom, label).toBeLessThanOrEqual(width + 1e-9);
      expect(stage.height * stage.zoom, label).toBeLessThanOrEqual(height + 1e-9);
      expect(stage.width, label).toBeGreaterThanOrEqual(BASE_STAGE_WIDTH);
      expect(stage.height, label).toBeGreaterThanOrEqual(BASE_STAGE_HEIGHT);
    }
  });

  it('leaves every window that holds 2x, and every screen of ratio 1, exactly as it was', () => {
    for (const [width, height] of VIEWPORTS) {
      expect(computeStage(width, height, 2)).toEqual(computeStage(width, height));
      expect(computeStage(width, height, 1.5)).toEqual(computeStage(width, height));
    }
    expect(computeStage(390, 844, 1)).toEqual(computeStage(390, 844));
    expect(phonePixelZoom(400, 300, 1, 320, 240, 2)).toBeUndefined();
  });

  it('never draws a phone smaller than 1x to keep whole device pixels', () => {
    // 330 CSS pixels at 2.625 is 866 device pixels: two a game pixel would be
    // 0.76 CSS pixels, smaller than the 1x it had.
    expect(phonePixelZoom(330, 700, 2.625, 320, 240, 2)).toBeUndefined();
    expect(computeStage(330, 700, 2.625).zoom).toBe(1);
  });

  it('places a corner on a whole device pixel', () => {
    expect(onDevicePixel(10.3, 2.625) * 2.625).toBeCloseTo(27, 9);
    expect(onDevicePixel(7.5, 1)).toBe(7);
  });
});
