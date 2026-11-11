import { describe, expect, it } from 'vitest';
import { knowableMoves } from '../pokemon';
import { MoveCategory } from '../pokemon/MoveBase';
import { SPECIES_BY_ID } from '../pokemon/species';
import { NO_GAME_CORNER, ticketDayKey } from '../minigames/tickets';
import { DOJO_BANNED_SPECIES, DOJO_LEVEL } from './boutRules';
import { readDojoRecord } from './dojoRecord';
import { readDojoRun, runBout, runFoe, settleRunBout, stampRun } from './arenaRuns';
import {
  pairToday,
  RENTAL_PAIRS,
  RENTALS,
  rentalFoe,
  rentalPokemon,
  rentalsToday,
  rentalTeamProblem,
  settleRentalBout,
} from './rentals';
import { RUN_BOUTS } from './runRecords';

const at = (date: string): Date => new Date(`${date}T12:00:00`);
const DAYS = Array.from({ length: 400 }, (_day, index) => new Date(2026, 0, 1 + index, 12));

describe('the rental table', () => {
  it('holds six, the same six all day, and a setter and payoff pair every day', () => {
    for (const day of DAYS) {
      const six = rentalsToday(day).map((one) => one.species);
      expect(six).toHaveLength(6);
      expect(new Set(six).size).toBe(6);
      const pair = pairToday(day);
      expect(six).toContain(pair.setter);
      expect(six).toContain(pair.payoff);
      expect(RENTAL_PAIRS.some((one) => six.includes(one.setter) && six.includes(one.payoff))).toBe(true);
    }
    const morning = new Date(2026, 10, 7, 0, 5);
    const night = new Date(2026, 10, 7, 23, 55);
    expect(rentalsToday(morning)).toEqual(rentalsToday(night));
  });

  it('lends only legal Pokémon, each knowing four moves its kind could know at the dojo level', () => {
    for (const rental of RENTALS) {
      const base = SPECIES_BY_ID[rental.species];
      expect(DOJO_BANNED_SPECIES).not.toContain(rental.species);
      const known = knowableMoves(base);
      const levelled = new Set(base.learnset.filter((entry) => entry.level <= DOJO_LEVEL).map((entry) => entry.move.name));
      for (const name of rental.moves) {
        expect(known.has(name), `${rental.species} cannot know ${name}`).toBe(true);
        const fromMachine = !base.learnset.some((entry) => entry.move.name === name);
        expect(levelled.has(name) || fromMachine, `${rental.species} learns ${name} after Lv ${DOJO_LEVEL}`).toBe(true);
      }
      const pokemon = rentalPokemon(rental.species);
      expect(pokemon.moves).toHaveLength(4);
      expect(pokemon.level).toBe(DOJO_LEVEL);
      expect(pokemon.moves.some((move) => move.base.category !== MoveCategory.Status)).toBe(true);
    }
    for (const pair of RENTAL_PAIRS) {
      expect(RENTALS.map((one) => one.species)).toEqual(expect.arrayContaining([pair.setter, pair.payoff]));
    }
  });

  it('meets seven regulars, rentals first and their own teams grown up last, each fit to fight', () => {
    for (let bout = 1; bout <= RUN_BOUTS; bout += 1) {
      const foe = rentalFoe(bout, at('2026-11-07'));
      expect(foe.team).toHaveLength(3);
      expect(new Set(foe.team).size).toBe(3);
      for (const id of foe.team) {
        expect(rentalPokemon(id).moves.some((move) => move.base.category !== MoveCategory.Status && move.base.power > 0), `${bout}: ${id}`).toBe(true);
      }
    }
  });
});

describe('a rental run', () => {
  const now = at('2026-11-07');
  const team = rentalsToday(now)
    .slice(0, 3)
    .map((one) => one.species);

  it('starts on three of today’s six, swaps one from the team just beaten, and refuses anything else', () => {
    expect(rentalTeamProblem(team, undefined, now)).toBeNull();
    expect(rentalTeamProblem(team.slice(0, 2), undefined, now)).toMatch(/three/);
    expect(rentalTeamProblem(['mewtwo', ...team.slice(1)], undefined, now)).toMatch(/six/);
    const first = settleRentalBout(undefined, NO_GAME_CORNER, team, rentalFoe(1, now), true, now);
    const run = first.run!;
    expect(run.won).toBe(1);
    expect(run.swapFrom).toEqual(rentalFoe(1, now).team);
    const theirs = run.swapFrom!.find((id) => !team.includes(id))!;
    expect(rentalTeamProblem([theirs, team[1], team[2]], run, now)).toBeNull();
    const notTheirs = RENTALS.map((one) => one.species).find((id) => !team.includes(id) && !run.swapFrom!.includes(id) && !rentalsToday(now).some((one) => one.species === id))!;
    expect(rentalTeamProblem([notTheirs, team[1], team[2]], run, now)).toMatch(/One swap/);
  });

  it('pays five a win on the day’s scored run only, ends at a loss, and seven wins finish it', () => {
    let record = undefined as ReturnType<typeof settleRentalBout>['record'] | undefined;
    let corner = NO_GAME_CORNER;
    const paid: number[] = [];
    for (let bout = 1; bout <= RUN_BOUTS; bout += 1) {
      const settled = settleRentalBout(record, corner, team, rentalFoe(bout, now), true, now);
      record = settled.record;
      corner = settled.gameCorner;
      paid.push(settled.tickets);
      expect(settled.scored).toBe(true);
      if (bout === RUN_BOUTS) {
        expect(settled.complete).toBe(true);
        expect(settled.run).toBeUndefined();
      }
    }
    expect(paid).toEqual([5, 5, 5, 5, 5, 5, 5]);
    expect(record!.best).toBe(7);
    expect(record!.scoredDay).toBe(ticketDayKey(now));
    // A second run the same day is practice: it pays nothing.
    const practice = settleRentalBout(record, corner, team, rentalFoe(1, now), true, now);
    expect(practice.scored).toBe(false);
    expect(practice.tickets).toBe(0);
    const lost = settleRentalBout(practice.record, corner, team, rentalFoe(2, now), false, now);
    expect(lost.run).toBeUndefined();
    expect(lost.ended).toBe(1);
    // The next day pays again.
    const tomorrow = at('2026-11-08');
    const fresh = settleRentalBout(lost.record, corner, rentalsToday(tomorrow).slice(0, 3).map((one) => one.species), rentalFoe(1, tomorrow), true, tomorrow);
    expect(fresh.scored).toBe(true);
    expect(fresh.tickets).toBe(5);
  });

  it('goes round the room and the save: the mat, the settlement and the record read back', () => {
    const run = { mode: 'rental' as const, team };
    const bout = runBout(run, [], undefined, now)!;
    expect(bout.party.map((pokemon) => pokemon.base.id)).toEqual(team);
    expect(bout.trainer.party).toHaveLength(3);
    const foe = runFoe(run, undefined, now);
    const settled = settleRunBout(undefined, NO_GAME_CORNER, run, foe.id, true, now);
    expect(settled.carriesOn).toBe(true);
    expect(settled.tickets).toBe(5);
    expect(settled.line).toMatch(/swap one/);
    const read = readDojoRecord(JSON.parse(JSON.stringify(settled.dojo)));
    expect(read?.rental).toEqual(settled.dojo.rental);
    // The next bout is bout two, against somebody new.
    expect(runFoe(run, read, now)).toEqual(rentalFoe(2, now));
    expect(runBout({ mode: 'rental', team: ['mewtwo', 'mew', 'pikachu'] }, [], read, now)).toBeNull();
  });
});

describe('a rental bout is the bout the counter said it was', () => {
  const now = at('2026-11-07');
  const team = rentalsToday(now)
    .slice(0, 3)
    .map((one) => one.species);

  /** A run four wins in on `team`, as the save stores it. */
  const fourIn = (on: Date) => {
    let dojo = undefined as ReturnType<typeof settleRunBout>['dojo'] | undefined;
    let corner = NO_GAME_CORNER;
    for (let bout = 1; bout <= 4; bout += 1) {
      const run = stampRun({ mode: 'rental', team }, dojo, on);
      const settled = settleRunBout(dojo, corner, run, runFoe(run, dojo, on).id, true, on);
      dojo = settled.dojo;
      corner = settled.gameCorner;
    }
    expect(dojo?.rental?.run?.won).toBe(4);
    return { dojo, corner };
  };

  it('START AGAIN with the same three is bout one of a new run, not bout five of the old one (arenas hunt, finding 2)', () => {
    const { dojo, corner } = fourIn(now);
    // START AGAIN: the counter shows bout one, and hands that on.
    const run = stampRun({ mode: 'rental', team, bout: 1 }, dojo, now);
    expect(run.bout).toBe(1);
    expect(runFoe(run, dojo, now)).toEqual(rentalFoe(1, now));
    expect(runBout(run, [], dojo, now)!.trainer.name).toBe(rentalFoe(1, now).name);
    const settled = settleRunBout(dojo, corner, run, rentalFoe(1, now).id, true, now);
    expect(settled.dojo.rental?.run?.won).toBe(1);
    // The day's paying run was the one set aside, so this one is practice.
    expect(settled.dojo.rental?.run?.scored).toBe(false);
    expect(settled.tickets).toBe(0);
    expect(settled.line).toBe(`You beat ${rentalFoe(1, now).name}! 1 of ${RUN_BOUTS} (practice). You may swap one for one of theirs.`);
    // Carrying on, unstamped, is still bout five.
    expect(runFoe({ mode: 'rental', team }, dojo, now)).toEqual(rentalFoe(5, now));
  });

  it('a bout begun before midnight is settled as that day’s, and the run ends with the day (arenas hunt, finding 4)', () => {
    const lateNight = new Date(2026, 10, 7, 23, 58);
    const pastMidnight = new Date(2026, 10, 8, 0, 1);
    const { dojo, corner } = fourIn(lateNight);
    const run = stampRun({ mode: 'rental', team }, dojo, lateNight);
    const foe = rentalFoe(5, lateNight);
    expect(runFoe(run, dojo, pastMidnight)).toEqual(foe);

    const won = settleRunBout(dojo, corner, run, foe.id, true, pastMidnight);
    expect(won.line).toBe(`You beat ${foe.name}! 5 of ${RUN_BOUTS}, but the day ended during the bout, so the run ends there. 5 tickets.`);
    expect(won.carriesOn).toBe(false);
    expect(won.dojo.rental?.run?.day).toBe(ticketDayKey(lateNight));
    // The new day's paying run is still there.
    expect(won.dojo.rental?.scoredDay).toBe(ticketDayKey(lateNight));
    expect(runFoe({ mode: 'rental', team }, won.dojo, pastMidnight)).toEqual(rentalFoe(1, pastMidnight));

    const lost = settleRunBout(dojo, corner, run, foe.id, false, pastMidnight);
    expect(lost.line).toBe(`${foe.name} took that one. Your rental run ended at 4 of ${RUN_BOUTS}.`);
  });

  it('pays nothing into a day the ticket record has already left behind', () => {
    const lateNight = new Date(2026, 10, 7, 23, 58);
    const pastMidnight = new Date(2026, 10, 8, 0, 1);
    const { dojo, corner } = fourIn(lateNight);
    const run = stampRun({ mode: 'rental', team }, dojo, lateNight);
    const moved = { ...corner, day: { day: ticketDayKey(pastMidnight), paid: { 'pokemon-jump': 20 }, berries: {}, bought: {}, best: {} } };
    const settled = settleRunBout(dojo, moved, run, rentalFoe(5, lateNight).id, true, pastMidnight);
    expect(settled.tickets).toBe(0);
    expect(settled.gameCorner).toEqual(moved);
  });

  it('reads its stamp back from a save, and settles a bout under way written before there were stamps', () => {
    const run = stampRun({ mode: 'rental', team, bout: 1 }, undefined, now);
    expect(readDojoRun(JSON.parse(JSON.stringify(run)))).toEqual(run);
    expect(readDojoRun({ mode: 'rental', team, bout: 9, at: 'soon' })).toEqual({ mode: 'rental', team });
    const settled = settleRunBout(undefined, NO_GAME_CORNER, { mode: 'rental', team }, rentalFoe(1, now).id, true, now);
    expect(settled.dojo.rental?.run?.won).toBe(1);
  });
});
