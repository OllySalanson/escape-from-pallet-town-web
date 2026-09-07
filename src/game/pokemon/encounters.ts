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
 * The shared early-route table, used by Pallet Town, Route 1 and the Floodplain
 * Relay.
 *
 * The Unity scene's MapArea holds two level-5 and three level-7 Bulbasaur
 * entries picked uniformly, but Unity fought them with a level-10 Jigglypuff
 * lead. Ported unchanged onto a level-5 starter it made 60% of encounters a
 * level-7 Bulbasaur, which no starter beats, and whose Vine Whip is 2x on
 * Squirtle and 0.25x on Bulbasaur - so the same roll was near-certain death for
 * one starter and survivable for another.
 *
 * This table keeps that level-7 Bulbasaur as the rare hard roll it should be
 * and puts rungs below it: Pidgey as neutral filler for every starter, and a
 * wild Squirtle so a Grass starter finally has something to be effective
 * against. It has no step encounter rate in Unity, so 8% is a Gen-1-style
 * fallback that `varyEncounterTable` then shifts per raid.
 */
export const PALLET_TALL_GRASS: WildEncounterTable = {
  stepEncounterRate: 0.08,
  entries: [
    { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 3 },
    { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 6, weight: 3 },
    { speciesId: 'squirtle', minLevel: 4, maxLevel: 6, weight: 2 },
    { speciesId: 'bulbasaur', minLevel: 7, maxLevel: 7, weight: 1 },
  ],
};

/** Denser, more varied encounters reward reaching Viridian Forest. */
export const VIRIDIAN_FOREST_TALL_GRASS: WildEncounterTable = {
  stepEncounterRate: 0.1,
  entries: [
    { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 4 },
    { speciesId: 'bulbasaur', minLevel: 8, maxLevel: 10, weight: 3 },
    { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 2 },
  ],
};
