import { describe, expect, it } from 'vitest';
import { BELT_BUTTON, frameLayout, RING, type FrameInput } from './stageFrame';

const window = (overrides: Partial<FrameInput>): FrameInput => ({
  viewportWidth: 1920,
  viewportHeight: 1080,
  canvas: { x: 160, y: 0, width: 1600, height: 960 },
  bar: { x: 160, y: 968, width: 1600, height: 108 },
  unit: 4,
  fullScreenButton: false,
  ...overrides,
});

describe('the frame round the game', () => {
  it('rings the game and the bar under it as one screen', () => {
    const layout = frameLayout(window({}));
    expect(layout.screen).toEqual({ x: 160, y: 0, width: 1600, height: 1076 });
  });

  it('counts its lattice from the game\'s corner, so the dots sit on the game\'s grid', () => {
    expect(frameLayout(window({})).origin).toEqual({ x: 160, y: 0 });
  });

  it('runs the belt through both margins at the game\'s middle, on its grid, with a button centred in each', () => {
    const { belt, unit } = frameLayout(window({}));
    expect(belt).not.toBeNull();
    expect((belt!.y + unit) % unit).toBe(0);
    expect(belt!.y).toBe(476);
    const [left, right] = belt!.buttons;
    expect(left.width).toBe(BELT_BUTTON * 4);
    // Centred in the 148 pixels left of the ring, and in the right less the FEEDBACK tab's strip.
    expect(left.x + left.width / 2).toBeCloseTo((160 - RING * 4) / 2, -1);
    expect(right.x).toBeGreaterThan(1760 + RING * 4);
    expect(right.x + right.width).toBeLessThan(1920 - 32);
  });

  it('gives a thin margin only the ring: no belt, no studs', () => {
    const layout = frameLayout(window({ viewportWidth: 1280, viewportHeight: 800, canvas: { x: 40, y: 0, width: 1200, height: 720 }, bar: null, unit: 3 }));
    expect(layout.belt).toBeNull();
    expect(layout.studs).toEqual([]);
  });

  it('studs the ring\'s corners only where there is room for them all round', () => {
    const roomy = frameLayout(window({ viewportHeight: 1200, canvas: { x: 160, y: 60, width: 1600, height: 960 }, bar: null }));
    expect(roomy.studs).toHaveLength(4);
    expect(frameLayout(window({})).studs).toEqual([]);
  });

  it('keeps the belt\'s left button clear of a controls bar stood up beside the game', () => {
    const column = { x: 224, y: 0, width: 288, height: 1440 };
    const { belt } = frameLayout(window({ viewportWidth: 3440, viewportHeight: 1440, canvas: { x: 520, y: 0, width: 2400, height: 1440 }, bar: null, column, unit: 6 }));
    const [left] = belt!.buttons;
    expect(left.x + left.width).toBeLessThanOrEqual(column.x);
    expect(left.x).toBeGreaterThanOrEqual(0);
  });

  it('draws no ornament round the touch pad', () => {
    const layout = frameLayout(window({ ornaments: false, viewportHeight: 1200, canvas: { x: 160, y: 60, width: 1600, height: 960 }, bar: null }));
    expect(layout.belt).toBeNull();
    expect(layout.studs).toEqual([]);
  });

  it('holds the FULL SCREEN button top right, clear of the ring and the window, when asked and there is room', () => {
    const { button } = frameLayout(window({ viewportWidth: 2560, viewportHeight: 1440, canvas: { x: 80, y: 0, width: 2400, height: 1440 }, bar: null, unit: 6, fullScreenButton: true }));
    expect(button).not.toBeNull();
    expect(button!.x).toBeGreaterThanOrEqual(2480 + RING * 6);
    expect(button!.x + button!.width).toBeLessThanOrEqual(2560);
    expect(button!.width).toBeGreaterThanOrEqual(32);
    expect(button!.width % 6).toBe(0);
  });

  it('never squeezes the button into a margin too thin for it', () => {
    const { button } = frameLayout(window({ viewportWidth: 1216, viewportHeight: 720, canvas: { x: 8, y: 0, width: 1200, height: 720 }, bar: null, unit: 3, fullScreenButton: true }));
    expect(button).toBeNull();
  });

  it('has no button when not asked: the bar holds the tile', () => {
    expect(frameLayout(window({ fullScreenButton: false })).button).toBeNull();
  });
});
