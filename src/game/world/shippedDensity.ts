import type { GridPosition } from '../movement/gridMovement';
import { RAID_CONTRACTS } from '../objectives/contracts';
import { RUN_INSERTIONS } from '../run/runGeneration';
import { getWorldMap, type BuiltInMapId, type WorldMapDefinition } from '../worldMap';
import { extractionPointsOn } from './extractionPoints';
import { gateKeys, gatesForMap } from './gates';
import { nearestThingSteps } from './nearestThing';
import { createRunTrainerEncounters } from './trainers';

/**
 * The permanent authored things on one of the game's own maps, as
 * `tools/tileset/density.mts` counts them - an exit, a drop-in, a landmark, a
 * townsperson or sign, a gate tile, a trainer, a contract stop - on the map
 * with every gate open, because ground behind a door is ground the map has to
 * be worth walking once the door is open.
 */
export function permanentThingsOn(mapId: BuiltInMapId): {
  readonly map: WorldMapDefinition;
  readonly things: readonly GridPosition[];
} {
  const map = getWorldMap(mapId, gateKeys(gatesForMap(mapId)));
  const things = [
    ...extractionPointsOn(mapId).map((point) => point.position),
    ...Object.values(RUN_INSERTIONS)
      .filter((entry) => entry.mapId === mapId)
      .map((entry) => entry.position),
    ...map.pois.map((poi) => poi.position),
    ...map.entities.map((entity) => entity.position),
    ...gatesForMap(mapId).flatMap((gate) => gate.tiles),
    ...createRunTrainerEncounters()
      .filter((trainer) => trainer.mapId === mapId)
      .map((trainer) => trainer.position),
    ...RAID_CONTRACTS.filter((contract) => contract.mapId === mapId).flatMap((contract) =>
      contract.markers.map((marker) => marker.position),
    ),
  ];
  return { map, things };
}

/** Steps from each tile of a shipped map to its nearest permanent authored thing. */
export function shippedNearestSteps(mapId: BuiltInMapId): {
  readonly map: WorldMapDefinition;
  readonly things: readonly GridPosition[];
  readonly nearest: readonly Int32Array[];
} {
  const { map, things } = permanentThingsOn(mapId);
  return { map, things, nearest: nearestThingSteps(map.collision, things) };
}
