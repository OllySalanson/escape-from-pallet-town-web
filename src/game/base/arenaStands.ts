import type { PaintedPicture } from '../world/minimap';
import {
  ARENA_DARK_BELOW,
  ARENA_HALL_HEIGHT,
  ARENA_HALL_WIDTH,
  ARENA_MAT,
  ARENA_TILE,
  ARENA_ENTRY,
  ENTRY_WALL_FOOT,
  ENTRY_WALL_ROWS,
  WALL_FACE_HEIGHT,
  WALL_FOOT,
  acrossOval,
  scatter,
  stoneAt,
  type Oval,
} from './arenaHall';

/**
 * The colosseum round THE RAID ARENA's hall: everything outside its wall. Rows of
 * stone seats climbing away from the top of the wall, and behind them an arcade of
 * dark arches with banners along its top. The people on the seats are a layer of
 * their own (`paintCrowdLayer`), because how full the house is belongs to the save
 * and a save changes; what the crowd does is `arenaCrowd.ts`.
 *
 * It is drawn as the pit is, rings of one oval stepped outward and lifted, which
 * is what shows a riser on the north side and hides it elsewhere: this game's view
 * looks down at a slant, so what stands up can only be seen from the south. Nobody
 * can walk here. It lies under the hall's own tile layers, so it never hides a
 * figure; to the south it is only ever the treads and the backs of heads. The way
 * out of the hall stays cut through it. Phaser-free, so
 * `tools/base/renderArena.mts` draws the same pixels without a browser.
 */

type Rgb = readonly [number, number, number];

/** How wide the wall's cap is, as `scripts/draw-arena-hall.mts` paints it: the seats start at its back edge. */
const WALL_CAP = 9;
export const SEAT_ROWS = 4;
const SEAT_TREAD = 11;
const SEAT_RISE = 7;
/** How tall the arcade behind the seats stands on the north side, and its cap. */
const ARCADE_HEIGHT = 44;
const ARCADE_CAP = 8;

/** The hall's pixel the top-left of the picture stands on, and how big it is. */
export const STANDS_ORIGIN = { x: -48, y: -136 } as const;
export const STANDS_WIDTH = ARENA_HALL_WIDTH * ARENA_TILE - STANDS_ORIGIN.x * 2;
/** Down past the hall's own foot, as far as the camera may go (`ARENA_DARK_BELOW`). */
export const STANDS_HEIGHT = ARENA_HALL_HEIGHT * ARENA_TILE + ARENA_DARK_BELOW - STANDS_ORIGIN.y;

/** Half the width of the way out, in pixels, and where it starts: the porch's own walls go on south. */
const WAY_OUT_HALF = 34;
const WAY_OUT_FROM = (ARENA_MAT.y - 1) * ARENA_TILE;
const WAY_OUT_MIDDLE = (ARENA_MAT.x + 0.5) * ARENA_TILE;

const setPixel = (data: Uint8ClampedArray, at: number, ink: Rgb): void => {
  data[at] = ink[0];
  data[at + 1] = ink[1];
  data[at + 2] = ink[2];
  data[at + 3] = 255;
};

/** The back edge of a row of seats, for a pixel on the north side of the hall or not. */
function rowEdge(row: number, north: boolean): Oval {
  const out = WALL_CAP + row * SEAT_TREAD;
  return {
    x: WALL_FOOT.x,
    y: WALL_FOOT.y - (north ? WALL_FACE_HEIGHT + row * SEAT_RISE : 0),
    rx: WALL_FOOT.rx + out,
    ry: WALL_FOOT.ry + out,
  };
}

const lifted = (oval: Oval, by: number): Oval => ({ ...oval, y: oval.y - by });
const grown = (oval: Oval, by: number): Oval => ({ ...oval, rx: oval.rx + by, ry: oval.ry + by });

/**
 * How far across a ring a pixel is. Its north half is lifted and the south is not,
 * so from where it is widest down to the hall's middle its side simply runs
 * straight down: as an oval it would turn in there, and leave a notch at the join.
 */
function acrossRing(oval: Oval, px: number, py: number, north: boolean): number {
  return north && py > oval.y ? Math.abs(px - oval.x) / oval.rx : acrossOval(oval, px, py);
}

/** The room the door opens into and its walls stand here, and its corners are further out than the oval's. */
const inEntry = (x: number, y: number): boolean =>
  x >= (ARENA_ENTRY.left - 1) * ARENA_TILE &&
  x < (ARENA_ENTRY.right + 2) * ARENA_TILE &&
  y >= (ARENA_ENTRY.top - ENTRY_WALL_ROWS) * ARENA_TILE &&
  y < (ARENA_ENTRY.bottom + 1) * ARENA_TILE + ENTRY_WALL_FOOT;
const inWayOut = (x: number, y: number): boolean =>
  (y >= WAY_OUT_FROM && Math.abs(x - WAY_OUT_MIDDLE) < WAY_OUT_HALF) || inEntry(x, y);

/** How many arches stand round the half of the arcade that can be seen. */
const ARCHES = 26;
const ARCH_HALF_WIDTH = 8;
const ARCH_TALL = 30;
/** Whether a column and height of the arcade's face is inside an arch: upright wherever round it stands. */
function archAt(hallX: number, rowsUp: number, rx: number): boolean {
  const across = Math.max(-1, Math.min(1, (hallX + 0.5 - WALL_FOOT.x) / rx));
  const angle = Math.asin(across);
  const turned = ((angle + Math.PI / 2) / Math.PI) * ARCHES;
  const arch = Math.floor(turned);
  const facing = Math.max(0.3, Math.cos(angle));
  const fromMiddle = (turned - arch - 0.5) * ((Math.PI * rx * facing) / ARCHES);
  const half = ARCH_HALF_WIDTH * facing;
  const shoulder = rowsUp - (ARCH_TALL - 6);
  const inside = rowsUp >= 2 && rowsUp < ARCH_TALL && Math.abs(fromMiddle) < half - (shoulder > 0 ? shoulder * shoulder * 0.16 * facing : 0);
  return inside;
}

/** How far a column has to climb to reach the edge of an oval's north side. */
const northEdgeAt = (oval: Oval, hallX: number): number => {
  const across = (hallX + 0.5 - oval.x) / oval.rx;
  return Math.abs(across) >= 1 ? oval.y : oval.y - Math.sqrt(1 - across * across) * oval.ry;
};

const ARCH_DARK: Rgb = [12, 10, 18];
const ARCH_GLOW: Rgb = [56, 32, 24];

/** A person sitting, dimly: a head and shoulders. Same from in front or behind, this far off in this light. */
const PERSON = ['.hhh.', '.hhh.', 'sssss', 'sssss', 'sssss'] as const;
const PERSON_HEIGHT = PERSON.length;
export const PERSON_WIDTH = PERSON[0].length;

/** The crowd's clothes and heads: darker than the stone they sit on, because nobody here is lit. */
const CROWD_INKS: readonly { readonly s: Rgb; readonly h: Rgb }[] = [
  { s: [24, 24, 40], h: [40, 32, 40] },
  { s: [40, 24, 32], h: [48, 32, 32] },
  { s: [24, 32, 32], h: [40, 40, 32] },
  { s: [32, 24, 24], h: [48, 40, 32] },
  { s: [16, 16, 24], h: [32, 32, 40] },
];

/** About one place to every this many pixels along a row. */
const SEAT_SPACING = 9;

export interface CrowdSeat {
  /** The top-left of the person, in hall pixels. */
  readonly x: number;
  readonly y: number;
  readonly ink: number;
  /** How full the house has to be before somebody sits here, in [0, 1). */
  readonly fill: number;
  /** This person's own number in [0, 1), so no two of them keep time. */
  readonly roll: number;
  /** Where round the hall they sit, as `ovalPoint` turns. */
  readonly angle: number;
  readonly row: number;
  readonly north: boolean;
}

let seatsCache: readonly CrowdSeat[] | null = null;

/**
 * Every place in the stands. A person's place stays their place, so a save, a
 * visit and a screen all show the same crowd, and a fuller house is the same
 * people with more beside them (`seatedAt`).
 */
export function crowdSeats(): readonly CrowdSeat[] {
  if (seatsCache) {
    return seatsCache;
  }
  const seats: CrowdSeat[] = [];
  for (let row = 0; row < SEAT_ROWS; row += 1) {
    for (const north of [true, false]) {
      const inner = rowEdge(row, north);
      const places = Math.round((Math.PI * (inner.rx + inner.ry)) / SEAT_SPACING);
      for (let place = 0; place < places; place += 1) {
        const angle = (place / places) * Math.PI * 2;
        const sin = Math.sin(angle);
        if (north !== sin < 0) {
          continue;
        }
        const { x, y } = seatPoint(row, north, angle);
        if (!inWayOut(x + 2, y)) {
          seats.push({
            x,
            y,
            ink: Math.floor(scatter(place, row + 3) * CROWD_INKS.length),
            fill: scatter(place + (north ? 0 : 5000), row + 17),
            roll: scatter(place + 900, row + 41),
            angle,
            row,
            north,
          });
        }
      }
    }
  }
  seatsCache = seats;
  return seats;
}

/** Where a person sits on a row at a turn round the hall: on the tread, which to the north is up past the riser in front of it. */
export function seatPoint(row: number, north: boolean, angle: number): { readonly x: number; readonly y: number } {
  const inner = rowEdge(row, north);
  const reach = SEAT_TREAD * 0.5;
  return {
    x: Math.round(inner.x + Math.cos(angle) * (inner.rx + reach)) - 2,
    y: Math.round(inner.y - (north ? SEAT_RISE : 0) + Math.sin(angle) * (inner.ry + reach)) - PERSON_HEIGHT + 2,
  };
}

let seatedCache: { readonly share: number; readonly seats: readonly CrowdSeat[] } | null = null;

/** Who is in when the house is this full. */
export function seatedAt(share: number): readonly CrowdSeat[] {
  if (seatedCache?.share !== share) {
    seatedCache = { share, seats: crowdSeats().filter((seat) => seat.fill < share) };
  }
  return seatedCache.seats;
}

/** A person on their feet, and with their arms up: bottoms on the row a seated person's bottom is on. */
const STANDING = ['.....', '.....', '.....', '.hhh.', '.hhh.', 'sssss', '.sss.', '.sss.'] as const;
const ARMS_UP = ['h...h', 's...s', 's.h.s', 'shhhs', 'shhhs', 'sssss', '.sss.', '.sss.'] as const;
export type CrowdPose = 'stand' | 'up';
export const POSED_HEIGHT = STANDING.length;

/** The poses, each a row of one frame an ink: what `arenaCrowd.ts` draws over the seated. */
export function paintPosedPeople(): PaintedPicture {
  const width = PERSON_WIDTH * CROWD_INKS.length;
  const data = new Uint8ClampedArray(width * POSED_HEIGHT * 2 * 4);
  [STANDING, ARMS_UP].forEach((figure, poseIndex) => {
    CROWD_INKS.forEach((inks, ink) => {
      figure.forEach((row, y) => {
        [...row].forEach((char, x) => {
          if (char !== '.') {
            setPixel(data, ((poseIndex * POSED_HEIGHT + y) * width + ink * PERSON_WIDTH + x) * 4, char === 'h' ? inks.h : inks.s);
          }
        });
      });
    });
  });
  return { width, height: POSED_HEIGHT * 2, data };
}

/** One person, as the sheet the few who shift are drawn from: one frame an ink. */
export function paintCrowdPerson(): PaintedPicture {
  const width = PERSON_WIDTH * CROWD_INKS.length;
  const data = new Uint8ClampedArray(width * PERSON_HEIGHT * 4);
  CROWD_INKS.forEach((_inks, frame) => stampPerson(data, width, frame * PERSON_WIDTH, 0, frame));
  return { width, height: PERSON_HEIGHT, data };
}

function stampPerson(data: Uint8ClampedArray, width: number, left: number, top: number, ink: number): void {
  const inks = CROWD_INKS[ink];
  PERSON.forEach((row, y) => {
    [...row].forEach((char, x) => {
      if (char === '.') {
        return;
      }
      const px = left + x;
      const py = top + y;
      if (px >= 0 && px < width && py >= 0) {
        const at = (py * width + px) * 4;
        if (at + 3 < data.length) {
          setPixel(data, at, char === 'h' ? inks.h : inks.s);
        }
      }
    });
  });
}

const RED: Rgb = [120, 24, 32];
const RED_LIGHT: Rgb = [160, 40, 40];
const RED_DARK: Rgb = [80, 16, 24];
const GOLD: Rgb = [176, 128, 48];
const IRON: Rgb = [24, 24, 36];

/** How many banners stand round the arcade's top, and how tall each pole is. */
const BANNERS = 28;
const POLE_TALL = 34;

/** The banners along the arcade's top, all the way round, each standing up off the stone it is fixed to. */
function paintArcadeBanners(data: Uint8ClampedArray): void {
  const put = (hallX: number, hallY: number, ink: Rgb): void => {
    const x = hallX - STANDS_ORIGIN.x;
    const y = hallY - STANDS_ORIGIN.y;
    if (x >= 0 && y >= 0 && x < STANDS_WIDTH && y < STANDS_HEIGHT) {
      setPixel(data, (y * STANDS_WIDTH + x) * 4, ink);
    }
  };
  const seen: { x: number; y: number }[] = [];
  for (let index = 0; index < BANNERS; index += 1) {
    const angle = ((index + 0.5) / BANNERS) * Math.PI * 2;
    const north = Math.sin(angle) < 0;
    const edge = rowEdge(SEAT_ROWS, north);
    const top = north ? lifted(edge, ARCADE_HEIGHT) : edge;
    const x = Math.round(top.x + Math.cos(angle) * (top.rx + ARCADE_CAP / 2));
    const y = Math.round(top.y + Math.sin(angle) * (top.ry + ARCADE_CAP / 2));
    if (!inWayOut(x, y)) {
      seen.push({ x, y });
    }
  }
  // Back to front, because a nearer pole stands over a further one.
  for (const { x, y } of seen.sort((a, b) => a.y - b.y)) {
    for (let up = 0; up < POLE_TALL; up += 1) {
      put(x, y - up, IRON);
    }
    for (let up = 2; up < 26; up += 1) {
      const tail = 26 - up;
      for (let across = 1; across <= 9; across += 1) {
        // Hanging from near the top, swallow-tailed at the foot, hanging off the pole.
        const off = Math.abs(across - 5);
        if (tail < 5 && off < 5 - tail) {
          continue;
        }
        const ink = across === 9 || tail === 1 ? RED_DARK : across < 3 ? RED_LIGHT : off < 2 && up > 12 && up < 18 ? GOLD : RED;
        put(x + across, y - POLE_TALL + 2 + (up - 2), ink);
      }
    }
  }
}

/** How deep a course of the roof is, and how far out it takes to go as dark as it goes. */
const ROOF_COURSE = 7;
const ROOF_FADES_OVER = 110;

/**
 * Past the arcade's cap, out to the edge of everything the camera can reach: the
 * colosseum's own roof, going down into the shade in courses. There is no black
 * past the seats, which is what a camera near the wall used to show.
 */
function roofLevel(depth: number, hallX: number, x: number, y: number): readonly [number, number, number] {
  const course = Math.floor(depth / ROOF_COURSE);
  const joint = Math.floor(depth) % ROOF_COURSE === 0;
  const fade = Math.min(1, depth / ROOF_FADES_OVER);
  const level = joint ? 0.9 : 2.1 - fade * 0.8 + 0.25 * scatter(course, Math.floor(hallX / 24));
  return stoneAt(level, x, y);
}

/** The stands, with nobody in them: the seats, the arcade, and the roof round all of it. */
export function paintStands(): PaintedPicture {
  const width = STANDS_WIDTH;
  const height = STANDS_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  const innerNorth = rowEdge(0, true);
  const innerSouth = rowEdge(0, false);
  const lastNorth = rowEdge(SEAT_ROWS, true);
  const lastSouth = rowEdge(SEAT_ROWS, false);
  const arcadeTop = lifted(lastNorth, ARCADE_HEIGHT);
  const capNorth = grown(arcadeTop, ARCADE_CAP);
  const capSouth = grown(lastSouth, ARCADE_CAP);
  for (let y = 0; y < height; y += 1) {
    const hallY = y + STANDS_ORIGIN.y;
    const north = hallY < WALL_FOOT.y;
    for (let x = 0; x < width; x += 1) {
      const hallX = x + STANDS_ORIGIN.x;
      const px = hallX + 0.5;
      const py = hallY + 0.5;
      // What the wall and its cap already are is the hall's own.
      if (acrossRing(north ? innerNorth : innerSouth, px, py, north) <= 1) {
        continue;
      }
      const at = (y * width + x) * 4;
      if (inWayOut(hallX, hallY)) {
        continue;
      }
      const pastCap = acrossRing(north ? capNorth : capSouth, px, py, north);
      if (pastCap > 1) {
        const cap = north ? capNorth : capSouth;
        setPixel(data, at, roofLevel((pastCap - 1) * cap.rx, hallX, x, y));
        continue;
      }
      let row = -1;
      for (let each = 1; each <= SEAT_ROWS; each += 1) {
        if (acrossRing(rowEdge(each, north), px, py, north) <= 1) {
          row = each - 1;
          break;
        }
      }
      if (row >= 0) {
        const edge = rowEdge(row, north);
        const riser = north && acrossRing(lifted(edge, SEAT_RISE), px, py, north) <= 1;
        const brightness = 3.1 - row * 0.15;
        if (riser) {
          setPixel(data, at, stoneAt(0.9 + 0.3 * (row % 2), x, y));
        } else {
          // The tread: its front lip catches what light there is.
          const depth = (acrossRing(lifted(edge, north ? SEAT_RISE : 0), px, py, north) - 1) * edge.rx;
          setPixel(data, at, stoneAt(depth < 1.5 ? brightness + 1 : brightness - (depth > SEAT_TREAD - 3 ? 0.7 : 0), x, y));
        }
        continue;
      }
      if (north && acrossRing(arcadeTop, px, py, north) <= 1) {
        const rowsUp = northEdgeAt(lastNorth, hallX) - py;
        if (archAt(hallX, rowsUp, lastNorth.rx)) {
          // Warm at the foot of each, from whatever is burning back in there.
          const glow = rowsUp < 9 && (x + y) % 2 === 0 ? ARCH_GLOW : ARCH_DARK;
          setPixel(data, at, glow);
        } else {
          const course = Math.floor(rowsUp / 6);
          const joint = Math.floor(rowsUp) % 6 === 0 || Math.floor(hallX + (course % 2) * 8) % 16 === 0;
          setPixel(data, at, stoneAt(joint ? 0.8 : 1.7 + 0.3 * scatter(course, Math.floor(hallX / 16)), x, y));
        }
        continue;
      }
      // The arcade's cap, looked down on.
      setPixel(data, at, stoneAt(acrossRing(north ? capNorth : capSouth, px, py, north) > 0.992 ? 2.8 : 1.3, x, y));
    }
  }
  return { width, height, data };
}

/** Whoever is in when the house is this full, on the stands' own frame. */
export function paintCrowdLayer(share: number): PaintedPicture {
  const width = STANDS_WIDTH;
  const height = STANDS_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  for (const seat of seatedAt(share)) {
    stampPerson(data, width, seat.x - STANDS_ORIGIN.x, seat.y - STANDS_ORIGIN.y, seat.ink);
  }
  return { width, height, data };
}

/** The banners, on the stands' own frame: over everybody, on their feet or not, because a nearer pole stands over the people behind it. */
export function paintBanners(): PaintedPicture {
  const width = STANDS_WIDTH;
  const height = STANDS_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  paintArcadeBanners(data);
  return { width, height, data };
}

// --- the few who shift -------------------------------------------------------

/** How many of the crowd are shifting at once, the longest and shortest each does, and how far. */
export const CROWD_STIRRING = 7;
const STIR_LEAST_MS = 700;
const STIR_SPREAD_MS = 1800;

export interface CrowdStir {
  readonly seat: CrowdSeat;
  /** A pixel to the side, or up: somebody leaning over, somebody sitting up. */
  readonly dx: number;
  readonly dy: number;
  readonly forMs: number;
}

/** A shift of somebody in view, from rolls in [0, 1), or none if nobody is. */
export function nextStir(
  rolls: readonly [number, number, number],
  isInView: (seat: CrowdSeat) => boolean,
  seats: readonly CrowdSeat[],
): CrowdStir | null {
  // A handful of tries is plenty: mostly they are in view, and if not nobody is watching.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const seat = seats[Math.floor(((rolls[0] + attempt * 0.0731) % 1) * seats.length)];
    if (isInView(seat)) {
      const way = Math.floor(rolls[1] * 3);
      return { seat, dx: way === 0 ? -1 : way === 1 ? 1 : 0, dy: way === 2 ? -1 : 0, forMs: STIR_LEAST_MS + rolls[2] * STIR_SPREAD_MS };
    }
  }
  return null;
}
