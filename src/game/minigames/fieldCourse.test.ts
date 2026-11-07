import { describe, expect, it } from 'vitest';
import type { Direction } from '../movement/gridMovement';
import type { FieldMoveId } from '../world/fieldMoves';
import {
  advanceCourse,
  COURSES,
  courseMovesOf,
  facedObstacle,
  fastestRun,
  FIELD_MOVE_BEAT_MS,
  PROMENADE_COURSE,
  readCourse,
  startCourse,
  type CourseRun,
} from './fieldCourse';
import { COURSE_TICKET_TIERS, courseTickets } from './tickets';

const ALL_MOVES: readonly FieldMoveId[] = ['cut', 'surf', 'strength', 'rock-smash'];

/** Every set of the four field moves a team could bring, the empty one included. */
const EVERY_MOVE_SET: readonly (readonly FieldMoveId[])[] = Array.from({ length: 16 }, (_, mask) =>
  ALL_MOVES.filter((_, bit) => mask & (1 << bit)),
);

const teamMoves = (team: readonly string[]): readonly FieldMoveId[] => [...new Set(team.flatMap(courseMovesOf))];
const fastest = (team: readonly string[]): number => fastestRun(PROMENADE_COURSE, teamMoves(team))!.ms;

describe('who can do what on THE FIELD-MOVE COURSE', () => {
  it("is FireRed's own HM lists: Bulbasaur and Charmander cut, Squirtle surfs, all three push and smash", () => {
    expect(courseMovesOf('bulbasaur')).toEqual(['cut', 'strength', 'rock-smash']);
    expect(courseMovesOf('charmander')).toEqual(['cut', 'strength', 'rock-smash']);
    expect(courseMovesOf('squirtle')).toEqual(['surf', 'strength', 'rock-smash']);
  });

  it('lets a Krabby do all four on its own, and a Pikachu and Pidgeotto neither CUT nor SURF', () => {
    expect(courseMovesOf('krabby')).toEqual(ALL_MOVES);
    const wrong = teamMoves(['pikachu', 'pidgeotto']);
    expect(wrong).not.toContain('cut');
    expect(wrong).not.toContain('surf');
  });
});

describe('every course', () => {
  it.each(COURSES.map((layout) => [layout.id, layout] as const))('%s can be finished by any team, the long way round with nothing at all', (_, layout) => {
    const course = readCourse(layout);
    expect(course.obstacles.map((obstacle) => obstacle.kind).sort()).toEqual(['cut', 'pond', 'smash']);
    expect(course.boulders).toHaveLength(1);
    for (const moves of EVERY_MOVE_SET) {
      expect(fastestRun(layout, moves), `moves: ${moves.join(',') || 'none'}`).not.toBeNull();
    }
  });

  it.each(COURSES.map((layout) => [layout.id, layout] as const))('%s makes every field move worth having on its own', (_, layout) => {
    const none = fastestRun(layout, [])!.ms;
    for (const move of ALL_MOVES) {
      expect(fastestRun(layout, [move])!.ms, move).toBeLessThan(none);
    }
  });
});

describe('who is good at the course', () => {
  it('is quickest with a Krabby alone, as quick as a Bulbasaur with a Squirtle', () => {
    expect(fastest(['krabby'])).toBe(fastestRun(PROMENADE_COURSE, ALL_MOVES)!.ms);
    expect(fastest(['bulbasaur', 'squirtle'])).toBe(fastest(['krabby']));
  });

  it('is slower with any one starter, slower still with a strong team that cannot CUT or SURF', () => {
    for (const starter of ['bulbasaur', 'charmander', 'squirtle']) {
      expect(fastest([starter])).toBeGreaterThan(fastest(['krabby']));
      expect(fastest([starter])).toBeLessThan(fastest(['pikachu', 'pidgeotto']));
    }
    expect(fastest(['pikachu', 'pidgeotto'])).toBeLessThan(fastestRun(PROMENADE_COURSE, [])!.ms);
  });

  it('pays its top tier only to a team with CUT and SURF, and something to anybody who gets round', () => {
    const [first, , third] = COURSE_TICKET_TIERS;
    expect(fastest(['krabby'])).toBeLessThanOrEqual(third.ms);
    for (const starter of ['bulbasaur', 'charmander', 'squirtle']) {
      expect(fastest([starter])).toBeGreaterThan(third.ms);
    }
    expect(fastestRun(PROMENADE_COURSE, [])!.ms).toBeLessThanOrEqual(first.ms);
    expect(courseTickets(0)).toBe(0);
    expect(courseTickets(third.ms)).toBe(third.tickets);
  });
});

/** Walks a run along a path of held directions, one tile each, at a frame length. */
function walk(run: CourseRun, path: readonly Direction[], frameMs: number): CourseRun {
  let current = run;
  for (const way of path) {
    const from = current.at;
    for (let guard = 0; guard < 100 && current.at.x === from.x && current.at.y === from.y; guard += 1) {
      current = advanceCourse(current, frameMs, way, false);
    }
    // Let the step finish before the next way is held.
    for (let guard = 0; guard < 100 && current.step; guard += 1) {
      current = advanceCourse(current, frameMs, null, false);
    }
  }
  return current;
}

describe('a run round the course', () => {
  it('starts the clock on the first step, not before', () => {
    let run = startCourse(PROMENADE_COURSE, []);
    run = advanceCourse(run, 5000, null, false);
    expect(run.elapsedMs).toBeNull();
    run = walk(run, ['right'], 16);
    expect(run.elapsedMs).toBeGreaterThan(0);
  });

  it('opens the small tree with CUT on the interact key, and bumps into it without', () => {
    const toTree = walk(startCourse(PROMENADE_COURSE, ['cut']), ['right', 'right', 'right'], 16);
    expect(facedObstacle(toTree)).toMatchObject({ move: 'cut', can: true });
    const cut = advanceCourse(toTree, 16, null, true);
    expect(cut.events).toContainEqual(expect.objectContaining({ kind: 'opened', move: 'cut' }));
    expect(cut.busyMs).toBe(FIELD_MOVE_BEAT_MS - 16);

    const without = walk(startCourse(PROMENADE_COURSE, []), ['right', 'right', 'right'], 16);
    const bumped = advanceCourse(without, 16, 'right', true);
    expect(bumped.events).toContainEqual(expect.objectContaining({ kind: 'bump', needs: 'cut' }));
    expect(bumped.at).toEqual(without.at);
  });

  it('walks the same at a hundred milliseconds a frame as at sixteen', () => {
    const hold = (frameMs: number): CourseRun => {
      let run = startCourse(PROMENADE_COURSE, []);
      for (let spent = 0; spent < 400; spent += frameMs) run = advanceCourse(run, frameMs, 'right', false);
      return run;
    };
    const quick = hold(100);
    const smooth = hold(16);
    expect(quick.at).toEqual(smooth.at);
    expect(quick.step?.progress).toBeCloseTo(smooth.step?.progress ?? 0, 5);
    expect(quick.elapsedMs).toBe(smooth.elapsedMs);
  });
});
