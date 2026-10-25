/**
 * Which pixels of a building light up at night.
 *
 * FireRed draws its windows in a few pale glass blues. Read off the art, a
 * patch of glass that is window-sized is a window - a roof drawn in the same
 * blue (Bill's cottage) is far too big to be one, and the blue flowers in the
 * Bolthole's window boxes far too small - so nobody has to say where any
 * building's windows are, and a building swapped for another lights its own.
 * A window's glints break its glass into pieces a pixel apart; those are one
 * window. What lights is everything inside a window's box but its frame.
 *
 * Pure: handed RGBA pixels, it answers in pixels. `harbourNight.ts` draws it.
 */

export interface PixelBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** FireRed's window glass: a pale blue, bluer than it is green. */
export function isGlass(r: number, g: number, b: number): boolean {
  return b >= 180 && b - r >= 50 && g >= 120 && g < b;
}

/** A window is at least this many pixels of glass, and no bigger than this box. */
const WINDOW = { minGlass: 20, minWidth: 5, minHeight: 4, maxWidth: 16, maxHeight: 14 } as const;

/** Every window in a picture of a building, as the box round its glass. */
export function findWindows(pixels: ArrayLike<number>, width: number, height: number): PixelBox[] {
  const seen = new Uint8Array(width * height);
  const glassAt = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    return pixels[i + 3] > 0 && isGlass(pixels[i], pixels[i + 1], pixels[i + 2]);
  };
  const pieces: { box: { left: number; top: number; right: number; bottom: number }; glass: number }[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seen[y * width + x] || !glassAt(x, y)) continue;
      const box = { left: x, top: y, right: x, bottom: y };
      let glass = 0;
      const stack = [x, y];
      seen[y * width + x] = 1;
      while (stack.length > 0) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;
        glass += 1;
        box.left = Math.min(box.left, cx);
        box.right = Math.max(box.right, cx);
        box.top = Math.min(box.top, cy);
        box.bottom = Math.max(box.bottom, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[ny * width + nx] || !glassAt(nx, ny)) continue;
          seen[ny * width + nx] = 1;
          stack.push(nx, ny);
        }
      }
      pieces.push({ box, glass });
    }
  }
  // Glints split one pane into pieces: anything within a pixel of another is one window.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < pieces.length && !merged; i += 1) {
      for (let j = i + 1; j < pieces.length && !merged; j += 1) {
        const a = pieces[i].box;
        const b = pieces[j].box;
        if (a.left <= b.right + 2 && b.left <= a.right + 2 && a.top <= b.bottom + 2 && b.top <= a.bottom + 2) {
          pieces[i] = {
            box: {
              left: Math.min(a.left, b.left),
              top: Math.min(a.top, b.top),
              right: Math.max(a.right, b.right),
              bottom: Math.max(a.bottom, b.bottom),
            },
            glass: pieces[i].glass + pieces[j].glass,
          };
          pieces.splice(j, 1);
          merged = true;
        }
      }
    }
  }
  return pieces
    .map(({ box, glass }) => ({
      glass,
      box: { x: box.left, y: box.top, width: box.right - box.left + 1, height: box.bottom - box.top + 1 },
    }))
    .filter(
      ({ glass, box }) =>
        glass >= WINDOW.minGlass &&
        box.width >= WINDOW.minWidth &&
        box.height >= WINDOW.minHeight &&
        box.width <= WINDOW.maxWidth &&
        box.height <= WINDOW.maxHeight,
    )
    .map(({ box }) => box);
}

/** The pixels inside a window that are glass or glint rather than frame. */
export function isPane(r: number, g: number, b: number): boolean {
  return (r * 299 + g * 587 + b * 114) / 1000 >= 110;
}

const luminance = (r: number, g: number, b: number): number => (r * 299 + g * 587 + b * 114) / 1000;

/**
 * A ship's portholes: the little dark dashes along its white hull, each no
 * more than three pixels across and two high. Its outline is dark too, but one
 * long line of it, and its funnels' mouths are bigger than a porthole.
 */
export function findPortholes(pixels: ArrayLike<number>, width: number, height: number): PixelBox[] {
  const seen = new Uint8Array(width * height);
  const darkAt = (x: number, y: number): boolean => {
    const i = (y * width + x) * 4;
    return pixels[i + 3] > 0 && luminance(pixels[i], pixels[i + 1], pixels[i + 2]) < 80;
  };
  const found: PixelBox[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seen[y * width + x] || !darkAt(x, y)) continue;
      let [left, right, top, bottom] = [x, x, y, y];
      const stack = [x, y];
      seen[y * width + x] = 1;
      while (stack.length > 0) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;
        left = Math.min(left, cx);
        right = Math.max(right, cx);
        top = Math.min(top, cy);
        bottom = Math.max(bottom, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[ny * width + nx] || !darkAt(nx, ny)) continue;
          seen[ny * width + nx] = 1;
          stack.push(nx, ny);
        }
      }
      if (right - left < 3 && bottom - top < 2) {
        found.push({ x: left, y: top, width: right - left + 1, height: bottom - top + 1 });
      }
    }
  }
  return found;
}
