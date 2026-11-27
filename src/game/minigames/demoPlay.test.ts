import { describe, expect, it } from 'vitest';
import { harbourBite } from '../base/harbourFishing';
import { LEFT, startBerryPicking } from './berryPicking';
import { advanceDerby, COUNTDOWN_MS, derbyField, startDerby, THE_FRONT } from './derby';
import { digAt, startDig, type Ping } from './dig';
import { advanceBerryDemo, advanceCourseDemo, advanceJumpDemo, derbyDemoInput, digDemoTargets, stepToward } from './demoPlay';
import { courseMovesOf, fastestRun, PROMENADE_COURSE, startCourse } from './fieldCourse';
import { startPokemonJump } from './pokemonJump';
import { traits } from './traits';

/** A demo played on frames of `ms`, until `until` says stop or `limit` ms have gone. */
function play<T>(start: T, step: (game: T, ms: number) => T, until: (game: T) => boolean, limit: number, ms = 1000 / 60): { game: T; ms: number } {
  let game = start;
  let spent = 0;
  while (!until(game) && spent < limit) {
    game = step(game, ms);
    spent += ms;
  }
  return { game, ms: spent };
}

/**
 * The house's player on every attract screen (`demoPlay.ts`) is the demo,
 * and the demo is the rules: it has to play well, the same way every time,
 * and show how a game is lost as well as how it is played.
 */
describe("the house's POKéMON JUMP", () => {
  for (const team of [['charmander'], ['bulbasaur'], ['pikachu'], ['rattata', 'charmander', 'rattata'], ['charmander', 'pikachu']]) {
    it(`clears every swing it means to for ${team.join(' + ')}, then lets the vine take its feet`, () => {
      const clears = 2;
      const { game, ms } = play(startPokemonJump(team, 0x5eed), (jump, step) => advanceJumpDemo(jump, step, clears), (jump) => jump.over, 20_000);
      expect(game.over).toBe(true);
      expect(game.jumpsInRow).toBe(clears);
      expect(game.jumpers.some((jumper) => jumper.hit)).toBe(true);
      // A demo, not a game: round again inside a few seconds.
      expect(ms).toBeLessThan(6000);
    });
  }

  it('jumps as well on a 100 ms frame as on a 16 ms one', () => {
    const smooth = play(startPokemonJump(['pikachu'], 7), (jump, step) => advanceJumpDemo(jump, step, 5), (jump) => jump.over, 20_000);
    const rough = play(startPokemonJump(['pikachu'], 7), (jump, step) => advanceJumpDemo(jump, step, 5), (jump) => jump.over, 20_000, 100);
    expect(rough.game.jumpsInRow).toBe(smooth.game.jumpsInRow);
    expect(rough.game.score).toBe(smooth.game.score);
  });
});

describe("the house's BERRY PICKING", () => {
  for (const bird of ['dodrio', 'doduo']) {
    it(`${bird}: takes the berries it can reach and leaves one column's to land, greying a square`, () => {
      // The stretch the attract screen shows (`BerryPickingScene`).
      let game = advanceBerryDemo(startBerryPicking(bird), 3000, LEFT);
      const eatenBefore = game.eaten.blue + game.eaten.green + game.eaten.gold;
      game = play(game, (picking, ms) => advanceBerryDemo(picking, ms, LEFT), () => false, 3600).game;
      expect(game.eaten.blue + game.eaten.green + game.eaten.gold - eatenBefore).toBeGreaterThanOrEqual(2);
      expect(game.greySquares).toBe(1);
      expect(game.over).toBe(false);
    });
  }
});

describe("the house's DIG", () => {
  for (const [digger, pings] of [
    ['meowth', ['warm', 'hot', 'found']],
    ['diglett', ['warm', 'found']],
  ] as const) {
    it(`${digger}: follows the pings in to a find, never into loose sand and never turning it up early`, () => {
      let game = startDig(traits(digger), 4242);
      const seen: Ping[] = [];
      for (const target of digDemoTargets(game)) {
        const dug = digAt(game, target.x, target.y);
        game = dug.game;
        for (const event of dug.events) if (event.kind === 'ping') seen.push(event.ping);
        expect(dug.events.some((event) => event.kind === 'caved')).toBe(false);
      }
      expect(seen).toEqual(pings);
    });
  }

  it('walks the spade a square at a time', () => {
    expect(stepToward({ x: 0, y: 0 }, { x: 2, y: 3 })).toEqual({ x: 1, y: 0 });
    expect(stepToward({ x: 2, y: 0 }, { x: 2, y: 3 })).toEqual({ x: 2, y: 1 });
    expect(stepToward({ x: 2, y: 3 }, { x: 2, y: 3 })).toEqual({ x: 2, y: 3 });
  });
});

describe("the house's FIELD-MOVE COURSE", () => {
  it('runs the quickest line into its first field move inside the demo', () => {
    const moves = courseMovesOf('charmander');
    const line = fastestRun(PROMENADE_COURSE, moves)?.line ?? [];
    const { game } = play({ run: startCourse(PROMENADE_COURSE, moves), next: 0 }, (demo, ms) => advanceCourseDemo(demo, line, ms), (demo) => demo.run.opened.length > 0, 6200);
    expect(game.run.opened.length).toBeGreaterThan(0);
  });

  it('keeps to the line on a 100 ms frame', () => {
    const moves = courseMovesOf('krabby');
    const line = fastestRun(PROMENADE_COURSE, moves)?.line ?? [];
    const { game } = play({ run: startCourse(PROMENADE_COURSE, moves), next: 0 }, (demo, ms) => advanceCourseDemo(demo, line, ms), (demo) => demo.run.finished, 60_000, 100);
    expect(game.run.finished).toBe(true);
    expect(game.next).toBe(line.length);
  });
});

describe("the house's PROMENADE DERBY", () => {
  it('rides the quicker line and sprints once the gun has gone, never before', () => {
    let race = startDerby(THE_FRONT, { name: 'PIKACHU', racer: traits('pikachu') }, derbyField(THE_FRONT, '2026-11-27'), false, 1);
    expect(derbyDemoInput(race, 0).tap).toBeUndefined();
    while (race.clock < COUNTDOWN_MS) race = advanceDerby(race, 100, derbyDemoInput(race, 0));
    let taps = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      const input = derbyDemoInput(race, frame);
      if (input.tap) taps += 1;
      race = advanceDerby(race, 1000 / 60, input);
    }
    expect(taps).toBeGreaterThan(0);
    expect(race.runners[0].stamina).toBeGreaterThanOrEqual(0);
  });
});

describe("the house's FISHING DERBY", () => {
  it('lands something off the deep end on its demo roll', () => {
    expect(harbourBite({ x: 80, y: 31 }, () => 0.42)).not.toBeNull();
  });
});
