import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyMenuStage,
  computeMenuStage,
  FEEDBACK_BOTTOM_MIN_HEIGHT,
  FEEDBACK_RIGHT_MIN_WIDTH,
  FEEDBACK_TAB_STRIP,
  feedbackTabEdge,
  MAX_MENU_SCALE,
  MENU_LAYER_ID,
  MENU_MAX_WIDTH,
  MENU_MIN_HEIGHT,
  MENU_MIN_WIDTH,
  MIN_MENU_SCALE,
  SMALL_WINDOW_MENU_SCALE,
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
    // 1920 less the inset and the FEEDBACK tab's strip, at 2x: the screen holds
    // 936 game pixels across, and what fills them is columns. At 720 - the cap
    // while a body was one column - a quarter of that window was backdrop
    // either side of a thin list.
    const menu = computeMenuStage(1920, 950);
    expect(menu.width).toBe(936);
    expect(menu.width * menu.scale).toBe(1920 - FEEDBACK_TAB_STRIP - 8 * 2);
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
      expect(stage.width * stage.scale, `${width}x${height} width`).toBeLessThanOrEqual(width);
      expect(stage.height * stage.scale, `${width}x${height} height`).toBeLessThanOrEqual(height);
    }
  });

  it('keeps a phone inside its window, so a panel and its DONE button are on the screen', () => {
    for (const [width, height] of [[390, 844], [844, 390], [360, 640], [640, 360]]) {
      const stage = computeMenuStage(width, height);
      const layer = fakeLayer();
      applyMenuStage(layer as unknown as HTMLElement, width, height);
      expect(stage.scale, `${width}x${height}`).toBe(SMALL_WINDOW_MENU_SCALE);
      expect(Number.parseFloat(layer.style.left) + stage.width, `${width}x${height} across`).toBeLessThanOrEqual(width);
      expect(Number.parseFloat(layer.style.top) + stage.height, `${width}x${height} down`).toBeLessThanOrEqual(height);
    }
    // The smallest window that holds the smallest screen is drawn as it always was.
    expect(computeMenuStage(640, 480)).toEqual({ width: MENU_MIN_WIDTH, height: MENU_MIN_HEIGHT, scale: MIN_MENU_SCALE });
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

  it('never lays a screen out under the FEEDBACK tab, on whichever edge it stands', () => {
    for (const [width, height] of [[1280, 800], [1920, 1080], [1366, 768], [3840, 2160], [800, 600], [390, 844], [600, 900], [844, 390]]) {
      const stage = computeMenuStage(width, height);
      const layer = fakeLayer();
      applyMenuStage(layer as unknown as HTMLElement, width, height);
      const left = Number.parseFloat(layer.style.left);
      const top = Number.parseFloat(layer.style.top);
      const edge = feedbackTabEdge(width, height);
      // A phone narrower than the smallest screen is the one place a menu
      // cannot fit beside anything; it may only reach the strip on the far side.
      if (edge === 'right' && stage.width * stage.scale <= width - FEEDBACK_TAB_STRIP) {
        expect(left + stage.width * stage.scale, `${width}x${height}`).toBeLessThanOrEqual(width - FEEDBACK_TAB_STRIP);
      }
      if (edge === 'bottom' && stage.height * stage.scale <= height - FEEDBACK_TAB_STRIP) {
        expect(top + stage.height * stage.scale, `${width}x${height}`).toBeLessThanOrEqual(height - FEEDBACK_TAB_STRIP);
      }
    }
  });

  it('moves the tab under a menu that has no room beside it but room beneath', () => {
    // A 650-wide window holds the smallest screen (640 at 2x) and not the strip
    // beside it: on the right, the tab sat over Bill's prices and the stash's
    // counts. Wherever either edge has room for the strip, a menu is never under it.
    for (let width = 600; width <= 720; width += 1) {
      for (const height of [480, 511, 512, 600, 700, 900]) {
        const stage = computeMenuStage(width, height);
        const menuWidth = stage.width * stage.scale;
        const menuHeight = stage.height * stage.scale;
        // Room for the smallest screen there is, not for this one: a menu grows
        // into whatever the window has, strip included, until the strip is kept.
        const roomBeside = MENU_MIN_WIDTH * MIN_MENU_SCALE <= width - FEEDBACK_TAB_STRIP;
        const roomBeneath = MENU_MIN_HEIGHT * MIN_MENU_SCALE <= height - FEEDBACK_TAB_STRIP;
        if (!roomBeside && !roomBeneath) continue;
        const layer = fakeLayer();
        applyMenuStage(layer as unknown as HTMLElement, width, height);
        const right = Number.parseFloat(layer.style.left) + menuWidth;
        const bottom = Number.parseFloat(layer.style.top) + menuHeight;
        if (feedbackTabEdge(width, height) === 'right') {
          expect(right, `${width}x${height}`).toBeLessThanOrEqual(width - FEEDBACK_TAB_STRIP);
        } else {
          expect(bottom, `${width}x${height}`).toBeLessThanOrEqual(height - FEEDBACK_TAB_STRIP);
        }
      }
    }
    expect(feedbackTabEdge(650, 700)).toBe('bottom');
    expect(feedbackTabEdge(672, 700)).toBe('right');
    // Room on neither edge: the tab stays where it always stood.
    expect(feedbackTabEdge(640, 480)).toBe('right');
  });

  it('keeps the strip on the edge the stylesheet puts the tab on', () => {
    const css = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
    expect(css).toContain(
      `@media (max-width: 600px) and (orientation: portrait), (max-width: ${FEEDBACK_RIGHT_MIN_WIDTH - 1}px) and (min-height: ${FEEDBACK_BOTTOM_MIN_HEIGHT}px) {\n  .feedback-tab {`,
    );
    expect(feedbackTabEdge(600, 900)).toBe('bottom');
    expect(feedbackTabEdge(500, 400)).toBe('right');
    expect(feedbackTabEdge(FEEDBACK_RIGHT_MIN_WIDTH - 1, FEEDBACK_BOTTOM_MIN_HEIGHT)).toBe('bottom');
    expect(feedbackTabEdge(FEEDBACK_RIGHT_MIN_WIDTH - 1, FEEDBACK_BOTTOM_MIN_HEIGHT - 1)).toBe('right');
    expect(feedbackTabEdge(FEEDBACK_RIGHT_MIN_WIDTH - 0.5, 900)).toBe('right');
    expect(feedbackTabEdge(FEEDBACK_RIGHT_MIN_WIDTH, 900)).toBe('right');
    // The tab is 30 wide with a 2-pixel shadow: the strip holds both.
    expect(css).toMatch(/\.feedback-tab \{[^}]*width: 30px;[^}]*box-shadow: 2px 0 0/);
    expect(FEEDBACK_TAB_STRIP).toBe(32);
  });
});
