import type { PaintedPicture } from '../world/minimap';
import { PIT_RIM, STONE_RAMP, acrossOval, dithered, scatter, stoneAt, type Oval } from './arenaHall';

/**
 * THE RAID ARENA's pit seen whole: the portal. From the rail a player only ever
 * sees the near curve of the pit, because it is far bigger than the screen, so
 * the camera used to swing out over whichever way in was chosen and leave the
 * screen half stone and half map (the captain, 25 Nov 2026: "you can't really see
 * that it's like a whole portal"). Looking down now draws back from the rail to
 * the whole of it - the kerb with its fence posts, the steps going down, the
 * dark wall at their foot and the map at the bottom under its cloud - as one
 * round picture in the room the rim's card leaves, with the player stood on its
 * edge. The ways in are lights on it, and the one chosen carries the look mark,
 * which hops from light to light as the choice changes. JUMP IN goes over its
 * edge and the portal opens round the landing as they fall.
 *
 * Everything here is pure: sizes, the picture, where a tile of the map is on it,
 * and the timelines, as functions of a number of milliseconds. `arenaPortalView.ts`
 * puts it on the screen.
 */

/** The pit's own shape: a touch wider than it is tall. */
const PIT_ASPECT = PIT_RIM.ry / PIT_RIM.rx;

/** The kerb the fence stands on, the three steps going down and the dark wall at their foot, in pixels. */
export const PORTAL_KERB = 4;
export const PORTAL_TIERS = 3;
export const PORTAL_TREAD = 3;
export const PORTAL_PODIUM = 3;
/** How far each step stands lower in the picture than the one above: the north risers show, as the hall's do. */
export const PORTAL_TIER_DROP = 1;
/** Round the outside, room for the fence's shadow and nothing else. */
const PORTAL_MARGIN = 2;
/** Below the portal, room for the player stood on its near edge. */
export const PORTAL_FOOT_ROOM = 14;
/** Above it, room for the name plate over a way in near its north edge. */
const PORTAL_HEAD_ROOM = 4;
/** The biggest a portal is drawn: past this the map's pixels would be bigger than the floor's own. */
const PORTAL_MOST_WIDTH = 300;
/** The smallest: below this it is a coin, not a portal. */
const PORTAL_LEAST_WIDTH = 96;
/** How much bigger than the map the floor's square is, so a little cloud stands round the map's edges. */
const PORTAL_FRAMING = 1.3;

export interface PortalRegion {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface PortalPoint {
  readonly x: number;
  readonly y: number;
}

/** One size of portal: its picture, and the ovals in it, in the picture's own pixels. */
export interface PortalShape {
  readonly width: number;
  readonly height: number;
  /** The outside of the kerb. */
  readonly rim: Oval;
  /** The hole at the foot of the steps, which the floor shows through. */
  readonly hole: Oval;
}

const shrunk = (oval: Oval, by: number, drop = 0): Oval => ({ x: oval.x, y: oval.y + drop, rx: oval.rx - by, ry: oval.ry - by });

/** How deep in from the kerb's outside the floor's hole is. */
const HOLE_INSET = PORTAL_KERB + PORTAL_TIERS * PORTAL_TREAD + PORTAL_PODIUM;
const HOLE_DROP = PORTAL_TIERS * PORTAL_TIER_DROP + 1;

/**
 * The biggest portal that fits a region of the screen with the player stood
 * below it, or null if the region cannot hold one worth drawing. An even width,
 * so its middle is on a whole pixel.
 */
export function portalShapeFor(region: PortalRegion): PortalShape | null {
  const byHeight = (region.height - PORTAL_FOOT_ROOM - PORTAL_HEAD_ROOM - PORTAL_MARGIN * 2 - HOLE_DROP) / PIT_ASPECT;
  const byWidth = region.width - PORTAL_MARGIN * 2 - 8;
  const across = Math.floor(Math.min(PORTAL_MOST_WIDTH, byHeight, byWidth) / 2) * 2;
  if (across < PORTAL_LEAST_WIDTH) {
    return null;
  }
  const rx = across / 2;
  const ry = Math.round(rx * PIT_ASPECT);
  const width = across + PORTAL_MARGIN * 2;
  const height = ry * 2 + PORTAL_MARGIN * 2 + HOLE_DROP;
  const rim: Oval = { x: width / 2, y: PORTAL_MARGIN + ry, rx, ry };
  return { width, height, rim, hole: shrunk(rim, HOLE_INSET, HOLE_DROP) };
}

/** Where a portal stands in a region: its picture's top-left, on whole pixels, centred with the player's room under it. */
export function portalPlace(shape: PortalShape, region: PortalRegion): PortalPoint {
  const tall = shape.height + PORTAL_FOOT_ROOM + PORTAL_HEAD_ROOM;
  return {
    x: Math.round(region.left + (region.width - shape.width) / 2),
    y: Math.round(region.top + (region.height - tall) / 2 + PORTAL_HEAD_ROOM),
  };
}

/**
 * The square of the pit's floor picture the portal's hole shows: the map with a
 * little cloud round it. `floorSize` is the floor picture's side, with the map
 * of `mapSpan` pixels in its middle.
 */
export function portalFloorSquare(floorSize: number, mapSpan: number): PortalRegion {
  // Even, so the map's middle is the square's.
  const side = Math.min(floorSize, Math.round((mapSpan * PORTAL_FRAMING) / 2) * 2);
  const left = Math.round((floorSize - side) / 2);
  return { left, top: left, width: side, height: side };
}

/** A pixel of the floor picture, on the portal's picture. */
export function portalPointOfFloor(floorPixel: PortalPoint, square: PortalRegion, shape: PortalShape): PortalPoint {
  const { hole } = shape;
  return {
    x: Math.round(hole.x - hole.rx + ((floorPixel.x - square.left) / square.width) * hole.rx * 2),
    y: Math.round(hole.y - hole.ry + ((floorPixel.y - square.top) / square.height) * hole.ry * 2),
  };
}

/** The ink of the floor's dark wall, and of the shadow it throws on the floor. */
const PODIUM_INK = STONE_RAMP[0];
const RAIL_INK: readonly [number, number, number] = [40, 48, 72];
const POST_INK = STONE_RAMP[7];
const POST_SHADE = STONE_RAMP[3];

/**
 * The portal's ring, with nothing in the hole: the kerb with its fence posts and
 * the rope along them, the three steps down, and the dark wall at their foot.
 * Stone from the hall's own ramp on the hall's own dither, so it is the same
 * stone the player has just walked over, a long way off.
 */
export function paintPortalRing(shape: PortalShape): PaintedPicture {
  const { width, height, rim } = shape;
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, ink: readonly [number, number, number]): void => {
    const at = (y * width + x) * 4;
    data[at] = ink[0];
    data[at + 1] = ink[1];
    data[at + 2] = ink[2];
    data[at + 3] = 255;
  };
  const kerbInside = shrunk(rim, PORTAL_KERB);
  const tierHoles = Array.from({ length: PORTAL_TIERS }, (_, tier) => shrunk(rim, PORTAL_KERB + (tier + 1) * PORTAL_TREAD, (tier + 1) * PORTAL_TIER_DROP));
  // The posts stand round the kerb a few pixels apart, more of them the bigger the portal.
  const posts = Math.max(24, Math.round((rim.rx + rim.ry) / 3.2));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const outside = acrossOval(rim, px, py);
      if (outside > 1) {
        // The kerb's shadow on the hall's floor, one pixel to the south.
        if (acrossOval({ ...rim, y: rim.y + 1 }, px, py) <= 1) {
          put(x, y, STONE_RAMP[1]);
        }
        continue;
      }
      if (acrossOval(kerbInside, px, py) > 1) {
        // The kerb: lit on its outer lip, the fence's rope run round its middle,
        // and a post every few pixels.
        const depth = (1 - outside) * rim.rx;
        const angle = Math.atan2((py - rim.y) / rim.ry, (px - rim.x) / rim.rx);
        const turned = ((angle + Math.PI) / (Math.PI * 2)) * posts;
        const onPost = turned - Math.floor(turned) < 0.22;
        if (depth < 0.9) {
          put(x, y, STONE_RAMP[2]);
        } else if (onPost && depth < PORTAL_KERB - 1) {
          put(x, y, depth < 2 ? POST_INK : POST_SHADE);
        } else if (depth >= 1.6 && depth < 2.6) {
          put(x, y, RAIL_INK);
        } else {
          put(x, y, stoneAt(depth < 1.6 ? 7.3 : 6.2, x, y));
        }
        continue;
      }
      // The steps: each tread lit at its lip and in the shadow of the step above
      // at its back, darker the further down, and the risers showing on the north.
      let drawn = false;
      for (let tier = 0; tier < PORTAL_TIERS; tier += 1) {
        const hole = tierHoles[tier];
        const across = acrossOval(hole, px, py);
        if (across < 1) {
          continue;
        }
        const above = tier === 0 ? kerbInside : tierHoles[tier - 1];
        const base = 5.4 - tier * 1.1;
        const fromLip = (across - 1) * hole.rx;
        const onRiser = acrossOval({ ...above, y: above.y + PORTAL_TIER_DROP }, px, py) > 1;
        const seat = Math.floor(((Math.atan2(py - hole.y, px - hole.x) + Math.PI) / (Math.PI * 2)) * 40);
        const level = onRiser ? base - 1.6 : fromLip < 0.9 ? base + 1.1 : base - 0.4 + 0.5 * (scatter(seat, tier) - 0.5);
        put(x, y, stoneAt(level, x, y));
        drawn = true;
        break;
      }
      if (drawn) {
        continue;
      }
      // The sheer wall at the foot of the steps, dark, with the hole in it.
      if (acrossOval(shape.hole, px, py) >= 1) {
        put(x, y, dithered(0.35, x, y) ? STONE_RAMP[1] : PODIUM_INK);
      }
    }
  }
  return { width, height, data };
}

/**
 * The floor in the portal's hole: the pit's own floor, its square drawn down to
 * the hole's size (`condensed`, the mean of what each pixel covers, as a telescope
 * shows it), clear everywhere outside the hole, and the wall's shadow lying a
 * pixel or two over its north-west edge.
 */
export function cutPortalFloor(condensed: PaintedPicture, shape: PortalShape): PaintedPicture {
  const { width, height, hole } = shape;
  const data = new Uint8ClampedArray(width * height * 4);
  const left = Math.round(hole.x - hole.rx);
  const top = Math.round(hole.y - hole.ry);
  const shadow: Oval = { ...hole, x: hole.x + 2, y: hole.y + 2, rx: hole.rx - 1, ry: hole.ry - 1 };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (acrossOval(hole, x + 0.5, y + 0.5) >= 1) {
        continue;
      }
      const fromX = Math.min(condensed.width - 1, Math.max(0, x - left));
      const fromY = Math.min(condensed.height - 1, Math.max(0, y - top));
      const from = (fromY * condensed.width + fromX) * 4;
      const at = (y * width + x) * 4;
      const shaded = acrossOval(shadow, x + 0.5, y + 0.5) >= 1;
      const dim = shaded ? (dithered(0.5, x, y) ? 0.45 : 0.6) : 1;
      data[at] = condensed.data[from] * dim;
      data[at + 1] = condensed.data[from + 1] * dim;
      data[at + 2] = condensed.data[from + 2] * dim;
      data[at + 3] = 255;
    }
  }
  return { width, height, data };
}

/** Where the player stands on the portal's edge for where they stand round the pit: on the kerb's outside, on the line from the middle. */
export function portalStance(shape: PortalShape, pit: PortalPoint, player: PortalPoint): PortalPoint {
  const angle = Math.atan2((player.y - pit.y) / PIT_RIM.ry, (player.x - pit.x) / PIT_RIM.rx);
  const { rim } = shape;
  return { x: Math.round(rim.x + Math.cos(angle) * (rim.rx + 1)), y: Math.round(rim.y + Math.sin(angle) * (rim.ry + 1)) };
}

// --- the timelines ---------------------------------------------------------------

/** Drawing back from the rail to the whole portal. */
export const PORTAL_OPEN_MS = 560;
/** And back to the rail again. */
export const PORTAL_CLOSE_MS = 320;
/** The look mark going from one way in to the next. */
export const AIM_HOP_MS = 260;
/** How high the look mark goes over, on its way. */
const AIM_HOP_RISE = 9;
/** How dark the hall goes round the portal while it is looked at: nearly all the way, so nobody is seen twice. */
export const PORTAL_DIM = 0.94;

const ease = (t: number): number => t * t * (3 - 2 * t);
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
const unit = (value: number): number => Math.max(0, Math.min(1, value));

export interface PortalOpenPose {
  /** How far from the pit as the rail sees it to the portal's own place and size, 0 to 1. */
  readonly drawn: number;
  /** How much of the portal shows over the pit it is drawn back from. */
  readonly shown: number;
  /** How dark the hall is round it. */
  readonly dim: number;
}

/**
 * Drawing back, `elapsedMs` in: the pit as it stands under the rail shrinks into
 * the whole portal, quickly and then settling, as a camera rising would show it.
 * The portal shows over the pit before it has gone far, so the two are never seen
 * apart, and the hall goes dark round it. `closing` plays it back, faster.
 */
export function portalOpenPose(elapsedMs: number, closing = false): PortalOpenPose {
  if (closing) {
    // The opening backwards: the portal grows back out to the pit under the rail,
    // and only goes once it lies over it, so nothing is ever seen twice.
    const t = unit(elapsedMs / PORTAL_CLOSE_MS);
    return { drawn: 1 - ease(t), shown: 1 - ease(unit(t / 0.7)), dim: PORTAL_DIM * (1 - ease(t)) };
  }
  const t = unit(elapsedMs / PORTAL_OPEN_MS);
  return { drawn: easeOut(t), shown: ease(unit(t / 0.35)), dim: PORTAL_DIM * ease(unit(t / 0.6)) };
}

/** The look mark on its way from one light to another: across, and up and over. */
export function aimHopAt(elapsedMs: number, from: PortalPoint, to: PortalPoint): PortalPoint {
  const t = ease(unit(elapsedMs / AIM_HOP_MS));
  return {
    x: Math.round(from.x + (to.x - from.x) * t),
    y: Math.round(from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * AIM_HOP_RISE),
  };
}

/** The player's hop off the portal's edge and into it: up and in towards the middle, in pixels from where they stood. */
export function portalHopAt(hop: number, stance: PortalPoint, middle: PortalPoint): PortalPoint {
  const t = unit(hop);
  const away = Math.hypot(middle.x - stance.x, middle.y - stance.y) || 1;
  const reach = Math.min(16, away * 0.3);
  // `+ 0` so a figure not yet moved is at 0 and never at -0.
  return {
    x: Math.round(((middle.x - stance.x) / away) * reach * t) + 0,
    y: Math.round(((middle.y - stance.y) / away) * reach * t - Math.sin(t * Math.PI) * 14) + 0,
  };
}

/**
 * How far the portal is ever magnified going down: by then its hole is wider
 * than the screen's corners, and the cloud is coming in; past it a dither is a
 * board of squares.
 */
const DIVE_MOST = 3;

/**
 * Going down into the portal: `zoom` is how far in the fall has gone, from the
 * jump's own timeline (`arenaDive.ts`, 1 at the rail). The steps and the floor
 * come up together, so the hole is always full of the map, and stop when the
 * hole is wider than the screen: the cloud shuts over it from there.
 */
export function portalDiveScales(zoom: number): { readonly ring: number; readonly floor: number } {
  const scale = Math.min(DIVE_MOST, zoom);
  return { ring: scale, floor: scale };
}
