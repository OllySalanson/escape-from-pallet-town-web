import type { PaintedPicture } from '../world/minimap';
import { ARENA_CENTRE, dithered, podiumHole } from './arenaHall';

/**
 * What lives in THE RAID ARENA's pit, which is never explained. Now and then the
 * shadow of something very large slides across the vale, under the player and
 * over the cloud; now and then two eyes open behind the bars of a gate in the pit
 * wall, look about and are gone. Nobody says a word about either, and neither is
 * in the game anywhere else: the point is somebody stopping at the rail to say
 * "what was that?". Phaser-free, so all of it can be asked of a number;
 * `arenaView.ts` draws it.
 */

/** How long it is before the first of each, and then between them, in milliseconds. */
const SHADOW_FIRST_MS = [25000, 45000] as const;
const SHADOW_AFTER_MS = [70000, 80000] as const;
const EYES_FIRST_MS = [15000, 30000] as const;
const EYES_AFTER_MS = [50000, 60000] as const;

/** How long until the next, given a roll in [0, 1). */
export const nextShadowInMs = (roll: number, first: boolean): number => {
  const [least, spread] = first ? SHADOW_FIRST_MS : SHADOW_AFTER_MS;
  return least + roll * spread;
};
export const nextEyesInMs = (roll: number, first: boolean): number => {
  const [least, spread] = first ? EYES_FIRST_MS : EYES_AFTER_MS;
  return least + roll * spread;
};

// --- the shadow --------------------------------------------------------------

/** How far the shadow slides for where the player stands: it is well above the floor and a long way under the rail. */
export const SHADOW_PARALLAX = 0.4;
/** How much bigger than its drawing it is painted. */
const SHADOW_SCALE = 1.5;
const SHADOW_INK = [8, 12, 28] as const;
/** How much of what is under it shows through: it is a shadow, on a dither. */
const SHADOW_DENSITY = 0.66;

const SHADOW_FRAMES = 3;
export const SHADOW_WIDTH = 184;
export const SHADOW_HEIGHT = 152;

type Point = readonly [number, number];

/** It faces east, from above. One side of the body, nose to the tip of the tail; the other is its mirror. */
const BODY: readonly Point[] = [
  [36, 0],
  [31, -3],
  [27, -3],
  [21, -8],
  [24, -2],
  [14, -3],
  [6, -7],
  [-10, -5],
  [-24, -2],
  [-44, -1],
  [-50, -4],
  [-57, 0],
];

/** One wing, spread: the leading edge out to the first finger, then back along the fingers. */
const WING: readonly Point[] = [
  [10, -5],
  [15, -24],
  [9, -30],
  [-12, -50],
  [-15, -33],
  [-27, -43],
  [-25, -25],
  [-38, -28],
  [-28, -14],
  [-10, -5],
];

/** A wing as a flap has it: how far across it reaches, and how far it has swept back. */
const WING_FLAP: readonly { readonly across: number; readonly back: number }[] = [
  { across: 1, back: 0 },
  { across: 0.76, back: 5 },
  { across: 0.5, back: 11 },
];

const insidePolygon = (polygon: readonly Point[], x: number, y: number): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[j];
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) {
      inside = !inside;
    }
  }
  return inside;
};

/** The body as a closed outline, both sides. */
const WHOLE_BODY: readonly Point[] = [...BODY, ...[...BODY].reverse().map(([x, y]): Point => [x, -y])];

/** The shadow's frames side by side, each `SHADOW_WIDTH` wide, wings wide open first. */
export function paintWingShadow(): PaintedPicture {
  const width = SHADOW_WIDTH * SHADOW_FRAMES;
  const height = SHADOW_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  WING_FLAP.forEach(({ across, back }, frame) => {
    const wing: readonly Point[] = WING.map(([x, y], index) => [x - (index === 0 ? 0 : back), y * across]);
    for (let py = 0; py < height; py += 1) {
      const y = (py + 0.5 - height / 2) / SHADOW_SCALE;
      for (let px = 0; px < SHADOW_WIDTH; px += 1) {
        const x = (px + 0.5 - SHADOW_WIDTH / 2) / SHADOW_SCALE;
        const solid = insidePolygon(WHOLE_BODY, x, y) || insidePolygon(wing, x, y) || insidePolygon(wing, x, -y);
        const sheetX = frame * SHADOW_WIDTH + px;
        if (solid && dithered(SHADOW_DENSITY, sheetX, py)) {
          const at = (py * width + sheetX) * 4;
          data[at] = SHADOW_INK[0];
          data[at + 1] = SHADOW_INK[1];
          data[at + 2] = SHADOW_INK[2];
          data[at + 3] = 255;
        }
      }
    }
  });
  return { width, height, data };
}

/** How fast it crosses, in pixels a second: unhurried, for something that size so far down. */
const SHADOW_SPEED = 62;
/** How far off its line it wanders, and over how long. */
const SHADOW_WANDER = 18;
const SHADOW_WANDER_MS = 3400;
/** It beats its wings a few times, then holds them out a long while. */
const FLAP_STEP_MS = 240;
const FLAP_BEATS = [0, 1, 2, 2, 1, 0, 1, 2, 2, 1] as const;
const GLIDE_MS = 3200;

/** A crossing of the pit, from one side of the hole to the other. */
export interface ShadowPass {
  /** Which way it is going. */
  readonly east: boolean;
  /** The line it holds, as a point of the hall at rest. */
  readonly y: number;
}

/**
 * A pass along the line a player can see: `lookingAtY` is the middle of the view,
 * kept inside the hole, so a thing so rare is not spent on a part of the pit that
 * is off the screen.
 */
export function shadowPassFor(lookingAtY: number, east: boolean): ShadowPass {
  const hole = podiumHole();
  const within = hole.ry - SHADOW_HEIGHT / 2;
  return { east, y: Math.max(hole.y - within, Math.min(hole.y + within, Math.round(lookingAtY))) };
}

export const SHADOW_PASS_MS = ((podiumHole().rx * 2 + SHADOW_WIDTH * 2) / SHADOW_SPEED) * 1000;

/** Where a pass has got to: the middle of the shadow, at rest, its frame, or null once it is over. */
export function shadowAt(pass: ShadowPass, elapsedMs: number): { readonly x: number; readonly y: number; readonly frame: number } | null {
  if (elapsedMs >= SHADOW_PASS_MS) {
    return null;
  }
  const hole = podiumHole();
  const reach = hole.rx + SHADOW_WIDTH;
  const travelled = (elapsedMs / 1000) * SHADOW_SPEED - reach;
  const beats = FLAP_BEATS.length * FLAP_STEP_MS;
  const inCycle = elapsedMs % (beats + GLIDE_MS);
  return {
    x: Math.round(hole.x + (pass.east ? travelled : -travelled)),
    y: Math.round(pass.y + Math.sin(elapsedMs / SHADOW_WANDER_MS) * SHADOW_WANDER),
    frame: inCycle < beats ? FLAP_BEATS[Math.floor(inCycle / FLAP_STEP_MS)] : 0,
  };
}

// --- the eyes ----------------------------------------------------------------

/** How many gates stand round the pit wall (`paintPodium`). */
export const PIT_GATES = 18;
/** Eyes only look out of gates near enough to face-on for the bars to have gaps two pixels wide. */
const EYE_GATES: readonly number[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
/** How far up a gate they are, from its sill: about the height of something crouching. */
const EYES_UP_THE_GATE = 8;

/** Where in a gate its eyes look out of, as a point of the hall at rest: the bar between them. */
export function gateEyes(gate: number): { readonly x: number; readonly y: number } {
  const hole = podiumHole();
  const angle = ((gate + 0.5) / PIT_GATES) * Math.PI - Math.PI / 2;
  const across = Math.sin(angle);
  return {
    x: Math.round(hole.x + across * hole.rx),
    y: Math.round(hole.y - Math.cos(angle) * hole.ry) - EYES_UP_THE_GATE,
  };
}

/** Which of the gates there are to look out of, for a roll in [0, 1) and a test of whether one can be seen. */
export function chooseEyeGate(roll: number, canBeSeen: (point: { readonly x: number; readonly y: number }) => boolean): number | null {
  const seen = EYE_GATES.filter((gate) => canBeSeen(gateEyes(gate)));
  return seen.length === 0 ? null : seen[Math.floor(roll * seen.length)];
}

export type EyesLook = 'slit' | 'open' | 'shut';

/** A look out of a gate: opening, a stare, a blink, a stare a pixel over, and closing. Null once it is over. */
export const EYES_MS = 3600;
export function eyesAt(elapsedMs: number): { readonly look: EyesLook; readonly shift: number } | null {
  if (elapsedMs < 0 || elapsedMs >= EYES_MS) {
    return null;
  }
  if (elapsedMs < 240) {
    return { look: 'slit', shift: 0 };
  }
  if (elapsedMs < 1500) {
    return { look: 'open', shift: 0 };
  }
  if (elapsedMs < 1620) {
    return { look: 'shut', shift: 0 };
  }
  if (elapsedMs < 1740) {
    return { look: 'slit', shift: 0 };
  }
  if (elapsedMs < 3300) {
    return { look: 'open', shift: -1 };
  }
  return { look: 'slit', shift: -1 };
}

const EYE_ROWS: Readonly<Record<EyesLook, readonly string[]>> = {
  open: ['yy.yy', 'rr.rr'],
  slit: ['.....', 'dd.dd'],
  shut: ['.....', '.....'],
};
const EYE_INKS: Readonly<Record<string, readonly [number, number, number]>> = {
  y: [248, 208, 72],
  r: [216, 72, 24],
  d: [136, 48, 24],
};
export const EYES_WIDTH = 5;
export const EYES_HEIGHT = 2;
export const EYE_LOOKS: readonly EyesLook[] = ['open', 'slit', 'shut'];

/** The eyes' looks side by side, in the order of `EYE_LOOKS`. */
export function paintEyes(): PaintedPicture {
  const width = EYES_WIDTH * EYE_LOOKS.length;
  const data = new Uint8ClampedArray(width * EYES_HEIGHT * 4);
  EYE_LOOKS.forEach((look, frame) =>
    EYE_ROWS[look].forEach((row, y) => {
      [...row].forEach((char, x) => {
        const ink = EYE_INKS[char];
        if (ink) {
          const at = (y * width + frame * EYES_WIDTH + x) * 4;
          data[at] = ink[0];
          data[at + 1] = ink[1];
          data[at + 2] = ink[2];
          data[at + 3] = 255;
        }
      });
    }),
  );
  return { width, height: EYES_HEIGHT, data };
}

/** Which half of the hall is the far side, where a gate's face can be seen at all. */
export const facesTheViewer = (point: { readonly y: number }): boolean => point.y < ARENA_CENTRE.y;
