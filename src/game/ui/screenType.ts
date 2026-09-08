/**
 * The type scale the raid screen is drawn at.
 *
 * The map captions and the HUD chips are read side by side in the same corner
 * of the same picture, so they are one typographic system rather than two: the
 * same face, and only three sizes. Captions used to be 7px of whatever
 * monospace the browser happened to carry, which was both a size smaller than
 * anything else on screen and a different design on every machine.
 *
 * Sizes are strings because that is what Phaser's text style takes.
 */

/**
 * Sizes are in Orange Kid, whose capitals are shorter for a given point size
 * than the browser monospace these replace. They are picked to hold the letter
 * height the raid HUD was designed at - 8 pixels for the clock, 7 for a chip -
 * rather than the number that used to be typed, so the overlays are the same
 * size on screen as before and simply narrower, which is room given back to the
 * map. Measured against the fallback: 12px here matches 10px monospace, and
 * 11px matches 8px, to the pixel.
 */

/** The raid clock: the one number that has to be readable at a glance. */
export const CLOCK_FONT_SIZE = '12px';

/** Screen furniture - the objective and hunter chips. */
export const CHIP_FONT_SIZE = '11px';

/** World annotation. The same size as a chip, because it is read the same way. */
export const CAPTION_FONT_SIZE = CHIP_FONT_SIZE;
