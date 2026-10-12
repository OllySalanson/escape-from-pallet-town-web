/**
 * A map file read the way a mapper reads it: not letters, but what each tile
 * *is* - road, lawn, tall grass, wood, rock, water, fence, ledge, a building -
 * and whether a player can stand on it. The measures and the pattern checks
 * are asked of this, so they read a map the same way whether it was drawn by a
 * program, by hand in the map maker, or anywhere else a map file comes from.
 */
import { plantedProp, type MapFile } from '../../src/game/world/mapFile';

export type TileKind =
  | 'lawn'
  | 'flowers'
  | 'grass'
  | 'road'
  | 'ford'
  | 'water'
  | 'wood'
  | 'rock'
  | 'fence'
  | 'wall'
  | 'bush'
  | 'ledge'
  | 'building';

const KIND_OF_LETTER: Readonly<Record<string, TileKind>> = {
  '.': 'lawn',
  '"': 'lawn',
  '~': 'lawn',
  f: 'flowers',
  r: 'flowers',
  g: 'grass',
  d: 'road',
  P: 'road',
  ',': 'road',
  v: 'road',
  M: 'road',
  w: 'ford',
  W: 'water',
  T: 'wood',
  '#': 'wood',
  C: 'rock',
  F: 'fence',
  B: 'wall',
  o: 'bush',
  u: 'bush',
  k: 'bush',
  '<': 'ledge',
  '=': 'ledge',
  '>': 'ledge',
};

/** The kinds a player can stand on. A ledge is walked off, never stood on. */
export const WALKABLE_KINDS: ReadonlySet<TileKind> = new Set([
  'lawn',
  'flowers',
  'grass',
  'road',
  'ford',
]);

/**
 * The kinds that make a wall: what a border, a copse or an outcrop is built of.
 * A bush counts as wood, as FireRed's own one-tile trees do in the measures.
 */
export const WALL_KINDS: ReadonlySet<TileKind> = new Set([
  'wood',
  'bush',
  'rock',
  'water',
  'wall',
  'fence',
  'building',
]);

/** A rectangle in tiles. */
export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TileMap {
  readonly width: number;
  readonly height: number;
  /** `kinds[y][x]`. */
  readonly kinds: readonly (readonly TileKind[])[];
}

export function walkable(map: TileMap, x: number, y: number): boolean {
  const kind = map.kinds[y]?.[x];
  return kind !== undefined && WALKABLE_KINDS.has(kind);
}

/** Reads a map file's outdoor ground, or the part of it inside `crop`. */
export function readTiles(file: MapFile, crop?: TileRect): TileMap {
  const kinds: TileKind[][] = file.ground.map((row) =>
    [...row].map((letter) => {
      const kind = KIND_OF_LETTER[letter];
      if (!kind) throw new Error(`'${letter}' is not a ground letter mapcraft knows`);
      return kind;
    }),
  );
  for (const building of file.buildings) {
    if (building.area !== undefined) continue;
    const prop = plantedProp(building.kind);
    prop.cells.forEach((cell, index) => {
      const x = building.x + (index % prop.width);
      const y = building.y + Math.floor(index / prop.width);
      if (cell.solid && kinds[y]?.[x] !== undefined) kinds[y][x] = 'building';
    });
  }
  const { x, y, width, height } = crop ?? { x: 0, y: 0, width: file.width, height: file.height };
  return { width, height, kinds: kinds.slice(y, y + height).map((row) => row.slice(x, x + width)) };
}

/** Pieces of the map made of tiles `belongs` says yes to, joined edge to edge. */
export function regions(
  map: TileMap,
  belongs: (kind: TileKind, x: number, y: number) => boolean,
): [number, number][][] {
  const seen = map.kinds.map((row) => row.map(() => false));
  const found: [number, number][][] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (seen[y][x] || !belongs(map.kinds[y][x], x, y)) continue;
      const region: [number, number][] = [];
      const queue: [number, number][] = [[x, y]];
      seen[y][x] = true;
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        region.push([cx, cy]);
        for (const [dx, dy] of STEPS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen[ny][nx]) continue;
          if (!belongs(map.kinds[ny][nx], nx, ny)) continue;
          seen[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
      found.push(region);
    }
  }
  return found;
}

/**
 * Walking steps from `from` to every tile, -1 where it cannot be reached.
 * With `hops`, a ledge can be hopped southward, as the game lets a player.
 */
export function walkingSteps(
  map: TileMap,
  from: readonly [number, number],
  { hops = false }: { hops?: boolean } = {},
): Int32Array[] {
  const steps = map.kinds.map(() => new Int32Array(map.width).fill(-1));
  const [fx, fy] = from;
  if (!walkable(map, fx, fy)) return steps;
  steps[fy][fx] = 0;
  const queue: [number, number][] = [[fx, fy]];
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    for (const [dx, dy] of STEPS) {
      let nx = x + dx;
      let ny = y + dy;
      if (hops && dy === 1 && map.kinds[ny]?.[nx] === 'ledge') ny += 1;
      if (!walkable(map, nx, ny) || steps[ny][nx] !== -1) continue;
      steps[ny][nx] = steps[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return steps;
}

export function boundingBox(region: readonly (readonly [number, number])[]): TileRect {
  const xs = region.map(([x]) => x);
  const ys = region.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 };
}

export const STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
