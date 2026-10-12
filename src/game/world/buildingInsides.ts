import type { GridPosition } from '../movement/gridMovement';
import type { BuiltInMapId, WorldMapId } from '../worldMap';
import { layOutAreas, type PlacedArea } from './mapAreas';
import type { MapFileArea, MapFileLink, MapFileLinkEnd } from './mapFile';
import { MATERIAL_CHARS } from './tileset/materials';

/**
 * The buildings on the shipped maps that you can walk into.
 *
 * The raid maps are full of drawn buildings nobody could go into. An inside is
 * built the way a player's map builds one (`mapAreas.ts`, `docs/maker-areas.md`)
 * rather than a second way: the room is a `MapFileArea` in FireRed's own art,
 * laid in the same grid as the map beside it, and each door is a `MapFileLink`
 * gone through by pressing into it - so the hunter, the checks, the loot and
 * every walk in the game go through the door exactly as they do on a player's
 * map, and nothing new has to know a room is there.
 *
 * **Two doors, always.** A room with one door is the shape of the fault the
 * captain hit on 2026-09-19: the hunter settled in the gap he had come through
 * and there was nothing to do about it. So every room here is behind two
 * buildings' doors that stand side by side - a range under two roofs, one room
 * inside - and `buildingInsides.test.ts` holds the stronger form the Delve is
 * held to (`interiors.ts`): no floor tile is a dead end, so whoever is stood
 * anywhere in the room, every other tile of it still has a way out.
 *
 * **It is off the hunter's line, and it is not a safe box.** A room with two
 * ways out hides whoever is in it from a hunter outside it (`PlacedArea.hides`):
 * it walks to the doorstep it last saw them on and keeps hunting from there,
 * as it does outside the Delve, so a player who comes back out by the same
 * door walks into it, and one who leaves by the other has bought the width of
 * the building. A hunter in the same room sees them perfectly well, and the
 * raid clock never stops.
 */
export interface BuildingInside {
  readonly mapId: BuiltInMapId;
  /** The room, in a map file's own words: its FireRed style, ground and furniture. */
  readonly area: MapFileArea;
  /**
   * Its doors, each a building's door outdoors and the mat inside it that it
   * comes out on: the tile in front of the door cell, pressed up into the
   * door, and the column of the mat on the room's bottom row, stepped off
   * down out of it.
   */
  readonly doors: readonly { readonly street: GridPosition; readonly mat: number }[];
}

/** Dark left round the rooms of a shipped map, so no floor is on the grid's edge. */
export const INSIDE_MARGIN = 1;

/** How big each shipped map's outdoors is, which is where its rooms are laid beside. */
const OUTDOORS: Readonly<Partial<Record<BuiltInMapId, { readonly name: string; readonly width: number; readonly height: number }>>> = {
  'floodplain-relay': { name: 'Floodplain Relay', width: 128, height: 128 },
};

const wallAndFloor = (width: number, height: number): string[] =>
  Array.from({ length: height }, (_, y) =>
    (y < 2 ? MATERIAL_CHARS.wall : MATERIAL_CHARS.paving).repeat(width),
  );

export const BUILDING_INSIDES: readonly BuildingInside[] = [
  {
    // THE CIDER YARD's press house and the store beside it, which touch: one
    // range under two roofs, and one room inside, the way Brock's workshop is
    // a room of the Rocket Warehouse - crates and the pickers' kit stacked
    // against the walls, the bench in the middle of the floor. In by the press
    // house's door, out by the store's.
    mapId: 'floodplain-relay',
    area: {
      id: 'press-house',
      name: 'The Press House',
      kind: 'inside',
      style: 'warehouse',
      width: 13,
      height: 8,
      ground: wallAndFloor(13, 8),
      buildings: [
        { kind: 'boxes', x: 0, y: 2 },
        { kind: 'boxes', x: 1, y: 2 },
        { kind: 'big-crate', x: 2, y: 2 },
        { kind: 'workbench', x: 6, y: 4 },
        { kind: 'stool', x: 5, y: 5 },
        { kind: 'tall-box', x: 10, y: 2 },
        { kind: 'boxes', x: 11, y: 2 },
        { kind: 'boxes', x: 12, y: 2 },
      ],
    },
    doors: [
      { street: { x: 69, y: 51 }, mat: 4 },
      { street: { x: 74, y: 50 }, mat: 9 },
    ],
  },
  {
    // OLD TOWN's last two houses, side by side above the drowned street. A
    // stranger who toured the town drew them as two barns; inside they are
    // one FireRed house, the kitchen along the back wall and the table left
    // laid, with the street door of each house a mat of its own.
    mapId: 'floodplain-relay',
    area: {
      id: 'last-houses',
      name: 'The Last Houses',
      kind: 'inside',
      style: 'house',
      width: 12,
      height: 9,
      ground: wallAndFloor(12, 9),
      buildings: [
        { kind: 'kitchen-sink', x: 0, y: 1 },
        { kind: 'cupboard', x: 2, y: 0 },
        { kind: 'television', x: 4, y: 0 },
        { kind: 'window', x: 6, y: 0 },
        { kind: 'dining-table', x: 4, y: 4 },
        { kind: 'potted-plant', x: 0, y: 5 },
        { kind: 'potted-plant', x: 11, y: 5 },
      ],
    },
    doors: [
      { street: { x: 10, y: 36 }, mat: 3 },
      { street: { x: 15, y: 36 }, mat: 8 },
    ],
  },
];

/** The rooms of one map, in the order they are laid out beside it. */
export function insidesForMap(mapId: WorldMapId): readonly BuildingInside[] {
  return BUILDING_INSIDES.filter((inside) => inside.mapId === mapId);
}

/** Each door of a room as a way through: the street end, then the room's mat. */
export function insideLinks(inside: BuildingInside): readonly MapFileLink[] {
  return inside.doors.map(({ street, mat }) => {
    const outdoors: MapFileLinkEnd = { x: street.x, y: street.y, toward: 'up', look: 'door' };
    const room: MapFileLinkEnd = {
      area: inside.area.id,
      x: mat,
      y: inside.area.height - 1,
      toward: 'down',
      look: 'mat',
    };
    return { ends: [outdoors, room] as const };
  });
}

/**
 * Where a shipped map's outdoors and rooms lie in the one grid it is played on
 * - the same layout `getWorldMap` builds it with - or null for a map with none.
 */
export function insideLayout(mapId: WorldMapId): readonly PlacedArea[] | null {
  const insides = insidesForMap(mapId);
  const outdoors = OUTDOORS[mapId as BuiltInMapId];
  if (insides.length === 0 || !outdoors) {
    return null;
  }
  return layOutAreas(
    outdoors,
    insides.map((inside) => inside.area),
    INSIDE_MARGIN,
  ).areas;
}
