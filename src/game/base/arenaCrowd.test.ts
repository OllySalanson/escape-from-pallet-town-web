import { describe, expect, it } from 'vitest';
import {
  CrowdMotion,
  LapWatch,
  PAPER_MS,
  angleInHall,
  bandPose,
  crowdShare,
  lapLine,
  leaverTurn,
  leaversFrom,
  crowdTakesTheView,
  moodAsTheyGo,
  moodOfRaid,
  moodOnTheRail,
  paperFlakes,
  reactionPose,
  standsBehind,
  turnBetween,
  wavePose,
} from './arenaCrowd';
import { ARENA_CENTRE, ARENA_MAT, arenaCollision, isOuterWall } from './arenaHall';
import { crowdSeats, seatedAt } from './arenaStands';

const seats = crowdSeats();
const up = (pose: ReturnType<typeof reactionPose>): boolean => pose !== null;

describe('how full the house is', () => {
  it('plays to a third of the seats for a new game and to all of them for a veteran', () => {
    expect(crowdShare(undefined)).toBeCloseTo(1 / 3);
    expect(crowdShare({ 'greystone-vale': { deployed: 40, extracted: 30, wiped: 2 } })).toBe(1);
  });

  it('fills with every raid out, adds up across maps, and is thinned by a wipe', () => {
    const six = crowdShare({ a: { deployed: 6, extracted: 6, wiped: 0 } });
    expect(six).toBeGreaterThan(crowdShare(undefined));
    expect(crowdShare({ a: { deployed: 3, extracted: 3, wiped: 0 }, b: { deployed: 3, extracted: 3, wiped: 0 } })).toBeCloseTo(six);
    expect(crowdShare({ a: { deployed: 7, extracted: 6, wiped: 1 } })).toBeLessThan(six);
  });

  it('never drops below the third a new game plays to, however badly it has gone', () => {
    expect(crowdShare({ a: { deployed: 30, extracted: 0, wiped: 30 } })).toBeCloseTo(1 / 3);
  });

  it('is the same people with more beside them: everybody at a thin house is there at a fuller one', () => {
    const thin = seatedAt(0.4);
    const full = new Set(seatedAt(0.8));
    expect(thin.length).toBeLessThan(full.size);
    expect(thin.every((seat) => full.has(seat))).toBe(true);
    // Fills the stands evenly, with nobody left over at a full house.
    expect(seatedAt(1).length).toBe(seats.length);
  });
});

describe('what the house makes of a raid', () => {
  it('takes the view only for a raid the house has an opinion of', () => {
    expect(crowdTakesTheView('roar')).toBe(true);
    expect(crowdTakesTheView('groan')).toBe(true);
    expect(crowdTakesTheView('cheer')).toBe(false);
    expect(crowdTakesTheView('clap')).toBe(false);
  });

  it('goes by how it ended and what it brought', () => {
    expect(moodOfRaid(true, 'loaded')).toBe('roar');
    expect(moodOfRaid(true, 'solid')).toBe('cheer');
    expect(moodOfRaid(true, 'thin')).toBe('clap');
    expect(moodOfRaid(true, 'empty')).toBe('clap');
    // Cutting it fine has them on their feet, whatever came out with it.
    expect(moodOfRaid(true, 'empty', true)).toBe('roar');
    expect(moodOfRaid(false, 'empty', true)).toBe('groan');
    expect(moodOfRaid(false, 'loaded')).toBe('groan');
  });

  const onFeet = (mood: Parameters<typeof reactionPose>[1], ms: number): number =>
    seats.filter((seat) => up(reactionPose(seat, mood, 0, ms))).length;

  it('gets more of them up the better it went, and nobody at all for a wipe', () => {
    expect(onFeet('roar', 1500)).toBeGreaterThan(onFeet('cheer', 1500));
    expect(onFeet('cheer', 1500)).toBeGreaterThan(onFeet('clap', 1500));
    expect(onFeet('clap', 1500)).toBeGreaterThan(0);
    expect(onFeet('groan', 1500)).toBe(0);
  });

  it('starts nearest the player and sits them all down again', () => {
    const near = seats.filter((seat) => Math.abs(turnBetween(0, seat.angle)) < 0.3);
    const far = seats.filter((seat) => Math.abs(turnBetween(0, seat.angle)) > 2.8);
    const share = (list: typeof seats, ms: number): number => list.filter((seat) => up(reactionPose(seat, 'roar', 0, ms))).length / list.length;
    expect(share(near, 250)).toBeGreaterThan(share(far, 250));
    expect(onFeet('roar', 9000)).toBe(0);
  });

  it('loses some of them after a wipe, each going along their row and gone', () => {
    const leavers = leaversFrom(seats, 0.5);
    expect(leavers.length).toBeGreaterThan(10);
    // Nobody leaving is in the house the wipe left.
    const stayed = new Set(seatedAt(0.5));
    expect(leavers.every((seat) => !stayed.has(seat))).toBe(true);
    const seat = leavers[0];
    expect(leaverTurn(seat, 5000)).toBeNull();
    expect(Math.abs(leaverTurn(seat, 2000) ?? 0)).toBeGreaterThan(0);
  });

  it('burns the fires low after a wipe and brings them back, and only after a wipe', () => {
    const motion = new CrowdMotion();
    motion.react('roar', 0);
    expect(motion.fireShare).toBe(1);
    motion.react('groan', 0);
    motion.update(100);
    const low = motion.fireShare;
    expect(low).toBeLessThan(0.6);
    motion.update(3000);
    expect(motion.fireShare).toBeGreaterThan(low);
  });

  it('is heard in time and said once each, and paper comes down only for a roar', () => {
    const roar = new CrowdMotion();
    roar.react('roar', 0);
    expect(roar.paperMs).toBe(0);
    const heard: string[] = [];
    for (let ms = 0; ms < 8000; ms += 100) {
      heard.push(...roar.update(100));
    }
    expect(heard.filter((sound) => sound === 'crowdRoar')).toHaveLength(3);
    expect(roar.busy).toBe(false);
    const groan = new CrowdMotion();
    groan.react('groan', 0);
    expect(groan.paperMs).toBeNull();
    expect(groan.update(200)).toEqual(['crowdGroan']);
    expect(groan.update(200)).toEqual([]);
  });

  it('throws its paper on whole pixels, on screen, and is done', () => {
    const flakes = paperFlakes(2500, 400, 256);
    expect(flakes.length).toBeGreaterThan(10);
    for (const flake of flakes) {
      expect(Number.isInteger(flake.x)).toBe(true);
      expect(Number.isInteger(flake.y)).toBe(true);
      expect(flake.y).toBeLessThanOrEqual(256);
    }
    expect(paperFlakes(PAPER_MS, 400, 256)).toHaveLength(0);
  });
});

describe('waving and running', () => {
  it('waves back from the nearest section and nobody else', () => {
    const near = seats.filter((seat) => wavePose(seat, 1, 400));
    expect(near.length).toBeGreaterThan(5);
    expect(near.every((seat) => Math.abs(turnBetween(1, seat.angle)) < 0.6)).toBe(true);
    expect(seats.filter((seat) => wavePose(seat, 1, 4000))).toHaveLength(0);
  });

  it('gets them up beside a runner and keeps them up behind', () => {
    const at = 1;
    const behind = seats.filter((seat) => bandPose(seat, at, 1, 0)?.pose);
    expect(behind.length).toBeGreaterThan(10);
    const turns = behind.map((seat) => turnBetween(at, seat.angle));
    expect(Math.min(...turns)).toBeLessThan(-0.4);
    expect(Math.max(...turns)).toBeLessThan(0.2);
  });

  const round = (watch: LapWatch, turns: number, way = 1, steps = 200): ReturnType<LapWatch['note']>[] =>
    Array.from({ length: steps }, (_each, step) => watch.note((((step + 1) / steps) * turns * Math.PI * 2 * way) % (Math.PI * 2), 100));

  it('takes no walk across to a station for a lap', () => {
    const watch = new LapWatch();
    watch.note(1.4, 100);
    const news = [1.3, 1.2, 1.1, 1.0, 0.9].map((angle) => watch.note(angle, 150));
    expect(news.every((each) => !each.running)).toBe(true);
  });

  it('calls a whole way round a lap, once, and times it, either way round', () => {
    for (const way of [1, -1]) {
      const watch = new LapWatch();
      watch.note(0, 100);
      const news = round(watch, 1.2, way);
      expect(news.some((each) => each.running)).toBe(true);
      const laps = news.filter((each) => each.lapMs !== null);
      expect(laps).toHaveLength(1);
      expect(laps[0].lapMs).toBeGreaterThan(10_000);
      expect(news.filter((each) => each.quarter).length).toBeGreaterThanOrEqual(4);
    }
  });

  it('gives up on a lap if they turn back or stand about', () => {
    const back = new LapWatch();
    back.note(0, 100);
    let angle = 0;
    const walk = (turns: number, way: number): ReturnType<LapWatch['note']>[] =>
      Array.from({ length: Math.round(turns * 100) }, () => {
        angle += (way * Math.PI * 2) / 100;
        return back.note(angle, 100);
      });
    const there = walk(0.7, 1);
    expect(there[there.length - 1].running).toBe(true);
    const turned = walk(0.7, -1);
    // Turning back starts it again from nothing, so seven tenths out and seven back is no lap.
    expect(turned[0].running).toBe(false);
    expect([...there, ...turned].filter((each) => each.lapMs !== null)).toHaveLength(0);
    const stood = new LapWatch();
    stood.note(0, 100);
    for (let step = 1; step < 20; step += 1) {
      stood.note(step * 0.1, 100);
    }
    expect(stood.note(1.9, 100).running).toBe(true);
    let news = stood.note(1.9, 100);
    for (let frame = 0; frame < 30; frame += 1) {
      news = stood.note(1.9, 100);
    }
    expect(news.running).toBe(false);
  });

  it('says a lap of honour after a good raid, and whether it was the best', () => {
    expect(lapLine(21_340, false, false)).toBe('A LAP OF THE RING 21.3S');
    expect(lapLine(21_340, true, true)).toBe('A LAP OF HONOUR 21.3S BEST');
  });
});

describe('the wall the stands are behind', () => {
  it('is the outside of the hall all round, never its floor, the fence or the porch', () => {
    const solid = arenaCollision();
    const outer: { x: number; y: number }[] = [];
    solid.forEach((row, y) =>
      row.forEach((_blocked, x) => {
        if (isOuterWall({ x, y })) {
          outer.push({ x, y });
          expect(solid[y][x], `${x},${y}`).toBe(true);
          expect(Math.hypot(x * 16 - ARENA_CENTRE.x, y * 16 - ARENA_CENTRE.y)).toBeGreaterThan(400);
          expect(Math.abs(x - ARENA_MAT.x) > 2 || y < ARENA_MAT.y - 3).toBe(true);
        }
      }),
    );
    // Walked up to from every side of the hall.
    expect(outer.some((tile) => tile.x < 8)).toBe(true);
    expect(outer.some((tile) => tile.x > 56)).toBe(true);
    expect(outer.some((tile) => tile.y < 8)).toBe(true);
    expect(outer.some((tile) => tile.y > 54)).toBe(true);
  });

  it('turns the view to seats that lie behind whoever is looking', () => {
    for (const player of [{ x: 520, y: 900 }, { x: 520, y: 140 }, { x: 900, y: 528 }, { x: 140, y: 528 }]) {
      const stands = standsBehind(player);
      expect(Math.hypot(stands.x - ARENA_CENTRE.x, stands.y - ARENA_CENTRE.y)).toBeGreaterThan(Math.hypot(player.x - ARENA_CENTRE.x, player.y - ARENA_CENTRE.y));
      expect(Math.abs(turnBetween(angleInHall(player), angleInHall(stands)))).toBeLessThan(0.1);
    }
  });
});

describe('the house and the bet on the rail', () => {
  it('gets to its feet in silence as far as the bet deserves, then lets them have it', () => {
    expect(moodOnTheRail('nothing')).toBeNull();
    expect(moodOnTheRail('some')).toBe('hush');
    expect(moodOnTheRail('big')).toBe('hushed-rise');
    expect(moodAsTheyGo('nothing')).toBe('clap');
    expect(moodAsTheyGo('some')).toBe('cheer');
    expect(moodAsTheyGo('big')).toBe('roar');
  });

  it('never takes the view off the rail for it', () => {
    expect(crowdTakesTheView('hush')).toBe(false);
    expect(crowdTakesTheView('hushed-rise')).toBe(false);
  });
});
