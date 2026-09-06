import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { SaveManager, type StorageLike } from '../save/SaveManager';
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
