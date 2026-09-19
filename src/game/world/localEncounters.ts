import type { WildEncounterTable } from '../pokemon/encounters';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { MAP_DISTRICTS, districtAt } from './districts';

/**
 * Where wildlife is decided: the district a tile is in, and failing that the
 * map's own fallback. The tables themselves are authored on the districts
 * (`districts.ts`), so adding a place adds its wildlife beside its name.
 */

/** Every district's authored table, keyed by district id. */
export function districtEncounterTables(): Readonly<Record<string, WildEncounterTable>> {
  return Object.fromEntries(
    MAP_DISTRICTS.filter((district) => district.encounters !== undefined).map((district) => [
      district.id,
      district.encounters as WildEncounterTable,
    ]),
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
  tables: Readonly<Record<string, WildEncounterTable>> = districtEncounterTables(),
): WildEncounterTable | undefined {
  const district = districtAt(mapId, tile);
  return (district ? tables[district.id] : undefined) ?? fallback;
}
