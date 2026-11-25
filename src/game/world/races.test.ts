import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { getWorldMap, type WorldMapDefinition } from '../worldMap';
import { gateKey } from './gates';
import { ledgesForMap } from './ledges';
import { RACER_GROUND, knowingLine, raceGround, racerLine } from './raceLine';
import {
  MERE_DASH,
  PURSE_STONES,
  RACE_COURSES,
  courseStartedAt,
  raceChipLines,
  raceMedal,
  raceOfferLines,
  racePrize,
  raceQuestion,
  judgeLines,
  racerArrivesLines,
  racerWonLines,
  raceGossipAt,
  racerKnowsTheWay,
  raceLineWord,
  raceOutcome,
  raceRunShape,
  gaveUpWaitingLine,
  perfectTrophyLine,
  toeTheLineLine,
  isPerfect,
  racerTimeMs,
} from './races';
import { createRunTrainerEncounters } from './trainers';
import { TRADER_BARTERS } from '../hub/trader';
import file from './maps/greystoneVale.json';
import { MAX_CALL_LENGTH } from './villageCalls';

/**
 * THE MERE DASH measured on the real vale, so a redraw of Millbrook or Reedmere
 * that changes what the race is - the racer's road, the reeds' dry way, the
 * woodcutter's ride - fails here rather than in somebody's hands.
 */

const course = MERE_DASH;

/** Every figure a run meets: townsfolk on every tile of their beat, and the trainers. */
function figuresOn(map: WorldMapDefinition): GridPosition[] {
  const people = map.entities.flatMap((entity) => [entity.position, ...(entity.idle?.roam ?? [])]);
  const trainers = createRunTrainerEncounters()
    .filter((encounter) => encounter.mapId === map.id)
    .map((encounter) => encounter.position);
  return [...people, ...trainers].filter(
    (tile) => !(tile.x === course.racer.stands.x && tile.y === course.racer.stands.y),
  );
}

/**
 * The best way from `from` to the line, any ground, ledges hopped, a wild tile
 * counted as `wadeCost` steps: 0 is the fewest steps whatever the grass, a
 * few makes it the line a player who minds the grass would walk.
 */
function bestWay(map: WorldMapDefinition, from: GridPosition, wadeCost = 0): { steps: number; wild: number } {
  const blocked = new Set(figuresOn(map).map((tile) => tile.y * map.width + tile.x));
  const solid = (x: number, y: number) =>
    x < 0 || y < 0 || x >= map.width || y >= map.height || map.collision[y][x] || blocked.has(y * map.width + x);
  const ledges = ledgesForMap(map.id);
  const cost = new Map<number, number>();
  const way = new Map<number, { steps: number; wild: number }>();
  const start = from.y * map.width + from.x;
  cost.set(start, 0);
  way.set(start, { steps: 0, wild: 0 });
  const buckets: number[][] = [[start]];
  for (let spent = 0; spent < buckets.length; spent += 1) {
    for (const at of buckets[spent] ?? []) {
      if (cost.get(at) !== spent) continue;
      const x = at % map.width;
      const y = (at - x) / map.width;
      if (course.finish.tiles.some((tile) => tile.x === x && tile.y === y)) {
        return way.get(at)!;
      }
      const next: GridPosition[] = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 },
      ];
      for (const ledge of ledges) {
        if (ledge.drop === 'down' && ledge.brow.some((tile) => tile.x === x && tile.y === y)) {
          next.push({ x, y: y + ledge.depth + 1 });
        }
      }
      for (const tile of next) {
        if (solid(tile.x, tile.y)) continue;
        const key = tile.y * map.width + tile.x;
        const wades = map.tallGrass[tile.y][tile.x] ? 1 : 0;
        const total = spent + 1 + wades * wadeCost;
        if (cost.has(key) && cost.get(key)! <= total) continue;
        cost.set(key, total);
        way.set(key, { steps: way.get(at)!.steps + 1, wild: way.get(at)!.wild + wades });
        (buckets[total] ??= []).push(key);
      }
    }
  }
  return { steps: Number.POSITIVE_INFINITY, wild: 0 };
}

const shut = getWorldMap('greystone-vale');
const ride = shut.gates.find((gate) => gate.tiles.some((tile) => tile.x === 82 && tile.y === 188));
const open = getWorldMap('greystone-vale', ride ? [gateKey(ride)] : []);

describe('THE MERE DASH, on the vale as it is drawn', () => {
  it('has LINNET standing where the race is asked, from the map file', () => {
    const linnet = (file as { people: { x: number; y: number; name: string }[] }).people.find(
      (person) => person.name === 'Linnet',
    );
    expect(linnet).toMatchObject(course.racer.stands);
    expect(courseStartedAt('greystone-vale', course.racer.stands)).toBe(course);
  });

  it('has the woodcutter’s ride shut by a small tree only a Cut clears', () => {
    expect(ride).toMatchObject({ fieldMove: 'cut' });
  });

  it('gives LINNET a road the whole way, the same whichever way the ride stands', () => {
    const line = racerLine(raceGround(shut, figuresOn(shut)), course.racer.stands, course.finish.tiles, course.racer.waits);
    const lineOpen = racerLine(raceGround(open, figuresOn(open)), course.racer.stands, course.finish.tiles, course.racer.waits);
    expect(line).not.toBeNull();
    expect(lineOpen).toEqual(line);
    // Made ground from the first step to the line: the start and the waiting tile are the verge.
    const crossing = line!.findIndex((tile) => course.finish.tiles.some((one) => one.x === tile.x && one.y === tile.y));
    for (const tile of line!.slice(1, crossing + 1)) {
      expect(RACER_GROUND.has(shut.terrain[tile.y][tile.x])).toBe(true);
    }
    expect(line![line!.length - 1]).toEqual(course.racer.waits);
    // Pinned: a redraw that moves this changes the race, so it is seen here.
    expect(crossing).toBe(152);
  });

  it('starts everybody from one chalk mark beside her, on open ground', () => {
    const { mark, stands } = course.racer;
    expect(Math.abs(mark.x - stands.x) + Math.abs(mark.y - stands.y)).toBe(1);
    expect(shut.collision[mark.y][mark.x]).toBe(false);
  });

  it('cannot be won by following LINNET, and is won by the reeds\u2019 dry way', () => {
    const line = racerLine(raceGround(shut, figuresOn(shut)), course.racer.stands, course.finish.tiles)!;
    const racerMs = racerTimeMs(line.length);
    const mark = course.racer.mark;
    // Following her road from the mark is longer than her road: a nose behind, every time.
    const road = racerLine(raceGround(shut, figuresOn(shut)), mark, course.finish.tiles)!;
    expect(road.length).toBeGreaterThan(line.length);
    const best = bestWay(shut, mark);
    expect(best.steps * STEP_DURATION_MS).toBeLessThan(racerMs - 5000);
    // SILVER is the dry way run clean, with a few tiles' slack.
    expect(bestWay(shut, mark, 3).steps * STEP_DURATION_MS).toBeLessThan(course.silverMs - 600);
    // ...and GOLD is out of reach of every line the shut ride leaves.
    expect(best.steps * STEP_DURATION_MS).toBeGreaterThan(course.goldMs + 3000);
    expect(racerMs).toBeGreaterThan(course.silverMs + 4000);
  });

  it('is GOLD only down the woodcutter’s ride, with a few tiles to spare', () => {
    const from = course.racer.mark;
    expect(bestWay(open, from).steps * STEP_DURATION_MS).toBeLessThan(course.goldMs - 1000);
    // And it can be walked minding the grass: past the millpond and the last
    // wade to the door, and nowhere else.
    const dry = bestWay(open, from, 3);
    expect(dry.steps * STEP_DURATION_MS).toBeLessThan(course.goldMs - 300);
    // Dry from end to end: GOLD down the ride is skill, never a coin flip in the
    // grass (the overnight tester met a fight on 5 runs of 5 when it waded six tiles).
    expect(dry.wild).toBe(0);
  });
});

describe('the floor', () => {
  it('is the fewest steps from the mark down the ride: PERFECT is not a step wasted', () => {
    expect(course.perfectMs).toBe(bestWay(open, course.racer.mark).steps * STEP_DURATION_MS);
    // Judged on the tenth the screen shows: the frame the clock takes at GO and at the line is nobody's to see.
    expect(isPerfect(course, course.perfectMs + 33)).toBe(true);
    expect(isPerfect(course, course.perfectMs + 100)).toBe(false);
    expect(raceLineWord(course, { medal: 'gold', timeMs: course.perfectMs })).toBe('PERFECT 0:09.3');
    expect(raceLineWord(course, { medal: 'gold', timeMs: 10_350 })).toBe('GOLD 0:10.3');
    expect(raceLineWord(course, { medal: null, timeMs: 23_000 })).toBe('2ND 0:23.0');
  });
});

describe('the line', () => {
  // A crossing is called inside the step that lands on it, before warps,
  // pickups, landmarks and watches: so the line must stand where none is.
  it('stands on plain planks: no warp, way out, find, grass or trainer\u2019s watch', () => {
    const raw = file as unknown as { exits: { x: number; y: number }[]; itemSpots: { x: number; y: number }[] };
    for (const tile of course.finish.tiles) {
      expect(shut.warps.some((warp) => warp.source.x === tile.x && warp.source.y === tile.y)).toBe(false);
      expect(raw.exits.some((exit) => exit.x === tile.x && exit.y === tile.y)).toBe(false);
      expect(raw.itemSpots.some((spot) => spot.x === tile.x && spot.y === tile.y)).toBe(false);
      expect(shut.tallGrass[tile.y][tile.x]).toBe(false);
      expect(shut.pois.some((poi) => poi.position.x === tile.x && poi.position.y === tile.y)).toBe(false);
      for (const trainer of createRunTrainerEncounters().filter((one) => one.mapId === shut.id)) {
        expect(Math.abs(trainer.position.x - tile.x) + Math.abs(trainer.position.y - tile.y)).toBeGreaterThan(6);
      }
    }
  });
});

describe('LINNET, once she has learned the dry way', () => {
  it('runs the reeds\u2019 dry way at the player\u2019s pace, never up the ride, so only the ride beats her', () => {
    expect(racerKnowsTheWay({ runs: 1, wins: 1, medal: 'bronze' }, true)).toBe(false);
    expect(racerKnowsTheWay({ runs: 1, wins: 1, medal: 'silver' }, true)).toBe(true);
    // Not while the ride is shut to the player: a rung is only put above somebody who can climb it.
    expect(racerKnowsTheWay({ runs: 1, wins: 1, medal: 'silver' }, false)).toBe(false);
    for (const map of [shut, open]) {
      const line = knowingLine(raceGround(map, figuresOn(map)), course.racer.stands, course.finish.tiles, course.racer.keepsOff, course.racer.waits);
      expect(line).not.toBeNull();
      const off = course.racer.keepsOff;
      expect(line!.some((tile) => tile.x >= off.x && tile.x < off.x + off.width && tile.y >= off.y && tile.y < off.y + off.height)).toBe(false);
      const crossing = line!.findIndex((tile) => course.finish.tiles.some((one) => one.x === tile.x && one.y === tile.y));
      const herMs = racerTimeMs(crossing + 1);
      // Under SILVER herself, and a step ahead of the dry way from the mark.
      expect(herMs).toBeLessThan(course.silverMs);
      const mark = course.racer.mark;
      expect(bestWay(shut, mark, 3).steps * STEP_DURATION_MS).toBeGreaterThan(herMs);
      // Wading straight through can nose ahead - through enough wild grass to be a dice roll.
      const wade = bestWay(shut, mark);
      if (wade.steps * STEP_DURATION_MS < herMs) expect(wade.wild).toBeGreaterThanOrEqual(10);
      if (map === open) {
        expect(bestWay(open, mark, 3).steps * STEP_DURATION_MS).toBeLessThan(herMs - 3000);
      }
    }
  });
});

describe('what a race pays', () => {
  it('pays a little a raid and the day’s purse for the first GOLD of the day', () => {
    const fresh = { purseTakenToday: false, trophyBanked: false };
    expect(racePrize('lost', null, fresh)).toEqual({ money: 10, purse: false, trophy: false });
    expect(racePrize('won', 'bronze', fresh)).toEqual({ money: 30, purse: false, trophy: false });
    // The first SILVER or better puts the trophy on the shelf; a GOLD every raid is worth the most.
    expect(racePrize('won', 'silver', fresh)).toEqual({ money: 40, purse: false, trophy: true });
    expect(racePrize('won', 'gold', fresh)).toEqual({ money: 60, purse: true, trophy: true });
    expect(racePrize('won', 'gold', { purseTakenToday: true, trophyBanked: true })).toEqual({ money: 60, purse: false, trophy: false });
    expect(racePrize('late', null, fresh)).toEqual({ money: 0, purse: false, trophy: false });
  });

  it('makes the shortcut’s purse worth at least twice what Cut costs at Bill’s (the captain, 25 Nov 2026)', () => {
    const materials = (id: string) =>
      TRADER_BARTERS.find((barter) => barter.gives.itemId === id)!.takes.reduce((sum, take) => sum + take.quantity, 0);
    for (const stone of PURSE_STONES) {
      expect(materials(stone)).toBeGreaterThanOrEqual(2 * materials('hm01-cut'));
    }
  });

  it('marks a crossing by the clock, and only one that beat the racer', () => {
    expect(raceMedal(course, 10_000, true)).toBe('gold');
    expect(raceMedal(course, 15_000, true)).toBe('silver');
    expect(raceMedal(course, 20_000, true)).toBe('bronze');
    expect(raceMedal(course, 10_000, false)).toBeNull();
  });
});

describe('what LINNET says', () => {
  it('asks the captain\u2019s question, and says where the line is and what it pays before it', () => {
    expect(raceQuestion(course)).toBe('Do you want to race LINNET to THE LAST HOUSE?');
    const offer = raceOfferLines(course, undefined, false, false).join(' ');
    expect(offer).toContain('THE LAST HOUSE');
    expect(offer).toContain('₽30');
    expect(offer).toContain('₽10');
    expect(offer).toContain('evolution stone');
    // Once it is known, one line and the purse.
    const back = raceOfferLines(course, { runs: 2, wins: 1, bestMs: 14_200, medal: 'silver' }, true, true);
    expect(back[0]).toContain('Your best: 0:14.2 SILVER');
    expect(back[0]).toContain("I know the reeds' dry way now");
    expect(back[1]).toContain('come back tomorrow');
    // The ride still shut: she has not learned anything to wall them out with.
    expect(raceOfferLines(course, { runs: 2, wins: 1, bestMs: 14_200, medal: 'silver' }, true, false)[0]).not.toContain('dry way');
    // Asked again the same raid after a NO: short.
    expect(raceOfferLines(course, undefined, false, false, true)).toEqual(['LINNET: Changed your mind?']);
    expect(raceOfferLines(course, { runs: 9, wins: 8, bestMs: 9_316, medal: 'gold', perfect: true }, false, true)[0]).toContain('Your best: 0:09.3 PERFECT');
  });

  it('lets the judge call a win, and the racer say their piece as they run in', () => {
    const input = {
      outcome: 'won' as const,
      fightMs: 0,
      offRoad: true,
      racerKnew: false,
      tookShortcut: false,
      shortcutOpen: false,
      firstGold: true,
      hadPerfect: false,
      beatenBefore: false,
      timeMs: 15_200,
      racerMs: 22_800,
      medal: 'silver' as const,
      newBest: false,
      prize: { money: 40, purse: false, trophy: false },
    };
    expect(judgeLines(course, input).join(' ')).toBe('OLD REEVE: Over the line! 0:15.2. SILVER! LINNET left your winnings with me: ₽40.');
    const arrives = racerArrivesLines(course, input).join(' ');
    expect(arrives).toContain('Beat me by 7.6s');
    expect(arrives).toContain('woodcutter');
    expect(arrives).toContain('Bill trades a Cut disc');
    // Down the ride and short of GOLD: told what cost it, not told to go and find the ride.
    const ride = racerArrivesLines(course, { ...input, tookShortcut: true, fightMs: 1500, timeMs: 12_200 }).join(' ');
    expect(ride).toContain('The ride! I KNEW it.');
    expect(ride).toContain('Stop to fight and you lose it.');
    expect(ride).not.toContain('Bill');
    // The tenth identical win is not met with the first one's surprise.
    expect(racerArrivesLines(course, { ...input, beatenBefore: true }).join(' ')).toContain('Again?!');
    expect(racerArrivesLines(course, { ...input, medal: 'gold', timeMs: 10_500, firstGold: false, hadPerfect: true }).join(' ')).toContain("You've done it in 0:09.3");
    expect(racerArrivesLines(course, { ...input, medal: 'gold', timeMs: 9_300 }).join(' ')).toContain('Not a step wasted');
    // Once the ride is cut it is no longer grown shut.
    expect(racerArrivesLines(course, { ...input, shortcutOpen: true }).join(' ')).toContain('open now');
    // The first GOLD is the best run she has ever seen; the tenth is not.
    expect(racerArrivesLines(course, { ...input, medal: 'gold', timeMs: 10_500 }).join(' ')).toContain('best run');
    expect(racerArrivesLines(course, { ...input, medal: 'gold', timeMs: 10_500, firstGold: false }).join(' ')).toContain('GOLD again');
    // A photo finish is called as one.
    expect(judgeLines(course, { ...input, timeMs: 22_805 }).join(' ')).toContain('Photo finish');
    expect(judgeLines(course, { ...input, timeMs: 22_750 }).join(' ')).not.toContain('Photo finish');
    // A GOLD a tenth or two off the floor is told it was the start.
    // What kept it off PERFECT, read off the run: a stand at GO, or a step too many - and never in place of a first GOLD's line.
    const near = { ...input, medal: 'gold' as const, timeMs: 9_450, firstGold: false };
    expect(racerArrivesLines(course, { ...near, steps: 62, startLagMs: 150, cornerLossMs: 0 }).join(' ')).toContain('standing still at GO cost you a tenth');
    expect(racerArrivesLines(course, { ...near, steps: 62, startLagMs: 150, cornerLossMs: 0 }).join(' ')).toContain('Keep the direction held down through my count');
    expect(racerArrivesLines(course, { ...near, steps: 63, startLagMs: 20, cornerLossMs: 0 }).join(' ')).toContain('63 where 62 will do');
    // The likeliest miss: a prompt start, the floor's steps, a frame or two lost at each corner.
    const corners = racerArrivesLines(course, { ...near, steps: 62, startLagMs: 17, cornerLossMs: 120 }).join(' ');
    expect(corners).toContain('stopping at the corners cost you a tenth');
    expect(corners).toContain('Let go of the old way');
    // A fight-free run on the floor's steps always hears what it lost, never "spray a Repel".
    expect(corners).not.toContain('Repel');
    expect(racerArrivesLines(course, { ...near, steps: 62, startLagMs: 0, cornerLossMs: 0 }).join(' ')).toContain('GOLD again');
    // A first GOLD has never been told PERFECT is there: the tip says what it is.
    const first = racerArrivesLines(course, { ...near, firstGold: true, steps: 62, startLagMs: 150, cornerLossMs: 0 });
    expect(first[0]).toContain('best run');
    expect(first[1]).toContain('0:09.3 is PERFECT');
    expect(raceRunShape([83, 169, 0, 82, 169, 210, 81, 169, 360, 80, 169, 600])).toEqual({ steps: 3, startLagMs: 60, cornerLossMs: 90 });
    // Far off PERFECT and fight-free is still told why - never the Repel line meant for a fight.
    const late = racerArrivesLines(course, { ...near, steps: 62, startLagMs: 350, cornerLossMs: 0, timeMs: 9_650 }).join(' ');
    expect(late).toContain('GOLD again. 0:09.3 is PERFECT - standing still at GO cost you 3 tenths');
    const round = racerArrivesLines(course, { ...near, steps: 68, startLagMs: 17, cornerLossMs: 0, timeMs: 10_217 }).join(' ');
    expect(round).toContain('you took 68 steps where 62 will do');
    expect(racerArrivesLines(course, { ...near, steps: 62, startLagMs: 60, cornerLossMs: 0, timeMs: 9_420 }).join(' ')).toContain('standing still at GO cost you a tenth');
    expect(racerArrivesLines(course, { ...near, fightMs: 1500, timeMs: 10_800 }).join(' ')).toContain('Spray a Repel');
    // "So close!" by the tenths shown: two runs that both read 0:09.5 hear the same.
    expect(racerArrivesLines(course, { ...near, steps: 62, startLagMs: 200, cornerLossMs: 0, timeMs: 9_500 })[0]).toContain('So close!');
    expect(racerArrivesLines(course, { ...near, steps: 62, startLagMs: 220, cornerLossMs: 0, timeMs: 9_520 })[0]).toContain('So close!');
    // A GOLD holder down the ride and short of it is reminded of their own best, not taught the par.
    const holder = racerArrivesLines(course, { ...input, tookShortcut: true, fightMs: 1500, timeMs: 12_100, firstGold: false, bestMs: 10_300 }).join(' ');
    expect(holder).toContain("You've run it in 0:10.3");
    expect(holder).not.toContain('is in there');
    expect(gaveUpWaitingLine(course)).toBe('LINNET gave up waiting at the chalk mark.');
    // A ride run lost by seconds stood about on the way; only a whisker is "by a hair".
    const lostRide = (timeMs: number) =>
      racerWonLines(course, { ...input, outcome: 'lost', medal: null, tookShortcut: true, fightMs: 0, timeMs, racerMs: 15_450 }).join(' ');
    expect(lostRide(15_600)).toContain('by a hair');
    expect(lostRide(20_850)).toContain('5.4s behind me - you stood about on the way');
    expect(perfectTrophyLine(course, 'Glass Ornament', false)).toContain('every race LINNET ever ran');
    // Beaten, she calls for a rematch, never "Nobody beats me!" - and every call fits a bubble.
    for (const record of [{ runs: 2, wins: 1, medal: 'silver' as const }, { runs: 9, wins: 7, medal: 'gold' as const, perfect: true as const }]) {
      const calls = course.beatenCalls(record);
      expect(calls.join(' ')).not.toContain('Nobody beats me');
      for (const call of calls) expect(call.length).toBeLessThanOrEqual(MAX_CALL_LENGTH);
    }
    // The gap she quotes is the gap between the times on screen.
    expect(racerWonLines(course, { ...input, outcome: 'lost', medal: null, timeMs: 23_000, racerMs: 22_800 }).join(' ')).toContain('Beat you by 0.2s!');
    expect(perfectTrophyLine(course, 'Glass Ornament', false)).toContain('never written one of those down');
    expect(perfectTrophyLine(course, 'Glass Ornament', true)).toContain('Get it home this time');
    expect(toeTheLineLine(course, true)).toContain('Off the bike!');
    expect(toeTheLineLine(course, false)).toContain('the white one');
  });

  it('tells a loser what lost it: the boardwalk, the fights, the long way, or her learning the way', () => {
    const lost = (fightMs: number, offRoad: boolean, racerKnew: boolean) =>
      racerWonLines(course, {
        outcome: 'lost',
        fightMs,
        offRoad,
        racerKnew,
        tookShortcut: false,
        shortcutOpen: false,
        firstGold: true,
        hadPerfect: false,
        beatenBefore: false,
        timeMs: 23_400,
        racerMs: 22_800,
        medal: null,
        newBest: false,
        prize: { money: 10, purse: false, trophy: false },
      }).join(' ');
    expect(lost(0, false, false)).toContain('boardwalk');
    expect(lost(0, false, false)).toContain('Beat you by 0.6s!');
    expect(lost(9100, true, false)).toContain('0:23.4 (9.1s of it fighting)');
    expect(lost(9100, true, false)).toContain("I don't stop while you fight");
    expect(lost(0, true, false)).toContain('straighter');
    expect(lost(0, true, true)).toContain('My dry way now');
    expect(lost(0, true, true)).toContain('never beat me');
  });

  it('calls a dead heat the player\u2019s, on the tenth the screen shows', () => {
    expect(raceOutcome(15_450, 15_450)).toBe('won');
    expect(raceOutcome(15_467, 15_450)).toBe('won');
    expect(raceOutcome(15_517, 15_450)).toBe('lost');
  });

  it('keeps the chip to what a glance can take', () => {
    const lines = raceChipLines({
      course,
      clockMs: 7400,
      racerPlace: 'THE HUMMOCK',
      racerHomeMs: null,
      waitLeftMs: null,
      bearing: 'SW',
      tilesToLine: 41,
      bestMs: 15_200,
    });
    expect(lines).toEqual(['RACE 0:07.4', 'LINNET: THE HUMMOCK', 'LINE SW 41', 'BEST 0:15.2']);
    // A best that reads as the floor is not shown the floor to chase.
    const atFloor = { course, clockMs: 0, racerPlace: null, racerHomeMs: null, waitLeftMs: null, bearing: 'S', tilesToLine: 60, bestMs: 9_316, perfectMs: 9_300 };
    expect(raceChipLines(atFloor)).toContain('BEST 0:09.3');
    expect(raceChipLines({ course, clockMs: 0, racerPlace: null, racerHomeMs: null, waitLeftMs: null, bearing: 'W', tilesToLine: 2, bestMs: undefined, liningUp: true })).toEqual([
      'RACE: TOE THE MARK',
      'MARK W 2',
    ]);
  });

  it('has the village talk about a race once it is won, and not before', () => {
    const own = ['MILL SQUARE', 'West: the Westward Road.', 'RACES: ask LINNET, by the alley off the south street. Nobody has beaten her yet.'];
    expect(raceGossipAt('greystone-vale', { x: 101, y: 157 }, { 'mere-dash': { runs: 2, wins: 0 } }, own)).toBeUndefined();
    const sign = raceGossipAt('greystone-vale', { x: 101, y: 157 }, { 'mere-dash': { runs: 3, wins: 1, bestMs: 10_200, medal: 'gold' } }, own);
    expect(sign).toEqual(['MILL SQUARE', 'West: the Westward Road.', 'RACES: ask LINNET, by the alley. Course record: 0:10.2 GOLD. She is furious.']);
    expect(raceGossipAt('greystone-vale', { x: 88, y: 162 }, { 'mere-dash': { runs: 1, wins: 1, medal: 'silver' } }, [])?.join(' ')).toContain(
      'practises every night',
    );
  });

  it('has one course per racer standing tile', () => {
    const tiles = RACE_COURSES.map((one) => `${one.mapId}:${one.racer.stands.x},${one.racer.stands.y}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });
});
