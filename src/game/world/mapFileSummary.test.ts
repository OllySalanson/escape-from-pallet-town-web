import { describe, expect, it } from 'vitest';
import { blankMap } from '../maker/draft';
import { readMapFile, type MapFile, type MapFileTrainer } from './mapFile';
import { checkMapFile } from './mapFileChecks';
import {
  chanceThrough,
  NEAR_STEPS,
  summariseMapFile,
  summaryLine,
  summaryLines,
} from './mapFileSummary';

/**
 * A lane through a wood, west to east, drawn to be counted by hand:
 *
 *   - the drop-in at its west end (1,8) and the exit at its east end (18,8),
 *     seventeen steps apart;
 *   - two trainers in nooks above the lane at x5 and x10, each looking down
 *     onto it, so the way out walks through both their watches;
 *   - a third at x14 the same, but the lane has a loop round under them at
 *     x13-16, so that one can be walked round;
 *   - an item spot in a pocket at (3,9) and a kiln, which pays one lamp oil,
 *     in a pocket at (17,9).
 */
const LANE = [
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTT.TTTT.TTT.TTTTT',
  'T..................T',
  'TTT.TTTTTTTTT.TT..TT',
  'TTTTTTTTTTTTT....TTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTT',
];

const watcher = (name: string, x: number): MapFileTrainer => ({
  x,
  y: 7,
  name,
  team: 'scout',
  look: 'bug-catcher',
  facing: 'down',
  sight: 1,
  lines: ['Halt!'],
});

const lane = (changes: Partial<MapFile> = {}): MapFile => {
  const reading = readMapFile({
    ...blankMap(20, 16, 'Lane'),
    maker: 'Tester',
    ground: LANE,
    dropIns: [{ x: 1, y: 8, name: 'West End' }],
    exits: [{ x: 18, y: 8, name: 'East End', opens: { when: 'always' } }],
    itemSpots: [{ x: 3, y: 9 }],
    landmarks: [{ x: 17, y: 9, name: 'Old Kiln', kind: 'kiln' }],
    trainers: [watcher('First', 5), watcher('Second', 10), watcher('Skipped', 14)],
    ...changes,
  });
  if (!reading.ok) {
    throw new Error(reading.problems.join(' '));
  }
  return reading.file;
};

describe("a player's map summed up for review", () => {
  const summary = summariseMapFile(lane())!;

  it('works and is summed up, because a summary never refuses a map', () => {
    expect(checkMapFile(lane()).every((check) => check.passed)).toBe(true);
    expect(summary).toBeDefined();
  });

  it('counts the trainers that stand in a row on the way out, and not one the way out walks round', () => {
    expect(summary.fightsOut).toBe(2);
    expect(summary.fightsOutFrom).toBe('West End');
    expect(summary.fightsOutTeams).toEqual(['scout', 'scout']);
  });

  it('counts a trainer once for walking down their whole line of sight', () => {
    const longSight = lane({
      trainers: [{ ...watcher('Long', 2), y: 8, facing: 'right', sight: 4 }],
      dropIns: [{ x: 1, y: 8, name: 'West End' }],
    });
    // Standing in the lane looking east, they see from x3 to x6 and are
    // walked into on x2: one fight, however many of their tiles are crossed.
    expect(summariseMapFile(longSight)!.fightsOut).toBe(1);
  });

  it('measures the walk to the nearest exit from the drop-in', () => {
    expect(summary.exitSteps).toEqual({ least: 17, most: 17 });
  });

  it('counts what the map pays and how much of it is near a drop-in', () => {
    expect(summary).toMatchObject({
      pickups: 2,
      itemSpots: 1,
      caches: 1,
      nearPickups: 2,
      // The kiln's lamp oil; the first item spot holds a Potion.
      materials: 1,
      money: 0,
    });
    // 28 tiles can be walked to: the lane less its exit, the three nooks, the
    // two pockets and the six tiles of the loop.
    expect(summary.pickupsPer100).toBeCloseTo((2 * 100) / 28, 5);
  });

  it('measures the walk to the nearest permanent thing as the game measures its own maps', () => {
    // Worked out tile by tile: 30 along the lane, 3 in the item pocket and 17
    // round the loop, the nooks and the kiln being things themselves.
    expect(summary.density).toBeCloseTo(50 / 28, 5);
  });

  it('only counts a pickup as near within its steps of a drop-in', () => {
    // The lane drawn thirty wide, with a second item spot in a pocket at its
    // far end: 27 steps from the drop-in, past what counts as near.
    const long = LANE.map((row, y) =>
      y === 8
        ? `${row.slice(0, 19)}${'.'.repeat(10)}T`
        : y === 9
          ? `${row}TTTTTTT.TT`
          : `${row}TTTTTTTTTT`,
    );
    const far = summariseMapFile(
      lane({
        width: 30,
        ground: long,
        exits: [{ x: 28, y: 8, name: 'East End', opens: { when: 'always' } }],
        itemSpots: [
          { x: 3, y: 9 },
          { x: 27, y: 9 },
        ],
      }),
    )!;
    expect(NEAR_STEPS).toBe(20);
    expect(far.pickups).toBe(3);
    expect(far.nearPickups).toBe(2);
    expect(far.exitSteps).toEqual({ least: 27, most: 27 });
  });

  it('calls a map with nothing to find, fight or catch empty, and one with a single item spot not', () => {
    const empty = lane({ itemSpots: [], landmarks: [], trainers: [] });
    expect(summariseMapFile(empty)!.empty).toBe(true);
    expect(summaryLine(summariseMapFile(empty)!)).toContain('EMPTY');
    expect(summaryLines(summariseMapFile(empty)!)[0]).toBe(
      'EMPTY: nothing to find, fight or catch.',
    );
    expect(summary.empty).toBe(false);
    expect(summariseMapFile(lane({ landmarks: [], trainers: [] }))!.empty).toBe(false);
    // Wild ground is something to catch.
    const grassy = lane({
      itemSpots: [],
      landmarks: [],
      trainers: [],
      ground: LANE.map((row, y) => (y === 8 ? row.replace('.....', 'ggggg') : row)),
    });
    expect(summariseMapFile(grassy)!.empty).toBe(false);
  });

  it('says it all in one line for the list and a fact a line for the map open', () => {
    expect(summaryLine(summary)).toBe(
      '2\u00a0fights · exit\u00a017\u00a0steps · 2\u00a0pickups · 1\u00a0material',
    );
    const lines = summaryLines(summary, 0.5);
    expect(lines[0]).toBe(
      'Fights out: 2 in a row from West End. A lone Lv 12 starter with 3 Potions gets through them all 50% of the time.',
    );
    expect(lines[1]).toBe('Nearest exit: 17 steps from a drop-in.');
    expect(lines[2]).toBe(
      'Payout: 2 pickups (1 item spot, 1 cache), paying 1 material; 2 within 20 steps of a drop-in, 7.1 per 100 tiles.',
    );
    expect(lines[3]).toBe("Nearest thing: 1.8 steps on average (the game's own maps: 4.5-8.1).");
  });

  it('measures fights in a row as a series, so a second one never makes getting through likelier', () => {
    expect(chanceThrough([])).toBe(1);
    const one = chanceThrough(['collier']);
    const two = chanceThrough(['collier', 'collier']);
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(1);
    // Played fresh each time, two would be the first squared; carried over,
    // the second fight is met bruised, which is the point of measuring a row.
    expect(two).toBeLessThan(one);
    expect(chanceThrough(['collier', 'collier', 'collier'])).toBeLessThan(two);
  });

  it('is worked out once per version of a map', () => {
    const file = lane();
    expect(summariseMapFile(file)).toBe(summariseMapFile(file));
  });
});
