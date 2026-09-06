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
