/**
 * Which of the shipped maps a save may go to. It imports nothing, so anything
 * that decides what is offered - the landings, the contract chain, the board,
 * the wall, the pennants, the badge case - can ask it without a cycle.
 *
 * Two lists, two reasons, one question (`isMapOffered`):
 *
 * - **Retired** maps are kept whole and switched off (the captain, 2026-10-22:
 *   Greystone Vale, the map drawn the new way with `tools/mapcraft`, is the one
 *   map the game plays for now, and the five drawn the old way are put away
 *   rather than deleted, because they may come back). Every file, sketch,
 *   table, contract and test of theirs stays; nothing offers them. While the
 *   chain's first contract stands on a retired map the whole authored chain
 *   is moot, so the chain reads as finished and the standing board deals on
 *   what is left (`availableContracts`). Bringing a map back is taking it off
 *   `RETIRED_MAPS`, and nothing else.
 * - A map **in progress** is drawn and not yet the captain's to open.
 *
 * The suite runs with nothing retired (`mapRoster.testkit.ts`, loaded by
 * `vitest.config.ts`), so every rule a map is held to goes on being asked of
 * the retired ones and they stay fit to bring back; `mapRoster.test.ts` asks
 * what the shipped roster offers.
 */

/** The shipped maps switched off for now. */
export const RETIRED_MAPS: readonly string[] = [
  'floodplain-relay',
  'pallet-town',
  'route-1',
  'viridian-forest',
  'viridian-city',
];

/** Shipped maps drawn but not yet offered to a save. */
export const MAPS_IN_PROGRESS: readonly string[] = [];

let retired: ReadonlySet<string> = new Set(RETIRED_MAPS);

/** Whether a shipped map is switched off (`RETIRED_MAPS`). */
export function isMapRetired(id: string): boolean {
  return retired.has(id);
}

/** Whether a shipped map is drawn and waiting to be opened (`MAPS_IN_PROGRESS`). */
export function isMapInProgress(id: string): boolean {
  return MAPS_IN_PROGRESS.includes(id);
}

/** Whether a save may be offered this map at all. A player's map is never retired. */
export function isMapOffered(id: string): boolean {
  return !isMapRetired(id) && !isMapInProgress(id);
}

/**
 * Replaces the retired list, for the suite alone: `mapRoster.testkit.ts` runs
 * every test with every map in play, and `mapRoster.test.ts` puts the shipped
 * list back to ask what a player is offered. The game never calls it.
 */
export function retireMapsForTests(ids: readonly string[]): void {
  retired = new Set(ids);
}
