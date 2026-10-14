import {
  DIRECTION_DELTAS,
  STEP_DIRECTIONS,
  type Direction,
  type GridPosition,
} from '../movement/gridMovement';
import { MATERIALS, type Material } from './tileset/materials';

/**
 * A floor that carries you on: FireRed's ice (Icefall Cave, `MB_ICE`).
 *
 * A step onto a tile of it carries on the same way, tile after tile, until the
 * next tile is something the player cannot walk onto - a wall, a boulder, a
 * person - or the step lands on ground that does not carry, where it stops.
 * Pressing a key does nothing while it carries; once it stops, any way the
 * player presses is the next slide. So crossing a sheet of ice is a puzzle of
 * where you can stop, and the boulders standing on it are the answer.
 *
 * Every carried tile is a whole step, charged to the raid clock as a walked
 * one is and taken by the hunter as a step, because the rule changes only who
 * chooses the next tile, never what a tile costs. Nothing rolls for a wild
 * Pokemon mid-slide, as in FireRed; the tile a slide stops on rolls as any
 * step does.
 *
 * It is the general form of FireRed's forced-movement floors: `carriedOn` is
 * the one question the scene asks, and the Rocket Hideout's spinner arrows are
 * the other answer to it (`TryUpdatePlayerSpinDirection` in pret's
 * `field_player_avatar.c`): a step onto an arrow spins the player on the way
 * the arrow points, whichever way they came, and a spin, unlike a slide, keeps
 * going over plain floor - turned by every arrow it crosses - until it lands on
 * a stop plate or something is in the way. So a spinner floor is a maze of
 * arrows, and the plates are where it can be left.
 *
 * Only the player slides. The hunter walks the ice as ground, as FireRed's
 * people do, so every search over the map - the hunter's, the checks' - reads
 * ice as the ordinary walkable tile its collision says it is; `slideStops` and
 * `slideReach` are the searches that read it the way the player has to.
 */

/** Whether a material carries a step on the way it came: ice. */
export function slides(material: Material | undefined): boolean {
  return material !== undefined && MATERIALS[material].slides === true;
}

/** The way a spinner arrow spins whoever lands on it, if the material is one. */
export function spinsOn(material: Material | undefined): Direction | undefined {
  return material === undefined ? undefined : MATERIALS[material].spins;
}

/**
 * The way a step that has just landed on `tile`, moving `moving`, carries on,
 * or null if it stops there. `spinning` is whether the step was a spin - begun
 * on an arrow and not stopped since - which carries on over plain floor.
 */
export function carriedOn(
  terrain: readonly (readonly Material[])[],
  tile: GridPosition,
  moving: Direction,
  spinning = false,
): Direction | null {
  const material = terrain[tile.y]?.[tile.x];
  if (material === undefined) {
    return null;
  }
  const traits = MATERIALS[material];
  if (traits.spins) {
    return traits.spins;
  }
  if (traits.stopsSpin) {
    return null;
  }
  return traits.slides || spinning ? moving : null;
}

/**
 * Every tile one press from `from` toward `direction` steps on, in order: the
 * first step, and every tile the floor carries it on to. Empty when the first
 * step cannot be taken at all. A slide works whatever it steps on - picks up
 * what lies there - so this is where it can reach as well as where it stops.
 */
export function slideTrail(
  terrain: readonly (readonly Material[])[],
  isBlocked: (tile: GridPosition) => boolean,
  from: GridPosition,
  direction: Direction,
): GridPosition[] {
  const delta = DIRECTION_DELTAS[direction];
  let at = { x: from.x + delta.x, y: from.y + delta.y };
  if (isBlocked(at)) {
    return [];
  }
  const trail = [at];
  let heading = direction;
  let spinning = false;
  // A sheet of ice can be a ring with nothing on it, and so can a ring of
  // arrows; a slide never visits more tiles than there are on the map.
  for (let guard = 0; guard < 100_000; guard += 1) {
    spinning ||= spinsOn(terrain[at.y]?.[at.x]) !== undefined;
    const on = carriedOn(terrain, at, heading, spinning);
    if (on === null) {
      break;
    }
    const next = { x: at.x + DIRECTION_DELTAS[on].x, y: at.y + DIRECTION_DELTAS[on].y };
    if (isBlocked(next)) {
      break;
    }
    heading = on;
    at = next;
    trail.push(at);
  }
  return trail;
}

/** Where one press from `from` toward `direction` comes to rest, or null if it cannot be taken. */
export function slideStops(
  terrain: readonly (readonly Material[])[],
  isBlocked: (tile: GridPosition) => boolean,
  from: GridPosition,
  direction: Direction,
): GridPosition | null {
  return slideTrail(terrain, isBlocked, from, direction).at(-1) ?? null;
}

/**
 * Every tile a player can come to rest on from `from`, pressing one way at a
 * time, and the presses it takes: the map as a sliding player reads it. A
 * tile of ice crossed but never stopped on is not in it - which is the whole
 * puzzle - and `through` adds the ways a player goes through a doorway or
 * ladder from where they stand (`GridBounds.links`, keyed by tile index and
 * direction number as every search keys them).
 */
export function slideReach(
  terrain: readonly (readonly Material[])[],
  isBlocked: (tile: GridPosition) => boolean,
  from: GridPosition,
  width: number,
  through?: ReadonlyMap<number, number>,
): ReadonlyMap<string, number> {
  const presses = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const queue: GridPosition[] = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    const cost = presses.get(`${at.x},${at.y}`)! + 1;
    STEP_DIRECTIONS.forEach((direction, number) => {
      const linked = through?.get((at.y * width + at.x) * 4 + number);
      const rest =
        linked !== undefined
          ? { x: linked % width, y: Math.floor(linked / width) }
          : slideStops(terrain, isBlocked, at, direction);
      if (rest === null) {
        return;
      }
      const key = `${rest.x},${rest.y}`;
      if (!presses.has(key)) {
        presses.set(key, cost);
        queue.push(rest);
      }
    });
  }
  return presses;
}
