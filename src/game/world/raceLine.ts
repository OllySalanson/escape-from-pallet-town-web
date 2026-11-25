import type { GridPosition } from '../movement/gridMovement';
import type { Material } from './tileset/materials';

/**
 * The line a racer runs: the shortest way from where they stand to the finish
 * that keeps to made ground - a road, a street, a plank walk, a bridge - and
 * never sets foot on grass, wild or mown.
 *
 * That is the whole of the racer's character, and the whole of the race: a
 * townsperson runs the way the village is signed, faster than anybody can walk
 * it, so following them always loses; everything a player knows about the map
 * that is not a road is a way to beat them. It is worked out from the map rather
 * than authored, so a district redrawn under it is still raced the way its
 * roads now go - and `races.test.ts` pins how long it is, so a redraw that
 * changes the race is seen.
 */

/** The ground a racer will run on. */
export const RACER_GROUND: ReadonlySet<Material> = new Set<Material>(['sand', 'stone', 'earth', 'paving', 'boards', 'gravel']);

export interface RaceGround {
  readonly width: number;
  readonly height: number;
  /** Whether a tile is a wall, figures and all. */
  readonly solid: (x: number, y: number) => boolean;
  /** What a tile is made of. */
  readonly material: (x: number, y: number) => Material;
}

/**
 * The racer's line from `start` to the nearest of `finish`, then on to `waits`
 * if given: the start and the waiting tile may stand off the road (a racer
 * waits on the verge), every tile between them is made ground. Null when no
 * such way exists.
 */
export function racerLine(
  ground: RaceGround,
  start: GridPosition,
  finish: readonly GridPosition[],
  waits?: GridPosition,
): GridPosition[] | null {
  const toLine = roadWalk(ground, start, finish);
  if (!toLine) {
    return null;
  }
  if (!waits) {
    return toLine;
  }
  const crossed = toLine[toLine.length - 1];
  const aside = roadWalk(ground, crossed, [waits]);
  return aside ? [...toLine, ...aside.slice(1)] : null;
}

/** Breadth first over made ground; the first and last tiles may be any open ground. */
function roadWalk(
  ground: RaceGround,
  start: GridPosition,
  goals: readonly GridPosition[],
): GridPosition[] | null {
  const { width, height } = ground;
  const key = (x: number, y: number) => y * width + x;
  const isGoal = (x: number, y: number) => goals.some((goal) => goal.x === x && goal.y === y);
  const from = new Int32Array(width * height).fill(-1);
  const startKey = key(start.x, start.y);
  from[startKey] = startKey;
  const queue = [startKey];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    const x = at % width;
    const y = (at - x) / width;
    if (isGoal(x, y)) {
      const line: GridPosition[] = [];
      for (let step = at; ; step = from[step]) {
        line.push({ x: step % width, y: Math.floor(step / width) });
        if (step === startKey) break;
      }
      return line.reverse();
    }
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || from[key(nx, ny)] !== -1) continue;
      if (ground.solid(nx, ny)) continue;
      const made = RACER_GROUND.has(ground.material(nx, ny));
      // The start is never asked (a racer steps off the verge onto the road),
      // and a goal may be off it (they step off the road to wait): nowhere else.
      if (!made && !isGoal(nx, ny)) continue;
      from[key(nx, ny)] = at;
      queue.push(key(nx, ny));
    }
  }
  return null;
}

const STEPS: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/**
 * A map's ground as a racer reads it: its collision, with every figure that
 * stands in the way of a run - townsfolk on every tile of their beat, trainers -
 * a wall too, because a racer who ran through people would be a ghost.
 */
export function raceGround(
  map: {
    readonly width: number;
    readonly height: number;
    readonly collision: readonly (readonly boolean[])[];
    readonly terrain: readonly (readonly Material[])[];
  },
  figures: readonly GridPosition[],
): RaceGround {
  const standing = new Set(figures.map((tile) => tile.y * map.width + tile.x));
  return {
    width: map.width,
    height: map.height,
    solid: (x, y) => map.collision[y][x] || standing.has(y * map.width + x),
    material: (x, y) => map.terrain[y][x],
  };
}
