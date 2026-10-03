import type { WildEncounterTable } from '../pokemon/encounters';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { MAP_DISTRICTS, districtAt } from './districts';
import { playerMap } from './playerMaps';

/**
 * Where wildlife is decided: the district a tile is in, and failing that the
 * map's own fallback. The tables themselves are authored on the districts
 * (`districts.ts`), so adding a place adds its wildlife beside its name.
 */

/**
 * Every district's authored table, keyed by district id: every shipped
 * district's, and the districts of the one file map a raid is on, if it is on
 * one. Never another file map's - a raid varies these in order on one stream,
 * so a shipped raid rolls as it always did however many maps are added.
 */
export function districtEncounterTables(raidMapId?: WorldMapId): Readonly<Record<string, WildEncounterTable>> {
  const own = raidMapId === undefined ? [] : (playerMap(raidMapId)?.districts ?? []);
  return Object.fromEntries(
    [...MAP_DISTRICTS, ...own]
      .filter((district) => district.encounters !== undefined)
      .map((district) => [district.id, district.encounters as WildEncounterTable]),
  );
}

/**
 * The table a step onto `tile` rolls on. `tables` is a raid's own varied copy
 * of the districts' tables (`RunPlan.districtEncounters`); without one the
 * authored tables are used as written.
 */
export function encounterTableAt(
  mapId: WorldMapId,
  tile: GridPosition,
  fallback: WildEncounterTable | undefined,
  tables: Readonly<Record<string, WildEncounterTable>> = districtEncounterTables(mapId),
): WildEncounterTable | undefined {
  const district = districtAt(mapId, tile);
  return (district ? tables[district.id] : undefined) ?? fallback;
}
