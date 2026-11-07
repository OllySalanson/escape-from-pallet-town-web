import { describe, expect, it } from 'vitest';
import { Bag, getItemById, teachFromMachine, useFieldItem } from '../items';
import { Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
import { Stash } from '../stash';
import { SaveManager } from './SaveManager';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

const savedWith = (speciesId: string, level: number, items: Record<string, number>): SaveManager => {
  const stash = new Stash();
  stash.addPokemon(new Pokemon(getSpeciesById(speciesId)!, level), 'home-1');
  for (const [itemId, quantity] of Object.entries(items)) {
    stash.addItem(itemId, quantity);
  }
  const saves = new SaveManager(new MemoryStorage());
  saves.save({ party: new PokemonParty([]), mapId: 'pallet-town', position: { x: 1, y: 1 }, items: [], bag: new Bag({}), stash });
  return saves;
};

const stone = (id: string) => (pokemon: Pokemon) => {
  const used = useFieldItem(getItemById(id)!, pokemon).used;
  return { changed: used, spent: used };
};

const disc = (id: string) => (pokemon: Pokemon) => {
  const outcome = teachFromMachine(getItemById(id)!, pokemon);
  return { changed: outcome.kind === 'learned', spent: outcome.kind === 'learned' && outcome.machineIsSpent };
};

describe('using a thing out of storage at home', () => {
  it('evolves a stored Pokémon with a stone and spends the stone, in one write', () => {
    const saves = savedWith('pikachu', 12, { 'thunder-stone': 2 });
    expect(saves.useAtHome('thunder-stone', 'home-1', stone('thunder-stone'))).toBeDefined();
    const game = saves.load()!;
    expect(game.stash.listPokemon()[0]?.pokemon.base.id).toBe('raichu');
    expect(game.stash.itemCount('thunder-stone')).toBe(1);
  });

  it('writes nothing for a stone that does nothing', () => {
    const saves = savedWith('rattata', 12, { 'fire-stone': 1 });
    expect(saves.useAtHome('fire-stone', 'home-1', stone('fire-stone'))).toBeUndefined();
    expect(saves.load()!.stash.itemCount('fire-stone')).toBe(1);
  });

  it('reads an HM into a free slot and keeps the HM', () => {
    const saves = savedWith('bulbasaur', 5, { 'hm01-cut': 1 });
    expect(saves.useAtHome('hm01-cut', 'home-1', disc('hm01-cut'))).toBeDefined();
    const game = saves.load()!;
    expect(game.stash.listPokemon()[0]?.pokemon.moves.map((move) => move.base.name)).toContain('Cut');
    expect(game.stash.itemCount('hm01-cut')).toBe(1);
  });

  it('refuses a thing the vault does not hold, or a Pokémon it does not', () => {
    const saves = savedWith('pikachu', 12, {});
    expect(saves.useAtHome('thunder-stone', 'home-1', stone('thunder-stone'))).toBeUndefined();
    expect(saves.useAtHome('thunder-stone', 'nobody', stone('thunder-stone'))).toBeUndefined();
    expect(saves.load()!.stash.listPokemon()[0]?.pokemon.base.id).toBe('pikachu');
  });
});

describe('choosing the next raid team at home', () => {
  it('writes the bench the hall opens on, and starts a new team counting again', () => {
    const saves = savedWith('pikachu', 12, {});
    const game = saves.load()!;
    expect(saves.save({ ...game, raidProgress: { ...game.raidProgress, lastBench: ['home-1'], benchRaids: 3 } })).toBe(true);

    // The same team keeps its count.
    expect(saves.chooseBench(['home-1'])).toBe(true);
    expect(saves.load()!.raidProgress.benchRaids).toBe(3);

    // A new team has gone on no raid together yet: the door makes it one.
    expect(saves.chooseBench([])).toBe(true);
    expect(saves.load()!.raidProgress.lastBench).toEqual([]);
    expect(saves.load()!.raidProgress.benchRaids).toBeUndefined();
    expect(saves.recordBench(['home-1'])).toBe(true);
    expect(saves.load()!.raidProgress.benchRaids).toBe(1);
  });
});
