import type { Minimap, PaintedPicture } from '../world/minimap';
import {
  PIT_RIM,
  PIT_TREAD,
  STONE_RAMP,
  acrossOval,
  dithered,
  grownOval,
  pitFrameFor,
  podiumHole,
  scatter,
  stoneAt,
  tierHole,
  type Oval,
} from './arenaHall';
import type { WindowLight } from './homeClock';
import { inkAtHour } from './pitClock';
import { PIT_GATES } from './pitLife';

/**
 * What is painted into THE RAID ARENA's pit when the player walks in, a game
 * pixel at a time: the steps going down, the wall at their foot, and at the
 * bottom Greystone Vale, sunlit and very far away, with cloud over everything
 * this save has not walked.
 *
 * The vale is the wall map's own picture of the map (`wallMap.ts`), a pixel to
 * a tile, so the pit and the drop-in screen can never disagree about what has
 * been found. Only its inks are its own: this is the ground seen from high up,
 * so a wood has a grain to it and casts a shadow, and everything is pushed a
 * little towards the blue of the air between here and there. Phaser-free, so
 * `tools/base/renderArena.mts` draws the same pixels without a browser.
 */

/** How big the floor is painted: enough to fill the hole from anywhere the floor can slide to. */
export const PIT_FLOOR_SIZE = 1024;

/** How wide a ring's picture is painted, enough to run under the fence as it slides. */
const RING_MARGIN = 28;

export const RING_WIDTH = (PIT_RIM.rx + RING_MARGIN) * 2;
export const RING_HEIGHT = (PIT_RIM.ry + RING_MARGIN) * 2 + 40;
/** The hall's pixel the top-left of a ring's picture stands on, at rest. */
export const RING_ORIGIN = { x: PIT_RIM.x - RING_WIDTH / 2, y: PIT_RIM.y - (PIT_RIM.ry + RING_MARGIN) } as const;

/** The outside of a ring's stone: under the fence's kerb, and never past the hall's floor. */
const ringEdge = grownOval(PIT_RIM, RING_MARGIN);

export type Rgb = readonly [number, number, number];

const setPixel = (data: Uint8ClampedArray, at: number, ink: Rgb, alpha = 255): void => {
  data[at] = ink[0];
  data[at + 1] = ink[1];
  data[at + 2] = ink[2];
  data[at + 3] = alpha;
};

/** How far each ring has dropped into the dark, which is what makes the steps read as going down. */
const TIER_LIGHT = [5.2, 4.2, 3.2, 2.4] as const;

/**
 * One ring of steps: a tread round the hole, seen from above on every side, and
 * outside it the riser of the ring above it, which only shows where this ring
 * has dropped away from that one - on the north side, as a wall looked at. Each
 * ring has its own picture so it can slide on its own as the player walks.
 */
export function paintTier(tier: number): PaintedPicture {
  const width = RING_WIDTH;
  const height = RING_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  const hole = tierHole(tier);
  const tread = grownOval(hole, PIT_TREAD);
  const base = TIER_LIGHT[tier];
  const seats = 56 + tier * -4;
  for (let y = 0; y < height; y += 1) {
    const hallY = y + RING_ORIGIN.y;
    for (let x = 0; x < width; x += 1) {
      const hallX = x + RING_ORIGIN.x;
      const across = acrossOval(hole, hallX + 0.5, hallY + 0.5);
      if (across < 1 || acrossOval(ringEdge, hallX + 0.5, hallY + 0.5) > 1) {
        continue;
      }
      const angle = Math.atan2((hallY - hole.y) / hole.ry, (hallX - hole.x) / hole.rx);
      const turned = ((angle + Math.PI) / (Math.PI * 2)) * seats + tier * 0.37;
      const seat = Math.floor(turned);
      const seatEdge = turned - seat < 0.012;
      const onTread = acrossOval(tread, hallX + 0.5, hallY + 0.5) <= 1;
      const depth = (across - 1) * hole.rx;
      let level: number;
      if (onTread) {
        // The tread: the lip at the hole's edge catches the light, the back of
        // the seat is in the shadow of the ring above.
        level = base + 0.5 * (scatter(seat, tier) - 0.5);
        if (depth < 1.5) {
          level += 1.2;
        } else if (depth < 3) {
          level -= 0.9;
        } else if (depth > PIT_TREAD - 4) {
          level -= (depth - (PIT_TREAD - 4)) * 0.35;
        }
        if (seatEdge) {
          level -= 1.2;
        }
      } else {
        // The riser behind it: a face in shadow, coursed.
        const course = Math.floor(depth / 4);
        level = base - 1.2 - (course % 2 === 0 ? 0 : 0.35);
      }
      setPixel(data, (y * width + x) * 4, stoneAt(level, x, y));
    }
  }
  return { width, height, data };
}

/** Where the gates stand round the podium wall (`PIT_GATES`). */
const GATES = PIT_GATES;

/**
 * The sheer wall at the foot of the steps: dark stone, a line of barred gates
 * in it where anything might come out, the deep shadow it throws across the
 * floor round its foot - and past that the hole the floor shows through.
 */
export function paintPodium(): PaintedPicture {
  const width = RING_WIDTH;
  const height = RING_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  const hole = podiumHole();
  // The shadow on the floor falls to the south-east, away from the light.
  const shadow: Oval = { ...hole, x: hole.x + 7, y: hole.y + 9, rx: hole.rx - 3, ry: hole.ry - 3 };
  for (let y = 0; y < height; y += 1) {
    const hallY = y + RING_ORIGIN.y;
    for (let x = 0; x < width; x += 1) {
      const hallX = x + RING_ORIGIN.x;
      const across = acrossOval(hole, hallX + 0.5, hallY + 0.5);
      const at = (y * width + x) * 4;
      if (across < 1) {
        // The shadow, a hard dither that thins out across the map.
        const under = acrossOval(shadow, hallX + 0.5, hallY + 0.5);
        const reach = (under - 0.95) / 0.05;
        if (reach > 0 && (reach >= 1 ? dithered(0.85, x, y) : dithered(reach * 0.7, x, y))) {
          setPixel(data, at, [8, 12, 24]);
        }
        continue;
      }
      if (acrossOval(ringEdge, hallX + 0.5, hallY + 0.5) > 1) {
        continue;
      }
      const dx = (hallX + 0.5 - hole.x) / hole.rx;
      let level = 1.1;
      if (hallY < hole.y && Math.abs(dx) < 1) {
        // How far up the wall this is, straight above the hole's edge in this
        // column - a gate is upright wherever round the wall it stands.
        const edge = hole.y - Math.sqrt(1 - dx * dx) * hole.ry;
        const rowsUp = edge - (hallY + 0.5);
        const angle = Math.asin(dx);
        const turned = ((angle + Math.PI / 2) / Math.PI) * GATES;
        const gate = Math.floor(turned);
        // Its width foreshortens as the wall turns away.
        const fromGate = ((turned - gate - 0.5) * (Math.PI * hole.rx * Math.max(0.2, Math.cos(angle)))) / GATES;
        const halfWidth = 5 * Math.max(0.35, Math.cos(angle));
        const tall = 15;
        const shoulder = rowsUp - (tall - 3);
        const inArch =
          rowsUp >= 0 && rowsUp < tall && Math.abs(fromGate) < halfWidth - (shoulder > 0 ? shoulder : 0);
        if (inArch) {
          const bar = Math.abs(Math.floor(fromGate + 12)) % 3 === 0;
          setPixel(data, at, bar ? STONE_RAMP[3] : [4, 4, 12]);
          continue;
        }
        level = 1.7 + (Math.floor(rowsUp / 5) % 2 === 0 ? 0.35 : 0);
        if (rowsUp < 1.5) {
          level = 0.4;
        }
      }
      setPixel(data, at, stoneAt(level, x, y));
    }
  }
  return { width, height, data };
}

// --- the floor ---------------------------------------------------------------

/** The vale from the air: each of the minimap's grounds, as two or three inks scattered. */
const AIR_INKS: Readonly<Record<string, readonly Rgb[]>> = {
  '.': [
    [112, 168, 88],
    [120, 176, 96],
    [104, 160, 80],
  ],
  g: [
    [72, 136, 56],
    [64, 128, 56],
    [80, 144, 64],
  ],
  ',': [
    [200, 176, 120],
    [192, 168, 112],
  ],
  P: [
    [216, 208, 184],
    [200, 192, 168],
  ],
  w: [
    [120, 200, 216],
    [104, 192, 208],
  ],
  W: [
    [40, 112, 168],
    [48, 120, 176],
    [40, 104, 160],
  ],
  T: [
    [40, 88, 48],
    [32, 72, 40],
    [48, 104, 56],
    [32, 80, 40],
  ],
  C: [
    [128, 120, 104],
    [144, 136, 112],
    [112, 104, 88],
  ],
  B: [
    [96, 80, 72],
    [112, 96, 80],
  ],
};

/** The marks that say a place is yours, as the picture draws them. */
const MARK_INKS: Readonly<Record<string, Rgb>> = {
  I: [248, 208, 80],
  i: [248, 248, 248],
  X: [248, 144, 104],
  O: [152, 224, 120],
  H: [200, 40, 32],
  K: [144, 216, 248],
};

/** The cloud over what nobody has walked: its bright tops and its dark hollows. */
const CLOUD_INKS: readonly Rgb[] = [
  [40, 56, 80],
  [56, 72, 104],
  [80, 96, 128],
  [112, 128, 152],
  [144, 160, 176],
  [176, 184, 200],
];

/** How much darker the cloud is over what it is hiding: the dark's own hint of a coast and a wood. */
const CLOUD_HINT: Readonly<Record<string, number>> = {
  '0': 0.1,
  '1': 0.02,
  '2': -0.1,
  '3': -0.05,
  '4': -0.1,
  '+': 0.25,
};

/** A smooth repeatable field over the plane, in [0, 1], at a scale in pixels. */
function cloudField(x: number, y: number, scale: number, seed: number): number {
  const cellX = Math.floor(x / scale);
  const cellY = Math.floor(y / scale);
  const u = x / scale - cellX;
  const v = y / scale - cellY;
  const ease = (t: number): number => t * t * (3 - 2 * t);
  const a = scatter(cellX + seed, cellY);
  const b = scatter(cellX + 1 + seed, cellY);
  const c = scatter(cellX + seed, cellY + 1);
  const d = scatter(cellX + 1 + seed, cellY + 1);
  const top = a + (b - a) * ease(u);
  const bottom = c + (d - c) * ease(u);
  return top + (bottom - top) * ease(v);
}

/** How much cloud stands at a point: lumps of three sizes, summed. */
export function cloudAt(x: number, y: number): number {
  return (
    cloudField(x, y, 48, 11) * 0.5 +
    cloudField(x, y, 22, 37) * 0.32 +
    cloudField(x, y, 9, 71) * 0.18
  );
}

function cloudInk(x: number, y: number, hint: number): Rgb {
  const amount = Math.min(0.999, Math.max(0, (cloudAt(x, y) - 0.44) * 3 + hint));
  const position = amount * (CLOUD_INKS.length - 1);
  const whole = Math.floor(position);
  const index = dithered(position - whole, x, y) ? whole + 1 : whole;
  return CLOUD_INKS[Math.min(CLOUD_INKS.length - 1, index)];
}

/**
 * What shows through a gap in the cloud over ground nobody has walked: only the
 * coarse dark the drop-in screen draws (`minimap.ts`), a four-tile block at a
 * time, which is a coastline and a treeline and never a lane. It is what makes
 * the cloud cloud seen from above, with the country under it, and not a sky.
 */
const UNDER_CLOUD: Readonly<Record<string, Rgb>> = {
  '0': [48, 72, 64],
  '1': [40, 64, 56],
  '2': [24, 48, 48],
  '3': [32, 64, 88],
  '4': [24, 48, 80],
  '+': [72, 96, 88],
};
const PAST_THE_MAP: Rgb = [20, 28, 48];

/** The cloud over one pixel of what is not known, and what shows through its gaps. */
function unknownInk(x: number, y: number, char: string | undefined, fromEdge: number): Rgb {
  const under = UNDER_CLOUD[char ?? ''];
  const inside = Math.max(0, fromEdge);
  const hint = (CLOUD_HINT[char ?? ''] ?? 0) * Math.min(1, inside / 24);
  // The cloud banks up along the map's edge, either side of it, which is what
  // hides its square.
  const bank = Math.max(0, 1 - Math.abs(fromEdge) / EDGE_CLOUD_BANK) * 0.22;
  const thickness = cloudAt(x, y) + hint * 0.4 + bank;
  const below = under && dithered(inside / EDGE_CLOUD_BANK, x, y) ? under : PAST_THE_MAP;
  if (thickness < CLOUD_GAP) {
    return below;
  }
  if (thickness < CLOUD_GAP + 0.05 && !dithered((thickness - CLOUD_GAP) / 0.05, x, y)) {
    return below;
  }
  return cloudInk(x, y, hint + bank);
}

/** How far in from the map's edge the cloud banks up, in pixels. */
const EDGE_CLOUD_BANK = 44;

/** How thin the cloud has to be before the country shows through. */
const CLOUD_GAP = 0.46;

/** A colour pushed towards the air's blue: everything down there is a long way off. */
function hazed(ink: Rgb, x: number, y: number): Rgb {
  const share = dithered(0.5, x, y) ? 0.16 : 0.1;
  return [
    Math.round(ink[0] + (136 - ink[0]) * share),
    Math.round(ink[1] + (168 - ink[1]) * share),
    Math.round(ink[2] + (200 - ink[2]) * share),
  ];
}

/** How deep the cloud banks up inside the map's own edge, in pixels. */
const MAP_EDGE_BANK = 56;

/** Whether a character of the picture is ground that has been walked. */
export const isGroundKnown = (char: string | undefined): boolean =>
  char !== undefined && (AIR_INKS[char] !== undefined || MARK_INKS[char] !== undefined);
const isKnown = isGroundKnown;

/**
 * The floor of the pit: the map, centred, with cloud over everything that is not
 * known, in and past the map, so nothing shows where the map's own square stops.
 * Known ground goes into cloud on a dithered edge rather than a line, and a mass
 * that stands up - a wood, a crag, a wall - throws a pixel of shadow to the
 * south-east, which is what makes it ground seen from above rather than a chart.
 */
/**
 * The map's square of the floor, drawn smaller: what a telescope shows when the
 * whole of it has to fit on the screen (`valeOverview.ts`). Every pixel is the
 * mean of the floor pixels it covers, snapped back to the 15-bit steps this
 * hardware draws in, and is a whole game pixel like any other. Sampling instead
 * of taking the mean loses a one-tile road at some columns and keeps it at others.
 */
export function condensedFloor(
  floor: { readonly data: Uint8ClampedArray; readonly width: number },
  square: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  size: { readonly width: number; readonly height: number },
): PaintedPicture {
  const data = new Uint8ClampedArray(size.width * size.height * 4);
  const spanX = square.width / size.width;
  const spanY = square.height / size.height;
  const snap = (value: number): number => Math.min(248, Math.round(value / 8) * 8);
  for (let y = 0; y < size.height; y += 1) {
    const fromY = square.top + y * spanY;
    const toY = fromY + spanY;
    for (let x = 0; x < size.width; x += 1) {
      const fromX = square.left + x * spanX;
      const toX = fromX + spanX;
      let red = 0;
      let green = 0;
      let blue = 0;
      let weight = 0;
      for (let row = Math.floor(fromY); row < Math.ceil(toY); row += 1) {
        const tall = Math.min(toY, row + 1) - Math.max(fromY, row);
        for (let column = Math.floor(fromX); column < Math.ceil(toX); column += 1) {
          const share = tall * (Math.min(toX, column + 1) - Math.max(fromX, column));
          const at = (row * floor.width + column) * 4;
          red += floor.data[at] * share;
          green += floor.data[at + 1] * share;
          blue += floor.data[at + 2] * share;
          weight += share;
        }
      }
      const to = (y * size.width + x) * 4;
      data[to] = snap(red / weight);
      data[to + 1] = snap(green / weight);
      data[to + 2] = snap(blue / weight);
      data[to + 3] = 255;
    }
  }
  return { width: size.width, height: size.height, data };
}

/** The grey-blue everything under the cloud is drawn towards through a telescope, at an hour. */
export function calmCloudInk(light: WindowLight): Rgb {
  return inkAtHour([68, 80, 100], 'cloud', light);
}

/** How much brighter walked ground is drawn through a telescope: by night it would otherwise be darker than the cloud. */
const WALKED_LIFT: Readonly<Record<WindowLight, number>> = { day: 1, dusk: 1, night: 1.7 };

/** How much of the cloud's own light and dark is left in it through a telescope. */
const CALMED_CLOUD = 0.42;

/**
 * The pit's floor as a telescope shows it: everything nobody has walked drawn down
 * towards one quiet grey-blue, so the cloud is still cloud, with the shape of the
 * country dimly under it, and what has been walked is the only bright thing there.
 * The pit wants its cloud bright and alive; a map being read does not.
 */
export function calmedFloor(
  floor: { readonly data: Uint8ClampedArray; readonly width: number; readonly height: number },
  mapFloor: { readonly left: number; readonly top: number },
  scale: number,
  isWalked: (tile: { readonly x: number; readonly y: number }) => boolean,
  ink: Rgb,
  light: WindowLight,
): PaintedPicture {
  const data = new Uint8ClampedArray(floor.data);
  const step = (value: number): number => Math.min(248, Math.round(value / 8) * 8);
  const lift = WALKED_LIFT[light];
  // The edge of what has been walked is half cloud on a dither, and goes with it.
  const key = (at: number): number => (data[at] << 16) | (data[at + 1] << 8) | data[at + 2];
  const cloudInks = new Set(CLOUD_INKS.map((each) => inkAtHour(each, 'cloud', light)).map(([r, g, b]) => (r << 16) | (g << 8) | b));
  for (let y = 0; y < floor.height; y += 1) {
    const tileY = Math.floor((y - mapFloor.top) / scale);
    for (let x = 0; x < floor.width; x += 1) {
      const at = (y * floor.width + x) * 4;
      if (data[at + 3] === 0) {
        continue;
      }
      if (cloudInks.has(key(at)) || !isWalked({ x: Math.floor((x - mapFloor.left) / scale), y: tileY })) {
        data[at] = step(ink[0] + (data[at] - ink[0]) * CALMED_CLOUD);
        data[at + 1] = step(ink[1] + (data[at + 1] - ink[1]) * CALMED_CLOUD);
        data[at + 2] = step(ink[2] + (data[at + 2] - ink[2]) * CALMED_CLOUD);
      } else if (lift !== 1) {
        data[at] = step(data[at] * lift);
        data[at + 1] = step(data[at + 1] * lift);
        data[at + 2] = step(data[at + 2] * lift);
      }
    }
  }
  return { width: floor.width, height: floor.height, data };
}

/** The steps of grey-blue the cloud is drawn in once it has been drawn smaller, as shares of `calmCloudInk`. */
const CLOUD_STEPS = [0.66, 0.84, 1.02, 1.24] as const;

/**
 * Cloud drawn smaller has been averaged into a smooth airbrushed grey, which nothing
 * else on a GBA screen is. This puts what is not `isGround` back into a few hard
 * steps of ink on a dither, keeping how light or dark each pixel was.
 */
export function steppedCloud(
  picture: PaintedPicture,
  isGround: (x: number, y: number) => boolean,
  ink: Rgb,
): PaintedPicture {
  const { width, height } = picture;
  const data = new Uint8ClampedArray(picture.data);
  const step = (value: number): number => Math.min(248, Math.round(value / 8) * 8);
  const steps = CLOUD_STEPS.map((share): Rgb => [step(ink[0] * share), step(ink[1] * share), step(ink[2] * share)]);
  const low = ink[0] + ink[1] + ink[2];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isGround(x, y)) {
        continue;
      }
      const at = (y * width + x) * 4;
      const share = (data[at] + data[at + 1] + data[at + 2]) / low;
      const place = Math.max(0, Math.min(steps.length - 1.001, ((share - CLOUD_STEPS[0]) / (CLOUD_STEPS[steps.length - 1] - CLOUD_STEPS[0])) * (steps.length - 1)));
      const whole = Math.floor(place);
      setPixel(data, at, steps[dithered(place - whole, x, y) ? whole + 1 : whole]);
    }
  }
  return { width, height, data };
}

export function paintPitFloor(picture: Minimap, light: WindowLight = 'day'): PaintedPicture {
  const size = PIT_FLOOR_SIZE;
  const data = new Uint8ClampedArray(size * size * 4);
  // Marks stay as they are: a way in is a light at any hour.
  const putCloud = (at: number, ink: Rgb): void => setPixel(data, at, inkAtHour(ink, CLOUD_INKS.includes(ink) ? 'cloud' : 'under', light));
  const putGround = (at: number, ink: Rgb): void => setPixel(data, at, inkAtHour(ink, 'ground', light));
  const frame = pitFrameFor(picture.width, picture.height);
  const offsetX = (size - frame.width * frame.scale) / 2;
  const offsetY = (size - frame.height * frame.scale) / 2;
  const rows = picture.rows;
  const charAt = (mapX: number, mapY: number): string | undefined => rows[mapY]?.[mapX];
  for (let y = 0; y < size; y += 1) {
    const mapY = Math.floor((y - offsetY) / frame.scale);
    for (let x = 0; x < size; x += 1) {
      // Round, as far as the hole can ever slide to show: past that the corners
      // of a square picture would stand outside the hall.
      if (Math.hypot(x - size / 2, y - size / 2) > size / 2) {
        continue;
      }
      const mapX = Math.floor((x - offsetX) / frame.scale);
      const inside = mapX >= 0 && mapY >= 0 && mapX < frame.width && mapY < frame.height;
      const char = inside ? charAt(mapX, mapY) : undefined;
      const at = (y * size + x) * 4;
      // How far in from the map's own edge this pixel is, in pixels of the floor.
      const fromEdge = Math.min(
        x - offsetX,
        y - offsetY,
        offsetX + frame.width * frame.scale - 1 - x,
        offsetY + frame.height * frame.scale - 1 - y,
      );
      if (!isKnown(char)) {
        // What shows through thins to nothing towards the map's edge, or the
        // cloud would draw the map's own square.
        putCloud(at, unknownInk(x, y, char, fromEdge));
        continue;
      }
      const mark = MARK_INKS[char as string];
      if (mark) {
        setPixel(data, at, mark);
        continue;
      }
      // The map's own edge goes into the cloud as a bank, on a widening dither,
      // or a save that has walked to it would see the picture's square.
      // Only over what fills a map's margin, wood and open sea: a place out near
      // the edge, the islands above all, stays clear of it.
      if ((char === 'T' || char === 'W') && fromEdge < MAP_EDGE_BANK) {
        const reach = 8 + cloudField(x, y, 34, 53) * (MAP_EDGE_BANK - 8);
        if (fromEdge < reach && dithered((reach - fromEdge) / 7, x, y)) {
          putCloud(at, cloudInk(x, y, 0.2));
          continue;
        }
      }
      // The first pixels in from the cloud are half cloud, on a dither.
      let nearest = 4;
      for (let reach = 1; reach < 4 && nearest === 4; reach += 1) {
        if (
          !isKnown(charAt(mapX - reach, mapY)) ||
          !isKnown(charAt(mapX + reach, mapY)) ||
          !isKnown(charAt(mapX, mapY - reach)) ||
          !isKnown(charAt(mapX, mapY + reach))
        ) {
          nearest = reach;
        }
      }
      if (nearest < 4 && dithered((4 - nearest) / 5, x, y)) {
        putCloud(at, cloudInk(x, y, 0.1));
        continue;
      }
      const inks = AIR_INKS[char as string];
      const ink = inks[Math.floor(scatter(mapX, mapY) * inks.length)];
      const standsUp = (other: string | undefined): boolean => other === 'T' || other === 'C' || other === 'B';
      const shaded = standsUp(charAt(mapX - 1, mapY - 1)) && !standsUp(char);
      const lit: Rgb = shaded ? [Math.round(ink[0] * 0.62), Math.round(ink[1] * 0.66), Math.round(ink[2] * 0.76)] : ink;
      putGround(at, hazed(lit, x, y));
    }
  }
  return { width: size, height: size, data };
}

/**
 * The cloud a jump goes down through, a sheet of it that repeats: the brightest
 * of what lies over the vale, with the same dark in its hollows, so going through
 * it reads as going through what was on the floor. The raid opens under this same
 * sheet (`world/raidArrival.ts`), which is what hides the join. It repeats no
 * oftener than a screen's height, so nobody sees it as a pattern.
 */
export function cloudSheet(size = 256): PaintedPicture {
  const data = new Uint8ClampedArray(size * size * 4);
  const scale = size / 4;
  const field = (x: number, y: number, each: number, seed: number): number => {
    const cellX = Math.floor(x / each);
    const cellY = Math.floor(y / each);
    const u = x / each - cellX;
    const v = y / each - cellY;
    const ease = (t: number): number => t * t * (3 - 2 * t);
    const wrap = size / each;
    const at = (cx: number, cy: number): number => scatter((cx % wrap) + seed, cy % wrap);
    const top = at(cellX, cellY) + (at(cellX + 1, cellY) - at(cellX, cellY)) * ease(u);
    const bottom = at(cellX, cellY + 1) + (at(cellX + 1, cellY + 1) - at(cellX, cellY + 1)) * ease(u);
    return top + (bottom - top) * ease(v);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const lumps = field(x, y, scale, 3) * 0.5 + field(x, y, scale / 2, 19) * 0.32 + field(x, y, scale / 4, 41) * 0.18;
      const amount = Math.min(0.999, Math.max(0, (lumps - 0.2) * 1.6));
      const position = 3 + amount * (CLOUD_INKS.length - 4);
      const whole = Math.floor(position);
      const index = dithered(position - whole, x, y) ? whole + 1 : whole;
      setPixel(data, (y * size + x) * 4, CLOUD_INKS[Math.min(CLOUD_INKS.length - 1, index)]);
    }
  }
  return { width: size, height: size, data };
}

/**
 * A piece of cloud torn off, going past on the way down: a lump of the same inks
 * that thins to nothing on a dither at its edge. The same shape at any size, and
 * painted at that size, so a piece coming nearer is still a game pixel to the pixel.
 */
export function paintCloudPiece(radius: number, seed: number): PaintedPicture {
  const size = radius * 2;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5 - radius) / radius;
      const v = (y + 0.5 - radius) / radius;
      const away = Math.hypot(u, v);
      if (away >= 1) {
        continue;
      }
      const lumps = cloudField((u + 2) * 3, (v + 2) * 3, 1, seed) * 0.55 + cloudField((u + 2) * 7, (v + 2) * 7, 1, seed + 17) * 0.3 + cloudField((u + 2) * 15, (v + 2) * 15, 1, seed + 31) * 0.15;
      // Nothing at its edge whatever the lumps say, so it is never a square, and
      // it is torn: a thin place near the middle is as thin as the edge.
      const body = (1 - away) * (0.45 + lumps * 1.5) - 0.16;
      if (body <= 0 || !dithered(body * 4.5, x, y)) {
        continue;
      }
      const position = 2 + Math.min(1, body * 1.7) * (CLOUD_INKS.length - 3);
      const whole = Math.floor(position);
      const index = dithered(position - whole, x, y) ? whole + 1 : whole;
      setPixel(data, (y * size + x) * 4, CLOUD_INKS[Math.min(CLOUD_INKS.length - 1, index)]);
    }
  }
  return { width: size, height: size, data };
}

/**
 * Thin mist drifting across the pit between the hall and the vale: a tile of
 * scattered white on nothing, repeated and slid, so the floor is never quite
 * still and the air between here and there has something in it.
 */
export function paintMist(size = 256): PaintedPicture {
  const data = new Uint8ClampedArray(size * size * 4);
  // A field that wraps: the corners of its cells repeat at the tile's edge.
  const wrapField = (x: number, y: number, cells: number, seed: number): number => {
    const scale = size / cells;
    const cellX = Math.floor(x / scale);
    const cellY = Math.floor(y / scale);
    const u = x / scale - cellX;
    const v = y / scale - cellY;
    const ease = (t: number): number => t * t * (3 - 2 * t);
    const corner = (cx: number, cy: number): number => scatter((cx % cells) + seed, cy % cells);
    const top = corner(cellX, cellY) + (corner(cellX + 1, cellY) - corner(cellX, cellY)) * ease(u);
    const bottom = corner(cellX, cellY + 1) + (corner(cellX + 1, cellY + 1) - corner(cellX, cellY + 1)) * ease(u);
    return top + (bottom - top) * ease(v);
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const amount = wrapField(x, y, 4, 3) * 0.6 + wrapField(x, y, 8, 17) * 0.28 + wrapField(x, y, 16, 29) * 0.12;
      const share = (amount - 0.56) * 4.2;
      if (share > 0 && dithered(share, x, y)) {
        setPixel(data, (y * size + x) * 4, [216, 224, 232], 255);
      }
    }
  }
  return { width: size, height: size, data };
}

