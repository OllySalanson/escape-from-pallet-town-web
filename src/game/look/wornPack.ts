/**
 * The pack on the player's back: four packs drawn pixel by pixel, laid into the
 * figure's own sheet so they are part of every frame it is ever drawn in.
 *
 * It is baked rather than a second sprite following the first because a sprite
 * sheet is the one thing that cannot fall out of step: the pack bobs with the
 * figure, turns with it, falls with it and goes through a door with it without
 * one line of per-frame code, and costs a frame nothing. A figure wearing a pack
 * is one texture, composed the first time it is asked for (`lookTexture.ts`).
 *
 * Which way a pack sits is a matter of layers, four of them, and that is all
 * "behind or in front by facing" comes to:
 *
 *  - `behind` is under the whole figure. Facing the camera the pack is here, so
 *    only what stands out round the body is seen.
 *  - `body` is the figure itself, less its head.
 *  - `front` is over the body and under the head, which is the pack seen from
 *    behind and every strap: nothing here can ever cover a face, and a big head
 *    of hair falls in front of a pack as it should.
 *  - `over` is over everything: the Hauler frame's rails, which from behind pass
 *    in front of the head because that is where a frame that tall is.
 *
 * The figure's own step is read off its frames (`stepShift`) rather than listed,
 * so a pack moves exactly as far as the figure wearing it does, whichever of the
 * three bodies that is and whatever hat is on it: the classic figure drops a
 * pixel on every step, a FireRed figure only side on, and the Bicycle's rider
 * leans a pixel across. What hangs loose (`PackPart.sway`) moves a pixel more.
 *
 * Nothing here is a stat: a pack's squares are `items/packs.ts`, and this only
 * says what they look like.
 */
import type { Direction } from '../movement/gridMovement';
import type { PackItemId } from '../items/items';

/** The three drawings of a person a pack is ever worn on. */
export type WornPackBody = 'classic' | 'firered' | 'rider';

export type PackLayer = 'behind' | 'front' | 'over';

/** The way a pack is drawn: side on is one drawing, mirrored for the other side. */
type PackFacing = 'down' | 'side' | 'up';

export interface PackPart {
  readonly layer: PackLayer;
  /** The row of the first of `rows`, on a FireRed figure (`BODY_PLACES` moves it for the others). */
  readonly y: number;
  /** One character a pixel, sixteen across, `.` for nothing. Colours are `PACK_COLOURS`. */
  readonly rows: readonly string[];
  /**
   * How far this part hangs out of true on the two steps of the walk, across and
   * down, on top of what the figure does: something loose swinging.
   */
  readonly sway?: readonly [PackSway, PackSway];
  /** On the figure rather than hung from it: goes exactly where the figure goes, a strap. */
  readonly fixed?: true;
  /** Stands over the head rather than from the shoulders, for a body whose head and shoulders are not as far apart. */
  readonly overHead?: true;
}

type PackSway = readonly [x: number, y: number];

/** `o` is whatever the figure wearing it is outlined in, so a pack is never a different black. */
const OUTLINE = 'o';

/**
 * The four packs' own colours, the triples their icons are drawn in
 * (`scripts/draw-pack-icons.mjs`) - but for the canvas, a shade darker than its
 * icon, because the icon's light green is the colour of the grass and a pack in it
 * was an outline with the lawn showing through.
 */
export const PACK_COLOURS: Readonly<Record<string, number>> = {
  // oilcloth
  D: 0x9c8a68, d: 0x7a6a4f, e: 0x5b4e39,
  // canvas
  G: 0x4f7d5c, g: 0x3a5c44, h: 0x2a4433,
  // ranger canvas
  J: 0x5f97b6, j: 0x3f6f8d, k: 0x2d5069,
  // steel
  S: 0x9aa4b2, s: 0x6d7684, t: 0x454c58,
  // straps, buckles and the bedroll
  b: 0x6b4a2a, B: 0xb98a4e, m: 0xc9ba8f,
};

const SWING: readonly [PackSway, PackSway] = [[1, 0], [-1, 0]];

/** The two straps a pack on the back shows from in front. They are on the figure, so they stay put on it. */
const STRAPS: PackPart = {
  layer: 'front',
  y: 21,
  fixed: true,
  rows: [
    '.....b....b.....',
    '.....B....B.....',
    '.....b....b.....',
  ],
};

/** The one strap a pack on the back shows side on, over the near shoulder. */
const NEAR_STRAP: PackPart = {
  layer: 'front',
  y: 21,
  fixed: true,
  rows: [
    '.....bb.........',
    '......b.........',
  ],
};

/**
 * The drawings, in a FireRed figure's own rows: the head fills rows 9 to 19, the
 * shoulders start on 20, the feet end on 27. Side on is drawn facing right, so
 * the back is on the left.
 *
 * The four tell apart from every side, by shape before colour. A **Satchel** is
 * one strap and a small bag at the hip, so nothing is on the back at all. A **Raid
 * pack** is a plain rucksack. A **Ranger pack** carries a bedroll across its top
 * that stands out past the shoulders both ways. A **Hauler frame** is the only
 * thing that rises above the head.
 */
export const WORN_PACK_ART: Readonly<Record<PackItemId, Readonly<Record<PackFacing, readonly PackPart[]>>>> = {
  satchel: {
    down: [
      {
        layer: 'front',
        y: 20,
        fixed: true,
        rows: [
          '..........bb....',
          '.........b......',
          '.......bb.......',
          '.....bb.........',
        ],
      },
      {
        layer: 'front',
        y: 22,
        sway: SWING,
        rows: [
          '.oooo...........',
          'oDDDDo..........',
          'oDBDDo..........',
          'oddeeo..........',
          '.oooo...........',
        ],
      },
    ],
    side: [
      {
        layer: 'front',
        y: 20,
        fixed: true,
        rows: [
          '.......bb.......',
          '......b.........',
        ],
      },
      {
        layer: 'front',
        y: 22,
        sway: SWING,
        rows: [
          '..oooo..........',
          '.oDDDDo.........',
          '.oDBDDo.........',
          '.oddeeo.........',
          '..oooo..........',
        ],
      },
    ],
    up: [
      {
        layer: 'front',
        y: 20,
        fixed: true,
        rows: [
          '....bb..........',
          '......b.........',
          '.......bb.......',
          '.........bb.....',
        ],
      },
      {
        layer: 'front',
        y: 22,
        sway: SWING,
        rows: [
          '...........oooo.',
          '..........oDDDDo',
          '..........oDBDDo',
          '..........oddeeo',
          '...........oooo.',
        ],
      },
    ],
  },
  'raid-pack': {
    down: [
      {
        layer: 'behind',
        y: 22,
        rows: [
          '.oo..........oo.',
          'oGGo........oGGo',
          'oggo........oggo',
          'ohho........ohho',
          '.oo..........oo.',
        ],
      },
      STRAPS,
    ],
    side: [
      {
        layer: 'behind',
        y: 19,
        rows: [
          '..oooo..........',
          '.oGGGGo.........',
          'oGGGGGGo........',
          'obBggggo........',
          'oggggggo........',
          'ohhhhhho........',
          '.oooooo.........',
        ],
      },
      NEAR_STRAP,
    ],
    up: [
      {
        layer: 'front',
        y: 19,
        rows: [
          '....oooooooo....',
          '...oGGGGGGGGo...',
          '...oGGggggGGo...',
          '...obBggggBbo...',
          '..oggggggggggo..',
          '..ohhhhhhhhhho..',
          '...oooooooooo...',
        ],
      },
    ],
  },
  'ranger-pack': {
    down: [
      {
        layer: 'behind',
        y: 18,
        rows: [
          '.ooo........ooo.',
          'ommm........mmmo',
          'oBBB........BBBo',
          '.ooo........ooo.',
          '................',
          '.oo..........oo.',
          'oJJo........oJJo',
          '.oo..........oo.',
        ],
      },
      STRAPS,
    ],
    side: [
      {
        layer: 'behind',
        y: 18,
        rows: [
          '.ooooo..........',
          'ommmmmo.........',
          'omBbmmo.........',
          'ommmmmo.........',
          '.oJJJJo.........',
          '.ojbBjo.........',
          '.ojjjko.........',
          '..oooo..........',
        ],
      },
      NEAR_STRAP,
    ],
    up: [
      {
        layer: 'front',
        y: 19,
        rows: [
          '.oooooooooooooo.',
          'ommmmmmmmmmmmmmo',
          'oBBBBBBBBBBBBBBo',
          '.ooJJJJJJJJJJoo.',
          '...ojbBjjBbjo...',
          '...ojjjjjjjko...',
          '....oooooooo....',
        ],
      },
    ],
  },
  'hauler-frame': {
    down: [
      {
        layer: 'behind',
        y: 5,
        overHead: true,
        rows: [
          '...oooooooooo...',
          '..oSSSSSSSSSSo..',
          '..otttttttttto..',
          '..oSo......oSo..',
          '..oSo......oSo..',
          '..oSo......oSo..',
          '..oSo......oSo..',
        ],
      },
      {
        layer: 'behind',
        y: 19,
        rows: [
          '.ooo........ooo.',
          '.oSo........oSo.',
          '.oSo........oSo.',
          '.oSo........oSo.',
          'oSSSSSSSSSSSSSSo',
          'otttttttttttttto',
          '.oooooooooooooo.',
        ],
      },
      STRAPS,
    ],
    side: [
      {
        layer: 'behind',
        y: 5,
        rows: [
          '.oooooo.........',
          'oSSSSSSo........',
          'oSttttoo........',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
          'oSo.............',
        ],
      },
      {
        layer: 'behind',
        y: 20,
        rows: [
          'oSoooooo........',
          'oSbBbbbbo.......',
          'oSsssssso.......',
          'oSsssssso.......',
          'oSbBbbbbo.......',
          'oSSSSSSSo.......',
          '.oooooooo.......',
        ],
      },
      NEAR_STRAP,
    ],
    up: [
      {
        layer: 'front',
        y: 18,
        rows: [
          '...oooooooooo...',
          '..oSSSSSSSSSSo..',
          '..oSssssssssSo..',
          '..obBbbbbbbBbo..',
          '..oSssssssssSo..',
          '..oSsstssstsSo..',
          '..obBbbbbbbBbo..',
          '..oSSSSSSSSSSo..',
          '...oooooooooo...',
        ],
      },
      {
        layer: 'over',
        y: 5,
        rows: [
          '...oooooooooo...',
          '..oSSSSSSSSSSo..',
          '..oSttttttttSo..',
          '..oSo......oSo..',
          '...s........s...',
          '...s........s...',
          '...s........s...',
          '...s........s...',
          '...s........s...',
          '...s........s...',
          '...s........s...',
          '...s........s...',
          '...s........s...',
          '...s........s...',
        ],
      },
    ],
  },
};

/** How a frame is cut up, and where on it a pack goes. */
interface BodyPlace {
  readonly frameWidth: number;
  readonly frameHeight: number;
  /** Added to a drawing's place, by facing: a FireRed figure's own rows need none. */
  readonly shift: Readonly<Record<PackFacing, readonly [x: number, y: number]>>;
  /**
   * The last row of the head, for a drawing with no separate head piece: a
   * figure's standing frame is cut here. A FireRed look has its head on its own.
   */
  readonly chin: Readonly<Record<PackFacing, number>> | null;
  /**
   * How much further up a part that stands over the head goes than `shift` says.
   */
  readonly overHeadRise?: number;
  /**
   * A body with its own bag on its back already: the Bicycle's rider is Red, who
   * wears FireRed's yellow one, so a side-on pack is laid over him rather than
   * behind him, and that bag is painted out in his jacket's colours (colour to
   * colour) because nobody carries two.
   */
  readonly sideInFront?: boolean;
  readonly ownBag?: ReadonlyMap<number, number>;
  /** Whether a step that does not dip the figure lifts what it carries instead. Pedalling does not. */
  readonly bounces: boolean;
}

export const BODY_PLACES: Readonly<Record<WornPackBody, BodyPlace>> = {
  firered: {
    frameWidth: 16,
    frameHeight: 32,
    shift: { down: [0, 0], side: [0, 0], up: [0, 0] },
    chin: null,
    bounces: true,
  },
  classic: {
    frameWidth: 16,
    frameHeight: 32,
    shift: { down: [0, -1], side: [1, -2], up: [0, -3] },
    overHeadRise: 2,
    chin: { down: 17, side: 18, up: 16 },
    bounces: true,
  },
  rider: {
    frameWidth: 32,
    frameHeight: 32,
    shift: { down: [8, -3], side: [8, -3], up: [8, -4] },
    chin: { down: 17, side: 16, up: 15 },
    sideInFront: true,
    ownBag: new Map([
      [0xffde5a, 0xc53939],
      [0xbd9c39, 0x6a2929],
      [0xac7b41, 0x6a2929],
    ]),
    bounces: false,
  },
};

const ROWS: readonly Direction[] = ['down', 'right', 'up', 'left'];
const COLUMNS = 4;

/** A figure's sheet, RGBA, four columns by four rows of frames: its body, and its head apart. */
export interface FigurePixels {
  readonly width: number;
  readonly under: Uint8Array | Uint8ClampedArray;
  /** The head, drawn over a pack's `front` layer. Left out, the sheet is cut at `BodyPlace.chin`. */
  readonly head?: Uint8Array | Uint8ClampedArray;
}

function facingOf(direction: Direction): PackFacing {
  return direction === 'down' || direction === 'up' ? direction : 'side';
}

/** The top-left drawn pixel of a frame: the point of it that says where the figure has got to. */
function topOf(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  left: number,
  top: number,
  place: BodyPlace,
): { readonly x: number; readonly y: number } | null {
  for (let y = 0; y < place.frameHeight; y += 1) {
    for (let x = 0; x < place.frameWidth; x += 1) {
      // A soft pixel is a shadow on the ground, never the figure.
      if (pixels[((top + y) * width + left + x) * 4 + 3] === 255) {
        return { x, y };
      }
    }
  }
  return null;
}

/**
 * How far a step has moved the figure from where it stands, read off the two
 * frames: down a pixel, or across one, or (a FireRed figure facing up) not at all.
 */
export function stepShift(
  head: Uint8Array | Uint8ClampedArray,
  width: number,
  body: WornPackBody,
  row: number,
  column: number,
): readonly [x: number, y: number] {
  const place = BODY_PLACES[body];
  const standing = topOf(head, width, 0, row * place.frameHeight, place);
  const stepping = topOf(head, width, column * place.frameWidth, row * place.frameHeight, place);
  return standing && stepping ? [stepping.x - standing.x, stepping.y - standing.y] : [0, 0];
}

/** The figure's outline, which is its darkest solid colour. */
function outlineOf(body: Uint8Array | Uint8ClampedArray): number {
  let darkest = 0;
  let least = Infinity;
  for (let i = 0; i < body.length; i += 4) {
    if (body[i + 3] !== 255) continue;
    const sum = body[i] + body[i + 1] + body[i + 2];
    if (sum < least) {
      least = sum;
      darkest = (body[i] << 16) | (body[i + 1] << 8) | body[i + 2];
    }
  }
  return darkest;
}

function put(out: Uint8ClampedArray, at: number, colour: number): void {
  out[at] = colour >> 16;
  out[at + 1] = (colour >> 8) & 255;
  out[at + 2] = colour & 255;
  out[at + 3] = 255;
}

/** A sheet's rows above a frame's chin, or below it: the classic figure and the rider are one drawing each. */
function cutAtChin(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  body: WornPackBody,
): { readonly under: Uint8ClampedArray; readonly head: Uint8ClampedArray } {
  const place = BODY_PLACES[body];
  const under = new Uint8ClampedArray(pixels);
  const head = new Uint8ClampedArray(pixels.length);
  ROWS.forEach((direction, row) => {
    const chin = place.chin![facingOf(direction)];
    for (let column = 0; column < COLUMNS; column += 1) {
      const left = column * place.frameWidth;
      const top = row * place.frameHeight;
      // The chin moves with the figure, as everything about it does.
      const [, dy] = stepShift(pixels, width, body, row, column);
      for (let y = 0; y <= chin + dy; y += 1) {
        for (let x = 0; x < place.frameWidth; x += 1) {
          const at = ((top + y) * width + left + x) * 4;
          for (let c = 0; c < 4; c += 1) {
            head[at + c] = pixels[at + c];
            under[at + c] = 0;
          }
        }
      }
    }
  });
  return { under, head };
}

function withoutOwnBag(pixels: Uint8Array | Uint8ClampedArray, place: BodyPlace): Uint8Array | Uint8ClampedArray {
  if (!place.ownBag) {
    return pixels;
  }
  const out = new Uint8ClampedArray(pixels);
  for (let at = 0; at < out.length; at += 4) {
    const colour = place.ownBag.get((out[at] << 16) | (out[at + 1] << 8) | out[at + 2]);
    if (colour !== undefined && out[at + 3] > 0) {
      out[at] = colour >> 16;
      out[at + 1] = (colour >> 8) & 255;
      out[at + 2] = colour & 255;
    }
  }
  return out;
}

/**
 * The figure with its pack on, RGBA, the size it came. Pure pixels in and out, so
 * what every pack looks like on every body is testable without a canvas. Only the
 * four rows and four columns the walk is drawn from are dressed.
 */
export function dressInPack(figure: FigurePixels, body: WornPackBody, pack: PackItemId): Uint8ClampedArray {
  const place = BODY_PLACES[body];
  const { width } = figure;
  const { under, head } = figure.head
    ? { under: figure.under, head: figure.head }
    : cutAtChin(withoutOwnBag(figure.under, place), width, body);
  const out = new Uint8ClampedArray(figure.under.length);
  const outline = outlineOf(figure.under);

  ROWS.forEach((direction, row) => {
    const mirrored = direction === 'left';
    const facing = facingOf(direction);
    const parts = WORN_PACK_ART[pack][facing];
    for (let column = 0; column < COLUMNS; column += 1) {
      const left = column * place.frameWidth;
      const top = row * place.frameHeight;
      const [stepX, stepY] = stepShift(head, width, body, row, column);
      const inFront = facing === 'side' && place.sideInFront === true;

      const drawLayer = (layer: PackLayer): void => {
        for (const part of parts) {
          if ((inFront && part.layer === 'behind' ? 'front' : part.layer) !== layer) continue;
          const stepping = column % 2 === 1;
          const [swayX, swayY] = stepping && part.sway ? part.sway[(column - 1) / 2] : [0, 0];
          // A step always moves what is hung on a figure: down with it, or up if it does not dip.
          const lift = stepping && place.bounces && stepY === 0 && !part.sway && !part.fixed ? -1 : 0;
          part.rows.forEach((pixels, rowOfPart) => {
            const y = part.y + rowOfPart + place.shift[facing][1] + stepY + swayY + lift - (part.overHead ? (place.overHeadRise ?? 0) : 0);
            if (y < 0 || y >= place.frameHeight) return;
            for (let i = 0; i < pixels.length; i += 1) {
              const key = pixels[i];
              if (key === '.') continue;
              const across = mirrored ? place.frameWidth - 1 - i - place.shift[facing][0] : i + place.shift[facing][0];
              const x = across + (mirrored ? -swayX : swayX) + stepX;
              if (x < 0 || x >= place.frameWidth) continue;
              put(out, ((top + y) * width + left + x) * 4, key === OUTLINE ? outline : PACK_COLOURS[key]);
            }
          });
        }
      };

      const drawFigure = (from: Uint8Array | Uint8ClampedArray): void => {
        for (let y = 0; y < place.frameHeight; y += 1) {
          for (let x = 0; x < place.frameWidth; x += 1) {
            const at = ((top + y) * width + left + x) * 4;
            const alpha = from[at + 3];
            if (alpha === 0) continue;
            // A soft pixel is the figure's shadow on the ground, which a pack is above.
            if (alpha < 255 && out[at + 3] === 255) continue;
            out[at] = from[at];
            out[at + 1] = from[at + 1];
            out[at + 2] = from[at + 2];
            out[at + 3] = alpha;
          }
        }
      };

      drawLayer('behind');
      drawFigure(under);
      drawLayer('front');
      drawFigure(head);
      drawLayer('over');
    }
  });
  return out;
}
