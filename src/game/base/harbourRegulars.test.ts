import { describe, expect, it } from 'vitest';
import { WAVE_SHOWN_MS } from '../harbour/harbourLink';
import { HARBOUR_PHRASES } from '../harbour/harbourPhrases';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { botAt, visitPlan } from './harbourActivities';
import { BOT_SLOT_MS, HARBOUR_BOTS, visitsAt } from './harbourBots';
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

  it('walk a step at a time at walking pace, never back and forth (the captain, 29 Oct: "one step forward and one step back")', () => {
    // At a real frame rate, as a player watches: a figure never steps straight
    // back onto the tile it has just left (turning back after standing about
    // is a walk, not a judder), and never steps faster than a player walks.
    const regulars = new HarbourRegulars();
    const frame = 16;
    const seen = new Map<string, { tile: { x: number; y: number }; behind: { x: number; y: number } | null; since: number }>();
    const faults: string[] = [];
    for (let at = start; at < start + 60_000; at += frame) {
      regulars.tick(at, frame, { place: 'yard', player: { x: 0, y: 0 } });
      for (const figure of regulars.figures()) {
        const last = seen.get(figure.id);
        if (last && (last.tile.x !== figure.tile.x || last.tile.y !== figure.tile.y)) {
          const moved = Math.abs(last.tile.x - figure.tile.x) + Math.abs(last.tile.y - figure.tile.y);
          if (moved === 1 && last.behind && last.behind.x === figure.tile.x && last.behind.y === figure.tile.y && at - last.since < 2 * STEP_DURATION_MS) {
            faults.push(`${figure.name} stepped back at ${at - start}ms`);
          }
          if (moved === 1 && at - last.since < STEP_DURATION_MS - frame) {
            faults.push(`${figure.name} took a step in ${at - last.since}ms at ${at - start}ms`);
          }
          seen.set(figure.id, { tile: figure.tile, behind: last.tile, since: at });
        } else if (!last) {
          seen.set(figure.id, { tile: figure.tile, behind: null, since: at });
        }
        if (figure.toward && figure.progress > 0 && Math.abs(figure.toward.x - figure.tile.x) + Math.abs(figure.toward.y - figure.tile.y) !== 1) {
          faults.push(`${figure.name} walking to a tile that is not next to it`);
        }
      }
    }
    expect(faults.slice(0, 5)).toEqual([]);
  });

  it('are the same every time the same clock is run', () => {
    const one = run(start, 30_000).figures();
    const two = run(start, 30_000).figures();
    expect(two).toEqual(one);
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
    expect(callAt(first.leg, first.leg.from, walk)).toMatchObject({ tile: room.mat, walking: true, fade: 0 });
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

describe('people in the way', () => {
  const start = TEST_CLOCK_ORIGIN_MS;

  it('never share a tile or jump, drawn, however long they are watched', () => {
    const regulars = new HarbourRegulars();
    const away = { place: 'yard' as const, player: { x: 0, y: 0 } };
    const clashes: string[] = [];
    const last = new Map<string, { x: number; y: number }>();
    for (let at = start; at < start + 40 * 60_000; at += FRAME) {
      regulars.tick(at, FRAME, away);
      const taken = new Map<string, string>();
      const here = regulars.figures();
      for (const id of last.keys()) {
        if (!here.some((figure) => figure.id === id)) last.delete(id);
      }
      for (const figure of here) {
        const before = last.get(figure.id);
        if (before && Math.abs(before.x - figure.tile.x) + Math.abs(before.y - figure.tile.y) > 2) {
          clashes.push(`${figure.name} jumped to ${figure.tile.x},${figure.tile.y} at ${at - start}ms`);
        }
        last.set(figure.id, figure.tile);
        if ((figure.fade ?? 1) < 1) continue;
        for (const tile of [figure.tile, ...(figure.toward ? [figure.toward] : [])]) {
          const key = `${tile.x},${tile.y}`;
          const other = taken.get(key);
          if (other && other !== figure.id) clashes.push(`${figure.name} and ${other} on ${key} at ${at - start}ms`);
          taken.set(key, figure.id);
        }
      }
    }
    expect(clashes.slice(0, 5)).toEqual([]);
  });

  it('do not walk through a player standing in the road: they go round, and catch up with the plan', () => {
    // Somebody's next walk, with the player standing on a tile of it.
    let clock = start + 5_000;
    const regulars = run(start, 5_000);
    let walker = null as ReturnType<HarbourRegulars['figures']>[number] | null;
    const away = { place: 'yard' as const, player: { x: 0, y: 0 } };
    for (let tries = 0; !walker && tries < 2_000; tries += 1) {
      regulars.tick(clock, FRAME, away);
      clock += FRAME;
      walker = regulars.figures().find((figure) => figure.toward && figure.activity !== 'leave') ?? null;
    }
    const visit = visitsAt(clock).find((each) => visitPlan(each).bot.id === walker!.id)!;
    const plan = visitPlan(visit);
    const leg = plan.legs.find((each) => each.kind === 'walk' && each.from <= clock && clock < each.from + (each.path.length - 1) * STEP_DURATION_MS);
    expect(leg?.kind).toBe('walk');
    const path = leg?.kind === 'walk' ? leg.path : [];
    const standing = path[Math.min(path.length - 2, Math.floor((clock - (leg as { from: number }).from) / STEP_DURATION_MS) + 3)];
    const here = { place: 'yard' as const, player: standing };
    for (let ms = 0; ms < 6_000; ms += FRAME) {
      regulars.tick(clock, FRAME, here);
      clock += FRAME;
      const them = regulars.figures().find((figure) => figure.id === walker!.id);
      if (them) {
        expect(them.tile).not.toEqual(standing);
        expect(them.toward ?? them.tile).not.toEqual(standing);
      }
    }
  });
});

describe('a regular saying something', () => {
  it('says what the plan has them say, under their own name, and no more than a player may', () => {
    const regulars = new HarbourRegulars();
    const away = { place: 'yard' as const, player: { x: 0, y: 0 } };
    const start = TEST_CLOCK_ORIGIN_MS;
    const heard = new Set<string>();
    for (let at = start; at < start + 30 * 60_000; at += 200) {
      regulars.tick(at, 200, away);
      for (const figure of regulars.figures()) {
        if (figure.saying) heard.add(figure.saying);
      }
    }
    expect(heard.size).toBeGreaterThan(2);
    for (const words of heard) {
      expect(HARBOUR_PHRASES.map((phrase) => phrase.words as string)).toContain(words);
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
