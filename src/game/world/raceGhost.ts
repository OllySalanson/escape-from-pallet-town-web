import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';

/**
 * Your best run, raced again: a see-through you that walks the line you took
 * when you set your best time, at the times you took it.
 *
 * A race against the racer is close only for somebody who does not know the
 * map - once the reeds' dry way is found the racer is seven seconds behind and
 * never seen again. What a player who knows the map races is themself: the
 * best time they ever set, which is a figure on the screen beside them rather
 * than a number at the end. So a run that sets a best keeps where it went and
 * when (`RaceTrail`), the save keeps the best one (`RaceRecord.ghost`), and the
 * next race draws it.
 *
 * Like the racer it is a schedule, never a walker: where it is comes from the
 * race clock alone. Phaser-free.
 */

/** A run as the tiles the player arrived on: `[x, y, clockMs, x, y, clockMs, ...]`, the start at 0. */
export type RaceTrail = readonly number[];

/** The most a trail keeps: a race ten times the length of any course still fits. */
export const MOST_TRAIL_TILES = 1200;

/** The trail so far with one more tile arrived on, unless the player is still on the last one. */
export function trailWith(trail: readonly number[], tile: GridPosition, clockMs: number): number[] {
  const last = trail.length - 3;
  if (last >= 0 && trail[last] === tile.x && trail[last + 1] === tile.y) {
    return [...trail];
  }
  if (trail.length / 3 >= MOST_TRAIL_TILES) {
    return [...trail];
  }
  return [...trail, tile.x, tile.y, Math.round(clockMs)];
}

/** A trail read back from a save: whole triples of whole numbers, in time order, or nothing. */
export function readTrail(value: unknown): RaceTrail | undefined {
  if (!Array.isArray(value) || value.length < 6 || value.length % 3 !== 0 || value.length / 3 > MOST_TRAIL_TILES) {
    return undefined;
  }
  if (!value.every((entry) => Number.isInteger(entry) && entry >= 0)) {
    return undefined;
  }
  for (let index = 5; index < value.length; index += 3) {
    if (value[index] < value[index - 3]) return undefined;
  }
  return value as number[];
}

export interface GhostPlace {
  /** Where to draw it, in tiles, part-way between two when it is stepping. */
  readonly x: number;
  readonly y: number;
  readonly facing: 'up' | 'down' | 'left' | 'right';
  readonly stepping: boolean;
  /** It has crossed: the run is over and it fades. */
  readonly done: boolean;
}

/**
 * Where the best run was `clockMs` into the race. A tile arrived on at `t` was
 * stepped onto over the step before it, so between two arrivals the ghost
 * stands, then walks the last step's worth of the gap.
 */
export function ghostPlace(trail: RaceTrail, clockMs: number): GhostPlace {
  const count = trail.length / 3;
  const at = (index: number) => ({ x: trail[index * 3], y: trail[index * 3 + 1], t: trail[index * 3 + 2] });
  let index = 0;
  while (index + 1 < count && at(index + 1).t <= clockMs) index += 1;
  const here = at(index);
  if (index + 1 >= count) {
    return { x: here.x, y: here.y, facing: facingBetween(at(Math.max(0, index - 1)), here), stepping: false, done: true };
  }
  const next = at(index + 1);
  const stepMs = Math.min(STEP_DURATION_MS, next.t - here.t);
  const startsAt = next.t - stepMs;
  const facing = facingBetween(here, next);
  if (clockMs < startsAt || stepMs <= 0) {
    return { x: here.x, y: here.y, facing, stepping: false, done: false };
  }
  const share = (clockMs - startsAt) / stepMs;
  return { x: here.x + (next.x - here.x) * share, y: here.y + (next.y - here.y) * share, facing, stepping: true, done: false };
}

function facingBetween(from: GridPosition, to: GridPosition): GhostPlace['facing'] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return 'down';
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy < 0 ? 'up' : 'down';
}

/** The time the trail crossed in: its last arrival. */
export function trailTime(trail: RaceTrail): number {
  return trail[trail.length - 1] ?? 0;
}
