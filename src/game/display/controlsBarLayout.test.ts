import { describe, expect, it } from 'vitest';
import { BAR_COLUMN_WIDTH, BAR_HEIGHT, barUnit, controlsBarPlacement } from './controlsBarLayout';
import { computeStage } from './stage';

describe('where the controls bar stands', () => {
  it('goes under the game when the window is tall enough, at the zoom the game had anyway', () => {
    const placed = controlsBarPlacement(1280, 800);
    expect(placed).toEqual({ side: 'below', unit: 2, gameViewportHeight: 800 - BAR_HEIGHT * 2 - 8 });
    expect(computeStage(1280, placed!.gameViewportHeight).zoom).toBe(computeStage(1280, 800).zoom);
  });

  it('never costs the game a zoom step', () => {
    for (const [width, height] of [
      [1280, 800],
      [1366, 768],
      [1536, 864],
      [1920, 960],
      [1920, 1080],
      [2560, 1300],
      [1024, 700],
    ] as const) {
      const placed = controlsBarPlacement(width, height);
      if (placed) {
        expect(computeStage(width, placed.gameViewportHeight).zoom, `${width}x${height}`).toBe(computeStage(width, height).zoom);
      }
    }
  });

  it('stands beside the game when there is no height to spare but a column of width', () => {
    // 960 is exactly four times the game's 240: not a row to spare below.
    const placed = controlsBarPlacement(1920, 960);
    expect(placed?.side).toBe('left');
    expect(placed!.unit).toBeGreaterThanOrEqual(2);
    const canvasWidth = computeStage(1920, 960).width * computeStage(1920, 960).zoom;
    expect(BAR_COLUMN_WIDTH * placed!.unit).toBeLessThanOrEqual((1920 - canvasWidth) / 2);
  });

  it('stays off a window cut to the game, which is what the test-mode drivers play in', () => {
    expect(controlsBarPlacement(400, 256)).toBeNull();
    expect(controlsBarPlacement(1200, 768)).toBeNull();
  });

  it('stays off a phone, which has the touch pad', () => {
    expect(controlsBarPlacement(844, 390, 3)).toBeNull();
  });

  it('draws its pixel a step smaller than the game, and never under one', () => {
    expect(barUnit(1)).toBe(1);
    expect(barUnit(3)).toBe(2);
    expect(barUnit(5)).toBe(4);
  });
});
