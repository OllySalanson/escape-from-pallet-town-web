import { describe, expect, it } from 'vitest';
import { NO_GAME_CORNER } from '../minigames/tickets';
import { runFoe, settleRunBout, stampRun } from './arenaRuns';
import { cupOfTheWeek } from './cups';
import { rentalsToday } from './rentals';
import { dojoYieldStake, hallYieldStake } from './yieldStake';

const now = new Date(2026, 10, 11, 12);

/** A dojo record `wins` bouts into a run of `mode`. */
function winsInto(mode: 'cup' | 'rental', wins: number) {
  const team = rentalsToday(now)
    .slice(0, 3)
    .map((one) => one.species);
  const base = mode === 'cup' ? ({ mode } as const) : ({ mode, team } as const);
  let dojo = undefined as ReturnType<typeof settleRunBout>['dojo'] | undefined;
  for (let bout = 0; bout < wins; bout += 1) {
    const run = stampRun(base, dojo, now);
    dojo = settleRunBout(dojo, NO_GAME_CORNER, run, runFoe(run, dojo, now).id, true, now).dojo;
  }
  return { dojo, run: stampRun(base, dojo, now) };
}

describe('what YIELD would throw away (the arenas hunt, finding 1)', () => {
  it('names a cup or rental run of wins, and asks nothing at bout one of a cup', () => {
    const six = winsInto('cup', 6);
    expect(dojoYieldStake(six.dojo, six.run, now)).toBe(`Your ${cupOfTheWeek(now).name} run of 6 ends.`);
    const none = winsInto('cup', 0);
    expect(dojoYieldStake(none.dojo, none.run, now)).toBeUndefined();
    const four = winsInto('rental', 4);
    expect(dojoYieldStake(four.dojo, four.run, now)).toBe('Your rental run of 4 ends.');
  });

  it('says a first rental bout spends the day’s paying run, and asks nothing once it is spent', () => {
    const first = winsInto('rental', 0);
    expect(dojoYieldStake(first.dojo, first.run, now)).toBe('It spends today’s paying run.');
    // START AGAIN after the paying run: practice, so nothing to lose.
    const four = winsInto('rental', 4);
    const again = stampRun({ mode: 'rental', team: four.run.mode === 'rental' ? four.run.team : [], bout: 1 }, four.dojo, now);
    expect(dojoYieldStake(four.dojo, again, now)).toBeUndefined();
  });

  it('names a class run of wins, and the hall’s ladder', () => {
    expect(dojoYieldStake({ classId: 'poke-ball', streak: ['bot:a', 'bot:b'] } as never, undefined, now)).toBe('Your run of 2 in a row ends.');
    expect(dojoYieldStake(undefined, undefined, now)).toBeUndefined();
    expect(hallYieldStake({ beaten: ['blue', 'misty', 'koga', 'erika'], ladders: 0 } as never)).toBe('Your run of 4 of 5 ends.');
    expect(hallYieldStake({ beaten: [], ladders: 2 })).toBeUndefined();
    expect(hallYieldStake(undefined)).toBeUndefined();
  });
});
