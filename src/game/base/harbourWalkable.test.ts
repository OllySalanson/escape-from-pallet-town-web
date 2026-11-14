import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { BASE_LANDING, BASE_SIGNS, BASE_SPAWN, getBaseMap } from './baseMap';
import { DAY_CARE_KEEPER } from './dayCarePen';
import { BASE_DOORS } from './doors';
import { standingFixtures } from './fixtures';
import { harbourBeatTiles, harbourLifeAt, onLand } from './harbourLife';
import { gardenTiles } from './homeGarden';
import { HARBOUR_LANDMARKS } from './landmarks';

/**
 * The captain, 11 Nov 2026, of the filled maps: "when you're walking around,
 * there's just often things in your way, and it's quite fiddly to get through
 * places. For instance, like in the harbour, when you walk directly to the
 * east, in between it going from gravel to stone or whatever, there's just a
 * bench right in the middle, or like when you go on the beach, you kind of just
 * get all caught up in the parasols."
 *
 * So THE HARBOUR is held to walking two abreast, as Millbrook is
 * (`millbrook.test.ts`): a walker two tiles wide - which is what a street is -
 * gets from where a new visit starts and from where a raid comes home to every
 * door, sign, landmark, built fixture and person, to within the one last step a
 * porch is. Everybody counts as standing on every tile of their beat, and the
 * Bolthole's garden as full, because that is where a walker meets them. Before
 * this the yard, the quay, THE PROMENADE and THE COVE were four places a pair
 * could not walk between, and the Raid Arena - the door every raid goes through
 * - was behind a gap one tile wide.
 */
const EVERY_RUNG = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const CORNERS = [
  [0, 0],
  [-1, 0],
  [0, -1],
  [-1, -1],
] as const;

function harbourWalked(built: readonly string[], hour: 'day' | 'night') {
  const map = getBaseMap(built);
  const life = harbourLifeAt(hour).filter(onLand);
  const held = new Set<string>([
    ...life.flatMap((figure) => harbourBeatTiles(figure).map((tile) => `${tile.x},${tile.y}`)),
    `${DAY_CARE_KEEPER.position.x},${DAY_CARE_KEEPER.position.y}`,
    ...gardenTiles().map((tile) => `${tile.x},${tile.y}`),
  ]);
  const free = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < map.width && y < map.height && !map.collision[y][x] && !held.has(`${x},${y}`);
  const walk = (fits: (x: number, y: number) => boolean, starts: readonly (readonly [number, number])[]) => {
    const steps = Array.from({ length: map.height }, () => Array<number>(map.width).fill(-1));
    const queue = starts.filter(([x, y]) => fits(x, y)).map(([x, y]) => [x, y] as [number, number]);
    for (const [x, y] of queue) steps[y][x] = 0;
    for (let k = 0; k < queue.length; k += 1) {
      const [x, y] = queue[k];
      for (const [dx, dy] of STEPS) {
        if (fits(x + dx, y + dy) && steps[y + dy][x + dx] < 0) {
          steps[y + dy][x + dx] = steps[y][x] + 1;
          queue.push([x + dx, y + dy]);
        }
      }
    }
    return steps;
  };
  /** A pair side by side: the 2x2 block whose top-left is (x, y), all of it free. */
  const pair = (x: number, y: number) => free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1);
  const from = (start: GridPosition) => {
    const single = walk(free, [[start.x, start.y]]);
    const abreast = walk(pair, CORNERS.map(([ox, oy]) => [start.x + ox, start.y + oy] as const));
    const twoAbreast = (x: number, y: number): number => {
      const reached = CORNERS.map(([ox, oy]) => abreast[y + oy]?.[x + ox] ?? -1).filter((steps) => steps >= 0);
      return reached.length > 0 ? Math.min(...reached) : -1;
    };
    /** Steps to stand on a tile: two abreast all the way, or to beside it and one step in. */
    const toStand = (x: number, y: number): number => {
      if (!free(x, y)) return -1;
      const reached = [
        twoAbreast(x, y),
        ...STEPS.filter(([dx, dy]) => twoAbreast(x + dx, y + dy) >= 0 && free(x + dx, y + dy)).map(
          ([dx, dy]) => twoAbreast(x + dx, y + dy) + 1,
        ),
      ].filter((steps) => steps >= 0);
      return reached.length > 0 ? Math.min(...reached) : -1;
    };
    /** Steps to face something that stands on one of these tiles: to stand beside one. */
    const toFace = (tiles: readonly GridPosition[]): number => {
      const reached = tiles
        .flatMap((tile) => STEPS.map(([dx, dy]) => toStand(tile.x + dx, tile.y + dy)))
        .filter((steps) => steps >= 0);
      return reached.length > 0 ? Math.min(...reached) : -1;
    };
    return { single, twoAbreast, toStand, toFace };
  };
  return { map, life, free, from };
}

describe.each([
  ['nothing built', [] as readonly string[]],
  ['every rung built', EVERY_RUNG],
])('THE HARBOUR walked two abreast, with %s', (_name, built) => {
  describe.each(['day', 'night'] as const)('by %s', (hour) => {
    const harbour = harbourWalked(built, hour);

    it.each([
      ['where a visit starts', BASE_SPAWN],
      ['where a raid comes home', BASE_LANDING],
    ])('lands you %s with room to walk off two abreast', (_where, start) => {
      expect(harbour.from(start).twoAbreast(start.x, start.y)).toBe(0);
    });

    it.each([
      ['where a visit starts', BASE_SPAWN],
      ['where a raid comes home', BASE_LANDING],
    ])('reaches every door, sign, landmark, fixture and person two abreast from %s', (_where, start) => {
      const { toStand, toFace } = harbour.from(start);
      const places: { name: string; steps: number }[] = [
        // A door is gone through from its step, the one tile in front of it.
        ...BASE_DOORS.map((door) => ({ name: `the door of ${door.name}`, steps: toStand(door.returnTo.x, door.returnTo.y) })),
        ...BASE_SIGNS.map((sign) => ({ name: `the sign ${sign.lines[0]}`, steps: toFace([sign]) })),
        ...HARBOUR_LANDMARKS.map((landmark) => ({ name: landmark.name, steps: toFace(landmark.faced ?? [landmark.at]) })),
        ...standingFixtures(built).map((fixture) => ({ name: fixture.name, steps: toFace([fixture.at]) })),
        ...harbour.life.map((figure) => ({ name: figure.id, steps: toFace(harbourBeatTiles(figure)) })),
        { name: DAY_CARE_KEEPER.name, steps: toFace([DAY_CARE_KEEPER.position]) },
      ];
      expect(places.filter((place) => place.steps < 0).map((place) => place.name)).toEqual([]);
    });

    it('never makes a pair walk further than one walker would to a door', () => {
      // Longer two abreast is something standing in the shortest way and narrowing it to one tile.
      const longer = [BASE_SPAWN, BASE_LANDING].flatMap((start) => {
        const { single, toStand } = harbour.from(start);
        return BASE_DOORS.filter((door) => toStand(door.returnTo.x, door.returnTo.y) > single[door.returnTo.y][door.returnTo.x]).map(
          (door) =>
            `${door.name} from ${start.x},${start.y}: ${toStand(door.returnTo.x, door.returnTo.y)} two abreast, ${single[door.returnTo.y][door.returnTo.x]} single file`,
        );
      });
      expect(longer).toEqual([]);
    });

    it('never sends a pair the long way round along the water, from the jetty to the pier head', () => {
      // Places with no door: the docks under the warehouses (the upper quay
      // comes down to them by three tiles past the long pier's foot, and a
      // stack of crates on two of them sent a pair round by THE COVE), the
      // pier out to the S.S. Anne, THE COVE's jetty, the breakwater, the beach
      // and the pleasure pier's head. A pair rounds a corner a tile wider than
      // one walker does, so it is allowed two steps over; a detour is dozens.
      const along: readonly (readonly [string, number, number])[] = [
        ['the docks', 40, 20],
        ['the long pier', 28, 25],
        ['THE COVE', 54, 19],
        ['the breakwater', 59, 26],
        ['the beach', 70, 21],
        ['the pleasure pier’s head', 80, 28],
      ];
      const longer = [BASE_SPAWN, BASE_LANDING].flatMap((start) => {
        const { single, toStand } = harbour.from(start);
        return along
          .filter(([, x, y]) => toStand(x, y) < 0 || toStand(x, y) > single[y][x] + 2)
          .map(([name, x, y]) => `${name} from ${start.x},${start.y}: ${toStand(x, y)} two abreast, ${single[y][x]} single file`);
      });
      expect(longer).toEqual([]);
    });

    it('keeps KEEPERS’ ROW clear: nothing stands on the trodden path', () => {
      // Its two rows in front of the keepers' doors; Bill's cottage stands on
      // the earth where the row widens to the arena's forecourt.
      const blocked: string[] = [];
      for (const y of [12, 13]) {
        for (let x = 0; x < harbour.map.width; x += 1) {
          if (harbour.map.terrain[y][x] === 'earth' && !harbour.free(x, y)) blocked.push(`${x},${y}`);
        }
      }
      expect(blocked).toEqual([]);
    });

    it('walks straight east from the gravel to the end of the stone, two abreast, with nothing in the way', () => {
      // The captain's bench stood across this. KEEPERS' ROW's gravel runs on
      // over THE GREEN, both rows of it, to the DERBY's apron, where THE
      // PROMENADE's stone walk takes over a row lower: rows 12 and 13 as far
      // as the gravel goes, rows 13 and 14 from where the stone starts.
      const pathEnd = Math.max(...harbour.map.terrain[13].map((material, x) => (material === 'earth' ? x : -1)));
      const blocked: string[] = [];
      for (let x = BASE_SPAWN.x; x <= 86; x += 1) {
        if (!harbour.free(x, 13)) blocked.push(`${x},13`);
        if (x <= pathEnd && !harbour.free(x, 12)) blocked.push(`${x},12`);
        if (x >= pathEnd && !harbour.free(x, 14)) blocked.push(`${x},14`);
      }
      expect(blocked).toEqual([]);
      expect(pathEnd).toBe(60);
      expect(harbour.map.terrain[13][86]).toBe('stone');
    });

    it('keeps THE PROMENADE’s boardwalk walkable its whole length, lamps and all, and the lawn it is stepped off onto', () => {
      // From x 60: the tile of lawn at the boards' west end is the way on and
      // off them, and a Pidgey that pecked there was walked into coming west.
      const blocked: string[] = [];
      for (let x = 60; x <= 86; x += 1) {
        if (!harbour.free(x, 15)) blocked.push(`${x},15`);
      }
      expect(blocked).toEqual([]);
    });

    it('keeps a way along the beach at the water’s edge two abreast, from THE COVE to the pleasure pier', () => {
      // The parasols, the deckchairs and THE DIG's sign stood on it, and a
      // Krabby at the foot of the steps: walked along, the sand was one tile.
      const blocked: string[] = [];
      for (let x = 61; x <= 78; x += 1) {
        for (const y of [21, 22]) {
          if (!harbour.free(x, y)) blocked.push(`${x},${y}`);
        }
      }
      expect(blocked).toEqual([]);
    });

    it('keeps the foot of every set of steps down to the sand clear to the water', () => {
      const blocked: string[] = [];
      for (let x = 61; x <= 86; x += 1) {
        // A gap in the boardwalk's railing is a set of steps.
        if (!harbour.free(x, 15) || !harbour.free(x, 16) || harbour.map.terrain[16][x] !== 'boards') continue;
        for (let y = 17; y <= 22; y += 1) {
          if (!harbour.free(x, y)) blocked.push(`${x},${y}`);
        }
      }
      expect(blocked).toEqual([]);
    });
  });
});
