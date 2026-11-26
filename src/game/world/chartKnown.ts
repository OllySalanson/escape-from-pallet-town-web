import type { RaidProgress } from '../save/SaveManager';
import type { WorldMapId } from '../worldMap';
import { placesOnMapTiles } from './locals';
import { troddenTiles } from './trodden';

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
