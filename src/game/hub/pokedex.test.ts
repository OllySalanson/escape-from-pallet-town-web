import { describe, expect, it } from 'vitest';

import { Bag, getItemById, ITEMS } from '../items';
import { ItemCategory } from '../items/items';
import { Pokemon, PokemonParty } from '../pokemon';
import { ALL_SPECIES } from '../pokemon/species';
import {
  DEFAULT_RAID_PROGRESS,
  SAVE_KEY,
  SaveManager,
  type RaidProgress,
  type StorageLike,
} from '../save/SaveManager';
import { createStartingStash, Stash } from '../stash';
import {
  dueMilestone,
  KANTO_POKEDEX_SIZE,
  milestoneWords,
  nextMilestone,
  POKEDEX_MILESTONES,
  pokedexOwned,
  rewardList,
} from './pokedex';

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

/** A vault holding one Pokemon of each of the first `kinds` species in dex order. */
function vaultOf(kinds: number): Stash {
  const stash = new Stash();
  for (const species of ALL_SPECIES.slice(0, kinds)) {
    stash.addPokemon(new Pokemon(species, 5));
  }
  return stash;
}

function saveWith(stash: Stash, raidProgress: RaidProgress = DEFAULT_RAID_PROGRESS): MemoryStorage {
  const storage = new MemoryStorage();
  new SaveManager(storage).save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    raidProgress,
  });
  return storage;
}

describe('the Pokédex milestones', () => {
  it('rewards 10, 25, 50, 75, 100, 125 and all 151 kinds, in that order', () => {
    expect(POKEDEX_MILESTONES.map((milestone) => milestone.kinds)).toEqual([
      10, 25, 50, 75, 100, 125, 151,
    ]);
    expect(KANTO_POKEDEX_SIZE).toBe(ALL_SPECIES.length);
  });

  it('pays supplies the game already has below the last, and keeps gear and a pack for a finished Pokédex', () => {
    for (const milestone of POKEDEX_MILESTONES) {
      expect(milestone.reward.length).toBeGreaterThan(0);
      for (const { itemId, quantity } of milestone.reward) {
        const item = getItemById(itemId);
        expect(item, itemId).toBeDefined();
        expect(quantity).toBeGreaterThan(0);
        // Never money: a reward is not a second, unmeasured faucet.
        expect(item?.effect.type).not.toBe('currency');
        expect(item?.effect.type).not.toBe('material');
        const special =
          item?.category === ItemCategory.Held || item?.category === ItemCategory.Pack;
        expect(special, `${itemId} at ${milestone.kinds} kinds`).toBe(
          milestone.kinds === KANTO_POKEDEX_SIZE,
        );
      }
    }
    const complete = POKEDEX_MILESTONES[POKEDEX_MILESTONES.length - 1];
    expect(complete.reward.map(({ itemId }) => itemId)).toContain('hauler-frame');
  });

  it('is due from the lowest unpaid milestone up, so two crossed at once are given in order', () => {
    expect(dueMilestone(9, [])).toBeUndefined();
    expect(dueMilestone(10, [])?.kinds).toBe(10);
    expect(dueMilestone(30, [])?.kinds).toBe(10);
    expect(dueMilestone(30, [10])?.kinds).toBe(25);
    expect(dueMilestone(30, [10, 25])).toBeUndefined();
    expect(nextMilestone(30)?.kinds).toBe(50);
    expect(nextMilestone(151)).toBeUndefined();
  });

  it('counts a kind once, whatever the vault holds of it', () => {
    const stash = vaultOf(3);
    stash.addPokemon(new Pokemon(ALL_SPECIES[0], 9));
    expect(pokedexOwned([], stash)).toEqual([1, 2, 3]);
    // What was registered before stays, and nothing outside Kanto's 151 is kept.
    expect(pokedexOwned([25, 25, 0, 152], stash)).toEqual([1, 2, 3, 25]);
  });

  it('has Oak count, give his FireRed rating, hand the reward over and name the next milestone', () => {
    const [ten] = POKEDEX_MILESTONES;
    const words = milestoneWords(ten, 12);
    expect(words.speaker).toBe('prof-oak');
    expect(words.lines.join(' ')).toContain('12 kinds of Pokémon caught');
    expect(words.lines).toContain('It looks as if you’re getting on the right track!');
    expect(words.lines.join(' ')).toContain(
      'Here, take 5 Great Balls. I’ve put them on BILL’S PC.',
    );
    expect(words.lines.join(' ')).toContain(
      'When you have 25 kinds of Pokémon, come back and see me.',
    );

    // With the next one already reached he has more to give now, and the
    // second of the two carries on rather than greeting again.
    const crossedTwo = milestoneWords(ten, 26);
    expect(crossedTwo.lines.join(' ')).toContain('And that’s not all!');
    expect(crossedTwo.lines.join(' ')).not.toContain('come back');
    const carriedOn = milestoneWords(POKEDEX_MILESTONES[1], 26, true);
    expect(carriedOn.lines.join(' ')).not.toContain('Good to see you');
    expect(carriedOn.lines.join(' ')).toContain(
      'When you have 50 kinds of Pokémon, come back and see me.',
    );

    const complete = milestoneWords(
      POKEDEX_MILESTONES[POKEDEX_MILESTONES.length - 1],
      KANTO_POKEDEX_SIZE,
    );
    expect(complete.lines.join(' ')).toContain('You’ve finally completed the Pokédex!');
    expect(complete.lines.join(' ')).not.toContain('come back');
  });

  it('reads a reward out as a sentence', () => {
    expect(
      rewardList([
        { itemId: 'good-rod', quantity: 1 },
        { itemId: 'great-ball', quantity: 10 },
      ]),
    ).toBe('a Good Rod and 10 Great Balls');
    expect(
      rewardList([
        { itemId: 'hauler-frame', quantity: 1 },
        { itemId: 'leftovers', quantity: 1 },
        { itemId: 'life-orb', quantity: 1 },
      ]),
    ).toBe('a Hauler frame, some Leftovers and a Life Orb');
  });
});

describe('the Pokédex in the save', () => {
  it('registers every kind in the vault when the game is written, and keeps it after the Pokémon leaves', () => {
    const stash = createStartingStash();
    stash.addPokemon(new Pokemon(ALL_SPECIES[15], 6), 'pidgey-1');
    const storage = saveWith(stash);
    const manager = new SaveManager(storage);
    const owned = manager.load()?.raidProgress.pokedexOwned ?? [];
    expect(owned).toContain(16);

    // Paid to Brock, say: gone from the vault, still owned.
    const game = manager.load()!;
    game.stash.removePokemon('pidgey-1');
    manager.save(game);
    expect(manager.load()?.raidProgress.pokedexOwned).toEqual(owned);
  });

  it('reads a save written before the Pokédex as the kinds in its vault', () => {
    const storage = saveWith(vaultOf(12));
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: Record<string, unknown> };
    delete raw.raidProgress.pokedexOwned;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));

    const loaded = new SaveManager(storage).load()!;
    expect(loaded.raidProgress.pokedexOwned).toBeUndefined();
    expect(pokedexOwned(loaded.raidProgress.pokedexOwned, loaded.stash)).toHaveLength(12);
    expect(loaded.raidProgress.pokedexRewards).toBeUndefined();
  });

  it('hands a milestone over once: its reward in the vault and the milestone recorded in one write', () => {
    const storage = saveWith(vaultOf(10));
    const manager = new SaveManager(storage);
    const before = manager.load()!.stash.itemCount('great-ball');

    const given = manager.claimPokedexReward();
    expect(given?.milestone.kinds).toBe(10);
    expect(given?.owned).toBe(10);
    const after = manager.load()!;
    expect(after.stash.itemCount('great-ball')).toBe(before + 5);
    expect(after.raidProgress.pokedexRewards).toEqual([10]);

    expect(manager.claimPokedexReward()).toBeUndefined();
    expect(manager.load()!.stash.itemCount('great-ball')).toBe(before + 5);
  });

  it('gives nothing below ten kinds, and two milestones crossed at once one claim at a time', () => {
    expect(new SaveManager(saveWith(vaultOf(9))).claimPokedexReward()).toBeUndefined();

    const manager = new SaveManager(saveWith(vaultOf(26)));
    expect(manager.claimPokedexReward()?.milestone.kinds).toBe(10);
    expect(manager.claimPokedexReward()?.milestone.kinds).toBe(25);
    expect(manager.claimPokedexReward()).toBeUndefined();
    const vault = manager.load()!.stash;
    expect(vault.itemCount('great-ball')).toBe(10);
    expect(vault.itemCount('super-potion')).toBe(5);
  });

  it('pays a finished Pokédex its own reward, gear and the Hauler frame included', () => {
    const manager = new SaveManager(
      saveWith(vaultOf(151), {
        ...DEFAULT_RAID_PROGRESS,
        pokedexRewards: [10, 25, 50, 75, 100, 125],
      }),
    );
    expect(manager.claimPokedexReward()?.milestone.kinds).toBe(151);
    const vault = manager.load()!.stash;
    for (const itemId of [
      'hauler-frame',
      'leftovers',
      'focus-band',
      'life-orb',
      'quick-claw',
    ] as const) {
      expect(vault.itemCount(itemId), ITEMS[itemId].displayName).toBe(1);
    }
  });

  it('drops anything in the saved lists that is not a kind or a milestone', () => {
    const storage = saveWith(vaultOf(1));
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: Record<string, unknown> };
    raw.raidProgress.pokedexOwned = [1, 4, 4, 'x', 999];
    raw.raidProgress.pokedexRewards = [10, 11, 10, 'x'];
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    const loaded = new SaveManager(storage).load()!;
    expect(loaded.raidProgress.pokedexOwned).toEqual([1, 4]);
    expect(loaded.raidProgress.pokedexRewards).toEqual([10]);
  });
});
