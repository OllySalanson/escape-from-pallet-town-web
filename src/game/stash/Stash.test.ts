import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { SaveManager, type StorageLike } from '../save/SaveManager';
import { Stash } from './Stash';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string |null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('Stash', () => {
  it('adds, lists, and removes Pokemon and item stacks', () => {
    const stash = new Stash();
    const charmander = new Pokemon(CHARMANDER, 5);

    stash.addPokemon(charmander, 'starter');
    expect(stash.addItem('poke-ball', 3)).toBe(true);
    expect(stash.listPokemon()).toEqual([{ id: 'starter', pokemon: charmander }]);
    expect(stash.listItems()).toEqual({ 'poke-ball': 3 });

    expect(stash.removePokemon('starter')).toBe(charmander);
    expect(stash.removeItem('poke-ball', 2)).toBe(true);
    expect(stash.listPokemon()).toEqual([]);
    expect(stash.listItems()).toEqual({ 'poke-ball': 1 });
  });

  it('grants a starter and supplies to an empty stash', () => {
    const stash = new Stash();

    expect(stash.ensurePlayable()).toBe(true);
    expect(stash.listPokemon()).toMatchObject([{ pokemon: { base: { id: 'bulbasaur' }, level: 5 } }]);
    expect(stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });

  it('leaves existing Pokemon and supplies completely unchanged', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'charmander-1');
    stash.addItem('potion', 2);
    const contents = stash.toJSON();

    expect(stash.ensurePlayable()).toBe(false);
    expect(stash.toJSON()).toEqual(contents);
  });

  it('restores only a Pokemon when supplies remain', () => {
    const stash = new Stash({ items: { potion: 2, 'poke-ball': 1 } });

    expect(stash.ensurePlayable()).toBe(true);
    expect(stash.listPokemon()).toMatchObject([{ pokemon: { base: { id: 'bulbasaur' }, level: 5 } }]);
    expect(stash.listItems()).toEqual({ potion: 2, 'poke-ball': 1 });
  });

  it('persists the stash and banks extraction rewards', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'starter');
    stash.addItem('potion', 1);
    saves.save({
      party: new PokemonParty([new Pokemon(CHARMANDER, 5)]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
    });

    expect(
      saves.bankRun({
        pokemon: [new Pokemon(PIDGEY, 4)],
        items: [{ itemId: 'poke-ball', quantity: 2 }],
      }),
    ).toBe(true);

    const restored = saves.load();
    expect(restored?.stash.listPokemon()).toMatchObject([
      { id: 'starter', pokemon: { base: { id: 'charmander' } } },
      { pokemon: { base: { id: 'pidgey' }, level: 4 } },
    ]);
    expect(restored?.stash.listItems()).toEqual({ potion: 1, 'poke-ball': 2 });
  });

  it('keeps only secured deployed assets on a wipe', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'secured');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'lost');
    stash.addPokemon(new Pokemon(PIDGEY, 3), 'home');
    stash.addItem('poke-ball', 5);
    stash.addItem('potion', 3);
    saves.save({
      party: new PokemonParty([new Pokemon(CHARMANDER, 5)]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
    });

    expect(
      saves.applyWipeLoss(
        ['secured', 'lost'],
        [
          { itemId: 'poke-ball', quantity: 4 },
          { itemId: 'potion', quantity: 2 },
        ],
        {
          pokemonId: 'secured',
          items: [{ itemId: 'poke-ball', quantity: 1 }, { itemId: 'potion', quantity: 2 }],
        },
      ),
    ).toBe(true);

    const restored = saves.load();
    expect(restored?.stash.listPokemon().map(({ id }) => id)).toEqual(['secured', 'home']);
    expect(restored?.stash.listItems()).toEqual({ 'poke-ball': 2, potion: 3 });
  });
});
