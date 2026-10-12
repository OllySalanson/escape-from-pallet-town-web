import { describe, expect, it } from 'vitest';
import { weatherAt } from './districts';
import { partyOf, trainerMeasure } from './trainerMeasure';
import { TOLL_BAND, createRunTrainerEncounters } from './trainers';

/**
 * Every toll, measured over the real engine against each starter alone - the
 * rule is `TOLL_BAND` in `trainers.ts`, and `tools/trainers/tolls.mts` prints
 * the same grid while a party is being chosen. Seeded as the tool is, so the
 * numbers it prints are the numbers held here.
 */
const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
const TRIALS = 400;

const tolls = createRunTrainerEncounters().filter(
  (encounter) => encounter.bossId === undefined && !TOLL_BAND.heldElsewhere.includes(encounter.trainer.id),
);

describe('the tolls', () => {
  it('are every trainer who holds no gate, bar the ones held to numbers of their own', () => {
    expect(tolls.length).toBeGreaterThan(10);
  });

  it.each(tolls.map((encounter) => [encounter.trainer.name, encounter] as const))(
    '%s can be paid by every starter, and is no starter lottery',
    (_name, encounter) => {
      const level = TOLL_BAND.levelOn(encounter.mapId);
      const won = STARTERS.map(
        (starter) =>
          trainerMeasure(
            partyOf(starter, [starter, level]),
            encounter.trainer,
            TRIALS,
            0x7011,
            weatherAt(encounter.mapId, encounter.position),
            TOLL_BAND.potions,
          ).winRate,
      );
      const said = STARTERS.map((starter, index) => `${starter} ${Math.round(won[index] * 100)}%`).join(', ');
      expect(Math.min(...won), said).toBeGreaterThanOrEqual(TOLL_BAND.floor);
      expect(Math.max(...won) - Math.min(...won), said).toBeLessThanOrEqual(TOLL_BAND.spread);
    },
  );
});
