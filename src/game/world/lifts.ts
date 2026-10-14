import type { GridLink, GridPosition } from '../movement/gridMovement';
import type { MapFileArea } from './mapFile';
import type { PlacedArea } from './mapAreas';
import type { WorldSwitch } from './switches';

/**
 * A lift: FireRed's Rocket Hideout elevator, as one doorway on every floor it
 * stops at.
 *
 * Its door is let into a floor's back wall, and pressing up into it from the
 * tile in front asks FireRed's question - "Which floor do you want?" - with
 * every floor it stops at offered and the cursor on this one, as FireRed's
 * panel offers them. Choose another and the lift goes there: the doors shut,
 * the car shakes as FireRed's does, and the player steps out of the same door
 * on the floor chosen, facing away from it. It is the only way onto a floor
 * with no stairs, which is what makes it the hard part of a place.
 *
 * A lift a switch names (`MapFileSwitch.opens`) is dead until every switch
 * naming it is thrown - the generator on one floor runs it on all of them, for
 * the rest of the raid, as a barrier is opened (`switches.ts`) - and a lift no
 * switch names always runs.
 *
 * It is a way only the player takes, as a boat is (`sailing.ts`): the hunter
 * walks the floors and the stairs and never rides, so a lift is never one of
 * the map's `links`. It is not a safe box for that: a hunter arriving while
 * the player is on a floor arrives on that floor, at its walking distance, as
 * it does anywhere. Whatever asks where a player can get to reads a lift
 * through `playerLinks` - as a ring, floor to the next floor and the last back
 * to the first, because a search's way through a tile goes one place, and a
 * ring reaches every floor from every other.
 */
export interface MapLift {
  /** Its name in the file, which its stops and its switches share. */
  readonly id: string;
  /** Every floor it stops at, in the order the file lists them. */
  readonly stops: readonly LiftStop[];
}

export interface LiftStop {
  /** The area it stops in. */
  readonly area: string;
  /** What that floor is called, which is what the panel offers. */
  readonly name: string;
  /** The tile in front of its door, on the grid the map is played on. */
  readonly landing: GridPosition;
}

/** The way a lift's door is pressed into: up, into the back wall. */
export const LIFT_TOWARD = 'up' as const;

/** A file's lifts on the grid its areas are laid out in. */
export function liftsOf(areas: readonly MapFileArea[], placed: readonly PlacedArea[]): MapLift[] {
  const lifts = new Map<string, LiftStop[]>();
  for (const area of areas) {
    const stop = area.lift;
    const rect = placed.find((candidate) => candidate.id === area.id)?.rect;
    if (!stop || !rect) {
      continue;
    }
    const stops = lifts.get(stop.lift) ?? [];
    stops.push({
      area: area.id,
      name: area.name,
      landing: { x: rect.x + stop.x, y: rect.y + stop.y },
    });
    lifts.set(stop.lift, stops);
  }
  return [...lifts].map(([id, stops]) => ({ id, stops }));
}

/** The lift whose door the player standing on `tile` and pressing `toward` is pressing into, and which stop it is. */
export function liftAt(
  lifts: readonly MapLift[] | undefined,
  tile: GridPosition,
  toward: string,
): { readonly lift: MapLift; readonly stop: number } | undefined {
  if (toward !== LIFT_TOWARD) {
    return undefined;
  }
  for (const lift of lifts ?? []) {
    const stop = lift.stops.findIndex(
      (candidate) => candidate.landing.x === tile.x && candidate.landing.y === tile.y,
    );
    if (stop >= 0) {
      return { lift, stop };
    }
  }
  return undefined;
}

/** Whether a lift runs: every switch that names it thrown, or none names it. */
export function liftRuns(
  lift: string,
  switches: readonly WorldSwitch[],
  thrown: readonly string[],
): boolean {
  return switches
    .filter((candidate) => candidate.opens === lift)
    .every((candidate) => thrown.includes(candidate.id));
}

/** Whether any switch names a lift, so that it starts the raid dead. */
export function liftNeedsPower(
  lift: string,
  switches: readonly { readonly opens: string }[],
): boolean {
  return switches.some((candidate) => candidate.opens === lift);
}

/** Every lift as the ways through a player can take: each floor to the next, and the last back to the first. */
export function liftLinks(lifts: readonly MapLift[] | undefined): GridLink[] {
  return (lifts ?? []).flatMap((lift) =>
    lift.stops.map((stop, index) => ({
      from: stop.landing,
      toward: LIFT_TOWARD,
      to: lift.stops[(index + 1) % lift.stops.length].landing,
    })),
  );
}

/**
 * What the panel says and offers: FireRed's own question (`Text_WantWhichFloor`)
 * and its list - every floor, then EXIT - with the cursor on the floor the
 * player is on, as `multichoicedefault` puts it. A floor is listed by what
 * tells it from the others, as FireRed's panel lists B1F rather than the
 * hideout's whole name: words every floor's name starts with are left off.
 */
export function floorPrompt(
  lift: MapLift,
  here: number,
): {
  readonly lines: readonly string[];
  readonly options: readonly string[];
  readonly selected: number;
} {
  const names = lift.stops.map((stop) => stop.name.toUpperCase().split(' '));
  let shared = 0;
  while (names.every((words) => words.length > shared + 1 && words[shared] === names[0][shared])) {
    shared += 1;
  }
  return {
    lines: ['Which floor do you want?'],
    options: [...names.map((words) => words.slice(shared).join(' ')), 'EXIT'],
    selected: here,
  };
}

/**
 * What a dead lift says when its door is pressed, in FireRed's word for it -
 * the hideout's grunt asks "The elevator doesn't work?" - and why: FireRed's
 * wants its Lift Key, and this one wants its power.
 */
export const DEAD_LIFT_LINES: readonly string[] = [
  "The elevator doesn't work...",
  "There's no power. Somewhere down here a generator has stopped.",
];

/** What a thrown switch says when it runs a lift, from wherever it was thrown. */
export const LIFT_RUNNING_LINES: readonly string[] = [
  'The generator roared into life!',
  'Somewhere, an elevator started up.',
];
