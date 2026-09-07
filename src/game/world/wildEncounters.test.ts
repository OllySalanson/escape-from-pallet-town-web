import { describe, expect, it } from 'vitest';
import { PALLET_TALL_GRASS } from '../pokemon/encounters';
import { getSpeciesById } from '../pokemon/species';
import { PokemonType } from '../pokemon/PokemonType';
import { getTypeEffectiveness } from '../pokemon/battle/typeChart';
import { rollEncounter, type WildEncounterTable } from './wildEncounters';

const TABLE: WildEncounterTable = {
  stepEncounterRate: 0.25,
  entries: [
    { speciesId: 'bulbasaur', minLevel: 2, maxLevel: 4, weight: 3 },
    { speciesId: 'pikachu', minLevel: 5, maxLevel: 5, weight: 1 },
  ],
};

describe('rollEncounter', () => {
  it('uses the shared early table with registered species', () => {
    expect(PALLET_TALL_GRASS.stepEncounterRate).toBe(0.08);
    expect(PALLET_TALL_GRASS.entries).toEqual([
      { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 3 },
      { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 6, weight: 3 },
      { speciesId: 'squirtle', minLevel: 4, maxLevel: 6, weight: 2 },
      { speciesId: 'bulbasaur', minLevel: 7, maxLevel: 7, weight: 1 },
    ]);
    expect(PALLET_TALL_GRASS.entries.every((entry) => getSpeciesById(entry.speciesId))).toBe(true);
  });

  it('sits at or below the level-5 starter on average, with level 7 a rare roll', () => {
    const total = PALLET_TALL_GRASS.entries.reduce((sum, entry) => sum + entry.weight, 0);
    const levelSevenShare =
      PALLET_TALL_GRASS.entries
        .filter((entry) => entry.minLevel >= 7)
        .reduce((sum, entry) => sum + entry.weight, 0) / total;
    const meanLevel =
      PALLET_TALL_GRASS.entries.reduce(
        (sum, entry) => sum + ((entry.minLevel + entry.maxLevel) / 2) * entry.weight,
        0,
      ) / total;

    // The ported Unity table was 60% level 7 against a level-5 starter.
    expect(levelSevenShare).toBeLessThanOrEqual(0.2);
    expect(meanLevel).toBeLessThanOrEqual(5);
  });

  it('offers a Grass-vulnerable species, so no starter is left with a dead move', () => {
    const species = PALLET_TALL_GRASS.entries.map((entry) => getSpeciesById(entry.speciesId)!);

    expect(
      species.some((base) =>
        getTypeEffectiveness(PokemonType.Grass, [
          base.primaryType,
          ...(base.secondaryType ? [base.secondaryType] : []),
        ]) > 1,
      ),
    ).toBe(true);
  });

  it('uses a strict 8 percent step-roll boundary', () => {
    expect(rollEncounter(PALLET_TALL_GRASS, () => 0.079999)).not.toBeNull();
    expect(rollEncounter(PALLET_TALL_GRASS, () => 0.08)).toBeNull();
  });

  it('selects an entry by weight and rolls an inclusive level', () => {
    const rng = [0, 0.8, 0.99];
    expect(rollEncounter(TABLE, () => rng.shift() ?? 0)).toEqual({
      speciesId: 'pikachu',
      level: 5,
    });
  });

  it('selects the expected shared-table entry at each side of its weight boundary', () => {
    expect(rollEncounter(PALLET_TALL_GRASS, () => 0)).toEqual({ speciesId: 'pidgey', level: 3 });
    // Weights are 3/3/2/1 out of 9, so the last entry needs a roll past 8/9.
    const levelSevenRolls = [0, 0.95, 0];
    expect(rollEncounter(PALLET_TALL_GRASS, () => levelSevenRolls.shift() ?? 0)).toEqual({
      speciesId: 'bulbasaur',
      level: 7,
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
