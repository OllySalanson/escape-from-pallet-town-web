import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { districtsForMap, type MapDistrict } from './districts';

/**
 * Every place of the vale has its local (the captain, 25 Nov 2026): somebody
 * who has lived there all their life and whom everybody knows - "how certain
 * towns have proper characters in them". Their lines are their tale of the
 * place (`MapFilePerson.local`, written beside the place in its district
 * program), and hearing it to the end puts the whole of the place on THE MAP
 * (`ui/MapScreen.ts`), where before only the tiles walked were.
 *
 * The place is the largest named place the local stands in - on the vale, the
 * 64-tile square of its plan - and it is kept by its name, which is what the
 * vale's places are known by: a district's id is its place in the file's list,
 * and a district added before it would hand a save somebody else's square. A
 * place redrawn bigger or smaller is lit as it is drawn today.
 */

/** The place a local's tale is of: the largest named place they stand in. */
export function placeOfLocal(mapId: WorldMapId, at: GridPosition): MapDistrict | undefined {
  let best: MapDistrict | undefined;
  let bestSize = -1;
  for (const district of districtsForMap(mapId)) {
    const holds = district.areas.some(
      (area) => at.x >= area.x && at.y >= area.y && at.x < area.x + area.width && at.y < area.y + area.height,
    );
    if (!holds) {
      continue;
    }
    const size = district.areas.reduce((sum, area) => sum + area.width * area.height, 0);
    if (size > bestSize) {
      best = district;
      bestSize = size;
    }
  }
  return best;
}

/**
 * The tale's last box, in FireRed's own voice for a thing gained - past tense,
 * MAP in capitals, and the jingle under it (`WorldScene.tellTale`) - with the
 * local doing it, the thing a local would do, rather than a line about a map
 * being unlocked.
 */
export function placeOnMapLine(local: string, place: string): string {
  return `${local} filled in ${place} on your MAP!`;
}

/** How long the filled-in box holds before a key moves it on: FireRed's obtained-a-thing beat. */
export const PLACE_ON_MAP_HOLD_MS = 900;

/** What a local says: their tale, and the last box only the first time it is heard to the end. */
export function taleLines(local: string, tale: readonly string[], place: string, known: boolean): string[] {
  return known ? [...tale] : [...tale, placeOnMapLine(local, place)];
}

/** The tiles of every place a save has had put on its map, as row-major indices at the map's width. */
export function placesOnMapTiles(mapId: WorldMapId, width: number, placeNames: readonly string[]): ReadonlySet<number> {
  const tiles = new Set<number>();
  if (placeNames.length === 0) {
    return tiles;
  }
  for (const district of districtsForMap(mapId)) {
    if (!placeNames.includes(district.name) || placeOfLocal(mapId, district.areas[0] ?? { x: -1, y: -1 }) !== district) {
      continue;
    }
    for (const area of district.areas) {
      for (let y = area.y; y < area.y + area.height; y += 1) {
        for (let x = area.x; x < area.x + area.width; x += 1) {
          tiles.add(y * width + x);
        }
      }
    }
  }
  return tiles;
}
