import { describe, expect, it } from 'vitest';
import { Pokemon, BULBASAUR } from '../pokemon';
import { RunManager } from '../run';
import { RUN_OBJECTIVES } from './RunObjectives';

const RUN_CONFIG = { mapId: 'pallet-town', durationMs: 60_000 };

function startRun(): RunManager {
  const manager = new RunManager();
  manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, RUN_CONFIG);
  return manager;
}

describe('run objectives', () => {
  it('tracks the lost field kit contract until it is recovered', () => {
    const manager = startRun();
    const objective = RUN_OBJECTIVES.find(({ id }) => id === 'recover-lost-field-kit')!;

    expect(objective.progress(manager.snapshot())).toEqual({ current: 0, target: 1, complete: false });
    manager.recoverFieldKit();
    expect(objective.progress(manager.snapshot())).toEqual({ current: 1, target: 1, complete: true });
  });
});
