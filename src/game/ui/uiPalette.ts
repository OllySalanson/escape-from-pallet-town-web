/**
 * The colours every menu and pop-up is drawn in, named by what they are for.
 *
 * One palette for the canvas (dialogue, questions, the phrase list) and the DOM
 * menus alike, so a question asked in the yard and the shop it opens are one
 * surface. It is the round-3 menu look, "a Poke Ball, opened": white paper in
 * a line of ink, a red cursor, gold for the row under it (the captain, 25 Nov
 * 2026: "Do not keep any of the old menu style"). `docs/screens/menu-look/` is
 * the why and the before and after.
 *
 * Phaser wants a number for graphics and a string for text, so each colour is
 * both; `uiPalette.test.ts` holds the text to WCAG AA on the paper it sits on.
 */

const both = (value: number) => ({ value, css: `#${value.toString(16).padStart(6, '0')}` }) as const;

export const UI = {
  /** The paper every window is filled with. */
  paper: both(0xffffff),
  /** The row or answer under the cursor: gold's wash. */
  paperLit: both(0xfff1b8),
  /** Wells and empty slots, sunk into the paper. */
  paperSunk: both(0xe7e6ea),
  /** Words. */
  ink: both(0x221d1e),
  /** Notes, counts, the answer not under the cursor. */
  inkSoft: both(0x625a5d),
  /** The frame's line, and the title strip. */
  frameLine: both(0x221d1e),
  /** The Poke Ball's red seam under a title strip. */
  seam: both(0xe3350d),
  /** A row the pointer rests on, in gold's own dark ink: pointing only lights. */
  pointed: both(0x8a6700),
  /** The cursor, and the prompt to read on. */
  cursor: both(0xe3350d),
  /** The cursor's shadow, down its lower right. */
  cursorShadow: both(0xa32208),
} as const;

/**
 * How deep the framed window's frame is, in game pixels: a line, a two-pixel
 * rim and a one-pixel bevel inside it. Text inset less than this is inside the frame.
 */
export const FRAME_DEPTH = 4;
