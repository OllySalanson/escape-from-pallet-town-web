import type { GridLinks, GridPosition } from '../movement/gridMovement';
import type { ExtractionPoint } from './extractionPoints';
import { stepDistances } from './mapStructure';

/**
 * The open exit the player can walk to in the fewest steps from where they
 * stand, through the map's doors, or undefined when none is open and in reach.
 *
 * The field guide names this one. It used to name the first exit in the map's
 * authored list, which on the vast maps sent a player standing nine steps from
 * the QUARRY TRACK across the whole of Pallet's valley to the SOUTH GATE. A
 * straight-line nearest would be no better: it names an exit behind a shut
 * gate, or across a river, as readily as one down the lane.
 */
export function nearestOpenExit(
  exits: readonly ExtractionPoint[],
  from: GridPosition,
  collision: readonly (readonly boolean[])[],
  isOpen: (point: ExtractionPoint) => boolean,
  links?: GridLinks,
): ExtractionPoint | undefined {
  const open = exits.filter(isOpen);
  if (open.length === 0) {
    return undefined;
  }
  const field = stepDistances(collision, from, new Set(), links);
  let best: { readonly point: ExtractionPoint; readonly steps: number } | undefined;
  for (const point of open) {
    const steps = field[point.position.y]?.[point.position.x] ?? -1;
    if (steps >= 0 && (!best || steps < best.steps)) {
      best = { point, steps };
    }
  }
  return best?.point;
}

/**
 * How many walking steps from `from` each tile is, through the map's doors, as
 * a question the field guide can ask of any place: the tile itself, else the
 * nearest tile beside it (a landmark on a solid tile is worked from beside it).
 * Undefined is out of reach - behind a shut gate, or across water.
 */
export function walkingStepsFrom(
  from: GridPosition,
  collision: readonly (readonly boolean[])[],
  links?: GridLinks,
): (target: GridPosition) => number | undefined {
  const field = stepDistances(collision, from, new Set(), links);
  const at = (x: number, y: number): number => field[y]?.[x] ?? -1;
  return (target) => {
    const own = at(target.x, target.y);
    if (own >= 0) {
      return own;
    }
    const beside = [
      at(target.x + 1, target.y),
      at(target.x - 1, target.y),
      at(target.x, target.y + 1),
      at(target.x, target.y - 1),
    ].filter((steps) => steps >= 0);
    return beside.length > 0 ? Math.min(...beside) : undefined;
  };
}
