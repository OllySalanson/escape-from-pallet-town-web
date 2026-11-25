import type { GridPosition } from '../movement/gridMovement';
import type { PaintedPicture } from '../world/minimap';
import type { CrowdMood } from './arenaCrowd';
import { DOOR_OPENING, inDoorOpening, isArenaDoor } from './arenaHall';

/**
 * THE RAID ARENA's great doors, at the head of the tunnel in (`arenaHall.ts`): two
 * leaves of iron-bound oak under a stone arch, shut until the player pushes them -
 * by walking into them or pressing at them - and then swung back for the rest of
 * the visit. They open on a heavy creak, and the house beyond answers whoever
 * comes through them as much as its record has earned (`doorsWelcome`).
 *
 * Here is everything about them that is not Phaser: how far open they are a
 * moment into the push, the pictures of every step of it, and who is greeted how.
 * `arenaDoorsView.ts` puts them on the screen.
 */

/** How long the leaves take to swing all the way back. Heavy, not slow: about two steps. */
export const DOORS_OPEN_MS = 560;

/** How many pictures the swing is drawn in: shut, every step of it, and open. */
export const DOOR_FRAMES = 8;

/** How far open the doors are, 0 shut to 1 back against the walls, a moment into the push: slow to start, then away. */
export function doorsOpenShare(elapsedMs: number): number {
  const share = Math.max(0, Math.min(1, elapsedMs / DOORS_OPEN_MS));
  return share * share * (3 - 2 * share);
}

/** Which of the pictures shows the doors that far open. */
export function doorFrameAt(share: number): number {
  return Math.round(Math.max(0, Math.min(1, share)) * (DOOR_FRAMES - 1));
}

/** Whether the doors, shut, stand in the way of a step onto `tile`. */
export function doorsBar(tile: GridPosition, open: boolean): boolean {
  return !open && isArenaDoor(tile);
}

/**
 * How the house greets somebody coming through the doors: polite hands for a
 * newcomer, a cheer once the seats are filling, a roar for somebody they fill the
 * place for. `share` is how full the stands are (`crowdShare`), which only raids
 * brought home fill, so the welcome is earned and grows with the player.
 */
export function doorsWelcome(share: number): CrowdMood {
  return share >= 0.9 ? 'roar' : share >= 0.6 ? 'cheer' : 'clap';
}

type Rgb = readonly [number, number, number];

const OUTLINE: Rgb = [24, 16, 16];
const OAK_LIGHT: Rgb = [136, 88, 48];
const OAK: Rgb = [104, 64, 40];
const OAK_DEEP: Rgb = [72, 40, 32];
const GROOVE: Rgb = [48, 28, 24];
const IRON: Rgb = [40, 40, 56];
const IRON_LIGHT: Rgb = [104, 104, 128];
const GOLD: Rgb = [248, 200, 64];
const GOLD_DARK: Rgb = [176, 120, 40];
/** The hall's light, through the gap where the leaves meet and under them: the torches' own amber. */
const LIGHT: Rgb = [248, 168, 72];

/** How wide one leaf is, shut. */
const LEAF = DOOR_OPENING.width / 2;
const BANDS = [7, DOOR_OPENING.height - 10] as const;

/** Whether a column of the opening, counted from its left, reaches up as far as `y` from the opening's top: the arch. */
function underArch(column: number, y: number): boolean {
  const radius = DOOR_OPENING.archRadius;
  return y >= radius || Math.hypot(column + 0.5 - radius, y + 0.5 - radius) <= radius;
}

/**
 * What a leaf looks like at a point of its own face, shut: `u` across from its
 * hinge (0 to `LEAF - 1`), `y` down from the opening's top. The Arena's ball is
 * split down the middle, half on each leaf, so it is only whole while they are shut.
 */
function leafInk(u: number, y: number, hinge: number): Rgb | null {
  // The column of the whole opening this point is on when shut, for the arch.
  const column = hinge === 0 ? u : DOOR_OPENING.width - 1 - u;
  if (!underArch(column, y)) {
    return null;
  }
  const meeting = u === LEAF - 1;
  if (u === 0 || meeting || !underArch(column, y - 1) || y === DOOR_OPENING.height - 1) {
    return OUTLINE;
  }
  // The ball across the meeting edge: a gold ring, a band through it.
  const ballX = LEAF - 0.5 - u;
  const ballY = y + 0.5 - 20;
  const distance = Math.hypot(ballX, ballY);
  if (distance <= 7.5 && distance >= 5.5) {
    return distance > 7 ? GOLD_DARK : GOLD;
  }
  if (distance < 5.5 && Math.abs(ballY) <= 1) {
    return GOLD_DARK;
  }
  // The iron bands, riveted.
  for (const band of BANDS) {
    if (y >= band && y <= band + 2) {
      if (y === band + 1 && u % 5 === 2) {
        return IRON_LIGHT;
      }
      return y === band + 2 ? OUTLINE : IRON;
    }
  }
  // A ring to pull, on each leaf beside the meeting edge.
  const ring = Math.hypot(u + 0.5 - (LEAF - 5), y + 0.5 - 30);
  if (ring <= 2.6 && ring >= 1.4) {
    return IRON_LIGHT;
  }
  // Planks, upright, with a groove between each.
  if (u % 6 === 0) {
    return GROOVE;
  }
  return u % 6 === 1 ? OAK_LIGHT : u % 6 === 5 ? OAK_DEEP : OAK;
}

/** Darker by a share, for a leaf turned away from the light. */
const shaded = (ink: Rgb, by: number): Rgb => [ink[0] * (1 - by), ink[1] * (1 - by), ink[2] * (1 - by)];

/**
 * The doors `share` open, as a picture the size of the opening. Each leaf swings
 * back on its hinge at the jamb, away from whoever is looking, so it narrows
 * towards the jamb and darkens as it turns; what it uncovers is the hall's art
 * under it, the way through. Shut, a line of the hall's light shows where they
 * meet and under their feet.
 */
export function paintDoors(share: number): PaintedPicture {
  const { width, height } = DOOR_OPENING;
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, ink: Rgb): void => {
    const at = (y * width + x) * 4;
    data[at] = ink[0];
    data[at + 1] = ink[1];
    data[at + 2] = ink[2];
    data[at + 3] = 255;
  };
  // Back against the walls of the way through they still show their edge, never nothing.
  const turned = Math.max(0, Math.min(1, share)) * (Math.PI / 2) * 0.86;
  const seen = Math.max(4, Math.round(LEAF * Math.cos(turned)));
  const shade = Math.min(0.6, share * 0.7);
  for (const hinge of [0, 1]) {
    for (let across = 0; across < seen; across += 1) {
      // Which column of the leaf's own face this column of the picture shows.
      const u = Math.min(LEAF - 1, Math.floor(((across + 0.5) * LEAF) / seen));
      const x = hinge === 0 ? across : width - 1 - across;
      for (let y = 0; y < height; y += 1) {
        const ink = leafInk(u, y, hinge);
        if (ink) {
          // The far edge turns furthest from the light.
          put(x, y, shaded(ink, shade * (0.6 + (0.4 * across) / seen)));
        }
      }
    }
  }
  if (share === 0) {
    for (let y = 2; y < height - 1; y += 1) {
      if (y % 7 !== 3) {
        put(LEAF - 1, y, LIGHT);
      }
    }
    for (let x = 2; x < width - 2; x += 1) {
      put(x, height - 1, x % 5 === 0 ? GOLD : LIGHT);
    }
  }
  return { width, height, data };
}

/** Every step of the swing side by side, `DOOR_FRAMES` across: one texture the view slices. */
export function paintDoorStrip(): PaintedPicture {
  const { width, height } = DOOR_OPENING;
  const data = new Uint8ClampedArray(width * DOOR_FRAMES * height * 4);
  for (let frame = 0; frame < DOOR_FRAMES; frame += 1) {
    const picture = paintDoors(frame / (DOOR_FRAMES - 1));
    for (let y = 0; y < height; y += 1) {
      data.set(picture.data.subarray(y * width * 4, (y + 1) * width * 4), (y * width * DOOR_FRAMES + frame * width) * 4);
    }
  }
  return { width: width * DOOR_FRAMES, height, data };
}

/** How far the hall's light reaches out across the tunnel's floor from the open doors, and how far it spreads either side. */
export const DOOR_LIGHT_REACH = 36;
export const DOOR_LIGHT_SPREAD = 16;

/** Where the picture of the doors' light stands in the hall: from the opening's top, as wide as it spreads. */
export const DOOR_LIGHT_ORIGIN = { x: DOOR_OPENING.left - DOOR_LIGHT_SPREAD, y: DOOR_OPENING.top } as const;

/**
 * The hall's light through the open doors: filling the way through, and thrown out
 * across the tunnel's floor in a fan that fades as it goes, in a few hard steps of
 * strength as FireRed lights a doorway - never a soft blur, and never a dither,
 * which over the runner's own weave read as a screen door. The view fades it in
 * with the swing and lays it over the floor, under everybody.
 */
export function paintDoorLight(): PaintedPicture {
  const width = DOOR_OPENING.width + DOOR_LIGHT_SPREAD * 2;
  const height = DOOR_OPENING.height + DOOR_LIGHT_REACH;
  const data = new Uint8ClampedArray(width * height * 4);
  const foot = DOOR_OPENING.height;
  const steps = 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const hallX = DOOR_LIGHT_ORIGIN.x + x;
      const hallY = DOOR_LIGHT_ORIGIN.y + y;
      const out = (y - foot) / DOOR_LIGHT_REACH;
      const across = Math.abs(x + 0.5 - width / 2) / (DOOR_OPENING.width / 2 + out * DOOR_LIGHT_SPREAD);
      const strength =
        y < foot ? (inDoorOpening(hallX, hallY) ? 1 : 0) : across < 1 ? (1 - out) * (1 - across * across * 0.7) : 0;
      const stepped = Math.ceil(strength * steps) / steps;
      if (stepped > 0) {
        const at = (y * width + x) * 4;
        data[at] = LIGHT[0];
        data[at + 1] = LIGHT[1];
        data[at + 2] = LIGHT[2];
        data[at + 3] = Math.round(stepped * 255);
      }
    }
  }
  return { width, height, data };
}
