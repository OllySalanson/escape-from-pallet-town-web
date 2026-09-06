import { describe, expect, it } from 'vitest';
import { Pokemon, PokemonParty, CHARMANDER, PIDGEY } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { Bag } from '../items';
import { SAVE_KEY, SaveManager } from './SaveManager';
import { Stash } from '../stash';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('SaveManager', () => {
  it('round-trips party state and world position', () => {
    const charmander = new Pokemon(CHARMANDER, 12);
    charmander.takeDamage(9);
    charmander.primaryStatus = PrimaryStatus.Burn;
    const pidgey = new Pokemon(PIDGEY, 8);
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const bag = new Bag({ potion: 2, antidote: 1, 'poke-ball': 5 });
    const stash = new Stash();
    stash.addPokemon(new Pokemon(PIDGEY, 6), 'stash-pidgey');
    stash.addItem('poke-ball', 3);

    expect(
      saves.save({
        party: new PokemonParty([charmander, pidgey]),
        mapId: 'route-1',
        position: { x: 7, y: 21 },
        items: ['potion'],
        bag,
        stash,
      }),
    ).toBe(true);

    const restored = saves.load();

    expect(restored).not.toBeNull();
    expect(restored?.mapId).toBe('route-1');
    expect(restored?.position).toEqual({ x: 7, y: 21 });
    expect(restored?.items).toEqual(['potion']);
    expect(restored?.bag.toJSON()).toEqual({ potion: 2, antidote: 1, 'poke-ball': 5 });
    expect(restored?.stash.listItems()).toEqual({ 'poke-ball': 3 });
    expect(restored?.stash.listPokemon()).toMatchObject([
      { id: 'stash-pidgey', pokemon: { base: { id: 'pidgey' }, level: 6 } },
    ]);
    expect(restored?.party.pokemon).toHaveLength(2);
    expect(restored?.party.pokemon[0]).toMatchObject({
      base: { id: 'charmander' },
      level: 12,
      currentHp: charmander.currentHp,
      primaryStatus: PrimaryStatus.Burn,
    });
    expect(restored?.party.pokemon[0].moves.map((move) => move.base.name)).toEqual(
      charmander.moves.map((move) => move.base.name),
    );
  });

  it('returns no save for corrupt or unsupported stored data', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);

    storage.setItem(SAVE_KEY, '{broken json');
    expect(saves.load()).toBeNull();
    expect(saves.hasSave()).toBe(false);

    storage.setItem(SAVE_KEY, JSON.stringify({ version: 99 }));
    expect(saves.load()).toBeNull();
  });

  it('migrates version 1 saves with no stash to an empty vault', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: {},
      }),
    );

    expect(saves.load()?.stash.toJSON()).toEqual({ pokemon: [], items: {} });
  });

  it('restores a starter after a wipe removes the last stashed Pokemon', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'lost');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
    });

    expect(saves.applyWipeLoss(['lost'], [])).toBe(true);

    const restored = saves.load();
    expect(restored?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    expect(restored?.stash.listPokemon().map(({ pokemon }) => pokemon.base.id)).not.toContain('charmander');
    expect(restored?.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });
});
