import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { BULBASAUR, Pokemon, PokemonParty, getSpeciesById } from '../pokemon';
import { Move } from '../pokemon/Move';
import { SLEEP_POWDER, TACKLE } from '../pokemon/moves';
import { createBattleState, persistCombatantToPokemon, resolveTurn } from '../pokemon/battle/battleEngine';
import { RunManager } from '../run/RunManager';
import { deployedRaidCondition } from '../run/raidSettlement';
import { Stash } from '../stash';
import { SaveManager } from './SaveManager';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

const write = (saves: SaveManager, stash: Stash): void => {
  saves.save({
    party: new PokemonParty([]),
    mapId: 'pallet-town',
    position: { x: 1, y: 1 },
    items: [],
    bag: new Bag({}),
    stash,
  });
};

/**
 * A berry given to a Pokemon at base is the one supply that leaves the vault
 * without going into the pack: it rides on the Pokemon, as gear does, and the
 * raid's condition is the only way home for it - full, or eaten.
 */
describe('a held berry, from the vault to a fight and home again', () => {
  const stashHolding = (): Stash => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(BULBASAUR, 10), 'bulbasaur-1');
    stash.addItem('chesto-berry', 2);
    expect(stash.giveHeldItem('bulbasaur-1', 'chesto-berry')).toBe(true);
    return stash;
  };

  it('moves out of the vault onto the Pokemon, and is saved there', () => {
    const stash = stashHolding();
    expect(stash.itemCount('chesto-berry')).toBe(1);
    const saves = new SaveManager(new MemoryStorage());
    write(saves, stash);
    const reloaded = saves.load()?.stash;
    expect(reloaded?.listPokemon()[0].pokemon.heldItemId).toBe('chesto-berry');
    expect(reloaded?.itemCount('chesto-berry')).toBe(1);
  });

  it('comes home eaten when the raid ate it, leaving the spare in the vault', () => {
    const stash = stashHolding();
    const holder = stash.listPokemon()[0].pokemon;
    holder.moves.splice(0, holder.moves.length, new Move(TACKLE));
    const manager = new RunManager();
    manager.startRun({ party: [holder], items: [] }, { mapId: 'pallet-town', durationMs: 60_000 });

    // A fight in the raid puts it to sleep, and the berry wakes it.
    const oddish = new Pokemon(getSpeciesById('oddish')!, 10);
    oddish.moves.splice(0, oddish.moves.length, new Move(SLEEP_POWDER));
    const fought = resolveTurn(createBattleState(holder, oddish), 0, () => 0.1);
    persistCombatantToPokemon(fought.state.player);
    expect(fought.events.some((event) => event.type === 'berry-cure')).toBe(true);

    const condition = deployedRaidCondition(['bulbasaur-1'], manager.snapshot());
    expect(condition[0].heldItemId).toBeNull();
    expect(condition[0].primaryStatus).toBeNull();

    // Settled onto the vault as it was read back from storage: an empty hand,
    // and the spare in the vault untouched - the eaten one is simply gone.
    const saves = new SaveManager(new MemoryStorage());
    holder.giveHeldItem('chesto-berry');
    write(saves, stash);
    const home = saves.load()!.stash;
    home.applyRaidCondition(condition);
    expect(home.listPokemon()[0].pokemon.heldItemId).toBeNull();
    expect(home.itemCount('chesto-berry')).toBe(1);
  });
});
