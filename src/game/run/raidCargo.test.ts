import { describe, expect, it } from 'vitest';
import { Bag, RAID_BAG_GRID } from '../items';
import { Pokemon } from '../pokemon';
import { BULBASAUR, IVYSAUR, PIDGEY } from '../pokemon/species';
import { RunManager } from './RunManager';
import {
  packFullForPokemonLine,
  packHasRoomForPokemon,
  packRoomChoices,
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

/**
 * The other half of a refusal: what the player could put down to answer it.
 * A refusal that names a price and offers no way to pay it is the trap the
 * captain walked into on 2026-09-20 - see `scenes/BattleScene.test.ts`.
 */
describe('what the pack could put down to make room', () => {
  const full = () => new Bag({ potion: 17, 'poke-ball': 1 }, RAID_BAG_GRID);

  it('prices every kind in squares and says which one is enough on its own', () => {
    // Seventeen Potions and a ball fill eighteen squares. A Pidgey needs four
    // of them *together*, so no single Potion is the answer and a parts crate,
    // which is the same 2x2 shape, is.
    const bag = new Bag({ potion: 13, 'parts-crate': 1, 'poke-ball': 1 }, RAID_BAG_GRID);
    const choices = packRoomChoices(bag, new Pokemon(PIDGEY, 4));

    expect(choices.map(({ displayName, squares, freesEnough }) => [displayName, squares, freesEnough]))
      .toEqual([
        ['Potion', 1, false],
        ['Poké Ball', 1, false],
        ['Parts crate', 4, true],
      ]);
  });

  it('never offers the last of the ball the throw is waiting on', () => {
    const bag = full();

    expect(packRoomChoices(bag, new Pokemon(PIDGEY, 4), 'poke-ball').map(({ itemId }) => itemId))
      .toEqual(['potion']);
    // Two of a kind is a real choice: one goes down, one is still thrown.
    const spare = new Bag({ potion: 16, 'poke-ball': 2 }, RAID_BAG_GRID);
    expect(packRoomChoices(spare, new Pokemon(PIDGEY, 4), 'poke-ball').map(({ itemId }) => itemId))
      .toEqual(['potion', 'poke-ball']);
  });

  it('is empty when every square is already a Pokemon being carried home', () => {
    const bag = new Bag({ 'poke-ball': 1 }, RAID_BAG_GRID);
    bag.setCargo(raidPackCargo([0, 1, 2, 3].map(() => new Pokemon(PIDGEY, 4))));

    expect(packHasRoomForPokemon(bag, new Pokemon(PIDGEY, 4))).toBe(false);
    expect(packRoomChoices(bag, new Pokemon(PIDGEY, 4), 'poke-ball')).toEqual([]);
  });
});
