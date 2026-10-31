import { linkKey, type GridLinks, type GridPosition } from '../movement/gridMovement';
import { isBlockedAt, type CollisionGrid } from './mapStructure';

/**
 * How far is the nearest authored thing, from anywhere on a map - the measure
 * `tools/tileset/density.mts` prints for the game's own maps and the review
 * summary (`mapFileSummary.ts`) states for a player's.
 *
 * For every walkable tile, the walking steps to the nearest **permanent**
 * authored thing: an exit, a drop-in, a landmark, a person or sign, a gate, a
 * trainer. What counts as one is the caller's to say; loot never does, because
 * it is re-seated every raid and counting it flatters a map with nothing
 * standing in it.
 */

/** The game's own maps, low and high, as `density.mts` measures them; `shippedDensity.test.ts` holds it. */
export const SHIPPED_DENSITY = { least: 4.5, most: 7.4 } as const;

/**
 * Steps from each tile to the nearest of `things`, -1 where none can be walked
 * to. One walk out of every thing at once, which is the same answer as the
 * nearest of a walk per thing. A thing standing on something solid is the
 * start of no walk, as `stepDistances` has it.
 */
export function nearestThingSteps(
  collision: CollisionGrid,
  things: readonly GridPosition[],
  links?: GridLinks,
): readonly Int32Array[] {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  const field = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let tail = 0;
  for (const { x, y } of things) {
    const index = y * width + x;
    if (!isBlockedAt(collision, x, y) && field[index] === -1) {
      field[index] = 0;
      queue[tail] = index;
      tail += 1;
    }
  }
  const visit = (index: number, steps: number): void => {
    const x = index % width;
    if (field[index] !== -1 || isBlockedAt(collision, x, (index - x) / width)) {
      return;
    }
    field[index] = steps;
    queue[tail] = index;
    tail += 1;
  };
  for (let head = 0; head < tail; head += 1) {
    const here = queue[head];
    const x = here % width;
    const y = (here - x) / width;
    const next = field[here] + 1;
    if (y > 0) {
      visit(here - width, next);
    }
    if (y < height - 1) {
      visit(here + width, next);
    }
    if (x > 0) {
      visit(here - 1, next);
    }
    if (x < width - 1) {
      visit(here + 1, next);
    }
    if (links !== undefined && links.size > 0) {
      for (let direction = 0; direction < 4; direction += 1) {
        const to = links.get(linkKey(here, direction));
        if (to !== undefined) {
          visit(to, next);
        }
      }
    }
  }
  const rows: Int32Array[] = [];
  for (let y = 0; y < height; y += 1) {
    rows.push(field.subarray(y * width, (y + 1) * width));
  }
  return rows;
}

export interface Density {
  /** Walkable tiles that can walk to a thing at all. */
  readonly tiles: number;
  readonly mean: number;
  readonly median: number;
  readonly ninetieth: number;
  readonly worst: number;
}

/** The spread of a set of step counts; undefined for none. */
export function densityOf(steps: readonly number[]): Density | undefined {
  const sorted = steps.filter((value) => value >= 0).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return undefined;
  }
  return {
    tiles: sorted.length,
    mean: sorted.reduce((total, value) => total + value, 0) / sorted.length,
    median: sorted[sorted.length >> 1],
    ninetieth: sorted[Math.floor(sorted.length * 0.9)],
    worst: sorted[sorted.length - 1],
  };
}
