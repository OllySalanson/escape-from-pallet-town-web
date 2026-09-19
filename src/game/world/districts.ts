import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

/**
 * The named parts of a map big enough to have them.
 *
 * A vast map is remembered as places, and a place nobody names is remembered as
 * "the bit with the two barns". Every exit, gate and landmark on the Floodplain
 * already said its own name on its caption, and a stranger who toured it once
 * could place all of them - and still drew Old Town as two unrelated spots,
 * because nothing a player stands near ever said "Old Town". The games this one
 * is dressed as answer that with a plate that names a place as you walk into
 * it; this is the data that plate reads (`WorldScene` shows it, `raidHud.ts`
 * decides for how long).
 *
 * A district is one or more rectangles of tiles, corners included. Where two
 * overlap the first listed wins, so a boundary is drawn once, by order. They
 * are rectangles on purpose: a district is a part of the map, not a flood fill,
 * and the lanes between two places have to belong to one of them.
 * `districts.test.ts` holds that no walkable tile of a districted map is
 * nameless, and that every exit, landmark and drop-in stands somewhere named.
 */
export interface DistrictArea {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MapDistrict {
  readonly id: string;
  readonly mapId: WorldMapId;
  readonly name: string;
  readonly areas: readonly DistrictArea[];
}

export const MAP_DISTRICTS: readonly MapDistrict[] = [
  {
    id: 'floodplain-landing',
    mapId: 'floodplain-relay',
    name: 'THE LANDING',
    areas: [{ x: 0, y: 0, width: 40, height: 14 }],
  },
  {
    id: 'floodplain-beacon-keep',
    mapId: 'floodplain-relay',
    name: 'BEACON KEEP',
    // The keep, its causeway across the north reach, and the gatehouse road
    // down to the race: the sluice gate is the keep's door, so it is the keep.
    areas: [{ x: 40, y: 0, width: 24, height: 20 }],
  },
  {
    id: 'floodplain-market-isle',
    mapId: 'floodplain-relay',
    name: 'MARKET ISLE',
    // Inside the ring of river, both bridges and the fords that leave it.
    areas: [{ x: 19, y: 28, width: 22, height: 19 }],
  },
  {
    id: 'floodplain-reedbeds',
    mapId: 'floodplain-relay',
    name: 'THE REEDBEDS',
    areas: [{ x: 0, y: 14, width: 27, height: 15 }],
  },
  {
    id: 'floodplain-old-town',
    mapId: 'floodplain-relay',
    name: 'OLD TOWN',
    // The street, the chapel, the last house and the road down to the gate:
    // one town, however much wood has grown up between its pieces.
    areas: [{ x: 0, y: 29, width: 30, height: 35 }],
  },
  {
    id: 'floodplain-mill-weir',
    mapId: 'floodplain-relay',
    name: 'MILL WEIR',
    // From the far end of the toll bridge: the toll road, the towpath, the mill
    // - and the mill's own doorstep, which is a row south of the rest of it.
    areas: [
      { x: 27, y: 14, width: 37, height: 15 },
      { x: 47, y: 29, width: 17, height: 1 },
    ],
  },
  {
    id: 'floodplain-orchard',
    mapId: 'floodplain-relay',
    name: 'THE ORCHARD',
    areas: [{ x: 41, y: 29, width: 23, height: 17 }],
  },
  {
    id: 'floodplain-vault',
    mapId: 'floodplain-relay',
    name: 'THE VAULT',
    areas: [{ x: 30, y: 46, width: 34, height: 18 }],
  },
];

const holds = (area: DistrictArea, tile: GridPosition): boolean =>
  tile.x >= area.x &&
  tile.x < area.x + area.width &&
  tile.y >= area.y &&
  tile.y < area.y + area.height;

/** The districts a map declares, in the order that settles an overlap. */
export function districtsForMap(mapId: WorldMapId): readonly MapDistrict[] {
  return MAP_DISTRICTS.filter((district) => district.mapId === mapId);
}

/** The district a tile is in, or undefined on a map that names none. */
export function districtAt(mapId: WorldMapId, tile: GridPosition): MapDistrict | undefined {
  return districtsForMap(mapId).find((district) => district.areas.some((area) => holds(area, tile)));
}
