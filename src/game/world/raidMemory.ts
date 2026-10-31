import type { GridPosition } from '../movement/gridMovement';

/**
 * What the pit in THE RAID ARENA remembers of the raids that went down into it:
 * a mark where each of the last dozen ended (a cross where it was lost, a flag
 * where it got out) and the walk of the very last. It is what makes the map at the
 * bottom of the pit a player's own: "that is where I lost Charizard".
 *
 * It is read by nothing but the hall, and asks nothing of the raid but where it
 * walked. `raidProgress.raidMemory` is optional with an empty default, so no save
 * version bump; a mark's line is written when the raid ends and never worked out
 * again, because the Pokemon it names may be long gone. Phaser-free.
 */

export type RaidMarkKind = 'fell' | 'out';

export interface RaidMark {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly kind: RaidMarkKind;
  /** What the rim says about it, in capitals. */
  readonly line: string;
}

export interface RaidMemory {
  /** Oldest first. */
  readonly marks: readonly RaidMark[];
  /** The last raid's walk, as x then y over and over. */
  readonly trail?: { readonly mapId: string; readonly points: readonly number[] };
}

/** How many raids' ends are kept, and how the walk is sampled: one tile in so many, so far. */
export const MARKS_KEPT = 12;
const TRAIL_EVERY = 3;
const TRAIL_MOST = 260;
const LINE_LONGEST = 40;

/** A raid's walk so far: kept on the raid's session, because the world is rebuilt after every fight. */
export interface RaidWalk {
  readonly points: number[];
  last: GridPosition | null;
  steps: number;
}

export const newWalk = (): RaidWalk => ({ points: [], last: null, steps: 0 });

/** A step on the outdoors of the map, written down. An inside is not on the picture, so it is never handed one. */
export function noteWalked(walk: RaidWalk, tile: GridPosition): void {
  walk.last = { x: tile.x, y: tile.y };
  if (walk.steps % TRAIL_EVERY === 0) {
    if (walk.points.length >= TRAIL_MOST * 2) {
      // Thinned rather than cut off: the end of a raid is the part worth keeping.
      const kept = walk.points.filter((_value, index) => Math.floor(index / 2) % 2 === 0);
      walk.points.length = 0;
      walk.points.push(...kept);
    }
    walk.points.push(tile.x, tile.y);
  }
  walk.steps += 1;
}

export const fellLine = (name: string): string => `${name.toUpperCase()} FELL HERE`.slice(0, LINE_LONGEST);
export const clockLine = (): string => 'THE CLOCK RAN OUT HERE';
export const outLine = (exit: string): string => `OUT BY ${exit.toUpperCase()}`.slice(0, LINE_LONGEST);

/** What a raid that has just ended leaves behind it. A raid that never set foot outdoors leaves nothing. */
export function remembering(
  memory: RaidMemory | undefined,
  mapId: string,
  walk: RaidWalk | undefined,
  ending: { readonly kind: RaidMarkKind; readonly line: string },
): RaidMemory | undefined {
  if (!walk?.last) {
    return memory;
  }
  const mark: RaidMark = { mapId, x: walk.last.x, y: walk.last.y, ...ending };
  return {
    marks: [...(memory?.marks ?? []), mark].slice(-MARKS_KEPT),
    trail: { mapId, points: [...walk.points, walk.last.x, walk.last.y] },
  };
}

const whole = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** Back out of a save, keeping only what is one. */
export function readRaidMemory(value: unknown): RaidMemory | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { marks, trail } = value as { marks?: unknown; trail?: unknown };
  const read: RaidMark[] = (Array.isArray(marks) ? marks : []).flatMap((mark: Partial<RaidMark> | null) =>
    mark &&
    typeof mark.mapId === 'string' &&
    whole(mark.x) &&
    whole(mark.y) &&
    (mark.kind === 'fell' || mark.kind === 'out') &&
    typeof mark.line === 'string'
      ? [{ mapId: mark.mapId, x: mark.x, y: mark.y, kind: mark.kind, line: mark.line.slice(0, LINE_LONGEST) }]
      : [],
  );
  const walked = trail as { mapId?: unknown; points?: unknown } | null | undefined;
  const points = Array.isArray(walked?.points) ? walked.points.filter(whole).slice(0, TRAIL_MOST * 2 + 2) : [];
  return {
    marks: read.slice(-MARKS_KEPT),
    ...(typeof walked?.mapId === 'string' && points.length >= 2 ? { trail: { mapId: walked.mapId, points: points.slice(0, points.length - (points.length % 2)) } } : {}),
  };
}

/** The marks on one map, each with how old it is: 0 is the raid just gone. */
export function marksOn(memory: RaidMemory | undefined, mapId: string): readonly (RaidMark & { readonly age: number })[] {
  const marks = memory?.marks ?? [];
  return marks.flatMap((mark, index) => (mark.mapId === mapId ? [{ ...mark, age: marks.length - 1 - index }] : []));
}

/** The dots of the last raid's walk on a map, every other one, so it reads as a dotted line. */
export function trailDots(memory: RaidMemory | undefined, mapId: string): readonly GridPosition[] {
  const trail = memory?.trail;
  if (trail?.mapId !== mapId) {
    return [];
  }
  const dots: GridPosition[] = [];
  for (let at = 0; at + 1 < trail.points.length; at += 2) {
    dots.push({ x: trail.points[at], y: trail.points[at + 1] });
  }
  return dots;
}
