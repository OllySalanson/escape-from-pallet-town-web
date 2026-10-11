import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { SaveManager } from './SaveManager';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

const SAVE_KEY = 'escape-from-pallet-town.save.v1';

const saveStash = (pokemon: Pokemon, storage = new MemoryStorage()) => {
  const stash = new Stash();
  stash.addPokemon(pokemon, 'kept-1');
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 1, y: 1 },
    items: [],
    bag: new Bag({}),
    stash,
  });
  const file = JSON.parse(storage.getItem(SAVE_KEY)!) as {
    stash: { pokemon: { pokemon: Record<string, unknown> }[] };
  };
  return { saves, storage, file, stored: file.stash.pokemon[0].pokemon };
};

describe('a shiny survives a save', () => {
  it('keeps a shiny shiny through a save and a load, evolved or not', () => {
    const pidgeotto = new Pokemon(getSpeciesById('pidgey')!, 18);
    pidgeotto.shiny = true;
    pidgeotto.evolveInto(getSpeciesById('pidgeotto')!);

    const { saves, stored } = saveStash(pidgeotto);

    expect(stored.shiny).toBe(true);
    const loaded = saves.load()?.stash.listPokemon()[0]?.pokemon;
    expect(loaded?.base.id).toBe('pidgeotto');
    expect(loaded?.shiny).toBe(true);
  });

  it('writes nothing new for an ordinary Pokemon, so every other save reads as it did', () => {
    const { saves, stored } = saveStash(new Pokemon(getSpeciesById('rattata')!, 4));

    expect(stored).not.toHaveProperty('shiny');
    expect(saves.load()?.stash.listPokemon()[0]?.pokemon.shiny).toBe(false);
  });

  it('reads a save written before shinies, or a mangled flag, as not shiny', () => {
    const { saves, storage, file } = saveStash(new Pokemon(getSpeciesById('rattata')!, 4));
    file.stash.pokemon[0].pokemon.shiny = 'yes';
    storage.setItem(SAVE_KEY, JSON.stringify(file));

    expect(saves.load()?.stash.listPokemon()[0]?.pokemon.shiny).toBe(false);
  });
});
