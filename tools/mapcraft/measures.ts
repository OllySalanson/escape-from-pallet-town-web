/**
 * Design moves, measured: what a map does at the level a mapper thinks in -
 * how deep its border is, how much of it is road, how long its ledges are and
 * whether they stack into terraces, how its trees group, how much open ground
 * it leaves. Round 3 of the map research measured these on 23 FireRed and 18
 * Emerald routes from the pret decompilations and on our own districts; the
 * FireRed figures are `FIRERED_ROUTE_MEDIANS` in `patterns.ts`.
 *
 * They are descriptions, not rules: a number here says what a map is like, and
 * `patterns.ts` is where a number is compared with what human mappers do.
 */
import type { MapFile } from '../../src/game/world/mapFile';
import {
  boundingBox,
  readTiles,
  regions,
  STEPS,
  walkable,
  walkingSteps,
  WALL_KINDS,
  WALKABLE_KINDS,
  type TileMap,
  type TileRect,
} from './tiles';

export interface DesignMoves {
  /** Share of the map's rim that is wall. */
  readonly rimWall: number;
  /** How deep the border runs in from the top and bottom edges, tiles (median over columns). */
  readonly frameDepth: number;
  /** Typical width of the walkable passages, tiles. */
  readonly corridorWidth: number;
  /** Shares of the walkable ground. */
  readonly roadShare: number;
  readonly tallShare: number;
  /** Plain lawn and flowers: ground with nothing on it. */
  readonly plainShare: number;
  /** Tall-grass beds of four tiles or more: how many, median size, and how box-like (1 = a rectangle). */
  readonly beds: number;
  readonly bedSize: number;
  readonly bedBoxiness: number;
  /** Ledge runs: how many, median length, share ending against something at both ends, share stacked over another. */
  readonly ledges: number;
  readonly ledgeLen: number;
  readonly ledgeAnchored: number | null;
  readonly ledgeParallel: number | null;
  /** Free-standing groups of trees, bushes and rock (not touching the rim). */
  readonly clusters: number;
  readonly clusterSize: number;
  readonly clusterBoxiness: number;
  /** Groups of three trees or more whose exact shape appears more than once: a stamp. */
  readonly repeatedClusters: number;
  readonly waterBodies: number;
  readonly buildings: number;
  readonly fenceRuns: number;
  readonly flowerClusters: number;
  /** Share of flower groups that are a single tile. */
  readonly flowerScatter: number;
  /** The largest patch of plain lawn, as a share of the walkable ground: the open space. */
  readonly biggestQuiet: number;
  /** The longest walk between two openings in the rim, in steps. */
  readonly mainPath: number;
  /** Along that walk, how often what you pass changes, and how often it turns, per ten steps. */
  readonly eventsPer10: number;
  readonly turnsPer10: number;
  /** Share of 6x6 windows that occur more than once: stamping. */
  readonly repetition: number;
  /** Single solid tiles standing alone in walkable ground, per thousand tiles. */
  readonly crumbsPer1000: number;
}

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const mean = (values: readonly number[]): number =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const round2 = (value: number): number => Math.round(value * 100) / 100;
const boxiness = (region: readonly (readonly [number, number])[]): number => {
  const box = boundingBox(region);
  return region.length / (box.width * box.height);
};

/** A run of ledge along one row: its first and last x. */
export interface LedgeRun {
  readonly y: number;
  readonly x0: number;
  readonly x1: number;
}

export function ledgeRuns(map: TileMap): LedgeRun[] {
  const runs: LedgeRun[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (map.kinds[y][x] !== 'ledge') continue;
      let end = x;
      while (end + 1 < map.width && map.kinds[y][end + 1] === 'ledge') end += 1;
      runs.push({ y, x0: x, x1: end });
      x = end;
    }
  }
  return runs;
}

/** The free-standing groups of wood, bush and rock: everything in the open, not the border. */
export function freeClusters(map: TileMap): [number, number][][] {
  return regions(map, (kind) => kind === 'wood' || kind === 'bush' || kind === 'rock').filter(
    (region) =>
      !region.some(([x, y]) => x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1),
  );
}

/** A group's shape, wherever it stands: used to catch the same copse stamped twice. */
export function shapeKey(region: readonly (readonly [number, number])[]): string {
  const box = boundingBox(region);
  return region
    .map(([x, y]) => `${x - box.x},${y - box.y}`)
    .sort()
    .join(' ');
}

export function measureMoves(file: MapFile, crop?: TileRect): DesignMoves {
  return measureTileMap(readTiles(file, crop));
}

export function measureTileMap(map: TileMap): DesignMoves {
  const { width: W, height: H, kinds } = map;
  const area = W * H;
  const isWall = (x: number, y: number) => WALL_KINDS.has(kinds[y][x]);

  // 1. The border.
  const rim: boolean[] = [];
  for (let x = 0; x < W; x += 1) rim.push(isWall(x, 0), isWall(x, H - 1));
  for (let y = 1; y < H - 1; y += 1) rim.push(isWall(0, y), isWall(W - 1, y));
  const depths: number[] = [];
  for (let x = 0; x < W; x += 1) {
    let down = 0;
    while (down < H && isWall(x, down)) down += 1;
    let up = 0;
    while (up < H && isWall(x, H - 1 - up)) up += 1;
    depths.push(down, up);
  }

  // 2. Passage width: distance to the nearest non-walkable tile, read on the ridge.
  const distance = kinds.map((row) => row.map(() => Infinity));
  const queue: [number, number][] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!walkable(map, x, y)) {
        distance[y][x] = 0;
        queue.push([x, y]);
      }
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && distance[ny][nx] > distance[y][x] + 1) {
        distance[ny][nx] = distance[y][x] + 1;
        queue.push([nx, ny]);
      }
    }
  }
  const ridge: number[] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const d = distance[y][x];
      if (!(d < Infinity) || d === 0) continue;
      if (STEPS.every(([dx, dy]) => !(distance[y + dy]?.[x + dx] > d))) ridge.push(d);
    }
  }

  // 3. What the walkable ground is.
  const all = kinds.flat();
  const walkableCount = all.filter((kind) => WALKABLE_KINDS.has(kind)).length || 1;
  const share = (count: number) => round2(count / walkableCount);

  // 4. Tall grass beds.
  const beds = regions(map, (kind) => kind === 'grass').filter((region) => region.length >= 4);

  // 5. Ledges.
  const runs = ledgeRuns(map);
  const anchored = (x: number, y: number) => x < 0 || x >= W || !walkable(map, x, y);
  const stacked = runs.filter((run) =>
    runs.some(
      (other) =>
        other !== run &&
        other.y !== run.y &&
        Math.abs(other.x0 - run.x0) <= 1 &&
        Math.abs(other.x1 - run.x1) <= 1,
    ),
  );

  // 6. Free-standing groups.
  const clusters = freeClusters(map);
  const shapes = new Map<string, number>();
  for (const cluster of clusters) {
    // A lone tree or a pair (four or eight tiles) is the sheet's own unit and
    // repeats by nature; a stamp is a clump of three or more repeated exactly.
    if (cluster.length <= 8) continue;
    const key = shapeKey(cluster);
    shapes.set(key, (shapes.get(key) ?? 0) + 1);
  }

  // 7-8. Water, set pieces.
  const water = regions(map, (kind) => kind === 'water').filter((region) => region.length >= 4);
  const flowers = regions(map, (kind) => kind === 'flowers');

  // 9. Open ground.
  const quiet = regions(map, (kind) => kind === 'lawn');

  // 10. Rhythm along the longest walk between two openings in the rim.
  const openings: [number, number][] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && walkable(map, x, y))
        openings.push([x, y]);
    }
  }
  let path: [number, number][] = [];
  if (openings.length >= 2) {
    let best = -1;
    let from = openings[0];
    let to = openings[0];
    for (const start of openings.filter((_, index) => index % 3 === 0)) {
      const steps = walkingSteps(map, start);
      for (const end of openings) {
        const value = steps[end[1]][end[0]];
        if (value > best) {
          best = value;
          from = start;
          to = end;
        }
      }
    }
    const steps = walkingSteps(map, from);
    let here = to;
    path = [here];
    while (steps[here[1]][here[0]] > 0) {
      const back = STEPS.map(([dx, dy]) => [here[0] + dx, here[1] + dy] as [number, number]).find(
        ([x, y]) =>
          x >= 0 && y >= 0 && x < W && y < H && steps[y][x] === steps[here[1]][here[0]] - 1,
      );
      if (!back) break;
      here = back;
      path.push(here);
    }
  }
  const surroundings = (x: number, y: number): string => {
    const seen = new Set<string>();
    for (let j = -2; j <= 2; j += 1) {
      for (let i = -2; i <= 2; i += 1) {
        const kind = kinds[y + j]?.[x + i];
        if (kind) seen.add(kind === 'flowers' ? 'lawn' : kind);
      }
    }
    return [...seen].sort().join();
  };
  let changes = 0;
  for (let k = 1; k < path.length; k += 1)
    if (surroundings(...path[k]) !== surroundings(...path[k - 1])) changes += 1;
  let turns = 0;
  for (let k = 2; k < path.length; k += 1) {
    const a = [path[k - 1][0] - path[k - 2][0], path[k - 1][1] - path[k - 2][1]];
    const b = [path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]];
    if (a[0] !== b[0] || a[1] !== b[1]) turns += 1;
  }

  // 11. Repetition of 6x6 windows that are not all one thing.
  const windows = new Map<string, number>();
  for (let y = 0; y + 6 <= H; y += 1) {
    for (let x = 0; x + 6 <= W; x += 1) {
      let key = '';
      for (let j = 0; j < 6; j += 1) key += kinds[y + j].slice(x, x + 6).join('|') + '/';
      if (new Set(kinds.slice(y, y + 6).flatMap((row) => row.slice(x, x + 6))).size < 2) continue;
      windows.set(key, (windows.get(key) ?? 0) + 1);
    }
  }
  let repeated = 0;
  let windowCount = 0;
  for (const count of windows.values()) {
    windowCount += count;
    if (count > 1) repeated += count;
  }

  // 12. Crumbs: one solid tile alone in walkable ground.
  const crumbs = regions(map, (kind) => !WALKABLE_KINDS.has(kind) && kind !== 'ledge').filter(
    (region) =>
      region.length === 1 &&
      region.every(([x, y]) =>
        STEPS.every(([dx, dy]) => {
          const kind = kinds[y + dy]?.[x + dx];
          return kind === undefined || WALKABLE_KINDS.has(kind);
        }),
      ),
  );

  return {
    rimWall: round2(rim.filter(Boolean).length / rim.length),
    frameDepth: median(depths),
    corridorWidth: 2 * median(ridge) - 1,
    roadShare: share(all.filter((kind) => kind === 'road' || kind === 'ford').length),
    tallShare: share(all.filter((kind) => kind === 'grass').length),
    plainShare: share(all.filter((kind) => kind === 'lawn' || kind === 'flowers').length),
    beds: beds.length,
    bedSize: median(beds.map((region) => region.length)),
    bedBoxiness: round2(mean(beds.map(boxiness))),
    ledges: runs.length,
    ledgeLen: median(runs.map((run) => run.x1 - run.x0 + 1)),
    ledgeAnchored: runs.length
      ? round2(
          runs.filter((run) => anchored(run.x0 - 1, run.y) && anchored(run.x1 + 1, run.y)).length /
            runs.length,
        )
      : null,
    ledgeParallel: runs.length ? round2(stacked.length / runs.length) : null,
    clusters: clusters.length,
    clusterSize: median(clusters.map((region) => region.length)),
    clusterBoxiness: round2(mean(clusters.map(boxiness))),
    repeatedClusters: [...shapes.values()].filter((count) => count > 1).reduce((a, b) => a + b, 0),
    waterBodies: water.length,
    buildings: regions(map, (kind) => kind === 'building').length,
    fenceRuns: regions(map, (kind) => kind === 'fence').length,
    flowerClusters: flowers.length,
    flowerScatter: round2(
      flowers.filter((region) => region.length === 1).length / (flowers.length || 1),
    ),
    biggestQuiet: round2(Math.max(0, ...quiet.map((region) => region.length)) / walkableCount),
    mainPath: path.length,
    eventsPer10: path.length ? Math.round((100 * changes) / path.length) / 10 : 0,
    turnsPer10: path.length ? Math.round((100 * turns) / path.length) / 10 : 0,
    repetition: windowCount ? round2(repeated / windowCount) : 0,
    crumbsPer1000: Math.round((10000 * crumbs.length) / area) / 10,
  };
}
