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
 * and puts rungs below it: Pidgey as neutral filler for every starter, and one
 * of each starter species so all three type advantages have somewhere to land.
 * The wild Squirtle was added for the Grass starter; the wild Charmander closes
 * the same gap for the Water one, which was otherwise the only starter whose
 * own move was never super effective against anything in the early game. It has
 * no step encounter rate in Unity, so 8% is a Gen-1-style fallback that
 * `varyEncounterTable` then shifts per raid.
 */
export const PALLET_TALL_GRASS: WildEncounterTable = {
  stepEncounterRate: 0.08,
  entries: [
    { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 3 },
    { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 6, weight: 3 },
    { speciesId: 'squirtle', minLevel: 4, maxLevel: 6, weight: 2 },
    { speciesId: 'charmander', minLevel: 4, maxLevel: 6, weight: 2 },
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

/**
 * Wildlife is authored per place. `PALLET_TALL_GRASS` and
 * `VIRIDIAN_FOREST_TALL_GRASS` above are what a map falls back to; each table
 * below is what one named district (`world/districts.ts`) rolls on, so the
 * reeds of a drowned town and the meadows of Route 1 no longer offer the same
 * wildlife. A place is described by what lives there, and a table is written
 * in the same units as the fallbacks: weights out of the table's own total,
 * levels before `varyEncounterTable` shifts them a level either way.
 *
 * Only species the game has are named. When the rest of Kanto's original 151
 * arrives, adding one is adding an entry to the table of the place it lives in
 * - nothing else reads this list. `districtEncounters.test.ts` asks each map
 * for the two things that must survive that: every starter's signature move
 * finds a target somewhere on the map, and no place drifts off its difficulty.
 *
 * The rates and levels of a place set its difficulty as surely as its layout
 * does: Pallet Town and the Floodplain's reeds sit at or under the level-5
 * partner, Route 1 reaches a level above it, and Viridian Forest climbs from
 * its north landing to the deep stand. `tools/encounters/report.mts` prints
 * what each place rolls and how a starter fares against it.
 */
const wildlife = (
  stepEncounterRate: number,
  entries: readonly WildEncounterEntry[],
): WildEncounterTable => ({ stepEncounterRate, entries });

// -- Pallet Town ------------------------------------------------------------

/** Open pasture: the gentlest ground in the game. */
export const PALLET_FIELD_WILDLIFE = wildlife(0.08, [
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 4 },
  { speciesId: 'jigglypuff', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 5, weight: 1 },
]);

/** Vegetable plots: Grass-types, and one butterfly that is the rare hard roll. */
export const PALLET_ALLOTMENT_WILDLIFE = wildlife(0.08, [
  { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 6, weight: 4 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 2 },
  { speciesId: 'butterfree', minLevel: 6, maxLevel: 6, weight: 1 },
]);

/** The flooded lane: standing water and what came to it. */
export const PALLET_FLOOD_WILDLIFE = wildlife(0.08, [
  { speciesId: 'squirtle', minLevel: 4, maxLevel: 6, weight: 4 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 2 },
  { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 5, weight: 1 },
]);

/** Sheds, hutches and wire: warm corners and things that like a cable. */
export const PALLET_YARD_WILDLIFE = wildlife(0.08, [
  { speciesId: 'charmander', minLevel: 4, maxLevel: 6, weight: 3 },
  { speciesId: 'pikachu', minLevel: 4, maxLevel: 4, weight: 3 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 2 },
]);

// -- Route 1 ----------------------------------------------------------------

/** The long meadows: a level above the partner is the rare roll. */
export const ROUTE_MEADOW_WILDLIFE = wildlife(0.09, [
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 5, weight: 4 },
  { speciesId: 'jigglypuff', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 6, weight: 2 },
  { speciesId: 'butterfree', minLevel: 6, maxLevel: 7, weight: 1 },
]);

/** Roadside verge on the sunny side. */
export const ROUTE_WEST_VERGE_WILDLIFE = wildlife(0.08, [
  { speciesId: 'charmander', minLevel: 4, maxLevel: 6, weight: 3 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 5, weight: 3 },
]);

/** Roadside verge along the ditch. */
export const ROUTE_EAST_VERGE_WILDLIFE = wildlife(0.08, [
  { speciesId: 'squirtle', minLevel: 4, maxLevel: 6, weight: 3 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 5, weight: 3 },
]);

// -- Viridian Forest ---------------------------------------------------------
// The forest runs from level 6 at its edge to level 10 in its deep stand.

export const FOREST_EDGE_WILDLIFE = wildlife(0.09, [
  { speciesId: 'pidgey', minLevel: 6, maxLevel: 8, weight: 4 },
  { speciesId: 'bulbasaur', minLevel: 7, maxLevel: 9, weight: 2 },
]);

export const FOREST_FIRE_TOWER_WILDLIFE = wildlife(0.1, [
  { speciesId: 'charmander', minLevel: 6, maxLevel: 8, weight: 2 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 8, weight: 3 },
]);

export const FOREST_BEETLE_HOLLOW_WILDLIFE = wildlife(0.11, [
  { speciesId: 'butterfree', minLevel: 8, maxLevel: 9, weight: 3 },
  { speciesId: 'bulbasaur', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 3 },
]);

export const FOREST_WATERSIDE_WILDLIFE = wildlife(0.1, [
  { speciesId: 'squirtle', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'bulbasaur', minLevel: 8, maxLevel: 9, weight: 2 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 8, weight: 1 },
]);

export const FOREST_TRAIL_WILDLIFE = wildlife(0.1, [
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 4 },
  { speciesId: 'jigglypuff', minLevel: 7, maxLevel: 9, weight: 2 },
]);

export const FOREST_WARDEN_WILDLIFE = wildlife(0.1, [
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 3 },
  { speciesId: 'bulbasaur', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 2 },
]);

export const FOREST_RISE_WILDLIFE = wildlife(0.1, [
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 1 },
]);

export const FOREST_DEEP_WILDLIFE = wildlife(0.12, [
  { speciesId: 'butterfree', minLevel: 9, maxLevel: 10, weight: 2 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 2 },
  { speciesId: 'bulbasaur', minLevel: 9, maxLevel: 10, weight: 2 },
]);

export const FOREST_CLEARING_WILDLIFE = wildlife(0.08, [
  { speciesId: 'jigglypuff', minLevel: 8, maxLevel: 10, weight: 3 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 9, weight: 1 },
]);

// -- Floodplain Relay -------------------------------------------------------

/** The reeds: the first ground a new player walks, so at or under the partner. */
export const FLOODPLAIN_REED_WILDLIFE = wildlife(0.08, [
  { speciesId: 'squirtle', minLevel: 4, maxLevel: 6, weight: 3 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 3 },
  { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 5, weight: 2 },
]);

/** Old Town: hearths, roofs and an empty market. */
export const FLOODPLAIN_TOWN_WILDLIFE = wildlife(0.08, [
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 3 },
  { speciesId: 'jigglypuff', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'charmander', minLevel: 4, maxLevel: 6, weight: 3 },
]);

/** The vault's ground, behind a boss: the hardest grass on the map. */
export const FLOODPLAIN_VAULT_WILDLIFE = wildlife(0.09, [
  // Pikachu reached level 5 here until its Static was real. Measured over the
  // engine, Static costs a level-5 starter 82% to 61% against a level-5 Pikachu
  // and 77% to 47% for Charmander, which took this table - on the map a fresh
  // save starts on - under the floor `districtEncounters.test.ts` holds the
  // starting maps to. Capping it at four is the composition answer rather than
  // a quieter ability: it is the same Pikachu the hunter brings and it should
  // be the same fight, and the table is back where it was (55/55/63 to
  // 54/58/63) with the ability doing all of it.
  { speciesId: 'pikachu', minLevel: 4, maxLevel: 4, weight: 3 },
  { speciesId: 'butterfree', minLevel: 6, maxLevel: 6, weight: 1 },
  { speciesId: 'pidgey', minLevel: 4, maxLevel: 5, weight: 3 },
]);
