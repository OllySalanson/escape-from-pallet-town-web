import { BAR_COLUMN_WIDTH, BAR_HEIGHT, BAR_MARGIN, barColumnLeft, controlsBarPlacement, type BarPlacement } from './controlsBarLayout';
import { applyMenuStage, menuLayer } from './menuStage';
import { computeStage, onDevicePixel, type StageSize } from './stage';
import { computeTouchLayout, type Rect, type SafeInsets, type TouchLayout } from './touchLayout';
import { viewportSize } from './viewport';

/**
 * Keeps the running game's screen matched to the browser window.
 *
 * Phaser's own FIT mode was what capped the game at 960x720 and then resampled
 * it to whatever was left: the canvas backing store never changed size, so a
 * large display got a small screen and a short one got fractional pixels. The
 * screen is instead resized and re-zoomed here, in whole pixels, whenever the
 * window changes.
 */

interface ScalableGame {
  readonly scale: {
    setZoom(zoom: number): unknown;
    resize(width: number, height: number): unknown;
  };
}

export function applyStage(
  game: ScalableGame,
  parent: HTMLElement | null,
  viewportWidth: number,
  viewportHeight: number,
  devicePixelRatio = 1,
  /** On a touch screen: the game already fitted and placed round the pad (`touchLayout.ts`). */
  placed?: { readonly stage: StageSize; readonly box: Rect },
): StageSize {
  const stage = placed?.stage ?? computeStage(viewportWidth, viewportHeight, devicePixelRatio);
  // In this order: Phaser writes the canvas's CSS size only when told the zoom
  // afterwards. `resize` tells it for itself at any zoom but 1, so a window that
  // stayed at 1x (a phone) kept the canvas at the size it last was and drew the
  // art at a fractional scale.
  game.scale.resize(stage.width, stage.height);
  game.scale.setZoom(stage.zoom);
  if (parent) {
    const width = stage.width * stage.zoom;
    const height = stage.height * stage.zoom;
    parent.style.width = `${width}px`;
    parent.style.height = `${height}px`;
    // Placed, not centred by the page: the room left over is odd as often as it
    // is even, and half of an odd number put the whole screen - canvas and menus
    // alike - on half a pixel, which the browser resolves by blurring all of it.
    parent.style.position = 'absolute';
    // On a phone the zoom is whole device pixels rather than CSS ones, so the
    // corner is placed on a device pixel too.
    parent.style.left = `${placed ? placed.box.x : Math.max(0, onDevicePixel((viewportWidth - width) / 2, devicePixelRatio))}px`;
    parent.style.top = `${placed ? placed.box.y : Math.max(0, onDevicePixel((viewportHeight - height) / 2, devicePixelRatio))}px`;
    // One game pixel, in CSS pixels. Anything the scenes hang off the canvas
    // box - the frame around it, and a driver measuring it - reads the same
    // grid the canvas is scaled to. The DOM screens have a box and a pixel of
    // their own; see `menuStage.ts` for why the two are no longer one.
    parent.style.setProperty('--px', `${stage.zoom}px`);
    // The same number without its unit, for the one thing a length cannot do:
    // scale a sprite of unknown size by exactly the zoom, with no resampling.
    parent.style.setProperty('--zoom', `${stage.zoom}`);
  }
  return stage;
}

/** What the viewport watcher needs to stand the controls bar beside the game (`ui/controlsBar.ts`). */
export interface BarFit {
  place(placement: BarPlacement | null, canvas: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null): void;
}

/** What the viewport watcher tells the frame round the game (`stageFrame.ts`). */
export interface FrameFit {
  place(fit: {
    readonly viewportWidth: number;
    readonly viewportHeight: number;
    /** The game's canvas on the page, in CSS pixels. */
    readonly canvas: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    /** The controls bar, when it stands under the game. */
    readonly bar: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
    /** The controls bar stood up in the left margin, when it stands there. */
    readonly column: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
    /** Where the controls bar stands, if anywhere: the FULL SCREEN tile is on it there. */
    readonly barSide: BarPlacement['side'] | null;
    /** Whether the game is laid out round the touch pad. */
    readonly touch: boolean;
    /** One game pixel in CSS pixels. */
    readonly unit: number;
  }): void;
}

/** What the viewport watcher needs to lay the window out round the touch pad. */
export interface TouchFit {
  /** Whether the game is being played by touch now (`input/touchPlay.ts`). */
  playing(): boolean;
  /** Subscribes to that changing; returns the unsubscribe. */
  onChange(listener: () => void): () => void;
  /** Draws the pad into the layout, or takes it away. */
  place(layout: TouchLayout | null): void;
  /** The rows of keys the tray across an upright phone wants (`computeTouchLayout`'s `trayRows`). */
  trayRows?(): number;
}

/**
 * The window's safe area - what a notch, rounded corners and a home bar leave -
 * read from `env(safe-area-inset-*)` through a probe, which is the only way a
 * script can ask. Zero everywhere on a screen without one.
 */
export function readSafeInsets(document: Document): SafeInsets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const read = (value: string) => Number.parseFloat(value) || 0;
  const insets = {
    top: read(style.paddingTop),
    right: read(style.paddingRight),
    bottom: read(style.paddingBottom),
    left: read(style.paddingLeft),
  };
  probe.remove();
  return insets;
}

/**
 * Applies both stages now and on every window resize - the canvas box and the
 * menu box, which are sized by different rules and laid out independently -
 * and, while the game is played by touch, lays both out round the pad.
 * Returns a teardown so a hot reload cannot leave a second listener resizing a
 * destroyed game.
 */
export function watchViewport(game: ScalableGame, touch?: TouchFit, parentId = 'app', bar?: BarFit, frame?: FrameFit): () => void {
  const parent = () => document.getElementById(parentId);
  const update = () => {
    const ratio = window.devicePixelRatio || 1;
    const { width, height: fullHeight } = viewportSize();
    const layout = touch?.playing() ? computeTouchLayout(width, fullHeight, ratio, readSafeInsets(document), touch.trayRows?.()) : null;
    // The controls bar takes room below or beside the game only off the touch
    // pad, and only where it costs the game no zoom (`controlsBarLayout.ts`):
    // below, the game and the menus are laid out in the window less the bar.
    const placement = bar && !layout ? controlsBarPlacement(width, fullHeight, ratio) : null;
    const height = placement?.gameViewportHeight ?? fullHeight;
    const stage = applyStage(game, parent(), width, height, ratio, layout ? { stage: layout.stage, box: layout.canvas } : undefined);
    applyMenuStage(menuLayer(), width, height, ratio, layout?.menus, stage.zoom);
    touch?.place(layout);
    const box = parent()?.getBoundingClientRect();
    const canvas = box ? { x: box.left, y: box.top, width: stage.width * stage.zoom, height: stage.height * stage.zoom } : null;
    bar?.place(placement, placement ? canvas : null);
    if (frame && canvas) {
      frame.place({
        viewportWidth: width,
        viewportHeight: fullHeight,
        canvas,
        bar: placement?.side === 'below'
          ? { x: canvas.x, y: canvas.y + canvas.height + BAR_MARGIN, width: canvas.width, height: BAR_HEIGHT * placement.unit }
          : null,
        column: placement?.side === 'left'
          ? {
            x: barColumnLeft(canvas.x, placement.unit),
            y: canvas.y,
            width: BAR_COLUMN_WIDTH * placement.unit,
            height: canvas.height,
          }
          : null,
        barSide: placement?.side ?? null,
        touch: layout !== null,
        unit: stage.zoom,
      });
    }
  };
  update();
  window.addEventListener('resize', update);
  const stopTouch = touch?.onChange(update);
  return () => {
    window.removeEventListener('resize', update);
    stopTouch?.();
  };
}
