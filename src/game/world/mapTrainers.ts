import type { WorldMapId } from '../worldMap';
import { playerMap } from './playerMaps';
import { createRunTrainerEncounters, type RunTrainerEncounter } from './trainers';

/**
 * Every trainer standing on one map, freshly built: the authored ones for a
 * shipped map (`trainers.ts`), the file's own for a file map. It lives apart
 * from `trainers.ts` because a file map's trainers are built from that module's
 * measured teams, and the two importing each other would be a loop.
 */
export function trainersOn(mapId: WorldMapId): readonly RunTrainerEncounter[] {
  return [
    ...createRunTrainerEncounters().filter((encounter) => encounter.mapId === mapId),
    ...(playerMap(mapId)?.trainers() ?? []),
  ];
}
