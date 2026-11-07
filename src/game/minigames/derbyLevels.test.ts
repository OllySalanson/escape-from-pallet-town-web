import { describe, expect, it } from 'vitest';
import { getBaseMap } from '../base/baseMap';
import { GENERATED_SPECIES } from '../pokemon/generated/speciesCatalogue';
import {
  advanceDerby,
  bestLines,
  COUNTDOWN_MS,
  derbyClearedAfter,
  derbyField,
  derbyGoing,
  derbyLevelOpen,
  derbyLevelOpened,
  DERBY_ENTRANTS,
  DERBY_LEVELS,
  derbyScore,
  forksOf,
  legLength,
  lineForKey,
  mayTake,
  playerPlace,
  PODIUM,
  readDerbyCleared,
  routeOf,
  startDerby,
  stepDerby,
  THE_FRONT,
  toNextHurdle,
  type CourseLeg,
  type DerbyLevel,
  type DerbyLines,
  type DerbyRace,
} from './derby';
import { modelDerby } from './outdoorModels';
import { traits } from './traits';
import FRONT_AS_SHIPPED from './derbyFront.fixture.json';

const legsOf = (level: DerbyLevel): readonly CourseLeg[] => [
  ...new Set(level.stretches.flatMap((stretch) => stretch.lines.flatMap((line) => line.legs))),
];
const ends = (leg: CourseLeg) => ({ first: leg.points[0], last: leg.points[leg.points.length - 1] });

/** A race run to its end with no input at all: nobody sprints, the player takes each fork's first line. */
function runOut(race: DerbyRace): DerbyRace {
  let next = race;
  while (!next.over) next = stepDerby(next, {});
  return next;
}

/** Twenty days, each with its own field and going. */
const DAYS = Array.from({ length: 20 }, (_, index) => `2026-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`);

describe('THE PROMENADE DERBY levels', () => {
  it('runs THE FRONT exactly as it shipped: every race the shipped engine ran, the same frame for frame', () => {
    // Written by the race before it had levels; level 1 must never move from it.
    const fixture = FRONT_AS_SHIPPED as Readonly<Record<string, string>>;
    const seen: Record<string, string> = {};
    const record = (key: string, race: DerbyRace) => {
      const frames = race.runners.map((runner) => (runner.finishedMs === null ? '-' : Math.round((runner.finishedMs * 60) / 1000)));
      seen[key] = `${race.finishers.join(',')};${frames.join(',')};${race.runners[0].lines.first}/${race.runners[0].lines.second}`;
    };
    const species = ['ponyta', 'charmander', 'bulbasaur', 'squirtle', 'pidgey', 'venusaur', 'golem', 'horsea', 'doduo', 'pikachu', 'geodude', 'dugtrio', 'gyarados'];
    for (const kind of species) {
      for (const wet of [false, true]) {
        for (let seed = 1; seed <= 6; seed += 1) {
          record(`model:${kind}:${wet}:${seed}`, modelDerby(traits(kind), derbyField(THE_FRONT, `2026-11-0${seed}`), wet, seed, seed % 2 ? 0.8 : 0.4));
        }
      }
    }
    for (const kind of ['squirtle', 'pidgeotto', 'rattata', 'snorlax']) {
      for (const choice of [{}, { first: 'wide' }, { second: 'bay' }, { second: 'air' }, { first: 'wide', second: 'air' }] as readonly DerbyLines[]) {
        let race = startDerby(THE_FRONT, { name: 'YOU', racer: traits(kind) }, DERBY_ENTRANTS.slice(3, 8), false, 77);
        let clock = 0;
        while (!race.over) {
          const tap = clock >= COUNTDOWN_MS && Math.floor(clock / 230) !== Math.floor((clock + 50) / 230);
          race = advanceDerby(race, 50, { tap, lines: choice });
          clock += 50;
        }
        record(`script:${kind}:${JSON.stringify(choice)}`, race);
      }
    }
    expect(Object.keys(seen)).toHaveLength(Object.keys(fixture).length);
    expect(seen).toEqual(fixture);
  });

  it('draws every course on the harbour: land and sand on ground a figure can stand on, every swim over the sea', () => {
    const map = getBaseMap([]);
    for (const level of DERBY_LEVELS) {
      for (const leg of legsOf(level)) {
        for (let index = 1; index < leg.points.length; index += 1) {
          const [from, to] = [leg.points[index - 1], leg.points[index]];
          const quarters = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 4);
          // Every quarter tile along the leg, read as the tile it is drawn on.
          for (let step = 0; step <= quarters; step += 1) {
            const x = Math.round(from.x + ((to.x - from.x) * step) / quarters);
            const y = Math.round(from.y + ((to.y - from.y) * step) / quarters);
            const where = `${level.name} ${leg.id} at ${x},${y}`;
            if (leg.surface === 'land' || leg.surface === 'sand') expect(map.collision[y]?.[x], where).toBe(false);
            // A swim or a stretch of sand leaves from the edge of the stone or the boards and comes out on it.
            const near = (point: { x: number; y: number }) => Math.hypot(point.x - x, point.y - y) < 1.5;
            const atEnd = near(ends(leg).first) || near(ends(leg).last);
            if (leg.surface === 'sand' && !atEnd) expect(['sand', 'beach'], where).toContain(map.terrain[y]?.[x]);
            if (leg.surface === 'water' && !atEnd) expect(map.terrain[y]?.[x], where).toBe('water');
          }
        }
        for (const index of [...leg.tight, ...(leg.hurdles ?? []), ...(leg.waves ?? []).flatMap((wave) => [wave.from, wave.to])]) {
          expect(leg.points[index], `${level.name} ${leg.id} mark ${index}`).toBeDefined();
        }
        // A crate and a tight corner are never one point: the rule for each is the other's opposite.
        expect((leg.hurdles ?? []).filter((index) => leg.tight.includes(index))).toEqual([]);
        if (leg.waves) expect(leg.surface).toBe('land');
      }
    }
  });

  it('joins every course up: each fork starts where the road before it ends, and every line of it ends at one place', () => {
    for (const level of DERBY_LEVELS) {
      // The first stretch starts on the start line.
      for (const line of level.stretches[0].lines) {
        const first = line.legs[0].points[0];
        expect(first.x, level.name).toBe(level.start.x);
        expect(first.y).toBeGreaterThanOrEqual(level.start.from);
        expect(first.y).toBeLessThanOrEqual(level.start.to);
      }
      let from = level.stretches[0].lines[0].legs[0].points[0];
      for (const stretch of level.stretches) {
        const finishes = stretch.lines.map((line) => {
          let at = from;
          for (const leg of line.legs) {
            expect(ends(leg).first, `${level.name} ${line.id} ${leg.id}`).toEqual(at);
            at = ends(leg).last;
          }
          return at;
        });
        for (const finish of finishes) expect(finish, `${level.name} ${stretch.id}`).toEqual(finishes[0]);
        // Every line of a fork has its own arrow, and anybody may take at least one of them.
        if (stretch.lines.length > 1) {
          const keys = stretch.lines.map((line) => line.key);
          expect(new Set(keys).size, `${level.name} ${stretch.id}`).toBe(keys.length);
          expect(stretch.lines.some((line) => !line.needs)).toBe(true);
        }
        from = finishes[0];
      }
      // The last stretch ends on the finish line.
      expect(from.x, level.name).toBe(level.finish.x);
      expect(from.y).toBeGreaterThanOrEqual(level.finish.from);
      expect(from.y).toBeLessThanOrEqual(level.finish.to);
      // And the course stays inside the part of the harbour the race is seen in.
      for (const leg of legsOf(level)) {
        for (const point of leg.points) {
          expect(point.x).toBeGreaterThanOrEqual(level.view.x);
          expect(point.x).toBeLessThan(level.view.x + level.view.width);
          expect(point.y).toBeGreaterThanOrEqual(level.view.y);
          expect(point.y).toBeLessThan(level.view.y + level.view.height);
        }
      }
    }
  });

  it('can be finished on every level by every one of the 151, ridden well or not ridden at all, before the race is called', () => {
    const slow: string[] = [];
    for (const level of DERBY_LEVELS) {
      const field = derbyField(level, '2026-11-07');
      for (const species of GENERATED_SPECIES) {
        const racer = traits(species.id);
        const ridden = modelDerby(racer, field, false, species.dexId, 0.8, level);
        const idle = runOut(startDerby(level, { name: 'YOU', racer }, [], false, species.dexId));
        if (ridden.runners[0].finishedMs === null) slow.push(`${level.name} ${species.id} ridden`);
        if (idle.runners[0].finishedMs === null) slow.push(`${level.name} ${species.id} not ridden`);
      }
      // And every line, by somebody who may take it, riding nothing but that line.
      for (const fork of forksOf(level)) {
        for (const line of fork.lines) {
          const rider = ['golem', 'squirtle', 'pidgeot', 'doduo', 'lapras'].map((kind) => traits(kind)).find((racer) => mayTake(racer, line))!;
          const lines: DerbyLines = Object.fromEntries(forksOf(level).map((other) => [other.id, other === fork ? line.id : other.lines[0].id]));
          let race = startDerby(level, { name: 'YOU', racer: rider }, field, true, 5);
          while (!race.over) race = stepDerby(race, { lines });
          expect(routeOf(level, race.runners[0].lines)).toEqual(routeOf(level, lines));
          if (race.runners[0].finishedMs === null) slow.push(`${level.name} ${fork.id}:${line.id} by ${rider.species}`);
        }
      }
    }
    expect(slow).toEqual([]);
  });

  /**
   * The measures each level is harder than the last by: the course is longer;
   * there are more things on it to react to (tight corners, crates and waves,
   * on the road a runner with no swimming or flying takes); it has at least as
   * many forks; the field is at least as big and rides better; and - the one
   * that is felt - a spread of racers ridden well places on the podium, which
   * is what opens the next level, less often.
   */
  it('makes every level harder than the one before it, by every measure', () => {
    const runner = traits('rattata');
    const measures = DERBY_LEVELS.map((level) => {
      const route = routeOf(level, bestLines(level, runner, false));
      const fields = DAYS.map((day) => derbyField(level, day));
      const spread = ['charmander', 'squirtle', 'bulbasaur', 'pikachu', 'ponyta', 'doduo', 'pidgeotto', 'rattata', 'geodude', 'dugtrio', 'horsea', 'meowth'];
      let podiums = 0;
      let races = 0;
      for (const species of spread) {
        fields.forEach((field, index) => {
          const race = modelDerby(traits(species), field, derbyGoing(DAYS[index]) === 'wet', index + 1, 0.8, level);
          const place = playerPlace(race);
          races += 1;
          if (place !== null && place <= PODIUM) podiums += 1;
        });
      }
      return {
        name: level.name,
        length: route.reduce((sum, leg) => sum + legLength(leg), 0),
        hazards: route.reduce((sum, leg) => sum + leg.tight.length + (leg.hurdles?.length ?? 0) + (leg.waves?.length ?? 0), 0),
        forks: forksOf(level).length,
        rivals: level.field.rivals,
        riding: fields.flat().reduce((sum, entrant) => sum + entrant.skill, 0) / fields.flat().length,
        podium: podiums / races,
      };
    });
    for (let index = 1; index < measures.length; index += 1) {
      const [easier, harder] = [measures[index - 1], measures[index]];
      const says = `${harder.name} after ${easier.name}: ${JSON.stringify(measures)}`;
      expect(harder.length, says).toBeGreaterThan(easier.length);
      expect(harder.hazards, says).toBeGreaterThan(easier.hazards);
      expect(harder.forks, says).toBeGreaterThanOrEqual(easier.forks);
      expect(harder.rivals, says).toBeGreaterThanOrEqual(easier.rivals);
      expect(harder.riding, says).toBeGreaterThan(easier.riding);
      expect(harder.podium, says).toBeLessThan(easier.podium);
    }
    // And the last is still there to be won: the right racer, ridden well, makes the podium most days.
    const last = DERBY_LEVELS[DERBY_LEVELS.length - 1];
    const doduo = DAYS.filter((day, index) => (playerPlace(modelDerby(traits('doduo'), derbyField(last, day), false, index + 1, 0.9, last)) ?? 99) <= PODIUM).length;
    expect(doduo).toBeGreaterThan(DAYS.length / 2);
  });

  it('opens each level by a podium on the one before it, one at a time', () => {
    const [front, sands, breakwater, grand] = DERBY_LEVELS;
    expect(derbyLevelOpen(front, 0)).toBe(true);
    expect(derbyLevelOpen(sands, 0)).toBe(false);
    expect(derbyLevelOpen(sands, 1)).toBe(true);
    expect(derbyLevelOpen(grand, 2)).toBe(false);
    // Third opens the next level; fourth does not; a race not finished does not.
    expect(derbyClearedAfter(front, PODIUM, 0)).toBe(1);
    expect(derbyLevelOpened(front, PODIUM, 0)).toBe(sands);
    expect(derbyClearedAfter(front, PODIUM + 1, 0)).toBe(0);
    expect(derbyClearedAfter(front, null, 0)).toBe(0);
    // A level already cleared opens nothing more, and nothing skips a level.
    expect(derbyClearedAfter(front, 1, 2)).toBe(2);
    expect(derbyLevelOpened(front, 1, 2)).toBeNull();
    expect(derbyClearedAfter(breakwater, 1, 2)).toBe(3);
    expect(derbyLevelOpened(grand, 1, 3)).toBeNull();
    expect(derbyClearedAfter(grand, 1, 3)).toBe(4);
    // Read back from a save: a whole number of levels, never more than there are.
    expect(readDerbyCleared(2)).toBe(2);
    expect(readDerbyCleared(99)).toBe(DERBY_LEVELS.length);
    expect(readDerbyCleared(0)).toBeUndefined();
    expect(readDerbyCleared('3')).toBeUndefined();
    expect(readDerbyCleared(1.5)).toBeUndefined();
  });

  it('scores a place the same on every level, whatever the field: a podium pays as it did on THE FRONT', () => {
    expect(derbyScore(1)).toBe(6);
    expect(derbyScore(3)).toBe(4);
    expect(derbyScore(7)).toBe(0);
    expect(derbyScore(8)).toBe(0);
    expect(derbyScore(null)).toBe(0);
  });

  it('turns the regulars out for a later level riding better, on their Pokémon evolved', () => {
    const [front, , breakwater, grand] = DERBY_LEVELS;
    expect(derbyField(front, '2026-11-07')).toHaveLength(5);
    expect(derbyField(breakwater, '2026-11-07')).toHaveLength(6);
    expect(derbyField(grand, '2026-11-07')).toHaveLength(7);
    const finny = derbyField(grand, '2026-11-07').concat(DAYS.flatMap((day) => derbyField(grand, day))).find((entrant) => entrant.handle === 'FINNY2011');
    expect(finny?.species).toBe('rapidash');
    const karp = DAYS.flatMap((day) => derbyField(breakwater, day)).find((entrant) => entrant.handle === 'KARPKING');
    expect(karp?.species).toBe('gyarados');
    for (const entrant of derbyField(grand, '2026-11-07')) expect(entrant.skill).toBeLessThanOrEqual(0.95);
  });

  it('leaps a crate at a sprint, clambers over it otherwise, and lets a flyer sail over', () => {
    const sands = DERBY_LEVELS[1];
    const crateEvents = (species: string, tap: boolean) => {
      let race = startDerby(sands, { name: 'YOU', racer: traits(species) }, [], false, 1);
      const kinds: string[] = [];
      while (!race.over) {
        // A sprint into each crate, and none before it, so there is breath for every one.
        const tapNow = tap && race.clock > COUNTDOWN_MS && toNextHurdle(sands, race.runners[0]) < 1;
        race = stepDerby(race, { tap: tapNow, lines: { second: 'pier' } });
        kinds.push(...race.events.filter((event) => event.kind !== 'go' && 'runner' in event && event.runner === 0).map((event) => event.kind));
      }
      return kinds;
    };
    expect(crateEvents('rattata', false).filter((kind) => kind === 'clamber')).toHaveLength(3);
    expect(crateEvents('rattata', true).filter((kind) => kind === 'leap')).toHaveLength(3);
    expect(crateEvents('pidgey', false).filter((kind) => kind === 'sail')).toHaveLength(3);
    expect(crateEvents('pidgey', false)).not.toContain('clamber');
  });

  it('soaks a runner the waves catch on the breakwater, and lets a Water type ride them', () => {
    const breakwater = DERBY_LEVELS[2];
    const soakings = (species: string) => {
      let race = startDerby(breakwater, { name: 'YOU', racer: traits(species) }, [], false, 1);
      const kinds: string[] = [];
      while (!race.over) {
        race = stepDerby(race, { lines: { second: 'sands', third: 'mole' } });
        kinds.push(...race.events.filter((event) => 'runner' in event && event.runner === 0).map((event) => event.kind));
      }
      return kinds;
    };
    expect(soakings('geodude')).toContain('soaked');
    expect(soakings('squirtle')).not.toContain('soaked');
    expect(soakings('squirtle')).toContain('rode-wave');
  });

  it('slows everybody on sand but a Ground type', () => {
    const sands = DERBY_LEVELS[1];
    // Dugtrio, as quick as a Ponyta on stone, takes the sand home; a Ponyta does not.
    expect(bestLines(sands, traits('dugtrio'), false).second).toBe('sands');
    expect(bestLines(sands, traits('ponyta'), false).second).toBe('pier');
  });

  it('chooses with the arrows at the nearest fork ahead that has a line on that arrow', () => {
    const level = DERBY_LEVELS[3];
    const race = startDerby(level, { name: 'YOU', racer: traits('squirtle') }, [], false, 1);
    const me = race.runners[0];
    expect(lineForKey(level, me, 'down')).toEqual({ fork: 'start', line: 'shore' });
    // No line on LEFT at the start: the bay at the second fork.
    expect(lineForKey(level, me, 'left')).toEqual({ fork: 'second', line: 'bay' });
    // A line the racer may not take chooses nothing.
    expect(lineForKey(level, me, 'right')).toEqual({ fork: 'first', line: 'wide' });
    const pidgeyLess = startDerby(level, { name: 'YOU', racer: traits('rattata') }, [], false, 1).runners[0];
    expect(lineForKey(level, pidgeyLess, 'left')).toBeNull();
  });
});
