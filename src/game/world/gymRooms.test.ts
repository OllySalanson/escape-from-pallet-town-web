import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { getWorldMap } from '../worldMap';
import { builtInSpot } from './builtInSpots';
import { isFishingWater } from './fishing';
import type { MapFile } from './mapFile';
import { stepDistances } from './mapStructure';
import { builtInFileMap } from './playerMaps';
import { createRunTrainerEncounters, KOGA_GYM_HALL, MISTY_GYM_HALL } from './trainers';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from './valeQuarters';

/**
 * Cerulean Gym and Fuchsia Gym are FireRed's own rooms (`maker/areas.ts`):
 * a pool crossed by walkways with Misty across the water, and a maze of
 * partitions with Koga at the back. The playtest of 14 Nov 2026 found them
 * one tatami hall twice over, the swimmer on a dry mat and nothing of Koga's
 * in his - two gyms nobody who does not read the caption could tell apart.
 */

const VALE = 'greystone-vale' as const;
const file = (): MapFile => builtInFileMap(VALE)!.file;
const hall = (id: string) => file().areas!.find((area) => area.id === id)!;
const key = ({ x, y }: GridPosition): string => `${x},${y}`;
const encounter = (id: string) => createRunTrainerEncounters().find((one) => one.trainer.id === id)!;

/** Where the hall's mat is, in the played grid: where a player walks in. */
function matOf(area: string): GridPosition {
  const end = file()
    .links!.flatMap((link) => link.ends)
    .find((one) => 'area' in one && one.area === area)!;
  return builtInSpot(VALE, { area, x: end.x, y: end.y });
}

/** Everybody standing in the hall: its trainers, its leader and its Gym Guide. */
function standing(area: string, trainerIds: readonly string[]): GridPosition[] {
  const guide = file().people!.find((person) => person.area === area && person.name === 'Gym Guide')!;
  return [...trainerIds.map((id) => encounter(id).position), builtInSpot(VALE, { area, x: guide.x, y: guide.y })];
}

/** How many steps it takes to stand beside a tile, facing it, from the mat; -1 if nobody can. */
function stepsToSpeakTo(
  distances: readonly Int32Array[],
  { x, y }: GridPosition,
): number {
  const beside = [
    [x, y + 1],
    [x, y - 1],
    [x + 1, y],
    [x - 1, y],
  ]
    .map(([bx, by]) => distances[by]?.[bx] ?? -1)
    .filter((steps) => steps >= 0);
  return beside.length > 0 ? Math.min(...beside) : -1;
}

/** Whether a pair walking side by side - a two-by-two body - gets from the mat to the tile beside `to`. */
function twoAbreast(collision: readonly (readonly boolean[])[], blocked: ReadonlySet<string>, from: GridPosition, to: GridPosition): boolean {
  const free = (x: number, y: number): boolean => collision[y]?.[x] === false && !blocked.has(`${x},${y}`);
  const body = (x: number, y: number): boolean => free(x, y) && free(x + 1, y) && free(x, y + 1) && free(x + 1, y + 1);
  const holds = (x: number, y: number, at: GridPosition): boolean => at.x >= x && at.x <= x + 1 && at.y >= y && at.y <= y + 1;
  const start = [
    [from.x - 1, from.y - 1],
    [from.x, from.y - 1],
  ].find(([x, y]) => body(x, y));
  if (!start) {
    return false;
  }
  const seen = new Set([start.join(',')]);
  const queue = [start];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    if (holds(x, y, to)) {
      return true;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = [x + dx, y + dy];
      if (!seen.has(next.join(',')) && body(next[0], next[1])) {
        seen.add(next.join(','));
        queue.push(next);
      }
    }
  }
  return false;
}

const GYMS = [
  {
    name: 'Cerulean Gym',
    area: MISTY_GYM_HALL,
    style: 'cerulean-gym',
    leader: 'vale-gym-misty',
    trainers: ['vale-gym-misty-diana', 'vale-gym-misty-luis'],
  },
  {
    name: 'Fuchsia Gym',
    area: KOGA_GYM_HALL,
    style: 'fuchsia-gym',
    leader: 'vale-gym-koga',
    trainers: ['vale-gym-koga-nate', 'vale-gym-koga-phil'],
  },
] as const;

describe('the two gyms of Greystone Vale, each its own FireRed room', () => {
  it('dresses each hall as its own gym: a pool for Misty, a maze for Koga', () => {
    expect(hall(MISTY_GYM_HALL).style).toBe('cerulean-gym');
    expect(hall(KOGA_GYM_HALL).style).toBe('fuchsia-gym');
    const pool = hall(MISTY_GYM_HALL).ground.join('');
    expect(pool).toContain('W');
    expect(pool).toContain('_');
    const maze = hall(KOGA_GYM_HALL).ground.join('');
    expect(maze).toContain('F');
    expect(maze).not.toContain('W');
    expect(hall(MISTY_GYM_HALL).ground).not.toEqual(hall(KOGA_GYM_HALL).ground);
  });

  it.each(GYMS)('stands $name’s leader and trainers on ground, and nobody on the water or a partition', (gym) => {
    const map = getWorldMap(VALE, []);
    for (const id of [gym.leader, ...gym.trainers]) {
      const { x, y } = encounter(id).position;
      expect(`${id}: ${map.collision[y][x]} ${map.terrain[y][x]}`).toBe(`${id}: false ${map.terrain[y][x]}`);
      expect(['paving', 'boards']).toContain(map.terrain[y][x]);
    }
  });

  it.each(GYMS)('walks from $name’s mat to its leader past nobody, and to everybody in it', (gym) => {
    // Every gate open, so the leader's tile is the gym's and not a question of
    // which badges are held.
    const map = getWorldMap(VALE, [MISTY_BOSS_ID, KOGA_BOSS_ID]);
    const mat = matOf(gym.area);
    const people = standing(gym.area, [gym.leader, ...gym.trainers]);
    const blocked = new Set(people.map(key));
    const clear = stepDistances(map.collision, mat, new Set([key(encounter(gym.leader).position)]), map.links);
    const stood = stepDistances(map.collision, mat, blocked, map.links);
    const leader = encounter(gym.leader).position;
    // Reached, and by the same walk whoever stands in the hall: nobody is on it.
    expect(stepsToSpeakTo(stood, leader)).toBeGreaterThan(0);
    expect(stepsToSpeakTo(stood, leader)).toBe(stepsToSpeakTo(clear, leader));
    // And everybody else in the hall can be walked up to and spoken to.
    for (const person of people) {
      expect(`${key(person)}: ${stepsToSpeakTo(stood, person) > 0}`).toBe(`${key(person)}: true`);
    }
  });

  it.each(GYMS)('leaves nobody in $name walling off a tile: all of it is walked to from the mat, whoever stands in it', (gym) => {
    // The structure sweeps' rule (`mapStructure.testkit.ts`), asked of the hall
    // alone: Cerulean's statues were stood behind as FireRed's are, and the
    // Gym Guide at the head of the walk in shut the one way behind the west one.
    const map = getWorldMap(VALE, [MISTY_BOSS_ID, KOGA_BOSS_ID]);
    const people = standing(gym.area, [gym.leader, ...gym.trainers]);
    const blocked = new Set(people.map(key));
    const stood = stepDistances(map.collision, matOf(gym.area), blocked, map.links);
    const { width, height } = hall(gym.area);
    const origin = builtInSpot(VALE, { area: gym.area, x: 0, y: 0 });
    const shut: string[] = [];
    for (let y = origin.y; y < origin.y + height; y += 1) {
      for (let x = origin.x; x < origin.x + width; x += 1) {
        if (!map.collision[y][x] && !blocked.has(`${x},${y}`) && stood[y][x] < 0) {
          shut.push(`${x - origin.x},${y - origin.y}`);
        }
      }
    }
    expect(shut).toEqual([]);
  });

  it('keeps Misty’s pool a pool: water nobody walks on and nobody fishes in', () => {
    const map = getWorldMap(VALE, []);
    const pool = builtInSpot(VALE, { area: MISTY_GYM_HALL, x: 8, y: 12 });
    expect(map.terrain[pool.y][pool.x]).toBe('water');
    expect(map.collision[pool.y][pool.x]).toBe(true);
    expect(isFishingWater(map, pool)).toBe(false);
  });

  it('walks Koga’s maze two abreast, from the mat to the dais in front of him', () => {
    const map = getWorldMap(VALE, [MISTY_BOSS_ID, KOGA_BOSS_ID]);
    const blocked = new Set(standing(KOGA_GYM_HALL, ['vale-gym-koga', 'vale-gym-koga-nate', 'vale-gym-koga-phil']).map(key));
    const koga = encounter('vale-gym-koga').position;
    expect(twoAbreast(map.collision, blocked, matOf(KOGA_GYM_HALL), { x: koga.x, y: koga.y + 1 })).toBe(true);
  });

  it('puts the leader in view of the door on the smallest screen, the hall framed to the room', () => {
    // The smallest window is 20 by 15 tiles, and a room's camera keeps to the
    // room: standing on the mat, the window shows the bottom 15 rows of it.
    for (const gym of GYMS) {
      const { height } = hall(gym.area);
      const leaderRow = encounter(gym.leader).position.y - matOf(gym.area).y + (height - 1);
      expect(`${gym.name}: ${leaderRow >= height - 15}`).toBe(`${gym.name}: true`);
      expect(hall(gym.area).width).toBeLessThanOrEqual(20);
    }
  });
});
