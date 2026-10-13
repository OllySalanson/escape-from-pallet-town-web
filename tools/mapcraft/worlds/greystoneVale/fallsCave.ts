/**
 * The Falls Cave: the Lost Garden's one way in, behind the water at the foot of
 * the Power Station's dam (`plan.ts`).
 *
 * One floor, under the hill between the station and the garden, with a mouth
 * at each end: the station's opens into the chamber behind the falls, the
 * garden's into the sandy chamber under the garden's cliff. Between them is
 * Victory Road's rule (`switches.ts`): a rock barrier closes the way east until
 * both floor switches are thrown, and only a Strength boulder throws one.
 *
 * The floor is two halls joined by a neck one tile wide, and a boulder stands
 * in the neck - so the way through is past it, and a raid has to work out what
 * goes where. The west hall's boulder belongs on the west hall's switch, down
 * and round a corner; the boulder in the neck has to be pushed through it,
 * into the east hall, before anyone can follow; and the east hall's boulder
 * goes down onto the east hall's switch - unless the boulder from the neck was
 * pushed too far and stands in its road. A floor pushed wrong is put back by
 * walking out and in again (`WorldScene.resetBouldersLeftIn`), so getting it
 * wrong costs clock, never the raid. `fallsCave.test.ts` solves it.
 *
 * Drawn by hand, a letter a tile: `#` rock, `.` floor, `,` sand, `O` a Strength
 * boulder, `a` a floor switch, `X` the barrier, `1` and `2` the landings of the
 * station's mouth and the garden's.
 */
import type {
  MapFileArea,
  MapFileBoulder,
  MapFileItemSpot,
  MapFileLink,
} from '../../../../src/game/world/mapFile';
import { MATERIAL_CHARS } from '../../../../src/game/world/tileset/materials';
import type { Point } from '../../program';

const FLOOR = [
  '############################################',
  '############################################',
  '##########.....##############.....##########',
  '#########......###.........#.......#########',
  '########...O....#........O.........#########',
  '########.........#...###...........X......##',
  '#########.......O....##............X.......#',
  '########........#....#.............###.....#',
  '#########.......#.........a........###.....#',
  '##########.a...###.......##......####.....##',
  '##########...########.....##############..##',
  '###########...###########################..#',
  '###########....#########################...#',
  '####......#...##########################..##',
  '###...........################.............#',
  '##.............#############...............#',
  '##..............###########...............##',
  '#...............###########...............##',
  '#...............############...............#',
  '##..............############...............#',
  '##..............############......,,,......#',
  '###............#############.....,,,,,....##',
  '####..........###############.....,,,,...###',
  '#####.........#################...,,,....###',
  '#######.1.#########################.2.######',
  '############################################',
];

export const FALLS_CAVE_ID = 'falls-cave';
const NAME = 'Falls Cave';
/** The barrier's id, which both floor switches open. */
export const FALLS_BARRIER_ID = 'falls-barrier';

const at = (letter: string): Point[] =>
  FLOOR.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === letter ? [[x, y] as Point] : [])));
const one = (letter: string): Point => {
  const found = at(letter);
  if (found.length !== 1) throw new Error(`the Falls Cave has ${found.length} '${letter}'`);
  return found[0];
};

/** The station's landing and the garden's, in the cave's own tiles. */
export const FALLS_LANDINGS = { station: one('1'), garden: one('2') } as const;

/** The floor as the map file's area: its ground, its switches and its barrier. */
export function fallsCaveArea(): MapFileArea {
  const barrier = at('X');
  const ground = FLOOR.map((row) =>
    [...row]
      .map((cell) =>
        cell === '#'
          ? MATERIAL_CHARS.wall
          : cell === ','
            ? MATERIAL_CHARS.sand
            : MATERIAL_CHARS.paving,
      )
      .join(''),
  );
  return {
    id: FALLS_CAVE_ID,
    name: NAME,
    kind: 'cave',
    style: 'cave',
    width: FLOOR[0].length,
    height: FLOOR.length,
    ground,
    // Water running down the back wall of the chamber behind the falls.
    buildings: [{ x: 4, y: 12, kind: 'dripping-water' }],
    switches: at('a').map(([x, y]) => ({ x, y, kind: 'plate', opens: FALLS_BARRIER_ID })),
    barriers: [
      {
        id: FALLS_BARRIER_ID,
        x: barrier[0][0],
        y: barrier[0][1],
        width: 1,
        height: barrier.length,
      },
    ],
  };
}

/** The Strength boulders, where every raid finds them. */
export function fallsCaveBoulders(): MapFileBoulder[] {
  return at('O').map(([x, y]) => ({ x, y, area: FALLS_CAVE_ID }));
}

/** Something left behind in the dead end north of the east hall. */
export function fallsCaveSecrets(): MapFileItemSpot[] {
  return [{ x: 31, y: 2, area: FALLS_CAVE_ID, hidden: true }];
}

/**
 * The way through a mouth planted at `mouth` (a district's own tiles, as
 * `plantCaveMouth` takes it): out of the cave by its landing at that end.
 */
export function fallsMouthLink(end: keyof typeof FALLS_LANDINGS, mouth: Point): MapFileLink {
  const [x, y] = FALLS_LANDINGS[end];
  return {
    ends: [
      { x: mouth[0], y: mouth[1] + 1, toward: 'up', look: 'door' },
      { area: FALLS_CAVE_ID, x, y, toward: 'down', look: 'cave-exit' },
    ],
  };
}
