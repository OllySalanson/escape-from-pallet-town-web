import { describe, expect, it } from 'vitest';
import { Pokemon, PokemonParty, SQUIRTLE } from '../pokemon';
import { Stash } from '../stash';
import { SAVE_KEY, SaveManager } from './SaveManager';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  public getItem = (key: string): string | null => this.values.get(key) ?? null;
  public setItem = (key: string, value: string): void => void this.values.set(key, value);
  public removeItem = (key: string): void => void this.values.delete(key);
}

const fresh = (): { saves: SaveManager; storage: MemoryStorage } => {
  const storage = new MemoryStorage();
  const saves = new SaveManager(storage);
  const stash = new Stash();
  stash.addPokemon(new Pokemon(SQUIRTLE, 5), 'starter');
  saves.save({ party: new PokemonParty([]), mapId: 'greystone-vale', position: { x: 1, y: 1 }, stash, starterSpeciesId: 'squirtle' });
  return { saves, storage };
};

/** A race against a townsperson (`world/races.ts`): what the save keeps of it. */
describe('a race, in the save', () => {
  it('keeps runs, wins, the best time and mark, and the best run to race again', () => {
    const { saves, storage } = fresh();
    expect(saves.recordRace('mere-dash', 22_900, false, null, [84, 170, 0, 72, 218, 22_900])).toBeUndefined();
    const was = saves.recordRace('mere-dash', 15_600, true, 'silver', [84, 170, 0, 72, 218, 15_600]);
    expect(was).toMatchObject({ runs: 1, wins: 0, bestMs: 22_900 });
    // Slower, so the best run stays the one that set the best time.
    saves.recordRace('mere-dash', 16_000, true, 'bronze', [84, 170, 0, 72, 218, 16_000]);
    expect(new SaveManager(storage).load()?.raidProgress.races?.['mere-dash']).toEqual({
      runs: 3,
      wins: 2,
      bestMs: 15_600,
      medal: 'silver',
      ghost: [84, 170, 0, 72, 218, 15_600],
    });
  });

  it('writes the purse day and the trophy only when a raid banks them', () => {
    const { saves } = fresh();
    saves.recordRace('mere-dash', 10_200, true, 'gold');
    expect(saves.load()?.raidProgress.races?.['mere-dash']?.purseDay).toBeUndefined();
    saves.bankRaceWinnings('mere-dash', { purseDay: '2026-11-25', trophy: true });
    expect(saves.load()?.raidProgress.races?.['mere-dash']).toMatchObject({ purseDay: '2026-11-25', trophy: true, runs: 1 });
  });

  it('reads back nothing it cannot trust: an unknown course, a bad time, a broken run', () => {
    const { saves, storage } = fresh();
    const written = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: Record<string, unknown> };
    written.raidProgress.races = {
      'mere-dash': { runs: 2, wins: 'lots', bestMs: -5, medal: 'platinum', ghost: [1, 2], purseDay: 'today' },
      'no-such-course': { runs: 9, wins: 9 },
    };
    storage.setItem(SAVE_KEY, JSON.stringify(written));
    expect(saves.load()?.raidProgress.races).toEqual({ 'mere-dash': { runs: 2, wins: 0 } });
  });
});
