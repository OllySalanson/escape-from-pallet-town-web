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

  it('keeps a window too small for 2x readable rather than sub-pixel', () => {
    const stage = computeStage(480, 320);
    expect(stage.zoom).toBe(MIN_STAGE_ZOOM);
    expect(stage.width).toBe(BASE_STAGE_WIDTH);
    expect(stage.height).toBe(BASE_STAGE_HEIGHT);
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
