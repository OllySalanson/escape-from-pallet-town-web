import { describe, expect, it } from 'vitest';
import { CHARMANDER, PIDGEY, PIKACHU, Pokemon, SQUIRTLE } from '../pokemon';
import { Stash } from '../stash';
import { matchesSearch, nextStashSort, searchPokemon, sortPokemon, STASH_SORTS } from './stashBrowser';

function stashOf(): Stash {
  const stash = new Stash();
  stash.addPokemon(new Pokemon(PIDGEY, 9), 'pidgey');
  stash.addPokemon(new Pokemon(PIKACHU, 4), 'pikachu-low');
  stash.addPokemon(new Pokemon(CHARMANDER, 12), 'charmander');
  stash.addPokemon(new Pokemon(PIKACHU, 8), 'pikachu-high');
  const hurt = new Pokemon(SQUIRTLE, 20);
  hurt.takeDamage(5);
  stash.addPokemon(hurt, 'squirtle-hurt');
  return stash;
}

const ids = (list: readonly { id: string }[]): string[] => list.map(({ id }) => id);

describe('stash browsing', () => {
  it('keeps the banked order as it was', () => {
    const all = stashOf().listPokemon();
    expect(ids(sortPokemon(all, 'kept'))).toEqual(ids(all));
  });

  it('orders by species, the stronger first within one', () => {
    expect(ids(sortPokemon(stashOf().listPokemon(), 'species'))).toEqual([
      'charmander',
      'squirtle-hurt',
      'pidgey',
      'pikachu-high',
      'pikachu-low',
    ]);
  });

  it('orders by level, highest first', () => {
    expect(ids(sortPokemon(stashOf().listPokemon(), 'level'))).toEqual([
      'squirtle-hurt',
      'charmander',
      'pidgey',
      'pikachu-high',
      'pikachu-low',
    ]);
  });

  it('puts what is fit to raid first, and what needs recovery last', () => {
    const sorted = ids(sortPokemon(stashOf().listPokemon(), 'fit'));
    expect(sorted[sorted.length - 1]).toBe('squirtle-hurt');
    expect(sorted[0]).toBe('charmander');
  });

  it('finds a Pokemon by the start of its name, in any case, whichever box holds it', () => {
    const stash = stashOf();
    stash.movePokemon('pikachu-low', stash.addBox());
    expect(ids(searchPokemon(stash.listPokemon(), 'PIKA'))).toEqual(['pikachu-low', 'pikachu-high']);
    expect(ids(searchPokemon(stash.listPokemon(), 'ch'))).toEqual(['charmander']);
    expect(ids(searchPokemon(stash.listPokemon(), 'kachu'))).toEqual([]);
    expect(searchPokemon(stash.listPokemon(), '  ')).toHaveLength(5);
  });

  it('finds gear a Pokemon is holding', () => {
    const stash = stashOf();
    stash.addItem('leftovers', 1);
    const holder = stash.listPokemon()[0];
    holder.pokemon.giveHeldItem('leftovers');
    expect(matchesSearch(holder, 'leftov')).toBe(true);
  });

  it('walks every sort and comes back to the first', () => {
    let sort = STASH_SORTS[0];
    for (let step = 0; step < STASH_SORTS.length; step += 1) {
      sort = nextStashSort(sort);
    }
    expect(sort).toBe(STASH_SORTS[0]);
  });
});
