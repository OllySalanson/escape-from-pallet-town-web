import type { GridPosition } from '../movement/gridMovement';

/**
 * The acceptance test for a map, as two numbers.
 *
 * Counting how much ground a player can stand on says nothing about whether a
 * map is a place or a field - an open field has enormous route count and no
 * route structure. These two do say it:
 *
 * - **longest straight walk**: how far you get before something makes you
 *   decide. "Hold one direction and you cross the map in three seconds" is
 *   literally this number being large.
 * - **open ground**: walkable tiles with nothing within three steps, and how
 *   many connected lumps of them there are. "You walk down and the whole map is
 *   one huge bit of grass" is literally one blob of a few hundred tiles.
 *
 * Both are cheap to compute and are asserted per map in `mapStructure.test.ts`.
 */

export type CollisionGrid = readonly (readonly boolean[])[];

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

export function isBlockedAt(collision: CollisionGrid, x: number, y: number): boolean {
  const row = collision[y];
  if (row === undefined || x < 0 || x >= row.length) {
    return true;
  }
  return row[x];
}

export function walkableTiles(collision: CollisionGrid): GridPosition[] {
  const tiles: GridPosition[] = [];
  for (let y = 0; y < collision.length; y += 1) {
    for (let x = 0; x < collision[y].length; x += 1) {
      if (!isBlockedAt(collision, x, y)) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

/** How far a player sliding from `from` gets before something stops them. */
export function slideLength(
  collision: CollisionGrid,
  from: GridPosition,
  dx: number,
  dy: number,
): number {
  let steps = 0;
  let { x, y } = from;
  while (!isBlockedAt(collision, x + dx, y + dy)) {
    x += dx;
    y += dy;
    steps += 1;
  }
  return steps;
}

export interface StraightWalkSummary {
  readonly longest: number;
  readonly average: number;
}

export function straightWalk(collision: CollisionGrid): StraightWalkSummary {
  let longest = 0;
  let total = 0;
  let samples = 0;
  for (const tile of walkableTiles(collision)) {
    for (const [dx, dy] of ORTHOGONAL) {
      const length = slideLength(collision, tile, dx, dy);
      longest = Math.max(longest, length);
      total += length;
      samples += 1;
    }
  }
  return { longest, average: samples === 0 ? 0 : total / samples };
}

/**
 * Chebyshev distance from every walkable tile to the nearest blocked tile, with
 * off-map counting as blocked so a map edge closes ground the same way a hedge
 * does.
 */
export function wallDistances(collision: CollisionGrid): number[][] {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  const distances = Array.from({ length: height }, () => Array<number>(width).fill(Infinity));
  const queue: GridPosition[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isBlockedAt(collision, x, y)) {
        distances[y][x] = 0;
        queue.push({ x, y });
        continue;
      }
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        distances[y][x] = 1;
        queue.push({ x, y });
      }
    }
  }

  for (let index = 0; index < queue.length; index += 1) {
    const { x, y } = queue[index];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || isBlockedAt(collision, nx, ny)) {
          continue;
        }
        if (distances[ny][nx] > distances[y][x] + 1) {
          distances[ny][nx] = distances[y][x] + 1;
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  return distances;
}

export interface OpenGroundSummary {
  /** Walkable tiles with nothing within `clearance` steps. */
  readonly tiles: number;
  readonly percentOfWalkable: number;
  /** Sizes of the connected lumps of that ground, largest first. */
  readonly blobs: number[];
}

export function openGround(collision: CollisionGrid, clearance = 3): OpenGroundSummary {
  const distances = wallDistances(collision);
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  const seen = Array.from({ length: height }, () => Array<boolean>(width).fill(false));
  const isOpen = (x: number, y: number): boolean =>
    !isBlockedAt(collision, x, y) && distances[y][x] >= clearance;

  let tiles = 0;
  const blobs: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpen(x, y)) {
        continue;
      }
      tiles += 1;
      if (seen[y][x]) {
        continue;
      }
      seen[y][x] = true;
      const queue: GridPosition[] = [{ x, y }];
      let size = 0;
      for (let index = 0; index < queue.length; index += 1) {
        const tile = queue[index];
        size += 1;
        for (const [dx, dy] of ORTHOGONAL) {
          const nx = tile.x + dx;
          const ny = tile.y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || seen[ny][nx] || !isOpen(nx, ny)) {
            continue;
          }
          seen[ny][nx] = true;
          queue.push({ x: nx, y: ny });
        }
      }
      blobs.push(size);
    }
  }

  blobs.sort((a, b) => b - a);
  const walkable = walkableTiles(collision).length;
  return { tiles, percentOfWalkable: walkable === 0 ? 0 : (100 * tiles) / walkable, blobs };
}

/** Step distance from `from` to every reachable tile; -1 where unreachable. */
export function stepDistances(
  collision: CollisionGrid,
  from: GridPosition,
  extraBlocked: ReadonlySet<string> = new Set(),
): number[][] {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  const distances = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  const passable = (x: number, y: number): boolean =>
    !isBlockedAt(collision, x, y) && !extraBlocked.has(`${x},${y}`);
  if (!passable(from.x, from.y)) {
    return distances;
  }

  distances[from.y][from.x] = 0;
  const queue: GridPosition[] = [from];
  for (let index = 0; index < queue.length; index += 1) {
    const tile = queue[index];
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      if (!passable(nx, ny) || distances[ny][nx] !== -1) {
        continue;
      }
      distances[ny][nx] = distances[tile.y][tile.x] + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return distances;
}

export function unreachableTiles(
  collision: CollisionGrid,
  from: GridPosition,
  extraBlocked?: ReadonlySet<string>,
): GridPosition[] {
  const distances = stepDistances(collision, from, extraBlocked);
  return walkableTiles(collision).filter(
    (tile) => !extraBlocked?.has(`${tile.x},${tile.y}`) && distances[tile.y][tile.x] < 0,
  );
}

/**
 * The furthest ring the hunter's spawn search can reach from a tile, capped at
 * `distance`. `findHunterSpawnTile` walks outwards and refuses to place the
 * hunter closer than its minimum, so a tile that cannot reach that minimum is a
 * tile where the hunter simply never arrives.
 */
export function furthestSpawnRing(
  collision: CollisionGrid,
  from: GridPosition,
  distance: number,
): number {
  const distances = stepDistances(collision, from);
  let furthest = 0;
  for (const tile of walkableTiles(collision)) {
    const steps = distances[tile.y][tile.x];
    if (steps >= 0 && steps <= distance) {
      furthest = Math.max(furthest, steps);
    }
  }
  return furthest;
}
