import { describe, expect, it } from 'vitest';
import { CHARMANDER, Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { Bag } from './Bag';
import { RAID_BAG_GRID } from './containers';
import { ITEMS, useFieldItem } from './items';

describe('Bag', () => {
  it('adds, removes, and counts item quantities', () => {
    const bag = new Bag();

    expect(bag.add('potion', 3)).toBe(true);
    expect(bag.count('potion')).toBe(3);
    expect(bag.remove('potion', 2)).toBe(true);
    expect(bag.count('potion')).toBe(1);
    expect(bag.remove('potion', 2)).toBe(false);
    expect(bag.remove('potion')).toBe(true);
    expect(bag.count('potion')).toBe(0);
  });

  it('refuses what will not fit, and changes nothing when it does', () => {
    const bag = new Bag({}, { width: 2, height: 2 });

    expect(bag.add('parts-crate', 1)).toBe(true);
    expect(bag.fits('potion')).toBe(false);
    expect(bag.add('potion', 1)).toBe(false);
    expect(bag.count('potion')).toBe(0);
    expect(bag.count('parts-crate')).toBe(1);

    // Room made is room usable at once: the refusal was about squares, not
    // about the item.
    expect(bag.remove('parts-crate')).toBe(true);
    expect(bag.add('potion', 4)).toBe(true);
    expect(bag.add('potion', 1)).toBe(false);
  });

  it('carries the raid pack by default and reports its room in that item\'s squares', () => {
    const bag = new Bag();

    expect(bag.capacity).toEqual(RAID_BAG_GRID);
    expect(bag.room('potion')).toBe(18);
    expect(bag.room('parts-crate')).toBe(3);
    expect(bag.add('poke-ball', 5)).toBe(true);
    expect(bag.add('potion', 3)).toBe(true);
    expect(bag.layout().cellsUsed).toBe(8);
    expect(bag.room('parts-crate')).toBe(2);
  });

  /**
   * The vault is a warehouse, not a pack. Capping it would make banking a raid
   * something that can fail, which is the one thing extraction is for.
   */
  it('takes anything when it has no capacity, as the vault does', () => {
    const vault = new Bag({}, null);

    expect(vault.add('parts-crate', 500)).toBe(true);
    expect(vault.fits('cable-coil', 500)).toBe(true);
  });

  it('applies a potion heal without exceeding maximum HP', () => {
    const pokemon = new Pokemon(CHARMANDER, 5);
    pokemon.takeDamage(5);

    const result = useFieldItem(ITEMS.potion, pokemon);

    expect(result.used).toBe(true);
    expect(pokemon.currentHp).toBe(pokemon.maxHp);
  });

  it('cures poison with an antidote', () => {
    const pokemon = new Pokemon(CHARMANDER, 5);
    pokemon.primaryStatus = PrimaryStatus.Poison;

    const result = useFieldItem(ITEMS.antidote, pokemon);

    expect(result.used).toBe(true);
    expect(pokemon.primaryStatus).toBeNull();
  });
});

describe('a pack carrying Pokemon home', () => {
  const pidgey = { cargoId: 'a', name: 'Pidgey', width: 2, height: 2 };

  it('charges the squares a Pokemon stands on against the room left for supplies', () => {
    const bag = new Bag({ potion: 4 });
    expect(bag.room('potion')).toBe(14);

    bag.setCargo([pidgey, { ...pidgey, cargoId: 'b' }, { ...pidgey, cargoId: 'c' }]);

    // Three catches is twelve squares of eighteen: two Potions have to go.
    expect(bag.room('potion')).toBe(2);
    expect(bag.layout().cargo).toHaveLength(3);
    expect(bag.layout().cellsUsed).toBe(16);
  });

  it('refuses one more Pokemon when the pack is full, and says so before a ball is thrown', () => {
    const bag = new Bag({ potion: 18 });
    expect(bag.fitsCargo(pidgey)).toBe(false);

    bag.remove('potion', 4);
    expect(bag.fitsCargo(pidgey)).toBe(true);
    bag.setCargo([pidgey]);
    expect(bag.add('potion', 1)).toBe(false);
  });

  it('keeps cargo out of the contents a raid is settled from', () => {
    const bag = new Bag({ potion: 1 });
    bag.setCargo([pidgey]);
    // The Pokemon is the raid's, never the supply ledger's: the settlement, the
    // wipe division and every save field count exactly what they counted.
    expect(bag.toJSON()).toEqual({ potion: 1 });
  });

  it('gives the vault no size, so banking a raid can never fail on squares', () => {
    const vault = new Bag({}, null);
    vault.setCargo(Array.from({ length: 30 }, (_, index) => ({ ...pidgey, cargoId: `${index}` })));
    expect(vault.fitsCargo(pidgey)).toBe(true);
    expect(vault.add('potion', 99)).toBe(true);
  });
});
