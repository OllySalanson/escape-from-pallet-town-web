import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { DEFAULT_RAID_PROGRESS, SaveManager, type StorageLike } from '../save/SaveManager';
import { createStartingStash } from '../stash';
import { benchToKeep, flowForGame } from './arenaKit';

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

describe("the hall's bench", () => {
  /**
   * Veteran playtest (20 Nov 2026): Tauros added on THE BENCH ("2 of 6
   * coming"), out to ARENA SQUARE and straight back in, and the rim said one
   * Pokémon was going: the hall builds its bench from the save each visit.
   */
  it('is still holding whoever was added once the hall is walked out of and into again', () => {
    const stash = createStartingStash(CHARMANDER);
    stash.addPokemon(new Pokemon(PIDGEY, 12), 'pidgey-1');
    const saves = new SaveManager(new MemoryStorage());
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
      raidProgress: { ...DEFAULT_RAID_PROGRESS },
    });

    const first = flowForGame(saves.load()!);
    first.packSomebodyIfBenchEmpty();
    expect(first.togglePokemon('pidgey-1')).toBeFalsy();
    const kept = benchToKeep(first, saves.load()!.raidProgress.lastBench);
    expect(kept).toContain('pidgey-1');
    saves.chooseBench(kept!);

    const again = flowForGame(saves.load()!);
    expect(again.party.map((one) => one.id)).toEqual(first.party.map((one) => one.id));
    // Put away unchanged, it writes nothing.
    expect(benchToKeep(again, saves.load()!.raidProgress.lastBench)).toBeNull();
  });
  /**
   * Playtests of 22 Nov 2026: the partner fainted on a wipe, the hall stood a
   * Lv 5 Magikarp on the empty bench, and after Nurse Joy healed the partner the
   * bench still had only Magikarp on it - the stand-in had been written back as
   * the team the moment a panel was put away.
   */
  it('has the fainted partner back once healed, not the stand-in the hall chose', () => {
    const stash = createStartingStash(CHARMANDER);
    stash.addPokemon(new Pokemon(PIDGEY, 5), 'pidgey-1');
    const partner = stash.listPokemon()[0];
    partner.pokemon.currentHp = 0;
    const saves = new SaveManager(new MemoryStorage());
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
      raidProgress: { ...DEFAULT_RAID_PROGRESS, lastBench: [partner.id] },
    });

    const hall = flowForGame(saves.load()!);
    hall.packSomebodyIfBenchEmpty();
    expect(hall.party.map((one) => one.id)).toEqual(['pidgey-1']);
    expect(benchToKeep(hall, saves.load()!.raidProgress.lastBench)).toBeNull();

    const healed = saves.load()!;
    healed.stash.recoverPokemon(partner.id);
    saves.save(healed);
    expect(flowForGame(saves.load()!).party.map((one) => one.id)).toEqual([partner.id]);
  });

  it('keeps a fainted member in their place when the team is chosen without them', () => {
    const stash = createStartingStash(CHARMANDER);
    stash.addPokemon(new Pokemon(PIDGEY, 5), 'pidgey-1');
    stash.addPokemon(new Pokemon(PIDGEY, 6), 'pidgey-2');
    const partner = stash.listPokemon()[0];
    partner.pokemon.currentHp = 0;
    const saves = new SaveManager(new MemoryStorage());
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
      starterSpeciesId: 'charmander',
      raidProgress: { ...DEFAULT_RAID_PROGRESS, lastBench: [partner.id, 'pidgey-1'] },
    });

    const hall = flowForGame(saves.load()!);
    expect(hall.togglePokemon('pidgey-2')).toBeFalsy();
    saves.chooseBench(benchToKeep(hall, saves.load()!.raidProgress.lastBench)!);

    expect(saves.load()!.raidProgress.lastBench).toEqual([partner.id, 'pidgey-1', 'pidgey-2']);
  });
});

