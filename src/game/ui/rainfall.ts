import { createSeededRng, type SeededRng } from '../run/rng';

/**
 * Rain as FireRed draws it: short pale streaks slanting down to the left, each
 * landing somewhere on the ground below with a small splash, over a picture a
 * shade darker than the dry one. This is the falling itself, kept free of
 * Phaser so it can be asked about; `rainOverlay.ts` draws it.
 *
 * It is light on purpose: a drop is one pixel wide and half see-through, and
 * there is about one to every thousand pixels of screen, so a trainer, a sign
 * and a caption all still read through it. A place that rains (`weatherAt`) and
 * a fight in the rain both show it, because the Coast's whole character is that
 * it never stops raining and a corner chip alone said so only to a reader.
 */

/** How far a streak falls in a second, down and to the left, in screen pixels. */
export const RAIN_FALL_PER_SECOND = { x: -70, y: 280 } as const;

/** A streak's length, as the step it spans: about two tiles' slant in eight pixels. */
export const RAIN_STREAK = { x: -2, y: 8 } as const;

/** How long the splash where a drop lands stays on screen. */
export const RAIN_SPLASH_MS = 120;

/** About one drop to every thousand pixels of screen. */
export const RAIN_PIXELS_PER_DROP = 1_000;

/** The shade the rain puts over the picture, and how strongly. */
export const RAIN_SHADE = { colour: 0x18203c, alpha: 0.16 } as const;

/** The streak's colour and how see-through it is. */
export const RAIN_STREAK_COLOUR = { colour: 0xc8d8f8, alpha: 0.55 } as const;

export interface RainDrop {
  /** Where the streak's lower end is, in screen pixels. */
  x: number;
  y: number;
  /** The height it lands at: rain falls on the ground all the way down the screen. */
  landY: number;
  /** Time left on its splash; above zero, it has landed. */
  splashMs: number;
}

export interface Rainfall {
  readonly width: number;
  readonly height: number;
  readonly drops: RainDrop[];
  readonly rng: SeededRng;
}

/** How many drops a screen this size holds. */
export const rainDropCount = (width: number, height: number): number =>
  Math.max(1, Math.round((width * height) / RAIN_PIXELS_PER_DROP));

/**
 * A screen of rain already falling: every drop somewhere between the top and
 * where it lands, so the first frame is as wet as the hundredth.
 */
export function createRainfall(width: number, height: number, seed = 1): Rainfall {
  const rng = createSeededRng(seed);
  const drops = Array.from({ length: rainDropCount(width, height) }, () => {
    const drop = freshDrop(width, height, rng);
    drop.y = drop.landY * rng.next();
    drop.x += drop.y * (RAIN_FALL_PER_SECOND.x / RAIN_FALL_PER_SECOND.y);
    return drop;
  });
  return { width, height, drops, rng };
}

/** Moves every drop on by `deltaMs`: falling, landing, splashing, and falling again from the top. */
export function stepRainfall(rain: Rainfall, deltaMs: number): void {
  const seconds = Math.max(0, deltaMs) / 1_000;
  for (const drop of rain.drops) {
    if (drop.splashMs > 0) {
      drop.splashMs -= deltaMs;
      if (drop.splashMs <= 0) {
        Object.assign(drop, freshDrop(rain.width, rain.height, rain.rng));
      }
      continue;
    }
    drop.x += RAIN_FALL_PER_SECOND.x * seconds;
    drop.y += RAIN_FALL_PER_SECOND.y * seconds;
    if (drop.y >= drop.landY) {
      // Where it lands is where it splashes, not wherever the frame left it.
      drop.x -= (drop.y - drop.landY) * (RAIN_FALL_PER_SECOND.x / RAIN_FALL_PER_SECOND.y);
      drop.y = drop.landY;
      drop.splashMs = RAIN_SPLASH_MS;
    }
  }
}

/**
 * A drop at the top of the screen. It starts a little to the right of the
 * screen's width as often as the slant carries it in, so the right-hand edge
 * is as wet as the rest.
 */
function freshDrop(width: number, height: number, rng: SeededRng): RainDrop {
  const landY = height * (0.1 + 0.9 * rng.next());
  const drift = landY * (-RAIN_FALL_PER_SECOND.x / RAIN_FALL_PER_SECOND.y);
  return { x: rng.next() * (width + drift), y: 0, landY, splashMs: 0 };
}
