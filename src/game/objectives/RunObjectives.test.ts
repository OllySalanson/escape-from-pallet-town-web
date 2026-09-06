import { describe, expect, it } from 'vitest';
import { Pokemon, BULBASAUR, CHARMANDER } from '../pokemon';
import { RunManager } from '../run';
import { RUN_OBJECTIVES } from './RunObjectives';

const RUN_CONFIG = { mapId: 'pallet-town', durationMs: 60_000 };

function startRun(): RunManager {
  const manager = new RunManager();
  manager.startRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] }, RUN_CONFIG);
  return manager;
}

describe('run objectives', () => {
  it('completes the catch objective only after two Pokemon are caught', () => {
    const manager = startRun();
    const objective = RUN_OBJECTIVES.find(({ id }) => id === 'catch-two-pokemon')!;

    expect(objective.progress(manager.snapshot())).toEqual({ current: 0, target: 2, complete: false });
    manager.registerCaughtPokemon(new Pokemon(CHARMANDER, 4));
    expect(objective.progress(manager.snapshot())).toEqual({ current: 1, target: 2, complete: false });
    manager.registerCaughtPokemon(new Pokemon(CHARMANDER, 4));
    expect(objective.progress(manager.snapshot())).toEqual({ current: 2, target: 2, complete: true });
  });

  it('completes the trainer objective only after a trainer defeat', () => {
    const manager = startRun();
    const objective = RUN_OBJECTIVES.find(({ id }) => id === 'defeat-a-trainer')!;

    expect(objective.progress(manager.snapshot())).toEqual({ current: 0, target: 1, complete: false });
    manager.registerTrainerDefeat();
    expect(objective.progress(manager.snapshot())).toEqual({ current: 1, target: 1, complete: true });
  });

  it('remembers reaching Route 1 after leaving it', () => {
    const manager = startRun();
    const objective = RUN_OBJECTIVES.find(({ id }) => id === 'reach-route-1')!;

    manager.setMap('route-1');
    manager.setMap('pallet-town');
    expect(objective.progress(manager.snapshot())).toEqual({ current: 1, target: 1, complete: true });
  });

  it('counts item quantities toward the item objective', () => {
    const manager = startRun();
    const objective = RUN_OBJECTIVES.find(({ id }) => id === 'extract-three-items')!;

    manager.registerFoundItem('potion', 2);
    expect(objective.progress(manager.snapshot())).toEqual({ current: 2, target: 3, complete: false });
    manager.registerFoundItem('antidote');
    expect(objective.progress(manager.snapshot())).toEqual({ current: 3, target: 3, complete: true });
  });
});
