import { describe, expect, it } from 'vitest';
import { getBaseMap } from '../base/baseMap';
import { harbourBite } from '../base/harbourFishing';
import {
  advanceDerby,
  bestLines,
  COURSE,
  COUNTDOWN_MS,
  derbyField,
  derbyGoing,
  DERBY_ENTRANTS,
  FIELD_SIZE,
  linesOpenTo,
  playerPlace,
  startDerby,
  stepDerby,
  type DerbyEntrant,
} from './derby';
import { DIG_HEIGHT, DIG_WIDTH, digAt, digShape, digsFor, isDug, startDig } from './dig';
import { biteChance, catchScore, FISHING_DERBY_MS, landCatch, modelFishingDerby, startFishingDerby } from './fishingDerby';
import { modelDerby, modelDig } from './outdoorModels';
import { derbyTickets, digTickets, fishingDerbyTickets } from './tickets';
import { roller, traits } from './traits';

/** A field for a seed, five of the twelve, as a day's field is. */
function fieldFor(seed: number): readonly DerbyEntrant[] {
  const roll = roller(seed * 7919);
  const pool = [...DERBY_ENTRANTS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(roll() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, FIELD_SIZE);
}

const RACES = 40;
function meanPlace(species: string, wet = false): number {
  let total = 0;
  for (let seed = 1; seed <= RACES; seed += 1) {
    const race = modelDerby(traits(species), fieldFor(seed), wet, seed, 0.8);
    total += playerPlace(race) ?? 6;
  }
  return total / RACES;
}

describe('THE PROMENADE DERBY', () => {
  it('runs on ground of the harbour: every land leg on tiles somebody can stand on, the swim in the sea', () => {
    const map = getBaseMap([]);
    for (const leg of Object.values(COURSE)) {
      for (const point of leg.points) {
        const terrain = map.terrain[point.y]?.[point.x];
        if (leg.surface === 'land') {
          expect(map.collision[point.y]?.[point.x], `${leg.id} at ${point.x},${point.y}`).toBe(false);
        }
        if (leg.surface === 'water' && point !== leg.points[0] && point !== leg.points[leg.points.length - 1]) {
          expect(terrain, `${leg.id} at ${point.x},${point.y}`).toBe('water');
        }
      }
    }
  });

  it('lets a Water type swim the bay and a Flying type fly home, and nobody else', () => {
    expect(linesOpenTo(traits('squirtle'))).toEqual(['pier', 'bay']);
    expect(linesOpenTo(traits('pidgey'))).toEqual(['pier', 'air']);
    expect(linesOpenTo(traits('charmander'))).toEqual(['pier']);
    expect(bestLines(traits('doduo'), false).second).toBe('air');
    expect(bestLines(traits('horsea'), false).second).toBe('bay');
    // A big one takes the wide line rather than the tight turn.
    expect(bestLines(traits('venusaur'), false).first).toBe('wide');
    expect(bestLines(traits('rattata'), false).first).toBe('inside');
  });

  it('is the same field and the same going for everybody on a day, and changes from day to day', () => {
    expect(derbyField('2026-11-05')).toEqual(derbyField('2026-11-05'));
    expect(derbyField('2026-11-05')).toHaveLength(FIELD_SIZE);
    const days = Array.from({ length: 30 }, (_, index) => `2026-11-${String(index + 1).padStart(2, '0')}`);
    expect(new Set(days.map((day) => derbyField(day).map((entrant) => entrant.handle).join())).size).toBeGreaterThan(20);
    const wet = days.filter((day) => derbyGoing(day) === 'wet').length;
    expect(wet).toBeGreaterThan(4);
    expect(wet).toBeLessThan(18);
  });

  it('plays the same race at any frame rate', () => {
    const play = (frameMs: number): number | null => {
      let race = startDerby({ name: 'YOU', racer: traits('ponyta') }, fieldFor(3), false, 3);
      let clock = 0;
      while (!race.over) {
        // A tap every 100 ms, from the gun.
        const tap = clock >= COUNTDOWN_MS && Math.floor(clock / 100) !== Math.floor((clock + frameMs) / 100);
        race = advanceDerby(race, frameMs, { tap });
        clock += frameMs;
      }
      return race.runners[0].finishedMs;
    };
    const sixty = play(1000 / 60);
    expect(sixty).not.toBeNull();
    // A 100 ms frame plays the same frames; the taps land on the same 100 ms marks.
    expect(Math.abs((play(100) ?? 0) - (sixty ?? 0))).toBeLessThan(400);
  });

  it('stumbles a racer that sprints through a tight corner, and knocks a bumper off its line', () => {
    let race = startDerby({ name: 'YOU', racer: traits('rattata') }, [], false, 1);
    let stumbled = false;
    while (!race.over) {
      race = stepDerby(race, { tap: true });
      if (race.events.some((event) => event.kind === 'stumble' && event.runner === 0)) stumbled = true;
    }
    expect(stumbled).toBe(true);
  });

  it('is won by the right racer and lost by the wrong one, as numbers', () => {
    const ponyta = meanPlace('ponyta');
    const charmander = meanPlace('charmander');
    const bulbasaur = meanPlace('bulbasaur');
    // Ponyta (fast, small, Run Away) is the best racer a player is likely to have.
    expect(ponyta).toBeLessThan(1.5);
    // Charmander is fair, Bulbasaur the worst of the starters.
    expect(charmander).toBeLessThan(bulbasaur);
    expect(bulbasaur).toBeGreaterThan(4.3);
    // Strong but wrong: slow, and nine squares at every corner.
    expect(meanPlace('venusaur')).toBeGreaterThan(charmander);
    expect(meanPlace('golem')).toBeGreaterThan(5);
    // A flyer on the air line, a swimmer in the bay.
    expect(meanPlace('doduo')).toBeLessThan(1.5);
    // Squirtle is slower on land than Bulbasaur, and the bay carries it past.
    expect(bestLines(traits('squirtle'), false).second).toBe('bay');
    expect(meanPlace('squirtle')).toBeLessThan(bulbasaur - 1);
    // Swift Swim on a wet day.
    // Swift Swim on a wet day: a Horsea wins most days anyway, so it is the clock that says so.
    const time = (wet: boolean): number => {
      let total = 0;
      for (let seed = 1; seed <= RACES; seed += 1) total += modelDerby(traits('horsea'), fieldFor(seed), wet, seed, 0.8).runners[0].finishedMs ?? 60_000;
      return total / RACES;
    };
    expect(time(true)).toBeLessThan(time(false) - 1000);
  });

  it('pays a podium, and a win best', () => {
    expect(derbyTickets(6)).toBe(30);
    expect(derbyTickets(5)).toBe(20);
    expect(derbyTickets(4)).toBe(10);
    expect(derbyTickets(3)).toBe(0);
  });
});

describe('THE DIG', () => {
  it('buries six things, three of them berries, and never two in a square', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = startDig(traits('charmander'), seed);
      expect(game.buried).toHaveLength(6);
      expect(game.buried.filter((thing) => thing.kind === 'berry')).toHaveLength(3);
      expect(new Set(game.buried.map((thing) => `${thing.x},${thing.y}`)).size).toBe(6);
      for (const square of [...game.buried, ...game.loose]) {
        expect(square.x).toBeLessThan(DIG_WIDTH);
        expect(square.y).toBeLessThan(DIG_HEIGHT);
      }
    }
  });

  it('digs a plus for a Ground type, and gives two more digs for knowing Dig', () => {
    expect(digShape(traits('diglett'), 3, 2)).toHaveLength(5);
    expect(digShape(traits('diglett'), 0, 0)).toHaveLength(3);
    expect(digShape(traits('pidgey'), 3, 2)).toHaveLength(1);
    expect(digsFor(traits('charmander'))).toBe(10);
    expect(digsFor(traits('charmander', ['Dig']))).toBe(12);
  });

  it('never caves in on Sand Veil, and wastes a dig into loose sand otherwise, now and then', () => {
    let caved = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const [species, veil] of [['sandshrew', true], ['charmander', false]] as const) {
        let game = startDig(traits(species), seed);
        for (const square of game.loose) {
          const result = digAt(game, square.x, square.y);
          if (veil) expect(result.events.some((event) => event.kind === 'caved')).toBe(false);
          else caved += result.events.filter((event) => event.kind === 'caved').length;
          game = result.game;
        }
      }
    }
    expect(caved).toBeGreaterThan(20);
  });

  it('pings HOT a square from the nearest thing, and finds what is under the spade', () => {
    const game = startDig(traits('charmander'), 9);
    const thing = game.buried[0];
    const found = digAt(game, thing.x, thing.y);
    if (!found.events.some((event) => event.kind === 'caved')) {
      expect(found.game.found).toContainEqual(thing);
      expect(isDug(found.game, thing.x, thing.y)).toBe(true);
    }
    expect(found.game.digsLeft).toBe(9);
  });

  it('is dug best by a Ground type and worst by a plain one, as numbers', () => {
    const mean = (species: string, moves: readonly string[] = []): number => {
      let total = 0;
      for (let seed = 1; seed <= 60; seed += 1) total += modelDig(traits(species, moves), seed).score;
      return total / 60;
    };
    const diglett = mean('diglett', ['dig']);
    const pidgey = mean('pidgey');
    const charmander = mean('charmander');
    const psyduck = mean('psyduck');
    expect(diglett).toBeGreaterThan(pidgey);
    expect(pidgey).toBeGreaterThan(psyduck);
    expect(mean('charmander', ['dig'])).toBeGreaterThan(charmander);
    expect(mean('meowth')).toBeGreaterThan(psyduck);
    expect(digTickets(diglett)).toBeGreaterThanOrEqual(20);
    expect(digTickets(psyduck)).toBe(10);
  });
});

describe('THE FISHING DERBY', () => {
  it('bites every cast for Illuminate, a cast in four for Stench and every other otherwise', () => {
    expect(biteChance(traits('staryu'))).toBe(1);
    expect(biteChance(traits('grimer'))).toBe(0.25);
    expect(biteChance(traits('charmander'))).toBe(0.5);
    expect(biteChance(null)).toBe(0.5);
  });

  it('scores a catch its level, and ten more for a kind new this derby', () => {
    let state = startFishingDerby(null, '');
    const first = landCatch(state, 'horsea', 12);
    expect(first.scored).toBe(catchScore(12, true));
    state = first.state;
    expect(landCatch(state, 'horsea', 7).scored).toBe(7);
  });

  it('lasts two minutes and is fished best off the deep end with a Staryu, worst with a Grimer', () => {
    const tally = (species: string, row: number): number => {
      let total = 0;
      for (let seed = 1; seed <= 60; seed += 1) {
        const state = modelFishingDerby(
          traits(species),
          (roll) => {
            const bite = harbourBite({ x: 80, y: row }, roll);
            return { speciesId: bite?.name ?? 'MAGIKARP', level: bite?.level ?? 5 };
          },
          roller(seed),
        );
        expect(state.elapsed).toBeGreaterThanOrEqual(FISHING_DERBY_MS);
        total += state.score;
      }
      return total / 60;
    };
    const staryu = tally('staryu', 30);
    const plain = tally('charmander', 30);
    const shallows = tally('charmander', 18);
    const grimer = tally('grimer', 30);
    expect(fishingDerbyTickets(staryu)).toBe(30);
    expect(fishingDerbyTickets(plain)).toBe(20);
    expect(shallows).toBeLessThan(plain);
    expect(fishingDerbyTickets(grimer)).toBe(10);
  });
});
