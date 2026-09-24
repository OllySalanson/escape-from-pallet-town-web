import { Bag } from '../items';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { createStartingStash, type Stash } from '../stash';
import {
  DEFAULT_RAID_PROGRESS,
  SaveManager,
  type RaidProgress,
  type RestoredGame,
  type StorageLike,
} from '../save/SaveManager';

/**
 * A base to stand in, for the tests and for `tools/base/renderBase.mts`: a
 * save round-tripped through the real `SaveManager`, so what a room is drawn
 * from is exactly what a player's browser would hand it.
 */
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

export function restoreBase(stash: Stash, raidProgress: Partial<RaidProgress> = {}): RestoredGame {
  const manager = new SaveManager(new MemoryStorage());
  manager.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    starterSpeciesId: 'charmander',
    raidProgress: { ...DEFAULT_RAID_PROGRESS, ...raidProgress },
  });
  const game = manager.load();
  if (!game) throw new Error('a saved base did not load back');
  return game;
}

/** A base with these rungs built and this many Pokémon waiting at the Center. */
export function baseGame(options: { built?: readonly string[]; hurt?: number } = {}): RestoredGame {
  const stash = createStartingStash(CHARMANDER);
  const hurt = options.hurt ?? 0;
  for (let index = 0; index < Math.max(1, hurt); index += 1) {
    stash.addPokemon(new Pokemon(PIDGEY, 4), `pidgey-${index + 1}`);
  }
  for (const [index, entry] of stash.listPokemon().entries()) {
    if (index < hurt) entry.pokemon.takeDamage(entry.pokemon.maxHp - 1);
  }
  return restoreBase(stash, { workshopUpgrades: [...(options.built ?? [])] });
}
