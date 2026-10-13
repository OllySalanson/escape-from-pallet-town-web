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
