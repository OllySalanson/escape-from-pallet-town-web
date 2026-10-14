import type { Rect } from '../ui/labelPlacement';

/**
 * Where the FEEDBACK tab stands over the game's own screen, in game pixels.
 *
 * The tab is the page's (`feedbackDesk.ts`), half way down the right edge of
 * the window, and on a window the game fills it is drawn over a strip of the
 * map edge. That was meant to cost nothing, and for the chips, the box and the
 * player it does not - but a caption is seated against the view's edge, so a
 * door's name standing at the right of the screen went under the tab (THE
 * BOLTHOLE read THE BOLTHOL in the harbour). Handed to `placeCaptions` as
 * screen furniture, the tab is ground no caption may take.
 */
export interface ScreenBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The part of `tab` over `canvas`, in the game's pixels (`game` is its logical
 * size), rounded outward so a sliver of the tab's frame is never written under;
 * null when the tab is not drawn or stands clear of the canvas.
 */
export function tabOverGame(
  tab: ScreenBox | null,
  canvas: ScreenBox,
  game: { readonly width: number; readonly height: number },
): Rect | null {
  if (!tab || tab.width <= 0 || tab.height <= 0 || canvas.width <= 0 || canvas.height <= 0) {
    return null;
  }
  const left = Math.max(tab.left, canvas.left);
  const right = Math.min(tab.left + tab.width, canvas.left + canvas.width);
  const top = Math.max(tab.top, canvas.top);
  const bottom = Math.min(tab.top + tab.height, canvas.top + canvas.height);
  if (right <= left || bottom <= top) {
    return null;
  }
  const scaleX = game.width / canvas.width;
  const scaleY = game.height / canvas.height;
  const x = Math.floor((left - canvas.left) * scaleX);
  const y = Math.floor((top - canvas.top) * scaleY);
  return {
    x,
    y,
    width: Math.ceil((right - canvas.left) * scaleX) - x,
    height: Math.ceil((bottom - canvas.top) * scaleY) - y,
  };
}

/** The tab as it stands on this page now, over `canvas` - see `tabOverGame`. */
export function feedbackTabOverGame(
  canvas: HTMLCanvasElement | undefined,
  game: { readonly width: number; readonly height: number } | undefined,
): Rect | null {
  if (typeof document === 'undefined' || !canvas || !game) {
    return null;
  }
  const tab = document.querySelector<HTMLElement>('.feedback-tab');
  if (!tab || tab.hidden) {
    return null;
  }
  return tabOverGame(tab.getBoundingClientRect(), canvas.getBoundingClientRect(), game);
}
