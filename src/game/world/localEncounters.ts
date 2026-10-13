import type { WildEncounterTable } from '../pokemon/encounters';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapDefinition, WorldMapId } from '../worldMap';
import { MAP_DISTRICTS, districtAt } from './districts';
import { interiorFloorRolls } from './interiors';
import { districtTableFor } from './nightRaids';
import { placedAreaAt } from './mapAreas';
import { fileMap } from './playerMaps';

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
export function districtEncounterTables(
  raidMapId?: WorldMapId,
  // A night raid's tables (`nightRaids.ts`): the same districts in the same
  // order, each holding what its grass holds after dark.
  night = false,
): Readonly<Record<string, WildEncounterTable>> {
  const own = raidMapId === undefined ? [] : (fileMap(raidMapId)?.districts ?? []);
  return Object.fromEntries(
    [...MAP_DISTRICTS, ...own]
      .filter((district) => district.encounters !== undefined)
      .map((district) => [district.id, districtTableFor(district, night) as WildEncounterTable]),
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

/**
 * Whether a step onto `tile` rolls for wildlife at all: tall grass, or the
 * floor of a place that rolls on every step - which is what a cave is, and the
 * only reason its wildlife is ever met (`interiors.ts`, and a player's cave,
 * `MapFileArea`), and what a named place out of doors may be too (a district's
 * `floorRolls`: Ember Isle's crater). There is no tall grass underground. A
 * floor of the Pokemon Tower rolls on every step where a place on it names what
 * lives there, as FireRed's upper floors do, and is quiet where none does, as
 * its lower ones are. The raid asks it of every
 * step, and the drop-in screen asks it of the ground a place is graded on.
 */
export function stepRolls(
  map: Pick<WorldMapDefinition, 'id' | 'tallGrass' | 'areas'>,
  tile: GridPosition,
): boolean {
  return (
    map.tallGrass[tile.y]?.[tile.x] === true ||
    interiorFloorRolls(map.id, tile) ||
    (map.areas !== undefined && placedAreaAt(map.areas, tile)?.kind === 'cave') ||
    districtAt(map.id, tile)?.floorRolls === true ||
    (map.areas !== undefined &&
      placedAreaAt(map.areas, tile)?.kind === 'tower' &&
      districtAt(map.id, tile)?.encounters !== undefined)
  );
}
