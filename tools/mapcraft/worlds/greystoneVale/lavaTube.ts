/**
 * The Lava Tube, under Ember Isle's cone: one floor of FireRed's Mt. Ember
 * (the Ruby Path, `ember` style), and the only way into the crater.
 *
 * It is drawn letter for letter, as a lava tube is a shape and not a maze: `#`
 * the red rock, `.` the ash floor, `o` a boulder fallen from the roof and `p`
 * a hot spring seeping out of the rock (its pool at its foot is stood in).
 * `S` is where it is come into from the cone's flank and `E` where it comes out
 * onto the crater floor, each a pocket with daylight in its south wall; `h` is
 * a find hidden in the dead end the tube forks into. All four are floor.
 *
 * It is chambers joined by necks, as the Ruby Path is: in from the flank at
 * the foot of the south-east chamber, up into the hall under the rim, and down
 * again through the west neck into the crater's pocket, so nobody sees the far
 * end from the near one. Off the hall, the spring's chamber and the dead end
 * the find is hidden in. Every step of its floor rolls for a wild Pokemon, as
 * a cave's does.
 */
import type { MapFileArea, MapFileBuilding, MapFileItemSpot, MapFileLink } from '../../../../src/game/world/mapFile';
import type { Point } from '../../program';

export const TUBE_FLOOR = [
  '##############################',
  '##############################',
  '##############################',
  '###.......######.........#####',
  '###........#####..........####',
  '###..o.....#####.....h....####',
  '####........####..........####',
  '####...p....#####.......######',
  '#####......#######......######',
  '######...##########...########',
  '######...##########...########',
  '#####............o.......#####',
  '####......................####',
  '####...o...........###....####',
  '#####.....#########.......####',
  '##.....############....#######',
  '##.....##########........#####',
  '##.....#########..........####',
  '##..o..########.....o.....####',
  '##.....#######............####',
  '###.E.#########..........#####',
  '#####################..S.#####',
  '##############################',
  '##############################',
];

export const TUBE_ID = 'lava-tube';

/** Where a mark is drawn on the floor. */
export function tubeMark(mark: string): Point[] {
  return TUBE_FLOOR.flatMap((row, y) => [...row].flatMap((letter, x) => (letter === mark ? [[x, y] as Point] : [])));
}

const GROUND: Readonly<Record<string, string>> = { '#': 'B', '.': 'P', o: 'P', p: 'P', S: 'P', E: 'P', h: 'P' };

/** The boulders, varied by where they stand so no two neighbours are drawn alike. */
const BOULDERS = ['ember-boulder', 'ember-boulder-low', 'ember-rocks'] as const;

export interface LavaTube {
  readonly area: MapFileArea;
  readonly links: readonly MapFileLink[];
  readonly secrets: readonly MapFileItemSpot[];
}

/**
 * The tube, joined to the two mouths cut into Ember Isle's rock: the cone's
 * flank over the top terrace, and the crater's north wall. Each mouth is where
 * its `cave-mouth` is planted, in the district's own tiles.
 */
export function lavaTube(flankMouth: Point, craterMouth: Point): LavaTube {
  const width = TUBE_FLOOR[0].length;
  const buildings: MapFileBuilding[] = [
    ...tubeMark('o').map(([x, y], index) => ({ area: TUBE_ID, x, y, kind: BOULDERS[(x * 7 + y * 3 + index) % BOULDERS.length] })),
    ...tubeMark('p').map(([x, y]) => ({ area: TUBE_ID, x, y, kind: 'hot-spring' as const })),
  ];
  const [flankExit] = tubeMark('S');
  const [craterExit] = tubeMark('E');
  return {
    area: {
      id: TUBE_ID,
      name: 'Lava Tube',
      kind: 'cave',
      style: 'ember',
      width,
      height: TUBE_FLOOR.length,
      ground: TUBE_FLOOR.map((row) => [...row].map((letter) => GROUND[letter]).join('')),
      buildings,
    },
    links: [
      {
        ends: [
          { x: flankMouth[0], y: flankMouth[1] + 1, toward: 'up', look: 'door' },
          { area: TUBE_ID, x: flankExit[0], y: flankExit[1], toward: 'down', look: 'cave-exit' },
        ],
      },
      {
        ends: [
          { x: craterMouth[0], y: craterMouth[1] + 1, toward: 'up', look: 'door' },
          { area: TUBE_ID, x: craterExit[0], y: craterExit[1], toward: 'down', look: 'cave-exit' },
        ],
      },
    ],
    secrets: tubeMark('h').map(([x, y]) => ({ area: TUBE_ID, x, y, hidden: true })),
  };
}
