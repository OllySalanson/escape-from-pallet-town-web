/**
 * Caves to get lost in: floors of chambers joined by winding passages, stacked
 * and joined by several ladders each, so the maze loops between floors as well
 * as on them.
 *
 * In the map research, floors drawn this way - rooms of different sizes inside
 * an irregular rim, a spanning tree of passages plus extra ones for loops, rows
 * of boulders standing as low walls in the big rooms, sand drifted into a few
 * rooms - scored level with FireRed's Mt. Moon 1F and just under Rock Tunnel.
 * A floor can be **sealed**: split into a west and an east half joined only
 * through the floors above and below it, which is what makes a stack of floors
 * a maze rather than a staircase.
 *
 * Everything here is the map file's own vocabulary: a cave area's letters
 * (`P` floor, `B` rock, `d` sand), its furniture (Mt. Moon's boulders, rocks,
 * craters and dripping water), and the ways through a cave has - a way out in
 * its south wall, ladders up and holes down - placed where the game's checks
 * expect them (`checkMapFile`).
 */
import type {
  MapFileArea,
  MapFileBuilding,
  MapFileItemSpot,
  MapFileLink,
} from '../../src/game/world/mapFile';
import type { MapProgram, Point, Random } from './program';

const FLOOR = 'P';
const ROCK = 'B';
const SAND = 'd';

interface Room {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  /** 0, or 1 for the east half of a sealed floor. */
  readonly half: number;
}

export interface CaveFloor {
  readonly ground: readonly string[];
  /** Rooms only one passage reaches: where a hidden item belongs. */
  readonly deadEnds: readonly Point[];
  /** Mt. Moon's own furniture: boulder rows as low walls in the big rooms, a crater in the biggest. */
  readonly furniture: readonly MapFileBuilding[];
  /** Passages beyond a spanning tree: how many ways round the floor has. */
  readonly loops: number;
  readonly sealed: boolean;
}

export interface CaveFloorOptions {
  readonly width: number;
  readonly height: number;
  readonly random: Random;
  /** How many rooms to try for: about one per 300 tiles reads like Mt. Moon. */
  readonly rooms?: number;
  /** How likely an extra passage between two rooms is. */
  readonly loops?: number;
  /** Split the floor into halves joined only through other floors. */
  readonly seal?: boolean;
}

export function chamberFloor({
  width,
  height,
  random,
  rooms = Math.round((width * height) / 300),
  loops = 0.9,
  seal = false,
}: CaveFloorOptions): CaveFloor {
  const g = Array.from({ length: height }, () => Array<string>(width).fill(ROCK));
  const inside = (x: number, y: number) => x >= 2 && y >= 3 && x < width - 2 && y < height - 2;

  const placed: Room[] = [];
  for (let tries = 0; tries < 2000 && placed.length < rooms; tries += 1) {
    const rx = random.int(3, 8);
    const ry = random.int(2, 5);
    const x = random.int(4 + rx, width - 5 - rx);
    const y = random.int(5 + ry, height - 4 - ry);
    if (
      placed.every(
        (room) =>
          Math.abs(room.x - x) > room.rx + rx + 3 || Math.abs(room.y - y) > room.ry + ry + 3,
      )
    ) {
      placed.push({ x, y, rx, ry, half: seal && x >= width / 2 ? 1 : 0 });
    }
  }
  for (const room of placed) {
    for (let j = -room.ry; j <= room.ry; j += 1) {
      for (let i = -room.rx; i <= room.rx; i += 1) {
        const x = room.x + i;
        const y = room.y + j;
        if (
          inside(x, y) &&
          (i / (room.rx + 0.5)) ** 2 + (j / (room.ry + 0.5)) ** 2 <= 1 - random.next() * 0.12
        )
          g[y][x] = FLOOR;
      }
    }
  }

  // Passages: a spanning tree inside each half, then extra ones for loops.
  const passages: [number, number][] = [];
  for (const half of seal ? [0, 1] : [0]) {
    const ids = placed.map((_, index) => index).filter((index) => placed[index].half === half);
    if (ids.length === 0) continue;
    const tree = new Set([ids[0]]);
    while (tree.size < ids.length) {
      let best: [number, number, number] | null = null;
      for (const a of tree) {
        for (const b of ids) {
          if (tree.has(b)) continue;
          const d = Math.abs(placed[a].x - placed[b].x) + Math.abs(placed[a].y - placed[b].y);
          if (!best || d < best[2]) best = [a, b, d];
        }
      }
      tree.add(best![1]);
      passages.push([best![0], best![1]]);
    }
    for (const a of ids)
      for (const b of ids)
        if (a < b && random.chance((loops / ids.length) * 2)) passages.push([a, b]);
  }
  const carve = (x: number, y: number, radius: number) => {
    for (let j = -radius; j <= radius; j += 1)
      for (let i = -radius; i <= radius; i += 1) if (inside(x + i, y + j)) g[y + j][x + i] = FLOOR;
  };
  for (const [a, b] of passages) {
    let { x, y } = placed[a];
    const target = placed[b];
    const radius = random.pick([1, 1, 2]);
    for (let guard = 0; (x !== target.x || y !== target.y) && guard < 500; guard += 1) {
      carve(x, y, radius);
      const dx = Math.sign(target.x - x);
      const dy = Math.sign(target.y - y);
      if (dx && (!dy || random.chance(0.55))) x += dx;
      else y += dy;
      if (random.chance(0.12)) {
        if (dx) y = Math.max(5, Math.min(height - 4, y + random.pick([-1, 1])));
        else x = Math.max(4, Math.min(width - 5, x + random.pick([-1, 1])));
      }
    }
  }

  // Sand drifted into a few rooms, never all of them.
  for (const room of placed) {
    if (!random.chance(0.35)) continue;
    const sx = room.x + random.pick([-1, 1]) * Math.floor(room.rx / 2);
    const sy = room.y + random.pick([-1, 1]) * Math.floor(room.ry / 2);
    const ax = Math.max(2, Math.floor(room.rx * 0.7));
    const ay = Math.max(2, Math.floor(room.ry * 0.8));
    for (let j = -ay; j <= ay; j += 1) {
      for (let i = -ax; i <= ax; i += 1) {
        if (
          g[sy + j]?.[sx + i] === FLOOR &&
          (i / (ax + 0.5)) ** 2 + (j / (ay + 0.5)) ** 2 <= 1 - random.next() * 0.2
        )
          g[sy + j][sx + i] = SAND;
      }
    }
  }

  // No crumbs of rock standing alone on the floor: pieces of five tiles or fewer become floor.
  const seen = g.map((row) => row.map(() => false));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (seen[y][x] || g[y][x] !== ROCK) continue;
      const piece: Point[] = [];
      const queue: [number, number][] = [[x, y]];
      seen[y][x] = true;
      while (queue.length > 0) {
        const [cx, cy] = queue.pop()!;
        piece.push([cx, cy]);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < width &&
            ny < height &&
            !seen[ny][nx] &&
            g[ny][nx] === ROCK
          ) {
            seen[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }
      if (piece.length <= 5) for (const [px, py] of piece) g[py][px] = FLOOR;
    }
  }

  // Furniture: boulder rows as low walls inside the big rooms, a crater in the biggest.
  const furniture: MapFileBuilding[] = [];
  for (const room of placed.filter((candidate) => candidate.rx >= 5 && candidate.ry >= 3)) {
    const vertical = random.chance(0.5);
    const length = random.int(3, Math.min(6, vertical ? room.ry * 2 - 1 : room.rx * 2 - 2));
    const ox = room.x + (vertical ? random.int(-2, 2) : -Math.floor(length / 2));
    const oy = room.y + (vertical ? -Math.floor(length / 2) : random.int(-1, 1));
    for (let k = 0; k < length; k += 1) {
      const x = vertical ? ox : ox + k;
      const y = vertical ? oy + k : oy;
      // A gap in the middle of a long row, so it is a wall to go round, not a seal.
      if (g[y]?.[x] === FLOOR && !(k === Math.floor(length / 2) && length > 4))
        furniture.push({ x, y, kind: k % 2 ? 'rocks' : 'boulder' });
    }
  }
  const biggest = [...placed].sort((a, b) => b.rx * b.ry - a.rx * a.ry)[0];
  if (biggest && g[biggest.y + 1]?.[biggest.x + 2] === FLOOR)
    furniture.push({ x: biggest.x + 2, y: biggest.y + 1, kind: 'crater' });

  const deadEnds = placed
    .filter((_, index) => passages.filter(([a, b]) => a === index || b === index).length === 1)
    .map((room): Point => [room.x, room.y]);
  return {
    ground: g.map((row) => row.join('')),
    deadEnds,
    furniture,
    loops: passages.length - (placed.length - (seal ? 2 : 1)),
    sealed: seal,
  };
}

/**
 * Where a ladder can stand: floor with floor on all four sides, at least
 * `apart` steps from every other ladder; `within` keeps it to one half of a
 * sealed floor.
 */
export function ladderSpots(
  ground: readonly string[],
  random: Random,
  count: number,
  {
    avoid = [],
    within = () => true,
    apart = 14,
  }: { avoid?: readonly Point[]; within?: (x: number, y: number) => boolean; apart?: number } = {},
): Point[] {
  const floor = (x: number, y: number) => ground[y]?.[x] === FLOOR;
  const spots: Point[] = [];
  for (let y = 3; y < ground.length - 3; y += 1) {
    for (let x = 3; x < ground[0].length - 3; x += 1) {
      if (
        within(x, y) &&
        floor(x, y) &&
        floor(x, y - 1) &&
        floor(x, y + 1) &&
        floor(x - 1, y) &&
        floor(x + 1, y)
      )
        spots.push([x, y]);
    }
  }
  const chosen: Point[] = [];
  for (let tries = 0; tries < 400 && chosen.length < count && spots.length > 0; tries += 1) {
    const spot = random.pick(spots);
    if (
      [...chosen, ...avoid].every(([x, y]) => Math.abs(x - spot[0]) + Math.abs(y - spot[1]) > apart)
    )
      chosen.push(spot);
  }
  return chosen;
}

/**
 * A rock face's foot where a cave mouth can be cut: rock at the tile and either
 * side of it and above it, and ground to stand on in front of it.
 */
export function caveMouthSpots(
  p: MapProgram,
  area: { x: number; y: number; width: number; height: number } = {
    x: 0,
    y: 0,
    width: p.width,
    height: p.height,
  },
): Point[] {
  const spots: Point[] = [];
  const rock = (x: number, y: number) => p.at(x, y) === 'C';
  const ground = (x: number, y: number) => ['.', 'd', 'P', ','].includes(p.at(x, y) ?? '');
  for (let y = area.y + 1; y < area.y + area.height - 2; y += 1) {
    for (let x = area.x + 1; x < area.x + area.width - 1; x += 1) {
      if (
        rock(x, y) &&
        rock(x - 1, y) &&
        rock(x + 1, y) &&
        rock(x, y - 1) &&
        ground(x, y + 1) &&
        ground(x, y + 2)
      )
        spots.push([x, y]);
    }
  }
  return spots;
}

/** One floor of a cave, as the map file's area. */
export interface CaveFloorPlan {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly seal?: boolean;
  readonly rooms?: number;
  readonly loops?: number;
}

export interface CaveMazeOptions {
  readonly floors: readonly CaveFloorPlan[];
  /** Ladders between floors: the floor above, the floor below, and how many. */
  readonly ladders: readonly (readonly [string, string, number])[];
  /** Cave mouths outdoors (planted with `plantCaveMouth`) and the floor each opens into. */
  readonly mouths: readonly { readonly at: Point; readonly floor: string }[];
  readonly random: Random;
  /** A hidden item in every so many dead-end rooms. */
  readonly secretsEvery?: number;
}

export interface CaveMaze {
  readonly areas: readonly MapFileArea[];
  readonly links: readonly MapFileLink[];
  /** Hidden item spots in dead-end rooms. */
  readonly secrets: readonly MapFileItemSpot[];
  readonly report: readonly {
    readonly floor: string;
    readonly size: string;
    readonly loops: number;
    readonly deadEnds: number;
    readonly sealed: boolean;
  }[];
}

/** Plants a cave mouth (rock lot) at a spot from `caveMouthSpots`. */
export function plantCaveMouth(p: MapProgram, [x, y]: Point): MapProgram {
  return p.building('cave-mouth', x, y, { lot: 'C' });
}

export function caveMaze({
  floors,
  ladders,
  mouths,
  random,
  secretsEvery = 3,
}: CaveMazeOptions): CaveMaze {
  const built = new Map(
    floors.map((plan) => {
      const floor = chamberFloor({
        width: plan.width,
        height: plan.height,
        random,
        rooms: plan.rooms,
        loops: plan.loops,
        seal: plan.seal,
      });
      return [plan.id, { plan, floor, ground: floor.ground.map((row) => [...row]) }] as const;
    }),
  );
  const floorOf = (id: string) => {
    const found = built.get(id);
    if (!found) throw new Error(`the cave has no floor '${id}'`);
    return found;
  };
  const links: MapFileLink[] = [];

  // Each mouth opens onto a way out cut into the middle of its floor's south wall.
  for (const mouth of mouths) {
    const { plan, ground } = floorOf(mouth.floor);
    const x = Math.floor(plan.width / 2);
    for (let y = plan.height - 6; y <= plan.height - 2; y += 1)
      for (let i = -1; i <= 1; i += 1) ground[y][x + i] = FLOOR;
    // On north until it meets the floor: no room may lie near the south wall,
    // and a way in that ends in rock is a cave you cannot enter.
    const open = (y: number) =>
      [-1, 0, 1].some((i) => ground[y][x + i] === FLOOR || ground[y][x + i] === SAND);
    for (let y = plan.height - 7; y >= 3 && !open(y); y -= 1)
      for (let i = -1; i <= 1; i += 1) ground[y][x + i] = FLOOR;
    for (let i = -1; i <= 1; i += 1) ground[plan.height - 1][x + i] = ROCK;
    links.push({
      ends: [
        { x: mouth.at[0], y: mouth.at[1] + 1, toward: 'up', look: 'door' },
        { area: plan.id, x, y: plan.height - 2, toward: 'down', look: 'cave-exit' },
      ],
    });
  }

  // Ladders: a hole on the floor above (walked into, upward), a ladder up on the
  // floor below (stood on at its foot). A sealed floor gets them on alternate halves.
  const used = new Map<string, Point[]>();
  const half = (plan: CaveFloorPlan, index: number) => (x: number) =>
    !plan.seal || (index % 2 === 0 ? x < plan.width / 2 - 3 : x > plan.width / 2 + 2);
  for (const [upper, lower, count] of ladders) {
    const above = floorOf(upper);
    const below = floorOf(lower);
    for (let k = 0; k < count; k += 1) {
      const hole = ladderSpots(
        above.ground.map((row) => row.join('')),
        random,
        1,
        { avoid: used.get(upper) ?? [], within: half(above.plan, k) },
      )[0];
      const foot = ladderSpots(
        below.ground.map((row) => row.join('')),
        random,
        1,
        { avoid: used.get(lower) ?? [], within: half(below.plan, k) },
      )[0];
      if (!hole || !foot) continue;
      used.set(upper, [...(used.get(upper) ?? []), hole]);
      used.set(lower, [...(used.get(lower) ?? []), foot]);
      links.push({
        ends: [
          { area: upper, x: hole[0], y: hole[1], toward: 'up', look: 'ladder-down' },
          { area: lower, x: foot[0], y: foot[1], toward: 'up', look: 'ladder-up' },
        ],
      });
    }
  }

  // Furniture keeps clear of every way through; water drips down a back wall or two.
  const ends = (id: string) =>
    links.flatMap((link) =>
      link.ends.filter((end) => end.area === id).map((end): Point => [end.x, end.y]),
    );
  const areas: MapFileArea[] = [];
  const secrets: MapFileItemSpot[] = [];
  const report: CaveMaze['report'][number][] = [];
  for (const { plan, floor, ground } of built.values()) {
    const ways = ends(plan.id);
    const clear = (x: number, y: number) =>
      ways.every(([wx, wy]) => Math.abs(wx - x) + Math.abs(wy - y) > 4);
    const furniture = floor.furniture.filter((piece) => clear(piece.x, piece.y));
    for (let k = 0; k < 2; k += 1) {
      const x = random.int(4, plan.width - 6);
      const onFloor = (fx: number, fy: number) =>
        ground[fy]?.[fx] === FLOOR || ground[fy]?.[fx] === SAND;
      if (
        ground[2][x] === ROCK &&
        ground[2][x + 1] === ROCK &&
        onFloor(x, 3) &&
        onFloor(x + 1, 3) &&
        clear(x, 3)
      )
        furniture.push({ x, y: 2, kind: 'dripping-water' });
    }
    areas.push({
      id: plan.id,
      name: plan.name,
      kind: 'cave',
      style: 'cave',
      width: plan.width,
      height: plan.height,
      ground: ground.map((row) => row.join('')),
      buildings: furniture,
    });
    floor.deadEnds.forEach(([x, y], index) => {
      const taken = furniture.some(
        (piece) => Math.abs(piece.x - x) <= 1 && Math.abs(piece.y - y) <= 1,
      );
      if (index % secretsEvery === 0 && ground[y]?.[x] !== ROCK && !taken && clear(x, y))
        secrets.push({ x, y, area: plan.id, hidden: true });
    });
    report.push({
      floor: plan.name,
      size: `${plan.width}x${plan.height}`,
      loops: floor.loops,
      deadEnds: floor.deadEnds.length,
      sealed: floor.sealed,
    });
  }
  return { areas, links, secrets, report };
}
