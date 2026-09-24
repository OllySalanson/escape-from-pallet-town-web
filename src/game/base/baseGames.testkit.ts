import { Bag } from '../items';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { createStartingStash, type Stash } from '../stash';
import { TRADER_BARTERS } from '../hub/trader';
import { cabinetEntryFor, type CabinetEntry } from '../hub/traderCabinet';
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

/**
 * Bill's book as a player who has traded this much would have it: every
 * once-only deal in the order he brings them up, then stones, a deal a day
 * from the first of September, until at least `oddities` things have gone
 * across his table.
 */
export function tradedBook(oddities: number): readonly CabinetEntry[] {
  const once = TRADER_BARTERS.filter((barter) => barter.once);
  const stones = TRADER_BARTERS.filter((barter) => !barter.once);
  const book: CabinetEntry[] = [];
  let given = 0;
  for (let deal = 0; given < oddities; deal += 1) {
    const barter = deal < once.length ? once[deal] : stones[(deal - once.length) % stones.length];
    const entry = cabinetEntryFor(barter, 1, new Date(2026, 8, 1 + deal));
    book.push(entry);
    given += entry.gave.reduce((sum, stack) => sum + stack.quantity, 0);
  }
  return book;
}

/** A base with these rungs built and this many Pokémon waiting at the Center. */
export function baseGame(
  options: {
    built?: readonly string[];
    hurt?: number;
    /** At least this many things bartered to Bill - see `tradedBook`. */
    traded?: number;
  } = {},
): RestoredGame {
  const stash = createStartingStash(CHARMANDER);
  const hurt = options.hurt ?? 0;
  for (let index = 0; index < Math.max(1, hurt); index += 1) {
    stash.addPokemon(new Pokemon(PIDGEY, 4), `pidgey-${index + 1}`);
  }
  for (const [index, entry] of stash.listPokemon().entries()) {
    if (index < hurt) entry.pokemon.takeDamage(entry.pokemon.maxHp - 1);
  }
  const book = tradedBook(options.traded ?? 0);
  return restoreBase(stash, {
    workshopUpgrades: [...(options.built ?? [])],
    traderCabinet: book,
    traderBarters: [
      ...new Set(
        book
          .map((entry) => entry.barter)
          .filter((id) => TRADER_BARTERS.some((barter) => barter.id === id && barter.once)),
      ),
    ],
  });
}
