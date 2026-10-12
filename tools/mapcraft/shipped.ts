/**
 * A shipped map's drawing read back as map-file letters and buildings, so a
 * district can be drawn against a shipped map's real edge: the town above a
 * new south district, the road a new route has to meet.
 *
 * A `MapSketch` keeps its stamps (a ledge's ends, flowers, a bush) as planted
 * props rather than letters, and its buildings by the catalogue's prop names,
 * so both are turned back into the file's own vocabulary here - the stamp
 * letters of `MAP_FILE_STAMPS` and the words of `MAP_FILE_BUILDINGS`.
 */
import {
  MAP_FILE_BUILDINGS,
  MAP_FILE_STAMPS,
  type MapFileBuilding,
  type MapFileOutdoorBuildingKind,
} from '../../src/game/world/mapFile';
import type { MapSketch } from '../../src/game/world/mapGrid';

const STAMP_LETTER = new Map(
  Object.entries(MAP_FILE_STAMPS).map(([letter, stamp]) => [
    `${stamp.prop}|${stamp.ground}`,
    letter,
  ]),
);
const BUILDING_WORD = new Map(
  Object.entries(MAP_FILE_BUILDINGS).map(([word, prop]) => [
    prop as string,
    word as MapFileOutdoorBuildingKind,
  ]),
);

export interface ShippedRows {
  /** The rows as map-file ground letters, stamps included. */
  readonly ground: readonly string[];
  /** The buildings standing wholly inside the rows, at row `y0` = 0. */
  readonly buildings: readonly MapFileBuilding[];
}

/** Rows `y0` to `y0 + height - 1` of a shipped map's sketch. */
export function shippedRows(sketch: MapSketch<string>, y0: number, height: number): ShippedRows {
  const grid = sketch
    .toGrid()
    .slice(y0, y0 + height)
    .map((row) => [...row]);
  const buildings: MapFileBuilding[] = [];
  for (const prop of sketch.props()) {
    const row = prop.y - y0;
    if (row < 0 || row >= height) continue;
    const ground = grid[row][prop.x];
    const stamp = STAMP_LETTER.get(`${prop.name}|${ground}`);
    if (stamp) {
      grid[row][prop.x] = stamp;
      continue;
    }
    const word = BUILDING_WORD.get(prop.name);
    if (!word) throw new Error(`${prop.name} at ${prop.x},${prop.y} has no map-file word`);
    buildings.push({ x: prop.x, y: row, kind: word });
  }
  return { ground: grid.map((row) => row.join('')), buildings };
}
