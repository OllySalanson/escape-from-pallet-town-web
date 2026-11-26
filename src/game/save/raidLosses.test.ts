import { describe, expect, it } from 'vitest';

import { Bag, STARTING_PACK_ID } from '../items';
import { PIDGEOTTO, PIKACHU, Pokemon, PokemonParty, SPECIES_BY_ID, SQUIRTLE } from '../pokemon';
import { createRaidInFlight } from '../run/raidInFlight';
import { RAIDS_LOGGED } from '../run/raidLog';
import { Stash } from '../stash';
import { SaveManager } from './SaveManager';

/**
 * Every way a raid's ending takes a Pokemon out of the vault, played on a save
 * shaped like the one a player lost a Pidgey and a Magikarp from without
 * knowing how (Olly, 25 Nov 2026): Squirtle the partner, Pikachu, Drowzee, and
 * the two catches. Whatever the ending, nobody who stayed at base may go, and
 * the raid log says who went in, who came home and who did not.
 */

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

const VAULT = ['squirtle-1', 'pikachu-1', 'drowzee-1', 'pidgey-1', 'magikarp-1'];

function olliesSave(): { storage: MemoryStorage; saves: SaveManager } {
  const storage = new MemoryStorage();
  const stash = new Stash();
  stash.addPokemon(new Pokemon(SQUIRTLE, 9), 'squirtle-1');
  stash.addPokemon(new Pokemon(PIKACHU, 9), 'pikachu-1');
  stash.addPokemon(new Pokemon(SPECIES_BY_ID.drowzee, 4), 'drowzee-1');
  stash.addPokemon(new Pokemon(SPECIES_BY_ID.pidgey, 6), 'pidgey-1');
  stash.addPokemon(new Pokemon(SPECIES_BY_ID.magikarp, 5), 'magikarp-1');
  stash.adoptPartner('squirtle-1');
  stash.addItem('potion', 3);
  stash.addItem('poke-ball', 5);
  stash.ensureAPack();
  const saves = new SaveManager(storage);
  saves.save({ party: new PokemonParty(), mapId: 'greystone-vale', position: { x: 1, y: 1 }, bag: new Bag(), stash, starterSpeciesId: 'squirtle' });
  return { storage, saves };
}

/** Deploys the named Pokemon with two Potions and three balls, Pikachu's place in the container its own. */
function deploy(saves: SaveManager, pokemonIds: readonly string[]): string {
  const raid = {
    ...createRaidInFlight(
      'greystone-vale',
      [{ itemId: 'potion', quantity: 2 }, { itemId: 'poke-ball', quantity: 3 }],
      [],
      STARTING_PACK_ID,
      pokemonIds,
    ),
    insertionId: 'vale-front-door',
  };
  expect(saves.recordRaidInFlight(raid)).toBe(true);
  return raid.id;
}

const vaultIds = (storage: MemoryStorage): string[] =>
  new SaveManager(storage).load()!.stash.listPokemon().map(({ id }) => id).sort();

const lastLog = (storage: MemoryStorage) => new SaveManager(storage).load()!.raidProgress.raidLog!.at(-1)!;

const ids = (pokemon: readonly { readonly id: string }[]): string[] => pokemon.map(({ id }) => id).sort();

describe('a raid lost to the clock', () => {
  it('takes only the unprotected Pokemon that went, and logs them as lost to the clock', () => {
    const { storage, saves } = olliesSave();
    const raidId = deploy(saves, ['squirtle-1', 'pikachu-1', 'pidgey-1', 'magikarp-1']);

    const settled = saves.settleWipe(
      ['squirtle-1', 'pikachu-1', 'pidgey-1', 'magikarp-1'],
      [{ itemId: 'potion', quantity: 2 }, { itemId: 'poke-ball', quantity: 3 }],
      { pokemonIds: ['pikachu-1'] },
      [],
      STARTING_PACK_ID,
      raidId,
      'clock',
      300_000,
    );

    expect(settled.saved).toBe(true);
    // Pidgey and Magikarp went down with the raid; Drowzee never left base.
    expect(vaultIds(storage)).toEqual(['drowzee-1', 'pikachu-1', 'squirtle-1']);
    const entry = lastLog(storage);
    expect(entry).toMatchObject({ mapId: 'greystone-vale', insertionId: 'vale-front-door', ending: 'clock', elapsedMs: 300_000 });
    expect(ids(entry.took.pokemon)).toEqual(['magikarp-1', 'pidgey-1', 'pikachu-1', 'squirtle-1']);
    expect(ids(entry.home.pokemon)).toEqual(['pikachu-1', 'squirtle-1']);
    expect(entry.lost.pokemon).toEqual([
      { id: 'pidgey-1', species: 'pidgey', level: 6 },
      { id: 'magikarp-1', species: 'magikarp', level: 5 },
    ]);
    expect(entry.lost.items).toEqual({ potion: 2, 'poke-ball': 3 });
    expect(entry.lost.pack).toBe(STARTING_PACK_ID);
    // The fresh kit Oak puts back is not something the raid brought home.
    expect(entry.home.items).toEqual({});
  });

  it('leaves every Pokemon that stayed at base where it was', () => {
    const { storage, saves } = olliesSave();
    const raidId = deploy(saves, ['squirtle-1', 'pikachu-1']);

    saves.settleWipe(['squirtle-1', 'pikachu-1'], [], {}, [], STARTING_PACK_ID, raidId, 'clock');

    expect(vaultIds(storage)).toEqual(['drowzee-1', 'magikarp-1', 'pidgey-1', 'squirtle-1']);
    expect(ids(lastLog(storage).lost.pokemon)).toEqual(['pikachu-1']);
  });
});

describe('a raid lost in a fight', () => {
  it('takes the same Pokemon a clock would, and logs the faint as the cause', () => {
    const { storage, saves } = olliesSave();
    const raidId = deploy(saves, ['squirtle-1', 'pidgey-1']);

    saves.settleWipe(['squirtle-1', 'pidgey-1'], [], {}, [], STARTING_PACK_ID, raidId);

    expect(vaultIds(storage)).toEqual(['drowzee-1', 'magikarp-1', 'pikachu-1', 'squirtle-1']);
    expect(lastLog(storage).ending).toBe('fainted');
  });
});

describe('a raid walked away from', () => {
  it('brings the whole team home and loses the pack, and says so', () => {
    const { storage, saves } = olliesSave();
    deploy(saves, ['squirtle-1', 'pidgey-1', 'magikarp-1']);

    expect(saves.settleAbandonedRaid()).not.toBeNull();

    expect(vaultIds(storage)).toEqual([...VAULT].sort());
    const entry = lastLog(storage);
    expect(entry.ending).toBe('walked-away');
    expect(entry.lost.pokemon).toEqual([]);
    expect(entry.lost.items).toEqual({ potion: 2, 'poke-ball': 3 });
    expect(ids(entry.home.pokemon)).toEqual(['magikarp-1', 'pidgey-1', 'squirtle-1']);
  });

  it('is settled the same after a reload handed the raid to a new page', () => {
    const { storage, saves } = olliesSave();
    const raidId = deploy(saves, ['squirtle-1', 'pidgey-1']);
    expect(saves.handOverRaidInFlight(raidId, `${raidId}~2`)).toBe(true);

    saves.settleWipe(['squirtle-1', 'pidgey-1'], [], {}, [], STARTING_PACK_ID, `${raidId}~2`, 'clock');

    expect(vaultIds(storage)).toEqual(['drowzee-1', 'magikarp-1', 'pikachu-1', 'squirtle-1']);
    expect(ids(lastLog(storage).lost.pokemon)).toEqual(['pidgey-1']);
  });
});

describe('a raid that got home', () => {
  it('loses nobody, banks the catch, and logs an evolution as the same Pokemon', () => {
    const { storage, saves } = olliesSave();
    const raidId = deploy(saves, ['squirtle-1', 'pidgey-1']);
    const pidgeot = new Pokemon(PIDGEOTTO, 18);

    const banked = saves.bankRun(
      { pokemon: [new Pokemon(SPECIES_BY_ID.rattata, 3)], items: [] },
      {
        condition: [{ id: 'pidgey-1', currentHp: 20, primaryStatus: null, speciesId: 'pidgeotto', experience: pidgeot.experience, heldItemId: null }],
        supplies: [{ itemId: 'potion', quantity: -1 }, { itemId: 'parts-crate', quantity: 1 }],
      },
      120_000,
      raidId,
    );

    expect(banked).toBe(true);
    expect(vaultIds(storage)).toEqual([...VAULT, 'rattata-1'].sort());
    const entry = lastLog(storage);
    expect(entry.ending).toBe('out');
    expect(entry.lost).toEqual({ pokemon: [], items: {} });
    expect(entry.home.pokemon).toEqual([
      { id: 'squirtle-1', species: 'squirtle', level: 9 },
      { id: 'pidgey-1', species: 'pidgeotto', level: 18 },
      { id: 'rattata-1', species: 'rattata', level: 3 },
    ]);
    // One Potion drunk, the rest and the balls back, and a find.
    expect(entry.home.items).toEqual({ potion: 1, 'poke-ball': 3, 'parts-crate': 1 });
  });
});

describe('the raid log', () => {
  it('keeps the last thirty raids and survives a reload', () => {
    const { storage, saves } = olliesSave();
    for (let raid = 0; raid < RAIDS_LOGGED + 3; raid += 1) {
      const raidId = deploy(saves, ['squirtle-1']);
      expect(saves.bankRun({ pokemon: [], items: [] }, undefined, raid * 1000, raidId)).toBe(true);
    }

    const log = new SaveManager(storage).load()!.raidProgress.raidLog!;
    expect(log).toHaveLength(RAIDS_LOGGED);
    expect(log.at(-1)!.elapsedMs).toBe((RAIDS_LOGGED + 2) * 1000);
    expect(log[0].elapsedMs).toBe(3000);
  });

  it('logs nothing for an ending with no raid in flight', () => {
    const { storage, saves } = olliesSave();
    expect(saves.bankRun({ pokemon: [], items: [] })).toBe(true);
    expect(new SaveManager(storage).load()!.raidProgress.raidLog).toBeUndefined();
  });
});
