import type { GridPosition } from '../movement/gridMovement';
import type { RestoredGame } from '../save/SaveManager';
import { BASE_LANDING, BASE_SPAWN, getBaseMap } from './baseMap';
import { BASE_DOORS, type BaseDoor } from './doors';
import { buildRoom, roomNamed, type BaseRoom } from './rooms';

/**
 * How far the base makes a player walk, which is the number it is designed
 * against.
 *
 * The captain's rule for the base is that walking must never become a toll for
 * a player re-kitting many times an hour, and a rule about a walk is only as
 * good as the walk is measured. These are the measures `baseMap.test.ts`,
 * `rooms.test.ts` and `tools/base/renderBase.mts` all ask, so the test and the
 * number printed for a playtest are one number.
 */

/** Walking steps from a tile to every other, round whatever is solid. */
export function stepsFrom(
  collision: readonly (readonly boolean[])[],
  start: GridPosition,
  blocked: (tile: GridPosition) => boolean = () => false,
): number[][] {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  const steps = Array.from({ length: height }, () =>
    Array<number>(width).fill(Number.POSITIVE_INFINITY),
  );
  steps[start.y][start.x] = 0;
  let frontier: GridPosition[] = [start];
  while (frontier.length > 0) {
    const next: GridPosition[] = [];
    for (const tile of frontier) {
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (collision[y][x] || blocked({ x, y })) continue;
        if (steps[y][x] <= steps[tile.y][tile.x] + 1) continue;
        steps[y][x] = steps[tile.y][tile.x] + 1;
        next.push({ x, y });
      }
    }
    frontier = next;
  }
  return steps;
}

/** How far a place is, which is as far as its nearest tile. */
export function stepsTo(
  steps: readonly (readonly number[])[],
  tiles: readonly GridPosition[],
): number {
  return Math.min(...tiles.map((tile) => steps[tile.y]?.[tile.x] ?? Number.POSITIVE_INFINITY));
}

/**
 * The tiles a keeper serves from: the floor next to them or next to their
 * counter, which is where a player walking across the room stops to talk.
 */
export function servingTiles(
  room: BaseRoom,
  collision: readonly (readonly boolean[])[],
): GridPosition[] {
  const targets = [room.keeper.position, ...room.counter];
  const tiles: GridPosition[] = [];
  for (const target of targets) {
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const tile = { x: target.x + dx, y: target.y + dy };
      if (collision[tile.y]?.[tile.x] !== false) continue;
      if (tile.x === room.keeper.position.x && tile.y === room.keeper.position.y) continue;
      tiles.push(tile);
    }
  }
  return tiles;
}

export interface KeeperWalk {
  readonly door: BaseDoor;
  /** Steps across the yard onto the doorway. */
  readonly yard: number;
  /** Steps from the door mat to where the keeper is spoken to face to face. */
  readonly acrossTheRoom: number;
}

/**
 * From a spot in the yard to every keeper: the walk to the door, then the walk
 * across the room if the player chooses to take it. The screen itself is one
 * key from the mat, so the first number is the whole of the toll and the
 * second is what looking at the room costs a player who wants to.
 */
export function walksToKeepers(from: GridPosition, game: RestoredGame): readonly KeeperWalk[] {
  const yard = getBaseMap(game.raidProgress.workshopUpgrades);
  const steps = stepsFrom(yard.collision, from);
  return BASE_DOORS.map((door) => {
    const room = roomNamed(door.id);
    if (!room) throw new Error(`no room behind ${door.id}`);
    const built = buildRoom(room, game);
    const keeper = room.keeper.position;
    const inside = stepsFrom(
      built.collision,
      room.mat,
      (tile) => tile.x === keeper.x && tile.y === keeper.y,
    );
    return {
      door,
      yard: stepsTo(steps, door.tiles),
      acrossTheRoom: stepsTo(inside, servingTiles(room, built.collision)),
    };
  });
}

/** The two places a player starts a visit to the base from. */
export const BASE_STARTS = [
  { name: 'the yard', tile: BASE_SPAWN },
  { name: 'the quay (home from a raid)', tile: BASE_LANDING },
] as const;
