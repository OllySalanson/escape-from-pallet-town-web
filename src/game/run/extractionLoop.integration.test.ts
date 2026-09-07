import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { SAVE_KEY, SaveManager, type StorageLike } from '../save/SaveManager';
import { createStartingStash } from '../stash';
import { createActiveRunSession } from './RunSession';
import { RunManager } from './RunManager';

class MemoryStorage implements StorageLike {
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

const RUN_CONFIG = { mapId: 'pallet-town', durationMs: 60_000 };

/** Reads the field straight out of storage, so persistence is proven, not inferred. */
function persistedStarterSpeciesId(storage: StorageLike): unknown {
  return (JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>).starterSpeciesId;
}

function seedNewPlayer(storage: StorageLike): SaveManager {
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash: createStartingStash(),
  });
  return saves;
}

describe('extraction loop integration', () => {
  it('banks caught Pokemon and found items on escape without duplicating deployed stash assets', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const seeded = saves.load()?.stash;

    expect(seeded?.listPokemon()).toMatchObject([
      { id: 'bulbasaur-1', pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    expect(seeded?.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });

    const starter = seeded!.listPokemon()[0];
    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const secureSlot = { pokemon: starter.pokemon, items: loadout.items };
    const stashSecureSlot = { pokemonId: starter.id, items: loadout.items };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      stashSecureSlot,
      [starter.id],
      loadout.items,
    );
    const caught = new Pokemon(CHARMANDER, 4);

    session.manager.registerCaughtPokemon(caught);
    session.manager.registerFoundItem('antidote', 2);
    session.manager.resolveEscape();
    const resolved = session.manager.snapshot();

    expect(saves.bankRun({ pokemon: resolved.caughtPokemon, items: resolved.foundItems })).toBe(true);

    const escapedStash = saves.load()!.stash;
    expect(escapedStash.listPokemon()).toMatchObject([
      { id: starter.id, pokemon: { base: { id: 'bulbasaur' } } },
      { pokemon: { base: { id: 'charmander' }, level: 4 } },
    ]);
    expect(escapedStash.listItems()).toEqual({ 'poke-ball': 5, potion: 3, antidote: 2 });
  });

  it('preserves only the secure slot when a run wipes', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];
    const deployedPartner = new Pokemon(CHARMANDER, 5);
    const partnerId = stash.addPokemon(deployedPartner, 'charmander-1');
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
    });

    const loadout = {
      party: [starter.pokemon, deployedPartner],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const secureSlot = { pokemon: starter.pokemon, items: loadout.items };
    const stashSecureSlot = { pokemonId: starter.id, items: loadout.items };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      stashSecureSlot,
      [starter.id, partnerId],
      loadout.items,
    );

    const result = session.manager.resolveWipe(session.secureSlot);
    expect(result.permadeathPokemon).toEqual([deployedPartner]);
    expect(saves.applyWipeLoss(
      session.broughtPokemonIds,
      session.broughtItems,
      session.stashSecureSlot,
    )).toBe(true);

    const wipedStash = saves.load()!.stash;
    expect(wipedStash.listPokemon().map(({ id }) => id)).toEqual([starter.id]);
    expect(wipedStash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });

  it('returns a player who wiped holding an unrelated leftover item with a usable supply of balls and potions', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];
    // One odd end banked from an earlier raid is enough to suppress the restock.
    stash.addItem('antidote', 1);
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
    });

    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG);
    const session = createActiveRunSession(manager, {}, {}, [starter.id], loadout.items);
    session.manager.resolveWipe(session.secureSlot);

    expect(
      saves.applyWipeLoss(session.broughtPokemonIds, session.broughtItems, session.stashSecureSlot),
    ).toBe(true);

    const recovered = saves.load()!.stash;
    expect(recovered.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    // The kept antidote is never taken away, and the balls and potions come back.
    expect(recovered.listItems()).toEqual({ antidote: 1, 'poke-ball': 5, potion: 3 });
  });

  it('restocks a wiped player whose secure slot saved a Pokemon but no supplies', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];

    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const secureSlot = { pokemon: starter.pokemon };
    const stashSecureSlot = { pokemonId: starter.id };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      stashSecureSlot,
      [starter.id],
      loadout.items,
    );
    session.manager.resolveWipe(session.secureSlot);

    expect(
      saves.applyWipeLoss(session.broughtPokemonIds, session.broughtItems, session.stashSecureSlot),
    ).toBe(true);

    // No starter is re-granted - the secured one survived - but the supplies it
    // needs to attempt another run still come back.
    const recovered = saves.load()!.stash;
    expect(recovered.listPokemon().map(({ id }) => id)).toEqual([starter.id]);
    expect(recovered.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });

  it('lets a wiped player re-specialise, and re-grants the newly chosen starter on the next wipe', () => {
    const storage = new MemoryStorage();
    const saves = seedNewPlayer(storage);
    const wipeWith = (manager: SaveManager, stored: { id: string; pokemon: Pokemon }): void => {
      const runManager = new RunManager();
      runManager.startRun({ party: [stored.pokemon], items: [] }, RUN_CONFIG);
      const session = createActiveRunSession(runManager, {}, {}, [stored.id], []);
      session.manager.resolveWipe(session.secureSlot);
      expect(
        manager.applyWipeLoss(session.broughtPokemonIds, session.broughtItems, session.stashSecureSlot),
      ).toBe(true);
    };

    // The captain's starting position: a first wipe hands back the same species.
    wipeWith(saves, saves.load()!.stash.listPokemon()[0]);
    expect(saves.load()!.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    expect(saves.load()!.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
    expect(persistedStarterSpeciesId(storage)).toBe('bulbasaur');
    expect(saves.load()!.stash.canSwapStarter()).toBe(true);

    // Re-specialising rewrites the recorded species, not just the stash.
    expect(saves.reselectStarter('squirtle')).toBe(true);
    expect(persistedStarterSpeciesId(storage)).toBe('squirtle');
    expect(saves.load()!.stash.listPokemon()).toMatchObject([
      { id: 'squirtle-1', pokemon: { base: { id: 'squirtle' }, level: 5 } },
    ]);
    // Re-specialising hands over a usable kit too, not just a new species.
    expect(saves.load()!.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });

    // Reload the page, then wipe again: the re-grant follows the new choice.
    const afterReload = new SaveManager(storage);
    expect(afterReload.load()!.starterSpeciesId).toBe('squirtle');
    wipeWith(afterReload, afterReload.load()!.stash.listPokemon()[0]);

    const regranted = afterReload.load()!.stash.listPokemon();
    expect(regranted).toMatchObject([{ pokemon: { base: { id: 'squirtle' }, level: 5 } }]);
    expect(regranted.map(({ pokemon }) => pokemon.base.id)).not.toContain('bulbasaur');

    // The offer withdraws itself the moment a second Pokemon is banked.
    expect(afterReload.bankRun({ pokemon: [new Pokemon(CHARMANDER, 4)], items: [] })).toBe(true);
    expect(afterReload.load()!.stash.canSwapStarter()).toBe(false);
    expect(afterReload.reselectStarter('bulbasaur')).toBe(false);
    expect(persistedStarterSpeciesId(storage)).toBe('squirtle');
    expect(afterReload.load()!.stash.listPokemon().map(({ id }) => id)).toEqual([
      'squirtle-1',
      'charmander-1',
    ]);
  });

  it('unlocks South Verge and grants one supply exactly once after extracting the recovered field kit', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const loadout = { party: [starter.pokemon], items: [] };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG);
    manager.recoverFieldKit();
    manager.resolveEscape();
    const snapshot = manager.snapshot();

    const result = { pokemon: snapshot.caughtPokemon, items: snapshot.foundItems };
    expect(saves.bankFirstContractRun(result)).toEqual({ saved: true, granted: true });
    expect(saves.load()!.raidProgress).toEqual({
      firstContractExtracted: true,
      unlockedInsertions: ['town-square', 'south-verge'],
    });
    expect(saves.load()!.stash.itemCount('super-potion')).toBe(1);

    expect(saves.bankFirstContractRun(result)).toEqual({ saved: true, granted: false });
    expect(saves.load()!.stash.itemCount('super-potion')).toBe(1);
  });
});
