/**
 * The colours every menu and pop-up is drawn in, named by what they are for.
 *
 * One palette for the canvas (dialogue, questions, the phrase list) and the DOM
 * menus alike, so a question asked in the yard and the shop it opens are one
 * surface. It is FireRed's window - cream paper in a blue-rimmed frame, a red
 * cursor - rather than the dark web-modal box it replaces (the captain, 25 Nov
 * 2026: "shite colours, shite design"). `docs/screens/menu-system/` is the why
 * and the before and after.
 *
 * Phaser wants a number for graphics and a string for text, so each colour is
 * both; `uiPalette.test.ts` holds the text to WCAG AA on the paper it sits on.
 */

const both = (value: number) => ({ value, css: `#${value.toString(16).padStart(6, '0')}` }) as const;

export const UI = {
  /** The paper every window is filled with. */
  paper: both(0xf0eccc),
  /** The row or answer under the cursor. */
  paperLit: both(0xfff6c8),
  /** Wells and empty slots, sunk into the paper. */
  paperSunk: both(0xe2ddb8),
  /** Words. */
  ink: both(0x303030),
  /** Notes, counts, the answer not under the cursor. */
  inkSoft: both(0x645e4a),
  /** The frame's outer line. */
  frameLine: both(0x24344c),
  /** The frame's blue rim. */
  frameRim: both(0x5a82b0),
  /** The rim's lit edge, on the top and left. */
  frameLight: both(0xb4d0ec),
  /** The rim's shaded edge, on the bottom and right. */
  frameShade: both(0x3c5c86),
  /** The cursor, and the prompt to read on. */
  cursor: both(0xd83828),
  /** The cursor's shadow, down its lower right. */
  cursorShadow: both(0x882018),
} as const;

/**
 * How deep the framed window's frame is, in game pixels: a line, a two-pixel
 * rim and a one-pixel bevel inside it. Text inset less than this is inside the frame.
 */
export const FRAME_DEPTH = 4;
