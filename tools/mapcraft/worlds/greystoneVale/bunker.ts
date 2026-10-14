/**
 * The Bunker: a wartime hideout under the Greystone power station, and the
 * vale's far place reached with a key and a machine (`plan.ts`).
 *
 * In through the power station's own door, into the turbine hall - FireRed's
 * Power Plant, gone quiet, its floor alive with what lives on the current -
 * and down the stair at the back of it to B1F, where a steel shutter stands
 * across the way on. Only FireRed's Card Key opens it (`MapFileSwitch`, a
 * `key`), the same card that opens the switchyard's Service Gate, which lies
 * in Pine Hollow one raid in five. Behind it the stairs go down to B2F, and
 * there they stop: B3F and B4F are reached only by the lift, and the lift is
 * dead (`lifts.ts`) until the generator on B2F is switched back on - across
 * a floor of FireRed's Rocket Hideout spinner arrows (`slidingFloor.ts`),
 * which carry whoever steps on one on until a stop plate or something in the
 * way stops them. B3F is the barracks and its stores; B4F the war room, its
 * strongroom - the vale's locked crate - and the escape hatch, the Bunker's
 * own way out.
 *
 * Every floor is FireRed's Rocket Hideout (`hideout` style), drawn as FireRed
 * draws it: rooms in the dark with a white rule round them, joined by
 * corridors two tiles wide. A floor is drawn here as a picture a letter a
 * tile, rooms first and then what is cut through them: `#` the dark, `=` a
 * back wall (two rows deep), `.` floor, `|` a partition of the maze, the
 * arrows `^ v < >` and the stop plate `o`. Marks on the floor are floor too:
 * `S` a stairs' end, `L` the lift's stop, `$` an item spot, `h` a hidden one.
 * `bunker.test.ts` holds every floor to what makes it fair - the generator
 * reached across the arrows from the stairs and the lift from the generator,
 * and nowhere a spin can leave you that you cannot get back from.
 */
import type {
  MapFileArea,
  MapFileBuilding,
  MapFileExit,
  MapFileFurnitureKind,
  MapFileItemSpot,
  MapFileLandmark,
  MapFileLink,
  MapFileSign,
  MapFileTrainer,
} from '../../../../src/game/world/mapFile';
import type { Point } from '../../program';

/** The lift every floor below B1F is reached by, and the generator's switch names. */
export const BUNKER_LIFT = 'bunker-lift';
/** The shutter across B1F's way on, which the Card Key opens. */
export const BUNKER_SHUTTER = 'bunker-shutter';

const GROUND: Readonly<Record<string, string>> = {
  '#': 'C',
  '=': 'B',
  '.': 'P',
  '|': 'F',
  '^': 'U',
  v: 'D',
  '<': 'K',
  '>': 'R',
  o: 'Z',
  S: 'P',
  L: 'P',
  $: 'P',
  h: 'P',
  // A find hidden on a stop plate, where only a spin that ends there finds it.
  q: 'Z',
};

/** A floor drawn a rectangle at a time: rooms in the dark, and what is cut through them. */
class Floor {
  readonly rows: string[][];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.rows = Array.from({ length: height }, () => Array<string>(width).fill('#'));
  }
  /** A room: its back wall two rows deep across the top, and floor below it to its foot. */
  room(x: number, y: number, width: number, height: number): this {
    return this.fill(x, y, width, 2, '=').fill(x, y + 2, width, height - 2, '.');
  }
  fill(x: number, y: number, width: number, height: number, letter: string): this {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        this.rows[row][column] = letter;
      }
    }
    return this;
  }
  /** Letters laid over what is there; a space leaves it alone. */
  draw(x: number, y: number, block: readonly string[]): this {
    block.forEach((line, dy) =>
      [...line].forEach((letter, dx) => {
        if (letter !== ' ') {
          this.rows[y + dy][x + dx] = letter;
        }
      }),
    );
    return this;
  }
  picture(): string[] {
    return this.rows.map((row) => row.join(''));
  }
}

/** Where a mark is drawn on a floor. */
export function marksOf(rows: readonly string[], mark: string): Point[] {
  return rows.flatMap((row, y) =>
    [...row].flatMap((letter, x) => (letter === mark ? [[x, y] as Point] : [])),
  );
}

function one(rows: readonly string[], mark: string, what: string): Point {
  const found = marksOf(rows, mark);
  if (found.length !== 1) throw new Error(`${what} has ${found.length} '${mark}'`);
  return found[0];
}

// --- The turbine hall: FireRed's Power Plant -----------------------------------

/**
 * The hall inside the station's door, FireRed's Power Plant gone quiet: four
 * generators standing in a row under the back wall of machinery, a second
 * wall of it across the hall with one aisle through, and in front of that the
 * floor you come in on - barrels, rubble, the consoles nobody reads - and the
 * stair down let into the dividing wall: the hideout's own stair, because
 * what goes down from here is the hideout. The mat is at the foot, under the
 * station's door.
 */
const HALL = (() => {
  const floor = new Floor(24, 16);
  floor.fill(0, 0, 24, 3, '=').fill(0, 3, 24, 13, '.');
  // The wall of machinery across the hall, with the aisle through its middle.
  floor.fill(0, 9, 10, 3, '=').fill(14, 9, 10, 3, '=');
  floor.draw(20, 12, ['S']);
  floor.draw(12, 15, ['M']);
  floor.draw(12, 4, ['h']);
  return floor.picture();
})();

const HALL_FURNITURE: readonly (readonly [MapFileFurnitureKind, number, number])[] = [
  ['power-girder-west', 0, 1],
  ['power-girder-east', 22, 1],
  ['power-generator', 2, 4],
  ['power-generator', 6, 4],
  ['power-generator-east', 15, 4],
  ['power-generator-east', 19, 4],
  ['power-console', 10, 3],
  ['power-console-dials', 13, 3],
  ['power-girder-west', 0, 10],
  ['power-girder-east', 22, 10],
  ['power-computer', 1, 12],
  ['power-barrel', 2, 13],
  ['power-barrel', 3, 13],
  ['power-barrel', 22, 13],
  ['power-rubble', 11, 7],
  ['power-rubble-low', 6, 13],
  ['power-rubble', 16, 14],
  ['power-rubble-low', 17, 14],
  ['power-console', 8, 12],
  ['power-grating', 11, 15],
  ['power-grating', 13, 15],
];

// --- B1F: the stair foot, the shutter, and the guard hall ------------------------

const B1F = (() => {
  const floor = new Floor(34, 22);
  // The stair foot, where the stair from the turbine hall comes down.
  floor.room(1, 1, 9, 6);
  floor.draw(3, 3, ['S']);
  // The store room above the hall.
  floor.room(13, 1, 12, 7);
  floor.draw(22, 5, ['$']);
  // The guard hall: the lift in its back wall, and the stairs down at its east end.
  floor.room(1, 11, 32, 10);
  floor.draw(12, 13, ['L']);
  floor.draw(28, 13, ['S']);
  floor.draw(31, 19, ['h']);
  // The corridor down from the stair foot, with the shutter across it, and the
  // one up from the hall to the store room.
  floor.fill(5, 7, 2, 6, '.');
  floor.fill(20, 8, 2, 5, '.');
  return floor.picture();
})();

const B1F_FURNITURE: readonly (readonly [MapFileFurnitureKind, number, number])[] = [
  ['hideout-vent', 6, 1],
  ['hideout-plant', 9, 3],
  ['hideout-crate', 14, 3],
  ['hideout-crate', 16, 3],
  ['hideout-crate', 14, 5],
  ['hideout-cabinet', 23, 2],
  ['hideout-phone', 18, 1],
  ['hideout-desk', 15, 14],
  ['hideout-stool', 14, 16],
  ['hideout-plan-table', 20, 15],
  ['hideout-console', 18, 12],
  ['hideout-vent', 8, 11],
  ['hideout-phone', 25, 11],
  ['hideout-plant', 2, 13],
  ['hideout-plant', 2, 17],
  ['hideout-cabinet', 31, 12],
  ['hideout-crate', 29, 18],
  ['hideout-sofa', 4, 18],
];

// --- B2F, B3F, B4F: drawn below ---------------------------------------------------

const B2F = [
  '##################################',
  '#================###=============#',
  '#================###=============#',
  '#....<<<<<<<<<<<|###...L.....S...#',
  '#....||||||||||^|###.............#',
  '#....|o>>o||o>>o|###.............#',
  '#|||v|^..v..^..v|###.............#',
  '#...v|^..v..^..v|###.............#',
  '#...v|o<<o>>o<<o|###.............#',
  '#...v|v..^..v..^|###.............#',
  '#...v|v..^..v..^|###.............#',
  '#.$.v|o>>o||o>>o|###.............#',
  '#...v|^..v..^..v|###.............#',
  '#...v|^..v..^..v|###.............#',
  '#...v|o<<o>>o<<o|###.............#',
  '#...v|v||^|||||v|===.............#',
  '#................===.............#',
  '#................................#',
  '#................................#',
  '#................###.............#',
  '#................###.............#',
  '##################################',
];

const B2F_FURNITURE: readonly (readonly [MapFileFurnitureKind, number, number])[] = [
  ['hideout-generator', 2, 1],
  ['hideout-crate', 1, 8],
  // Crates stacked in some of the squares between the arrows' lanes, as the
  // Rocket Warehouse stacks them through its spinner floor.
  ['hideout-crate', 7, 6],
  ['hideout-crate', 13, 9],
  ['hideout-crate', 10, 12],
  ['hideout-vent', 8, 1],
  ['hideout-vent', 13, 1],
  ['hideout-crate', 1, 17],
  ['hideout-crate', 11, 18],
  ['hideout-crate', 13, 18],
  ['hideout-console', 20, 2],
  ['hideout-phone', 26, 1],
  ['hideout-desk', 25, 7],
  ['hideout-stool', 24, 9],
  ['hideout-desk-plain', 29, 7],
  ['hideout-sofa', 21, 16],
  ['hideout-plant', 32, 3],
  ['hideout-plant', 32, 12],
  ['hideout-cabinet', 31, 16],
  ['hideout-plan-table', 23, 12],
  ['hideout-crate', 29, 16],
  ['hideout-crate', 27, 18],
];

const B3F = [
  '##################################',
  '#=========###============###=====#',
  '#=========###============###=====#',
  '#...L.....###|o>>o<<o>>o|###.....#',
  '#.........===|^..v..^..v|===...$.#',
  '#.........===|^..v..^..v|===.....#',
  '#............>o||o>>o||o>........#',
  '#............|v..^..v..^|........#',
  '#.........###|v..^..v..^|###.....#',
  '#.........###|o>>o<<q>>o|###.....#',
  '#####..######||||||||||||###.....#',
  '#####..#####################.$...#',
  '#####..#####################.....#',
  '#####..######################..###',
  '#####..======================..###',
  '#####..======================..###',
  '#####^^......................<<###',
  '#####^^......................<<###',
  '##################################',
];

const B3F_FURNITURE: readonly (readonly [MapFileFurnitureKind, number, number])[] = [
  ['hideout-vent', 7, 1],
  ['hideout-cabinet', 1, 2],
  ['hideout-plant', 9, 3],
  ['hideout-vent', 17, 1],
  ['hideout-vent', 21, 1],
  ['hideout-crate', 15, 4],
  ['hideout-crate', 21, 7],
  ['hideout-crate', 28, 3],
  ['hideout-crate', 28, 9],
  ['hideout-crate', 31, 9],
  ['hideout-phone', 30, 1],
  ['hideout-sofa', 2, 6],
];

const B4F = [
  '################################',
  '#==========###================##',
  '#==========###================##',
  '#...L......###................##',
  '#..........===................##',
  '#..........===................##',
  '#.............................##',
  '#.............................##',
  '#..........###.......W........##',
  '##############................##',
  '##############..............h.##',
  '##############................##',
  '##############................##',
  '##########################..####',
  '#==================###====..==##',
  '#==================###====..==##',
  '#..................###........##',
  '#...............E..===........##',
  '#..................===....R...##',
  '#.$...........................##',
  '#.............................##',
  '################################',
];

const B4F_FURNITURE: readonly (readonly [MapFileFurnitureKind, number, number])[] = [
  ['hideout-vent', 7, 1],
  ['hideout-plant', 1, 3],
  ['hideout-desk-plain', 6, 4],
  ['hideout-stool', 5, 6],
  ['hideout-plan-table', 18, 4],
  ['hideout-console', 15, 2],
  ['hideout-console', 16, 2],
  ['hideout-phone', 25, 1],
  ['hideout-desk', 25, 8],
  ['hideout-stool-east', 28, 10],
  ['hideout-cabinet', 28, 2],
  ['hideout-crate', 22, 16],
  ['hideout-crate', 28, 16],
  ['hideout-crate', 28, 18],
  ['hideout-cabinet', 24, 15],
  ['hideout-stairs-out', 16, 16],
  ['hideout-desk-plain', 4, 16],
  ['hideout-stool', 3, 18],
  ['hideout-crate', 9, 16],
  ['hideout-crate', 11, 16],
  ['hideout-sofa', 8, 18],
  ['hideout-plant', 1, 16],
  ['hideout-console', 13, 15],
];

/** A floor of the Bunker: its area's id, its name on the plate and the lift's panel, and its picture. */
export interface BunkerFloor {
  readonly id: string;
  readonly name: string;
  readonly rows: readonly string[];
  readonly style: 'hideout' | 'power-plant';
  readonly furniture: readonly (readonly [MapFileFurnitureKind, number, number])[];
}

export const BUNKER_FLOORS: readonly BunkerFloor[] = [
  {
    id: 'turbine-hall',
    name: 'Turbine Hall',
    rows: HALL,
    style: 'power-plant',
    furniture: HALL_FURNITURE,
  },
  { id: 'bunker-b1f', name: 'Bunker B1F', rows: B1F, style: 'hideout', furniture: B1F_FURNITURE },
  { id: 'bunker-b2f', name: 'Bunker B2F', rows: B2F, style: 'hideout', furniture: B2F_FURNITURE },
  { id: 'bunker-b3f', name: 'Bunker B3F', rows: B3F, style: 'hideout', furniture: B3F_FURNITURE },
  { id: 'bunker-b4f', name: 'Bunker B4F', rows: B4F, style: 'hideout', furniture: B4F_FURNITURE },
];

const floorNamed = (id: string): BunkerFloor => BUNKER_FLOORS.find((floor) => floor.id === id)!;

function areaOf(floor: BunkerFloor): MapFileArea {
  const width = floor.rows[0].length;
  const lift = marksOf(floor.rows, 'L')[0];
  const generator = floor.furniture.find(([kind]) => kind === 'hideout-generator');
  const shutter = floor.id === 'bunker-b1f' ? SHUTTER_AT : undefined;
  return {
    id: floor.id,
    name: floor.name,
    kind: 'inside',
    style: floor.style,
    width,
    height: floor.rows.length,
    ground: floor.rows.map((row) => [...row].map((letter) => GROUND[letter] ?? 'P').join('')),
    buildings: floor.furniture.map(([kind, x, y]): MapFileBuilding => ({ kind, x, y })),
    ...(lift ? { lift: { x: lift[0], y: lift[1], lift: BUNKER_LIFT } } : {}),
    ...(generator || shutter
      ? {
          switches: [
            // The generator's switch is its foot, faced from the floor below it.
            ...(generator
              ? [
                  {
                    x: generator[1] + 1,
                    y: generator[2] + 2,
                    kind: 'lever' as const,
                    opens: BUNKER_LIFT,
                  },
                ]
              : []),
            ...(shutter
              ? [{ x: shutter[0], y: shutter[1], kind: 'key' as const, opens: BUNKER_SHUTTER }]
              : []),
          ],
        }
      : {}),
    ...(shutter
      ? {
          barriers: [
            {
              id: BUNKER_SHUTTER,
              x: shutter[0],
              y: shutter[1],
              width: 2,
              height: 2,
              look: 'shutter' as const,
            },
          ],
        }
      : {}),
  };
}

/** Where B1F's shutter stands across the corridor from the stair foot. */
const SHUTTER_AT: Point = [5, 8];

export function bunkerAreas(): MapFileArea[] {
  return BUNKER_FLOORS.map(areaOf);
}

/**
 * The ways between the floors: the station's door into the turbine hall, from
 * the tile in front of it outdoors (`door`, a district's own tiles), the hall's
 * stair down to B1F, and B1F's down to B2F. Below that is the lift.
 */
export function bunkerLinks(door: Point): MapFileLink[] {
  const hall = floorNamed('turbine-hall');
  const b1f = floorNamed('bunker-b1f');
  const b2f = floorNamed('bunker-b2f');
  const mat = one(hall.rows, 'M', 'the turbine hall');
  const [hallDown] = marksOf(hall.rows, 'S');
  const [b1fUp, b1fDown] = marksOf(b1f.rows, 'S').sort((a, b) => a[0] - b[0]);
  const [b2fUp] = marksOf(b2f.rows, 'S');
  return [
    {
      ends: [
        { x: door[0], y: door[1], toward: 'up', look: 'door' },
        { area: hall.id, x: mat[0], y: mat[1], toward: 'down', look: 'mat' },
      ],
    },
    {
      ends: [
        { area: hall.id, x: hallDown[0], y: hallDown[1], toward: 'right', look: 'stairs-down' },
        { area: b1f.id, x: b1fUp[0], y: b1fUp[1], toward: 'left', look: 'stairs-up' },
      ],
    },
    {
      ends: [
        { area: b1f.id, x: b1fDown[0], y: b1fDown[1], toward: 'right', look: 'stairs-down' },
        { area: b2f.id, x: b2fUp[0], y: b2fUp[1], toward: 'left', look: 'stairs-up' },
      ],
    },
  ];
}

/** Every item spot in the Bunker: in the open, and hidden. */
export function bunkerItemSpots(): MapFileItemSpot[] {
  return BUNKER_FLOORS.flatMap((floor) => [
    ...marksOf(floor.rows, '$').map(([x, y]) => ({ area: floor.id, x, y })),
    ...[...marksOf(floor.rows, 'h'), ...marksOf(floor.rows, 'q')].map(([x, y]) => ({
      area: floor.id,
      x,
      y,
      hidden: true,
    })),
  ]);
}

/** The war room's cache, and the strongroom - the vale's locked crate. */
export function bunkerLandmarks(): MapFileLandmark[] {
  const b4f = floorNamed('bunker-b4f');
  const war = one(b4f.rows, 'W', 'B4F');
  const strong = one(b4f.rows, 'R', 'B4F');
  return [
    { area: b4f.id, x: war[0], y: war[1], name: 'War Room', kind: 'war-room' },
    {
      area: b4f.id,
      x: strong[0],
      y: strong[1],
      name: 'Strongroom',
      kind: 'strongroom',
      locked: true,
    },
  ];
}

/** The escape hatch: the Bunker's own way out, at the head of the stair out of B4F. */
export function bunkerExits(): MapFileExit[] {
  const b4f = floorNamed('bunker-b4f');
  const hatch = one(b4f.rows, 'E', 'B4F');
  return [
    { area: b4f.id, x: hatch[0], y: hatch[1], name: 'Escape Hatch', opens: { when: 'always' } },
  ];
}

/**
 * The ones who never left: a guard in B1F's hall, one in B3F's stores and one
 * in the war room, each a toll on the way down rather than a wall across it.
 */
export function bunkerTrainers(): MapFileTrainer[] {
  return [
    {
      area: 'bunker-b1f',
      x: 9,
      y: 17,
      name: 'Grunt',
      team: 'collier',
      look: 'rocket-grunt',
      facing: 'right',
      sight: 3,
      lines: ['Who let you down here? The shutter was locked!'],
    },
    {
      area: 'bunker-b3f',
      x: 31,
      y: 7,
      name: 'Grunt',
      team: 'netter',
      look: 'rocket-grunt-woman',
      facing: 'left',
      sight: 2,
      lines: ['You came through the arrows? Then you can go back the same way!'],
    },
    {
      area: 'bunker-b4f',
      x: 24,
      y: 11,
      name: 'Grunt',
      team: 'raider',
      look: 'rocket-grunt',
      facing: 'left',
      sight: 3,
      lines: ['The war room is off limits. Orders are orders!'],
    },
  ];
}

/** What the place says about itself: the hall's notice by the stair, and the lift's. */
export function bunkerSigns(): MapFileSign[] {
  return [
    {
      area: 'turbine-hall',
      x: 23,
      y: 12,
      lines: ['STAFF ONLY', 'Plant room below. Keep the shutter locked.'],
    },
    {
      area: 'bunker-b2f',
      x: 20,
      y: 5,
      lines: ['ELEVATOR', 'Runs off the B2F generator. If it stops, switch it back on.'],
    },
  ];
}
