import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyMenuStage,
  computeMenuStage,
  FEEDBACK_BOTTOM_MIN_HEIGHT,
  FEEDBACK_RIGHT_MIN_WIDTH,
  FEEDBACK_TAB_STRIP,
  feedbackTabEdge,
  menuScaleFor,
  MENU_LAYER_ID,
  MENU_MAX_WIDTH,
  worldUnitFor,
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
  it('stands in the game\'s own screen: the canvas\'s box on the glass, never across the page (the captain, 25 Nov 2026)', () => {
    for (const [width, height] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]]) {
      const canvas = computeStage(width, height);
      const menu = computeMenuStage(width, height);
      const layer = fakeLayer();
      applyMenuStage(layer as unknown as HTMLElement, width, height);
      const canvasLeft = Math.floor((width - canvas.width * canvas.zoom) / 2);
      const canvasTop = Math.floor((height - canvas.height * canvas.zoom) / 2);
      const label = `${width}x${height}`;
      // Inside the canvas's box, and filling it to within one game pixel.
      expect(Number.parseFloat(layer.style.left), label).toBeGreaterThanOrEqual(canvasLeft);
      expect(Number.parseFloat(layer.style.top), label).toBeGreaterThanOrEqual(canvasTop);
      expect(Number.parseFloat(layer.style.left) + menu.width * menu.scale, label).toBeLessThanOrEqual(canvasLeft + canvas.width * canvas.zoom);
      expect(Number.parseFloat(layer.style.top) + menu.height * menu.scale, label).toBeLessThanOrEqual(canvasTop + canvas.height * canvas.zoom);
      expect(canvas.width * canvas.zoom - menu.width * menu.scale, label).toBeLessThan(menu.scale * 2);
      // As fine as it takes to keep the room a screen was laid out for, never
      // coarser than the world and never under 2x.
      expect(menu.scale, label).toBe(menuScaleFor(canvas.zoom, canvas.width * canvas.zoom, canvas.height * canvas.zoom));
      expect(menu.scale, label).toBeLessThanOrEqual(canvas.zoom);
      expect(menu.width, label).toBeGreaterThanOrEqual(560);
      expect(menu.height, label).toBeGreaterThanOrEqual(384);
    }
  });

  it('keeps the room the screens were laid out for, at a laptop and on a big desktop', () => {
    // At the world's own zoom a menu had 400x256 game pixels, and the bench
    // showed none of its box (25 Nov 2026).
    expect(computeMenuStage(1280, 800)).toEqual({ width: 600, height: 384, scale: 2 });
    expect(computeMenuStage(1920, 1080)).toEqual({ width: 800, height: 512, scale: 2 });
    expect(computeMenuStage(2560, 1440)).toEqual({ width: 800, height: 480, scale: 3 });
    expect(menuScaleFor(2, 800, 600)).toBe(2);
    expect(menuScaleFor(1, 400, 300)).toBe(1);
  });

  it('never resamples: a whole scale, a whole box, and whole placement', () => {
    for (const [width, height] of WINDOWS) {
      const stage = computeMenuStage(width, height);
      expect(Number.isInteger(stage.scale), `${width}x${height} scale`).toBe(true);
      expect(stage.scale).toBeGreaterThanOrEqual(MIN_MENU_SCALE);
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

  it('draws a phone\'s menus in whole device pixels, inside the window and inside the tab\'s strip', () => {
    for (const [width, height, ratio] of [[412, 915, 2.625], [915, 412, 2.625], [390, 844, 3], [844, 390, 3], [375, 667, 2]]) {
      const label = `${width}x${height}@${ratio}`;
      const stage = computeMenuStage(width, height, ratio);
      const layer = fakeLayer();
      applyMenuStage(layer as unknown as HTMLElement, width, height, ratio);
      expect(Number.isInteger(Math.round(stage.scale * ratio * 1e9) / 1e9), label).toBe(true);
      expect(stage.scale, label).toBeGreaterThanOrEqual(SMALL_WINDOW_MENU_SCALE);
      expect(stage.width, label).toBeGreaterThanOrEqual(MENU_MIN_WIDTH);
      expect(stage.height, label).toBeGreaterThanOrEqual(MENU_MIN_HEIGHT);
      const left = Number.parseFloat(layer.style.left);
      const top = Number.parseFloat(layer.style.top);
      expect(Number.isInteger(Math.round(left * ratio * 1e6) / 1e6), `${label} left`).toBe(true);
      expect(left + stage.width * stage.scale, `${label} across`).toBeLessThanOrEqual(width + 1e-9);
      expect(top + stage.height * stage.scale, `${label} down`).toBeLessThanOrEqual(height + 1e-9);
    }
    // A screen of ratio 1 is drawn as it was.
    expect(computeMenuStage(390, 844, 1)).toEqual(computeMenuStage(390, 844));
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

describe("a screen drawn in the world's pixel", () => {
  it('is the canvas\'s zoom wherever the window is an ordinary one: bigger than the menus\' own', () => {
    for (const [width, height] of [[1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440], [3840, 2160]]) {
      const canvas = computeStage(width, height);
      const menu = computeMenuStage(width, height);
      const world = worldUnitFor(menu, canvas.zoom);
      const label = `${width}x${height}`;
      expect(world, label).toBe(canvas.zoom);
      expect(world, label).toBeGreaterThan(menu.scale);
      // And the smallest screen every screen is authored against still fits at it.
      expect((menu.width * menu.scale) / world, label).toBeGreaterThanOrEqual(MENU_MIN_WIDTH);
      expect((menu.height * menu.scale) / world, label).toBeGreaterThanOrEqual(MENU_MIN_HEIGHT);
    }
  });

  it('is the menus\' own pixel where the world\'s would not hold the smallest screen, is no bigger, or is not whole', () => {
    expect(worldUnitFor({ width: 320, height: 240, scale: 2 }, 3)).toBe(2);
    expect(worldUnitFor({ width: 600, height: 384, scale: 2 }, 2)).toBe(2);
    expect(worldUnitFor({ width: 600, height: 384, scale: 2 }, 1)).toBe(2);
    expect(worldUnitFor({ width: 600, height: 384, scale: 2 }, 2.5)).toBe(2);
    expect(worldUnitFor({ width: 600, height: 384, scale: 2 }, undefined)).toBe(2);
  });

  it('is given to the layer beside its own pixel, for `px-world` to read', () => {
    const canvas = computeStage(1280, 800);
    const layer = fakeLayer();
    applyMenuStage(layer as unknown as HTMLElement, 1280, 800, 1, undefined, canvas.zoom);
    expect(layer.style['--px']).toBe('2px');
    expect(layer.style['--world-px']).toBe('3px');
    expect(layer.style['--world-zoom']).toBe('3');
    const without = fakeLayer();
    applyMenuStage(without as unknown as HTMLElement, 1280, 800);
    expect(without.style['--world-px']).toBe('2px');
  });

  it('is what the stylesheet draws a `px-world` screen or window in', () => {
    const stylesheet = readFileSync(new URL('../../style.css', import.meta.url), 'utf8');
    const rule = /\.pixel-ui\.px-world,\s*\.pixel-ui \.px-world \{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';
    expect(rule).toContain('--u: var(--world-px, var(--px, 2px));');
    expect(rule).toContain('font-size: calc(var(--u) * 12.5);');
  });
});
