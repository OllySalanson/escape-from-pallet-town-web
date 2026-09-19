import { nextTileFromDirection, type Direction, type GridPosition } from '../movement/gridMovement';

/**
 * The geometry of a watch closing on the player: the ground between the trainer
 * and one tile short of whoever they just caught.
 *
 * What is *done* with it - the mark, the walk, the breath, the line - is the
 * authored cutscene in `cutscenes.ts`, played by `../cutscene/cutscene.ts`.
 * This file only answers where the feet go.
 */
export interface TrainerApproach {
  /** Where the trainer starts. */
  readonly from: GridPosition;
  /** Every tile the trainer walks onto, in order. Empty when already adjacent. */
  readonly path: readonly GridPosition[];
  /** The way the trainer faces on the whole walk: towards the player. */
  readonly facing: Direction;
}

/**
 * The walk from the trainer to one tile short of the player, or null when the
 * player is not in the straight run the trainer faces.
 *
 * A watch is one straight line and stops at the first wall, so the run between
 * trainer and player is always walkable ground; this only refuses what a watch
 * could never have caught.
 */
export function planTrainerApproach(
  trainer: GridPosition,
  facing: Direction,
  player: GridPosition,
  reach: number,
): TrainerApproach | null {
  const path: GridPosition[] = [];
  let tile = trainer;
  for (let step = 0; step < reach; step += 1) {
    const next = nextTileFromDirection(tile, facing);
    if (next.x === player.x && next.y === player.y) {
      return { from: trainer, path, facing };
    }
    path.push(next);
    tile = next;
  }
  return null;
}
