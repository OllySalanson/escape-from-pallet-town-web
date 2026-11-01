import { nextTileFromDirection, type Direction, type GridPosition } from '../movement/gridMovement';
import { arenaStationAt, arenaTelescopeAt, ARENA_STATIONS } from './arenaHall';

/**
 * Walking THE RAID ARENA's curve on one held key. Everywhere else in the game a
 * step that meets something stops, and in a room of straight walls that is right.
 * The hall is an oval drawn in square tiles, so its walls and its fence are a
 * staircase, and getting round it took a change of key at every stair (the captain:
 * "I have to zigzag with the arrow keys the whole way"). So here a held key whose
 * way is shut by a stair carries on round it: the player steps along the wall until
 * the way they are pressing is open again, and goes on.
 *
 * Two things keep that from ever taking the key out of the player's hands. **It
 * only goes round a stair**: if the way stays shut for longer than `SLIDE_REACH`
 * tiles either side this is a wall, not a corner, and the player stops against it
 * as they do anywhere, so pressing up at the rail in front of the door stays where
 * it is. **It never goes round anything that answers the interact key**: pressing
 * into a station, a telescope or somebody is how they are faced. And a press from
 * standing still waits `SLIDE_AFTER_MS` first, so a tap towards a wall only turns.
 *
 * Nothing here knows Phaser. Only the hall asks it (`BaseScene`).
 */

/** How many tiles along a wall a held key goes looking for the way on: the widest stair in the hall. */
export const SLIDE_REACH = 4;

/** How long a key is pressed against a stair from standing before the walk goes round it. A tap is shorter. */
export const SLIDE_AFTER_MS = 120;

const SIDES_OF: Readonly<Record<Direction, readonly [Direction, Direction]>> = {
  up: ['left', 'right'],
  down: ['left', 'right'],
  left: ['up', 'down'],
  right: ['up', 'down'],
};

/**
 * The one stair in the yard. Keepers' Row is two tiles wide and everybody comes out
 * of a door on to its top row, which runs straight into the foot of the Arena's east
 * banner with the door in sight beyond it. So a key held west at that one tile goes
 * on along the row below: it is the walk every new player makes first, and it stopped
 * dead. Asked of the yard alone, and held to its map in `arenaWalk.test.ts`.
 */
export const YARD_STAIR = { x: 14, y: 12, pressed: 'left', steps: 'down' } as const;

/** Which way a key held at the yard's stair goes on, or null anywhere else. */
export function roundTheYardStair(from: GridPosition, direction: Direction, isBlocked: (tile: GridPosition) => boolean): Direction | null {
  if (from.x !== YARD_STAIR.x || from.y !== YARD_STAIR.y || direction !== YARD_STAIR.pressed) {
    return null;
  }
  return isBlocked(nextTileFromDirection(from, YARD_STAIR.steps)) ? null : YARD_STAIR.steps;
}

/** Whether a tile is one a player presses into on purpose. */
function answersAKey(tile: GridPosition): boolean {
  return (
    arenaStationAt(tile) !== undefined ||
    arenaTelescopeAt(tile) !== undefined ||
    ARENA_STATIONS.some((station) => station.past.some((each) => each.x === tile.x && each.y === tile.y))
  );
}

/**
 * Which way a player pressing `direction` steps instead, standing at `from` with
 * that way shut: the side with the way on nearest, or null if there is none and
 * this is simply a wall. `isBlocked` is the scene's, so a figure stops the walk as
 * it stops a step, and `isSomebody` says which of those are people to be faced.
 */
export function slideRound(
  from: GridPosition,
  direction: Direction,
  isBlocked: (tile: GridPosition) => boolean,
  isSomebody: (tile: GridPosition) => boolean = () => false,
): Direction | null {
  const ahead = nextTileFromDirection(from, direction);
  if (!isBlocked(ahead) || answersAKey(ahead) || isSomebody(ahead)) {
    return null;
  }
  const [first, second] = SIDES_OF[direction];
  const open = { [first]: true, [second]: true } as Record<Direction, boolean>;
  const reached = { [first]: from, [second]: from } as Record<Direction, GridPosition>;
  for (let along = 1; along <= SLIDE_REACH; along += 1) {
    for (const side of [first, second]) {
      if (!open[side]) {
        continue;
      }
      const tile = nextTileFromDirection(reached[side], side);
      if (isBlocked(tile)) {
        open[side] = false;
        continue;
      }
      reached[side] = tile;
      if (!isBlocked(nextTileFromDirection(tile, direction))) {
        return side;
      }
    }
  }
  return null;
}
