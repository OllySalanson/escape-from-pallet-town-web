import { describe, expect, it } from 'vitest';
import { Bag, RAID_BAG_GRID } from '../items';
import { Pokemon } from '../pokemon';
import { BULBASAUR, IVYSAUR, PIDGEY, getSpeciesById } from '../pokemon/species';
import { pokemonCargo } from '../pokemon/pokemonCargo';
import { RunManager } from './RunManager';
import {
  clearPackRoomForPokemon,
  packCouldEverHoldPokemon,
  packFullForPokemonLine,
  packHasRoomForPokemon,
  packHasRoomOnceThrown,
  packNeverFitsPokemonLine,
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
    // In a fight it says how many squares are free beside what the catch needs.
    // Four squares are free here, scattered: enough of them, not in a Pidgey's shape.
    const { cellsUsed, cellsTotal } = bag.layout();
    expect(cellsTotal - cellsUsed).toBe(4);
    expect(packFullForPokemonLine(new Pokemon(PIDGEY, 4), bag)).toBe(
      'No room in the pack! PIDGEY needs 4 squares, and 4 are free, but not in its shape.',
    );
    expect(packFullForPokemonLine(new Pokemon(IVYSAUR, 16), bag)).toBe(
      'No room in the pack! IVYSAUR needs 6 squares, and 4 are free.',
    );
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

  /**
   * Playtest 29 B6 and T5: two hundred and fifty Pokedollars share a square, so
   * putting one down frees nothing - yet the row said "Frees 1 square" and every
   * press put down a single ₽1. One press puts down what stands on one square.
   */
  it('puts down a whole square of a stacked find, and frees the square it says', () => {
    const bag = new Bag({ potion: 14, money: 300 }, RAID_BAG_GRID);
    const money = packRoomChoices(bag, new Pokemon(PIDGEY, 4)).find(({ itemId }) => itemId === 'money')!;
    const potion = packRoomChoices(bag, new Pokemon(PIDGEY, 4)).find(({ itemId }) => itemId === 'potion')!;

    expect(potion.drops).toBe(1);
    expect(money.drops).toBe(50);
    expect(money.squares).toBe(1);
    const before = bag.layout().cellsUsed;
    expect(bag.remove(money.itemId, money.drops)).toBe(true);
    expect(bag.layout().cellsUsed).toBe(before - money.squares);
  });

  it('is empty when every square is already a Pokemon being carried home', () => {
    const bag = new Bag({ 'poke-ball': 1 }, RAID_BAG_GRID);
    bag.setCargo(raidPackCargo([0, 1, 2, 3].map(() => new Pokemon(PIDGEY, 4))));

    expect(packHasRoomForPokemon(bag, new Pokemon(PIDGEY, 4))).toBe(false);
    expect(packRoomChoices(bag, new Pokemon(PIDGEY, 4), 'poke-ball')).toEqual([]);
  });
});

describe('a catch no amount of putting down would make room for', () => {
  /**
   * Veteran playtest (20 Nov 2026): a 12-square Satchel carrying a 6-square
   * Ivysaur, and an Alakazam that needs 9. The make-room panel let four items
   * be put down one at a time without ever reaching 9.
   */
  const satchel = (): Bag => {
    const bag = new Bag({ potion: 2, 'poke-ball': 2 }, { width: 4, height: 3 });
    bag.setCargo([pokemonCargo('ivysaur-1', new Pokemon(IVYSAUR, 28))]);
    return bag;
  };

  it('is known before anything is put down', () => {
    const alakazam = new Pokemon(getSpeciesById('alakazam')!, 22);
    expect(packHasRoomForPokemon(satchel(), alakazam)).toBe(false);
    expect(packCouldEverHoldPokemon(satchel(), alakazam)).toBe(false);
    expect(packNeverFitsPokemonLine(alakazam)).toBe(
      `${packFullForPokemonLine(alakazam)} Even with everything else put down, this pack cannot hold it.`,
    );
  });

  it('still offers the panel where putting things down would make room', () => {
    expect(packCouldEverHoldPokemon(satchel(), new Pokemon(PIDGEY, 4))).toBe(true);
  });
});

/**
 * AI playtests of 22 Nov 2026: 'PIDGEY needs 4 squares, and 3 are free' made
 * the player put a Pecha Berry down, when the Poke Ball being thrown was itself
 * one of the fifteen squares in use; and an Alakazam needing 9 beside 8 free
 * took two Potions where one was enough. The ball has left the pack by the
 * time anything is caught, so it is room.
 */
describe('the ball being thrown', () => {
  it('is room for the catch, so a catch that fits once it is thrown asks nothing', () => {
    const bag = new Bag({ potion: 14, 'poke-ball': 1 }, RAID_BAG_GRID);
    const pidgey = new Pokemon(PIDGEY, 4);

    expect(packHasRoomForPokemon(bag, pidgey)).toBe(false);
    expect(packHasRoomOnceThrown(bag, pidgey, 'poke-ball')).toBe(true);
    expect(packHasRoomOnceThrown(bag, pidgey)).toBe(false);
    // And thrown, the Pidgey really is seated.
    bag.remove('poke-ball', 1);
    expect(clearPackRoomForPokemon(bag, pidgey).fits).toBe(true);
  });

  it('counts towards what putting one thing down would free', () => {
    const bag = new Bag({ potion: 9, 'poke-ball': 2 }, RAID_BAG_GRID);
    const alakazam = new Pokemon(getSpeciesById('alakazam')!, 22);

    expect(packHasRoomOnceThrown(bag, alakazam, 'poke-ball')).toBe(false);
    const potion = packRoomChoices(bag, alakazam, 'poke-ball').find(({ itemId }) => itemId === 'potion')!;
    expect(potion.freesEnough).toBe(true);
  });
});
