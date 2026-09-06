import { describe, expect, it } from 'vitest';
import { CHARMANDER, Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { Bag } from './Bag';
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
