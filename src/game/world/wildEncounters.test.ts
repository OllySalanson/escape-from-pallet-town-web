import { describe, expect, it } from 'vitest';
import { PALLET_TALL_GRASS } from '../pokemon/encounters';
import { getSpeciesById } from '../pokemon/species';
import { rollEncounter, type WildEncounterTable } from './wildEncounters';

const TABLE: WildEncounterTable = {
  stepEncounterRate: 0.25,
  entries: [
    { speciesId: 'bulbasaur', minLevel: 2, maxLevel: 4, weight: 3 },
    { speciesId: 'pikachu', minLevel: 5, maxLevel: 5, weight: 1 },
  ],
};

describe('rollEncounter', () => {
  it('uses the canonical Pallet table with registered species', () => {
    expect(PALLET_TALL_GRASS.entries).toEqual([
      { speciesId: 'bulbasaur', minLevel: 5, maxLevel: 5, weight: 2 },
      { speciesId: 'bulbasaur', minLevel: 7, maxLevel: 7, weight: 3 },
    ]);
    expect(PALLET_TALL_GRASS.entries.every((entry) => getSpeciesById(entry.speciesId))).toBe(true);
  });

  it('does not encounter when the step roll misses', () => {
    expect(rollEncounter(TABLE, () => 0.25)).toBeNull();
  });

  it('selects an entry by weight and rolls an inclusive level', () => {
    const rng = [0, 0.8, 0.99];
    expect(rollEncounter(TABLE, () => rng.shift() ?? 0)).toEqual({
      speciesId: 'pikachu',
      level: 5,
    });
  });

  it('uses the full inclusive level range', () => {
    const rng = [0, 0, 0.999];
    expect(rollEncounter(TABLE, () => rng.shift() ?? 0)).toEqual({
      speciesId: 'bulbasaur',
      level: 4,
    });
  });
});
