import { describe, expect, it } from 'vitest';
import { Pokemon, PokemonParty, CHARMANDER, PIDGEY, SQUIRTLE } from '../pokemon';
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

  it('persists a selected starter and restores it as the playable fallback after a wipe', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(SQUIRTLE, 5), 'squirtle-1');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'squirtle',
    });

    expect(saves.load()?.starterSpeciesId).toBe('squirtle');
    expect(saves.applyWipeLoss(['squirtle-1'], [])).toBe(true);
    expect(saves.load()?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'squirtle' }, level: 5 } },
    ]);
  });

  it('infers an existing profile starter without changing its established party or stash', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 3,
        party: [{ speciesId: 'charmander', level: 5, currentHp: 12, xp: 125, moves: ['Scratch'], primaryStatus: null }],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: {},
        stash: { pokemon: [{ id: 'charmander-1', pokemon: { speciesId: 'charmander', level: 5, currentHp: 12, xp: 125, moves: ['Scratch'], primaryStatus: null } }], items: {} },
      }),
    );
    const saves = new SaveManager(storage);

    const restored = saves.load();

    expect(restored?.starterSpeciesId).toBe('charmander');
    expect(restored?.party.pokemon).toMatchObject([{ base: { id: 'charmander' }, currentHp: 12 }]);
    expect(restored?.stash.listPokemon()).toMatchObject([{ id: 'charmander-1', pokemon: { base: { id: 'charmander' } } }]);
  });

  it('repairs Tackle in legacy Bulbasaur party and stash records without replacing learned moves', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 4,
        party: [
          {
            speciesId: 'bulbasaur',
            level: 7,
            currentHp: 20,
            xp: 343,
            moves: ['Super Sonic', 'Growl', 'Vine Whip'],
            primaryStatus: null,
          },
        ],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: {},
        stash: {
          pokemon: [
            {
              id: 'bulbasaur-1',
              pokemon: {
                speciesId: 'bulbasaur',
                level: 7,
                currentHp: 20,
                xp: 343,
                moves: ['Growl', 'Vine Whip'],
                primaryStatus: null,
              },
            },
          ],
          items: {},
        },
      }),
    );

    const restored = new SaveManager(storage).load();

    expect(restored?.party.pokemon[0]?.moves.map((move) => move.base.name)).toEqual([
      'Tackle',
      'Super Sonic',
      'Growl',
      'Vine Whip',
    ]);
    expect(restored?.stash.listPokemon()[0]?.pokemon.moves.map((move) => move.base.name)).toEqual([
      'Tackle',
      'Growl',
      'Vine Whip',
    ]);
  });

  it('does not replace a full legacy Bulbasaur moveset while reconciling Tackle', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 4,
        party: [
          {
            speciesId: 'bulbasaur',
            level: 7,
            currentHp: 20,
            xp: 343,
            moves: ['Super Sonic', 'Growl', 'Vine Whip', 'Tackle'],
            primaryStatus: null,
          },
        ],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: {},
        stash: { pokemon: [], items: {} },
      }),
    );

    expect(new SaveManager(storage).load()?.party.pokemon[0]?.moves.map((move) => move.base.name)).toEqual([
      'Super Sonic',
      'Growl',
      'Vine Whip',
      'Tackle',
    ]);
  });

  it('swaps a sole Pokemon for a new starter and re-grants that species on the next wipe', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 18), 'charmander-1');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
    });

    // A levelled Pokemon is released for good, so a swap is never an upgrade.
    expect(saves.reselectStarter('squirtle')).toBe(true);

    const swapped = saves.load();
    expect(swapped?.starterSpeciesId).toBe('squirtle');
    expect(swapped?.stash.listPokemon()).toMatchObject([
      { id: 'squirtle-1', pokemon: { base: { id: 'squirtle' }, level: 5 } },
    ]);

    expect(saves.applyWipeLoss(['squirtle-1'], [])).toBe(true);
    expect(saves.load()?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'squirtle' }, level: 5 } },
    ]);
  });

  it('refuses a starter swap while more than one Pokemon is stashed', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 12), 'charmander-1');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
    });

    expect(saves.reselectStarter('squirtle')).toBe(false);

    const unchanged = saves.load();
    expect(unchanged?.starterSpeciesId).toBe('charmander');
    expect(unchanged?.stash.listPokemon().map(({ id }) => id)).toEqual(['charmander-1', 'pidgey-1']);
  });

  it('lets a save written before starter reselection swap and re-grant the new species', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 4,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: {},
        stash: {
          pokemon: [
            {
              id: 'bulbasaur-1',
              pokemon: {
                speciesId: 'bulbasaur',
                level: 5,
                currentHp: 20,
                xp: 0,
                moves: ['Tackle', 'Growl'],
                primaryStatus: null,
              },
            },
          ],
          items: { potion: 3 },
        },
      }),
    );
    const saves = new SaveManager(storage);

    expect(saves.load()?.starterSpeciesId).toBe('bulbasaur');
    expect(saves.reselectStarter('charmander')).toBe(true);

    const swapped = saves.load();
    expect(swapped?.starterSpeciesId).toBe('charmander');
    expect(swapped?.stash.listPokemon()).toMatchObject([
      { id: 'charmander-1', pokemon: { base: { id: 'charmander' }, level: 5 } },
    ]);
    // The swap is a recovery path, so it also restores the Poke Balls this
    // legacy save had none of; the 3 kept Potions are already at the minimum.
    expect(swapped?.stash.listItems()).toEqual({ potion: 3, 'poke-ball': 5 });

    expect(saves.applyWipeLoss(['charmander-1'], [{ itemId: 'potion', quantity: 3 }])).toBe(true);
    expect(saves.load()?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'charmander' }, level: 5 } },
    ]);
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
      { pokemon: { base: { id: 'charmander' }, level: 5 } },
    ]);
    expect(restored?.stash.listPokemon()).toHaveLength(1);
    expect(restored?.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });
});
