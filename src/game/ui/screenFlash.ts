/**
 * A flash of colour over the whole screen, as a glint rather than a strobe.
 *
 * Phaser's camera flash starts at full opacity and fades out, so every pickup
 * was a frame of solid yellow with nothing of the map in it, and a hit in
 * battle a frame of solid white (playtest 6: a stepped capture of a pickup was
 * one flat yellow picture). FireRed never blanks the screen for a pickup, and a
 * full-screen strobe on something done dozens of times a raid is exactly what
 * photosensitivity guidance asks a game not to do. So the flash starts no
 * stronger than `FLASH_PEAK_ALPHA` - the colour still says what happened, and
 * the map stays readable under it - and every scene goes through here rather
 * than calling the camera's `flash` itself (`screenFlash.test.ts` holds that).
 */

/** The most of the screen a flash may cover, at its first frame. */
export const FLASH_PEAK_ALPHA = 0.35;

/** A colour as red, green and blue, each 0-255. */
export type FlashColour = readonly [red: number, green: number, blue: number];

/** The part of a Phaser camera a flash needs. */
export interface FlashingCamera {
  /** Phaser's own flash effect; its `alpha` is where a flash starts from. */
  readonly flashEffect?: { alpha: number };
  flash(duration: number, red: number, green: number, blue: number, force?: boolean): unknown;
}

/** Flashes the screen `colour`, fading over `durationMs`, starting at `FLASH_PEAK_ALPHA`. */
export function flashScreen(camera: FlashingCamera, durationMs: number, [red, green, blue]: FlashColour): void {
  if (camera.flashEffect) {
    // Phaser starts a flash from this alpha and puts it back when the flash
    // ends, so setting it here caps this flash and every one after it.
    camera.flashEffect.alpha = FLASH_PEAK_ALPHA;
  }
  camera.flash(durationMs, red, green, blue, false);
}
