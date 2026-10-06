/**
 * The double battle's backdrop, made from the single battle's.
 *
 * `background-grass.png` is one flat picture with the two platforms painted
 * into it: the foe's ellipse on the right and the player's ground along the
 * bottom-left. A single battle stands its two Pokemon on those. A double battle
 * cannot: its player plates are a band across the bottom, which hides the
 * player's ground except for a few pixels of fringe beside and between the
 * plates, and the player's pair stands above that band - on nothing (playtest
 * section 3, item 3). So for a double the picture is redrawn once, pixel for
 * pixel, out of its own parts: the hidden foreground is painted out with the
 * field it stood on, and a copy of the foe's own platform is stood under the
 * player's pair, which is what a double battle in the games this is dressed as
 * does - both sides stand on the same kind of ground.
 *
 * Every coordinate here is in the art (the file's 255x143 picture, without the
 * border its crop left - see `GRASS_BACKDROP_ART` in `BattleScene.ts`), and it
 * is pure so the copy is tested rather than looked at.
 */

/** The foe's platform: its grass tips start at the top row, its rim at `rimTop`. */
export const FOE_PLATFORM = { left: 129, top: 72, right: 254, bottom: 103, rimTop: 79 } as const;

/** The player's ground along the bottom, which the double battle's plates hide. */
export const PLAYER_GROUND = { top: 120, right: 160 } as const;

/** Where the copy of the foe's platform stands, under the player's pair. */
export const DOUBLE_PLAYER_PLATFORM = { left: 2, top: 84 } as const;

/**
 * A stretch of field with no platform on it in any row the foreground covers,
 * which is what the foreground is painted out with, row by row - the field is
 * horizontal bands, so the same row further along is the right paint.
 */
const OPEN_FIELD = { from: 170, span: 80 } as const;

/** The rim's own ink, which bounds the platform in every row it crosses. */
const RIM_INK = [88, 72, 32] as const;

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** Four bytes a pixel, rows top to bottom. */
  readonly data: Uint8ClampedArray;
}

const colourAt = (image: RgbaImage, x: number, y: number): number => {
  const i = (y * image.width + x) * 4;
  return (image.data[i] << 16) | (image.data[i + 1] << 8) | image.data[i + 2];
};

const copyPixel = (from: RgbaImage, x: number, y: number, to: Uint8ClampedArray, tx: number, ty: number, width: number): void => {
  const i = (y * from.width + x) * 4;
  const o = (ty * width + tx) * 4;
  to[o] = from.data[i];
  to[o + 1] = from.data[i + 1];
  to[o + 2] = from.data[i + 2];
  to[o + 3] = from.data[i + 3];
};

const RIM = (RIM_INK[0] << 16) | (RIM_INK[1] << 8) | RIM_INK[2];

/**
 * Which pixels of one row of the foe's platform belong to it.
 *
 * From the rim down, everything between the row's first and last rim pixel -
 * the inside of the ellipse is greens the field also uses, so colour cannot
 * tell them apart there. Above the rim, where only the tips of the grass stand
 * against the field, a pixel belongs to the platform when its colour is not one
 * the same row of open field to the left uses.
 */
export const platformRowMask = (art: RgbaImage, y: number): readonly boolean[] => {
  const { left, right, rimTop } = FOE_PLATFORM;
  const mask: boolean[] = [];
  if (y >= rimTop) {
    let first = -1;
    let last = -1;
    for (let x = left; x <= right; x += 1) {
      if (colourAt(art, x, y) === RIM) {
        first = first < 0 ? x : first;
        last = x;
      }
    }
    for (let x = left; x <= right; x += 1) {
      mask.push(first >= 0 && x >= first && x <= last);
    }
    return mask;
  }
  const field = new Set<number>();
  for (let x = 0; x < left; x += 1) {
    field.add(colourAt(art, x, y));
  }
  for (let x = left; x <= right; x += 1) {
    mask.push(!field.has(colourAt(art, x, y)));
  }
  return mask;
};

/** The single battle's art, redrawn for a double battle. */
export const doubleBattleBackdrop = (art: RgbaImage): RgbaImage => {
  const data = new Uint8ClampedArray(art.data);
  for (let y = PLAYER_GROUND.top; y < art.height; y += 1) {
    for (let x = 0; x <= PLAYER_GROUND.right; x += 1) {
      copyPixel(art, OPEN_FIELD.from + (x % OPEN_FIELD.span), y, data, x, y, art.width);
    }
  }
  const dx = DOUBLE_PLAYER_PLATFORM.left - FOE_PLATFORM.left;
  const dy = DOUBLE_PLAYER_PLATFORM.top - FOE_PLATFORM.top;
  for (let y = FOE_PLATFORM.top; y <= FOE_PLATFORM.bottom; y += 1) {
    platformRowMask(art, y).forEach((inside, offset) => {
      const x = FOE_PLATFORM.left + offset;
      if (inside) {
        copyPixel(art, x, y, data, x + dx, y + dy, art.width);
      }
    });
  }
  return { width: art.width, height: art.height, data };
};
