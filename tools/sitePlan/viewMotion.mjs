// How the site plan's view moves: the wheel, the ease, the anchor under the
// pointer, what counts as a click, and how pictures fade in as they arrive.
//
// Plain functions with no page in them, so `viewMotion.test.ts` can ask them
// directly. `sitePlan.mts` writes this file into the page as it is, with its
// `export` words taken off, into the motion slot at the top of `viewer.html`.

/** Natural-log zoom one pixel of a mouse wheel's scroll is worth: a 100-pixel notch is about 1.22x. */
export const WHEEL_ZOOM_PER_PIXEL = 0.002;
/** The same for a trackpad pinch, which Chromium and Firefox send as a wheel with the control key held. */
export const PINCH_ZOOM_PER_PIXEL = 0.01;
/** A scroll of at least this many pixels in one event is a mouse wheel's notch rather than a trackpad's stream. */
export const NOTCH_PIXELS = 50;
/** The most one event may zoom, so a burst from a free-spinning wheel cannot fling the view. */
export const MOST_ZOOM_PER_EVENT = Math.log(2);
/** How quickly an eased zoom closes on where it is going: the gap shrinks by e every this many ms. */
export const ZOOM_EASE_MS = 85;
/** Longer than this between frames is a stall, and a stall is not leapt over in one frame. */
export const LONGEST_FRAME_MS = 48;
/** How long a newly arrived picture takes to fade in over the one it replaces. */
export const PICTURE_FADE_MS = 180;

/**
 * What one wheel event asks for, in natural-log zoom (positive is in).
 * A mouse wheel's notch is eased over a few frames; a trackpad's scroll and
 * pinch already arrive as a stream, so they are applied as they come.
 */
export function wheelIntent({ deltaY, deltaMode = 0, ctrlKey = false }) {
  const unit = deltaMode === 1 ? 33 : deltaMode === 2 ? 400 : 1;
  const pixels = deltaY * unit;
  const perPixel = ctrlKey ? PINCH_ZOOM_PER_PIXEL : WHEEL_ZOOM_PER_PIXEL;
  const zoom = Math.max(-MOST_ZOOM_PER_EVENT, Math.min(MOST_ZOOM_PER_EVENT, -pixels * perPixel));
  const eased = !ctrlKey && (deltaMode !== 0 || Math.abs(pixels) >= NOTCH_PIXELS);
  return { zoom, eased };
}

/** One frame of an exponential ease, the same whatever the frame rate. */
export function easeToward(current, target, elapsedMs, easeMs = ZOOM_EASE_MS) {
  const step = Math.min(Math.max(elapsedMs, 0), LONGEST_FRAME_MS);
  return target + (current - target) * Math.exp(-step / easeMs);
}

/**
 * The view at scale `s` that keeps the plan point under (`screenX`, `screenY`)
 * where it is. A view is its centre in tiles and its screen pixels to a tile.
 */
export function zoomedAbout(view, width, height, screenX, screenY, s) {
  const x = (screenX - width / 2) / view.s + view.x;
  const y = (screenY - height / 2) / view.s + view.y;
  return { x: x - (screenX - width / 2) / s, y: y - (screenY - height / 2) / s, s };
}

/** Pixels a press may wander and still be a click: a finger wobbles more than a mouse. */
export function clickSlop(pointerType) {
  return pointerType === 'touch' ? 10 : 5;
}
/** A press held longer than this without moving was the start of a drag, never a click. */
export const LONGEST_CLICK_MS = 600;

/**
 * Whether a press and its release were a click. `farthest` is the furthest the
 * pointer got from where it went down, not where it came up: a drag that ends
 * back where it began is still a drag.
 */
export function isClick({ farthest, heldMs, pointerType }) {
  return farthest <= clickSlop(pointerType) && heldMs <= LONGEST_CLICK_MS;
}

/**
 * Where a click on something takes the view, or null to stay put. A click
 * only ever zooms in: something already at least as big as its framing stays
 * where it is, so clicking a place you have zoomed into never throws you back
 * out. (The card's ZOOM TO IT and the search frame it whatever the zoom.)
 */
export function clickFlight(currentScale, framingScale) {
  return framingScale > currentScale * 1.05 ? framingScale : null;
}

/** How much of a thing shown from scale `from` is drawn at scale `s`: it fades in over a 1.3x zoom. */
export function fadeIn(s, from) {
  if (from <= 0) return 1;
  return Math.max(0, Math.min(1, Math.log(s / from) / Math.log(1.3)));
}

/** How far a picture that arrived at `readyAt` has faded in by `now`. */
export function pictureOpacity(readyAt, now) {
  return Math.max(0, Math.min(1, (now - readyAt) / PICTURE_FADE_MS));
}

/**
 * The pyramid level to draw at a device scale (screen pixels to a tile):
 * the coarsest whose pictures are still at least as sharp as the screen.
 */
export function levelFor(deviceScale, tileSize, top) {
  return Math.max(0, Math.min(top, Math.floor(Math.log2(tileSize / deviceScale))));
}
