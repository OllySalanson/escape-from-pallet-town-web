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
 * A rung is the **mean over four reference parties**, three of them one starter
 * apiece, because a door's rung is what it costs a player and not what it costs
 * a Charmander. Measured against a lone Fire lead the last two doors invert -
 * Ember is three times over on Holt's Butterfree and half strength on Dane's
 * Squirtle - and that is a type matchup, not a boss changing rung. Whether a
 * door is inside reach of one starter at all is the second test below, and the
 * checkpoint on the road to the first of them is `floodplainCheckpoint.test.ts`,
 * which is the only fight measured at the level a fresh save meets it.
 *
 * Deliberately few trials: this is a guard against a boss quietly changing
 * rung, not a balance study.
 */

const trainerOf = (id: string): TrainerBattle =>
  createRunTrainerEncounters().find((encounter) => encounter.trainer.id === id)!.trainer;

/** One starter alone, and the small team a player actually deploys with. */
const SOLO: MeasuredParty = partyOf('Charmander 14', ['charmander', 14]);
const TEAM: MeasuredParty = partyOf('Charmander 12 + Pidgey 10', ['charmander', 12], ['pidgey', 10]);

/** What a rung is averaged over: each starter alone, then the team. */
const REFERENCES: readonly MeasuredParty[] = [
  SOLO,
  partyOf('Squirtle 14', ['squirtle', 14]),
  partyOf('Bulbasaur 14', ['bulbasaur', 14]),
  TEAM,
];

const TRIALS = 240;

const rungOf = (trainer: TrainerBattle): number =>
  REFERENCES.reduce((total, party) => total + trainerWinRate(party, trainer, TRIALS), 0) /
  REFERENCES.length;

/**
 * Front to back, easiest first. Briggs is the first door in the game and Holt
 * the last; the two small-map bosses sit between Route 1's warden and the
 * Floodplain's back half, which is where they are met.
 *
 * What is held is that no door is a *rung* easier than the one before it, with
 * `TIE` the width of a tie. Ranking two doors that were never a rung apart is
 * how this test failed the day the move data model changed a damage roll: the
 * order flipped, nothing about the game got easier, and a real regression would
 * have been a 17-point drop.
 *
 * Two pairs are inside the tie rather than ordered. Vance and Pell unlock
 * together - Pallet Town and Route 1 arrive on the same banked contract - so
 * which of the two small-map doors is the harder is a choice the player makes,
 * not a step they climb; measured with the same-type bonus played they are ten
 * points apart the other way round from the note in `trainers.ts`. Dane and
 * Holt were always a tie.
 */
const TIE = 0.12;

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
    const rates = LADDER.map(([id, name]) => ({ name, rate: rungOf(trainerOf(id)) }));
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
