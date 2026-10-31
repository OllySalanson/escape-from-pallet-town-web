import type { Minimap } from '../world/minimap';
import { pitFrameFor, scatter } from './arenaHall';
import type { WindowLight } from './homeClock';

/**
 * THE RAID ARENA's pit keeps the player's own hours, the same clock a raid's night
 * and THE BOLTHOLE's window read (`homeClock.ts`), so what is down there is what a
 * jump would land in: a bright vale by day, gold at dusk, and at night a dark one
 * with a little warm light at the doors of the towns. Lights show only on ground
 * this save has walked. Phaser-free; `arenaPit.ts` paints from it, `arenaView.ts`
 * twinkles it.
 */

type Rgb = readonly [number, number, number];

/** What part of the floor an ink is, because the hours do not fall on all of it alike. */
export type FloorPart = 'ground' | 'cloud' | 'under';

/** Multiplied in, channel by channel, for each hour. */
const HOURS: Readonly<Record<WindowLight, Readonly<Record<FloorPart, Rgb>>>> = {
  day: {
    ground: [1.06, 1.08, 1.04],
    cloud: [1.4, 1.34, 1.26],
    under: [1.3, 1.34, 1.3],
  },
  dusk: {
    ground: [0.98, 0.76, 0.62],
    cloud: [1.32, 0.98, 0.84],
    under: [0.92, 0.72, 0.74],
  },
  night: {
    ground: [0.3, 0.36, 0.58],
    cloud: [0.46, 0.52, 0.76],
    under: [0.42, 0.48, 0.72],
  },
};

/** An ink at an hour, still a colour the GBA could draw: 15-bit, a step of eight. */
export function inkAtHour(ink: Rgb, part: FloorPart, light: WindowLight): Rgb {
  const [red, green, blue] = HOURS[light][part];
  const step = (value: number): number => Math.min(248, Math.round(value / 8) * 8);
  return [step(ink[0] * red), step(ink[1] * green), step(ink[2] * blue)];
}

/** A tile with something people live or work at on it, as the map says: a door, a landmark. */
export interface TownLight {
  /** Its place on the floor's picture, in pixels. */
  readonly x: number;
  readonly y: number;
  /** A warmer or a paler one: not every window burns the same. */
  readonly warm: boolean;
}

/** The floor's picture is this many pixels across, and the map sits in the middle of it. */
export function townLights(
  picture: Pick<Minimap, 'width' | 'height' | 'rows'>,
  places: readonly { readonly x: number; readonly y: number }[],
  isKnown: (char: string | undefined) => boolean,
  floorSize: number,
  light: WindowLight,
): readonly TownLight[] {
  if (light === 'day') {
    return [];
  }
  const frame = pitFrameFor(picture.width, picture.height);
  const left = (floorSize - frame.width * frame.scale) / 2;
  const top = (floorSize - frame.height * frame.scale) / 2;
  const seen = new Set<number>();
  const lights: TownLight[] = [];
  for (const place of places) {
    const key = place.y * picture.width + place.x;
    if (seen.has(key) || place.x >= picture.width || place.y >= picture.height) {
      continue;
    }
    seen.add(key);
    // At dusk only some are lit yet.
    if (!isKnown(picture.rows[place.y]?.[place.x]) || (light === 'dusk' && scatter(place.x, place.y) > 0.5)) {
      continue;
    }
    lights.push({
      x: Math.round(left + (place.x + 0.5) * frame.scale),
      y: Math.round(top + (place.y + 0.5) * frame.scale),
      warm: scatter(place.y, place.x) < 0.7,
    });
  }
  return lights;
}

/** How often a twinkle goes through the lights, and how many are dimmed at any one time. */
export const TWINKLE_STEP_MS = 180;
const DIMMED_SHARE = 0.1;

/** Whether a light is dimmed on this beat: each on its own, a very little. */
export const isDimmed = (index: number, beat: number): boolean => scatter(index + 3, beat % 64) < DIMMED_SHARE;
