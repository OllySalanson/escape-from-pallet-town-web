import { describe, expect, it } from 'vitest';
import { Pokemon, BULBASAUR } from '../pokemon';
import { RunManager } from '../run';
import { FIRST_CONTRACT, RAID_CONTRACTS } from './contracts';
import { objectivesForContract } from './RunObjectives';

const RUN_CONFIG = { mapId: 'pallet-town', durationMs: 60_000 };

function startRun(): RunManager {
  const manager = new RunManager();
  manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, RUN_CONFIG);
  return manager;
}

describe('run objectives', () => {
  it('tracks the lost field kit contract until it is recovered', () => {
    const manager = startRun();
    const objective = objectivesForContract(FIRST_CONTRACT)[0];

    expect(objective.progress(manager.snapshot())).toEqual({ current: 0, target: 1, complete: false });
    manager.recoverFieldKit();
    expect(objective.progress(manager.snapshot())).toEqual({ current: 1, target: 1, complete: true });
  });

  /**
   * A contract with three stops is one objective line at 1/3, not three lines:
   * the guide is answering "how far through this contract am I", and three rows
   * would read as three contracts.
   */
  it('counts a multi-stop contract as one objective with partial progress', () => {
    const manager = startRun();
    const survey = RAID_CONTRACTS.find(({ id }) => id === 'survey-the-braid')!;
    const objective = objectivesForContract(survey)[0];

    expect(objective.progress(manager.snapshot())).toMatchObject({ current: 0, target: 3 });
    manager.registerContractStep(survey.markers[0].id);
    manager.registerContractStep(survey.markers[0].id);
    expect(objective.progress(manager.snapshot())).toMatchObject({ current: 1, complete: false });
    manager.registerContractStep(survey.markers[1].id);
    manager.registerContractStep(survey.markers[2].id);
    expect(objective.progress(manager.snapshot())).toMatchObject({ current: 3, complete: true });
  });
});
