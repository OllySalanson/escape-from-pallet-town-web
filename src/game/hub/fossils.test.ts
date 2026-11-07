import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { CHARMANDER, PokemonParty } from '../pokemon';
import { DEFAULT_RAID_PROGRESS, SaveManager, type RaidProgress, type StorageLike } from '../save/SaveManager';
import { createStartingStash } from '../stash/Stash';
import { FOSSIL_ITEM_IDS, fossilAwake, fossilMachineLines, revivedPokemon } from './fossils';

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

const progressAfter = (raids: number): RaidProgress => ({
  ...DEFAULT_RAID_PROGRESS,
  raidRecord: { 'greystone-vale': { deployed: raids, extracted: raids, wiped: 0 } },
});

describe("Oak's fossil machine", () => {
  it('wakes FireRed’s own Pokemon from each fossil, at level 5', () => {
    expect(FOSSIL_ITEM_IDS).toEqual(['helix-fossil', 'dome-fossil']);
    expect([revivedPokemon('helix-fossil').base.id, revivedPokemon('dome-fossil').base.id]).toEqual(['omanyte', 'kabuto']);
    expect(revivedPokemon('helix-fossil').level).toBe(5);
  });

  it('wakes a fossil once a raid has ended since it went on, never before', () => {
    const fossil = { itemId: 'helix-fossil' as const, raidsAt: 3 };
    expect(fossilAwake(fossil, progressAfter(3))).toBe(false);
    expect(fossilAwake(fossil, progressAfter(4))).toBe(true);
    // A raid still being played has not ended.
    expect(fossilAwake(fossil, progressAfter(4), { id: 'raid' } as never)).toBe(false);
  });

  it('says what is on it, and what it is for', () => {
    expect(fossilMachineLines(undefined, false, []).join(' ')).toContain('Old shells');
    expect(fossilMachineLines(undefined, false, ['dome-fossil']).join(' ')).toContain('plate');
    expect(fossilMachineLines({ itemId: 'dome-fossil', raidsAt: 0 }, true, []).join(' ')).toContain('KABUTO woke up!');
  });

  it('takes a fossil from the vault and gives back the Pokemon after a raid, each in one write', () => {
    const storage = new MemoryStorage();
    const stash = createStartingStash(CHARMANDER);
    stash.addItem('dome-fossil', 1);
    const saves = new SaveManager(storage);
    saves.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 0, y: 0 }, bag: new Bag(), stash, raidProgress: progressAfter(2) });

    expect(saves.leaveFossil('dome-fossil')).toBe(true);
    const left = new SaveManager(storage).load()!;
    expect(left.stash.itemCount('dome-fossil')).toBe(0);
    expect(left.raidProgress.fossil).toEqual({ itemId: 'dome-fossil', raidsAt: 2 });
    // The machine holds one at a time, and nothing has woken yet.
    expect(saves.leaveFossil('dome-fossil')).toBe(false);
    expect(saves.takeRevivedFossil()).toBeUndefined();

    saves.save({ ...left, raidProgress: { ...left.raidProgress, raidRecord: progressAfter(3).raidRecord } });
    const woken = saves.takeRevivedFossil();
    expect(woken?.base.id).toBe('kabuto');
    const after = new SaveManager(storage).load()!;
    expect(after.raidProgress.fossil).toBeUndefined();
    expect(after.stash.listPokemon().some(({ pokemon }) => pokemon.base.id === 'kabuto')).toBe(true);
  });
});
