import type { RaidProgress } from '../save/SaveManager';
import type { WorldMapId } from '../worldMap';
import { placesOnMapTiles } from './locals';
import { troddenTiles } from './trodden';
import { availableInsertionIds, runInsertion } from '../run/runGeneration';

/**
 * What THE MAP shows in colour on one map, as row-major tile indices at its
 * width: every tile the player has stood on (`trodden.ts`), and the whole of
 * every place whose local has told its tale (`locals.ts`). The scenes add a
 * raid's own steps, which are not written down until it ends.
 */
export function knownOnChart(
  mapId: WorldMapId,
  width: number,
  progress: Pick<RaidProgress, 'trodden' | 'placesOnMap'> | undefined,
): ReadonlySet<number> {
  const walked = troddenTiles(progress?.trodden?.[mapId], width);
  const places = placesOnMapTiles(mapId, width, progress?.placesOnMap?.[mapId] ?? []);
  if (places.size === 0) {
    return walked;
  }
  return new Set([...walked, ...places]);
}

/**
 * Which map THE MAP shows at home: the one the next raid's landings are on,
 * because M is only ever a raid's map, never the harbour's (the captain,
 * 26 Nov 2026). Greystone Vale when no landing is offered.
 */
export function homeChartMap(progress: Parameters<typeof availableInsertionIds>[0]): WorldMapId {
  return runInsertion(availableInsertionIds(progress)[0] ?? '')?.mapId ?? 'greystone-vale';
}
