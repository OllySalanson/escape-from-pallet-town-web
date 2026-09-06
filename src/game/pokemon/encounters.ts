export interface WildEncounterEntry {
  speciesId: string;
  minLevel: number;
  maxLevel: number;
  weight: number;
}

export interface WildEncounterTable {
  stepEncounterRate: number;
  entries: readonly WildEncounterEntry[];
}

/**
 * The Unity scene's MapArea has two level-5 and three level-7 Bulbasaur
 * entries, selected uniformly. It has no step encounter rate, so 10% is a
 * clearly flagged Gen-1-style fallback.
 */
export const PALLET_TALL_GRASS: WildEncounterTable = {
  stepEncounterRate: 0.1,
  entries: [
    { speciesId: 'bulbasaur', minLevel: 5, maxLevel: 5, weight: 2 },
    { speciesId: 'bulbasaur', minLevel: 7, maxLevel: 7, weight: 3 },
  ],
};

/** Denser, more varied encounters reward reaching Viridian Forest. */
export const VIRIDIAN_FOREST_TALL_GRASS: WildEncounterTable = {
  stepEncounterRate: 0.13,
  entries: [
    { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 4 },
    { speciesId: 'bulbasaur', minLevel: 8, maxLevel: 10, weight: 3 },
    { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 2 },
  ],
};
