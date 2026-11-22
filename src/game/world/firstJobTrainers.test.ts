import { describe, expect, it } from 'vitest';
import { FIRST_CONTRACT_ID, isFirstJob } from '../objectives/contracts';
import { frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { MAP_FILE_TRAINER_TEAMS, trainerTemplate, type MapFileTrainerTeam } from './mapFile';
import { trainersOn } from './mapTrainers';
import { partyOf, trainerWinRate } from './trainerMeasure';
import { trainersForContract, type RunTrainerEncounter } from './trainers';

/**
 * A newcomer's first raid on Greystone Vale meets its trainers softened.
 *
 * Every new save's first raid carries the standing board's round-nought job,
 * and the trainers a step or two from Mill Square fielded two Pokémon at five
 * to eight: a lone level 5 starter beat SCOUT TAM's Pidgey 5 and Squirtle 6
 * once in a hundred fights, and five new friends out of five lost their first
 * pack to him or to the next trainer on the arrow's path (AI playtest 2, 22 Nov
 * 2026). On that job every map-file team fields its `firstContractParty`
 * instead, held here to about three fights in four for a lone fresh starter
 * with no Potion drunk - the newcomer who has not yet learned that Potions work
 * mid-fight - and no starter shut out.
 */

const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
const FIRST_JOB = 'standing-0-greystone-vale';
const party = (encounter: RunTrainerEncounter): string[] =>
  encounter.trainer.party.map((pokemon) => `${pokemon.base.id} ${pokemon.level}`);

describe("a newcomer's first job", () => {
  it('is the first contract, or the standing board round nought, and nothing later', () => {
    expect(isFirstJob(FIRST_CONTRACT_ID)).toBe(true);
    expect(isFirstJob(FIRST_JOB)).toBe(true);
    expect(isFirstJob('standing-1-greystone-vale')).toBe(false);
    expect(isFirstJob('standing-10-greystone-vale')).toBe(false);
    expect(isFirstJob(undefined)).toBe(false);
  });

  it('meets every trainer on the vale with a team its own trainer softens, and only on that job', () => {
    const vale = trainersOn('greystone-vale').filter((encounter) => encounter.bossId === undefined);
    const tam = (contractId: string | undefined) =>
      trainersForContract(vale, contractId).find((encounter) => encounter.trainer.name === 'SCOUT TAM')!;
    expect(party(tam(FIRST_JOB))).toEqual(['pidgey 3', 'squirtle 3']);
    expect(party(tam('standing-1-greystone-vale'))).toEqual(['pidgey 5', 'squirtle 6']);
    expect(party(tam(undefined))).toEqual(['pidgey 5', 'squirtle 6']);
    // Everything placed from a map file's team has one, so no first raid
    // walks into a full-price fight however far it goes.
    for (const encounter of vale.filter((each) => each.trainer.id.startsWith('greystone-vale/'))) {
      expect(encounter.firstContractParty, encounter.trainer.name).toBeDefined();
    }
  });

  it("is what a fresh save's first raid meets, which carries no job, and no later raid without one", () => {
    const tamIn = (firstRaid: boolean) =>
      generateRunPlan(1, undefined, frontDoorFor('greystone-vale')!.id, undefined, undefined, [], { firstRaid }).trainers.find(
        (encounter) => encounter.trainer.name === 'SCOUT TAM',
      )!;
    expect(party(tamIn(true))).toEqual(['pidgey 3', 'squirtle 3']);
    expect(party(tamIn(false))).toEqual(['pidgey 5', 'squirtle 6']);
  });

  // Bar the raiders: theirs is RAIDER MAYA's own first-contract price, paid
  // with the pack on the Floodplain's first road and held there
  // (`floodplainCheckpoint.test.ts`), and the vale's two stand on Gull Strand
  // and in the Bunker, far past the near ground a first job is set on.
  const teams = (Object.keys(MAP_FILE_TRAINER_TEAMS) as MapFileTrainerTeam[]).filter((team) => team !== 'raider');

  it.each(teams)(
    "softens the '%s' team so a lone fresh starter wins about three in four, bare",
    (team) => {
      const template = trainerTemplate(team);
      const soft = { ...template.trainer, party: template.firstContractParty! };
      const rates = STARTERS.map((starter) =>
        trainerWinRate(partyOf(starter, [starter, 5]), soft, 200, 0x51ede, null, 0),
      );
      expect(Math.min(...rates), `${team}: ${rates.join(', ')}`).toBeGreaterThanOrEqual(0.7);
      // Never a fight so soft it teaches nothing: something still answers back.
      expect(soft.party.length).toBeGreaterThan(0);
    },
  );
});
