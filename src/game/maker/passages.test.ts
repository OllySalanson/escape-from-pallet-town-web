import { describe, expect, it } from 'vitest';
import sampleLane from '../../maps/sample/sample-lane.json';
import { composeMapFile } from '../world/mapAreas';
import type { MapFile } from '../world/mapFile';
import { checkMapFile } from '../world/mapFileChecks';
import { doorEnd, makeInside } from './areas';
import { linkPassage, PASSAGE_PAIRS, passageEndAt } from './passages';

const SAMPLE = { ...(sampleLane as MapFile), maker: 'Probe' };

/**
 * The sample lane with two rock faces, a cave mouth in the foot of each, and
 * a cave behind the first: the second mouth is the one that leads nowhere.
 */
function laneWithTwoMouths(): { file: MapFile; cave: string } {
  const rock = (row: string, y: number): string => {
    let next = row;
    if (y >= 10 && y <= 14) {
      next = `${next.slice(0, 26)}CCCC${next.slice(30)}`;
    }
    if (y >= 2 && y <= 6) {
      next = `${next.slice(0, 6)}CCCC${next.slice(10)}`;
    }
    return next;
  };
  const lane: MapFile = {
    ...SAMPLE,
    ground: SAMPLE.ground.map(rock),
    // The rock covers two of the lane's finds, which move off it.
    itemSpots: SAMPLE.itemSpots.map((spot) =>
      spot.x === 28 && spot.y === 12
        ? { x: 25, y: 13 }
        : spot.x === 8 && spot.y === 5
          ? { x: 11, y: 7 }
          : spot,
    ),
    buildings: [
      ...SAMPLE.buildings,
      { kind: 'cave-mouth', x: 27, y: 14 },
      { kind: 'cave-mouth', x: 7, y: 6 },
    ],
  };
  const made = makeInside(lane, SAMPLE.buildings.length);
  if (!made.made) {
    throw new Error(made.reason);
  }
  return { file: made.file, cave: made.area };
}

const passing = (file: MapFile): readonly string[] =>
  checkMapFile(file)
    .filter((check) => !check.passed)
    .flatMap((check) => check.problems);

describe('a passage made in two clicks', () => {
  it('makes a second mouth a way into the cave there is, coming out of daylight in its south wall', () => {
    const { file, cave } = laneWithTwoMouths();
    // The second mouth leads nowhere until it is given somewhere.
    expect(passing(file)).toEqual([
      'The cave mouth at 7,6 leads nowhere: make its cave, or take it away.',
    ]);
    const start = passageEndAt(file, undefined, 'mouth', { x: 7, y: 6 });
    if (!start.placed) {
      throw new Error(start.reason);
    }
    expect(start.end).toEqual(doorEnd(file.buildings.at(-1)!));
    const end = passageEndAt(file, cave, PASSAGE_PAIRS.mouth, { x: 4, y: 15 });
    if (!end.placed) {
      throw new Error(end.reason);
    }
    expect(end.end).toEqual({ area: cave, x: 4, y: 14, toward: 'down', look: 'cave-exit' });
    const linked = linkPassage(file, start.end, end.end);
    if (!linked.linked) {
      throw new Error(linked.reason);
    }
    expect(passing(linked.file)).toEqual([]);
    // In play the cave has two ways out, each into its own mouth.
    const composed = composeMapFile(linked.file);
    expect(composed.doorways.filter((doorway) => doorway.look === 'cave-exit')).toHaveLength(2);
  });

  it('takes a ladder down from one cave into another, at the foot of a ladder up', () => {
    const { file, cave } = laneWithTwoMouths();
    const second = makeInside(file, file.buildings.length - 1);
    if (!second.made) {
      throw new Error(second.reason);
    }
    expect(second.area).not.toBe(cave);
    const hole = passageEndAt(second.file, cave, 'ladder-down', { x: 8, y: 5 });
    if (!hole.placed) {
      throw new Error(hole.reason);
    }
    expect(hole.end).toEqual({ area: cave, x: 8, y: 6, toward: 'up', look: 'ladder-down' });
    const foot = passageEndAt(second.file, second.area, PASSAGE_PAIRS['ladder-down'], {
      x: 6,
      y: 6,
    });
    if (!foot.placed) {
      throw new Error(foot.reason);
    }
    expect(foot.end).toEqual({ area: second.area, x: 6, y: 6, toward: 'up', look: 'ladder-up' });
    const linked = linkPassage(second.file, hole.end, foot.end);
    expect(linked.linked && passing(linked.file)).toEqual([]);
  });

  it('says where each end cannot go, and why', () => {
    const { file, cave } = laneWithTwoMouths();
    const refused = (
      area: string | undefined,
      look: Parameters<typeof passageEndAt>[2],
      x: number,
      y: number,
    ) => {
      const end = passageEndAt(file, area, look, { x, y });
      return end.placed ? 'placed' : end.reason;
    };
    // A hole in rock, a ladder on the boulder, daylight in the floor.
    expect(refused(cave, 'ladder-down', 0, 6)).toMatch(/clear floor/);
    expect(refused(cave, 'ladder-up', 4, 7)).toMatch(/clear floor/);
    expect(refused(cave, 'cave-exit', 6, 6)).toMatch(/south wall/);
    // The daylight's corner has no rock beside it on one side.
    expect(refused(cave, 'cave-exit', 0, 15)).toMatch(/south wall/);
    // A cave's ways go in a cave, and a mouth is outside and leads one way.
    expect(refused(undefined, 'ladder-down', 5, 5)).toMatch(/goes in a cave/);
    expect(refused(cave, 'mouth', 7, 6)).toMatch(/outside/);
    expect(refused(undefined, 'mouth', 27, 14)).toMatch(/leads somewhere already/);
    expect(refused(undefined, 'mouth', 5, 5)).toMatch(/Click a cave mouth/);
  });

  it('will not join a tile to itself', () => {
    const { file, cave } = laneWithTwoMouths();
    const end = { area: cave, x: 8, y: 6, toward: 'up', look: 'ladder-down' } as const;
    expect(linkPassage(file, end, end)).toMatchObject({ linked: false });
  });
});
