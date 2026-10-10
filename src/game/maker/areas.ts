import {
  areaLimits,
  buildingDoorways,
  MAP_FILE_BUILDING_DOORS,
  MAP_FILE_LIMITS,
  placeSlug,
  TUNNEL_SIZE,
  type MapFile,
  type MapFileArea,
  type MapFileAreaKind,
  type MapFileAreaStyle,
  type MapFileBuilding,
  type MapFileDistrict,
  type MapFileLink,
  type MapFileLinkEnd,
  type MapFileOutdoorBuildingKind,
  type MapFileSpot,
  plantedProp,
} from '../world/mapFile';
import { MATERIAL_CHARS } from '../world/tileset/materials';
import { BUILDING_CHOICES } from './palette';
import { keepOnMap, moveThing, removeThing, type GridPoint, type PlaceOutcome } from './draft';
import {
  doorwayOf,
  landingsOf,
  STAIRS_SIZE,
  stairsAt,
  stairwellAt,
  TUNNEL_STAIRS_SIZE,
  tunnelStairsAt,
} from '../world/mapAreas';

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
  'berryTrees',
  'boulders',
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
 * floor, so after a resize each mat in it is put back on the bottom row - and
 * a cave's way out back on the floor above its south wall, with rock either
 * side of the notch.
 */
function withMatsAgainstTheWall(file: MapFile, resizedArea: AreaId): MapFile {
  if (resizedArea === undefined) {
    return file;
  }
  const inside = areaById(file, resizedArea);
  if (!inside) {
    return file;
  }
  const seated = (end: MapFileLinkEnd): MapFileLinkEnd => {
    if (end.area !== inside.id) {
      return end;
    }
    if (end.look === 'mat' && (end.toward === 'left' || end.toward === 'right')) {
      // A mat in a side wall keeps its column, on the room, and its middle a
      // row in from the top and the foot, so the whole of it is on the room.
      return {
        ...end,
        x: Math.max(0, Math.min(inside.width - 1, end.x)),
        y: Math.max(1, Math.min(inside.height - 2, end.y)),
      };
    }
    if (end.look === 'mat') {
      return {
        ...end,
        x: Math.max(0, Math.min(inside.width - 1, end.x)),
        y: inside.height - 1,
        toward: 'down',
      };
    }
    if (end.look === 'back-door') {
      return { ...end, x: Math.max(1, Math.min(inside.width - 2, end.x)) };
    }
    if (end.look === 'cave-exit') {
      return {
        ...end,
        x: Math.max(1, Math.min(inside.width - 2, end.x)),
        y: inside.height - 2,
        toward: 'down',
      };
    }
    return end;
  };
  const links = (file.links ?? []).map((link) => {
    const [one, other] = link.ends;
    return { ...link, ends: [seated(one), seated(other)] as const };
  });
  return { ...file, links };
}

/** What a building's inside is drawn as, and what stands in it to begin with. */
interface InsideTemplate {
  readonly name: string;
  /** A building's inside unless it says it is a cave. */
  readonly kind?: MapFileAreaKind;
  readonly style: MapFileAreaStyle;
  readonly width: number;
  readonly height: number;
  /** Rows of the room's own ground: `B` wall and `P` floor. */
  readonly ground: readonly string[];
  readonly furniture: readonly MapFileBuilding[];
  /**
   * The column its way out is in - a room's mat on its bottom row, a cave's
   * notch in its south wall - the middle when absent.
   */
  readonly mat?: number;
  /**
   * A gatehouse's ways out, one for each of the building's doors in order: the
   * end in the room that each door's way through comes out at.
   */
  readonly ways?: readonly Omit<MapFileLinkEnd, 'area'>[];
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
    case 'cave-mouth':
      return CAVE;
    case 'route-gate':
      return ROUTE_GATEHOUSE;
    case 'saffron-gate':
      return SAFFRON_GATEHOUSE;
    case 'saffron-side-gate':
      return SAFFRON_SIDE_GATEHOUSE;
    case 'underground-path':
      return PATH_ENTRANCE;
    // Kanto's town buildings, each into the room it is: a Gym and the Dojo
    // into a hall cleared for battling, the Department Store and the Bike Shop
    // into a shop, and the places somebody studies into Oak's own Lab.
    case 'pewter-gym':
    case 'cerulean-gym':
    case 'vermilion-gym':
    case 'celadon-gym':
    case 'fuchsia-gym':
    case 'saffron-gym':
    case 'cinnabar-gym':
    case 'dojo':
      return templateFor('gym');
    case 'department-store':
    case 'bike-shop':
      return templateFor('poke-mart');
    case 'research-lab':
    case 'silph-co':
    case 'museum':
    case 'pokemon-mansion':
      return LAB;
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
      // FireRed's Poké Mart, piece for piece where the game stands them: the
      // counter and its till by the door, the shelves down the east side, the
      // fridges and the wall shelves along the back, and the slanting walls.
      return {
        name: 'Poké Mart',
        style: 'mart',
        width: 11,
        height: 8,
        ground: wallAndFloor(11, 8),
        furniture: [
          { kind: 'mart-wall-west', x: 0, y: 0 },
          { kind: 'mart-wall-east', x: 10, y: 0 },
          { kind: 'mart-plant', x: 1, y: 1 },
          { kind: 'mart-poster', x: 2, y: 0 },
          { kind: 'mart-till', x: 3, y: 1 },
          { kind: 'mart-wall-shelves', x: 4, y: 0 },
          { kind: 'mart-fridges', x: 7, y: 1 },
          { kind: 'mart-counter', x: 0, y: 3 },
          { kind: 'mart-case', x: 1, y: 5 },
          { kind: 'mart-racks', x: 7, y: 3 },
          { kind: 'mart-rack', x: 10, y: 3 },
          { kind: 'mart-corner-west', x: 0, y: 7 },
          { kind: 'mart-corner-east', x: 10, y: 7 },
        ],
        mat: 4,
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
    case 'shed':
      // A shed is somebody's workshop: the Rocket Warehouse's own bench,
      // stool and stores, which is what Brock's workshop is furnished with.
      return {
        name: 'Shed',
        style: 'warehouse',
        width: 9,
        height: 7,
        ground: wallAndFloor(9, 7),
        furniture: [
          { kind: 'boxes', x: 0, y: 2 },
          { kind: 'workbench', x: 3, y: 2 },
          { kind: 'stool', x: 5, y: 3 },
          { kind: 'big-crate', x: 7, y: 2 },
          { kind: 'tall-box', x: 8, y: 4 },
        ],
      };
    case 'blue-cottage':
      // Bill's house, which this cottage is outside: his PC by the wall, his
      // desk, his books.
      return {
        name: 'Cottage',
        style: 'cottage',
        width: 11,
        height: 8,
        ground: wallAndFloor(11, 8),
        furniture: [
          { kind: 'pc', x: 1, y: 1 },
          { kind: 'desk', x: 4, y: 2 },
          { kind: 'books', x: 8, y: 2 },
          { kind: 'drawers', x: 9, y: 2 },
          { kind: 'house-plant', x: 0, y: 6 },
          { kind: 'house-plant', x: 10, y: 6 },
        ],
      };
    default:
      return HOUSE_GROUND_FLOOR;
  }
}

/**
 * Oak's Lab, laid out as the base's own Lab is: his computers and bookcases
 * along the back wall, the machine he keeps Poké Balls in, the table the
 * starters were chosen at, and two rows of shelving either side of the aisle.
 */
const LAB: InsideTemplate = {
  name: 'Lab',
  style: 'lab',
  width: 13,
  height: 12,
  ground: wallAndFloor(13, 12),
  furniture: [
    { kind: 'computers', x: 0, y: 1 },
    { kind: 'bookcase', x: 9, y: 1 },
    { kind: 'machine', x: 0, y: 3 },
    { kind: 'table', x: 8, y: 4 },
    { kind: 'shelves-books', x: 0, y: 8 },
    { kind: 'shelves-jars', x: 8, y: 8 },
    { kind: 'plant', x: 0, y: 10 },
    { kind: 'plant-pot', x: 12, y: 10 },
  ],
  mat: 6,
};

/**
 * FireRed's own house downstairs, as the player's house in Pallet Town is
 * furnished: the sink and the cupboard, the television and the window along
 * the back wall, the table on the floor and a plant in each front corner, and
 * the mat near the west end where the house's door is. The east end of the
 * back wall is left clear, which is where a staircase goes (`addUpstairs`).
 */
const HOUSE_GROUND_FLOOR: InsideTemplate = {
  name: 'House',
  style: 'house',
  width: 12,
  height: 9,
  ground: wallAndFloor(12, 9),
  furniture: [
    { kind: 'kitchen-sink', x: 0, y: 1 },
    { kind: 'cupboard', x: 2, y: 0 },
    { kind: 'television', x: 5, y: 0 },
    { kind: 'window', x: 6, y: 0 },
    { kind: 'dining-table', x: 4, y: 4 },
    { kind: 'potted-plant', x: 0, y: 6 },
    { kind: 'potted-plant', x: 11, y: 6 },
  ],
  mat: 3,
};

/**
 * A cave as Mt. Moon's ground floor is: ringed in rock - two rows of it along
 * the back, one down each side and one along the foot, where the daylight of
 * the way out is cut in the middle - its floor, a drift of sand in two of its
 * corners, a crater, boulders, and water dripping off the back wall.
 */
const CAVE: InsideTemplate = {
  name: 'Cave',
  kind: 'cave',
  style: 'cave',
  width: 20,
  height: 16,
  ground: [
    'BBBBBBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBBBBBB',
    'BddddPPPPPPPPPPPPPPB',
    'BdddPPPPPPPPPPPPPPPB',
    'BddPPPPPPPPPPPPPPPPB',
    'BPPPPPPPPPPPPPPPPPPB',
    'BPPPPPPPPPPPPPPPPPPB',
    'BPPPPPPPPPPPPPPPPPPB',
    'BPPPPPPPPPPPPPPPPPPB',
    'BPPPPPPPPPPPPPPPPPPB',
    'BPPPPPPPPPPPPPPPdddB',
    'BPPPPPPPPPPPPPPddddB',
    'BPPPPPPPPPPPPPdddddB',
    'BPPPPPPPPPPPPPdddddB',
    'BPPPPPPPPPPPPPPPPPPB',
    'BBBBBBBBBBBBBBBBBBBB',
  ],
  furniture: [
    { kind: 'dripping-water', x: 12, y: 1 },
    { kind: 'boulder', x: 4, y: 7 },
    { kind: 'rocks', x: 15, y: 4 },
    { kind: 'rocks', x: 2, y: 12 },
    { kind: 'crater', x: 8, y: 8 },
  ],
};

/**
 * Route 2's gatehouse, as FireRed furnishes it: plants along the back wall
 * either side of the doorway out north, the runner down the middle to the mat
 * at its foot, two pots of palms on the west side and the guards' tables on
 * the east. FireRed's room has a column of dark down each side; this is the
 * room between them.
 */
const ROUTE_GATEHOUSE: InsideTemplate = {
  name: 'Gatehouse',
  style: 'gatehouse',
  width: 13,
  height: 11,
  ground: wallAndFloor(13, 11),
  furniture: [
    { kind: 'gate-window', x: 1, y: 0 },
    { kind: 'gate-window', x: 10, y: 0 },
    { kind: 'gate-plant', x: 0, y: 1 },
    { kind: 'gate-plant', x: 4, y: 1 },
    { kind: 'gate-plant', x: 8, y: 1 },
    { kind: 'gate-plant', x: 12, y: 1 },
    { kind: 'gate-runner', x: 5, y: 3 },
    { kind: 'gate-plant', x: 0, y: 4 },
    { kind: 'gate-plant', x: 1, y: 4 },
    { kind: 'gate-plant', x: 0, y: 7 },
    { kind: 'gate-plant', x: 1, y: 7 },
    { kind: 'gate-chair', x: 9, y: 4 },
    { kind: 'gate-chair', x: 9, y: 5 },
    { kind: 'gate-table', x: 10, y: 4 },
    { kind: 'gate-chair-east', x: 12, y: 5 },
    { kind: 'gate-table', x: 10, y: 7 },
    { kind: 'gate-chair-east', x: 12, y: 8 },
  ],
  // In by the door, onto the mat; out north by the doorway in the back wall.
  ways: [
    { x: 6, y: 10, toward: 'down', look: 'mat' },
    { x: 6, y: 2, toward: 'up', look: 'back-door' },
  ],
};

/**
 * The gatehouse into Saffron from the north or the south, as FireRed has it: a
 * counter down each side for the guards to stand behind, palms along the
 * walls, a runner up the middle to the doorway in the back wall.
 */
const SAFFRON_GATEHOUSE: InsideTemplate = {
  name: 'Gatehouse',
  style: 'gatehouse',
  width: 9,
  height: 10,
  ground: wallAndFloor(9, 10),
  furniture: [
    { kind: 'gate-window', x: 0, y: 0 },
    { kind: 'gate-window', x: 7, y: 0 },
    { kind: 'gate-plant', x: 0, y: 2 },
    { kind: 'gate-plant', x: 0, y: 5 },
    { kind: 'gate-plant', x: 0, y: 8 },
    { kind: 'gate-plant', x: 8, y: 2 },
    { kind: 'gate-plant', x: 8, y: 5 },
    { kind: 'gate-plant', x: 8, y: 8 },
    { kind: 'gate-counter', x: 2, y: 2 },
    { kind: 'gate-counter', x: 6, y: 2 },
    { kind: 'gate-short-runner', x: 3, y: 3 },
  ],
  ways: [
    { x: 4, y: 9, toward: 'down', look: 'mat' },
    { x: 4, y: 2, toward: 'up', look: 'back-door' },
  ],
};

/**
 * The gatehouse into Saffron from the east or the west, which FireRed cuts
 * with a column of dark down each side and a mat let into each, hanging over
 * it: a counter across the room either side of the rug between them, and a
 * palm in each corner.
 */
const SAFFRON_SIDE_GATEHOUSE: InsideTemplate = {
  name: 'Gatehouse',
  style: 'gatehouse',
  width: 13,
  height: 9,
  ground: Array.from({ length: 9 }, (_, y) =>
    `${MATERIAL_CHARS.cliff}${(y < 2 ? MATERIAL_CHARS.wall : MATERIAL_CHARS.paving).repeat(11)}${MATERIAL_CHARS.cliff}`,
  ),
  furniture: [
    { kind: 'gate-plant', x: 1, y: 1 },
    { kind: 'gate-plant', x: 11, y: 1 },
    { kind: 'gate-window', x: 3, y: 0 },
    { kind: 'gate-window', x: 8, y: 0 },
    { kind: 'gate-long-counter', x: 2, y: 3 },
    { kind: 'gate-rug', x: 3, y: 4 },
    { kind: 'gate-long-counter', x: 2, y: 7 },
    { kind: 'gate-plant', x: 1, y: 7 },
    { kind: 'gate-plant', x: 11, y: 7 },
  ],
  // In from the west porch onto the west mat, out by the east mat to the
  // east porch, and back.
  ways: [
    { x: 1, y: 5, toward: 'left', look: 'mat' },
    { x: 11, y: 5, toward: 'right', look: 'mat' },
  ],
};

/**
 * The room in a hut the Underground Path goes down from, as FireRed's is: the
 * guards' posts either side, a palm in each corner, and the floor between them
 * left clear for the stairwell down, which the path puts in
 * (`makeUndergroundPath`).
 */
const PATH_ENTRANCE: InsideTemplate = {
  name: 'Path entrance',
  style: 'gatehouse',
  width: 13,
  height: 9,
  ground: wallAndFloor(13, 9),
  furniture: [
    { kind: 'gate-plant', x: 0, y: 1 },
    { kind: 'gate-plant', x: 12, y: 1 },
    { kind: 'path-counter', x: 2, y: 3 },
    { kind: 'path-counter-east', x: 9, y: 3 },
    { kind: 'gate-plant', x: 0, y: 7 },
    { kind: 'gate-plant', x: 12, y: 7 },
  ],
  mat: 6,
};

/** Where a path entrance's stairwell is gone down from: the floor east of it, as FireRed's is. */
const PATH_STAIRWELL = { x: 7, y: 4 } as const;

/**
 * The Underground Path between two huts: FireRed's own tunnel north to south,
 * walled either side, with its stairs up eastward at the north end and
 * westward at the south.
 */
const TUNNEL: InsideTemplate = {
  name: 'Underground Path',
  kind: 'tunnel',
  style: 'underground',
  width: TUNNEL_SIZE.width,
  height: TUNNEL_SIZE.height,
  ground: Array.from({ length: TUNNEL_SIZE.height }, (_, y) =>
    y < 2 || y === TUNNEL_SIZE.height - 1
      ? MATERIAL_CHARS.wall.repeat(TUNNEL_SIZE.width)
      : `${MATERIAL_CHARS.wall}${MATERIAL_CHARS.paving.repeat(TUNNEL_SIZE.width - 2)}${MATERIAL_CHARS.wall}`,
  ),
  furniture: [],
};

/** Where a tunnel's two staircases are gone up from: the north end's eastward, the south end's westward. */
const TUNNEL_ENDS = {
  north: { x: 4, y: 3, toward: 'right' },
  south: { x: 3, y: 60, toward: 'left' },
} as const;

/** The stairwell down out of a path entrance, if it has one. */
export function stairwellIn(file: MapFile, area: string): DoorwayInArea | undefined {
  return doorwaysIn(file, area).find((doorway) => doorway.at.look === 'stairwell');
}

/**
 * The Underground Path between two huts, made whole: each hut's entrance if it
 * has none yet, the tunnel, and the stairs down from each entrance to its end
 * of the tunnel - the hut further north to the north end, as Route 5's goes
 * down to it in FireRed, and the other to the south end.
 */
export function makeUndergroundPath(file: MapFile, from: number, to: number): InsideOutcome {
  const huts = [file.buildings[from], file.buildings[to]];
  if (huts.some((hut) => hut?.kind !== 'underground-path')) {
    return { made: false, reason: 'The Underground Path goes from one of its huts to another.' };
  }
  if (from === to) {
    return { made: false, reason: 'The path has to come out at another hut.' };
  }
  if (
    huts.some((hut) => {
      const inside = insideOf(file, hut);
      return inside !== undefined && stairwellIn(file, inside.id) !== undefined;
    })
  ) {
    return { made: false, reason: 'That hut has its path already.' };
  }
  const missing = huts.filter((hut) => !insideOf(file, hut)).length;
  if ((file.areas ?? []).length + missing + 1 > MAP_FILE_LIMITS.maxAreas) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxAreas} insides.` };
  }
  if ((file.links ?? []).length + missing + 2 > MAP_FILE_LIMITS.maxLinks) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxLinks} ways through.` };
  }
  let made = file;
  for (const index of [from, to]) {
    if (!insideOf(made, made.buildings[index])) {
      const inside = makeInside(made, index);
      if (!inside.made) {
        return inside;
      }
      made = inside.file;
    }
  }
  const entrances = [from, to].map((index) => insideOf(made, made.buildings[index])!);
  for (const entrance of entrances) {
    const taken = occupiedIn(made, entrance.id);
    const at = stairwellAt(PATH_STAIRWELL);
    const clear = [0, 1, 2].every((dy) =>
      [0, 1, 2].every(
        (dx) =>
          entrance.ground[at.y + dy]?.[at.x + dx] === MATERIAL_CHARS.paving && !taken(at.x + dx, at.y + dy),
      ),
    );
    if (!clear) {
      return {
        made: false,
        reason: `Clear the floor of ${entrance.name} where its stairs go down - the middle of the room - first.`,
      };
    }
  }
  const name = freeAreaName(made, TUNNEL.name);
  const tunnel: MapFileArea = {
    id: freeAreaId(made, name),
    name,
    kind: 'tunnel',
    style: TUNNEL.style,
    width: TUNNEL.width,
    height: TUNNEL.height,
    ground: TUNNEL.ground,
    buildings: TUNNEL.furniture,
  };
  // The hut further north goes down to the north end.
  const [north, south] =
    huts[0].y <= huts[1].y ? [entrances[0], entrances[1]] : [entrances[1], entrances[0]];
  const down = (entrance: MapFileArea): MapFileLinkEnd => ({
    area: entrance.id,
    ...PATH_STAIRWELL,
    toward: 'left',
    look: 'stairwell',
  });
  const up = (end: (typeof TUNNEL_ENDS)[keyof typeof TUNNEL_ENDS]): MapFileLinkEnd => ({
    area: tunnel.id,
    ...end,
    look: 'tunnel-stairs',
  });
  return {
    made: true,
    area: tunnel.id,
    file: {
      ...made,
      areas: [...(made.areas ?? []), tunnel],
      links: [
        ...(made.links ?? []),
        { ends: [down(north), up(TUNNEL_ENDS.north)] },
        { ends: [down(south), up(TUNNEL_ENDS.south)] },
      ],
    },
  };
}

/** And upstairs: a bedroom, its PC and its shelves, with the stairs down along the back wall. */
const HOUSE_UPSTAIRS: InsideTemplate = {
  name: '2F',
  style: 'house',
  width: 12,
  height: 9,
  ground: wallAndFloor(12, 9),
  furniture: [
    { kind: 'computer-desk', x: 0, y: 0 },
    { kind: 'tall-drawers', x: 2, y: 0 },
    { kind: 'bookshelf', x: 3, y: 0 },
    { kind: 'notice', x: 10, y: 0 },
    { kind: 'single-bed', x: 0, y: 4 },
    { kind: 'potted-plant', x: 11, y: 6 },
  ],
};

/**
 * Where the stairs down are gone down from in a new upstairs: the rug east of
 * them, which is where a player arrives. The stairs stand two tiles west of it
 * against the back wall, as the player's own upstairs has them.
 */
const UPSTAIRS_LANDING = { x: 9, y: 2 } as const;

/**
 * The ways through a building's doors, front door first: the outdoor end each
 * stands at. A gatehouse has two, one on either side of it.
 */
export function doorEnds(building: MapFileBuilding): readonly MapFileLinkEnd[] {
  return buildingDoorways(building).map(({ x, y, toward }) => ({ x, y, toward, look: 'door' }));
}

/** The way through a building's front door: its outdoor end, if it has one. */
export function doorEnd(building: MapFileBuilding): MapFileLinkEnd | undefined {
  return doorEnds(building)[0];
}

const sameEnd = (
  a: MapFileLinkEnd,
  b: Pick<MapFileLinkEnd, 'x' | 'y' | 'area' | 'toward'>,
): boolean => a.area === b.area && a.x === b.x && a.y === b.y && a.toward === b.toward;

/** A link through one of a building's doors: which link, which of its ends is outdoors, and which door. */
export interface LinkThroughDoor {
  readonly index: number;
  readonly outside: 0 | 1;
  readonly door: number;
}

/** Every link through any of a building's doors. */
export function linksThroughDoors(file: MapFile, building: MapFileBuilding): readonly LinkThroughDoor[] {
  return doorEnds(building).flatMap((end, door) =>
    (file.links ?? []).flatMap((link, index) => {
      const outside = link.ends.findIndex((candidate) => sameEnd(candidate, end));
      return outside >= 0 ? [{ index, outside: outside as 0 | 1, door }] : [];
    }),
  );
}

/** The link through a building's doors - its front door's, when that leads anywhere - and which end is outdoors. */
export function linkThroughDoor(file: MapFile, building: MapFileBuilding): LinkThroughDoor | undefined {
  return linksThroughDoors(file, building)[0];
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
 * the middle of the room's south wall - or, for a gatehouse, from each of its
 * doors to the way out of the room on that side.
 */
export function makeInside(file: MapFile, buildingIndex: number): InsideOutcome {
  const building = file.buildings[buildingIndex];
  const doors = building ? doorEnds(building) : [];
  if (!building || doors.length === 0) {
    return { made: false, reason: 'That has no door to go in by.' };
  }
  const existing = insideOf(file, building);
  if (existing) {
    return { made: true, file, area: existing.id };
  }
  const template = templateFor(building.kind as MapFileOutdoorBuildingKind);
  const ways = template.ways?.slice(0, doors.length).length ?? 1;
  if ((file.areas ?? []).length >= MAP_FILE_LIMITS.maxAreas) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxAreas} insides.` };
  }
  if ((file.links ?? []).length + ways > MAP_FILE_LIMITS.maxLinks) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxLinks} ways through.` };
  }
  // A landmark's inside is named for it - Pewter Gym, the Department store -
  // where its name fits a place's, and anything else for the room it is.
  const landmark = BUILDING_CHOICES.find(
    (choice) =>
      choice.kind === building.kind &&
      choice.group === 'Landmarks' &&
      choice.label.length <= MAP_FILE_LIMITS.maxPlaceNameLength - 2,
  );
  const name = freeAreaName(file, landmark?.label ?? template.name);
  const area: MapFileArea = {
    id: freeAreaId(file, name),
    name,
    kind: template.kind ?? 'inside',
    style: template.style,
    width: template.width,
    height: template.height,
    ground: template.ground,
    buildings: template.furniture,
  };
  const x = template.mat ?? Math.floor(area.width / 2);
  // A room's way out is its mat, stepped off down out of the room; a cave's is
  // the daylight in its south wall, walked into from the floor above it; and
  // a gatehouse says where each of its ways out is, one for each of its doors.
  const insideEnds: readonly MapFileLinkEnd[] = template.ways
    ? template.ways.slice(0, doors.length).map((way) => ({ ...way, area: area.id }))
    : [
        area.kind === 'cave'
          ? { area: area.id, x, y: area.height - 2, toward: 'down', look: 'cave-exit' }
          : { area: area.id, x, y: area.height - 1, toward: 'down', look: 'mat' },
      ];
  return {
    made: true,
    area: area.id,
    file: {
      ...file,
      areas: [...(file.areas ?? []), area],
      links: [
        ...(file.links ?? []),
        ...insideEnds.map((inside, door) => ({ ends: [doors[door], inside] as const })),
      ],
    },
  };
}

/**
 * Everything standing in an area, and its own ways through, out of the file -
 * and then every area that is left with no way into it at all, which is the
 * upstairs of a house taken away, so nothing is left in the file that nobody
 * can reach.
 */
function withoutArea(file: MapFile, area: string): MapFile {
  const lists = Object.fromEntries(
    PLACED.filter((field) => file[field] !== undefined).map((field) => [
      field,
      ((file[field] ?? []) as readonly Placed[]).filter((thing) => thing.area !== area),
    ]),
  ) as Partial<MapFile>;
  const next: MapFile = {
    ...file,
    ...lists,
    areas: (file.areas ?? []).filter((candidate) => candidate.id !== area),
    links: (file.links ?? []).filter((link) => link.ends.every((end) => end.area !== area)),
  };
  const stranded = (next.areas ?? []).find(
    (candidate) => !(next.links ?? []).some((link) => link.ends.some((end) => end.area === candidate.id)),
  );
  return stranded ? withoutArea(next, stranded.id) : next;
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

/** Moves a building on the outdoors, and the way through each of its doors with it. */
export function moveBuilding(file: MapFile, buildingIndex: number, to: GridPoint): PlaceOutcome {
  const building = file.buildings[buildingIndex];
  const through = building ? linksThroughDoors(file, building) : [];
  const outcome = moveThing(file, { kind: 'building', index: buildingIndex }, to);
  if (!outcome.placed || through.length === 0) {
    return outcome;
  }
  const ends = doorEnds(outcome.file.buildings[buildingIndex]);
  const links = (outcome.file.links ?? []).map((link, index) => {
    const moving = through.find((candidate) => candidate.index === index);
    return moving
      ? {
          ...link,
          ends: link.ends.map((candidate, at) =>
            at === moving.outside ? ends[moving.door] : candidate,
          ) as unknown as MapFileLink['ends'],
        }
      : link;
  });
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
  // Any tile a way through is gone through from: every cell of a wide door.
  return doorwaysIn(file, area).find((doorway) =>
    landingsOf(file, doorway.at).some((tile) => tile.x === point.x && tile.y === point.y),
  );
}

/**
 * Moves the way out of a room along its wall: a mat stays on the room's
 * bottom row, or in the side wall it is let into, and a staircase or a back
 * door against the back wall, wherever along it the maker drags it. A
 * building's door end moves with its building, never on its own.
 */
export function moveDoorway(
  file: MapFile,
  doorway: Pick<DoorwayInArea, 'link' | 'end'>,
  to: GridPoint,
): MapFile {
  const link = file.links?.[doorway.link];
  const end = link?.ends[doorway.end];
  if (!link || !end || end.look === 'door') {
    return file;
  }
  const inside = areaById(file, end.area);
  if (!inside) {
    return file;
  }
  const clamp = (value: number, low: number, high: number): number =>
    Math.max(low, Math.min(high, value));
  const moved = ((): MapFileLinkEnd => {
    switch (end.look) {
      case 'stairs-up':
      case 'stairs-down': {
        // A staircase moves along the back wall it stands against, its foot
        // on the row it was on. Its rug is west of a way up and east of a way
        // down, so the whole of the staircase stays on the room wherever the
        // rug goes.
        const lowest = end.look === 'stairs-down' ? STAIRS_SIZE.width : 0;
        const highest = inside.width - 1 - (end.look === 'stairs-up' ? STAIRS_SIZE.width : 0);
        return { ...end, x: clamp(to.x, lowest, highest) };
      }
      case 'cave-exit':
        // Daylight moves along the south wall, with rock either side of it.
        return { ...end, x: clamp(to.x, 1, inside.width - 2), y: inside.height - 2, toward: 'down' };
      case 'ladder-up':
      case 'ladder-down':
        // A ladder goes anywhere on the floor, with its top or its hole the
        // tile above the one it is climbed from.
        return { ...end, x: clamp(to.x, 0, inside.width - 1), y: clamp(to.y, 1, inside.height - 1) };
      case 'back-door':
        // A doorway moves along the back wall, framed by the wall either side.
        return { ...end, x: clamp(to.x, 1, inside.width - 2) };
      case 'stairwell':
      case 'tunnel-stairs':
        // The Underground Path's stairs are where FireRed has them: the
        // middle of its entrance, and the two ends of its tunnel.
        return end;
      default:
        // A mat in a side wall moves up and down it; one at the foot of the
        // room along the south wall.
        return end.toward === 'left' || end.toward === 'right'
          ? { ...end, y: clamp(to.y, 1, inside.height - 2) }
          : { ...end, x: clamp(to.x, 0, inside.width - 1), y: inside.height - 1, toward: 'down' };
    }
  })();
  if (moved.x === end.x && moved.y === end.y) {
    return file;
  }
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
  const limits = areaLimits(inside.kind);
  const w = clamp(width, limits.minWidth, limits.maxWidth);
  const h = clamp(height, limits.minHeight, limits.maxHeight);
  if (w === inside.width && h === inside.height) {
    return file;
  }
  const ground =
    inside.kind === 'cave'
      ? caveGroundAt(inside.ground, w, h)
      : Array.from({ length: h }, (_, y) => {
          const row = inside.ground[y] ?? MATERIAL_CHARS.paving.repeat(inside.width);
          const last = row.at(-1) ?? MATERIAL_CHARS.paving;
          return (row + last.repeat(w)).slice(0, w);
        });
  const view = keepOnMap({ ...focusArea(file, area), width: w, height: h, ground });
  return withFocusedArea(file, area, view);
}

/**
 * A cave's ground at another size. A cave is ringed in rock, so its last row
 * and column stay its last - the south and east walls move out or in with the
 * size - and what is gained between is more of the row and column inside them.
 */
function caveGroundAt(ground: readonly string[], width: number, height: number): string[] {
  const across = (row: string): string => {
    const inner = row.slice(0, -1);
    const grown = (inner + (inner.at(-1) ?? MATERIAL_CHARS.paving).repeat(width)).slice(0, width - 1);
    return grown + (row.at(-1) ?? MATERIAL_CHARS.wall);
  };
  const rows = ground.map(across);
  const inner = rows.slice(0, -1);
  const filler = inner.at(-1) ?? MATERIAL_CHARS.paving.repeat(width);
  return [...inner, ...Array.from({ length: height }, () => filler)]
    .slice(0, height - 1)
    .concat(rows.at(-1) ?? MATERIAL_CHARS.wall.repeat(width));
}

/**
 * Whether a tile of an area has something on it already: a piece of
 * furniture, anything placed, or the art of one of its ways through - a mat,
 * a staircase and its rug, a ladder, a hole, a notch of daylight.
 */
export function occupiedIn(file: MapFile, area: string): (x: number, y: number) => boolean {
  const view = focusArea(file, area);
  const ways = doorwaysIn(file, area);
  const standing = [
    ...view.dropIns,
    ...view.exits,
    ...view.itemSpots,
    ...(view.people ?? []),
    ...(view.signs ?? []),
    ...(view.trainers ?? []),
    ...(view.landmarks ?? []),
    ...ways.map((doorway) => doorway.at),
  ];
  const planted = ways.flatMap(({ at }) => {
    const ahead = doorwayOf(at);
    switch (at.look) {
      case 'mat':
        return at.toward === 'left' || at.toward === 'right'
          ? [{ x: at.toward === 'left' ? at.x - 1 : at.x, y: at.y - 1, width: 2, height: 3 }]
          : [{ x: Math.max(0, at.x - 1), y: at.y, width: 3, height: 1 }];
      case 'back-door':
        return [{ x: ahead.x - 1, y: ahead.y - 1, width: 3, height: 2 }];
      case 'stairwell':
        return [{ ...stairwellAt(at), width: 3, height: 3 }];
      case 'tunnel-stairs':
        return at.toward === 'left' || at.toward === 'right'
          ? [{ ...tunnelStairsAt(at), ...TUNNEL_STAIRS_SIZE[at.toward] }]
          : [];
      case 'stairs-up':
      case 'stairs-down':
        return [{ ...stairsAt(at), ...STAIRS_SIZE }, { x: at.x, y: at.y, width: 1, height: 2 }];
      case 'cave-exit':
        return [{ x: ahead.x - 1, y: ahead.y, width: 3, height: 1 }];
      case 'ladder-up':
        return [{ x: at.x, y: at.y - 1, width: 1, height: 2 }];
      case 'ladder-down':
        return [{ x: ahead.x, y: ahead.y, width: 1, height: 1 }];
      default:
        return [];
    }
  });
  return (x, y) =>
    view.buildings.some((piece) => {
      const prop = plantedProp(piece.kind);
      return x >= piece.x && y >= piece.y && x < piece.x + prop.width && y < piece.y + prop.height;
    }) ||
    planted.some((rect) => x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height) ||
    standing.some((thing) => thing.x === x && thing.y === y);
}

/** The stairs up out of a room, if it has them. */
export function stairsUpIn(file: MapFile, area: string): DoorwayInArea | undefined {
  return doorwaysIn(file, area).find((doorway) => doorway.at.look === 'stairs-up');
}

/**
 * Gives a house's room a floor above it: a bedroom, furnished as the player's
 * own upstairs is, and a staircase up to it standing against this room's back
 * wall - at its east end, or the nearest stretch of it with room - with the
 * stairs down in the new room. Only a house has stairs: they are FireRed's
 * own house's, floor and wall and all.
 */
export function addUpstairs(file: MapFile, area: string): InsideOutcome {
  const below = areaById(file, area);
  if (!below || below.style !== 'house') {
    return { made: false, reason: 'Only a house has stairs.' };
  }
  if (stairsUpIn(file, area)) {
    return { made: false, reason: 'It has an upstairs already.' };
  }
  if ((file.areas ?? []).length >= MAP_FILE_LIMITS.maxAreas) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxAreas} insides.` };
  }
  if ((file.links ?? []).length >= MAP_FILE_LIMITS.maxLinks) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxLinks} ways through.` };
  }
  const taken = occupiedIn(file, area);
  // The stairs' top row is the back wall's lower row, under its upper one, and
  // their rug is beside their middle row, west of them.
  const top = 1;
  const free = (x: number, y: number): boolean =>
    !taken(x, y) && below.ground[y]?.[x] === MATERIAL_CHARS.paving;
  const fits = (x: number): boolean => {
    if (x < 1 || x + STAIRS_SIZE.width > below.width || top + STAIRS_SIZE.height >= below.height) {
      return false;
    }
    if (below.ground[top - 1]?.slice(x, x + STAIRS_SIZE.width) !== 'BB') {
      return false;
    }
    for (let y = top; y < top + STAIRS_SIZE.height; y += 1) {
      for (let dx = 0; dx < STAIRS_SIZE.width; dx += 1) {
        if (taken(x + dx, y)) {
          return false;
        }
      }
    }
    return free(x - 1, top + 1) && free(x - 1, top + 2);
  };
  const column = Array.from({ length: below.width }, (_, index) => below.width - 2 - index).find(fits);
  if (column === undefined) {
    return { made: false, reason: 'Clear a stretch of the back wall three tiles wide for the stairs first.' };
  }
  const name = freeAreaName(file, `${below.name} 2F`.slice(0, MAP_FILE_LIMITS.maxPlaceNameLength));
  const up: MapFileArea = {
    id: freeAreaId(file, name),
    name,
    kind: 'inside',
    style: 'house',
    width: HOUSE_UPSTAIRS.width,
    height: HOUSE_UPSTAIRS.height,
    ground: HOUSE_UPSTAIRS.ground,
    buildings: HOUSE_UPSTAIRS.furniture,
  };
  const link: MapFileLink = {
    ends: [
      { area, x: column - 1, y: top + 1, toward: 'right', look: 'stairs-up' },
      { area: up.id, ...UPSTAIRS_LANDING, toward: 'left', look: 'stairs-down' },
    ],
  };
  return {
    made: true,
    area: up.id,
    file: { ...file, areas: [...(file.areas ?? []), up], links: [...(file.links ?? []), link] },
  };
}

/** The ladder down out of a cave, if it has one. */
export function ladderDownIn(file: MapFile, area: string): DoorwayInArea | undefined {
  return doorwaysIn(file, area).find((doorway) => doorway.at.look === 'ladder-down');
}

/**
 * A floor below as Mt. Moon's basement is: a room standing on the dark, with
 * only its back wall, its floor and a drift of sand - and the ladder up out of
 * it, leant on a rock with its foot on the floor.
 */
const CAVE_BELOW: InsideTemplate = {
  name: 'B1F',
  kind: 'cave',
  style: 'cave',
  width: 16,
  height: 10,
  ground: [
    'BBBBBBBBBBBBBBBB',
    'BBBBBBBBBBBBBBBB',
    'PPPPPPPPPPPPPPPP',
    'PPPPPPPPPPPPPPPP',
    'PPPPPPPPPPPPPPPP',
    'PPPPPPPPPPPPPPPP',
    'dPPPPPPPPPPPPPPP',
    'ddPPPPPPPPPPPPPP',
    'dddPPPPPPPPPPPPP',
    'ddddPPPPPPPPPPPP',
  ],
  furniture: [
    { kind: 'boulder', x: 1, y: 2 },
    { kind: 'rocks', x: 2, y: 2 },
    { kind: 'rocks', x: 15, y: 7 },
  ],
};

/** Where the ladder up out of a new floor below is climbed from: its foot, a row under its top. */
const BELOW_LANDING = { x: 12, y: 4 } as const;

/** The name of the floor below one: B1F under Cave, B2F under Cave B1F. */
function belowName(name: string): string {
  const deeper = /^(.*) B(\d+)F$/.exec(name);
  return deeper ? `${deeper[1]} B${Number(deeper[2]) + 1}F` : `${name} B1F`;
}

/**
 * A floor below a cave: a hole with a ladder down it, cut in the first clear
 * stretch of floor from the cave's north-east, and the ladder up out of the
 * new floor that it leads to.
 */
export function addFloorBelow(file: MapFile, area: string): InsideOutcome {
  const cave = areaById(file, area);
  if (!cave || cave.kind !== 'cave') {
    return { made: false, reason: 'Only a cave goes down a ladder.' };
  }
  if (ladderDownIn(file, area)) {
    return { made: false, reason: 'It has a floor below already.' };
  }
  if ((file.areas ?? []).length >= MAP_FILE_LIMITS.maxAreas) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxAreas} insides.` };
  }
  if ((file.links ?? []).length >= MAP_FILE_LIMITS.maxLinks) {
    return { made: false, reason: `A map has at most ${MAP_FILE_LIMITS.maxLinks} ways through.` };
  }
  const taken = occupiedIn(file, area);
  const floor = (x: number, y: number): boolean => {
    const letter = cave.ground[y]?.[x];
    return (letter === MATERIAL_CHARS.paving || letter === MATERIAL_CHARS.sand) && !taken(x, y);
  };
  // The hole, and the tile in front of it it is walked into from.
  let hole: GridPoint | undefined;
  // Out in the floor, as FireRed's are: a row clear of the back wall and a
  // column clear of the side.
  for (let y = 3; y < cave.height - 2 && !hole; y += 1) {
    for (let x = cave.width - 4; x >= 1 && !hole; x -= 1) {
      if (floor(x, y) && floor(x, y + 1)) {
        hole = { x, y };
      }
    }
  }
  if (!hole) {
    return { made: false, reason: 'Clear two tiles of floor, one above the other, for the ladder first.' };
  }
  const name = freeAreaName(file, belowName(cave.name).slice(0, MAP_FILE_LIMITS.maxPlaceNameLength));
  const below: MapFileArea = {
    id: freeAreaId(file, name),
    name,
    kind: 'cave',
    style: cave.style,
    width: CAVE_BELOW.width,
    height: CAVE_BELOW.height,
    ground: CAVE_BELOW.ground,
    buildings: CAVE_BELOW.furniture,
  };
  const link: MapFileLink = {
    ends: [
      { area, x: hole.x, y: hole.y + 1, toward: 'up', look: 'ladder-down' },
      { area: below.id, ...BELOW_LANDING, toward: 'up', look: 'ladder-up' },
    ],
  };
  return {
    made: true,
    area: below.id,
    file: { ...file, areas: [...(file.areas ?? []), below], links: [...(file.links ?? []), link] },
  };
}
