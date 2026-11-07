/**
 * The little lit lettering THE GAME CORNER's boards are painted in: five pixels
 * tall, three wide (five for the letters that need it), one pixel between
 * letters - the same hand the cabinets' JUMP and BERRY marquees are drawn in
 * (`scripts/draw-promenade.mjs`). A board here is a picture of the save, not a
 * line of text, so it is painted pixel by pixel like the badge case.
 */

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '#.#', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  ',': ['..', '..', '..', '.#', '#.'],
  '.': ['.', '.', '.', '.', '#'],
  ':': ['.', '#', '.', '#', '.'],
  '-': ['..', '..', '##', '..', '..'],
  "'": ['#', '#', '.', '.', '.'],
  '’': ['#', '#', '.', '.', '.'],
  ' ': ['..', '..', '..', '..', '..'],
};

/** How tall a letter is, in pixels. */
export const LETTER_HEIGHT = 5;

/** The glyph for a character: a letter it does not draw comes out as a space, and lower case as upper. */
function glyph(character: string): readonly string[] {
  return GLYPHS[character.toUpperCase()] ?? GLYPHS[' '];
}

/** How wide a word is when painted, in pixels, the gaps between letters included. */
export function letteringWidth(text: string): number {
  const characters = [...text];
  return characters.reduce((width, character) => width + glyph(character)[0].length, 0) + Math.max(0, characters.length - 1);
}

/**
 * Paint a word with its top-left at (x, y), calling `plot` for every lit
 * pixel; returns how wide it came out.
 */
export function paintLettering(text: string, x: number, y: number, plot: (x: number, y: number) => void): number {
  let at = x;
  for (const character of text) {
    const rows = glyph(character);
    rows.forEach((row, dy) => {
      [...row].forEach((pixel, dx) => {
        if (pixel === '#') plot(at + dx, y + dy);
      });
    });
    at += rows[0].length + 1;
  }
  return Math.max(0, at - x - 1);
}

/** The longest start of a word that paints within a width: a name cut to fit the board. */
export function fitLettering(text: string, width: number): string {
  let fitted = text;
  while (fitted.length > 0 && letteringWidth(fitted) > width) {
    fitted = fitted.slice(0, -1);
  }
  return fitted;
}
