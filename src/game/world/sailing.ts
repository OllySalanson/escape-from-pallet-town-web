import {
  DIRECTION_DELTAS,
  linkTable,
  type Direction,
  type GridLink,
  type GridLinks,
  type GridPosition,
} from '../movement/gridMovement';
import type { MapFileLink } from './mapFile';
import { liftLinks, type MapLift } from './lifts';

/**
 * A boat between two jetties: the one way onto a place the sea cuts off.
 *
 * A boat is a map file's link whose two ends are `boat` jetties outdoors
 * (`MapFileSailing`): stand on a jetty, press out to sea where the boat lies,
 * and while the tide lets it sail it carries you tile by tile along its course
 * to the jetty at the other end. Nothing is warped: every tile of the water
 * is a step, charged to the raid clock as a walked tile is, and the player is
 * on each tile of it in turn.
 *
 * It is a route only the player has, as a ledge is (`ledges.ts`): the hunter
 * walks the ground and the doors, never the water, so a boat is the one way
 * to put the sea between you and it. That is why a sailing is never one of
 * the map's `links`, which every search walks, the hunter's included: the
 * checks that ask where a player can get to add `sailingLinks` to them, and
 * nothing that asks where the hunter can get to does.
 */
export interface MapSailing {
  /** What the boat is called, on its caption and in its lines. */
  readonly name: string;
  /** Its two jetties, in the order the file lists them. */
  readonly ends: readonly [SailingEnd, SailingEnd];
  /**
   * Every tile it crosses, from the first end's boat to the second's, both
   * included, each a step from the last.
   */
  readonly course: readonly GridPosition[];
  /** When it sails, in milliseconds into a raid: from, and until. */
  readonly runsFromMs: number;
  readonly runsUntilMs: number;
}

export interface SailingEnd {
  /** The jetty tile it is boarded from, and come ashore on. */
  readonly landing: GridPosition;
  /** The way pressed from the jetty to board: out to sea. */
  readonly toward: Direction;
  /** Where the boat lies, the water tile in front of the jetty. */
  readonly boat: GridPosition;
}

/** Whether a boat is sailing at this point in a raid. */
export type SailingState = 'not-yet' | 'sailing' | 'gone';

export function sailingState(sailing: MapSailing, elapsedMs: number): SailingState {
  if (elapsedMs < sailing.runsFromMs) {
    return 'not-yet';
  }
  return elapsedMs < sailing.runsUntilMs ? 'sailing' : 'gone';
}

/** A boat as the grid it is played on has it, from a file's link and where its outdoors lie. */
export function sailingOf(
  link: MapFileLink,
  toGrid: (tile: GridPosition) => GridPosition = (tile) => tile,
): MapSailing {
  const sails = link.sails;
  if (!sails) {
    throw new Error('a boat link says when it sails and where');
  }
  const ends = link.ends.map((end) => {
    const landing = toGrid({ x: end.x, y: end.y });
    const delta = DIRECTION_DELTAS[end.toward];
    return { landing, toward: end.toward, boat: { x: landing.x + delta.x, y: landing.y + delta.y } };
  }) as unknown as readonly [SailingEnd, SailingEnd];
  const turns = sails.course.map((turn) => toGrid(turn));
  return {
    name: sails.name,
    ends,
    course: coursePath([ends[0].boat, ...turns, ends[1].boat]),
    runsFromMs: sails.from * 1_000,
    runsUntilMs: sails.until * 1_000,
  };
}

/**
 * The tiles of a course through its turns, each a step from the last: a
 * straight line from each turn to the next. A leg that is not straight - two
 * turns that share neither a row nor a column - is walked along its row first
 * and then its column, which `courseFaults` reports, because a boat that sails
 * diagonally is a course nobody drew.
 */
export function coursePath(turns: readonly GridPosition[]): GridPosition[] {
  const path: GridPosition[] = turns.length > 0 ? [{ ...turns[0] }] : [];
  for (let index = 1; index < turns.length; index += 1) {
    const to = turns[index];
    let at = path[path.length - 1];
    while (at.x !== to.x) {
      at = { x: at.x + Math.sign(to.x - at.x), y: at.y };
      path.push(at);
    }
    while (at.y !== to.y) {
      at = { x: at.x, y: at.y + Math.sign(to.y - at.y) };
      path.push(at);
    }
  }
  return path;
}

/** What is wrong with a course: a leg that is not a straight line. */
export function courseFaults(turns: readonly GridPosition[]): string[] {
  const faults: string[] = [];
  for (let index = 1; index < turns.length; index += 1) {
    const [from, to] = [turns[index - 1], turns[index]];
    if (from.x !== to.x && from.y !== to.y) {
      faults.push(`turns from ${from.x},${from.y} to ${to.x},${to.y} without sailing straight`);
    }
  }
  return faults;
}

/**
 * The boat at a jetty, if the player standing on `tile` and pressing `toward`
 * is pressing into one: which boat, and which of its ends they are at.
 */
export function boatAt(
  sailings: readonly MapSailing[] | undefined,
  tile: GridPosition,
  toward: Direction,
): { readonly sailing: MapSailing; readonly from: 0 | 1 } | undefined {
  for (const sailing of sailings ?? []) {
    for (const from of [0, 1] as const) {
      const end = sailing.ends[from];
      if (end.landing.x === tile.x && end.landing.y === tile.y && end.toward === toward) {
        return { sailing, from };
      }
    }
  }
  return undefined;
}

/**
 * The voyage from one end: every tile the boat crosses, in order, from the
 * near boat to the far one - the player is on each in turn - and then the far
 * jetty, where they step ashore.
 */
export function voyage(sailing: MapSailing, from: 0 | 1): readonly GridPosition[] {
  const course = from === 0 ? sailing.course : [...sailing.course].reverse();
  return [...course, sailing.ends[1 - from].landing];
}

/** Each boat as the two ways through a player can take: jetty to jetty, both ways. */
export function sailingLinks(sailings: readonly MapSailing[] | undefined): GridLink[] {
  return (sailings ?? []).flatMap((sailing) => [
    { from: sailing.ends[0].landing, toward: sailing.ends[0].toward, to: sailing.ends[1].landing },
    { from: sailing.ends[1].landing, toward: sailing.ends[1].toward, to: sailing.ends[0].landing },
  ]);
}

/**
 * Every way through a player can take on a map: its doors and ladders, which
 * the hunter takes too, and its boats and lifts, which only a player does. Asked by
 * whatever wants to know where a raid can get to rather than where the hunter
 * can follow it.
 */
export function playerLinks(map: {
  readonly width: number;
  readonly links?: GridLinks;
  readonly sailings?: readonly MapSailing[];
  readonly lifts?: readonly MapLift[];
}): GridLinks | undefined {
  if ((!map.sailings || map.sailings.length === 0) && (!map.lifts || map.lifts.length === 0)) {
    return map.links;
  }
  return new Map([
    ...(map.links ?? []),
    ...linkTable(sailingLinks(map.sailings), map.width),
    ...linkTable(liftLinks(map.lifts), map.width),
  ]);
}

/** Seconds into a raid as the clock reads them: `2:00`. */
function clockTime(ms: number): string {
  const seconds = Math.round(ms / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * What the boat says when you ask to board: FireRed's own sailor, and the
 * question of where it goes. The cursor starts on staying ashore, because the
 * key that asked is the key that would answer.
 */
export function boardingPrompt(
  sailing: MapSailing,
  to: string | undefined,
): { readonly lines: readonly string[]; readonly options: readonly string[]; readonly selected: number } {
  return {
    lines: ['Ahoy, there!', `Sail ${sailing.name.toUpperCase()}${to ? ` to ${to.toUpperCase()}` : ''}?`],
    options: ['SAIL', 'STAY ASHORE'],
    selected: 1,
  };
}

/** What FireRed's sailor says as the boat casts off. */
export function castOffLine(sailing: MapSailing): string {
  return `All right! All aboard ${sailing.name.toUpperCase()}!`;
}

/** What a jetty says while its boat is not there to board. */
export function boatAwayLines(sailing: MapSailing, state: Exclude<SailingState, 'sailing'>): readonly string[] {
  const name = sailing.name.toUpperCase();
  return state === 'not-yet'
    ? [`${name} puts in on the tide.`, `It sails from ${clockTime(sailing.runsFromMs)} until ${clockTime(sailing.runsUntilMs)}.`]
    : [`The tide has turned.`, `${name} will not sail again this raid.`];
}

/** The second line of a boat's caption: whether it can be boarded, and when. */
export function boatCaption(sailing: MapSailing, state: SailingState, elapsedMs: number): string {
  if (state === 'sailing') {
    const left = Math.max(0, Math.ceil((sailing.runsUntilMs - elapsedMs) / 1_000));
    return `SAILING ${left}s`;
  }
  if (state === 'not-yet') {
    return `SAILS AT ${clockTime(sailing.runsFromMs)}`;
  }
  return 'SAILED';
}
