import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BERRY_PICKING_BAD_MISS_DELAY,
  BERRY_PICKING_DIFFICULTIES,
  BERRY_PICKING_EAT_DELAY,
  BERRY_PICKING_EAT_FALL,
  BERRY_PICKING_FALL_DELAYS,
  BERRY_PICKING_MAX_FALL,
  BERRY_PICKING_MAX_SCORE,
  BERRY_PICKING_NEW_BERRY_DELAY,
  BERRY_PICKING_PICK_DELAY,
  BERRY_PICKING_PRIZE_SCORE,
  BERRY_PICKING_SCORES,
  BERRY_PICKING_STATUS_SQUARES,
  BERRY_PICKING_THRESHOLDS,
} from './generated/berryPicking';
import {
  advanceBerryPicking,
  berryScore,
  canPickBerries,
  DODUO_TURN_FRAMES,
  fallDelay,
  FRAME_MS,
  LEFT,
  MIDDLE,
  nextBerry,
  reachable,
  RIGHT,
  stageThreshold,
  startBerryPicking,
  stepBerryFrame,
  winsPrizeBerry,
  type BerryPickingGame,
  type Column,
} from './berryPicking';
import { modelBerryGame } from './berryModel';
import { getSpeciesById } from '../pokemon/species';
import { STARTER_SPECIES } from '../stash';

/** The snapshot `scripts/fetch-frlg-minigames.mjs` read out of pret. */
const SNAPSHOT = JSON.parse(readFileSync(new URL('../../../tools/minigames/frlg-berry-picking.json', import.meta.url), 'utf8')) as {
  maxScore: number;
  prizeScore: number;
  difficulties: number;
  maxFallDist: number;
  eatFallDist: number;
  statusSquares: number;
  fallDelays: number[][];
  difficultyThresholds: number[];
  scores: { blue: number; green: number; gold: number; missed: number };
  pickDelay: number;
  badMissDelay: number;
  eatDelay: number;
  newBerryDelay: number;
};

describe("FireRed's Dodrio Berry Picking, as read out of pret", () => {
  it('is the generated table, number for number', () => {
    expect(BERRY_PICKING_MAX_SCORE).toBe(SNAPSHOT.maxScore);
    expect(BERRY_PICKING_PRIZE_SCORE).toBe(SNAPSHOT.prizeScore);
    expect(BERRY_PICKING_DIFFICULTIES).toBe(SNAPSHOT.difficulties);
    expect(BERRY_PICKING_MAX_FALL).toBe(SNAPSHOT.maxFallDist);
    expect(BERRY_PICKING_EAT_FALL).toBe(SNAPSHOT.eatFallDist);
    expect(BERRY_PICKING_STATUS_SQUARES).toBe(SNAPSHOT.statusSquares);
    expect(BERRY_PICKING_FALL_DELAYS.map((row) => [...row])).toEqual(SNAPSHOT.fallDelays);
    expect([...BERRY_PICKING_THRESHOLDS]).toEqual(SNAPSHOT.difficultyThresholds);
    expect({ ...BERRY_PICKING_SCORES }).toEqual(SNAPSHOT.scores);
    expect(BERRY_PICKING_PICK_DELAY).toBe(SNAPSHOT.pickDelay);
    expect(BERRY_PICKING_BAD_MISS_DELAY).toBe(SNAPSHOT.badMissDelay);
    expect(BERRY_PICKING_EAT_DELAY).toBe(SNAPSHOT.eatDelay);
    expect(BERRY_PICKING_NEW_BERRY_DELAY).toBe(SNAPSHOT.newBerryDelay);
  });

  it("drops FireRed's berries at FireRed's pace: blue 40, green 24, gold 13 frames at the first speed", () => {
    expect([fallDelay('blue', 0), fallDelay('green', 0), fallDelay('gold', 0)]).toEqual([40, 24, 13]);
    // A full turn of the seven stages is the next speed; the third is the last.
    expect(fallDelay('gold', BERRY_PICKING_DIFFICULTIES)).toBe(10);
    expect(fallDelay('gold', 2 * BERRY_PICKING_DIFFICULTIES)).toBe(7);
    expect(fallDelay('gold', 9 * BERRY_PICKING_DIFFICULTIES)).toBe(7);
  });

  it("climbs FireRed's stages and hangs FireRed's berries on each", () => {
    expect([0, 1, 2, 6, 7].map(stageThreshold)).toEqual([5, 10, 20, 100, 105]);
    expect(nextBerry(0, 'gold')).toBe('blue');
    expect(nextBerry(1, 'blue')).toBe('green');
    expect(nextBerry(2, 'blue')).toBe('gold');
    expect([nextBerry(6, 'blue'), nextBerry(6, 'green'), nextBerry(6, 'gold')]).toEqual(['green', 'gold', 'blue']);
  });

  it('scores FireRed points, takes 50 off for every berry that lands, and never goes below nothing', () => {
    expect(berryScore({ eaten: { blue: 3, green: 2, gold: 1 }, missed: 1 })).toBe(30 + 60 + 50 - 50);
    expect(berryScore({ eaten: { blue: 1, green: 0, gold: 0 }, missed: 3 })).toBe(0);
    expect(winsPrizeBerry(2999)).toBe(false);
    expect(winsPrizeBerry(3000)).toBe(true);
  });
});

describe('who can pick', () => {
  it('is only the bird: a Dodrio with three heads, a Doduo with two', () => {
    expect(canPickBerries('dodrio')).toBe(true);
    expect(canPickBerries('doduo')).toBe(true);
    for (const starter of STARTER_SPECIES) expect(canPickBerries(starter.id)).toBe(false);
    for (const species of ['dodrio', 'doduo']) expect(getSpeciesById(species)).toBeDefined();
    expect(startBerryPicking('pikachu').over).toBe(true);
    expect(reachable(startBerryPicking('dodrio'))).toEqual([LEFT, MIDDLE, RIGHT]);
    expect(reachable(startBerryPicking('doduo'))).toEqual([MIDDLE, RIGHT]);
  });
});

/** Steps until the berry in this column is ripe, or throws. */
function untilRipe(game: BerryPickingGame, column: Column): BerryPickingGame {
  let probe = game;
  for (let frame = 0; frame < 2000; frame += 1) {
    const berry = probe.columns[column];
    if (berry.state === 'falling' && berry.fall === BERRY_PICKING_EAT_FALL - 1) return probe;
    probe = stepBerryFrame(probe, null);
  }
  throw new Error('the berry never came down');
}

function run(game: BerryPickingGame, frames: number): BerryPickingGame {
  let next = game;
  for (let frame = 0; frame < frames; frame += 1) next = stepBerryFrame(next, null);
  return next;
}

describe('a game of BERRY PICKING', () => {
  it('lets a berry fall, grey a square when it lands, and hang a new one twenty frames later', () => {
    let game = startBerryPicking('dodrio');
    while (game.columns[LEFT].state !== 'squished') game = stepBerryFrame(game, null);
    expect(game.greySquares).toBeGreaterThanOrEqual(1);
    expect(game.missed).toBeGreaterThanOrEqual(1);
    game = run(game, BERRY_PICKING_NEW_BERRY_DELAY);
    expect(game.columns[LEFT].state).toBe('falling');
    expect(game.columns[LEFT].fall).toBe(1);
  });

  it('eats a ripe berry it reaches for, scores it, and frees the beak six frames on', () => {
    let game = untilRipe(startBerryPicking('dodrio'), LEFT);
    game = stepBerryFrame(game, LEFT);
    game = run(game, BERRY_PICKING_EAT_DELAY + 1);
    expect(game.eaten.blue).toBe(1);
    expect(game.columns[LEFT].state).toBe('eaten');
    expect(berryScore(game)).toBe(10);
    game = run(game, BERRY_PICKING_PICK_DELAY);
    expect(game.beak).toBe('free');
  });

  it('pays for a peck at nothing with forty frames of no reaching', () => {
    let game = startBerryPicking('dodrio');
    game = run(stepBerryFrame(game, MIDDLE), 1);
    expect(game.beak).toBe('bad-miss');
    game = run(game, BERRY_PICKING_BAD_MISS_DELAY - 3);
    expect(game.beak).toBe('bad-miss');
    game = stepBerryFrame(game, LEFT);
    expect(game.reach).toBe(MIDDLE);
    game = run(game, 3);
    expect(game.beak).toBe('free');
  });

  it('ends once ten berries have landed and the last are down', () => {
    let game = startBerryPicking('dodrio');
    while (!game.over) game = stepBerryFrame(game, null);
    expect(game.greySquares).toBe(BERRY_PICKING_STATUS_SQUARES);
    expect(berryScore(game)).toBe(0);
  });

  it("turns a Doduo's two heads to the far side instead of reaching, which takes its time", () => {
    let game = untilRipe(startBerryPicking('doduo'), LEFT);
    game = stepBerryFrame(game, LEFT);
    expect(game.side).toBe(LEFT);
    expect(game.beak).toBe('turning');
    expect(game.reach).toBe(null);
    game = run(game, DODUO_TURN_FRAMES - 2);
    expect(game.beak).toBe('turning');
    game = run(game, 2);
    expect(game.beak).toBe('free');
    expect(reachable(game)).toEqual([LEFT, MIDDLE]);
  });

  it('plays the same at ten frames a second as at sixty, and keeps a reach asked for between frames', () => {
    let fast = startBerryPicking('dodrio');
    let slow = fast;
    for (let tick = 0; tick < 400; tick += 1) {
      const press: Column | null = tick % 7 === 0 ? (((tick / 7) % 3) as Column) : null;
      for (let frame = 0; frame < 6; frame += 1) fast = advanceBerryPicking(fast, FRAME_MS, frame === 0 ? press : null);
      slow = advanceBerryPicking(slow, FRAME_MS * 6, press);
    }
    expect({ frame: slow.frame, score: berryScore(slow), grey: slow.greySquares }).toEqual({
      frame: fast.frame,
      score: berryScore(fast),
      grey: fast.greySquares,
    });
  });
});

/**
 * The arenas plan's rule for every mini-game, played by the model player
 * (`berryModel.ts`, `tools/minigames/measure.mts`): the bird decides it, skill
 * still counts.
 */
describe('who is good at BERRY PICKING', () => {
  const median = (species: string, jitter: number): number => {
    const scores = Array.from({ length: 9 }, (_, seed) => berryScore(modelBerryGame(species, seed + 1, jitter))).sort((a, b) => a - b);
    return scores[4];
  };

  it('picks far more with a three-headed Dodrio than a two-headed Doduo', () => {
    expect(median('dodrio', 4)).toBeGreaterThan(2 * median('doduo', 4));
  });

  it('still rewards skill: a steady Doduo beats a shaky Dodrio', () => {
    expect(median('doduo', 4)).toBeGreaterThan(median('dodrio', 16));
  });

  it("puts FireRed's prize line in reach of a Dodrio and just past a Doduo", () => {
    expect(median('dodrio', 4)).toBeGreaterThan(BERRY_PICKING_PRIZE_SCORE);
    expect(median('doduo', 4)).toBeLessThan(BERRY_PICKING_PRIZE_SCORE * 1.5);
  });
});
