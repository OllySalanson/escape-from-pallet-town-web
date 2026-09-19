import { describe, expect, it } from 'vitest';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import { createRunTrainerEncounters } from './trainers';
import { partyOf, trainerWinRate, type MeasuredParty } from './trainerMeasure';

/**
 * The boss ladder, measured over the real engine.
 *
 * A boss is the one fight on its map that cannot be declined, so "is this one
 * harder than the last" is a fact about progression and not a matter of taste.
 * Every rate below is the share of fights a party wins playing the generous
 * way - best damaging move, next Pokemon in on a faint, no items - against the
 * authored party, seeded so the answer never moves. `tools/trainers/report.mts`
 * prints the whole grid while a party is being chosen; this holds the order it
 * settled on.
 *
 * Deliberately few trials and two reference parties: this is a guard against a
 * boss quietly changing rung, not a balance study.
 */

const trainerOf = (id: string): TrainerBattle =>
  createRunTrainerEncounters().find((encounter) => encounter.trainer.id === id)!.trainer;

/** One starter alone, and the small team a player actually deploys with. */
const SOLO: MeasuredParty = partyOf('Charmander 14', ['charmander', 14]);
const TEAM: MeasuredParty = partyOf('Charmander 12 + Pidgey 10', ['charmander', 12], ['pidgey', 10]);

const TRIALS = 240;

/**
 * Front to back, easiest first. Briggs is the first door in the game and Holt
 * the last; the two small-map bosses sit between Route 1's warden and the
 * Floodplain's back half, which is where they are met.
 *
 * The last two are a tie and always were - 32% and 27% over 200 trials, which
 * is about two standard errors apart - so what is held is that no door is a
 * *rung* easier than the one before it, with `TIE` the width of a tie. Ranking
 * two doors that were never a rung apart is how this test failed the day the
 * move data model changed a damage roll: the order flipped, nothing about the
 * game got easier, and a real regression would have been a 17-point drop.
 */
const TIE = 0.08;

const LADDER: readonly [string, string][] = [
  ['floodplain-toll-keeper-briggs', 'TOLLMAN BRIGGS'],
  ['overlook-warden-wren', 'WARDEN WREN'],
  ['pallet-mill-keeper-vance', 'MILLER VANCE'],
  ['forest-ridge-keeper-pell', 'LOOKOUT PELL'],
  ['floodplain-sluice-keeper-dane', 'SLUICE KEEPER DANE'],
  ['floodplain-orchard-warden-holt', 'WARDEN HOLT'],
];

describe('the boss ladder, played out', () => {
  it('never lets a later boss be a rung easier than the one before it', () => {
    const rates = LADDER.map(([id, name]) => ({
      name,
      rate: trainerWinRate(TEAM, trainerOf(id), TRIALS),
    }));
    const climbs = rates.slice(1).flatMap((boss, index) => {
      const before = rates[index];
      return boss.rate > before.rate + TIE
        ? [`${boss.name} is a rung easier than ${before.name}: ${boss.rate} against ${before.rate}`]
        : [];
    });
    expect(climbs).toEqual([]);
  });

  /**
   * A boss every starter can lose to is a hard fight; a boss only one starter
   * can win is a lottery, which is why Scout Lee fields a Squirtle rather than
   * a Bulbasaur. Neither new boss may be out of reach of a lone levelled
   * starter, and neither may be a walkover for the team.
   */
  it('keeps both new bosses inside the band the other doors sit in', () => {
    for (const id of ['pallet-mill-keeper-vance', 'forest-ridge-keeper-pell']) {
      const trainer = trainerOf(id);
      const solo = trainerWinRate(SOLO, trainer, TRIALS);
      const team = trainerWinRate(TEAM, trainer, TRIALS);
      expect(`${trainer.name} solo ${solo > 0.05 && solo < 0.75}`).toBe(`${trainer.name} solo true`);
      expect(`${trainer.name} team ${team > 0.2 && team < 0.9}`).toBe(`${trainer.name} team true`);
    }
  });
});
