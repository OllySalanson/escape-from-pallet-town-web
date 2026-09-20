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

/** Open pasture: the gentlest ground in the game, and the plainest wildlife. */
export const PALLET_FIELD_WILDLIFE = wildlife(0.08, [
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 4 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 3 },
  { speciesId: 'meowth', minLevel: 3, maxLevel: 4, weight: 2 },
  { speciesId: 'spearow', minLevel: 3, maxLevel: 4, weight: 1 },
]);

/**
 * Vegetable plots and dug rows: the one place in the game that is mostly Grass,
 * which is also the one place a Water starter has to think. Oddish and
 * Bellsprout both answer a Squirtle with a super-effective Absorb before it has
 * a Water move of its own, so they are the rare roll rather than the common
 * one - and Diglett is in the rows because the rows are dug.
 */
export const PALLET_ALLOTMENT_WILDLIFE = wildlife(0.08, [
  { speciesId: 'caterpie', minLevel: 3, maxLevel: 5, weight: 4 },
  { speciesId: 'diglett', minLevel: 4, maxLevel: 5, weight: 3 },
  { speciesId: 'oddish', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'bellsprout', minLevel: 3, maxLevel: 4, weight: 1 },
  { speciesId: 'bulbasaur', minLevel: 4, maxLevel: 5, weight: 1 },
]);

/** The flooded lane: standing water, and what a flood brings with it. */
export const PALLET_FLOOD_WILDLIFE = wildlife(0.08, [
  { speciesId: 'psyduck', minLevel: 4, maxLevel: 5, weight: 3 },
  { speciesId: 'magikarp', minLevel: 4, maxLevel: 6, weight: 3 },
  { speciesId: 'poliwag', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'squirtle', minLevel: 4, maxLevel: 5, weight: 1 },
]);

/** Sheds, hutches and wire: warm corners, and things that like a cable. */
export const PALLET_YARD_WILDLIFE = wildlife(0.08, [
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'pikachu', minLevel: 4, maxLevel: 4, weight: 3 },
  { speciesId: 'magnemite', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'meowth', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'charmander', minLevel: 4, maxLevel: 5, weight: 1 },
]);

// -- Route 1 ----------------------------------------------------------------

/** The long meadows: Kanto's own roadside pair, and a level above is the rare roll. */
export const ROUTE_MEADOW_WILDLIFE = wildlife(0.09, [
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 5, weight: 4 },
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'jigglypuff', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'caterpie', minLevel: 4, maxLevel: 6, weight: 2 },
]);

/**
 * Roadside verge on the sunny side, which is where the heat is: a Vulpix has
 * an Ember from level one and it is 2x on a Grass starter, so it is one roll in
 * nine and the verge is still the hardest ground on the road for Bulbasaur.
 */
export const ROUTE_WEST_VERGE_WILDLIFE = wildlife(0.08, [
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 4 },
  { speciesId: 'spearow', minLevel: 3, maxLevel: 4, weight: 3 },
  { speciesId: 'meowth', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'vulpix', minLevel: 4, maxLevel: 5, weight: 1 },
]);

/** Roadside verge along the ditch, which holds water all year. */
export const ROUTE_EAST_VERGE_WILDLIFE = wildlife(0.08, [
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'psyduck', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'poliwag', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'magikarp', minLevel: 4, maxLevel: 6, weight: 1 },
  { speciesId: 'squirtle', minLevel: 4, maxLevel: 6, weight: 1 },
]);

/**
 * The steading's fenced fields, north of the farmyard: warm corners, a fence to
 * sit on and whatever gets in under it. The short way south from the orchard
 * runs between them, and the tall grass inside is what a player pays to cut the
 * corner rather than walk round by the road.
 */
export const ROUTE_PADDOCK_WILDLIFE = wildlife(0.09, [
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 4 },
  { speciesId: 'meowth', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'jigglypuff', minLevel: 3, maxLevel: 4, weight: 1 },
]);

/** The old stock pen off the road, gone to seed and holding what a pen holds. */
export const ROUTE_POUND_WILDLIFE = wildlife(0.1, [
  { speciesId: 'rattata', minLevel: 4, maxLevel: 5, weight: 4 },
  { speciesId: 'meowth', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'diglett', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'spearow', minLevel: 3, maxLevel: 4, weight: 1 },
]);

/**
 * The common between the two southern roads: gorse, rock and open sky, which is
 * the same bargain THE MEADOWS makes at the other end of the map and a
 * different set of birds making it.
 */
export const ROUTE_COMMON_WILDLIFE = wildlife(0.09, [
  { speciesId: 'spearow', minLevel: 3, maxLevel: 5, weight: 4 },
  { speciesId: 'pidgey', minLevel: 4, maxLevel: 5, weight: 3 },
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'jigglypuff', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'caterpie', minLevel: 3, maxLevel: 5, weight: 1 },
]);

/** Reed and standing water below the brook: the wet end of the route. */
export const ROUTE_WATER_MEADOW_WILDLIFE = wildlife(0.09, [
  { speciesId: 'psyduck', minLevel: 4, maxLevel: 5, weight: 3 },
  { speciesId: 'poliwag', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'magikarp', minLevel: 4, maxLevel: 6, weight: 2 },
  { speciesId: 'caterpie', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'squirtle', minLevel: 4, maxLevel: 5, weight: 1 },
]);

// -- Viridian Forest ---------------------------------------------------------
// The forest runs from level 6 at its edge to level 10 in its deep stand, and
// it is the one map that is mostly Bug - which is what Viridian Forest is.

export const FOREST_EDGE_WILDLIFE = wildlife(0.09, [
  { speciesId: 'caterpie', minLevel: 6, maxLevel: 8, weight: 4 },
  { speciesId: 'weedle', minLevel: 6, maxLevel: 8, weight: 3 },
  { speciesId: 'pidgey', minLevel: 6, maxLevel: 8, weight: 3 },
]);

export const FOREST_FIRE_TOWER_WILDLIFE = wildlife(0.1, [
  { speciesId: 'spearow', minLevel: 7, maxLevel: 8, weight: 3 },
  { speciesId: 'rattata', minLevel: 6, maxLevel: 8, weight: 2 },
  { speciesId: 'charmander', minLevel: 6, maxLevel: 8, weight: 2 },
  { speciesId: 'vulpix', minLevel: 6, maxLevel: 8, weight: 1 },
]);

/**
 * The cocoon ground. Metapod and Kakuna learn Harden and nothing else in
 * FireRed, so meeting one is a free catch rather than a fight - which is what
 * a cocoon is, and why they are here rather than nowhere.
 */
export const FOREST_BEETLE_HOLLOW_WILDLIFE = wildlife(0.11, [
  { speciesId: 'metapod', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'kakuna', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'venonat', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'butterfree', minLevel: 8, maxLevel: 9, weight: 2 },
  { speciesId: 'beedrill', minLevel: 8, maxLevel: 9, weight: 1 },
]);

export const FOREST_WATERSIDE_WILDLIFE = wildlife(0.1, [
  { speciesId: 'psyduck', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'poliwag', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'squirtle', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'magikarp', minLevel: 7, maxLevel: 10, weight: 1 },
]);

export const FOREST_TRAIL_WILDLIFE = wildlife(0.1, [
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 4 },
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'jigglypuff', minLevel: 7, maxLevel: 9, weight: 2 },
]);

export const FOREST_WARDEN_WILDLIFE = wildlife(0.1, [
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 3 },
  { speciesId: 'caterpie', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'bulbasaur', minLevel: 8, maxLevel: 10, weight: 2 },
]);

export const FOREST_RISE_WILDLIFE = wildlife(0.1, [
  { speciesId: 'spearow', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 1 },
]);

export const FOREST_DEEP_WILDLIFE = wildlife(0.12, [
  { speciesId: 'butterfree', minLevel: 9, maxLevel: 10, weight: 2 },
  { speciesId: 'beedrill', minLevel: 9, maxLevel: 10, weight: 2 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 2 },
  { speciesId: 'venonat', minLevel: 9, maxLevel: 10, weight: 1 },
  { speciesId: 'oddish', minLevel: 9, maxLevel: 10, weight: 1 },
]);

export const FOREST_CLEARING_WILDLIFE = wildlife(0.08, [
  { speciesId: 'jigglypuff', minLevel: 8, maxLevel: 10, weight: 3 },
  { speciesId: 'clefairy', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 9, weight: 1 },
]);

/**
 * THE COPPICE, behind the CUT door: wood that was cut once and grew back, so it
 * is the one place on this map that is mostly *growth* rather than bugs or
 * birds. Oddish and Bellsprout are here because a coppice is exactly where they
 * would be, and because they are two of the eight catchable species FireRed
 * lets read HM01 - the clearing a Cut opens is where the next Cut is standing.
 * They are still the minority of the table: AGENTS.md records that both take a
 * Squirtle to nil before it has a Water move, and this is a place a Water
 * starter has to come to on somebody else's legs.
 */
export const FOREST_COPPICE_WILDLIFE = wildlife(0.1, [
  { speciesId: 'caterpie', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'oddish', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'venonat', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'bellsprout', minLevel: 8, maxLevel: 10, weight: 1 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 1 },
]);

/**
 * The east and south of the wood, added when the forest turned out to be four
 * times the size anybody had walked. Everything here obeys the two rules the
 * old tables set: it is mostly Bug, and nothing on this map goes over level 10
 * (`districtEncounters.test.ts` holds both). What changes place to place is
 * what the *ground* is - burnt earth, still water, fallen timber, worked rock -
 * because on a wood the table is most of what tells one screen from the next.
 */

/** Twenty years of scrub on burnt ground: birds, rats, and one thing with fire. */
export const FOREST_BURN_WILDLIFE = wildlife(0.1, [
  { speciesId: 'spearow', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'vulpix', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'growlithe', minLevel: 8, maxLevel: 9, weight: 1 },
]);

/** Still water under trees. */
export const FOREST_TARN_WILDLIFE = wildlife(0.1, [
  { speciesId: 'poliwag', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'psyduck', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'magikarp', minLevel: 7, maxLevel: 10, weight: 2 },
  { speciesId: 'venonat', minLevel: 8, maxLevel: 10, weight: 1 },
]);

/** The split oak. The one place on the map where the hornets are the table. */
export const FOREST_HORNET_WILDLIFE = wildlife(0.12, [
  { speciesId: 'weedle', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'kakuna', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'beedrill', minLevel: 9, maxLevel: 10, weight: 2 },
  { speciesId: 'venonat', minLevel: 8, maxLevel: 10, weight: 1 },
]);

/** Ten acres of fallen timber: what lives in rotten wood. */
export const FOREST_BLOWDOWN_WILDLIFE = wildlife(0.11, [
  { speciesId: 'caterpie', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'paras', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'metapod', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'venonat', minLevel: 8, maxLevel: 10, weight: 1 },
]);

/** A yard somebody keeps: the things that come to a camp. */
export const FOREST_KILN_WILDLIFE = wildlife(0.09, [
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'meowth', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'vulpix', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'spearow', minLevel: 7, maxLevel: 9, weight: 1 },
]);

/** The crag the birds nest on. */
export const FOREST_ROOKERY_WILDLIFE = wildlife(0.1, [
  { speciesId: 'spearow', minLevel: 8, maxLevel: 10, weight: 4 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'zubat', minLevel: 8, maxLevel: 10, weight: 2 },
]);

/** Sawdust, cut ends and the things that live in a timber yard. */
export const FOREST_SAWPIT_WILDLIFE = wildlife(0.09, [
  { speciesId: 'caterpie', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'meowth', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 1 },
]);

/** The last clearing on the brook. */
export const FOREST_BROOK_FOOT_WILDLIFE = wildlife(0.1, [
  { speciesId: 'psyduck', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'poliwag', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'caterpie', minLevel: 7, maxLevel: 9, weight: 2 },
]);

/** The wall, and the stony ground it was built out of. */
export const FOREST_STONE_ROW_WILDLIFE = wildlife(0.1, [
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'spearow', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'sandshrew', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'geodude', minLevel: 8, maxLevel: 10, weight: 1 },
]);

/**
 * Worked rock. The one place in this forest that is not a wood at all, and the
 * only table on the map with Geodude as the common roll - which is also what
 * makes it the place a Fire starter brings somebody else to.
 */
export const FOREST_QUARRY_WILDLIFE = wildlife(0.1, [
  { speciesId: 'geodude', minLevel: 8, maxLevel: 10, weight: 3 },
  { speciesId: 'sandshrew', minLevel: 8, maxLevel: 10, weight: 3 },
  { speciesId: 'zubat', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'machop', minLevel: 8, maxLevel: 10, weight: 1 },
]);

/** A lane worn down between banks: out of the wind and out of the light. */
export const FOREST_HOLLOW_WILDLIFE = wildlife(0.1, [
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'zubat', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'meowth', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'pikachu', minLevel: 9, maxLevel: 10, weight: 1 },
]);

/** Where the brook spreads out. */
export const FOREST_MERE_WILDLIFE = wildlife(0.1, [
  { speciesId: 'poliwag', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'psyduck', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'magikarp', minLevel: 7, maxLevel: 10, weight: 2 },
  { speciesId: 'oddish', minLevel: 8, maxLevel: 10, weight: 1 },
]);

/** A sand scarp riddled with burrows, and what dug them. */
export const FOREST_WARREN_WILDLIFE = wildlife(0.1, [
  { speciesId: 'sandshrew', minLevel: 8, maxLevel: 10, weight: 3 },
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'diglett', minLevel: 7, maxLevel: 9, weight: 2 },
  { speciesId: 'meowth', minLevel: 7, maxLevel: 9, weight: 1 },
]);

/** The made road, and the verges either side of it. */
export const FOREST_SOUTH_ROAD_WILDLIFE = wildlife(0.09, [
  { speciesId: 'pidgey', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'rattata', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'jigglypuff', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'meowth', minLevel: 7, maxLevel: 9, weight: 1 },
]);

/** Big smooth trunks and nothing under them. */
export const FOREST_BEECH_WILDLIFE = wildlife(0.09, [
  { speciesId: 'caterpie', minLevel: 7, maxLevel: 9, weight: 3 },
  { speciesId: 'butterfree', minLevel: 9, maxLevel: 10, weight: 2 },
  { speciesId: 'oddish', minLevel: 8, maxLevel: 10, weight: 2 },
  { speciesId: 'clefairy', minLevel: 8, maxLevel: 10, weight: 1 },
]);

// -- Floodplain Relay -------------------------------------------------------

/** The reeds: the first ground a new player walks, so at or under the partner. */
export const FLOODPLAIN_REED_WILDLIFE = wildlife(0.08, [
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 3 },
  { speciesId: 'magikarp', minLevel: 4, maxLevel: 6, weight: 2 },
  { speciesId: 'psyduck', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'poliwag', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'squirtle', minLevel: 4, maxLevel: 5, weight: 1 },
]);

/** Old Town: hearths, roofs, an empty market and what moved into them. */
export const FLOODPLAIN_TOWN_WILDLIFE = wildlife(0.08, [
  { speciesId: 'rattata', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'meowth', minLevel: 3, maxLevel: 5, weight: 3 },
  { speciesId: 'grimer', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'pidgey', minLevel: 3, maxLevel: 4, weight: 2 },
  { speciesId: 'charmander', minLevel: 4, maxLevel: 6, weight: 1 },
]);

/** The vault's ground, behind a boss: the hardest grass on the map. */
export const FLOODPLAIN_VAULT_WILDLIFE = wildlife(0.09, [
  // Pikachu reached level 5 here until its Static was real. Measured over the
  // engine, Static costs a level-5 starter 82% to 61% against a level-5 Pikachu
  // and 77% to 47% for Charmander, which took this table - on the map a fresh
  // save starts on - under the floor `districtEncounters.test.ts` holds the
  // starting maps to. Capping it at four is the composition answer rather than
  // a quieter ability: it is the same Pikachu the hunter brings and it should
  // be the same fight.
  { speciesId: 'pikachu', minLevel: 4, maxLevel: 4, weight: 3 },
  { speciesId: 'rattata', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'magnemite', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'spearow', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'butterfree', minLevel: 6, maxLevel: 6, weight: 1 },
]);

/**
 * THE SHOAL, across the SURF door: a sand bar standing in open river, so what
 * lives on it came up the water. Krabby is the shoal's own - it is the one
 * catchable species FireRed lets read both HM01 and HM03 - and the rest is what
 * the reeds have, a level or two up, because a place you can only reach on a
 * Pokemon's back is a place a player arrives at with one.
 */
export const FLOODPLAIN_SHOAL_WILDLIFE = wildlife(0.09, [
  { speciesId: 'magikarp', minLevel: 4, maxLevel: 6, weight: 3 },
  { speciesId: 'poliwag', minLevel: 3, maxLevel: 5, weight: 2 },
  { speciesId: 'krabby', minLevel: 4, maxLevel: 5, weight: 2 },
  { speciesId: 'psyduck', minLevel: 4, maxLevel: 5, weight: 1 },
]);
