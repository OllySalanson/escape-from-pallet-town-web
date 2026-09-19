/**
 * Makes every line of canvas text as hard-edged as the tiles it is drawn over.
 *
 * Phaser paints a `Text` object by handing the whole line to the browser's
 * `fillText`, and the browser rasterises it the way it rasterises a web page:
 * antialiased, and with each glyph placed at a fractional position along the
 * line. Orange Kid is a pixel *style* outline font rather than a bitmap - its
 * stems are 74 to 81 units of a 1000-unit em, on no regular grid - so there is
 * no size at which those outlines land on whole pixels. Every letter therefore
 * arrived as a grey-edged smear, and the stage scaler then enlarged that smear
 * three times with nearest-neighbour sampling, faithfully. Tiles and sprites
 * are one-bit art and come through that zoom with hard edges; the writing beside
 * them read as slightly out of focus.
 *
 * Thresholding the finished line does not fix it: a stem that straddles two
 * pixel columns comes out two pixels wide in one word and one in the next, so
 * the same letter is drawn differently each time it appears. The unit that has
 * to be made whole is the glyph. Each one is rasterised alone, with its ink
 * snapped to a pixel column, cut to one-bit coverage, and cached; a line is then
 * set by stamping those bitmaps at whole-pixel advances. That is a bitmap font,
 * built at run time from the face the game already ships, at whatever size a
 * scene asks for - so a letter is the same shape everywhere it appears and no
 * scene has to know any of this happened.
 *
 * The arithmetic is kept apart from the canvas so it is testable without one.
 */

/** A stem of the game's face, as a fraction of the em: 78 units of 1000. */
const ORANGE_KID_STEM_EM = 0.078;

/**
 * Coverage, of 255, a pixel needs to count as ink.
 *
 * Half, for any size whose stems are about a pixel wide. Below that the stems
 * are thinner than a pixel - 0.62 of one at 8px - and can never reach half
 * coverage however they are snapped, so the bar drops with the stem or the
 * small type would lose its verticals entirely.
 */
export function inkThreshold(fontSizePx: number): number {
  const stemWidthPx = fontSizePx * ORANGE_KID_STEM_EM;
  return Math.round(Math.min(0.5, stemWidthPx * 0.62) * 255);
}

/**
 * How far to nudge a glyph so its leftmost ink starts on a pixel column rather
 * than part-way through one. A stem snapped this way covers one column almost
 * completely instead of two by halves.
 */
export function snapOffset(inkLeft: number): number {
  return Math.round(inkLeft) - inkLeft;
}

/**
 * The side bearings of the game's face, as a fraction of the em: a lowercase
 * `n` advances about 125 units further than its ink is wide.
 */
const ORANGE_KID_BEARINGS_EM = 0.125;

/**
 * Clear columns between one letter's ink and the next: what the face's own side
 * bearings come to at this size, and never less than a pixel.
 */
export function letterGap(fontSizePx: number): number {
  return Math.max(1, Math.round(fontSizePx * ORANGE_KID_BEARINGS_EM));
}

/**
 * The whole-pixel advance of a glyph.
 *
 * A glyph with ink is set tight: its own inked columns, then the gap. Rounding
 * the outline's advance instead left every pair of letters zero, one or two
 * pixels apart depending on where the fractions fell - `RIVAL` closed up into a
 * single shape at 11px while `dependable` came out as `dependa ble` - and at
 * these sizes a one-pixel difference is the whole of the letter spacing. A glyph
 * with no ink is a space, and keeps the width the face gives it.
 */
export function pixelAdvance(measuredWidth: number, inkWidth: number | null, gap: number): number {
  return inkWidth === null ? Math.max(1, Math.round(measuredWidth)) : inkWidth + gap;
}

/** The size a canvas `font` shorthand asks for, or null when it names none in px. */
export function fontSizeOf(font: string): number | null {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : null;
}

type Pass = 'fill' | 'stroke';

interface GlyphMetrics {
  /** Sub-pixel nudge that lands the ink on a column. */
  readonly dx: number;
  /** The first inked column, relative to the glyph's origin: the pen is set against it. */
  readonly inkLeft: number;
  readonly advance: number;
}

interface GlyphBitmap {
  readonly canvas: HTMLCanvasElement;
  /** Where the bitmap's top-left sits relative to the pen on the baseline. */
  readonly left: number;
  readonly top: number;
}

/** Room around a glyph's reported ink box: outlines overshoot it by a fraction. */
const BITMAP_MARGIN = 2;

const metricsCache = new Map<string, GlyphMetrics>();
const bitmapCache = new Map<string, GlyphBitmap | null>();

const PATCHED = Symbol('pixelText');

interface PatchableContext extends CanvasRenderingContext2D {
  [PATCHED]?: true;
}

/**
 * A glyph is only worth caching once its face has loaded: canvas text falls
 * back silently, and a cached fallback glyph would outlive the real one.
 */
function isFontReady(font: string): boolean {
  try {
    return typeof document === 'undefined' || !document.fonts?.check || document.fonts.check(font);
  } catch {
    return true;
  }
}

let measuringContext: CanvasRenderingContext2D | null = null;

/**
 * Measures one glyph with the browser's own `measureText`. It cannot go through
 * the context being drawn on: that one's `measureText` is the replacement below,
 * which is built out of these measurements.
 */
function measureGlyph(font: string, char: string): TextMetrics {
  measuringContext ??= document.createElement('canvas').getContext('2d');
  if (!measuringContext) {
    throw new Error('A 2D canvas context is required to measure text.');
  }
  measuringContext.font = font;
  return measuringContext.measureText(char);
}

function rasterise(
  context: CanvasRenderingContext2D,
  char: string,
  pass: Pass,
  dx: number,
  threshold: number,
): { bitmap: GlyphBitmap | null; ink: { left: number; width: number } | null } {
  const measured = measureGlyph(context.font, char);
  const reach = BITMAP_MARGIN + (pass === 'stroke' ? Math.ceil(context.lineWidth) : 0);
  const left = Math.ceil(Math.max(0, measured.actualBoundingBoxLeft)) + reach;
  const right = Math.ceil(Math.max(0, measured.actualBoundingBoxRight)) + reach;
  const ascent = Math.ceil(Math.max(0, measured.actualBoundingBoxAscent)) + reach;
  const descent = Math.ceil(Math.max(0, measured.actualBoundingBoxDescent)) + reach;
  const width = left + right;
  const height = ascent + descent;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const glyph = canvas.getContext('2d', { willReadFrequently: true });
  if (!glyph) {
    return { bitmap: null, ink: null };
  }
  glyph.font = context.font;
  glyph.textBaseline = 'alphabetic';
  if (pass === 'stroke') {
    glyph.strokeStyle = context.strokeStyle;
    glyph.lineWidth = context.lineWidth;
    glyph.lineJoin = context.lineJoin;
    glyph.lineCap = context.lineCap;
    glyph.miterLimit = context.miterLimit;
    glyph.strokeText(char, left + dx, ascent);
  } else {
    glyph.fillStyle = context.fillStyle;
    glyph.fillText(char, left + dx, ascent);
  }

  const image = glyph.getImageData(0, 0, width, height);
  const pixels = image.data;
  let firstInkColumn = width;
  let lastInkColumn = -1;
  for (let index = 3; index < pixels.length; index += 4) {
    const inked = pixels[index] >= threshold;
    pixels[index] = inked ? 255 : 0;
    if (inked) {
      const column = ((index - 3) / 4) % width;
      firstInkColumn = Math.min(firstInkColumn, column);
      lastInkColumn = Math.max(lastInkColumn, column);
    }
  }
  if (lastInkColumn < 0) {
    return { bitmap: null, ink: null };
  }
  glyph.putImageData(image, 0, 0);
  return {
    bitmap: { canvas, left, top: ascent },
    ink: { left: firstInkColumn - left, width: lastInkColumn - firstInkColumn + 1 },
  };
}

function metricsFor(context: CanvasRenderingContext2D, char: string, threshold: number): GlyphMetrics {
  const key = `${context.font}|${char}`;
  const cached = metricsCache.get(key);
  if (cached) {
    return cached;
  }
  const measured = measureGlyph(context.font, char);
  const dx = snapOffset(-measured.actualBoundingBoxLeft);
  // The setting is decided by the filled glyph whichever pass is being drawn,
  // so an outline always sits exactly under the letter it outlines.
  const { ink } = rasterise(context, char, 'fill', dx, threshold);
  const metrics = {
    dx,
    inkLeft: ink?.left ?? 0,
    advance: pixelAdvance(measured.width, ink?.width ?? null, letterGap(fontSizeOf(context.font) ?? 0)),
  };
  if (isFontReady(context.font)) {
    metricsCache.set(key, metrics);
  }
  return metrics;
}

function bitmapFor(
  context: CanvasRenderingContext2D,
  char: string,
  pass: Pass,
  metrics: GlyphMetrics,
  threshold: number,
): GlyphBitmap | null {
  const paint = pass === 'fill' ? context.fillStyle : context.strokeStyle;
  if (typeof paint !== 'string') {
    // A gradient or a pattern has no value to cache by; the callers never send one here.
    return null;
  }
  const key = `${context.font}|${char}|${pass}|${paint}|${pass === 'stroke' ? context.lineWidth : 0}`;
  if (bitmapCache.has(key)) {
    return bitmapCache.get(key) ?? null;
  }
  const { bitmap } = rasterise(context, char, pass, metrics.dx, threshold);
  if (isFontReady(context.font)) {
    bitmapCache.set(key, bitmap);
  }
  return bitmap;
}

/**
 * Replaces a text canvas's own `fillText`, `strokeText` and `measureText` with
 * the glyph-stamping versions. Measuring has to change with drawing, or Phaser
 * sizes the canvas and wraps the words for a line it is no longer setting.
 */
export function hardenContext(context: CanvasRenderingContext2D): void {
  const target = context as PatchableContext;
  if (target[PATCHED]) {
    return;
  }
  target[PATCHED] = true;

  const nativeFill = context.fillText.bind(context);
  const nativeStroke = context.strokeText.bind(context);
  const nativeMeasure = context.measureText.bind(context);

  const thresholdNow = (): number | null => {
    const size = fontSizeOf(context.font);
    // A gradient or pattern fill cannot be cached by value; leave it to the browser.
    return size === null || typeof context.fillStyle !== 'string' ? null : inkThreshold(size);
  };

  const stamp = (pass: Pass, text: string, x: number, y: number, threshold: number): void => {
    const smoothing = context.imageSmoothingEnabled;
    context.imageSmoothingEnabled = false;
    let pen = Math.round(x);
    const baseline = Math.round(y);
    for (const char of text) {
      const metrics = metricsFor(context, char, threshold);
      const bitmap = bitmapFor(context, char, pass, metrics, threshold);
      if (bitmap) {
        context.drawImage(bitmap.canvas, pen - metrics.inkLeft - bitmap.left, baseline - bitmap.top);
      }
      pen += metrics.advance;
    }
    context.imageSmoothingEnabled = smoothing;
  };

  context.fillText = (text: string, x: number, y: number, maxWidth?: number): void => {
    const threshold = thresholdNow();
    if (threshold === null || maxWidth !== undefined) {
      nativeFill(text, x, y, maxWidth);
      return;
    }
    stamp('fill', text, x, y, threshold);
  };

  context.strokeText = (text: string, x: number, y: number, maxWidth?: number): void => {
    const threshold = thresholdNow();
    if (threshold === null || maxWidth !== undefined || typeof context.strokeStyle !== 'string') {
      nativeStroke(text, x, y, maxWidth);
      return;
    }
    stamp('stroke', text, x, y, threshold);
  };

  context.measureText = (text: string): TextMetrics => {
    const native = nativeMeasure(text);
    const threshold = thresholdNow();
    if (threshold === null) {
      return native;
    }
    let width = 0;
    for (const char of text) {
      width += metricsFor(context, char, threshold).advance;
    }
    return {
      width,
      actualBoundingBoxAscent: native.actualBoundingBoxAscent,
      actualBoundingBoxDescent: native.actualBoundingBoxDescent,
      actualBoundingBoxLeft: native.actualBoundingBoxLeft,
      actualBoundingBoxRight: native.actualBoundingBoxRight,
      fontBoundingBoxAscent: native.fontBoundingBoxAscent,
      fontBoundingBoxDescent: native.fontBoundingBoxDescent,
      alphabeticBaseline: native.alphabeticBaseline,
      emHeightAscent: native.emHeightAscent,
      emHeightDescent: native.emHeightDescent,
      hangingBaseline: native.hangingBaseline,
      ideographicBaseline: native.ideographicBaseline,
    };
  };
}

interface TextLike {
  context: CanvasRenderingContext2D;
}

interface TextClassLike {
  prototype: { updateText(this: TextLike): unknown; [PATCHED]?: true };
}

/**
 * Installs the hard-edged renderer on every Phaser `Text`, present and future.
 * `updateText` is the one place a Text object paints, and its constructor
 * paints through it, so hardening the context there catches the first frame.
 */
export function installPixelText(TextClass: TextClassLike): void {
  // A hot reload runs the entry module again against the same Phaser class.
  if (TextClass.prototype[PATCHED]) {
    return;
  }
  TextClass.prototype[PATCHED] = true;
  // Taken off the prototype on purpose: it is only ever called back on a Text, below.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const paint = TextClass.prototype.updateText;
  TextClass.prototype.updateText = function updateText(this: TextLike): unknown {
    hardenContext(this.context);
    return paint.call(this);
  };
}
