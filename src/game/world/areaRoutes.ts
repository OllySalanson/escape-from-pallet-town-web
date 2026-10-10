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
  let best: { readonly doorway: GridPosition; readonly cost: number } | null = null;
  for (const warp of map.warps) {
    if (warp.activation !== 'push' || !warp.toward || placedAreaAt(areas, warp.source) !== here) {
      continue;
    }
    const beyond = field[warp.destination.y]?.[warp.destination.x] ?? -1;
    if (beyond < 0) {
      continue;
    }
    // The far side of the door's own walk, plus the straight line to the door
    // from here: within one room that is close enough to the walk, and it
    // keeps this to one search per target rather than one per frame.
    const cost =
      beyond + Math.abs(warp.source.x - from.x) + Math.abs(warp.source.y - from.y);
    if (!best || cost < best.cost) {
      best = { doorway: nextTileFromDirection(warp.source, warp.toward), cost };
    }
  }
  return best?.doorway ?? to;
}

const fields = new WeakMap<WorldMapDefinition, Map<string, readonly Int32Array[]>>();

/** Walking steps to `to` from every tile of the map, through its doors; kept per map and target. */
function distancesTo(map: WorldMapDefinition, to: GridPosition): readonly Int32Array[] {
  const kept = fields.get(map) ?? new Map<string, readonly Int32Array[]>();
  fields.set(map, kept);
  const key = `${to.x},${to.y}`;
  let field = kept.get(key);
  if (!field) {
    // The target itself may be solid - a person, an exit marker - so the walk
    // is measured to it from whatever is beside it, as the hunter's is.
    field = stepDistances(withOpen(map.collision, to), to, new Set(), map.links);
    kept.set(key, field);
  }
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
