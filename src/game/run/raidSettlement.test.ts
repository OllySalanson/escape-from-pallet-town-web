import { describe, expect, it } from 'vitest';
import { BULBASAUR, CHARMANDER, Pokemon } from '../pokemon';
import { RunManager } from './RunManager';
import { buildRaidSettlement, deployedRaidCondition, raidSupplyDelta } from './raidSettlement';

const RUN_CONFIG = { mapId: 'pallet-town', durationMs: 60_000 };

function startedRun(party: readonly Pokemon[], items: readonly { itemId: string; quantity: number }[] = []): RunManager {
  const manager = new RunManager();
  manager.startRun(
    { party, items: items as never },
    RUN_CONFIG,
  );
  return manager;
}

describe('raid settlement', () => {
  it('reads the condition each deployed Pokemon ended the raid in, by stash ID', () => {
    const starter = new Pokemon(BULBASAUR, 5);
    const partner = new Pokemon(CHARMANDER, 7);
    const manager = startedRun([starter, partner]);

    starter.takeDamage(4);
    starter.primaryStatus = 'poison';
    partner.takeDamage(partner.maxHp);

    expect(deployedRaidCondition(['bulbasaur-1', 'charmander-1'], manager.snapshot())).toEqual([
      { id: 'bulbasaur-1', currentHp: starter.currentHp, primaryStatus: 'poison' },
      // A faint comes home as a faint. Deleting it here would charge the same
      // faint twice: losing deployed Pokemon is what a wipe is for.
      { id: 'charmander-1', currentHp: 0, primaryStatus: null },
    ]);
  });

  it('describes nothing it cannot account for', () => {
    const starter = new Pokemon(BULBASAUR, 5);
    const manager = startedRun([starter]);

    // More IDs than Pokemon is a mismatch, not an invitation to guess.
    expect(deployedRaidCondition(['bulbasaur-1', 'ghost-9'], manager.snapshot())).toEqual([
      { id: 'bulbasaur-1', currentHp: starter.maxHp, primaryStatus: null },
    ]);
    expect(deployedRaidCondition([], manager.snapshot())).toEqual([]);
    expect(deployedRaidCondition(['bulbasaur-1'], new RunManager().snapshot())).toEqual([]);
  });

  it('reads supplies as what came out minus what went in', () => {
    const manager = startedRun(
      [new Pokemon(BULBASAUR, 5)],
      [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    );

    // Two balls thrown, one Potion drunk, an antidote found in the field.
    expect(
      raidSupplyDelta(manager.snapshot(), { 'poke-ball': 3, potion: 2, antidote: 1 }),
    ).toEqual([
      { itemId: 'poke-ball', quantity: -2 },
      { itemId: 'potion', quantity: -1 },
      { itemId: 'antidote', quantity: 1 },
    ]);
  });

  it('says nothing about a stack that came home untouched', () => {
    const manager = startedRun(
      [new Pokemon(BULBASAUR, 5)],
      [{ itemId: 'potion', quantity: 3 }],
    );

    expect(raidSupplyDelta(manager.snapshot(), { potion: 3 })).toEqual([]);
  });

  it('charges a whole deployed stack when the bag comes home empty', () => {
    const manager = startedRun(
      [new Pokemon(BULBASAUR, 5)],
      [{ itemId: 'potion', quantity: 3 }],
    );

    expect(raidSupplyDelta(manager.snapshot(), {})).toEqual([{ itemId: 'potion', quantity: -3 }]);
  });

  it('packages both halves for the endings that keep what they carried', () => {
    const starter = new Pokemon(BULBASAUR, 5);
    const manager = startedRun([starter], [{ itemId: 'potion', quantity: 3 }]);
    starter.takeDamage(3);

    expect(buildRaidSettlement(['bulbasaur-1'], manager.snapshot(), { potion: 1 })).toEqual({
      condition: [{ id: 'bulbasaur-1', currentHp: starter.currentHp, primaryStatus: null }],
      supplies: [{ itemId: 'potion', quantity: -2 }],
    });
  });
});
