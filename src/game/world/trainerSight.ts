import { nextTileFromDirection, type Direction, type GridPosition } from '../movement/gridMovement';

/**
 * What a trainer is watching.
 *
 * A trainer who only fights when the player walks up and presses the interact
 * key is not a price on a route, because the player simply does not press it.
 * On a one-tile lane that makes the trainer a locked door instead: the route is
 * shut, not costly. A watch is the difference - the trainer stands beside the
 * lane, the lane stays open and fast, and walking it is what starts the fight.
 *
 * The rules that keep that fair are geometric, so they live here as pure
 * functions rather than in `WorldScene`, and `trainerSight.test.ts` and the map
 * suite hold every map to them:
 *
 * - a watch runs in one straight line from the trainer's own facing, so the
 *   sprite on screen already says where it points;
 * - it stops at the first thing the player cannot walk through, so a trainer
 *   never sees round a corner or across water; and
 * - it is a run of tiles the player chooses to step into, never the tile they
 *   are standing on when the map loads.
 */
export interface TrainerWatch {
  readonly position: GridPosition;
  readonly facing: Direction;
  /**
   * How many tiles ahead the trainer challenges from. Absent or zero is a
   * trainer who has to be spoken to, which is every trainer the checkpoint
   * mechanic has not been authored for yet.
   */
  readonly sightRange?: number;
}

/** True where the player cannot walk. Off-map must answer true. */
export type BlockedTest = (tile: GridPosition) => boolean;

/**
 * The tiles a trainer is watching, nearest to the trainer first.
 *
 * The trainer's own tile is never in the list: the watch is the ground in front
 * of them, and standing on top of a trainer is not something the engine allows
 * anyway.
 */
export function trainerSightTiles(watch: TrainerWatch, isBlocked: BlockedTest): GridPosition[] {
  const range = watch.sightRange ?? 0;
  const tiles: GridPosition[] = [];
  let tile = watch.position;
  for (let step = 0; step < range; step += 1) {
    tile = nextTileFromDirection(tile, watch.facing);
    if (isBlocked(tile)) {
      break;
    }
    tiles.push(tile);
  }
  return tiles;
}

export function isTileWatched(
  watch: TrainerWatch,
  tile: GridPosition,
  isBlocked: BlockedTest,
): boolean {
  return trainerSightTiles(watch, isBlocked).some(
    (watched) => watched.x === tile.x && watched.y === tile.y,
  );
}

/**
 * The first trainer in `watches` whose watch covers `tile`, or undefined.
 *
 * Order is the authored order, so a map that ever overlaps two watches resolves
 * to the one written first rather than to whichever the scene happened to draw.
 */
export function findWatchingTrainer<T extends TrainerWatch>(
  watches: readonly T[],
  tile: GridPosition,
  isBlocked: BlockedTest,
): T | undefined {
  return watches.find((watch) => isTileWatched(watch, tile, isBlocked));
}
