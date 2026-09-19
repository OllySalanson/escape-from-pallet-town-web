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
 * Coverage, of 255, a pixel needs to count as ink: a shade under half a stem.
 *
 * A letter has more than one stem and they are not a whole number of pixels
 * apart, so when the first is landed on a column the second lies across two.
 * The larger share of a stem is always at least half of it and the smaller at
 * most half, so a bar of half a stem inks exactly one column of every stem
 * wherever it falls - never none, which is how the bowl of a `P` went missing at
 * 12px and the plate read `HF:`, and never both, which is bold. The shade under
 * is for the antialiasing, which rounds down. Above a one-pixel stem the bar
 * stops at half a pixel: there the stem fills its column outright.
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
 * How far a pixel is from being either ink or paper. A glyph whose stems sit on
 * pixel columns is nearly all one or the other; one that straddles them is grey
 * down both sides of every stem, and thresholds to a stroke two pixels wide.
 */
export function greyness(coverage: number): number {
  return Math.min(coverage, 255 - coverage);
}

/**
 * The nudges tried for each glyph, first the one that lands its leftmost ink on
 * a column. That is right for a letter whose left edge *is* a stem, and wrong
 * for one that leads with something thinner - the flag of a `1` - which left the
 * stem behind it across two columns and drew HP `17/17` in bold. So each glyph
 * is tried at quarter-pixel steps and keeps whichever leaves the least grey.
 */
const SNAP_CANDIDATES = [0, 0.25, -0.25, 0.5] as const;

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

/**
 * Which pixels of an antialiased glyph are ink.
 *
 * A pixel over the bar is ink. That alone loses every stroke that falls evenly
 * across two rows or two columns: each half is under the bar, so the crossbar
 * that closes a `P` or a `B` simply was not there, and no nudge of the whole
 * glyph fixes it because a letter's bars are not a whole number of pixels apart.
 * So a pixel with a fair share of coverage is also ink when it is the crest of
 * a stroke - heavier than the pixel on one side of it and no lighter than the
 * other - and the stroke carries on beside it. A stroke split in two therefore
 * comes out one pixel wide on its heavier side, never zero and never two.
 */
export function inkMask(
  coverage: Uint8Array,
  width: number,
  height: number,
  threshold: number,
): Uint8Array {
  const faint = threshold / 2;
  const at = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : coverage[y * width + x];
  const mask = new Uint8Array(coverage.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const here = at(x, y);
      if (here >= threshold) {
        mask[y * width + x] = 1;
        continue;
      }
      if (here < faint) {
        continue;
      }
      // A crest must stand over paper on both sides, or it is only the soft
      // edge of a stroke that is already ink.
      const crest = (before: number, after: number): boolean =>
        before < threshold && after < threshold && here > before && here >= after;
      const runsAlong = (one: number, other: number): boolean => one >= faint && other >= faint;
      const bar = crest(at(x, y - 1), at(x, y + 1)) && runsAlong(at(x - 1, y), at(x + 1, y));
      const stem = crest(at(x - 1, y), at(x + 1, y)) && runsAlong(at(x, y - 1), at(x, y + 1));
      mask[y * width + x] = bar || stem ? 1 : 0;
    }
  }
  return mask;
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

/** What every glyph's shape is cut from, before it is coloured. */
const MASK_INK = '#000000';

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
 *
 * `document.fonts.check()` cannot be the whole of that question. It answers
 * true for a face that has not *started* loading, because nothing is pending -
 * so the loading screen's text cached the browser monospace's measurements
 * under Orange Kid's name, and every later line was spaced by one face and
 * drawn in the other: `TE` touching, `E` a pixel to the left of its own box.
 * Whatever was learned before a face arrived is therefore forgotten when it does.
 */
function isFontReady(font: string): boolean {
  try {
    return typeof document === 'undefined' || !document.fonts?.check || document.fonts.check(font);
  } catch {
    return true;
  }
}

let watchingFontLoads = false;

function forgetGlyphsWhenFontsLoad(): void {
  if (watchingFontLoads || typeof document === 'undefined' || !document.fonts?.addEventListener) {
    return;
  }
  watchingFontLoads = true;
  document.fonts.addEventListener('loadingdone', () => {
    metricsCache.clear();
    baselineCache.clear();
    bitmapCache.clear();
  });
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
  dy: number,
  threshold: number,
): { bitmap: GlyphBitmap | null; ink: { left: number; width: number } | null; grey: number } {
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
    return { bitmap: null, ink: null, grey: 0 };
  }
  glyph.font = context.font;
  glyph.textBaseline = 'alphabetic';
  // The shape is always cut from the same ink, whatever colour it will be
  // painted: the browser adjusts a glyph's antialiasing for contrast, so white
  // text covers more of each edge pixel than black does, and the same letter
  // thresholded a pixel wider in a light line than the dark one it was measured
  // in - `E` drawn a column left of its own box, `TE` touching.
  glyph.fillStyle = MASK_INK;
  glyph.strokeStyle = MASK_INK;
  if (pass === 'stroke') {
    glyph.lineWidth = context.lineWidth;
    glyph.lineJoin = context.lineJoin;
    glyph.lineCap = context.lineCap;
    glyph.miterLimit = context.miterLimit;
    glyph.strokeText(char, left + dx, ascent + dy);
  } else {
    glyph.fillText(char, left + dx, ascent + dy);
  }

  const image = glyph.getImageData(0, 0, width, height);
  const pixels = image.data;
  const coverage = new Uint8Array(width * height);
  let grey = 0;
  for (let at = 0; at < coverage.length; at += 1) {
    coverage[at] = pixels[at * 4 + 3];
    grey += greyness(coverage[at]);
  }
  const mask = inkMask(coverage, width, height, threshold);
  let firstInkColumn = width;
  let lastInkColumn = -1;
  for (let at = 0; at < mask.length; at += 1) {
    pixels[at * 4 + 3] = mask[at] ? 255 : 0;
    if (mask[at]) {
      firstInkColumn = Math.min(firstInkColumn, at % width);
      lastInkColumn = Math.max(lastInkColumn, at % width);
    }
  }
  if (lastInkColumn < 0) {
    return { bitmap: null, ink: null, grey };
  }
  glyph.putImageData(image, 0, 0);
  // Coloured afterwards, inside the mask, so a colour can never change a shape.
  glyph.globalCompositeOperation = 'source-in';
  glyph.fillStyle = pass === 'stroke' ? context.strokeStyle : context.fillStyle;
  glyph.fillRect(0, 0, width, height);
  return {
    bitmap: { canvas, left, top: ascent },
    ink: { left: firstInkColumn - left, width: lastInkColumn - firstInkColumn + 1 },
    grey,
  };
}

/** Letters whose crossbars, between them, sit at every height the face draws one. */
const BASELINE_PROBE = 'EHPBRSAeas025';

const baselineCache = new Map<string, number>();

/**
 * How far the whole face is nudged vertically at this size.
 *
 * Crossbars have the problem stems have, turned on its side: at 12px the bar
 * that closes the bowl of a `P` lay across two rows, reached half coverage in
 * neither, and the plate read `HF:`. But a letter may not be moved up or down by
 * itself, or the line stops sharing a baseline. So the nudge is chosen once per
 * size, for the whole face, as the one that leaves a probe of letters least grey.
 */
function baselineNudge(context: CanvasRenderingContext2D, threshold: number): number {
  const key = context.font;
  const cached = baselineCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const greyAt = (dy: number): number =>
    [...BASELINE_PROBE].reduce((total, char) => total + rasterise(context, char, 'fill', 0, dy, threshold).grey, 0);
  const nudge = SNAP_CANDIDATES.map((dy) => ({ dy, grey: greyAt(dy) })).reduce((best, next) =>
    next.grey < best.grey ? next : best,
  ).dy;
  if (isFontReady(context.font)) {
    baselineCache.set(key, nudge);
  }
  return nudge;
}

function metricsFor(context: CanvasRenderingContext2D, char: string, threshold: number): GlyphMetrics {
  const key = `${context.font}|${char}`;
  const cached = metricsCache.get(key);
  if (cached) {
    return cached;
  }
  const measured = measureGlyph(context.font, char);
  // The setting is decided by the filled glyph whichever pass is being drawn,
  // so an outline always sits exactly under the letter it outlines.
  const snapped = snapOffset(-measured.actualBoundingBoxLeft);
  const dy = baselineNudge(context, threshold);
  const { dx, ink } = SNAP_CANDIDATES.map((nudge) => {
    const candidate = snapped + nudge;
    return { dx: candidate, ...rasterise(context, char, 'fill', candidate, dy, threshold) };
  }).reduce((best, next) => (next.grey < best.grey ? next : best));
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
  const { bitmap } = rasterise(context, char, pass, metrics.dx, baselineNudge(context, threshold), threshold);
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
  forgetGlyphsWhenFontsLoad();
  // Taken off the prototype on purpose: it is only ever called back on a Text, below.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const paint = TextClass.prototype.updateText;
  TextClass.prototype.updateText = function updateText(this: TextLike): unknown {
    hardenContext(this.context);
    return paint.call(this);
  };
}
