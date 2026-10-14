import { describe, expect, it } from 'vitest';
import { linkTable } from '../movement/gridMovement';
import { BUILT_IN_MAP_FILE_LIMITS, readMapFile, type MapFile, type MapFileArea } from './mapFile';
import { checkMapFile } from './mapFileChecks';
import { composeMapFile } from './mapAreas';
import { DEAD_LIFT_LINES, floorPrompt, liftAt, liftLinks, liftRuns, liftsOf } from './lifts';
import { playerLinks } from './sailing';
import type { WorldSwitch } from './switches';

/**
 * A lift (`lifts.ts`): one door on every floor it stops at, offering every
 * floor, dead until the switch that names it is thrown, and a way only the
 * player rides.
 */

/** A hideout floor: a room ten wide, its back wall two rows deep, a lift in it and a stair. */
function floor(id: string, name: string, extra: Partial<MapFileArea> = {}): MapFileArea {
  return {
    id,
    name,
    kind: 'inside',
    style: 'hideout',
    width: 12,
    height: 9,
    ground: [
      'CCCCCCCCCCCC',
      'CBBBBBBBBBBC',
      'CBBBBBBBBBBC',
      'CPPPPPPPPPPC',
      'CPPPPPPPPPPC',
      'CPPPPPPPPPPC',
      'CPPPPPPPPPPC',
      'CPPPPPPPPPPC',
      'CCCCCCCCCCCC',
    ],
    buildings: [],
    lift: { x: 3, y: 3, lift: 'the-lift' },
    ...extra,
  };
}

function bunker(overrides: Partial<MapFile> = {}): MapFile {
  return {
    format: 1,
    id: 'lifts',
    name: 'Lifts',
    maker: 'Tester',
    width: 20,
    height: 16,
    ground: Array.from({ length: 16 }, () => '.'.repeat(20)),
    buildings: [{ x: 4, y: 0, kind: 'power-plant' }],
    dropIns: [{ x: 10, y: 12, name: 'Yard' }],
    exits: [{ x: 1, y: 14, name: 'Gate', opens: { when: 'always' } }],
    itemSpots: [{ area: 'deep', x: 8, y: 6 }],
    wildlife: 'meadow',
    areas: [
      floor('upper', 'Upper', {
        switches: [{ x: 6, y: 3, kind: 'lever', opens: 'the-lift' }],
        buildings: [{ x: 5, y: 1, kind: 'hideout-generator' }],
      }),
      floor('deep', 'Deep'),
    ],
    links: [
      {
        ends: [
          { x: 8, y: 7, toward: 'up', look: 'door' },
          { area: 'upper', x: 8, y: 3, toward: 'right', look: 'stairs-down' },
        ],
      },
    ],
    ...overrides,
  };
}

const problemsOf = (file: MapFile): readonly string[] => {
  const reading = readMapFile(file, { limits: BUILT_IN_MAP_FILE_LIMITS });
  return reading.ok ? [] : reading.problems;
};

describe('a lift in a map file', () => {
  it('is read: a stop on each floor it serves, and the generator that runs it', () => {
    expect(problemsOf(bunker())).toEqual([]);
  });

  it('goes between two floors at least', () => {
    const file = bunker();
    const lonely = {
      ...file,
      areas: [file.areas![0], { ...file.areas![1], lift: undefined }],
    } as MapFile;
    expect(problemsOf(lonely)).toContain(
      "The lift 'the-lift' stops at one floor; a lift goes between two at least.",
    );
  });

  it('is run by a switch that names it, and a switch names something there is', () => {
    const file = bunker();
    const stray = {
      ...file,
      areas: [
        { ...file.areas![0], switches: [{ x: 6, y: 3, kind: 'lever', opens: 'nothing' }] },
        file.areas![1],
      ],
    } as MapFile;
    expect(problemsOf(stray)).toContain(
      "A switch opens 'nothing', and the map has no barrier or lift called that.",
    );
  });

  it('stops only in a building', () => {
    const file = bunker();
    const cave = {
      ...file.areas![1],
      kind: 'cave',
      style: 'cave',
      width: 12,
      height: 9,
    } as MapFileArea;
    expect(problemsOf({ ...file, areas: [file.areas![0], cave] })).toContain(
      "Area 2's lift stops in a building: a cave or a tunnel has none.",
    );
  });

  it('is laid out on the grid, a stop a floor, in the order the file lists them', () => {
    const composed = composeMapFile(bunker());
    expect(composed.lifts).toHaveLength(1);
    const [lift] = composed.lifts!;
    expect(lift.stops.map((stop) => stop.name)).toEqual(['Upper', 'Deep']);
    const upper = composed.areas.find((area) => area.id === 'upper')!.rect;
    expect(lift.stops[0].landing).toEqual({ x: upper.x + 3, y: upper.y + 3 });
    expect(liftsOf(bunker().areas!, composed.areas)).toEqual(composed.lifts);
  });

  it('is ridden by a player and never walked by the hunter', () => {
    const composed = composeMapFile(bunker());
    const [lift] = composed.lifts!;
    const links = linkTable(liftLinks(composed.lifts), composed.width);
    const from = lift.stops[0].landing;
    // Up into the door, from the tile in front of it.
    const key = (from.y * composed.width + from.x) * 4;
    expect([...links.keys()].some((linked) => Math.floor(linked / 4) === key / 4)).toBe(true);
    const map = { width: composed.width, links: new Map(), lifts: composed.lifts };
    expect(playerLinks(map)!.size).toBe(links.size);
    expect(playerLinks({ width: composed.width, links: new Map() })!.size).toBe(0);
    expect(liftAt(composed.lifts, from, 'up')?.stop).toBe(0);
    expect(liftAt(composed.lifts, from, 'left')).toBeUndefined();
  });

  it('runs once every switch naming it is thrown, and a lift no switch names always runs', () => {
    const generator: WorldSwitch = {
      id: 'g',
      mapId: 'player-lifts',
      position: { x: 0, y: 0 },
      kind: 'lever',
      opens: 'the-lift',
    };
    expect(liftRuns('the-lift', [generator], [])).toBe(false);
    expect(liftRuns('the-lift', [generator], ['g'])).toBe(true);
    expect(liftRuns('another-lift', [generator], [])).toBe(true);
  });

  it("asks FireRed's question, every floor offered and the cursor on this one", () => {
    const [lift] = composeMapFile(bunker()).lifts!;
    expect(floorPrompt(lift, 1)).toEqual({
      lines: ['Which floor do you want?'],
      options: ['UPPER', 'DEEP', 'EXIT'],
      selected: 1,
    });
    // As FireRed's panel lists B1F: what every floor's name shares is left off.
    const floors = ['Bunker B1F', 'Bunker B4F'].map((name) => ({ area: name, name, landing: { x: 0, y: 0 } }));
    expect(floorPrompt({ id: 'lift', stops: floors }, 0).options).toEqual(['B1F', 'B4F', 'EXIT']);
    expect(DEAD_LIFT_LINES[0]).toContain('elevator');
  });

  it('reaches what is only below it, and is not counted on the way out while it waits for its switch', () => {
    const checks = checkMapFile(bunker(), { limits: BUILT_IN_MAP_FILE_LIMITS });
    const failing = checks.filter((check) => !check.passed).flatMap((check) => check.problems);
    expect(failing).toEqual([]);
    // Dropped in below a lift that waits for its generator, a raid could not
    // leave: nobody has to bring a floor back to life to get out.
    const stranded = bunker({
      dropIns: [...bunker().dropIns, { area: 'deep', x: 6, y: 5, name: 'Down Here' }],
    });
    expect(
      checkMapFile(stranded, { limits: BUILT_IN_MAP_FILE_LIMITS }).flatMap(
        (check) => check.problems,
      ),
    ).toContain('Drop-in Down Here cannot walk to any exit.');
  });

  it("is let into a hideout's back wall, with wall either side of it", () => {
    const file = bunker();
    const plain = { ...file.areas![1], style: 'house' } as MapFileArea;
    const offWall = { ...file.areas![1], lift: { x: 3, y: 5, lift: 'the-lift' } } as MapFileArea;
    const problems = (areas: MapFileArea[]) =>
      checkMapFile({ ...file, areas }, { limits: BUILT_IN_MAP_FILE_LIMITS }).flatMap(
        (check) => check.problems,
      );
    expect(problems([file.areas![0], plain])).toContain(
      "The lift in Deep is the Rocket Hideout's: give the room the Rocket Hideout look.",
    );
    expect(problems([file.areas![0], offWall])).toContain(
      'The lift in Deep has to be let into the back wall, with wall either side of it.',
    );
  });
});

describe('a door locked to the Card Key', () => {
  const shuttered = (): MapFile => {
    const file = bunker();
    return {
      ...file,
      itemSpots: [...file.itemSpots, { x: 3, y: 12, key: true }],
      areas: [
        {
          ...file.areas![0],
          switches: [
            ...(file.areas![0].switches ?? []),
            { x: 5, y: 6, kind: 'key', opens: 'shutter' },
          ],
          barriers: [{ id: 'shutter', x: 5, y: 6, width: 2, height: 2, look: 'shutter' }],
        },
        file.areas![1],
      ],
    };
  };

  it('is a key switch standing in the shutter it opens', () => {
    expect(problemsOf(shuttered())).toEqual([]);
    const file = shuttered();
    const astray = {
      ...file,
      areas: [
        {
          ...file.areas![0],
          switches: [{ x: 2, y: 4, kind: 'key', opens: 'shutter' }, file.areas![0].switches![0]],
        },
        file.areas![1],
      ],
    } as MapFile;
    expect(problemsOf(astray)).toContain(
      "Area 1's switch 1 is a lock, and stands in no door it opens.",
    );
  });

  it("is FireRed's shutter, two tiles wide and two deep", () => {
    const file = shuttered();
    const wide = {
      ...file,
      areas: [
        {
          ...file.areas![0],
          barriers: [{ id: 'shutter', x: 5, y: 6, width: 3, height: 2, look: 'shutter' }],
        },
        file.areas![1],
      ],
    } as MapFile;
    expect(problemsOf(wide)).toContain(
      "Area 1's barrier 1 is a shutter, which FireRed draws two tiles wide and two deep.",
    );
  });

  it('is a lock the Card Key opens, so a card with only a door to open is not a stray', () => {
    const checks = checkMapFile(shuttered(), { limits: BUILT_IN_MAP_FILE_LIMITS });
    expect(checks.filter((check) => !check.passed).flatMap((check) => check.problems)).toEqual([]);
    const noCard = { ...shuttered(), itemSpots: bunker().itemSpots } as MapFile;
    expect(
      checkMapFile(noCard, { limits: BUILT_IN_MAP_FILE_LIMITS }).flatMap((check) => check.problems),
    ).toContain('The door at 5,6 in Upper is locked to the Card Key, and no item spot holds one.');
  });
});

describe('a locked crate in a map file', () => {
  it('stands only on a map the game draws', () => {
    const file = bunker({
      landmarks: [
        { area: 'deep', x: 6, y: 6, name: 'Strongroom', kind: 'strongroom', locked: true },
      ],
    });
    expect(problemsOf(file)).toEqual([]);
    const reading = readMapFile(file);
    expect(reading.ok ? [] : reading.problems).toContain(
      'A locked crate stands only on a map the game draws.',
    );
  });
});
