import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { CHARMANDER, Pokemon, PokemonParty } from '../pokemon';
import { DEFAULT_RAID_PROGRESS, SAVE_KEY, SaveManager } from '../save/SaveManager';
import { Stash } from '../stash';
import { getWorldMap } from '../worldMap';
import sampleLane from '../../maps/sample/sample-lane.json';
import { BUILT_IN_MAP_FILE_LIMITS, readMapFile, type MapFile } from './mapFile';

/**
 * A guard's hoard (`guards.ts`) is had once a save, when a raid banks it, as a
 * gift is (`gifts.test.ts`): the record is written by the banking, never by
 * the taking, so one lost with a wiped raid is there to fight for again.
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

const savedGame = (storage: MemoryStorage): SaveManager => {
  const saves = new SaveManager(storage);
  const stash = new Stash();
  stash.addPokemon(new Pokemon(CHARMANDER, 5), 'charmander-1');
  saves.save({
    party: new PokemonParty(),
    mapId: 'floodplain-relay',
    position: { x: 1, y: 1 },
    bag: new Bag(),
    stash,
    starterSpeciesId: 'charmander',
    raidProgress: DEFAULT_RAID_PROGRESS,
  });
  return saves;
};

/** The Sailors' Rest's, as the vale's Gastly carries it: by name, so it never moves as landmarks are added. */
const REST = 'greystone-vale/sailors-rest';


describe('a guard’s hoard is had when a raid banks it', () => {
  it('is banked under a key made of the map and the landmark’s name, not its place in the list', () => {
    const gastly = getWorldMap('greystone-vale').entities.find((entity) => entity.guards?.name === 'Sailors’ Rest');
    expect(gastly?.guards?.key).toBe(REST);
    expect(gastly?.guards?.poiId).not.toBe(REST);
  });

  it('is recorded by a raid that carries it home, once, across reloads', () => {
    const storage = new MemoryStorage();
    const saves = savedGame(storage);
    expect(saves.load()?.raidProgress.guardHoardsBanked ?? []).toEqual([]);

    saves.bankRun({ pokemon: [], items: [], hoards: [REST] });
    saves.bankRun({ pokemon: [], items: [], hoards: [REST] });
    expect(new SaveManager(storage).load()?.raidProgress.guardHoardsBanked).toEqual([REST]);
  });

  it('is recorded by a raid that banks a contract too, and a plain raid changes nothing', () => {
    const storage = new MemoryStorage();
    const saves = savedGame(storage);
    saves.bankRun({ pokemon: [], items: [] });
    expect(saves.load()?.raidProgress.guardHoardsBanked ?? []).toEqual([]);
    saves.bankFirstContractRun({ pokemon: [], items: [], hoards: [REST] });
    expect(saves.load()?.raidProgress.guardHoardsBanked).toEqual([REST]);
  });

  it('reads a save written before guards as having had none', () => {
    const storage = new MemoryStorage();
    savedGame(storage);
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: Record<string, unknown> };
    delete raw.raidProgress.guardHoardsBanked;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));
    expect(new SaveManager(storage).load()?.raidProgress.guardHoardsBanked ?? []).toEqual([]);
  });
});

describe('a map file’s guards', () => {
  const SAMPLE = sampleLane as MapFile;
  /** The sample lane with a Pokemon beside its Pond Hide, and anything else edited in. */
  const withGuard = (pokemon: Record<string, unknown>, extra: Record<string, unknown> = {}): unknown => ({
    ...SAMPLE,
    pokemon: [{ x: 10, y: 12, species: 'onix', level: 11, guards: 'Pond Hide', ...pokemon }],
    ...extra,
  });
  const problems = (value: unknown): readonly string[] => {
    const read = readMapFile(value, { limits: BUILT_IN_MAP_FILE_LIMITS });
    return read.ok ? [] : read.problems;
  };

  it('reads a guard that stands beside the landmark it names', () => {
    expect(problems(withGuard({ sitsOn: 'moon-stone' }))).toEqual([]);
  });

  it('refuses a guard on a player’s map', () => {
    const read = readMapFile(withGuard({}));
    expect(read.ok ? [] : read.problems).toContain('A Pokémon may guard something only on a map the game draws.');
  });

  it('refuses a guard that does not stand beside the landmark it names', () => {
    expect(problems(withGuard({ x: 12 }))).toContain('Pokémon 1 guards a landmark, which it names and stands within a tile of.');
    expect(problems(withGuard({ guards: 'Nowhere' }))).toContain('Pokémon 1 guards a landmark, which it names and stands within a tile of.');
  });

  it('refuses a guard that walks a beat, or would not fight', () => {
    expect(problems(withGuard({ beat: { everyMs: 1000, roam: [[1, 0]] } }))).toContain(
      'Pokémon 1 guards something, so it stands its ground and walks no beat.',
    );
    expect(problems(withGuard({ level: undefined }))).toContain(
      'Pokémon 1 guards something, which only a plain wild Pokémon that fights may.',
    );
  });

  it('refuses two guards on one landmark, whose hoard and caption are one guard’s', () => {
    const two = { ...SAMPLE, pokemon: [
      { x: 10, y: 12, species: 'onix', level: 11, guards: 'Pond Hide' },
      { x: 9, y: 13, species: 'onix', level: 11, guards: 'Pond Hide' },
    ] };
    expect(problems(two)).toContain('Two Pokémon guard the same landmark, which only one may.');
  });

  it('refuses a guard on a landmark that opens a way out', () => {
    const exits = [...SAMPLE.exits, { x: SAMPLE.exits[0].x + 2, y: 0, name: 'Hide Gate', opens: { when: 'landmark', landmark: 'Pond Hide' } }];
    expect(problems(withGuard({}, { exits }))).toContain('Pokémon 1 guards a landmark that opens a way out, which no guard may.');
  });

  it('refuses a hoard that is not one, or one the landmark already pays', () => {
    expect(problems(withGuard({ sitsOn: 'potion' }))[0]).toMatch(/^Pokémon 1 sits on one of /);
    const strongroom = (SAMPLE.landmarks ?? []).map((landmark) => ({ ...landmark, kind: 'strongroom' }));
    expect(problems(withGuard({ sitsOn: 'great-ball' }, { landmarks: strongroom }))).toContain(
      'Pokémon 1 sits on something its landmark already pays, which it may not.',
    );
  });
});
