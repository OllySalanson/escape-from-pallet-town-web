/**
 * The moment a place comes up out of the fog on THE MAP (the captain, 25 Nov
 * 2026): the local's tale heard, the map comes up as it was, "the area that you
 * just unlocked kind of like flashes, and then it's unlocked, and it's like,
 * yay! And then the map goes away". `ui/MapScreen.ts` draws it; this is the
 * timeline, frame by frame, so it is the same at any frame rate and tested
 * without a browser.
 */

/** The map as it was, before anything moves: long enough to see where the square is. */
export const REVEAL_SETTLE_MS = 500;
/** The square's edge flashing: three times on and off. */
export const REVEAL_FLASHES = 3;
export const REVEAL_FLASH_MS = 180;
/** The colour coming up through the fog, from the middle of the square out. */
export const REVEAL_RISE_MS = 900;
/** The square's name up over it, the jingle under it, and a burst of stars. */
export const REVEAL_CHEER_MS = 1600;

const FLASH_END = REVEAL_SETTLE_MS + REVEAL_FLASHES * 2 * REVEAL_FLASH_MS;
const RISE_END = FLASH_END + REVEAL_RISE_MS;

/** How long the whole moment is, from the map coming up to it going away by itself. */
export const REVEAL_TOTAL_MS = RISE_END + REVEAL_CHEER_MS;

/** What the moment shows at one instant. */
export interface RevealFrame {
  /** Whether the square's edge is lit this instant. */
  readonly edge: boolean;
  /** How far the colour has come up, 0 to 1, from the middle of the square to its corners. */
  readonly risen: number;
  /** Whether the name, the stars and the jingle are up. */
  readonly cheer: boolean;
  /** Whether the moment is over and the map should go. */
  readonly done: boolean;
}

export function revealFrame(elapsedMs: number): RevealFrame {
  const at = Math.max(0, elapsedMs);
  const flashing = at >= REVEAL_SETTLE_MS && at < FLASH_END;
  const edge = flashing && Math.floor((at - REVEAL_SETTLE_MS) / REVEAL_FLASH_MS) % 2 === 0;
  const raw = Math.min(1, Math.max(0, (at - FLASH_END) / REVEAL_RISE_MS));
  // Eased out: quick to start, settling into the corners.
  const risen = 1 - (1 - raw) * (1 - raw);
  return { edge: edge || (at >= FLASH_END && at < RISE_END), risen, cheer: at >= RISE_END, done: at >= REVEAL_TOTAL_MS };
}
