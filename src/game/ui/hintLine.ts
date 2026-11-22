/**
 * The hint line: the one line along the foot of the screen that says what a key
 * does where the player is standing. The harbour has always had it (`BaseScene`);
 * a raid has it for the things a press works on, so a caption read from beside a
 * gate does not read as a gate that is broken (the 20 Nov AI playtest, #126,
 * #127, #148: a Card Key in the pack, SPACE pressed from the tile beside the
 * gate, and nothing said).
 *
 * Both scenes draw it the same: a cream window, the ink face, these margins.
 */

/** How far the line stands off the screen's edges. */
export const HINT_MARGIN = 6;
export const HINT_PADDING_X = 5;
export const HINT_PADDING_Y = 2;

/** What the interact key does to a thing faced, in the line's own words: its key, then its name. */
export function spaceHint(name: string): string {
  return `[SPACE] ${name.toUpperCase()}`;
}
