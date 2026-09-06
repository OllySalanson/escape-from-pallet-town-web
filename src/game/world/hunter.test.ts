import { describe, expect, it } from 'vitest';
import { Pokemon } from '../pokemon';
import { CHARMANDER } from '../pokemon/species';
import { RunManager } from '../run/RunManager';
import { createActiveRunSession } from '../run/RunSession';
import { chooseHunterPursuitStep, hunterTierFor, resolveHunterBattleLoss } from './hunter';

describe('chooseHunterPursuitStep', () => {
  it('chooses the best legal route around a wall', () => {
    expect(
      chooseHunterPursuitStep(
        { x: 2, y: 2 },
        { x: 5, y: 2 },
        { width: 8, height: 8 },
        (tile) => tile.x === 3 && tile.y === 2,
      ),
    ).toEqual({ x: 2, y: 1 });
  });
});

describe('hunterTierFor', () => {
  it('escalates with elapsed raid time and reaches its strongest team while enraged', () => {
    expect(hunterTierFor(0, false)).toMatchObject({ level: 7, party: [{ id: 'pidgey' }] });
    expect(hunterTierFor(90_000, false)).toMatchObject({ level: 10, party: [{ id: 'pidgey' }, { id: 'bulbasaur' }] });
    expect(hunterTierFor(180_000, false)).toMatchObject({ level: 13, party: [{ id: 'pidgey' }, { id: 'bulbasaur' }, { id: 'pikachu' }] });
    expect(hunterTierFor(10_000, true)).toMatchObject({ level: 16, party: [{ id: 'pidgey' }, { id: 'bulbasaur' }, { id: 'pikachu' }] });
  });
});

describe('resolveHunterBattleLoss', () => {
  it('uses the run secure slot when a hunter battle wipes the player', () => {
    const securePokemon = new Pokemon(CHARMANDER, 5);
    const lostPokemon = new Pokemon(CHARMANDER, 6);
    const loadout = {
      party: [securePokemon, lostPokemon],
      items: [{ itemId: 'potion' as const, quantity: 2 }],
    };
    const secureSlot = { pokemon: securePokemon, items: [{ itemId: 'potion' as const, quantity: 1 }] };
    const manager = new RunManager();
    manager.startRun(loadout, { mapId: 'pallet-town', durationMs: 60_000 }, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      { pokemonId: 'charmander-1', items: secureSlot.items },
      ['charmander-1', 'charmander-2'],
      loadout.items,
    );

    expect(resolveHunterBattleLoss(session)).toMatchObject({
      outcome: 'WIPED',
      bankedPokemon: [securePokemon],
      lostPokemon: [lostPokemon],
      bankedItems: [{ itemId: 'potion', quantity: 1 }],
      lostItems: [{ itemId: 'potion', quantity: 1 }],
    });
  });
});
