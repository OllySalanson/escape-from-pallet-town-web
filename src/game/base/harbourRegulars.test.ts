import { describe, expect, it } from 'vitest';
import { WAVE_SHOWN_MS } from '../harbour/harbourLink';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { BOT_SLOT_MS, HARBOUR_BOTS, botAt, visitPlan, visitsAt } from './harbourBots';
import { baseGame } from './baseGames.testkit';
import { buildRoom, roomNamed } from './rooms';
import { HarbourRegulars, REGULAR_WAVES_WITHIN, callAt, TEST_CLOCK_ORIGIN_MS, harbourRegulars, regularsClock } from './harbourRegulars';

const FRAME = 100;

/** Runs a fresh set of regulars on from a moment of the clock, a frame at a time. */
function run(from: number, ms: number, regulars = new HarbourRegulars()): HarbourRegulars {
  for (let at = from; at < from + ms; at += FRAME) {
    regulars.tick(at, FRAME, { place: 'yard', player: { x: 0, y: 0 } });
  }
  return regulars;
}

describe('the regulars as drawn', () => {
  const start = TEST_CLOCK_ORIGIN_MS;

  it('are whoever the schedule has in, where it has them, under their own names', () => {
    const regulars = run(start, 20_000);
    const now = start + 20_000 - FRAME;
    const drawn = regulars.figures();
    expect(drawn.map((figure) => figure.name).sort()).toEqual(
      visitsAt(now).map((visit) => visitPlan(visit).bot.name).sort(),
    );
    for (const figure of drawn) {
      const visit = visitsAt(now).find((each) => visitPlan(each).bot.id === figure.id)!;
      const at = botAt(visitPlan(visit), now)!;
      const bot = HARBOUR_BOTS.find((each) => each.id === figure.id)!;
      expect(figure.partner).toBe(bot.partner);
      // Never more than a step behind where they are meant to be.
      const shown = figure.toward ?? figure.tile;
      expect(Math.abs(shown.x - at.tile.x) + Math.abs(shown.y - at.tile.y)).toBeLessThanOrEqual(2);
    }
  });

  it('are the same every time the same clock is run', () => {
    const one = run(start, 30_000).figures();
    const two = run(start, 30_000).figures();
    expect(two).toEqual(one);
  });

  it('stand still facing the player while spoken to, wave back after the player, and walk on after', () => {
    const regulars = run(start, 5_000);
    let clock = start + 5_000;
    // Somebody walking, so standing still is the hold and not a pause.
    let walker = regulars.figures().find((figure) => figure.toward);
    for (let tries = 0; !walker && tries < 600; tries += 1) {
      regulars.tick(clock, FRAME, { place: 'yard', player: { x: 0, y: 0 } });
      clock += FRAME;
      walker = regulars.figures().find((figure) => figure.toward);
    }
    expect(walker).toBeDefined();
    const bot = HARBOUR_BOTS.find((each) => each.id === walker!.id)!;
    const standing = walker!.toward!;
    const player = { x: standing.x, y: standing.y + 1 };
    expect(regulars.at(standing)).toBe(bot);
    const line = regulars.speakTo(bot, player);
    expect(bot.lines).toContain(line);
    expect(regulars.speakTo(bot, player)).toBe(bot.lines[1 % bot.lines.length]);
    for (let ms = 0; ms < 8_000; ms += FRAME) {
      regulars.tick(clock, FRAME, { place: 'yard', player });
      clock += FRAME;
      const them = regulars.figures().find((figure) => figure.id === bot.id)!;
      // Once the step they were taking is finished: they stop on the tile they were stepping onto.
      if (ms >= STEP_DURATION_MS) {
        expect(them.tile).toEqual(standing);
        expect(them.toward).toBeNull();
        expect(them.facing).toBe('down');
      }
      // The player's own hand is up first; theirs once it is down.
      expect(them.waving === true).toBe(ms + FRAME >= WAVE_SHOWN_MS && ms + FRAME < WAVE_SHOWN_MS * 2);
    }
    regulars.release();
    let moved = false;
    for (let ms = 0; ms < 120_000 && !moved; ms += FRAME) {
      regulars.tick(clock, FRAME, { place: 'yard', player: { x: 0, y: 0 } });
      clock += FRAME;
      const them = regulars.figures().find((figure) => figure.id === bot.id);
      moved = !them || them.tile.x !== standing.x || them.tile.y !== standing.y;
    }
    expect(moved).toBe(true);
  });

  it('wave at a player who comes near while they stand about, once a visit', () => {
    const regulars = run(start, 5_000);
    let clock = start + 5_000;
    let stander = null as ReturnType<HarbourRegulars['figures']>[number] | null;
    for (let tries = 0; !stander && tries < 600; tries += 1) {
      regulars.tick(clock, FRAME, { place: 'yard', player: { x: 0, y: 0 } });
      clock += FRAME;
      stander = regulars.figures().find((figure) => !figure.toward && !figure.waving) ?? null;
    }
    const near = { x: stander!.tile.x, y: stander!.tile.y + REGULAR_WAVES_WITHIN };
    regulars.tick(clock, FRAME, { place: 'yard', player: near });
    clock += FRAME;
    const them = regulars.figures().find((figure) => figure.id === stander!.id);
    if (them && !them.toward) {
      expect(them.waving).toBe(true);
      for (let ms = 0; ms < WAVE_SHOWN_MS + 500; ms += FRAME) {
        regulars.tick(clock, FRAME, { place: 'yard', player: near });
        clock += FRAME;
      }
      expect(regulars.figures().find((figure) => figure.id === stander!.id)?.waving ?? false).toBe(false);
    }
  });
});

describe('a regular calling on a keeper', () => {
  /** The first call on a keeper after tonight, and the visit that makes it. */
  const first = (() => {
    for (let visit = Math.floor(TEST_CLOCK_ORIGIN_MS / BOT_SLOT_MS); ; visit += 1) {
      const leg = visitPlan(visit).legs.find((each) => each.kind === 'inside');
      if (leg?.kind === 'inside') return { visit, leg };
    }
  })();
  const room = roomNamed(first.leg.room)!;
  const built = buildRoom(room, baseGame());
  const watcher = { place: first.leg.room, player: room.mat!, room: { collision: built.collision, mat: room.mat! } };

  it('comes in off the mat, stands where they stand, and is on the mat again as the call ends', () => {
    const walk = [room.mat!, { x: room.mat!.x, y: room.mat!.y - 1 }];
    expect(callAt(first.leg, first.leg.from, walk)).toMatchObject({ tile: room.mat, walking: true });
    expect(callAt(first.leg, (first.leg.from + first.leg.to) / 2, walk)).toMatchObject({
      tile: first.leg.spot.tile,
      facing: first.leg.spot.facing,
      walking: false,
    });
    expect(callAt(first.leg, first.leg.to - 1, walk)).toMatchObject({ next: room.mat, walking: true });
    expect(callAt(first.leg, first.leg.from, null)).toMatchObject({ tile: first.leg.spot.tile, walking: false });
  });

  it('is drawn in the room while the player is in it, and nowhere while the player is in the yard', () => {
    const middle = Math.round((first.leg.from + first.leg.to) / 2);
    const inside = new HarbourRegulars();
    const outside = new HarbourRegulars();
    for (let at = middle - 10_000; at < middle; at += FRAME) {
      inside.tick(at, FRAME, watcher);
      outside.tick(at, FRAME, { place: 'yard', player: { x: 0, y: 0 } });
    }
    const name = visitPlan(first.visit).bot.name;
    const seen = inside.figures(first.leg.room).find((figure) => figure.name === name);
    expect(seen?.tile).toEqual(first.leg.spot.tile);
    expect(outside.figures('yard').some((figure) => figure.name === name)).toBe(false);
    expect(outside.figures(first.leg.room)).toEqual([]);
  });
});

describe('the regulars\' clock', () => {
  it('is the wall clock for a player, and test mode\'s stepped clock from a fixed start for a check', () => {
    const before = Date.now();
    expect(regularsClock(16, false)).toBeGreaterThanOrEqual(before);
    const first = regularsClock(100, true);
    expect(regularsClock(100, true)).toBe(first + 100);
    expect(first).toBeGreaterThan(TEST_CLOCK_ORIGIN_MS);
  });

  it('are left out of a page that asks for none', () => {
    expect(harbourRegulars('?regulars=off')).toBeNull();
  });
});
