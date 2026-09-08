/**
 * The game's typeface, and making sure it is on screen from the first frame.
 *
 * `@font-face` in `style.css` only tells the browser where the file is; nothing
 * is fetched until something renders a glyph in it. Phaser draws its text into
 * a canvas, and canvas text does not block on a font load - it silently
 * substitutes the fallback and never redraws. So the battle screen rendered its
 * name plates, level labels and type banners in the browser's monospace while
 * the dialogue below - drawn later, once a DOM screen had happened to trigger
 * the fetch - came out in Orange Kid. Two typefaces in one picture, and which
 * one you got depended on how far into the session you were.
 *
 * The fix is to make the face a load-time dependency like any other asset:
 * `index.html` preloads the file with the document, and `BootScene` waits on
 * `awaitGameFont()` before it starts a scene. Nothing after boot has to think
 * about it.
 */

/** Every family name the game asks Phaser for, in one place. */
export const GAME_FONT_FAMILY = 'Orange Kid';
export const GAME_FONT = `"${GAME_FONT_FAMILY}", monospace`;

/**
 * `document.fonts.load` resolves per size, and a face is only guaranteed ready
 * for the sizes that were asked for. These are the sizes the game draws, so a
 * single await covers every screen.
 */
export const GAME_FONT_SIZES = [8, 10, 11, 12, 13, 14, 16] as const;

/**
 * Boot must never hang on a font. A file that 404s, a browser without the CSS
 * Font Loading API, a private mode that refuses it - all of them fall through
 * to the fallback face and let the game start.
 */
export const GAME_FONT_TIMEOUT_MS = 3000;

interface FontFaceSetLike {
  load(font: string): Promise<unknown>;
  check?(font: string): boolean;
}

interface FontHost {
  readonly fonts?: FontFaceSetLike;
}

const requestFor = (size: number): string => `${size}px "${GAME_FONT_FAMILY}"`;

/**
 * Resolves once the game font is usable, or once it is clear it will not be.
 *
 * @returns Whether the face is actually loaded. A `false` here is not an error:
 * it is the honest answer that this session is drawing in the fallback.
 */
export async function awaitGameFont(
  host: FontHost | undefined = typeof document === 'undefined' ? undefined : document,
  timeoutMs: number = GAME_FONT_TIMEOUT_MS,
): Promise<boolean> {
  const fonts = host?.fonts;
  if (!fonts) {
    return false;
  }

  const loaded = Promise.all(GAME_FONT_SIZES.map((size) => fonts.load(requestFor(size))))
    .then(() => true)
    .catch(() => false);

  return Promise.race([
    loaded,
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
}

/** Whether the face is ready right now, for tests and diagnostics. */
export function isGameFontReady(
  host: FontHost | undefined = typeof document === 'undefined' ? undefined : document,
): boolean {
  const fonts = host?.fonts;
  if (!fonts?.check) {
    return false;
  }
  return GAME_FONT_SIZES.every((size) => fonts.check!(requestFor(size)));
}
