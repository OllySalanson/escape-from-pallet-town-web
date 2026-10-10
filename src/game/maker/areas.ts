import {
  doorFront,
  MAP_FILE_BUILDING_DOORS,
  MAP_FILE_LIMITS,
  placeSlug,
  type MapFile,
  type MapFileArea,
  type MapFileAreaStyle,
  type MapFileBuilding,
  type MapFileDistrict,
  type MapFileLink,
  type MapFileLinkEnd,
  type MapFileOutdoorBuildingKind,
  type MapFileSpot,
} from '../world/mapFile';
import { MATERIAL_CHARS } from '../world/tileset/materials';
import { keepOnMap, moveThing, removeThing, type GridPoint, type PlaceOutcome } from './draft';

/**
 * The places of a map, as the map maker edits them.
 *
 * A map file holds its outdoors and the inside of each building that has one
 * (`MapFileArea`), and the editor shows one at a time. Editing an area is
 * editing a **focused view** of the file: a map file of its own whose ground,
 * size and buildings are the area's and whose drop-ins, people, signs and the
 * rest are the ones standing in it. Every brush and tool in `draft.ts` works on
 * that view exactly as it works on a whole map, the canvas draws it, drawing
 * past the edge of the outdoors grows the map (an inside is the size its own
 * fields say) - and `withFocusedArea` writes the edit back into the file,
 * keeping everything in every other area where it was and the order of every
 * list as it was (the first drop-in is the front door wherever it stands).
 *
 * `undefined` is the outdoors throughout, as it is in the file.
 */

export type AreaId = string | undefined;

/** The lists in a file whose entries each stand in one area. */
export const PLACED = [
  'dropIns',
  'exits',
  'itemSpots',
  'people',
  'signs',
  'landmarks',
  'trainers',
  'districts',
  'pokemon',
] as const satisfies readonly (keyof MapFile)[];

type Placed = MapFileSpot | MapFileDistrict;

const inArea = (thing: Placed, area: AreaId): boolean => thing.area === area;

/** A thing as the view holds it: with no `area`, because in the view it is the map. */
function local<T extends Placed>(thing: T): T {
  if (thing.area === undefined) {
    return thing;
  }
  const rest: { -readonly [K in keyof T]: T[K] } = { ...thing };
  delete rest.area;
  return rest;
}

function placedIn<T extends Placed>(thing: T, area: AreaId): T {
  const plain = local(thing);
  return area === undefined ? plain : { ...plain, area };
}

/** The area a file names; undefined for the outdoors or an id it does not have. */
export function areaById(file: MapFile, area: AreaId): MapFileArea | undefined {
  return area === undefined ? undefined : file.areas?.find((candidate) => candidate.id === area);
}

/**
 * One area of the file as a map file of its own. The outdoors keeps the file's
 * own name, size and ground; an inside's view carries the inside's.
 */
export function focusArea(file: MapFile, area: AreaId): MapFile {
  const inside = areaById(file, area);
  const id = inside?.id;
  const lists = Object.fromEntries(
    PLACED.map((field) => {
      const list = (file[field] ?? []) as readonly Placed[];
      return [field, list.filter((thing) => inArea(thing, id)).map(local)];
    }),
  ) as unknown as Pick<MapFile, (typeof PLACED)[number]>;
  if (!inside) {
    return { ...file, ...lists };
  }
  return {
    ...file,
    ...lists,
    width: inside.width,
    height: inside.height,
    ground: inside.ground,
    buildings: inside.buildings,
    // A Cut tree and a stretch of Surf water stand outdoors.
    doors: [],
  };
}

/**
 * The file with one area's view written back into it. A list keeps its order:
 * the area's entries go back into the places in the list they came from, one
 * for one, a new one after the last of them and a removed one out.
 */
export function withFocusedArea(file: MapFile, area: AreaId, view: MapFile): MapFile {
  const inside = areaById(file, area);
  const id = inside?.id;
  const merged: Record<string, readonly Placed[]> = {};
  for (const field of PLACED) {
    const before = (file[field] ?? []) as readonly Placed[];
    const edited = ((view[field] ?? []) as readonly Placed[]).map((thing) => placedIn(thing, id));
    const after: Placed[] = [];
    let next = 0;
    for (const thing of before) {
      if (!inArea(thing, id)) {
        after.push(thing);
      } else if (next < edited.length) {
        after.push(edited[next]);
        next += 1;
      }
    }
    after.push(...edited.slice(next));
    if (file[field] !== undefined || after.length > 0) {
      merged[field] = after;
    }
  }
  const next = { ...file, ...(merged as Partial<MapFile>) };
  if (!inside) {
    return {
      ...next,
      width: view.width,
      height: view.height,
      ground: view.ground,
      buildings: view.buildings,
      ...(view.doors ? { doors: view.doors } : {}),
      // The outdoor end of a way through moves with its building, and with the
      // ground when the map grows.
      ...(view.links ? { links: view.links } : {}),
    };
  }
  const resized = view.width !== inside.width || view.height !== inside.height;
  const edited: MapFileArea = {
    ...inside,
    width: view.width,
    height: view.height,
    ground: view.ground,
    buildings: view.buildings,
  };
  return withMatsAgainstTheWall(
    {
      ...next,
      areas: (file.areas ?? []).map((candidate) =>
        candidate.id === inside.id ? edited : candidate,
      ),
    },
    resized ? inside.id : undefined,
  );
}

/**
 * Every way out of a room stands against the room's south wall, on its floor.
 * A room made smaller can leave its mat off the edge or in the middle of the
 * floor, so after a resize each mat in it is put back on the bottom row.
 */
function withMatsAgainstTheWall(file: MapFile, resizedArea: AreaId): MapFile {
  if (resizedArea === undefined) {
    return file;
  }
  const inside = areaById(file, resizedArea);
  if (!inside) {
    return file;
  }
  const links = (file.links ?? []).map((link) => ({
    ...link,
    ends: link.ends.map((end) =>
      end.area === inside.id && end.look === 'mat'
        ? {
            ...end,
            x: Math.max(0, Math.min(inside.width - 1, end.x)),
            y: inside.height - 1,
            toward: 'down' as const,
          }
        : end,
    ) as unknown as MapFileLink['ends'],
  }));
  return { ...file, links };
}

/** What a building's inside is drawn as, and what stands in it to begin with. */
interface InsideTemplate {
  readonly name: string;
  readonly style: MapFileAreaStyle;
  readonly width: number;
  readonly height: number;
  /** Rows of the room's own ground: `B` wall and `P` floor. */
  readonly ground: readonly string[];
  readonly furniture: readonly MapFileBuilding[];
}

const wallAndFloor = (width: number, height: number, wallRows = 2): string[] =>
  Array.from({ length: height }, (_, y) =>
    (y < wallRows ? MATERIAL_CHARS.wall : MATERIAL_CHARS.paving).repeat(width),
  );

/**
 * The inside each building opens into, as FireRed furnishes it - so GO INSIDE
 * opens onto a room that already reads as the building it is in, and the maker
 * changes it rather than starting from a box.
 */
function templateFor(kind: MapFileOutdoorBuildingKind): InsideTemplate {
  switch (kind) {
    case 'pokemon-center':
    case 'pokemon-center-door':
      // The Center's ground floor, as the base's own Center is: the counter
      // across the back, its walls down the sides, the emblem and the seats.
      return {
        name: 'Pokémon Center',
        style: 'center',
        width: 15,
        height: 9,
        ground: wallAndFloor(15, 9, 0),
        furniture: [
          { kind: 'center-counter', x: 0, y: 0 },
          { kind: 'center-wall-west', x: 0, y: 5 },
          { kind: 'center-wall-east', x: 14, y: 5 },
          { kind: 'center-emblem', x: 6, y: 5 },
          { kind: 'seats', x: 11, y: 5 },
        ],
      };
    case 'poke-mart':
    case 'poke-mart-door':
      return {
        name: 'Poké Mart',
        style: 'lab',
        width: 11,
        height: 9,
        ground: wallAndFloor(11, 9),
        furniture: [
          { kind: 'shelves-jars', x: 6, y: 1 },
          { kind: 'computers', x: 0, y: 1 },
          { kind: 'shelves-jars', x: 6, y: 4 },
          { kind: 'shelves-books', x: 0, y: 4 },
          { kind: 'plant', x: 0, y: 7 },
          { kind: 'plant-pot', x: 10, y: 7 },
        ],
      };
    case 'gym':
      // The Rocket Warehouse's own room: crates along the walls and the floor
      // left clear, which is what a gym is for.
      return {
        name: 'Gym',
        style: 'warehouse',
        width: 13,
        height: 12,
        ground: wallAndFloor(13, 12),
        furniture: [
          { kind: 'boxes', x: 0, y: 2 },
          { kind: 'boxes', x: 12, y: 2 },
          { kind: 'big-crate', x: 0, y: 9 },
          { kind: 'big-crate', x: 11, y: 9 },
        ],
      };
    default:
      // A house: a bed against the back wall, a desk with its PC, a plant in
      // each front corner either side of the mat.
      return {
        name: 'House',
        style: 'house',
        width: 11,
        height: 8,
        ground: wallAndFloor(11, 8),
        furniture: [
          { kind: 'bed', x: 1, y: 2 },
          { kind: 'desk', x: 6, y: 2 },
          { kind: 'drawers', x: 9, y: 2 },
          { kind: 'house-plant', x: 0, y: 6 },
          { kind: 'house-plant', x: 10, y: 6 },
        ],
      };
  }
}

/** The way through a building's door: its outdoor end, if it has one. */
function doorEnd(building: MapFileBuilding): MapFileLinkEnd | undefined {
  const front = doorFront(building);
  return front ? { x: front.x, y: front.y, toward: 'up', look: 'door' } : undefined;
}

const sameEnd = (a: MapFileLinkEnd, b: Pick<MapFileLinkEnd, 'x' | 'y' | 'area'>): boolean =>
  a.area === b.area && a.x === b.x && a.y === b.y;

/** The link through a building's door, and which of its ends is outdoors. */
export function linkThroughDoor(
  file: MapFile,
  building: MapFileBuilding,
): { readonly index: number; readonly outside: 0 | 1 } | undefined {
  const end = doorEnd(building);
  if (!end) {
    return undefined;
  }
  for (const [index, link] of (file.links ?? []).entries()) {
    const outside = link.ends.findIndex((candidate) => sameEnd(candidate, end));
    if (outside >= 0) {
      return { index, outside: outside as 0 | 1 };
    }
  }
  return undefined;
}

/** The inside a building's door leads into, if it has one. */
export function insideOf(file: MapFile, building: MapFileBuilding): MapFileArea | undefined {
  const through = linkThroughDoor(file, building);
  if (!through) {
    return undefined;
  }
  const far = file.links![through.index].ends[1 - through.outside];
  return areaById(file, far.area);
}

/** Whether a building has a door that can lead inside. */
export function hasDoor(building: MapFileBuilding): boolean {
  return building.kind in MAP_FILE_BUILDING_DOORS;
}

/** An area id not yet in the file, from a name. */
function freeAreaId(file: MapFile, name: string): string {
  // An id is letters and digits: the accent comes off Pokémon rather than the
  // letter, so the Center is `pokemon-center` and not `pok-mon-center`.
  const plain = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const stem = placeSlug(plain).slice(0, 30) || 'inside';
  const taken = new Set((file.areas ?? []).map((area) => area.id));
  if (!taken.has(stem)) {
    return stem;
  }
  for (let number = 2; ; number += 1) {
    if (!taken.has(`${stem}-${number}`)) {
      return `${stem}-${number}`;
    }
  }
}

/** A name for a new inside that no other inside has: House, House 2, ... */
function freeAreaName(file: MapFile, name: string): string {
  const taken = new Set((file.areas ?? []).map((area) => placeSlug(area.name)));
  if (!taken.has(placeSlug(name))) {
    return name;
  }
  for (let number = 2; ; number += 1) {
    const candidate = `${name} ${number}`;
    if (!taken.has(placeSlug(candidate))) {
      return candidate;
    }
  }
}

export type InsideOutcome =
  | { readonly made: true; readonly file: MapFile; readonly area: string }
  | { readonly made: false; readonly reason: string };

/**
 * The inside of a building, made if it has none yet: a room from the template
 * the building is, and a link from the tile in front of its door to the mat in
 * the middle of the room's south wall.
 */
export function makeInside(file: MapFile, buildingIndex: number): InsideOutcome {
  const building = file.buildings[buildingIndex];
  const end = building ? doorEnd(building) : undefined;
  if (!building || !end) {
    return { made: false, reason: 'That has no door to go in by.' };
  }
  const existing = insideOf(file, building);
  if (existing) {
    return { made: true, file, area: existing.id };
  }
  if ((file.areas ?? []).length >= MAP_FILE_LIMITS.maxAreas) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxAreas} insides.` };
  }
  if ((file.links ?? []).length >= MAP_FILE_LIMITS.maxLinks) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxLinks} ways through.` };
  }
  const template = templateFor(building.kind as MapFileOutdoorBuildingKind);
  const name = freeAreaName(file, template.name);
  const area: MapFileArea = {
    id: freeAreaId(file, name),
    name,
    kind: 'inside',
    style: template.style,
    width: template.width,
    height: template.height,
    ground: template.ground,
    buildings: template.furniture,
  };
  const mat: MapFileLinkEnd = {
    area: area.id,
    x: Math.floor(area.width / 2),
    y: area.height - 1,
    toward: 'down',
    look: 'mat',
  };
  return {
    made: true,
    area: area.id,
    file: {
      ...file,
      areas: [...(file.areas ?? []), area],
      links: [...(file.links ?? []), { ends: [end, mat] }],
    },
  };
}

/** Everything standing in an area, and its own ways through, out of the file. */
function withoutArea(file: MapFile, area: string): MapFile {
  const lists = Object.fromEntries(
    PLACED.filter((field) => file[field] !== undefined).map((field) => [
      field,
      ((file[field] ?? []) as readonly Placed[]).filter((thing) => thing.area !== area),
    ]),
  ) as Partial<MapFile>;
  return {
    ...file,
    ...lists,
    areas: (file.areas ?? []).filter((candidate) => candidate.id !== area),
    links: (file.links ?? []).filter((link) => link.ends.every((end) => end.area !== area)),
  };
}

/**
 * Takes a building off the outdoors, and with it the inside its door leads
 * into and everything in that inside: a room with no way in is a room nobody
 * can reach, and the undo puts both back.
 */
export function removeBuilding(file: MapFile, buildingIndex: number): MapFile {
  const building = file.buildings[buildingIndex];
  if (!building) {
    return file;
  }
  const inside = insideOf(file, building);
  const rest = removeThing(file, { kind: 'building', index: buildingIndex });
  return inside ? withoutArea(rest, inside.id) : rest;
}

/** Takes an inside off the map, with everything in it and every way into it. */
export function removeArea(file: MapFile, area: string): MapFile {
  return withoutArea(file, area);
}

/** Moves a building on the outdoors, and the way through its door with it. */
export function moveBuilding(file: MapFile, buildingIndex: number, to: GridPoint): PlaceOutcome {
  const building = file.buildings[buildingIndex];
  const through = building ? linkThroughDoor(file, building) : undefined;
  const outcome = moveThing(file, { kind: 'building', index: buildingIndex }, to);
  if (!outcome.placed || !through) {
    return outcome;
  }
  const moved = outcome.file.buildings[buildingIndex];
  const end = doorEnd(moved)!;
  const links = (outcome.file.links ?? []).map((link, index) =>
    index === through.index
      ? {
          ...link,
          ends: link.ends.map((candidate, at) =>
            at === through.outside ? end : candidate,
          ) as unknown as MapFileLink['ends'],
        }
      : link,
  );
  return { ...outcome, file: { ...outcome.file, links } };
}

/** One end of a way through that stands in an area, as the editor shows it. */
export interface DoorwayInArea {
  readonly link: number;
  readonly end: 0 | 1;
  readonly at: MapFileLinkEnd;
  /** Where the other end is. */
  readonly leadsTo: AreaId;
}

/** Every end of every way through that stands in an area. */
export function doorwaysIn(file: MapFile, area: AreaId): readonly DoorwayInArea[] {
  return (file.links ?? []).flatMap((link, index) =>
    link.ends.flatMap((end, at) =>
      end.area === area
        ? [{ link: index, end: at as 0 | 1, at: end, leadsTo: link.ends[1 - at].area }]
        : [],
    ),
  );
}

/** The doorway whose landing is a tile of an area, if any. */
export function doorwayAt(
  file: MapFile,
  area: AreaId,
  point: GridPoint,
): DoorwayInArea | undefined {
  return doorwaysIn(file, area).find(
    (doorway) => doorway.at.x === point.x && doorway.at.y === point.y,
  );
}

/**
 * Moves the way out of a room along its wall: a mat stays on the room's
 * bottom row, wherever along it the maker drags it. A building's door end
 * moves with its building, never on its own.
 */
export function moveDoorway(
  file: MapFile,
  doorway: Pick<DoorwayInArea, 'link' | 'end'>,
  to: GridPoint,
): MapFile {
  const link = file.links?.[doorway.link];
  const end = link?.ends[doorway.end];
  if (!link || !end || end.look !== 'mat') {
    return file;
  }
  const inside = areaById(file, end.area);
  if (!inside) {
    return file;
  }
  const x = Math.max(0, Math.min(inside.width - 1, to.x));
  if (x === end.x) {
    return file;
  }
  const moved: MapFileLinkEnd = { ...end, x, y: inside.height - 1, toward: 'down' };
  return {
    ...file,
    links: file.links.map((candidate, index) =>
      index === doorway.link
        ? {
            ...candidate,
            ends: candidate.ends.map((other, at) =>
              at === doorway.end ? moved : other,
            ) as unknown as MapFileLink['ends'],
          }
        : candidate,
    ),
  };
}

/** Changes an inside's name, or its style. */
export function updateArea(
  file: MapFile,
  area: string,
  changes: Partial<Pick<MapFileArea, 'name' | 'style'>>,
): MapFile {
  const name =
    changes.name === undefined
      ? {}
      : { name: changes.name.slice(0, MAP_FILE_LIMITS.maxPlaceNameLength) };
  return {
    ...file,
    areas: (file.areas ?? []).map((candidate) =>
      candidate.id === area ? { ...candidate, ...changes, ...name } : candidate,
    ),
  };
}

/** The building whose door leads into an area, by its place in the list. */
export function buildingInto(file: MapFile, area: string): number | undefined {
  const index = file.buildings.findIndex((building) => insideOf(file, building)?.id === area);
  return index >= 0 ? index : undefined;
}

/**
 * An inside at another size, anchored at its top-left as a map is. A row grown
 * wider carries on as the last tile it had - the back wall goes on as wall,
 * the floor as floor - and a room grown deeper gains floor at the foot, where
 * its mat is put back against the wall. Anything left off the room goes.
 */
export function resizeArea(file: MapFile, area: string, width: number, height: number): MapFile {
  const inside = areaById(file, area);
  if (!inside) {
    return file;
  }
  const clamp = (value: number, low: number, high: number): number =>
    Math.max(low, Math.min(high, Math.round(Number.isFinite(value) ? value : low)));
  const w = clamp(width, MAP_FILE_LIMITS.minInsideWidth, MAP_FILE_LIMITS.maxInsideWidth);
  const h = clamp(height, MAP_FILE_LIMITS.minInsideHeight, MAP_FILE_LIMITS.maxInsideHeight);
  if (w === inside.width && h === inside.height) {
    return file;
  }
  const ground = Array.from({ length: h }, (_, y) => {
    const row = inside.ground[y] ?? MATERIAL_CHARS.paving.repeat(inside.width);
    const last = row.at(-1) ?? MATERIAL_CHARS.paving;
    return (row + last.repeat(w)).slice(0, w);
  });
  const view = keepOnMap({ ...focusArea(file, area), width: w, height: h, ground });
  return withFocusedArea(file, area, view);
}
