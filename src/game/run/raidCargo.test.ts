import { describe, expect, it } from 'vitest';
import { Bag, RAID_BAG_GRID } from '../items';
import { Pokemon } from '../pokemon';
import { BULBASAUR, IVYSAUR, PIDGEY } from '../pokemon/species';
import { RunManager } from './RunManager';
import {
  packFullForPokemonLine,
  packHasRoomForPokemon,
  raidPackCargo,
  syncPackCargo,
} from './raidCargo';

function startedRaid(): { manager: RunManager; bag: Bag } {
  const manager = new RunManager();
  manager.startRun(
    { party: [new Pokemon(BULBASAUR, 5)], items: [{ itemId: 'potion', quantity: 2 }] },
    { mapId: 'route-1', durationMs: 60_000 },
  );
  return { manager, bag: new Bag({ potion: 2 }, RAID_BAG_GRID) };
}

describe('what a raid is carrying home', () => {
  /**
   * The deployed party walks beside the player and costs nothing: six at four
   * squares each would be 24 against an 18-square pack, and deployment would be
   * impossible. What costs squares is what is being brought back.
   */
  it('charges for catches and gifts, and never for the deployed party', () => {
    const { manager, bag } = startedRaid();
    syncPackCargo(bag, manager.snapshot());
    expect(bag.cargo).toEqual([]);
    expect(bag.room('potion')).toBe(16);

    manager.registerCaughtPokemon(new Pokemon(PIDGEY, 4));
    manager.registerGiftedPokemon('reedbeds-pikachu', new Pokemon(BULBASAUR, 4));
    syncPackCargo(bag, manager.snapshot());

    expect(bag.cargo.map(({ name }) => name)).toEqual(['Pidgey', 'Bulbasaur']);
    expect(bag.layout().cellsUsed).toBe(10);
    expect(bag.room('potion')).toBe(8);
  });

  it('is re-derived rather than counted up, so a battle cannot charge twice', () => {
    const { manager, bag } = startedRaid();
    manager.registerCaughtPokemon(new Pokemon(PIDGEY, 4));

    // The world is rebuilt after every fight and hands the same pack back.
    syncPackCargo(bag, manager.snapshot());
    syncPackCargo(bag, manager.snapshot());
    syncPackCargo(bag, manager.snapshot());

    expect(bag.cargo).toHaveLength(1);
    expect(bag.layout().cellsUsed).toBe(6);
  });

  it('refuses one more catch when the pack is full, by name and by price', () => {
    const { manager, bag } = startedRaid();
    for (let index = 0; index < 3; index += 1) {
      manager.registerCaughtPokemon(new Pokemon(PIDGEY, 4));
    }
    syncPackCargo(bag, manager.snapshot());

    // Three catches is twelve squares; the Potions take two more, and the
    // fourth Pidgey has nowhere to stand.
    expect(bag.layout().cargo).toHaveLength(3);
    expect(bag.layout().cargoOverflow).toEqual([]);
    expect(packHasRoomForPokemon(bag, new Pokemon(PIDGEY, 4))).toBe(false);
    expect(packFullForPokemonLine(new Pokemon(PIDGEY, 4))).toBe(
      'No room in the pack! PIDGEY needs 4 squares.',
    );
    expect(packFullForPokemonLine(new Pokemon(IVYSAUR, 16))).toContain('6 squares');
  });

  it('names every carried Pokemon separately, so two of a species are two pieces', () => {
    const cargo = raidPackCargo([new Pokemon(PIDGEY, 4), new Pokemon(PIDGEY, 5)]);
    expect(new Set(cargo.map(({ cargoId }) => cargoId)).size).toBe(2);
  });
});
