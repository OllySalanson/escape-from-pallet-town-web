import { describe, expect, it } from 'vitest';
import { WAVE_SHOWN_MS } from '../harbour/harbourLink';
import { HARBOUR_BOTS, botAt, visitPlan, visitsAt } from './harbourBots';
import { HarbourRegulars, REGULAR_WAVES_WITHIN, TEST_CLOCK_ORIGIN_MS, harbourRegulars, regularsClock } from './harbourRegulars';

const FRAME = 100;

/** Runs a fresh set of regulars on from a moment of the clock, a frame at a time. */
function run(from: number, ms: number, regulars = new HarbourRegulars(), player = null): HarbourRegulars {
  for (let at = from; at < from + ms; at += FRAME) {
    regulars.tick(at, FRAME, player);
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
      regulars.tick(clock, FRAME, null);
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
      regulars.tick(clock, FRAME, player);
      clock += FRAME;
      const them = regulars.figures().find((figure) => figure.id === bot.id)!;
      expect(them.tile).toEqual(standing);
      expect(them.toward).toBeNull();
      expect(them.facing).toBe('down');
      // The player's own hand is up first; theirs once it is down.
      expect(them.waving === true).toBe(ms + FRAME >= WAVE_SHOWN_MS && ms + FRAME < WAVE_SHOWN_MS * 2);
    }
    regulars.release();
    let moved = false;
    for (let ms = 0; ms < 120_000 && !moved; ms += FRAME) {
      regulars.tick(clock, FRAME, null);
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
      regulars.tick(clock, FRAME, null);
      clock += FRAME;
      stander = regulars.figures().find((figure) => !figure.toward && !figure.waving) ?? null;
    }
    const near = { x: stander!.tile.x, y: stander!.tile.y + REGULAR_WAVES_WITHIN };
    regulars.tick(clock, FRAME, near);
    clock += FRAME;
    const them = regulars.figures().find((figure) => figure.id === stander!.id);
    if (them && !them.toward) {
      expect(them.waving).toBe(true);
      for (let ms = 0; ms < WAVE_SHOWN_MS + 500; ms += FRAME) {
        regulars.tick(clock, FRAME, near);
        clock += FRAME;
      }
      expect(regulars.figures().find((figure) => figure.id === stander!.id)?.waving ?? false).toBe(false);
    }
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
