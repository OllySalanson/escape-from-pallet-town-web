/**
 * The Greystone Caves: five floors under the east of the vale, with three
 * mouths - high in Greystone Peaks, in the rock outcrop in Tanglewood, and in
 * the sea cliffs of Gull Strand - so a group can go in at one end of the vale
 * and come out at another (`plan.ts`).
 *
 * Each mouth opens onto a floor of its own, and the floors are stacked so the
 * only way between the mouths is down and up again: the peaks open onto the
 * top floor, the wood one floor down, the sea at the bottom. The two middle
 * floors are sealed (`caves.ts`): each is two halves joined only through the
 * floors above and below, which is what makes the stack a maze rather than a
 * staircase. Every floor is drawn the way the research's best caves were -
 * rooms of different sizes in a ragged rim, winding passages with loops,
 * boulder rows, sand drifts - and every third dead end hides something.
 *
 * The floors are built once, whichever districts are drawn, so a mouth added
 * later never moves a floor: the floors, the ladders and the wood's mouth ride
 * in Tanglewood's file; a district with a mouth plants a `cave-mouth` at the
 * foot of a rock face and adds `caveMouthLink(mouth, at)` to its links. Until
 * then that mouth's way out is a passage into the south wall of its floor that
 * goes nowhere yet.
 */
import { caveMaze, type CaveMaze } from '../../caves';
import { seeded, type Point } from '../../program';
import type { MapFileArea, MapFileItemSpot, MapFileLink } from '../../../../src/game/world/mapFile';

export type CaveMouth = 'peaks' | 'wood' | 'sea';

/** Which floor each mouth opens onto: the peaks highest, the sea lowest. */
const MOUTH_FLOOR: Readonly<Record<CaveMouth, string>> = {
  peaks: 'greystone-caves-1f',
  wood: 'greystone-caves-b1f',
  sea: 'greystone-caves-b4f',
};

const FLOORS = [
  { id: 'greystone-caves-1f', name: 'Greystone Caves', width: 48, height: 40 },
  { id: 'greystone-caves-b1f', name: 'Greystone Caves B1F', width: 52, height: 42 },
  { id: 'greystone-caves-b2f', name: 'Greystone Caves B2F', width: 56, height: 44, seal: true },
  { id: 'greystone-caves-b3f', name: 'Greystone Caves B3F', width: 56, height: 44, seal: true },
  { id: 'greystone-caves-b4f', name: 'Greystone Caves B4F', width: 52, height: 40 },
] as const;

/**
 * Ladders, the floor above first: two between each pair of floors, landing on
 * alternate halves of a sealed one, and one long drop from the wood's floor
 * past the first sealed floor, so there is more than one way down.
 */
const LADDERS: readonly (readonly [string, string, number])[] = [
  ['greystone-caves-1f', 'greystone-caves-b1f', 2],
  ['greystone-caves-b1f', 'greystone-caves-b2f', 2],
  ['greystone-caves-b2f', 'greystone-caves-b3f', 2],
  ['greystone-caves-b3f', 'greystone-caves-b4f', 2],
  ['greystone-caves-b1f', 'greystone-caves-b3f', 1],
];

/** The outdoor tile each mouth link is written against; a district's own tiles. */
const STAND_IN: Point = [0, 0];

/** The whole cave: every floor, every ladder between them, and the hidden finds. */
export function greystoneCaves(): CaveMaze {
  return caveMaze({
    floors: FLOORS,
    ladders: LADDERS,
    mouths: (Object.keys(MOUTH_FLOOR) as CaveMouth[]).map((mouth) => ({
      at: STAND_IN,
      floor: MOUTH_FLOOR[mouth],
    })),
    random: seeded(1871),
    secretsEvery: 3,
  });
}

/** The ladders between floors: every link that has no outdoor end. */
export function caveLadders(cave: CaveMaze): MapFileLink[] {
  return cave.links.filter((link) => link.ends.every((end) => end.area !== undefined));
}

/**
 * The link from a cave mouth planted at `at` (a district's own tiles, as
 * `plantCaveMouth` takes it) to the way out of its floor.
 */
export function caveMouthLink(cave: CaveMaze, mouth: CaveMouth, at: Point): MapFileLink {
  const floor = MOUTH_FLOOR[mouth];
  const link = cave.links.find(
    (candidate) =>
      candidate.ends[0].area === undefined && candidate.ends[1].area === floor,
  );
  if (!link) throw new Error(`the cave has no way out onto ${floor}`);
  return { ends: [{ ...link.ends[0], x: at[0], y: at[1] + 1 }, link.ends[1]] };
}

/**
 * B5F, the deepest floor: Stormcrown's way in (`plan.ts`). It is a maze of its
 * own seed, built apart from the five floors above, so drawing it moved none of
 * them. One hole joins it to the rest: in the corner of B4F furthest from the
 * sea cave, which is the floor's only way in from outside, it drops to the end
 * of B5F furthest from the Chimney - so a raid down here walks the whole of the
 * deepest floor, and before it the whole of B4F, to come out on Stormcrown's
 * lower shoulder. The floors above are not touched: a hole is a link, and
 * B4F's ground is the ground every other district carries.
 */
export const DEEPEST_FLOOR = 'greystone-caves-b5f';

export interface DeepFloor {
  /** B5F, as the map file's area. */
  readonly area: MapFileArea;
  /** The hole in B4F down to B5F. */
  readonly hole: MapFileLink;
  /** Hidden finds in B5F's dead ends. */
  readonly secrets: readonly MapFileItemSpot[];
}

export function greystoneDeep(cave: CaveMaze = greystoneCaves()): DeepFloor {
  const deep = deepMaze();
  const area = deep.areas[0];
  const above = cave.areas.find((candidate) => candidate.id === 'greystone-caves-b4f');
  if (!above) throw new Error('the cave has no B4F');
  const hole = furthestSpot(above, endsOn(cave.links, above.id));
  const foot = furthestSpot(area, endsOn(deep.links, area.id));
  const nearFoot = (x: number, y: number) => Math.abs(x - foot[0]) + Math.abs(y - foot[1]) <= 4;
  return {
    area: { ...area, buildings: area.buildings.filter((piece) => !nearFoot(piece.x, piece.y)) },
    hole: {
      ends: [
        { area: above.id, x: hole[0], y: hole[1], toward: 'up', look: 'ladder-down' },
        { area: area.id, x: foot[0], y: foot[1], toward: 'up', look: 'ladder-up' },
      ],
    },
    secrets: deep.secrets.filter((spot) => !nearFoot(spot.x, spot.y)),
  };
}

/** The link from the Chimney, a cave mouth planted at `at` in Stormcrown, to B5F's way out. */
export function chimneyLink(at: Point): MapFileLink {
  const link = deepMaze().links[0];
  return { ends: [{ ...link.ends[0], x: at[0], y: at[1] + 1 }, link.ends[1]] };
}

/**
 * B5F alone, on a seed of its own: wider and deeper than any floor above, with
 * fewer loops, so it is the hardest to cross; a find in every other dead end,
 * because nobody comes down here.
 */
function deepMaze(): CaveMaze {
  return caveMaze({
    floors: [{ id: DEEPEST_FLOOR, name: 'Greystone Caves B5F', width: 60, height: 56, loops: 0.6 }],
    ladders: [],
    mouths: [{ at: STAND_IN, floor: DEEPEST_FLOOR }],
    random: seeded(5159),
    secretsEvery: 2,
  });
}

/** The tiles of a floor that links stand on. */
function endsOn(links: readonly MapFileLink[], area: string): Point[] {
  return links.flatMap((link) =>
    link.ends.filter((end) => end.area === area).map((end): Point => [end.x, end.y]),
  );
}

/**
 * The floor tile furthest to walk from the floor's first way through, with
 * floor on all four sides and nothing standing within four steps of it: where
 * the hole is cut, and where its ladder stands below. Ties go north, then west.
 */
function furthestSpot(area: MapFileArea, ways: readonly Point[]): Point {
  const solid = new Set(area.buildings.map((piece) => `${piece.x},${piece.y}`));
  const floor = (x: number, y: number) =>
    (area.ground[y]?.[x] === 'P' || area.ground[y]?.[x] === 'd') && !solid.has(`${x},${y}`);
  const steps = new Map<string, number>([[`${ways[0][0]},${ways[0][1]}`, 0]]);
  const queue: Point[] = [ways[0]];
  for (let head = 0; head < queue.length; head += 1) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next: Point = [x + dx, y + dy];
      if (!floor(...next) || steps.has(`${next[0]},${next[1]}`)) continue;
      steps.set(`${next[0]},${next[1]}`, steps.get(`${x},${y}`)! + 1);
      queue.push(next);
    }
  }
  const clear = (x: number, y: number) =>
    [...ways, ...area.buildings.map((piece): Point => [piece.x, piece.y])].every(
      ([wx, wy]) => Math.abs(wx - x) + Math.abs(wy - y) > 4,
    );
  let best: [Point, number] | undefined;
  for (const [key, distance] of steps) {
    const [x, y] = key.split(',').map(Number);
    if (area.ground[y][x] !== 'P') continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => area.ground[y + dy]?.[x + dx] === 'P'))
      continue;
    if (!clear(x, y)) continue;
    if (!best || distance > best[1] || (distance === best[1] && (y < best[0][1] || (y === best[0][1] && x < best[0][0]))))
      best = [[x, y], distance];
  }
  if (!best) throw new Error(`${area.id} has no floor for a hole`);
  return best[0];
}
