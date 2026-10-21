import { nextTileFromDirection, type GridPosition } from '../movement/gridMovement';
import type { WorldMapDefinition } from '../worldMap';
import { placedAreaAt } from './mapAreas';
import { stepDistances } from './mapStructure';

/**
 * Where to head for something that may be in another place of the map.
 *
 * Every heading the raid prints - the objective chip, the hunter chip, a prize
 * in view, the field guide - is a compass point from the player to a tile. On
 * a map made of several places laid side by side (`mapAreas.ts`) a straight
 * line from a room to the outdoors points at wherever the room happens to lie
 * in the grid, which is nowhere a player can walk. So the heading is to the
 * doorway the walk there starts through: from inside a house, the hunter
 * outside is "through the door", and the door is south.
 *
 * The answer is the doorway's own tile - the door, or the dark past a mat -
 * rather than the tile you stand on to go through it, so a player already
 * standing at the door is still told which way to press.
 */
export function wayTowards(
  map: WorldMapDefinition,
  from: GridPosition,
  to: GridPosition,
): GridPosition {
  const areas = map.areas;
  if (!areas || map.warps.length === 0) {
    return to;
  }
  const here = placedAreaAt(areas, from);
  const there = placedAreaAt(areas, to);
  if (!here || here === there) {
    return to;
  }
  const field = distancesTo(map, to);
  // A door whose far side walks to the target beats every door whose far side
  // does not; among those, the one whose far side is nearest in a straight
  // line. A target nothing reaches today - ground behind a shut gate - is
  // still out of the room, and a straight line across the grid the places are
  // laid out on points at a wall.
  let best: { readonly doorway: GridPosition; readonly walks: boolean; readonly cost: number } | null = null;
  for (const warp of map.warps) {
    if (warp.activation !== 'push' || !warp.toward || placedAreaAt(areas, warp.source) !== here) {
      continue;
    }
    const beyond = field[warp.destination.y]?.[warp.destination.x] ?? -1;
    const walks = beyond >= 0;
    const far = walks
      ? beyond
      : Math.abs(warp.destination.x - to.x) + Math.abs(warp.destination.y - to.y);
    // The far side of the door's own walk, plus the straight line to the door
    // from here: within one room that is close enough to the walk, and it
    // keeps this to one search per target rather than one per frame.
    const cost = far + Math.abs(warp.source.x - from.x) + Math.abs(warp.source.y - from.y);
    if (!best || (walks && !best.walks) || (walks === best.walks && cost < best.cost)) {
      best = { doorway: nextTileFromDirection(warp.source, warp.toward), walks, cost };
    }
  }
  return best?.doorway ?? to;
}

/**
 * How many steps something is, for a chip that prints the number beside the
 * heading `wayTowards` gives. Within one place it is the straight count, as it
 * always was; in another place it is the walk there through the doors, because
 * the places are laid side by side in the grid with dark between them, and a
 * straight count across it once told a player on Ember Isle's crater that the
 * Charcoal in the Lava Tube under their feet was 605 steps off.
 */
export function stepsTowards(
  map: WorldMapDefinition,
  from: GridPosition,
  to: GridPosition,
): number {
  const straight = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  const areas = map.areas;
  if (!areas || map.warps.length === 0) {
    return straight;
  }
  const here = placedAreaAt(areas, from);
  if (!here || here === placedAreaAt(areas, to)) {
    return straight;
  }
  const walk = distancesTo(map, to)[from.y]?.[from.x] ?? -1;
  if (walk >= 0) {
    return walk;
  }
  // Ground nothing reaches today: as far as the door the heading points at,
  // which is at least a number about this place.
  const doorway = wayTowards(map, from, to);
  return Math.abs(doorway.x - from.x) + Math.abs(doorway.y - from.y);
}

/**
 * Whichever of `targets` is the fewest steps from `from` by `stepsTowards`:
 * straight within one place, the walk through the doors across places. The
 * contract chip names its next stop with this, and counted straight along the
 * grid a player in a room was sent to whichever stop happened to lie nearest
 * the column the room is laid at - the far side of the map, past the dark.
 */
export function nearestByWalk<T extends { readonly position: GridPosition }>(
  map: WorldMapDefinition,
  from: GridPosition,
  targets: readonly T[],
): T | undefined {
  let best: T | undefined;
  let bestSteps = Infinity;
  for (const target of targets) {
    const steps = stepsTowards(map, from, target.position);
    if (steps < bestSteps) {
      best = target;
      bestSteps = steps;
    }
  }
  return best;
}

/**
 * How many walks a map keeps at once. A walk is a whole grid of numbers, and a
 * target that moves - the hunter, asked every frame - is a new target every
 * step: kept without a limit, a hunter walking about outside while the player
 * waited in a room on Greystone Vale kept a grid the size of the whole vale
 * for every tile it stood on. The still targets (a prize, a stop) are asked
 * every frame and so stay among the newest.
 */
export const ROUTE_FIELDS_KEPT = 8;

const fields = new WeakMap<WorldMapDefinition, Map<string, readonly Int32Array[]>>();

/** How many walks are kept for `map` just now; for tests. */
export function keptRouteFields(map: WorldMapDefinition): number {
  return fields.get(map)?.size ?? 0;
}

/** Walking steps to `to` from every tile of the map, through its doors; kept per map and target. */
function distancesTo(map: WorldMapDefinition, to: GridPosition): readonly Int32Array[] {
  const kept = fields.get(map) ?? new Map<string, readonly Int32Array[]>();
  fields.set(map, kept);
  const key = `${to.x},${to.y}`;
  let field = kept.get(key);
  if (field) {
    // Newest last, so the one let go is the one asked about longest ago.
    kept.delete(key);
  } else {
    // The target itself may be solid - a person, an exit marker - so the walk
    // is measured to it from whatever is beside it, as the hunter's is.
    field = stepDistances(withOpen(map.collision, to), to, new Set(), map.links);
    if (kept.size >= ROUTE_FIELDS_KEPT) {
      kept.delete(kept.keys().next().value!);
    }
  }
  kept.set(key, field);
  return field;
}

function withOpen(
  collision: readonly (readonly boolean[])[],
  tile: GridPosition,
): readonly (readonly boolean[])[] {
  if (collision[tile.y]?.[tile.x] !== true) {
    return collision;
  }
  return collision.map((row, y) => (y === tile.y ? row.map((cell, x) => cell && x !== tile.x) : row));
}
