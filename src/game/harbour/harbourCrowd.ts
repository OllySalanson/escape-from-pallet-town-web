import type { Direction, GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import type { HarbourMove, HarbourPlace } from './harbourProtocol';

/**
 * Everybody else in THE HARBOUR, as this browser has heard them: where each one
 * is, the steps they have taken that have not been walked on this screen yet,
 * and where they are on the way between two tiles.
 *
 * Steps arrive a few at a time (`HARBOUR_SEND_EVERY_MS`), so a figure is walked
 * through them at the game's own pace - one tile a `STEP_DURATION_MS` - rather
 * than jumping to the last one, and walked faster while it is more than a
 * couple of steps behind, so it never falls further behind than a message.
 * Anything that is not a step - a tile that is not next to the last, a long
 * backlog, a different place - is a jump: the figure is simply there.
 *
 * Phaser-free, so it is tested on its own; `harbourFigures.ts` draws it.
 */

/** Steps behind beyond which a figure walks twice as fast to catch up. */
export const CATCH_UP_AFTER_STEPS = 2;

/** Steps behind beyond which it stops walking and is just there. */
export const JUMP_AFTER_STEPS = 12;

/** One other player, as drawn this frame. */
export interface HarbourFigure<P extends string = HarbourPlace> {
  readonly id: string;
  readonly place: P;
  /** The tile it stands on, or is leaving. */
  readonly tile: GridPosition;
  /** The tile it is walking onto, if it is between two. */
  readonly toward: GridPosition | null;
  /** How far along the step it is, 0 to 1. */
  readonly progress: number;
  readonly facing: Direction;
}

interface Walker<P extends string> {
  id: string;
  place: P;
  tile: GridPosition;
  queue: GridPosition[];
  progress: number;
  facing: Direction;
  /** The facing to turn to once the queue is walked. */
  endFacing: Direction;
}

const adjacent = (a: GridPosition, b: GridPosition): boolean => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const same = (a: GridPosition, b: GridPosition): boolean => a.x === b.x && a.y === b.y;

function directionOf(from: GridPosition, to: GridPosition): Direction | null {
  if (to.x > from.x) return 'right';
  if (to.x < from.x) return 'left';
  if (to.y > from.y) return 'down';
  if (to.y < from.y) return 'up';
  return null;
}

export class HarbourCrowd<P extends string = HarbourPlace> {
  private readonly walkers = new Map<string, Walker<P>>();

  /** Somebody walked: their steps are queued, or they are put where a jump puts them. */
  public hear(move: HarbourMove<P>): void {
    const walker = this.walkers.get(move.from);
    const [first] = move.path;
    if (!walker || walker.place !== move.place || !first) {
      const last = move.path[move.path.length - 1] ?? first ?? { x: 0, y: 0 };
      this.walkers.set(move.from, {
        id: move.from,
        place: move.place,
        tile: { ...last },
        queue: [],
        progress: 0,
        facing: move.facing,
        endFacing: move.facing,
      });
      return;
    }
    // The newest tile already queued (or stood on), which the path continues from.
    let end = walker.queue[walker.queue.length - 1] ?? walker.tile;
    for (const tile of move.path) {
      if (same(tile, end)) {
        continue;
      }
      if (!adjacent(tile, end)) {
        // Not a step from where they were: a jump, to the end of what was said.
        const last = move.path[move.path.length - 1];
        walker.tile = { ...last };
        walker.queue = [];
        walker.progress = 0;
        walker.facing = move.facing;
        walker.endFacing = move.facing;
        return;
      }
      walker.queue.push({ ...tile });
      end = tile;
    }
    if (walker.queue.length > JUMP_AFTER_STEPS) {
      walker.tile = walker.queue[walker.queue.length - 1]!;
      walker.queue = [];
      walker.progress = 0;
      walker.facing = move.facing;
    }
    walker.endFacing = move.facing;
    if (walker.queue.length === 0) {
      walker.facing = move.facing;
    }
  }

  /** Somebody said where they are without walking there: a jump if it is somewhere else. */
  public at(id: string, place: P): void {
    const walker = this.walkers.get(id);
    if (walker && walker.place === place) {
      return;
    }
    if (walker) {
      // Gone to another place: drawn nowhere until they say where they stand in it.
      this.walkers.delete(id);
    }
  }

  /** Somebody left the harbour. */
  public forget(id: string): void {
    this.walkers.delete(id);
  }

  /** Everybody, when this browser stops listening. */
  public clear(): void {
    this.walkers.clear();
  }

  /** Everybody this browser knows of, by id. */
  public ids(): readonly string[] {
    return [...this.walkers.keys()];
  }

  /** Moves every figure on by a frame. */
  public advance(deltaMs: number): void {
    for (const walker of this.walkers.values()) {
      let left = deltaMs;
      while (left > 0 && walker.queue.length > 0) {
        const pace = walker.queue.length > CATCH_UP_AFTER_STEPS ? 2 : 1;
        const next = walker.queue[0];
        walker.facing = directionOf(walker.tile, next) ?? walker.facing;
        const needed = ((1 - walker.progress) * STEP_DURATION_MS) / pace;
        if (left >= needed) {
          left -= needed;
          walker.tile = next;
          walker.queue.shift();
          walker.progress = 0;
        } else {
          walker.progress += (left * pace) / STEP_DURATION_MS;
          left = 0;
        }
      }
      if (walker.queue.length === 0) {
        walker.facing = walker.endFacing;
      }
    }
  }

  /** The figures standing in one place, to be drawn there. */
  public figuresIn(place: P): readonly HarbourFigure<P>[] {
    return [...this.walkers.values()]
      .filter((walker) => walker.place === place)
      .map((walker) => ({
        id: walker.id,
        place: walker.place,
        tile: { ...walker.tile },
        toward: walker.queue[0] ? { ...walker.queue[0] } : null,
        progress: walker.queue[0] ? walker.progress : 0,
        facing: walker.facing,
      }));
  }
}
