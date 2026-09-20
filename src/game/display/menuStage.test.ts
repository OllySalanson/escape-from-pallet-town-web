import { describe, expect, it } from 'vitest';
import {
  applyMenuStage,
  computeMenuStage,
  MAX_MENU_SCALE,
  MENU_LAYER_ID,
  MENU_MAX_WIDTH,
  MENU_MIN_HEIGHT,
  MENU_MIN_WIDTH,
  MIN_MENU_SCALE,
  menuLayer,
} from './menuStage';
import { computeStage } from './stage';

/** Every window a desktop browser is likely to be at, smallest first. */
const WINDOWS = [
  [640, 480],
  [800, 600],
  [1024, 640],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1600, 900],
  [1920, 950],
  [1920, 1080],
  [2560, 1330],
  [2560, 1440],
  [3440, 1400],
  [3840, 2000],
  [3840, 2160],
] as const;

function fakeLayer(): { style: Record<string, string> & { setProperty(name: string, value: string): void } } {
  const style = {
    setProperty(name: string, value: string) {
      (style as unknown as Record<string, string>)[name] = value;
    },
  } as Record<string, string> & { setProperty(name: string, value: string): void };
  return { style };
}

describe('the menu screens are laid out against the window', () => {
  it('spends the whole of the captain\'s window rather than capping the measure', () => {
    // 1920 less the inset, at 2x: the screen holds 952 game pixels across, and
    // what fills them is columns. At 720 - the cap while a body was one column
    // - a quarter of that window was backdrop either side of a thin list.
    const menu = computeMenuStage(1920, 950);
    expect(menu.width).toBe(952);
    expect(menu.width * menu.scale).toBe(1920 - 8 * 2);
  });

  it('is not the canvas box: the same window gives the two different screens', () => {
    // The captain's own window. The canvas is capped at 400x256 because the
    // world view is a deliberate size; a menu on the same display has no such
    // reason and used to inherit that box anyway.
    const canvas = computeStage(1920, 950);
    const menu = computeMenuStage(1920, 950);

    expect([canvas.width, canvas.height, canvas.zoom]).toEqual([400, 256, 3]);
    expect(menu.width).toBeGreaterThan(canvas.width);
    expect(menu.height).toBeGreaterThan(canvas.height);
    // The screen is bigger on the glass as well as in game pixels: the canvas
    // leaves 720 pixels of the window unused and the menu leaves none of it.
    expect(menu.width * menu.scale).toBeGreaterThan(canvas.width * canvas.zoom);
  });

  it('spends a bigger window on room before it spends it on magnification', () => {
    const small = computeMenuStage(1280, 720);
    const big = computeMenuStage(2560, 1330);
    const huge = computeMenuStage(3840, 2000);

    // Never fewer game pixels of height - which is rows - as the window grows.
    expect(big.height).toBeGreaterThanOrEqual(MENU_MIN_HEIGHT);
    expect(huge.height).toBeGreaterThan(small.height);
    // And the type does step up on a display that can afford it without losing
    // rows, but only there.
    expect(small.scale).toBe(MIN_MENU_SCALE);
    expect(huge.scale).toBe(MAX_MENU_SCALE);
    expect(big.scale).toBeGreaterThan(small.scale);
  });

  it('never resamples: a whole scale, a whole box, and whole placement', () => {
    for (const [width, height] of WINDOWS) {
      const stage = computeMenuStage(width, height);
      expect(Number.isInteger(stage.scale), `${width}x${height} scale`).toBe(true);
      expect(stage.scale).toBeGreaterThanOrEqual(MIN_MENU_SCALE);
      expect(stage.scale).toBeLessThanOrEqual(MAX_MENU_SCALE);
      expect(Number.isInteger(stage.width) && Number.isInteger(stage.height)).toBe(true);

      const layer = fakeLayer();
      applyMenuStage(layer as unknown as HTMLElement, width, height);
      expect(layer.style['--px']).toBe(`${stage.scale}px`);
      expect(layer.style['--zoom']).toBe(`${stage.scale}`);
      // A screen standing on half a pixel is a screen the browser blurs, frame,
      // glyphs and all.
      for (const edge of ['left', 'top'] as const) {
        expect(Number.isInteger(Number.parseFloat(layer.style[edge])), `${width}x${height} ${edge}`).toBe(true);
      }
    }
  });

  it('holds the authored floor and the measure ceiling at every window', () => {
    for (const [width, height] of WINDOWS) {
      const stage = computeMenuStage(width, height);
      // Nothing is ever laid out in less room than every screen is authored for.
      expect(stage.width).toBeGreaterThanOrEqual(MENU_MIN_WIDTH);
      expect(stage.height).toBeGreaterThanOrEqual(MENU_MIN_HEIGHT);
      // And no screen is ever run across a metre of glass. A *row* is now a
      // column wide rather than a screen wide - see `ui/columnLayout.ts` - so
      // this is the ceiling on how far a pane at one edge can be from the pane
      // at the other, not on the measure of a line.
      expect(stage.width).toBeLessThanOrEqual(MENU_MAX_WIDTH);
      // The box fits the window, except in one smaller than the game's own
      // floor - where the canvas overflows too rather than shrink below 2x.
      if (width >= 640 && height >= 480) {
        expect(stage.width * stage.scale, `${width}x${height} width`).toBeLessThanOrEqual(width);
        expect(stage.height * stage.scale, `${width}x${height} height`).toBeLessThanOrEqual(height);
      }
    }
  });

  it('keeps every window bigger than the last from losing room', () => {
    const rooms = WINDOWS.map(([width, height]) => {
      const stage = computeMenuStage(width, height);
      return stage.width * stage.height;
    });
    // Not strictly monotonic - a window can grow in one direction only - but a
    // display that is bigger both ways never shows less.
    expect(computeMenuStage(3840, 2160).height).toBeGreaterThan(computeMenuStage(1280, 720).height);
    expect(Math.min(...rooms)).toBe(MENU_MIN_WIDTH * MENU_MIN_HEIGHT);
  });

  it('survives a resize by being a pure function of the window', () => {
    const first = computeMenuStage(1920, 950);
    const resized = computeMenuStage(2560, 1330);
    expect(computeMenuStage(1920, 950)).toEqual(first);
    expect(resized).not.toEqual(first);
  });

  it('puts the layer on the body once, beside the canvas rather than inside it', () => {
    const appended: unknown[] = [];
    const elements: Record<string, unknown>[] = [];
    const host = {
      getElementById: (id: string) =>
        (elements.find((element) => element.id === id) as unknown as HTMLElement | undefined) ?? null,
      createElement: () => {
        const element = {} as Record<string, unknown>;
        elements.push(element);
        return element;
      },
      body: { append: (element: unknown) => appended.push(element) },
    } as unknown as Document;

    const first = menuLayer(host);
    const again = menuLayer(host);

    expect(first.id).toBe(MENU_LAYER_ID);
    expect(again).toBe(first);
    expect(appended).toEqual([first]);
  });
});
