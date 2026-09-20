import { describe, expect, it } from 'vitest';
import {
  Pokemon,
  PokemonParty,
  CHARMANDER,
  BULBASAUR,
  PIDGEY,
  PIKACHU,
  SQUIRTLE,
  experienceForLevel,
} from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { Bag } from '../items';
import { SAVE_KEY, SaveManager } from './SaveManager';
import { applyRecovery, MAX_PENDING_RECOVERY_MS } from '../hub/recovery';
import { Stash } from '../stash';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { WORLD_MAPS } from '../worldMap';
import { surveyedTiles } from '../world/survey';

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

/** A save on disk for a new player, which is what a record is written onto. */
function freshSave(storage: MemoryStorage): SaveManager {
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash: new Stash(),
  });
  return saves;
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

    expect(saves.load()?.stash.toJSON()).toEqual({
      pokemon: [],
      items: {},
      boxes: [{ name: 'Box 1', pokemonIds: [] }],
    });
  });

  // A free-roam save (versions 1 to 3) kept the player's team in `party` and
  // their supplies in `bag`. The extraction game reads neither: the vault is the
  // team. Loading one used to say yes and hand back an empty vault, which the
  // title screen then filled with a fresh level-5 starter and wrote back over
  // the save, so a levelled team was destroyed without a word.
  it('carries a version 1 free-roam party into the vault instead of losing it', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [
          { speciesId: 'bulbasaur', level: 9, currentHp: 11, moves: ['Tackle', 'Vine Whip'], primaryStatus: 'poison' },
          { speciesId: 'pikachu', level: 7, currentHp: 12, moves: ['Thunder Shock'], primaryStatus: null },
        ],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: { potion: 3, 'poke-ball': 5 },
      }),
    );
    const saves = new SaveManager(storage);

    const restored = saves.load();

    expect(restored?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 9, currentHp: 11, primaryStatus: PrimaryStatus.Poison } },
      { pokemon: { base: { id: 'pikachu' }, level: 7, currentHp: 12 } },
    ]);
    expect(restored?.stash.listPokemon()[0].pokemon.moves.map((move) => move.base.name)).toEqual([
      'Tackle',
      'Vine Whip',
    ]);
    // The supplies were carried in the same dead field and go the same way.
    expect(restored?.stash.listItems()).toEqual({ potion: 3, 'poke-ball': 5 });
    // Moved, not copied: leaving the team in both places would let a later save
    // write bank the same Pokemon twice.
    expect(restored?.party.pokemon).toEqual([]);
    // The vault now holds a team, so nothing hands the player a fresh starter.
    expect(restored?.stash.ensurePlayable()).toBe(false);
    expect(restored?.starterSpeciesId).toBe('bulbasaur');
  });

  it('survives the title screen rewriting a migrated free-roam save', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesId: 'bulbasaur', level: 9, currentHp: 11, moves: ['Tackle'], primaryStatus: null }],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: { potion: 3 },
      }),
    );
    const saves = new SaveManager(storage);

    // What TitleScene does with a loaded save: top it up if unplayable, then
    // write it back at the current version.
    const first = saves.load();
    expect(first?.stash.ensurePlayable()).toBe(false);
    expect(saves.save(first!)).toBe(true);

    expect(saves.load()?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 9 } },
    ]);
    expect(saves.load()?.stash.listItems()).toEqual({ potion: 3 });
  });

  it.each([2, 3])('carries a version %i free-roam party into the vault as well', (version) => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version,
        party: [{ speciesId: 'squirtle', level: 11, currentHp: 30, xp: 1331, moves: ['Tackle'], primaryStatus: null }],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: { potion: 1 },
        stash: { pokemon: [], items: {} },
      }),
    );

    const restored = new SaveManager(storage).load();

    expect(restored?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'squirtle' }, level: 11, experience: 1331 } },
    ]);
    expect(restored?.stash.listItems()).toEqual({ potion: 1 });
    expect(restored?.party.pokemon).toEqual([]);
  });

  it.each([2, 3])('leaves a version %i save that already has a vault exactly as it is', (version) => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version,
        party: [{ speciesId: 'squirtle', level: 11, currentHp: 30, moves: ['Tackle'], primaryStatus: null }],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: { potion: 1 },
        stash: {
          pokemon: [
            { id: 'squirtle-1', pokemon: { speciesId: 'squirtle', level: 11, currentHp: 30, moves: ['Tackle'], primaryStatus: null } },
          ],
          items: { 'poke-ball': 2 },
        },
      }),
    );

    const restored = new SaveManager(storage).load();

    // The vault is the vault of record here, and this party came out of it, so
    // merging it would put the same Squirtle in twice.
    expect(restored?.stash.listPokemon()).toHaveLength(1);
    expect(restored?.stash.listItems()).toEqual({ 'poke-ball': 2 });
    expect(restored?.party.pokemon).toMatchObject([{ base: { id: 'squirtle' }, level: 11 }]);
  });

  it.each([4, 5])('leaves a version %i save alone, party and empty vault included', (version) => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version,
        party: [{ speciesId: 'charmander', level: 6, currentHp: 19, xp: 216, moves: ['Scratch'], primaryStatus: null }],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: { potion: 2 },
        stash: { pokemon: [], items: {} },
        starterSpeciesId: 'charmander',
      }),
    );

    const restored = new SaveManager(storage).load();

    // By version 4 the vault is the team and the party is a raid selection out
    // of it, so an empty vault means a wipe - which `ensurePlayable` answers
    // with a fresh starter. Migrating here would resurrect a lost run.
    expect(restored?.stash.toJSON()).toMatchObject({ pokemon: [], items: {} });
    expect(restored?.party.pokemon).toMatchObject([{ base: { id: 'charmander' }, level: 6 }]);
    expect(restored?.bag.toJSON()).toEqual({ potion: 2 });
  });

  it('carries the loose overworld item list of the earliest saves into the vault too', () => {
    // Versions 1 and 2 predate the Bag: picked-up items were a list of ids.
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesId: 'charmander', level: 5, currentHp: 19, moves: ['Scratch'], primaryStatus: null }],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: ['potion', 'potion', 'antidote'],
        // A save from the changeover can hold supplies in both fields at once,
        // and the two are added rather than one shadowing the other.
        bag: { potion: 1, 'poke-ball': 4 },
      }),
    );

    expect(new SaveManager(storage).load()?.stash.listItems()).toEqual({
      potion: 3,
      antidote: 1,
      'poke-ball': 4,
    });
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
    // A swap changes the species and nothing else: the kit is the wipe's to
    // restore, so the Poke Balls this legacy save has none of arrive there.
    expect(swapped?.stash.listItems()).toEqual({ potion: 3 });

    expect(saves.applyWipeLoss(['charmander-1'], [{ itemId: 'potion', quantity: 3 }])).toBe(true);
    expect(saves.load()?.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'charmander' }, level: 5 } },
    ]);
  });

  it('settles a raid into a save written before raid damage was ever persisted', () => {
    // The settlement rides in the arguments, not in the save format, so a save
    // from before this existed takes one without a version bump or a migration.
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
              id: 'charmander-1',
              pokemon: {
                speciesId: 'charmander',
                level: 7,
                currentHp: 21,
                xp: 0,
                moves: ['Scratch', 'Growl'],
                primaryStatus: null,
              },
            },
          ],
          items: { potion: 3 },
        },
      }),
    );
    const saves = new SaveManager(storage);

    expect(
      saves.bankRun(
        { pokemon: [], items: [] },
        {
          condition: [
            { id: 'charmander-1', currentHp: 6, primaryStatus: 'burn', experience: 400, heldItemId: null },
          ],
          supplies: [{ itemId: 'potion', quantity: -2 }],
        },
      ),
    ).toBe(true);

    const settled = saves.load();
    expect(settled?.stash.listPokemon()).toMatchObject([
      { id: 'charmander-1', pokemon: { currentHp: 6, primaryStatus: 'burn' } },
    ]);
    expect(settled?.stash.listItems()).toEqual({ potion: 1 });
  });

  it('never lets a settlement invent HP or supplies the vault cannot hold', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    const charmander = new Pokemon(CHARMANDER, 7);
    stash.addPokemon(charmander, 'charmander-1');
    stash.addItem('potion', 1);
    saves.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 1, y: 1 }, stash });

    expect(
      saves.bankRun(
        { pokemon: [], items: [] },
        {
          condition: [
            {
              id: 'charmander-1',
              currentHp: 9_999,
              primaryStatus: null,
              experience: charmander.experience,
              heldItemId: null,
            },
            {
              id: 'nobody-1',
              currentHp: 5,
              primaryStatus: 'burn',
              experience: charmander.experience,
              heldItemId: null,
            },
          ],
          // More Potions spent than the vault holds, which can only clear it.
          supplies: [{ itemId: 'potion', quantity: -4 }],
        },
      ),
    ).toBe(true);

    const settled = saves.load();
    expect(settled?.stash.listPokemon()).toMatchObject([
      { id: 'charmander-1', pokemon: { currentHp: charmander.maxHp } },
    ]);
    expect(settled?.stash.listItems()).toEqual({});
  });

  it('never demotes a Pokemon on a stale or replayed settlement', () => {
    // Experience is carried as a total rather than a delta precisely so this is
    // a no-op: banking the same raid twice must not pay its wins out twice, and
    // a settlement written before a level the vault has since banked must not
    // take that level away.
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    const charmander = new Pokemon(CHARMANDER, 7);
    stash.addPokemon(charmander, 'charmander-1');
    saves.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 1, y: 1 }, stash });

    const settlement = {
      condition: [
        { id: 'charmander-1', currentHp: 4, primaryStatus: null, experience: experienceForLevel(8), heldItemId: null },
      ],
      supplies: [],
    } as const;
    expect(saves.bankRun({ pokemon: [], items: [] }, settlement)).toBe(true);
    expect(saves.load()?.stash.listPokemon()[0].pokemon.level).toBe(8);

    // The same settlement again, and then an older one from before the level.
    expect(saves.bankRun({ pokemon: [], items: [] }, settlement)).toBe(true);
    expect(
      saves.bankRun(
        { pokemon: [], items: [] },
        {
          condition: [
            { id: 'charmander-1', currentHp: 4, primaryStatus: null, experience: 0, heldItemId: null },
          ],
          supplies: [],
        },
      ),
    ).toBe(true);

    const settled = saves.load()?.stash.listPokemon()[0].pokemon;
    expect(settled?.level).toBe(8);
    expect(settled?.experience).toBe(experienceForLevel(8));
  });

  it('brings a Pokemon home evolved, whichever way it evolved out there', () => {
    // Two different journeys home. A level evolution needs nothing carried: the
    // experience is replayed through the same `gainExperience` that evolved it
    // in the field, so the vault crosses the same threshold. A stone evolution
    // spends no experience at all, so the species has to travel on its own or
    // the stone would have been spent for nothing.
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(BULBASAUR, 15), 'bulbasaur-1');
    stash.addPokemon(new Pokemon(PIKACHU, 12), 'pikachu-1');
    saves.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 1, y: 1 }, stash });

    const settlement = {
      condition: [
        {
          id: 'bulbasaur-1',
          currentHp: 20,
          primaryStatus: null,
          experience: experienceForLevel(16),
          speciesId: 'ivysaur',
          heldItemId: null,
        },
        {
          id: 'pikachu-1',
          currentHp: 20,
          primaryStatus: null,
          experience: experienceForLevel(12),
          speciesId: 'raichu',
          heldItemId: null,
        },
      ],
      supplies: [],
    } as const;
    expect(saves.bankRun({ pokemon: [], items: [] }, settlement)).toBe(true);

    const banked = saves.load()!.stash.listPokemon();
    expect(banked.map(({ id, pokemon }) => [id, pokemon.base.id, pokemon.level])).toEqual([
      ['bulbasaur-1', 'ivysaur', 16],
      ['pikachu-1', 'raichu', 12],
    ]);
    // And the moves only the pre-evolution ever teaches came home with it.
    expect(banked[0].pokemon.moves.map((move) => move.base.name)).toContain('Super Sonic');
  });

  it('evolves exactly once on a replayed settlement, and never the wrong way', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(PIKACHU, 12), 'pikachu-1');
    saves.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 1, y: 1 }, stash });

    const settlement = {
      condition: [
        {
          id: 'pikachu-1',
          currentHp: 20,
          primaryStatus: null,
          experience: experienceForLevel(12),
          speciesId: 'raichu',
          heldItemId: null,
        },
      ],
      supplies: [],
    } as const;
    saves.bankRun({ pokemon: [], items: [] }, settlement);
    const afterFirst = saves.load()!.stash.listPokemon()[0].pokemon;
    const statsAfterFirst = { ...afterFirst.stats };

    // The same settlement again, and then a stale one from before the stone.
    saves.bankRun({ pokemon: [], items: [] }, settlement);
    saves.bankRun(
      { pokemon: [], items: [] },
      {
        condition: [
          {
            id: 'pikachu-1',
            currentHp: 20,
            primaryStatus: null,
            experience: experienceForLevel(12),
            speciesId: 'pikachu',
            heldItemId: null,
          },
        ],
        supplies: [],
      },
    );

    const settled = saves.load()!.stash.listPokemon()[0].pokemon;
    expect(settled.base.id).toBe('raichu');
    expect(settled.level).toBe(12);
    // Evolving twice would have paid out the stat jump twice over.
    expect(settled.stats).toEqual(statsAfterFirst);
  });

  it('reads a save written before experience was recorded as being at its level, not at zero', () => {
    // Version 1 saves carry a level and no XP. Reading that as zero would make a
    // returning player pay the whole curve again for a level they already had.
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        party: [{ speciesId: 'charmander', level: 7, currentHp: 21, moves: ['Scratch'] }],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        stash: {
          pokemon: [{ speciesId: 'charmander', level: 7, currentHp: 21, moves: ['Scratch'] }],
          items: [],
        },
      }),
    );

    const restored = new SaveManager(storage).load();
    expect(restored?.stash.listPokemon()[0].pokemon.experience).toBe(experienceForLevel(7));
    // One ordinary win is enough to make progress from there, rather than 343.
    expect(restored?.party.pokemon[0].experience).toBe(experienceForLevel(7));
  });

  it('keeps a recovery and the raid time it cost across a reload', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    const charmander = new Pokemon(CHARMANDER, 9);
    charmander.takeDamage(charmander.maxHp - 4);
    charmander.primaryStatus = PrimaryStatus.Poison;
    stash.addPokemon(charmander, 'charmander-1');
    stash.addItem('potion', 2);
    stash.addItem('poke-ball', 5);

    const outcome = applyRecovery(stash, 0, ['charmander-1']);
    expect(outcome.chargedMs).toBeGreaterThan(0);
    expect(
      saves.save({
        party: new PokemonParty([]),
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: new Bag(),
        stash,
        pendingRecoveryMs: outcome.pendingRecoveryMs,
      }),
    ).toBe(true);

    const restored = saves.load();
    expect(restored?.pendingRecoveryMs).toBe(outcome.pendingRecoveryMs);
    expect(restored?.stash.listPokemon()).toMatchObject([
      { id: 'charmander-1', pokemon: { currentHp: charmander.maxHp, primaryStatus: null } },
    ]);
    // Healing is bought with raid time, so a reload must not show new supplies.
    expect(restored?.stash.listItems()).toEqual({ potion: 2, 'poke-ball': 5 });
  });

  it('settles booked recovery time only once the raid it paid for resolves', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'charmander-1');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
      pendingRecoveryMs: MAX_PENDING_RECOVERY_MS,
    });

    // Reloading mid-raid still owes the time, so a shortened raid cannot be
    // abandoned to shed the bill.
    expect(saves.load()?.pendingRecoveryMs).toBe(MAX_PENDING_RECOVERY_MS);

    expect(saves.bankRun({ pokemon: [], items: [{ itemId: 'potion', quantity: 1 }] })).toBe(true);
    expect(saves.load()?.pendingRecoveryMs).toBe(0);
  });

  it('settles booked recovery time on a wipe as well, so the loss is not billed twice', () => {
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
      pendingRecoveryMs: 360_000,
    });

    expect(saves.applyWipeLoss(['lost'], [])).toBe(true);
    expect(saves.load()?.pendingRecoveryMs).toBe(0);
  });

  it('opens a save written before recovery existed with nothing owed', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 5,
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
                currentHp: 4,
                xp: 0,
                moves: ['Tackle'],
                primaryStatus: null,
              },
            },
          ],
          items: { potion: 3 },
        },
        starterSpeciesId: 'bulbasaur',
      }),
    );
    const saves = new SaveManager(storage);

    const restored = saves.load();
    expect(restored?.pendingRecoveryMs).toBe(0);
    // The worn Bulbasaur the old save was stuck with is loaded untouched, ready
    // to be recovered rather than silently healed.
    expect(restored?.stash.listPokemon()).toMatchObject([
      { id: 'bulbasaur-1', pokemon: { currentHp: 4 } },
    ]);
  });

  it('refuses a stored recovery debt that would hand back raid time or exceed the cap', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const write = (pendingRecoveryMs: number): void => {
      const stored = JSON.parse(storage.getItem(SAVE_KEY) ?? '{}') as Record<string, unknown>;
      storage.setItem(SAVE_KEY, JSON.stringify({ ...stored, pendingRecoveryMs }));
    };
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash: new Stash(),
    });

    write(-600_000);
    expect(saves.load()?.pendingRecoveryMs).toBe(0);

    write(MAX_PENDING_RECOVERY_MS * 10);
    expect(saves.load()?.pendingRecoveryMs).toBe(MAX_PENDING_RECOVERY_MS);
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

  it('turns a save that unlocked the retired south-verge insertion into Town Square', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 5,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: {},
        stash: { pokemon: [], items: {} },
        raidProgress: {
          firstContractExtracted: true,
          unlockedInsertions: ['floodplain-relay', 'south-verge', 'route-1'],
        },
      }),
    );

    const restored = new SaveManager(storage).load();

    // The retired id must not survive: nothing can look it up any more.
    expect(restored?.raidProgress.unlockedInsertions).not.toContain('south-verge');
    // Its replacement is unlocked exactly once, even though the contract grants
    // Town Square too, so the hub cannot render the same entry twice.
    expect(
      restored?.raidProgress.unlockedInsertions.filter((id) => id === 'town-square'),
    ).toEqual(['town-square']);
    // Every surviving insertion still resolves to a real one.
    for (const id of restored?.raidProgress.unlockedInsertions ?? []) {
      expect(Object.keys(RUN_INSERTIONS)).toContain(id);
    }
  });

  /**
   * Gates and drop-in points arrived without a version bump: a save that has
   * never heard of them has beaten no boss and reached nowhere, which is what a
   * missing list reads as. Every accepted version is pinned, because accepting
   * a version is a promise to keep loading it.
   */
  it.each([1, 2, 3, 4, 5, 6])(
    'opens a version %i save written before gates existed with no boss beaten and nowhere reached',
    (version) => {
      const storage = new MemoryStorage();
      storage.setItem(
        SAVE_KEY,
        JSON.stringify({
          version,
          party: [],
          mapId: 'pallet-town',
          position: { x: 1, y: 1 },
          bag: {},
          stash: { pokemon: [], items: {} },
          raidProgress: { firstContractExtracted: true, unlockedInsertions: ['route-1'] },
        }),
      );

      const progress = new SaveManager(storage).load()?.raidProgress;

      expect(progress?.defeatedBosses).toEqual([]);
      expect(progress?.reachedInsertions).toEqual([]);
      // What the save did record is untouched by the new fields.
      expect(progress?.firstContractExtracted).toBe(true);
      expect(progress?.unlockedInsertions).toContain('route-1');
    },
  );

  /**
   * The raid record and the survey arrived without a version bump for the same
   * reason the gates did: both default to empty, and empty is the truth about a
   * save that never kept them - a player who has been nowhere. Every accepted
   * version is pinned, because accepting a version is a promise to keep loading
   * it and to honour everything in it.
   */
  it.each([1, 2, 3, 4, 5, 6])(
    'opens a version %i save written before the raid record with nothing recorded',
    (version) => {
      const storage = new MemoryStorage();
      storage.setItem(
        SAVE_KEY,
        JSON.stringify({
          version,
          party: [],
          mapId: 'pallet-town',
          position: { x: 1, y: 1 },
          bag: {},
          stash: { pokemon: [], items: {} },
          raidProgress: { firstContractExtracted: true, unlockedInsertions: ['route-1'] },
        }),
      );

      const progress = new SaveManager(storage).load()?.raidProgress;

      expect(progress?.raidRecord).toEqual({});
      expect(progress?.surveyed).toEqual({});
    },
  );

  it('counts a raid where it was committed to and again where it ended', () => {
    const storage = new MemoryStorage();
    const saves = freshSave(storage);

    expect(saves.recordDeployment('floodplain-relay')).toBe(true);
    expect(saves.load()?.raidProgress.raidRecord).toEqual({
      'floodplain-relay': { deployed: 1, extracted: 0, wiped: 0 },
    });

    expect(saves.recordRaidEnded('floodplain-relay', 'wiped')).toBe(true);
    expect(saves.recordDeployment('floodplain-relay')).toBe(true);
    expect(saves.recordRaidEnded('floodplain-relay', 'extracted')).toBe(true);
    // Another map keeps its own count, and neither touches the other.
    expect(saves.recordDeployment('route-1')).toBe(true);

    expect(saves.load()?.raidProgress.raidRecord).toEqual({
      'floodplain-relay': { deployed: 2, extracted: 1, wiped: 1 },
      'route-1': { deployed: 1, extracted: 0, wiped: 0 },
    });
  });

  it('adds each raid\'s walk to the survey rather than replacing it', () => {
    const storage = new MemoryStorage();
    const saves = freshSave(storage);
    const width = WORLD_MAPS['floodplain-relay'].width;

    saves.recordRaidEnded('floodplain-relay', 'extracted', { width, walked: [0, 1, 2] });
    saves.recordRaidEnded('floodplain-relay', 'wiped', { width, walked: [2, 3, width] });

    const held = saves.load()?.raidProgress.surveyed?.['floodplain-relay'];
    expect([...surveyedTiles(held, width)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, width]);
  });

  it('drops a record for a map that no longer exists, and a survey with no width', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 6,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: {},
        stash: { pokemon: [], items: {} },
        raidProgress: {
          firstContractExtracted: true,
          unlockedInsertions: ['route-1'],
          raidRecord: { 'route-1': { deployed: 2, extracted: -1 }, 'a-place-that-went': { deployed: 9 } },
          surveyed: { 'route-1': { width: 0, tiles: 'AAAA' }, 'pallet-town': { width: 32, tiles: 'AQ==' } },
        },
      }),
    );

    const progress = new SaveManager(storage).load()?.raidProgress;

    expect(progress?.raidRecord).toEqual({ 'route-1': { deployed: 2, extracted: 0, wiped: 0 } });
    expect(Object.keys(progress?.surveyed ?? {})).toEqual(['pallet-town']);
  });

  /**
   * Version 6 is the held-item slot. It is a bump rather than a silent field
   * because a save written by this build carries something no earlier build
   * understands - but the field defaults, so every earlier version keeps loading
   * with an empty slot rather than being refused.
   */
  it.each([1, 2, 3, 4, 5])(
    'opens a version %i save written before held items with every slot empty',
    (version) => {
      const storage = new MemoryStorage();
      const saved = { speciesId: 'bulbasaur', level: 7, currentHp: 9, moves: [], primaryStatus: null };
      storage.setItem(
        SAVE_KEY,
        JSON.stringify({
          version,
          party: [],
          mapId: 'pallet-town',
          position: { x: 1, y: 1 },
          bag: {},
          stash: {
            // Version 1 wrote the vault as bare Pokemon; every later version
            // wraps each in its stash id.
            pokemon: [
              version === 1
                ? saved
                : { id: 'bulbasaur-1', pokemon: saved },
            ],
            items: {},
          },
        }),
      );

      const stored = new SaveManager(storage).load()?.stash.listPokemon() ?? [];

      expect(stored).toHaveLength(1);
      expect(stored[0].pokemon.heldItemId).toBeNull();
    },
  );

  it('keeps what a Pokemon is holding across a save and a reload', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    const bulbasaur = new Pokemon(BULBASAUR, 7);
    stash.addPokemon(bulbasaur);
    stash.addItem('leftovers', 1);
    expect(stash.giveHeldItem('bulbasaur-1', 'leftovers')).toBe(true);
    // A give is a move: the piece is on the Pokemon and out of the supplies.
    expect(stash.itemCount('leftovers')).toBe(0);
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      stash,
    });

    const reloaded = saves.load()!;
    const restored = reloaded.stash.listPokemon()[0];

    expect(restored.pokemon.heldItemId).toBe('leftovers');
    expect(reloaded.stash.itemCount('leftovers')).toBe(0);

    // And taking it back puts it in the supplies, still exactly one of it.
    expect(reloaded.stash.takeHeldItem('bulbasaur-1')).toBe(true);
    expect(reloaded.stash.listPokemon()[0].pokemon.heldItemId).toBeNull();
    expect(reloaded.stash.itemCount('leftovers')).toBe(1);
  });

  it('refuses a held item the catalogue no longer knows rather than storing the name', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 6,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: {},
        stash: {
          pokemon: [
            {
              id: 'bulbasaur-1',
              pokemon: {
                speciesId: 'bulbasaur',
                level: 7,
                currentHp: 9,
                moves: [],
                primaryStatus: null,
                // A Potion is not gear, and `everstone` was never shipped.
                heldItemId: 'potion',
              },
            },
          ],
          items: {},
        },
      }),
    );

    expect(new SaveManager(storage).load()?.stash.listPokemon()[0].pokemon.heldItemId).toBeNull();
  });

  it('carries gear home on a wipe only for the Pokemon the secure slot protected', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    const kept = new Pokemon(BULBASAUR, 7);
    const lost = new Pokemon(CHARMANDER, 7);
    stash.addPokemon(kept);
    stash.addPokemon(lost);
    kept.giveHeldItem('leftovers');
    lost.giveHeldItem('life-orb');
    saves.save({ party: new PokemonParty([]), mapId: 'pallet-town', position: { x: 1, y: 1 }, stash });

    expect(
      saves.applyWipeLoss(
        ['bulbasaur-1', 'charmander-1'],
        [],
        { pokemonIds: ['bulbasaur-1'] },
        [
          { id: 'bulbasaur-1', currentHp: 0, primaryStatus: null, experience: kept.experience, heldItemId: 'leftovers' },
          { id: 'charmander-1', currentHp: 0, primaryStatus: null, experience: lost.experience, heldItemId: 'life-orb' },
        ],
      ),
    ).toBe(true);

    const after = saves.load()!.stash;
    // The secured Pokemon comes home holding what it held; the other is gone,
    // and so is the piece it was carrying. Gear comes off a boss once, so this
    // is the whole of what a wipe can cost that a restock cannot give back.
    expect(after.listPokemon().map((entry) => entry.id)).toEqual(['bulbasaur-1']);
    expect(after.listPokemon()[0].pokemon.heldItemId).toBe('leftovers');
    expect(after.itemCount('life-orb')).toBe(0);
  });

  it('keeps beaten bosses and reached drop-in points across a reload, once each', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 5,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: {},
        stash: { pokemon: [], items: {} },
        raidProgress: {
          firstContractExtracted: false,
          unlockedInsertions: ['floodplain-relay'],
          completedContracts: [],
          defeatedBosses: ['overlook-warden', 'overlook-warden', 7],
          reachedInsertions: ['route-1-overlook', null, 'route-1-overlook'],
        },
      }),
    );

    const manager = new SaveManager(storage);
    const loaded = manager.load()!;
    expect(loaded.raidProgress.defeatedBosses).toEqual(['overlook-warden']);
    expect(loaded.raidProgress.reachedInsertions).toEqual(['route-1-overlook']);

    // And it survives being written back, which is what every banking path does.
    manager.save(loaded);
    expect(manager.load()!.raidProgress).toEqual(loaded.raidProgress);
  });

  it('records a boss win the moment it happens, exactly once, and touches nothing else', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 12));
    stash.addItem('potion', 3);
    manager.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      stash,
      pendingRecoveryMs: 30_000,
    });
    const before = manager.load()!;

    expect(manager.recordDefeatedBosses(['overlook-warden'])).toEqual(['overlook-warden']);
    // The world scene reports the same win again on every later battle return.
    expect(manager.recordDefeatedBosses(['overlook-warden'])).toEqual([]);
    expect(manager.recordDefeatedBosses([])).toEqual([]);

    const after = manager.load()!;
    expect(after.raidProgress).toEqual({
      ...before.raidProgress,
      defeatedBosses: ['overlook-warden'],
    });
    // A gate opening is not a raid settling: the vault in storage is still the
    // pre-raid vault, and the recovery bill is still owed.
    expect(after.stash.listPokemon().map((stored) => stored.pokemon.level)).toEqual([12]);
    expect(after.stash.itemCount('potion')).toBe(3);
    expect(after.pendingRecoveryMs).toBe(30_000);
  });

  it('records a reached drop-in point once, and never one the lobby already offers', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    manager.save({ party: new PokemonParty([]), mapId: 'pallet-town', position: { x: 1, y: 1 } });

    expect(manager.recordReachedInsertion('route-1-overlook')).toBe(true);
    expect(manager.recordReachedInsertion('route-1-overlook')).toBe(false);
    // Already unlocked from the first second of the save, so reaching it is not news.
    expect(manager.recordReachedInsertion('floodplain-relay')).toBe(false);

    expect(manager.load()!.raidProgress.reachedInsertions).toEqual(['route-1-overlook']);
  });

  it('keeps an opened gate and a reached landing through a wipe and a banked contract', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 8));
    manager.save({ party: new PokemonParty([]), mapId: 'pallet-town', position: { x: 1, y: 1 }, stash });
    manager.recordDefeatedBosses(['overlook-warden']);
    manager.recordReachedInsertion('route-1-overlook');

    manager.applyWipeLoss([manager.load()!.stash.listPokemon()[0].id], []);
    manager.bankFirstContractRun({ pokemon: [], items: [] });

    const progress = manager.load()!.raidProgress;
    expect(progress.defeatedBosses).toEqual(['overlook-warden']);
    expect(progress.reachedInsertions).toEqual(['route-1-overlook']);
    expect(progress.firstContractExtracted).toBe(true);
  });

  it('cannot record progress where nothing can be stored, and says so', () => {
    const manager = new SaveManager(null);
    expect(manager.recordDefeatedBosses(['overlook-warden'])).toEqual([]);
    expect(manager.recordReachedInsertion('route-1-overlook')).toBe(false);
  });

  /** A vault that can afford the first locker: a partner, three catches, spare kit. */
  function outfittedSave(storage: MemoryStorage, completedContracts: readonly string[] = []): SaveManager {
    const saves = new SaveManager(storage);
    const stash = new Stash({
      items: {
        'poke-ball': 9,
        potion: 7,
        'super-potion': 4,
        'great-ball': 5,
        antidote: 3,
        'radio-valve': 2,
        'mooring-rope': 3,
        'parts-crate': 4,
      },
    });
    stash.addPokemon(new Pokemon(CHARMANDER, 9), 'partner');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    stash.addPokemon(new Pokemon(PIDGEY, 5), 'pidgey-2');
    stash.addPokemon(new Pokemon(BULBASAUR, 6), 'bulbasaur-1');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
      raidProgress: {
        firstContractExtracted: completedContracts.length > 0,
        unlockedInsertions: ['floodplain-relay'],
        completedContracts: [...completedContracts],
        outfitterUpgrades: [],
        defeatedBosses: [],
        reachedInsertions: [],
        standingContractsBanked: 0,
        giftsReceived: [],
      },
    });
    return saves;
  }

  /** A save that stands high enough with the Ferryman to be sold anything. */
  function counterSave(storage: MemoryStorage, scrip = 1_000): SaveManager {
    const saves = outfittedSave(storage);
    const game = saves.load()!;
    game.stash.addItem('scrip', scrip);
    game.stash.addItem('cable-coil', 2);
    game.stash.addItem('lamp-oil', 2);
    saves.save({
      ...game,
      raidProgress: {
        ...game.raidProgress,
        completedContracts: ['recover-lost-field-kit', 'survey-the-braid'],
        defeatedBosses: ['floodplain-toll-keeper', 'floodplain-sluice-keeper'],
      },
    });
    return saves;
  }

  it('sells one thing off the shelf, takes the money and spends the ration', () => {
    const storage = new MemoryStorage();
    const saves = counterSave(storage);
    const before = saves.load()!.stash;
    const potions = before.itemCount('potion');

    expect(saves.buyTraderStock('potion')).toMatchObject({ ok: true, saved: true });

    const after = saves.load()!;
    expect(after.stash.itemCount('potion')).toBe(potions + 1);
    expect(after.stash.itemCount('scrip')).toBe(1_000 - 120);
    // Turnover, which is the only thing standing is bought with.
    expect(after.raidProgress.traderScripSpent).toBe(120);
    expect(after.traderRationUsed).toBe(1);
  });

  it('buys several in one deal, charging money and ration for every one', () => {
    const storage = new MemoryStorage();
    const saves = counterSave(storage);
    // A trusted-or-better standing, whose ration is more than one a trip.
    const seeded = saves.load()!;
    saves.save({
      ...seeded,
      raidProgress: {
        ...seeded.raidProgress,
        completedContracts: [...seeded.raidProgress.completedContracts, 'cordon-ledger', 'wardens-resupply'],
        defeatedBosses: [...seeded.raidProgress.defeatedBosses, 'floodplain-orchard-warden'],
      },
    });
    const potions = saves.load()!.stash.itemCount('potion');
    const ration = saves.load()!.traderRationUsed;

    const bought = saves.buyTraderStock('potion', 2);
    expect(bought.message).toBe('Bought 2 for 240 scrip.');

    const after = saves.load()!;
    expect(after.stash.itemCount('potion')).toBe(potions + 2);
    expect(after.stash.itemCount('scrip')).toBe(1_000 - 240);
    expect(after.raidProgress.traderScripSpent).toBe(240);
    expect(after.traderRationUsed).toBe(ration + 2);
    // More than the ration allows is refused whole, and costs nothing.
    const refused = saves.buyTraderStock('potion', 99);
    expect(refused.ok).toBe(false);
    expect(saves.load()!.stash.itemCount('scrip')).toBe(1_000 - 240);
  });

  it('refuses a second purchase on a one-a-trip ration, and costs nothing for refusing', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const seeded = counterSave(storage);
    const game = seeded.load()!;
    // Two contracts and one boss is seven points - a regular, and a regular's
    // ration is one thing a trip however much money is on the table.
    seeded.save({
      ...game,
      raidProgress: { ...game.raidProgress, defeatedBosses: ['floodplain-toll-keeper'] },
    });

    expect(saves.buyTraderStock('potion')).toMatchObject({ ok: true });
    const held = saves.load()!.stash.itemCount('scrip');
    const refused = saves.buyTraderStock('potion');
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain('trip');
    expect(saves.load()!.stash.itemCount('scrip')).toBe(held);
  });

  it('hands the ration back only once the raid it was spent before has resolved', () => {
    const storage = new MemoryStorage();
    const saves = counterSave(storage);
    expect(saves.buyTraderStock('potion')).toMatchObject({ ok: true });

    // A reload is not a resolution, exactly as with the ward's bed.
    expect(new SaveManager(storage).load()?.traderRationUsed).toBe(1);
    expect(saves.bankRun({ pokemon: [], items: [] })).toBe(true);
    expect(saves.load()?.traderRationUsed).toBe(0);
  });

  it('barters found goods for gear without touching the money, and only once', () => {
    const storage = new MemoryStorage();
    const saves = counterSave(storage);
    const before = saves.load()!.stash;
    const crates = before.itemCount('parts-crate');
    const coils = before.itemCount('cable-coil');

    expect(saves.takeTraderBarter('barter-quick-claw')).toMatchObject({ ok: true });

    const after = saves.load()!;
    expect(after.stash.itemCount('quick-claw')).toBe(1);
    expect(after.stash.itemCount('parts-crate')).toBe(crates - 2);
    expect(after.stash.itemCount('cable-coil')).toBe(coils - 1);
    // Not a penny: these are the things the captain's ruling puts beyond money,
    // so a barter can never raise standing either.
    expect(after.stash.itemCount('scrip')).toBe(1_000);
    expect(after.raidProgress.traderScripSpent).toBe(0);
    expect(after.raidProgress.traderBarters).toEqual(['barter-quick-claw']);

    expect(saves.takeTraderBarter('barter-quick-claw').ok).toBe(false);
    expect(saves.load()!.stash.itemCount('quick-claw')).toBe(1);
  });

  it('rents a berth that protects one more stack, and only for that raid', () => {
    const storage = new MemoryStorage();
    const saves = counterSave(storage);
    expect(saves.buyTraderBerth()).toMatchObject({ ok: true });
    expect(saves.load()!.traderBerthPaid).toBe(true);
    expect(saves.load()!.stash.itemCount('scrip')).toBe(1_000 - 250);

    // Three stacks come home instead of the two a fresh save protects.
    const brought = [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 2 },
      { itemId: 'antidote', quantity: 1 },
    ];
    const held = saves.load()!.stash.listItems();
    expect(saves.applyWipeLoss(['bulbasaur-1'], brought, { items: brought })).toBe(true);
    const after = saves.load()!;
    for (const { itemId } of brought) {
      expect(after.stash.itemCount(itemId)).toBe(held[itemId]);
    }
    // And the berth is gone with the raid, paid for or not.
    expect(after.traderBerthPaid).toBe(false);
  });

  it('loses found money on a wipe, and keeps it when the slot names it', () => {
    const lost = (secured: boolean): number => {
      const storage = new MemoryStorage();
      const saves = counterSave(storage, 40);
      // 120 scrip found in the field, in a pack that also held a Potion.
      return saves.applyWipeLoss(
        ['bulbasaur-1'],
        [{ itemId: 'potion', quantity: 1 }],
        secured ? { items: [{ itemId: 'scrip', quantity: 120 }] } : {},
      )
        ? saves.load()!.stash.itemCount('scrip')
        : -1;
    };

    // Money in the pack is money a wipe takes: the 40 already banked is all
    // that is left. Named in the slot, the whole find comes home.
    expect(lost(false)).toBe(40);
    expect(lost(true)).toBe(40 + 120);
  });

  it.each([1, 2, 3, 4, 5])(
    'opens a version %i save written before the Outfitter with nothing built and no ward bed used',
    (version) => {
      const storage = new MemoryStorage();
      storage.setItem(
        SAVE_KEY,
        JSON.stringify({
          version,
          party: [],
          mapId: 'pallet-town',
          position: { x: 1, y: 1 },
          items: [],
          bag: {},
          stash: { pokemon: [], items: version === 1 ? [] : {} },
          raidProgress: { firstContractExtracted: true, unlockedInsertions: ['floodplain-relay'] },
        }),
      );

      const restored = new SaveManager(storage).load();
      expect(restored).not.toBeNull();
      expect(restored?.raidProgress.outfitterUpgrades).toEqual([]);
      expect(restored?.wardTreatmentsUsed).toBe(0);
    },
  );

  it('keeps only upgrades the ladder knows, once each, however the save lists them', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 5,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: {},
        stash: { pokemon: [], items: {} },
        raidProgress: {
          outfitterUpgrades: ['secure-locker-1', 'secure-locker-1', 'gear-tier-9', 7, 'beacon'],
          defeatedBosses: [],
          reachedInsertions: [],
        },
        wardTreatmentsUsed: -3,
      }),
    );

    const restored = new SaveManager(storage).load();
    expect(restored?.raidProgress.outfitterUpgrades).toEqual(['secure-locker-1', 'beacon']);
    expect(restored?.wardTreatmentsUsed).toBe(0);
  });

  it('builds an upgrade out of the named Pokemon and spare supplies, and keeps it across a reload', () => {
    const storage = new MemoryStorage();
    const saves = outfittedSave(storage);

    const built = saves.buildOutfitterUpgrade('secure-locker-1', ['pidgey-1', 'pidgey-2']);
    expect(built).toMatchObject({ ok: true, saved: true });

    // A second manager over the same storage is a page reload.
    const reloaded = new SaveManager(storage).load();
    expect(reloaded?.raidProgress.outfitterUpgrades).toEqual(['secure-locker-1']);
    expect(reloaded?.stash.listPokemon().map(({ id }) => id)).toEqual(['partner', 'bulbasaur-1']);
    // Two parts crates are spent; the raid's own kit is not touched.
    expect(reloaded?.stash.itemCount('parts-crate')).toBe(2);
    expect(reloaded?.stash.itemCount('poke-ball')).toBe(9);
    expect(reloaded?.stash.itemCount('potion')).toBe(7);
  });

  it('charges nothing for a refused build, and never builds the same upgrade twice', () => {
    const storage = new MemoryStorage();
    const saves = outfittedSave(storage);
    const before = storage.getItem(SAVE_KEY);

    expect(saves.buildOutfitterUpgrade('secure-locker-1', ['partner', 'pidgey-1'])).toMatchObject({
      ok: false,
      refusal: 'pokemon-not-spendable',
      saved: false,
    });
    expect(saves.buildOutfitterUpgrade('secure-locker-2', ['pidgey-1'])).toMatchObject({ ok: false });
    expect(storage.getItem(SAVE_KEY)).toBe(before);

    expect(saves.buildOutfitterUpgrade('radio-mast', ['pidgey-1'])).toMatchObject({ ok: true });
    expect(saves.buildOutfitterUpgrade('radio-mast', ['pidgey-2'])).toMatchObject({
      ok: false,
      refusal: 'already-built',
    });
    expect(saves.load()?.stash.listPokemon().map(({ id }) => id)).toContain('pidgey-2');
  });

  it('cannot spend the only Pokemon a player has', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash({ items: { antidote: 9, 'poke-ball': 9, potion: 9 } });
    stash.addPokemon(new Pokemon(PIDGEY, 12), 'only');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
    });

    expect(saves.buildOutfitterUpgrade('radio-mast', ['only'])).toMatchObject({ ok: false, saved: false });
    expect(saves.load()?.stash.listPokemon()).toHaveLength(1);
    expect(saves.load()?.raidProgress.outfitterUpgrades).toEqual([]);
  });

  it('never takes the kit a wipe would hand straight back', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash({ items: { 'poke-ball': 5, potion: 3, antidote: 9, 'parts-crate': 2 } });
    stash.addPokemon(new Pokemon(CHARMANDER, 9), 'partner');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-2');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
    });

    // Materials are the whole price, so the kit is never in reach of it.
    expect(saves.buildOutfitterUpgrade('secure-locker-1', ['pidgey-1', 'pidgey-2'])).toMatchObject({ ok: true });
    expect(saves.load()!.stash.supplyShortfall()).toEqual({});
    expect(saves.load()!.stash.itemCount('poke-ball')).toBe(5);
    expect(saves.load()!.stash.itemCount('potion')).toBe(3);
  });

  it('brings home only the materials a wipe was told were secured', () => {
    const storage = new MemoryStorage();
    const saves = outfittedSave(storage);
    const before = saves.load()!.stash.itemCount('radio-valve');

    // Two valves were found and one rope; only the valve's kind was secured.
    // The caller has already cut the slot to what was still in the pack.
    expect(
      saves.applyWipeLoss(['bulbasaur-1'], [{ itemId: 'potion', quantity: 1 }], {
        items: [{ itemId: 'radio-valve', quantity: 2 }],
      }),
    ).toBe(true);

    const after = saves.load()!.stash;
    expect(after.itemCount('radio-valve')).toBe(before + 2);
    expect(after.itemCount('mooring-rope')).toBe(3);
  });

  it('brings every stack the save protects home from a wipe, not just the first two', () => {
    const storage = new MemoryStorage();
    const saves = outfittedSave(storage, [
      'recover-lost-field-kit',
      'survey-the-braid',
      'cordon-ledger',
    ]);
    expect(saves.buildOutfitterUpgrade('secure-locker-1', ['pidgey-1', 'pidgey-2'])).toMatchObject({ ok: true });
    const held = saves.load()!.stash.listItems();

    // The ledger's stack and the locker's stack: four protected, one at risk.
    const brought = [
      { itemId: 'poke-ball', quantity: 2 },
      { itemId: 'potion', quantity: 2 },
      { itemId: 'super-potion', quantity: 1 },
      { itemId: 'great-ball', quantity: 1 },
      { itemId: 'antidote', quantity: 1 },
    ];
    expect(saves.applyWipeLoss(['bulbasaur-1'], brought, { items: brought.slice(0, 4) })).toBe(true);

    const after = saves.load()!.stash;
    for (const { itemId } of brought.slice(0, 4)) {
      expect(after.itemCount(itemId)).toBe(held[itemId]);
    }
    expect(after.itemCount('antidote')).toBe(held.antidote - 1);
  });

  it('brings a second secured Pokemon home from a wipe only once the second locker is built', () => {
    const wipe = (upgrades: readonly string[]): readonly string[] => {
      const storage = new MemoryStorage();
      const saves = outfittedSave(storage);
      const game = saves.load()!;
      saves.save({ ...game, raidProgress: { ...game.raidProgress, outfitterUpgrades: upgrades } });
      saves.applyWipeLoss(['partner', 'pidgey-1', 'pidgey-2'], [], {
        pokemonIds: ['partner', 'pidgey-1'],
      });
      return saves.load()!.stash.listPokemon().map(({ id }) => id);
    };

    expect(wipe([])).toEqual(['partner', 'bulbasaur-1']);
    expect(wipe(['secure-locker-1', 'secure-locker-2'])).toEqual(['partner', 'pidgey-1', 'bulbasaur-1']);
  });

  it('hands the ward bed back only once the raid it was used before has resolved', () => {
    const storage = new MemoryStorage();
    const saves = outfittedSave(storage);
    saves.save({ ...saves.load()!, wardTreatmentsUsed: 1, pendingRecoveryMs: 35_000 });

    // A reload is not a resolution.
    expect(new SaveManager(storage).load()?.wardTreatmentsUsed).toBe(1);
    expect(saves.bankRun({ pokemon: [], items: [] })).toBe(true);
    expect(saves.load()?.wardTreatmentsUsed).toBe(0);

    saves.save({ ...saves.load()!, wardTreatmentsUsed: 1 });
    expect(saves.applyWipeLoss(['pidgey-1'], [])).toBe(true);
    expect(saves.load()?.wardTreatmentsUsed).toBe(0);
  });

  /**
   * Playtest 3, B6a: after a lost first raid, the second raid's first grass
   * step replayed all three teaching lines. The fight may repeat while the
   * contract is open; the lesson is owed once per save, and a wipe - which
   * rewrites the save - must not forget it was given.
   */
  it('owes the battle lesson once per save, across a lost raid', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(SQUIRTLE, 5), 'starter');
    saves.save({
      party: new PokemonParty([]),
      mapId: 'floodplain-relay',
      position: { x: 1, y: 1 },
      stash,
      starterSpeciesId: 'squirtle',
    });

    expect(saves.claimBattleLesson()).toBe(true);
    expect(saves.claimBattleLesson()).toBe(false);

    expect(saves.applyWipeLoss(['starter'], [], {}, [])).toBe(true);
    expect(new SaveManager(storage).claimBattleLesson()).toBe(false);
    // Banking a contract rebuilds the progress record, and must carry it too.
    expect(saves.bankFirstContractRun({ pokemon: [], items: [] }).granted).toBe(true);
    expect(saves.load()?.raidProgress.battleLessonGiven).toBe(true);
  });

  it('gives the lesson when there is no save to remember it in', () => {
    expect(new SaveManager(new MemoryStorage()).claimBattleLesson()).toBe(true);
  });

  /**
   * The secure container fills itself from what it held last raid. The field is
   * optional with a default, so every accepted version keeps loading - and the
   * default is the policy anyway, which is why there is no version bump.
   */
  describe('what the secure container remembers', () => {
    const saveWithPreference = (version: number, securePreference?: unknown): string =>
      JSON.stringify({
        version,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: {},
        stash: { pokemon: [], items: {} },
        ...(securePreference === undefined ? {} : { raidProgress: { securePreference } }),
      });

    it.each([1, 2, 3, 4, 5, 6])(
      'reads a version %i save that never wrote one as "lead with the Pokemon"',
      (version) => {
        const storage = new MemoryStorage();
        storage.setItem(SAVE_KEY, saveWithPreference(version));

        expect(new SaveManager(storage).load()?.raidProgress.securePreference).toEqual({
          pokemon: true,
          items: [],
        });
      },
    );

    it('carries a written preference back out of storage, entry by entry', () => {
      const storage = new MemoryStorage();
      storage.setItem(
        SAVE_KEY,
        saveWithPreference(6, { pokemon: false, items: [{ itemId: 'potion', quantity: 3 }] }),
      );

      expect(new SaveManager(storage).load()?.raidProgress.securePreference).toEqual({
        pokemon: false,
        items: [{ itemId: 'potion', quantity: 3 }],
      });
    });

    it('records what a deploy left in the container, and survives the reload', () => {
      const storage = new MemoryStorage();
      const saves = new SaveManager(storage);
      const stash = new Stash();
      stash.addPokemon(new Pokemon(CHARMANDER, 5), 'partner');
      saves.save({
        party: new PokemonParty([]),
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: new Bag(),
        stash,
      });

      expect(
        saves.recordSecurePreference({
          pokemon: false,
          items: [{ itemId: 'super-potion', quantity: 1 }],
        }),
      ).toBe(true);

      expect(new SaveManager(storage).load()?.raidProgress.securePreference).toEqual({
        pokemon: false,
        items: [{ itemId: 'super-potion', quantity: 1 }],
      });
    });
  });

  describe('storage boxes', () => {
    const oldSave = (version: number): string =>
      JSON.stringify({
        version,
        party: [],
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        items: [],
        bag: {},
        stash: {
          pokemon: [
            { id: 'charmander-1', pokemon: { speciesId: 'charmander', level: 5, currentHp: 12, xp: 125, moves: ['Scratch'], primaryStatus: null } },
            { id: 'pidgey-1', pokemon: { speciesId: 'pidgey', level: 4, currentHp: 12, xp: 64, moves: ['Tackle'], primaryStatus: null } },
          ],
          items: {},
        },
      });

    it.each([2, 3, 4, 5, 6])('puts a version %i stash, which has no boxes, in box one', (version) => {
      const storage = new MemoryStorage();
      storage.setItem(SAVE_KEY, oldSave(version));

      const restored = new SaveManager(storage).load();

      expect(restored?.stash.listBoxes()).toEqual([
        { name: 'Box 1', pokemonIds: ['charmander-1', 'pidgey-1'] },
      ]);
      expect(restored?.stash.listPokemon().map(({ id }) => id)).toEqual(['charmander-1', 'pidgey-1']);
    });

    it('keeps boxes, their names and who is in them across a reload', () => {
      const storage = new MemoryStorage();
      const saves = new SaveManager(storage);
      const stash = new Stash();
      stash.addPokemon(new Pokemon(CHARMANDER, 5), 'partner');
      stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
      const second = stash.addBox();
      expect(stash.renameBox(second, 'Birds')).toBe(true);
      expect(stash.movePokemon('pidgey-1', second)).toBe(true);
      saves.save({
        party: new PokemonParty([]),
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: new Bag(),
        stash,
        starterSpeciesId: 'charmander',
      });

      const reloaded = new SaveManager(storage).load();

      expect(reloaded?.stash.listBoxes()).toEqual([
        { name: 'Box 1', pokemonIds: ['partner'] },
        { name: 'Birds', pokemonIds: ['pidgey-1'] },
      ]);
    });

    it('repairs boxes a save contradicts: unknown ids dropped, the unboxed put away', () => {
      const storage = new MemoryStorage();
      const save = JSON.parse(oldSave(6)) as { stash: { boxes?: unknown } };
      save.stash.boxes = [{ name: 'Mine', pokemonIds: ['pidgey-1', 'ghost', 'pidgey-1'] }, 'nonsense'];
      storage.setItem(SAVE_KEY, JSON.stringify(save));

      const restored = new SaveManager(storage).load();

      expect(restored?.stash.listBoxes()).toEqual([
        { name: 'Mine', pokemonIds: ['pidgey-1', 'charmander-1'] },
      ]);
    });

    it('pays the Outfitter with a Pokemon kept in a later box, and forgets the box it left', () => {
      const storage = new MemoryStorage();
      const saves = outfittedSave(storage);
      const loaded = saves.load()!;
      const second = loaded.stash.addBox();
      loaded.stash.movePokemon('pidgey-1', second);
      loaded.stash.movePokemon('pidgey-2', second);
      saves.save({ ...loaded, stash: loaded.stash });

      const built = saves.buildOutfitterUpgrade('secure-locker-1', ['pidgey-1', 'pidgey-2']);
      expect(built).toMatchObject({ ok: true, saved: true });

      const reloaded = new SaveManager(storage).load();
      expect(reloaded?.stash.listBoxes()[1].pokemonIds).toEqual([]);
      expect(reloaded?.stash.listPokemon().map(({ id }) => id)).toEqual(['partner', 'bulbasaur-1']);
    });

    it('banks a raid into a new box once every box is full', () => {
      const storage = new MemoryStorage();
      const saves = new SaveManager(storage);
      const stash = new Stash();
      for (let index = 0; index < 30; index += 1) {
        stash.addPokemon(new Pokemon(PIDGEY, 3), `pidgey-${index}`);
      }
      saves.save({
        party: new PokemonParty([]),
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: new Bag(),
        stash,
        starterSpeciesId: 'charmander',
      });

      saves.bankFirstContractRun({ pokemon: [new Pokemon(PIDGEY, 3)], items: [] });

      const boxes = saves.load()!.stash.listBoxes();
      expect(boxes.map((box) => box.pokemonIds.length)).toEqual([30, 1]);
    });
  });
});
