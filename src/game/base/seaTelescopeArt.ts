import type { PaintedPicture } from '../world/minimap';
import type { WindowLight } from './homeClock';
import { PANORAMA } from './seaTelescope';

/**
 * What THE POINT's coin telescope looks out over, in the harbour's own hand: a
 * sky in flat bands stepped together by a checker, as a GBA sky is, the grey
 * line of GREYSTONE VALE along part of the horizon, and the sea under it in
 * bands of its own with wave caps that grow and spread out the nearer they
 * are, which is what makes it read as a long way out. Two frames of the waves,
 * swapped, are the swell. The hour is the harbour's (`homeClock.ts`): by day,
 * at dusk and at night the same sea in its own inks.
 *
 * Everything out there is placed in the panorama's own pixels (`PANORAMA`),
 * but it is painted a pixel of the screen at a time for the view the glass has
 * (`paintSeaView`): magnified, a wave cap is longer and further from the next,
 * never fatter, and a checker is always a pixel of the screen. Blown up from one
 * picture it was four-pixel bars and checkerboards behind a Pokémon drawn a
 * pixel a pixel - two sizes of pixel on one screen. Canvas, so no art file
 * stands behind it.
 */

type Rgb = readonly [number, number, number];

interface SeaInks {
  /** The sky from the top down to the horizon's haze. */
  readonly sky: readonly Rgb[];
  /** The far coast, and its lit edge. */
  readonly coast: Rgb;
  readonly coastLit: Rgb;
  /** The sea from the horizon to the foot of the glass. */
  readonly sea: readonly Rgb[];
  readonly cap: Rgb;
  /** Caps out by the horizon, where white would read as snow. */
  readonly capFar: Rgb;
  readonly trough: Rgb;
  readonly cloud?: Rgb;
  readonly cloudShade?: Rgb;
  readonly star?: Rgb;
  readonly moon?: Rgb;
}

const hex = (value: number): Rgb => [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];

export const SEA_INKS: Readonly<Record<WindowLight, SeaInks>> = {
  day: {
    sky: [hex(0x5898f0), hex(0x70b0f8), hex(0x98c8f8), hex(0xc0e0f8)],
    coast: hex(0x7890b0),
    coastLit: hex(0x98b0c8),
    sea: [hex(0x88b8e8), hex(0x5090d8), hex(0x3878c8), hex(0x2860b0)],
    cap: hex(0xf8f8f8),
    capFar: hex(0xb8d8f8),
    trough: hex(0x2050a0),
    cloud: hex(0xf8f8f8),
    cloudShade: hex(0xd0e0f0),
  },
  dusk: {
    sky: [hex(0x484078), hex(0x885878), hex(0xd07870), hex(0xf8b070)],
    coast: hex(0x584060),
    coastLit: hex(0x906070),
    sea: [hex(0xc88878), hex(0x786888), hex(0x505878), hex(0x384068)],
    cap: hex(0xf8c888),
    capFar: hex(0xe0a888),
    trough: hex(0x283058),
    cloud: hex(0xf8a878),
    cloudShade: hex(0xb06870),
  },
  night: {
    sky: [hex(0x080c28), hex(0x101840), hex(0x182858), hex(0x203868)],
    coast: hex(0x101830),
    coastLit: hex(0x283858),
    sea: [hex(0x203860), hex(0x182c50), hex(0x102040), hex(0x0c1830)],
    cap: hex(0x6888c0),
    capFar: hex(0x385078),
    trough: hex(0x081028),
    star: hex(0xf8f8e0),
    moon: hex(0xf8f0c8),
  },
};

const mix = (a: Rgb, b: Rgb, share: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * share),
  Math.round(a[1] + (b[1] - a[1]) * share),
  Math.round(a[2] + (b[2] - a[2]) * share),
];

/** A whole-number hash of a few numbers, so every painting of the sea is the same sea. */
function hash(...values: readonly number[]): number {
  let h = 0x9e3779b9;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** Where along the horizon the far coast stands, and how high it rises there (fractional x for a magnified glass). */
export function coastHeightAt(x: number): number {
  const from = 340;
  const to = 860;
  if (x < from || x > to) return 0;
  const t = (x - from) / (to - from);
  const swell = Math.sin(t * Math.PI);
  const ridges = Math.sin(t * 23) * 0.18 + Math.sin(t * 61) * 0.08;
  return Math.max(0, (swell * 0.85 + ridges * swell) * 13);
}

/** A cloud's puffs, in panorama pixels. */
interface Puff {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

const CLOUDS: readonly { readonly puffs: readonly Puff[]; readonly x: number; readonly y: number; readonly long: number }[] = Array.from(
  { length: 9 },
  (_cloud, index) => {
    const x = Math.floor(hash(index, 5) * PANORAMA.width);
    const y = 14 + Math.floor(hash(index, 6) * (PANORAMA.horizon - 44));
    const long = 18 + Math.floor(hash(index, 7) * 26);
    const puffs = Array.from({ length: 4 }, (_puff, puff) => ({
      x: x + Math.floor((puff / 3) * long) - long / 2,
      y,
      r: 4 + Math.floor(hash(index, puff, 8) * 4),
    }));
    return { puffs, x, y, long };
  },
);

const STARS = Array.from({ length: 90 }, (_star, index) => ({
  x: Math.floor(hash(index, 1) * PANORAMA.width),
  y: Math.floor(hash(index, 2) * (PANORAMA.horizon - 20)),
}));

const MOON = { x: 760, y: 30, r: 7 } as const;

/** What the glass shows: the top-left of the view in panorama pixels, its zoom, and its size in screen pixels. */
export interface SeaView {
  readonly left: number;
  readonly top: number;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

/** The wave caps' rows: every so many rows of the panorama, closer together out by the horizon. */
export function isWaveRow(y: number): boolean {
  const { height, horizon } = PANORAMA;
  if (y <= horizon || y >= height) return false;
  const near = (y - horizon) / (height - horizon);
  return (y - horizon) % Math.max(2, Math.round(3 + near * 9)) === 0;
}

/**
 * The caps on a wave row, `wave` frame, as spans of panorama x: each `[from, to)`.
 * `seed` and `closer` give the finer ripples between them their own spacing.
 */
export function capsOnRow(
  y: number,
  wave: 0 | 1,
  from: number,
  to: number,
  { seed = 0, closer = 1 }: { readonly seed?: number; readonly closer?: number } = {},
): readonly (readonly [number, number])[] {
  const { height, horizon } = PANORAMA;
  const near = (y - horizon) / (height - horizon);
  const gap = Math.max(4, Math.round((16 + Math.round(near * 48)) / closer));
  const dash = 1 + Math.round(near * 6);
  const offset = Math.floor(hash(y, 11 + seed) * gap) + (wave === 1 ? Math.floor(gap / 2) : 0);
  const spans: (readonly [number, number])[] = [];
  const first = Math.floor((from - offset) / gap) * gap + offset - gap;
  for (let x = first; x < to; x += gap) {
    const jitter = Math.floor(hash(x - offset, y, 12 + seed) * Math.max(1, gap / 3));
    const length = Math.max(1, dash - Math.floor(hash(x - offset, y, 13 + seed) * 2));
    spans.push([x + jitter, x + jitter + length]);
  }
  return spans;
}

/**
 * The sea and sky the glass shows, `view.width` by `view.height` pixels of the
 * screen, its waves on frame `wave`: every edge on a pixel of the screen.
 */
export function paintSeaView(light: WindowLight, wave: 0 | 1, view: SeaView): PaintedPicture {
  const { width, height, zoom, left, top } = view;
  const { horizon } = PANORAMA;
  const inks = SEA_INKS[light];
  const pixels = new Uint32Array(width * height);
  // RGBA in memory order, whatever the machine's byte order is for a whole word.
  const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  const word = (ink: Rgb): number =>
    little ? ((255 << 24) | (ink[2] << 16) | (ink[1] << 8) | ink[0]) >>> 0 : ((ink[0] << 24) | (ink[1] << 16) | (ink[2] << 8) | 255) >>> 0;
  const span = (row: number, fromX: number, toX: number, ink: number): void => {
    const a = Math.max(0, Math.round((fromX - left) * zoom));
    const b = Math.min(width, Math.round((toX - left) * zoom));
    if (b > a) pixels.fill(ink, row * width + a, row * width + b);
  };
  const dot = (x: number, y: number, size: number, ink: number): void => {
    const sx = Math.round((x - left) * zoom);
    const sy = Math.round((y - top) * zoom);
    for (let dy = 0; dy < size; dy += 1) {
      if (sy + dy < 0 || sy + dy >= height) continue;
      for (let dx = 0; dx < size; dx += 1) {
        if (sx + dx >= 0 && sx + dx < width) pixels[(sy + dy) * width + sx + dx] = ink;
      }
    }
  };
  // A band of `bands`, `share` of the way down them, the next band's checker over
  // the band's last two rows of the screen.
  const bandRow = (row: number, bands: readonly Rgb[], share: number, span01: number): Rgb => {
    const scaled = Math.max(0, Math.min(0.9999, share)) * bands.length;
    const index = Math.floor(scaled);
    const base = word(bands[index]);
    pixels.fill(base, row * width, row * width + width);
    // How many rows of the screen to the next band's edge.
    const toEdge = ((index + 1 - scaled) / bands.length) * span01 * zoom;
    if (index < bands.length - 1 && toEdge <= 2) {
      const next = word(bands[index + 1]);
      for (let x = (row + 1) % 2; x < width; x += 2) pixels[row * width + x] = next;
    }
    return bands[index];
  };
  const halfZoom = Math.max(1, Math.round(zoom / 2));
  for (let row = 0; row < height; row += 1) {
    const y = top + (row + 0.5) / zoom;
    if (y < horizon) {
      bandRow(row, inks.sky, y / horizon, horizon);
      continue;
    }
    const sea = PANORAMA.height - horizon;
    const near = Math.min(0.999, (y - horizon) / sea);
    // The sea's bands run on `near ** 0.7`: its edges are found the same way.
    const under = bandRow(row, inks.sea, near ** 0.7, sea / Math.max(0.2, 0.7 * near ** -0.3));
    const worldRow = Math.floor(y);
    const into = (y - worldRow) * zoom;
    const capRow = isWaveRow(worldRow) && into < halfZoom;
    const troughRow = !capRow && isWaveRow(worldRow) && into < halfZoom * 2 && near > 0.35;
    // Magnified, the water between the caps has ripples of its own, too fine to
    // be seen with the glass all the way out: a row of the screen, half a
    // panorama pixel under a row that has none.
    if (!capRow && !troughRow && zoom >= 2 && !isWaveRow(worldRow) && Math.floor(into) === Math.floor(zoom / 2)) {
      const ripple = word(mix(under, inks.cap, 0.28));
      for (const [from, to] of capsOnRow(worldRow, wave, left, left + width / zoom, { seed: 100, closer: 2 })) span(row, from, from + Math.max(0.5, (to - from) / 2), ripple);
    }
    if (!capRow && !troughRow) continue;
    const ink = word(troughRow ? inks.trough : near < 0.22 ? inks.capFar : inks.cap);
    for (const [from, to] of capsOnRow(worldRow, wave, left, left + width / zoom)) span(row, from, to, ink);
  }
  // At night the moon lays a road of light across the water under it, broken by the swell.
  if (inks.moon) {
    const glade = word(inks.capFar);
    for (let worldRow = horizon + 1; worldRow < PANORAMA.height; worldRow += 2) {
      const sy = Math.floor((worldRow - top) * zoom);
      if (sy < 0 || sy >= height) continue;
      const near = (worldRow - horizon) / (PANORAMA.height - horizon);
      const spread = 4 + Math.round(near * 30);
      for (let along = -spread; along <= spread; along += 1) {
        if (hash(along, worldRow, 14 + wave) > 0.8 + 0.15 * (Math.abs(along) / spread)) {
          span(sy, MOON.x + along, MOON.x + along + 1, glade);
        }
      }
    }
  }
  if (inks.star) {
    const star = word(inks.star);
    for (const each of STARS) dot(each.x, each.y, halfZoom, star);
  }
  // Round things, a row of the screen at a time.
  const disc = (cx: number, cy: number, r: number, inkFor: (y: number) => number, below = cy + r): void => {
    const first = Math.max(0, Math.floor((cy - r - top) * zoom));
    const last = Math.min(height - 1, Math.ceil((Math.min(below, cy + r) - top) * zoom));
    for (let row = first; row <= last; row += 1) {
      const y = top + (row + 0.5) / zoom;
      const dy = y - cy;
      if (Math.abs(dy) > r || y > below) continue;
      const half = Math.sqrt(r * r - dy * dy);
      span(row, cx - half, cx + half, inkFor(y));
    }
  };
  if (inks.moon) {
    const moon = word(inks.moon);
    disc(MOON.x, MOON.y, MOON.r, () => moon);
  }
  if (inks.cloud && inks.cloudShade) {
    const cloud = word(inks.cloud);
    const shade = word(inks.cloudShade);
    for (const each of CLOUDS) {
      for (const puff of each.puffs) disc(puff.x, puff.y, puff.r, (y) => (y > puff.y - 2 ? shade : cloud), puff.y + 1);
      const row = Math.floor((each.y + 1 - top) * zoom);
      for (let thick = 0; thick < halfZoom; thick += 1) {
        if (row + thick >= 0 && row + thick < height) span(row + thick, each.x - each.long / 2 - 3, each.x + each.long / 2 + 3, shade);
      }
    }
  }
  // GREYSTONE VALE, a long way off, standing on the horizon: its lit edge a pixel of the screen.
  const coast = word(inks.coast);
  const lit = word(inks.coastLit);
  for (let column = 0; column < width; column += 1) {
    const rise = coastHeightAt(left + (column + 0.5) / zoom);
    if (rise <= 0) continue;
    const peak = Math.round((horizon - rise - top) * zoom);
    const foot = Math.round((horizon - top) * zoom);
    for (let row = Math.max(0, peak); row < Math.min(height, foot); row += 1) {
      pixels[row * width + column] = row === peak ? lit : coast;
    }
  }
  return { width, height, data: new Uint8ClampedArray(pixels.buffer) };
}

/**
 * THE POINT's coin telescope from behind, as the player stands at it: its head
 * with the two eyepiece cups turned to them, the neck, the coin box and its
 * post running off the foot of the shot. The prop's own inks
 * (`scripts/draw-promenade.mjs`, `coinTelescope`), so it is the same telescope.
 */
export const TELESCOPE_BACK = [
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kLLLLLLLLLLLLLLLLLLLLk.',
  'kLLBBBBBBBBBBBBBBBBBBLLk',
  'kBBBkkkkkBBBBBBkkkkkBBBk',
  'kBBkiiiiikBBBBkiiiiikBBk',
  'kBkisssiiikBBkisssiiikBk',
  'kBkiskkkiikBBkiskkkiikBk',
  'kBkiikkkiikBBkiikkkiikBk',
  'kBBkiiiiikBBBBkiiiiikBBk',
  'kBBBkkkkkBBBBBBkkkkkBBBk',
  'kDBBBBBBBBBBBBBBBBBBBBDk',
  '.kDDDDDDDDDDDDDDDDDDDDk.',
  '..kkkkkkkkkkkkkkkkkkkk..',
  '..........kiik..........',
  '.......kkkkkkkkkk.......',
  '.......kLLLLLLLLk.......',
  '.......kBBBBBBBBk.......',
  '.......kBBBBBBBBk.......',
  '.......kBBBBBBBBk.......',
  '.......kDDDDDDDDk.......',
  '.......kkkkkkkkkk.......',
  '..........kBDk..........',
  '..........kBDk..........',
  '..........kBDk..........',
  '..........kBDk..........',
  '..........kBDk..........',
  '..........kBDk..........',
  '..........kBDk..........',
] as const;

/** Where between the two eyepieces the eye goes, in the art's own pixels. */
export const TELESCOPE_EYE = { x: 12, y: 6 } as const;

export const TELESCOPE_INKS: Readonly<Record<string, Rgb>> = {
  k: hex(0x404868),
  i: hex(0x303848),
  s: hex(0x687088),
  L: hex(0x78d0b8),
  B: hex(0x389880),
  D: hex(0x206858),
};

/** The lookout's railing between the player and the sea, a post every so often: a rail, its light top and a shadow. */
export const RAIL_INKS = { rail: hex(0x303848), lit: hex(0x687088), shade: hex(0x101820) } as const;

/** Paints a grid of inks, one character a pixel, `.` clear. */
export function paintGrid(rows: readonly string[], inks: Readonly<Record<string, Rgb>>): PaintedPicture {
  const width = rows[0]?.length ?? 0;
  const height = rows.length;
  const data = new Uint8ClampedArray(width * height * 4);
  rows.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      const ink = inks[cell];
      if (ink) data.set([ink[0], ink[1], ink[2], 255], (y * width + x) * 4);
    }),
  );
  return { width, height, data };
}

/** A sprite's opaque rows and columns, for where the water cuts it. */
export interface BodyBox {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The smallest square holding every pixel of a picture that shows. */
export function opaqueBox(picture: PaintedPicture): BodyBox {
  let left = picture.width;
  let top = picture.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < picture.height; y += 1) {
    for (let x = 0; x < picture.width; x += 1) {
      if (picture.data[(y * picture.width + x) * 4 + 3] > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0 ? { left: 0, top: 0, right: picture.width - 1, bottom: picture.height - 1 } : { left, top, right, bottom };
}

/** A picture `factor` times smaller: each pixel the average of the ones it covers, there if half of them were. */
export function shrinkPicture(picture: PaintedPicture, factor: number): PaintedPicture {
  const width = Math.max(1, Math.floor(picture.width / factor));
  const height = Math.max(1, Math.floor(picture.height / factor));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        for (let dx = 0; dx < factor; dx += 1) {
          const at = ((y * factor + dy) * picture.width + x * factor + dx) * 4;
          if (picture.data[at + 3] > 127) {
            r += picture.data[at];
            g += picture.data[at + 1];
            b += picture.data[at + 2];
            covered += 1;
          }
        }
      }
      if (covered * 2 >= factor * factor) {
        data.set([Math.round(r / covered), Math.round(g / covered), Math.round(b / covered), 255], (y * width + x) * 4);
      }
    }
  }
  return { width, height, data };
}
