import { describe, expect, it } from 'vitest';
import {
  Pokemon,
  PokemonParty,
  CHARMANDER,
  PIDGEY,
  SQUIRTLE,
  experienceForLevel,
} from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { Bag } from '../items';
import { SAVE_KEY, SaveManager } from './SaveManager';
import { applyRecovery, MAX_PENDING_RECOVERY_MS } from '../hub/recovery';
import { Stash } from '../stash';
import { RUN_INSERTIONS } from '../run/runGeneration';

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
    expect(restored?.stash.toJSON()).toEqual({ pokemon: [], items: {} });
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
    // The swap is a recovery path, so it also restores the Poke Balls this
    // legacy save had none of; the 3 kept Potions are already at the minimum.
    expect(swapped?.stash.listItems()).toEqual({ potion: 3, 'poke-ball': 5 });

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
            { id: 'charmander-1', currentHp: 6, primaryStatus: 'burn', experience: 400 },
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
            },
            {
              id: 'nobody-1',
              currentHp: 5,
              primaryStatus: 'burn',
              experience: charmander.experience,
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
        { id: 'charmander-1', currentHp: 4, primaryStatus: null, experience: experienceForLevel(8) },
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
            { id: 'charmander-1', currentHp: 4, primaryStatus: null, experience: 0 },
          ],
          supplies: [],
        },
      ),
    ).toBe(true);

    const settled = saves.load()?.stash.listPokemon()[0].pokemon;
    expect(settled?.level).toBe(8);
    expect(settled?.experience).toBe(experienceForLevel(8));
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
});
