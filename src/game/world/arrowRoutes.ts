import type { GridPosition } from '../movement/gridMovement';
import type { WildEncounterTable } from '../pokemon/encounters';
import type { WorldMapId } from '../worldMap';
import { districtsForMap } from './districts';

/**
 * Fewer wild fights for a player following the gold arrow through the places
 * whose arrow walks were nothing but RUN.
 *
 * Reedmere, Pine Hollow, the Safari Marsh and the Turbine Hall are where the
 * arrow's own walk wades the most wild ground, and on a five-minute clock most
 * of it became pressing RUN (AI playtests 4 and 5, 22 Nov 2026: Voltorb every
 * one to five steps in the Turbine Hall, 17 of 19 new friends on the grass). A
 * step there that goes where the arrow points - onto the tile it aims at - rolls
 * at two thirds of the place's rate. Every other step rolls as it always did,
 * and the grass is where it was: what lives off the arrow's way is still met
 * there as often, by anybody who goes looking.
 *
 * Phaser-free; `WorldScene` asks it of each step, with whether the step was
 * the arrow's (`stepFollowsArrow`).
 */

/** The places it holds in, by the names the map gives them (a district, or a room of the map). */
export const ARROW_ROUTE_PLACES = ['REEDMERE', 'PINE HOLLOW', 'SAFARI MARSH', 'TURBINE HALL'] as const;

/** What an arrow step there rolls at, as a share of the place's rate. */
export const ARROW_ROUTE_RATE = 2 / 3;

/** Whether this tile is in one of `ARROW_ROUTE_PLACES`. */
export function isArrowRouteGround(mapId: WorldMapId, tile: GridPosition): boolean {
  return districtsForMap(mapId).some(
    (district) =>
      (ARROW_ROUTE_PLACES as readonly string[]).includes(district.name) &&
      district.areas.some(
        (area) => tile.x >= area.x && tile.y >= area.y && tile.x < area.x + area.width && tile.y < area.y + area.height,
      ),
  );
}

/** The table a step rolls on: the place's own, eased for a step along the arrow there. */
export function tableForStep(
  table: WildEncounterTable,
  mapId: WorldMapId,
  tile: GridPosition,
  followsArrow: boolean,
): WildEncounterTable {
  return followsArrow && isArrowRouteGround(mapId, tile)
    ? { ...table, stepEncounterRate: table.stepEncounterRate * ARROW_ROUTE_RATE }
    : table;
}
