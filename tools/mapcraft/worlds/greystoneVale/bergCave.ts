/**
 * Berg Cave, under Frostreef's berg: two floors of FireRed's sliding ice
 * (Icefall Cave, `ice` style), and the only way from the shore the launch puts
 * in at to the frozen lagoon on the far side of the ridge.
 *
 * A step onto the ice carries on until something stops it (`slidingFloor.ts`),
 * so a floor is a puzzle of where you can stop, and the snowy boulders standing
 * on the ice are its answer. Each floor is drawn here as the puzzle it is,
 * letter for letter, because a puzzle is the drawing: `#` the rock, `.` the
 * cave's stone floor, which stops a slide, `I` the ice and `o` a boulder
 * standing on it. `S` and `E` are where a floor is come into and left by and
 * `h` a find hidden in a pocket only a slide reaches; all three are floor.
 *
 * Every floor is held by `bergCave.test.ts` to what makes a sliding puzzle
 * fair: its way on can be reached from its way in, and its way in from its way
 * on, and nowhere a slide can leave you is somewhere you cannot slide out of.
 *
 * - **1F**, in from the shore by the jetty: a stone landing, a sheet of ice
 *   round two crags of rock, and the hole down in its north-west corner,
 *   reached only by stopping against the right boulder.
 * - **B1F**, under the ridge: down the ladder in its north-east corner, a
 *   sheet round three crags, and the way out in its south wall onto the
 *   frozen lagoon.
 *
 * Every boulder on the ice is a stop some way across it needs: a boulder no
 * way across ever stops against is noise, and was taken out.
 */
import type { MapFileArea, MapFileBuilding, MapFileItemSpot, MapFileLink } from '../../../../src/game/world/mapFile';
import type { Point } from '../../program';

const FLOOR_1F = [
  '##############################',
  '##############################',
  '###...########################',
  '###.E...####IIIIIIIII..#######',
  '###.....##IIIIIIIIIIII...#####',
  '####..oIIIIIIIIIIII##III...###',
  '#####IIIIIIIII###IIII##IIIII##',
  '####IIIIIIIIII###IIIIIIIIIII##',
  '####IIIII###IIIIIIIIIIIIIIII##',
  '###IIIIII###IIIIIIIIIIIII.h.##',
  '###IIIIIIIIIIIIIIIIIIIIII...##',
  '####IIIIIIIIIIIIIIIIIIII######',
  '#####IIIIoIIII##IIIIIIII######',
  '######IIIIIII####IIIIII.######',
  '######..oIIIIIIIIIIII....#####',
  '#######.....IIIIIIII......####',
  '######................########',
  '#######...###........#########',
  '########....##.....###########',
  '#########.........############',
  '###########.S.################',
  '##############################',
];

const FLOOR_B1F = [
  '################################',
  '################################',
  '####################......######',
  '######IIIIIIIIIIIIIII..S..######',
  '####..IIIIIIIIIIIIIIIIII...#####',
  '####..III####IoIIIIIIIIIIIII####',
  '####IIIII####IIIIIII###IIIIIII##',
  '###IIIIIIIIIIIIIIIII###IIIIIII##',
  '###IIIIIIIIIIIIIIIIIIIIoIIIIIh##',
  '###IIIIIII###IIIIIIIIIIIIIIIII##',
  '###IIIIIII###IIIIIIIIII###IIII##',
  '###IIIIIIIIIIIIIIIIIIII###III###',
  '####IIIIIIIIIIIIIIIIIIIIIIII####',
  '####...IIIIIoIIIIIIIIIIIIII#####',
  '#####.....IIIIIIIIIIIIIII#######',
  '######.......IIIIIIIII##########',
  '#######..E..####################',
  '################################',
];

/** What a floor is drawn as, and where its marks are. */
export interface BergFloor {
  readonly id: string;
  readonly name: string;
  /** The puzzle as drawn, a row a string. */
  readonly rows: readonly string[];
}

export const BERG_FLOORS: readonly BergFloor[] = [
  { id: 'berg-cave-1f', name: 'Berg Cave', rows: FLOOR_1F },
  { id: 'berg-cave-b1f', name: 'Berg Cave B1F', rows: FLOOR_B1F },
];

/** Where a mark is drawn on a floor. */
export function markOf(floor: BergFloor, mark: string): Point[] {
  return floor.rows.flatMap((row, y) => [...row].flatMap((letter, x) => (letter === mark ? [[x, y] as Point] : [])));
}

const GROUND: Readonly<Record<string, string>> = { '#': 'B', '.': 'P', I: 'i', o: 'i', S: 'P', E: 'P', h: 'P' };

/** The boulders, varied by where they stand so no two neighbours are drawn alike. */
const BOULDERS = ['ice-boulder', 'ice-boulder-low', 'ice-boulder', 'ice-boulder-tall'] as const;

function areaOf(floor: BergFloor): MapFileArea {
  const width = Math.max(...floor.rows.map((row) => row.length));
  const buildings: MapFileBuilding[] = markOf(floor, 'o').map(([x, y], index) => ({
    area: floor.id,
    x,
    y,
    kind: BOULDERS[(x * 7 + y * 3 + index) % BOULDERS.length],
  }));
  return {
    id: floor.id,
    name: floor.name,
    kind: 'cave',
    style: 'ice',
    width,
    height: floor.rows.length,
    ground: floor.rows.map((row) => [...row.padEnd(width, '#')].map((letter) => GROUND[letter]).join('')),
    buildings,
  };
}

export interface BergCave {
  readonly areas: readonly MapFileArea[];
  readonly links: readonly MapFileLink[];
  readonly secrets: readonly MapFileItemSpot[];
}

/**
 * The cave, joined to the two mouths that are cut into Frostreef's rock: the
 * berg's foot on the jetty shore, onto 1F, and the ridge's foot over the
 * lagoon, onto B1F. Each mouth is where its `cave-mouth` is planted, in the
 * district's own tiles.
 */
export function bergCave(shoreMouth: Point, lagoonMouth: Point): BergCave {
  const [first, second] = BERG_FLOORS;
  const [shoreExit] = markOf(first, 'S');
  const [hole] = markOf(first, 'E');
  const [foot] = markOf(second, 'S');
  const [lagoonExit] = markOf(second, 'E');
  return {
    areas: BERG_FLOORS.map(areaOf),
    links: [
      {
        ends: [
          { x: shoreMouth[0], y: shoreMouth[1] + 1, toward: 'up', look: 'door' },
          { area: first.id, x: shoreExit[0], y: shoreExit[1], toward: 'down', look: 'cave-exit' },
        ],
      },
      {
        ends: [
          { area: first.id, x: hole[0], y: hole[1], toward: 'up', look: 'ladder-down' },
          { area: second.id, x: foot[0], y: foot[1], toward: 'up', look: 'ladder-up' },
        ],
      },
      {
        ends: [
          { x: lagoonMouth[0], y: lagoonMouth[1] + 1, toward: 'up', look: 'door' },
          { area: second.id, x: lagoonExit[0], y: lagoonExit[1], toward: 'down', look: 'cave-exit' },
        ],
      },
    ],
    secrets: BERG_FLOORS.flatMap((floor) =>
      markOf(floor, 'h').map(([x, y]) => ({ area: floor.id, x, y, hidden: true })),
    ),
  };
}
