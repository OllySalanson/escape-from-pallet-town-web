import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { SaveManager } from './SaveManager';

class MemoryStorage {
  public readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

const saveWith = (pokemon: Pokemon): { saves: SaveManager; storage: MemoryStorage } => {
  const stash = new Stash();
  stash.addPokemon(pokemon, 'caught-1');
  const storage = new MemoryStorage();
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 1, y: 1 },
    items: [],
    bag: new Bag({}),
    stash,
  });
  return { saves, storage };
};

const loaded = (saves: SaveManager): Pokemon | undefined => saves.load()?.stash.listPokemon()[0]?.pokemon;

describe('a nickname is saved with the Pokemon', () => {
  it('comes back from a save', () => {
    const pidgey = new Pokemon(getSpeciesById('pidgey')!, 4);
    pidgey.giveNickname('Sparky');

    const back = loaded(saveWith(pidgey).saves);

    expect(back?.name).toBe('Sparky');
    expect(back?.base.name).toBe('Pidgey');
  });

  it('writes nothing for a Pokemon that has none, so it loads as its species', () => {
    const { saves, storage } = saveWith(new Pokemon(getSpeciesById('pidgey')!, 4));

    expect([...storage.values.values()].join('')).not.toContain('nickname');
    expect(loaded(saves)?.nickname).toBeNull();
    expect(loaded(saves)?.name).toBe('Pidgey');
  });

  it('holds a name read from a save to the rules a typed one is held to', () => {
    const pidgey = new Pokemon(getSpeciesById('pidgey')!, 4);
    pidgey.giveNickname('Sparky');
    const { saves, storage } = saveWith(pidgey);
    for (const [key, text] of storage.values) {
      storage.values.set(key, text.replace('"nickname":"Sparky"', '"nickname":"<img src=x>Sparkytastic"'));
    }

    expect(loaded(saves)?.name).toBe('img src=xS');
  });
});
