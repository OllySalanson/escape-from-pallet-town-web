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
 * Both are cheap to compute and are asserted per map in `mapStructure.testkit.ts`.
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

/**
 * Step distance from `from` to every reachable tile; -1 where unreachable.
 *
 * The rows are `Int32Array` views of one buffer and the queue is a flat one,
 * which reads the same at every call site (`field[y][x]`) and matters because this is the
 * hot loop of every rule a map is held to: the structure suite alone runs it
 * a few hundred thousand times over a 128x128 map, and a typed row clears in
 * one memset where an array of numbers clears a cell at a time.
 */
export function stepDistances(
  collision: CollisionGrid,
  from: GridPosition,
  extraBlocked: ReadonlySet<string> = new Set(),
): readonly Int32Array[] {
  const height = collision.length;
  const width = collision[0]?.length ?? 0;
  // One buffer, a row a view of it, so the whole field is one allocation and
  // one fill.
  const field = new Int32Array(width * height).fill(-1);
  const distances: Int32Array[] = [];
  for (let y = 0; y < height; y += 1) {
    distances.push(field.subarray(y * width, (y + 1) * width));
  }
  // The extra walls are read once into a mask rather than asked as a string
  // per neighbour: building `"x,y"` four times a tile was the most expensive
  // thing this loop did.
  const extra = blockedMask(extraBlocked, width, height);
  const passable = (x: number, y: number): boolean =>
    !isBlockedAt(collision, x, y) && (extra === null || extra[y * width + x] === 0);
  if (!passable(from.x, from.y)) {
    return distances;
  }

  field[from.y * width + from.x] = 0;
  const queue = new Int32Array(width * height);
  queue[0] = from.y * width + from.x;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const here = queue[head];
    head += 1;
    const x = here % width;
    const y = (here - x) / width;
    const next = field[here] + 1;
    for (const [dx, dy] of ORTHOGONAL) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const index = ny * width + nx;
      if (field[index] !== -1 || !passable(nx, ny)) {
        continue;
      }
      field[index] = next;
      queue[tail] = index;
      tail += 1;
    }
  }
  return distances;
}

/** A set of `"x,y"` keys as a mask over the grid, or null when it holds nothing on it. */
function blockedMask(keys: ReadonlySet<string>, width: number, height: number): Uint8Array | null {
  if (keys.size === 0) {
    return null;
  }
  const mask = new Uint8Array(width * height);
  for (const key of keys) {
    const comma = key.indexOf(',');
    const x = Number(key.slice(0, comma));
    const y = Number(key.slice(comma + 1));
    if (comma > 0 && Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height) {
      mask[y * width + x] = 1;
    }
  }
  return mask;
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

/** A named piece of a map: one tile, or a run of them that is one place - a gate, a doorway. */
export interface NamedGround {
  readonly what: string;
  readonly tiles: readonly GridPosition[];
}

/**
 * Every walk between two named places that is longer - or gone - once `shut` is
 * taken off the map.
 *
 * It is the question to ask of a map's exits: an open exit takes whoever steps
 * on it, so to a player who is not leaving it is a wall, and a way between two
 * places that only exists over one is a way that ends the raid. A place of
 * several tiles is as near as its nearest tile, which is what lets an exit stand
 * at the side of a two-tile lane: the lane is still as short as it was.
 */
export function walksLengthenedBy(
  collision: CollisionGrid,
  shut: ReadonlySet<string>,
  places: readonly NamedGround[],
  alsoBlocked: ReadonlySet<string> = new Set(),
): string[] {
  const without = new Set([...shut, ...alsoBlocked]);
  const nearest = (
    distances: readonly (readonly Int32Array[])[],
    tiles: readonly GridPosition[],
  ): number => {
    const reached = distances
      .flatMap((from) => tiles.map((tile) => from[tile.y]?.[tile.x] ?? -1))
      .filter((steps) => steps >= 0);
    return reached.length === 0 ? -1 : Math.min(...reached);
  };
  // A place is stood on, so the part of one that is itself an exit is no part of it.
  const grounds = places.map((place) => ({
    what: place.what,
    tiles: place.tiles.filter((tile) => !shut.has(`${tile.x},${tile.y}`)),
  }));
  const lengthened: string[] = [];
  grounds.forEach((from, index) => {
    const open = from.tiles.map((tile) => stepDistances(collision, tile, alsoBlocked));
    const closed = from.tiles.map((tile) => stepDistances(collision, tile, without));
    for (const to of grounds.slice(index + 1)) {
      const steps = nearest(open, to.tiles);
      const stepsRound = nearest(closed, to.tiles);
      if (steps >= 0 && stepsRound !== steps) {
        lengthened.push(
          `${from.what} -> ${to.what}: ${steps} steps, ${stepsRound < 0 ? 'no way' : `${stepsRound}`} without crossing an exit`,
        );
      }
    }
  });
  return lengthened;
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
