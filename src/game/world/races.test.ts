import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { getWorldMap, type WorldMapDefinition } from '../worldMap';
import { gateKey } from './gates';
import { ledgesForMap } from './ledges';
import { RACER_GROUND, raceGround, racerLine } from './raceLine';
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
  raceResultLines,
  racerTimeMs,
} from './races';
import { createRunTrainerEncounters } from './trainers';
import { TRADER_BARTERS } from '../hub/trader';
import file from './maps/greystoneVale.json';

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

/** Where a player can stand to ask: beside the racer, on open ground. */
function askingTiles(map: WorldMapDefinition): GridPosition[] {
  const { x, y } = course.racer.stands;
  return [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ].filter((tile) => !map.collision[tile.y][tile.x]);
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

  it('cannot be won by following LINNET, and is won by the reeds’ dry way', () => {
    const line = racerLine(raceGround(shut, figuresOn(shut)), course.racer.stands, course.finish.tiles)!;
    const racerMs = racerTimeMs(line.length);
    for (const from of askingTiles(shut)) {
      const best = bestWay(shut, from);
      // Beside her, a step behind: following her road is never ahead of her.
      expect(best.steps * STEP_DURATION_MS).toBeLessThan(racerMs - 5000);
      // SILVER is the dry way run clean, with a few tiles' slack from any side of her.
      expect(best.steps * STEP_DURATION_MS).toBeLessThan(course.silverMs - 600);
      // ...and GOLD is out of reach of every line the shut ride leaves.
      expect(best.steps * STEP_DURATION_MS).toBeGreaterThan(course.goldMs + 3000);
    }
    expect(racerMs).toBeGreaterThan(course.silverMs + 4000);
  });

  it('is GOLD only down the woodcutter’s ride, with a few tiles to spare', () => {
    for (const from of askingTiles(open)) {
      expect(bestWay(open, from).steps * STEP_DURATION_MS).toBeLessThan(course.goldMs - 1000);
      // And it can be walked minding the grass: past the millpond and the last
      // wade to the door, and nowhere else.
      const dry = bestWay(open, from, 3);
      expect(dry.steps * STEP_DURATION_MS).toBeLessThan(course.goldMs - 300);
      expect(dry.wild).toBeLessThanOrEqual(6);
    }
  });
});

describe('what a race pays', () => {
  it('pays a little a raid and the day’s purse for the first GOLD of the day', () => {
    const fresh = { purseTakenToday: false, trophyBanked: false };
    expect(racePrize('lost', null, fresh)).toEqual({ money: 10, purse: false, trophy: false });
    expect(racePrize('won', 'bronze', fresh)).toEqual({ money: 30, purse: false, trophy: false });
    expect(racePrize('won', 'silver', fresh)).toEqual({ money: 30, purse: false, trophy: false });
    expect(racePrize('won', 'gold', fresh)).toEqual({ money: 30, purse: true, trophy: true });
    expect(racePrize('won', 'gold', { purseTakenToday: true, trophyBanked: true })).toEqual({ money: 30, purse: false, trophy: false });
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
  it('asks the captain’s question, and says where the line is and what it pays before it', () => {
    expect(raceQuestion(course)).toBe('Do you want to race LINNET to THE LAST HOUSE?');
    const offer = raceOfferLines(course, undefined, false).join(' ');
    expect(offer).toContain('THE LAST HOUSE');
    expect(offer).toContain('₽30');
    expect(offer).toContain('₽10');
    expect(offer).toContain('evolution stone');
    expect(raceOfferLines(course, undefined, true).join(' ')).toContain('come back tomorrow');
    expect(raceOfferLines(course, { runs: 2, wins: 1, bestMs: 14_200, medal: 'silver' }, false).join(' ')).toContain(
      'Your best: 0:14.2 (SILVER)',
    );
  });

  it('tells a loser about the reeds and a winner without GOLD about the ride', () => {
    const lost = raceResultLines(course, {
      outcome: 'lost',
      fightMs: 0,
      offRoad: false,
      timeMs: 23_400,
      racerMs: 22_950,
      medal: null,
      newBest: true,
      prize: { money: 10, purse: false, trophy: false },
    }).join(' ');
    expect(lost).toContain('LINNET crossed first, 0.5s ahead');
    expect(lost).toContain('dry way');
    const won = raceResultLines(course, {
      outcome: 'won',
      fightMs: 0,
      offRoad: true,
      timeMs: 15_200,
      racerMs: 22_950,
      medal: 'silver',
      newBest: false,
      prize: { money: 30, purse: false, trophy: false },
    }).join(' ');
    expect(won).toContain('SILVER!');
    const waded = raceResultLines(course, {
      outcome: 'lost',
      fightMs: 9100,
      offRoad: true,
      timeMs: 26_800,
      racerMs: 22_800,
      medal: null,
      newBest: false,
      prize: { money: 10, purse: false, trophy: false },
    }).join(' ');
    expect(waded).toContain('0:26.8 (9.1s of it fighting)');
    expect(waded).toContain("I don't stop while you fight");
    expect(won).toContain('woodcutter');
  });

  it('keeps the chip to what a glance can take', () => {
    const lines = raceChipLines({
      course,
      clockMs: 7400,
      racerPlace: 'THE HUMMOCK',
      racerHomeMs: null,
      waitLeftMs: null,
      bearing: 'SW',
      bestMs: 15_200,
    });
    expect(lines).toEqual(['RACE 0:07.4', 'LINNET: THE HUMMOCK', 'LINE: THE LAST HOUSE SW', 'BEST 0:15.2']);
  });

  it('has one course per racer standing tile', () => {
    const tiles = RACE_COURSES.map((one) => `${one.mapId}:${one.racer.stands.x},${one.racer.stands.y}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });
});
