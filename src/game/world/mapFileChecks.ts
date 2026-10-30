import {
  DIRECTION_DELTAS,
  linkTable,
  type GridLinks,
  type GridPosition,
} from '../movement/gridMovement';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { RAID_DURATION_MS } from '../run/raidClock';
import { HUNTER_SPAWN_DISTANCE } from './hunter';
import {
  composeMapFile,
  doorwayOf,
  stairwellAt,
  TUNNEL_STAIRS_SIZE,
  tunnelStairsAt,
  landingsOf,
  searchedLinks,
  stairsAt,
  stairsToward,
  type ComposedMap,
} from './mapAreas';
import {
  beatSpots,
  buildingDoorAt,
  doorFront,
  fileDoorGates,
  fileLedges,
  isBarredFileExit,
  plantedProp,
  readMapFile,
  type MapFile,
  type MapFileArea,
  type MapFileBuilding,
  type MapFileDoorwayLook,
  type MapFileDoorKind,
  type MapFileLimits,
  type MapFileLinkEnd,
  type MapFileSpot,
} from './mapFile';
import { MATERIAL_CHARS } from './tileset/materials';
import { insideBackDoor, insideLift, insideSideMat, insideStairs, insideStairwell } from './tileset/insideTileset';
import { liftLinks, liftNeedsPower } from './lifts';
import { gateKey } from './gates';
import { isBlockedAt, stepDistances, type CollisionGrid } from './mapStructure';
import { pokemonName } from './pokemonFigures';
import { berryName } from './berries';
import { trainerSightTiles } from './trainerSight';
import { refusedWords } from './wordFilter';
import { courseFaults, coursePath, sailingLinks } from './sailing';

/**
 * Whether a map works - and nothing else.
 *
 * The captain's rule for player maps (2026-10-03, D2 and P3): no design rules,
 * only "does it work" checks. A map may be one open field or one long corridor;
 * what it may not be is a raid somebody cannot finish. Every check here is a
 * way a map can break a raid, said in the words a maker reads, and they are the
 * same checks whether the map is in the editor, in the review queue or being
 * published - so a map that passes in the editor is never refused later for a
 * reason nobody showed its maker.
 *
 * One of the plan's checks is not here because it is not a fact about the
 * file: that the maker walked it out in the editor's TRY IT. It joins the list
 * where that fact lives (`maker/makerView.ts`).
 *
 * Townsfolk, signs, standing Pokemon, berry trees and boulders are walls you
 * cannot walk into, so
 * every walk below is measured with them standing where they were put: a
 * person in the only lane to an exit is a raid with no way out, which is the
 * trap a figure on a door once sprang on the captain. A trainer is walked
 * into - that is the fight - so a trainer never shuts a walk; what one may not
 * do is watch a drop-in or an exit, because a fight forced on the first step
 * or the last is a raid nobody chose. A boulder is a wall for the way out -
 * nobody has to bring Strength to leave - and moves aside for what can be
 * reached, as a door opens; an exit buried under rubble is never the way out,
 * because nobody has to bring a Pickaxe either. A rock barrier is the same:
 * shut for the way out, open for what can be reached (`switches.ts`).
 */

export type MapCheckId =
  | 'loads'
  | 'standing'
  | 'apart'
  | 'doors'
  | 'way-out'
  | 'reachable'
  | 'areas'
  | 'hunter-room'
  | 'watch'
  | 'words';

export interface MapCheck {
  readonly id: MapCheckId;
  /** What the check asks, as a maker reads it. */
  readonly label: string;
  readonly passed: boolean;
  /** Why it failed, naming the places at fault; empty when it passed. */
  readonly problems: readonly string[];
  /** The same, each with the tiles it is about, for an editor to take its maker there. */
  readonly faults: readonly MapFault[];
}

/** A tile a fault is about, in its own area's tiles, as the maker placed it. */
export interface MapFaultPlace {
  readonly x: number;
  readonly y: number;
  /** The inside it is in; absent is the outdoors. */
  readonly area?: string;
}

/** One way a map fails a check, and where. */
export interface MapFault {
  /** What is wrong, in the words a maker reads: one of the check's `problems`. */
  readonly text: string;
  /** The tiles it is about, the one to look at first; none when it is about the whole map. */
  readonly places: readonly MapFaultPlace[];
  /**
   * What kind of thing it is about, in the plural - "berry trees", "drop-ins" -
   * so a run of the same kind can be read as one line with a count.
   */
  readonly group: string;
  /**
   * What is wrong with every one of its group, as a plural verb phrase - "stand
   * in the trees" - so a run of one kind can be headed "7 berry trees stand in
   * the trees". Absent where a run of the kind need not share it.
   */
  readonly says?: string;
}

/** What each way through is called in a problem with it. */
const DOORWAY_NAMES: Readonly<Record<MapFileDoorwayLook, string>> = {
  door: 'door',
  mat: 'way out',
  'back-door': 'back door',
  stairwell: 'stairs down',
  'tunnel-stairs': 'stairs up',
  'stairs-up': 'stairs',
  'stairs-down': 'stairs',
  'cave-exit': 'way out',
  'ladder-up': 'ladder up',
  'ladder-down': 'ladder down',
  boat: 'boat',
};

/** The ways through a cave has, and nothing else does. */
const CAVE_LOOKS: readonly MapFileDoorwayLook[] = ['cave-exit', 'ladder-up', 'ladder-down'];
const TOWER_LOOKS: readonly MapFileDoorwayLook[] = ['stairs-up', 'stairs-down', 'mat'];

const LABELS: Readonly<Record<MapCheckId, string>> = {
  loads: 'It has a name, a maker, a drop-in and an exit',
  standing: 'Everything stands on ground you can walk on',
  apart: 'No two things share a tile',
  doors: 'Every door leads somewhere you can stand',
  'way-out': 'Every drop-in can walk out before the clock runs out',
  reachable: 'Every exit, item spot and landmark can be walked to',
  areas: 'Every inside and cave can be walked into',
  'hunter-room': 'The hunter has room to arrive near every drop-in',
  watch: 'No trainer watches a drop-in or an exit',
  words: 'Every name and line is fit for everyone',
};

/** What the first check is called when the file itself is broken, not merely unfinished. */
const BROKEN_FILE_LABEL = 'The game can load it';

/**
 * What a draft still lacks, said as where in the maker it is done: the shape
 * check's own words name a field ("its maker's name") the maker never sees by
 * that name, and say a drop-in is needed without saying what one is
 * (playtest 39 A4).
 */
const STILL_TO_DO: Readonly<Record<string, string>> = {
  'The map needs a name.': 'Type a name in Name, under The map.',
  "The map needs its maker's name.": 'Type your name in Drawn by, under The map.',
  'A map needs at least 1 drop-in.': 'Put down a Drop-in from Places, under Paint: where a raid starts.',
  'A map needs at least 1 exit.': 'Put down an Exit from Places, under Paint: the way out.',
};

/** How long a raid lasts, as the checks say it. */
const RAID_MINUTES = Math.round(RAID_DURATION_MS / 60_000);

const at = ({ x, y }: GridPosition): string => `${x},${y}`;

/** What standing on a tile of solid ground is called, outdoors. */
const SOLID_GROUND: Readonly<Record<string, string>> = {
  [MATERIAL_CHARS.tree]: 'stands in the trees',
  [MATERIAL_CHARS.hedge]: 'stands in a hedge',
  o: 'stands on a bush',
  u: 'stands on a bush',
  k: 'stands on a bush',
  [MATERIAL_CHARS.water]: 'stands in deep water',
  [MATERIAL_CHARS.cliff]: 'stands on rock',
  [MATERIAL_CHARS.fence]: 'stands on a fence',
  [MATERIAL_CHARS.wall]: 'stands in a wall',
  '<': 'stands on a ledge',
  '=': 'stands on a ledge',
  '>': 'stands on a ledge',
};

/** What a door shut by a field move is, stood on. */
const ON_A_DOOR: Readonly<Record<MapFileDoorKind, string>> = {
  'cut-tree': 'stands on a small tree',
  'smash-rock': 'stands on a cracked rock',
  surf: 'stands in deep water',
  night: 'stands on a night track, which is wood by day',
  boss: "stands on a keeper's gate, sandbagged shut",
};

/** Words of a piece's name that are names, and are written as the games write them. */
const PROPER_WORDS: Readonly<Record<string, string>> = {
  pokemon: 'Pokémon',
  poke: 'Poké',
  pewter: 'Pewter',
  cerulean: 'Cerulean',
  vermilion: 'Vermilion',
  celadon: 'Celadon',
  fuchsia: 'Fuchsia',
  saffron: 'Saffron',
  cinnabar: 'Cinnabar',
  silph: 'Silph',
  co: 'Co.',
  safari: 'Safari',
  league: 'League',
  game: 'Game',
  corner: 'Corner',
  center: 'Center',
  mart: 'Mart',
  ss: 'S.S.',
  anne: 'Anne',
  lapras: 'Lapras',
};

/**
 * A thing by its kind and its name, said once: "Drop-in South Road", but
 * "Drop-in 1" for a drop-in the maker left named "Drop-in 1", where kind and
 * name together read "Drop-in Drop-in 1" (playtest 39 A1).
 */
export function kindAndName(kind: string, name: string): string {
  return name.toLowerCase().startsWith(`${kind.toLowerCase()} `) ? name : `${kind} ${name}`;
}

/**
 * A planted piece by the file's own word for it, as words: "house", "Pewter
 * gym", "Pokémon Center". A shut-door copy of a building is the building.
 */
function pieceWords(kind: string): string {
  return kind
    .replace(/-door$/, '')
    .replace(/-\d+$/, '')
    .split('-')
    .map((word) => PROPER_WORDS[word] ?? word)
    .join(' ');
}

/**
 * What a thing standing on a solid tile is standing on, as the maker drew it -
 * "stands in the trees", "stands on the house" - because "something solid" sent
 * a maker hunting through the map for what it was.
 */
function standsOn(file: MapFile, spot: MapFileSpot): string {
  const area =
    spot.area === undefined
      ? undefined
      : file.areas?.find((candidate) => candidate.id === spot.area);
  const pieces = area ? area.buildings : file.buildings;
  // The piece planted last is drawn on top, so it is the one stood on.
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const piece = pieces[index];
    const prop = plantedProp(piece.kind);
    const column = spot.x - piece.x;
    const row = spot.y - piece.y;
    if (column < 0 || row < 0 || column >= prop.width || row >= prop.height) {
      continue;
    }
    const cell = prop.cells[row * prop.width + column];
    if (cell.tile >= 0 && !cell.canopy && cell.solid) {
      return `stands on the ${pieceWords(piece.kind)}`;
    }
  }
  if (!area) {
    const door = (file.doors ?? []).find(
      (candidate) =>
        spot.x >= candidate.x &&
        spot.y >= candidate.y &&
        spot.x < candidate.x + candidate.width &&
        spot.y < candidate.y + candidate.height,
    );
    if (door) {
      return ON_A_DOOR[door.kind];
    }
  }
  const letter = (area ? area.ground : file.ground)[spot.y]?.[spot.x] ?? '';
  if (area) {
    return letter === MATERIAL_CHARS.cliff
      ? 'stands in the dark outside the room'
      : area.kind === 'cave'
        ? "stands in the cave's rock"
        : "stands in the room's wall";
  }
  return SOLID_GROUND[letter] ?? 'is on something solid';
}

/**
 * The grid a file map is played on - its own drawing, every inside laid out
 * beside it, through the game's own builder - and the ways through it, with
 * its Cut trees and Surf water shut, as a fresh save meets them, or, asked
 * for, opened.
 */
export function mapFileGrid(
  file: MapFile,
  doorsOpen = false,
): {
  readonly composed: ComposedMap;
  readonly collision: CollisionGrid;
  readonly links: GridLinks;
} {
  const composed = composeMapFile(file, doorsOpen ? fileDoorGates(file).map(gateKey) : []);
  return {
    composed,
    collision: composed.layers.collision,
    links: linkTable(searchedLinks(composed.doorways), composed.width),
  };
}

/**
 * Where a thing placed in its own area's tiles stands on the one grid every
 * area of a file is laid out in.
 */
export function spotPlacer(composed: ComposedMap): (spot: MapFileSpot) => GridPosition {
  const origins = new Map(composed.areas.map((placed) => [placed.id, placed.rect]));
  return (spot) => {
    const origin = origins.get(spot.area) ?? composed.areas[0].rect;
    return { x: origin.x + spot.x, y: origin.y + spot.y };
  };
}

/**
 * Every check, in the order a maker fixes them. A file that does not load
 * cannot be asked anything else, so it answers the first check and fails the
 * rest with nothing to say about them.
 */
export function checkMapFile(
  value: unknown,
  /** What the file may hold: a player's map is held to `MAP_FILE_LIMITS`, the default. */
  { limits }: { readonly limits?: MapFileLimits } = {},
): readonly MapCheck[] {
  const check = (id: MapCheckId, faults: readonly MapFault[]): MapCheck => ({
    id,
    label: LABELS[id],
    passed: faults.length === 0,
    problems: faults.map((fault) => fault.text),
    faults,
  });
  const unloadable = (problems: readonly string[], unfinished = false): readonly MapCheck[] =>
    (Object.keys(LABELS) as MapCheckId[])
      .filter((id) => id !== 'doors' && id !== 'areas')
      .map((id) =>
        id === 'loads'
          ? {
              ...check(
                id,
                problems.map((text) => ({
                  text: unfinished ? (STILL_TO_DO[text] ?? text) : text,
                  places: [],
                  group: unfinished ? 'things still to do' : 'problems with the file',
                })),
              ),
              // A file broken past what a draft may be is not a list of
              // things to do, so it is said as the file not loading.
              ...(unfinished ? {} : { label: BROKEN_FILE_LABEL }),
            }
          : { ...check(id, []), passed: false },
      );
  const reading = readMapFile(value, { limits });
  if (!reading.ok) {
    return unloadable(reading.problems, readMapFile(value, { limits, draft: true }).ok);
  }
  const file = reading.file;
  // The shape check is meant to refuse anything the game cannot draw, but the
  // checks are asked of every map in the editor, the review queue and the
  // publish run: a file that slipped past it must fail here, not throw, or one
  // bad map bricks every screen that opens it.
  let grid: ReturnType<typeof mapFileGrid>;
  let openCollision: CollisionGrid;
  try {
    grid = mapFileGrid(file);
    openCollision = mapFileGrid(file, true).collision;
  } catch (error) {
    return unloadable([
      `The game cannot draw it: ${error instanceof Error ? error.message : String(error)}.`,
    ]);
  }
  const { composed, collision, links } = grid;
  // Everything in the file is placed in its own area's tiles, and measured on
  // the one grid every area is laid out in. A problem names the tile as the
  // maker placed it, and the area it is in.
  const origins = new Map(composed.areas.map((placed) => [placed.id, placed]));
  const onGrid = spotPlacer(composed);
  const tileOf = (spot: MapFileSpot): string => {
    const area = spot.area === undefined ? undefined : origins.get(spot.area);
    return area ? `${at(spot)} in ${area.name}` : at(spot);
  };
  const walkable = (spot: MapFileSpot): boolean => {
    const tile = onGrid(spot);
    return !isBlockedAt(collision, tile.x, tile.y);
  };
  const people = file.people ?? [];
  const signs = file.signs ?? [];
  const landmarks = file.landmarks ?? [];
  const trainers = file.trainers ?? [];
  const pokemon = file.pokemon ?? [];
  const berryTrees = file.berryTrees ?? [];
  const boulders = file.boulders ?? [];
  const plates = (file.areas ?? []).flatMap((area) =>
    (area.switches ?? [])
      .filter((spot) => spot.kind === 'plate')
      .map((spot) => ({ spot, area: area.id })),
  );
  const barrierTiles = (file.areas ?? []).flatMap((area) =>
    (area.barriers ?? []).flatMap((barrier) =>
      Array.from({ length: barrier.width * barrier.height }, (_tile, cell) => ({
        id: barrier.id,
        spot: {
          x: barrier.x + (cell % barrier.width),
          y: barrier.y + Math.floor(cell / barrier.width),
          area: area.id,
        },
      })),
    ),
  );
  const liftStops = (file.areas ?? []).flatMap((area) =>
    area.lift ? [{ spot: { x: area.lift.x, y: area.lift.y, area: area.id }, area }] : [],
  );
  const named = [
    ...file.dropIns.map((spot) => ({
      spot,
      what: kindAndName('Drop-in', spot.name),
      group: 'drop-ins',
    })),
    ...file.exits.map((spot) => ({ spot, what: kindAndName('Exit', spot.name), group: 'exits' })),
    ...file.itemSpots.map((spot, index) => ({
      spot,
      what: `Item spot ${index + 1}`,
      group: 'item spots',
    })),
    ...landmarks.map((spot) => ({
      spot,
      what: kindAndName('Landmark', spot.name),
      group: 'landmarks',
    })),
    ...people.map((spot) => ({ spot, what: `${spot.name}`, group: 'people' })),
    ...signs.map((spot, index) => ({ spot, what: `Sign ${index + 1}`, group: 'signs' })),
    ...trainers.map((spot) => ({
      spot,
      what: kindAndName('Trainer', spot.name),
      group: 'trainers',
    })),
    ...pokemon.map((spot) => ({ spot, what: pokemonName(spot.species), group: 'Pokémon' })),
    ...berryTrees.map((spot) => ({
      spot,
      what: `${berryName(spot.berry)} tree`,
      group: 'berry trees',
    })),
    ...boulders.map((spot, index) => ({ spot, what: `Boulder ${index + 1}`, group: 'boulders' })),
    // A beat's other tiles stand on ground and share with nothing, as its first does.
    ...[...people, ...pokemon].flatMap((figure) =>
      beatSpots(figure)
        .slice(1)
        .map((spot) => ({ spot, what: 'A figure\u2019s beat', group: 'beats' })),
    ),
    // A floor switch is floor a boulder is pushed onto, and a barrier is a
    // wall across a way that opens onto floor: both stand on walkable ground.
    ...plates.map(({ spot, area }, index) => ({
      spot: { x: spot.x, y: spot.y, area },
      what: `Floor switch ${index + 1}`,
      group: 'floor switches',
    })),
    ...barrierTiles.map(({ spot, id }) => ({ spot, what: `Barrier ${id}`, group: 'barriers' })),
    ...liftStops.map(({ spot, area }) => ({ spot, what: `The lift in ${area.name}`, group: 'doorways' })),
  ];
  /** A fault about the things on some tiles, the first of them the one to look at. */
  const fault = (
    text: string,
    kind: string | { readonly group: string; readonly says: string },
    ...places: readonly MapFileSpot[]
  ): MapFault => ({
    text,
    ...(typeof kind === 'string' ? { group: kind } : kind),
    places: places.map(({ x, y, area }) => (area === undefined ? { x, y } : { x, y, area })),
  });
  /** "stands in the trees" said of many: "stand in the trees". */
  const plural = (phrase: string): string =>
    phrase.replace(/^stands /, 'stand ').replace(/^is /, 'are ');

  const standing = named
    .filter(({ spot }) => !walkable(spot))
    .map(({ spot, what, group }) => {
      const on = standsOn(file, spot);
      return fault(`${what} at ${tileOf(spot)} ${on}.`, { group, says: plural(on) }, spot);
    });

  // Where each way through is stood on, named by what it goes through.
  const fileLinks = file.links ?? [];
  const areaName = (end: MapFileLinkEnd): string =>
    end.area === undefined ? 'outside' : (origins.get(end.area)?.name ?? end.area);
  const areaOf = (end: MapFileLinkEnd): MapFileArea | undefined =>
    end.area === undefined ? undefined : file.areas?.find((area) => area.id === end.area);
  /** The building whose door a way through outdoors is stood in front of. */
  const buildingAt = (end: MapFileLinkEnd): MapFileBuilding | undefined =>
    buildingDoorAt(file, end)?.building;
  const doorwayName = (end: MapFileLinkEnd, other: MapFileLinkEnd): string => {
    const named =
      end.look === 'door' && buildingAt(end)?.kind === 'cave-mouth'
        ? 'cave mouth'
        : DOORWAY_NAMES[end.look];
    return `The ${named} at ${tileOf(end)} to ${areaName(other)}`;
  };
  // Every tile a way through is gone through from - all of a wide door, all
  // three of a mat - is its, and nothing else may stand there.
  const landings = fileLinks.flatMap((link) =>
    link.ends.flatMap((end, index) => {
      const what = doorwayName(end, link.ends[1 - index]);
      return landingsOf(file, end).map((tile) => ({
        spot: { ...tile, area: end.area },
        what,
        group: 'doorways',
      }));
    }),
  );

  const holders = new Map<string, { spot: MapFileSpot; whats: string[] }>();
  for (const { spot, what } of [...named, ...landings]) {
    const key = at(onGrid(spot));
    const holding = holders.get(key) ?? { spot, whats: [] };
    holding.whats.push(what);
    holders.set(key, holding);
  }
  const apart = [...holders.values()]
    .filter(({ whats }) => whats.length > 1)
    .map(({ spot, whats }) =>
      fault(
        `${whats.join(' and ')} share the tile ${tileOf(spot)}.`,
        { group: 'tiles', says: 'hold two things at once' },
        spot,
      ),
    );

  const doors = fileLinks.flatMap((link) =>
    link.ends.flatMap((end, index) => {
      const other = link.ends[1 - index];
      const what = doorwayName(end, other);
      const found: string[] = [];
      if (!walkable(end)) {
        found.push(`${what} ${standsOn(file, end)}.`);
      }
      const area = areaOf(end);
      const kind = area?.kind;
      const ground = (x: number, y: number): string | undefined => area?.ground[y]?.[x];
      const doorway = doorwayOf(end);
      if (end.look === 'boat') {
        // A boat lies off its jetty in deep water, the way it is boarded.
        if (
          end.area !== undefined ||
          file.ground[doorway.y]?.[doorway.x] !== MATERIAL_CHARS.water
        ) {
          found.push(`${what} has to lie in deep water off its jetty, the way it is boarded.`);
        }
      } else if (end.look === 'door') {
        const building = buildingAt(end);
        if (!building) {
          found.push(`${what} is not in front of a building's door.`);
        } else if (building.kind === 'cave-mouth') {
          // FireRed cuts a cave's mouth into the foot of a rock face.
          const rock = (x: number, y: number): boolean =>
            file.ground[y]?.[x] === MATERIAL_CHARS.cliff;
          if (
            !rock(building.x, building.y) ||
            !rock(building.x - 1, building.y) ||
            !rock(building.x + 1, building.y) ||
            !rock(building.x, building.y - 1)
          ) {
            found.push(
              `${what} has to be cut into the foot of a rock face, with rock either side of it and above it.`,
            );
          }
          if (areaOf(other)?.kind !== 'cave') {
            found.push(`${what} has to lead into a cave.`);
          }
        } else if (areaOf(other)?.kind !== 'inside' && areaOf(other)?.kind !== 'tower') {
          found.push(`${what} has to lead into the inside of a building.`);
        }
      } else if (kind === 'tower' && !TOWER_LOOKS.includes(end.look)) {
        // A tower floor is gone into by its mat and between floors by its stairs.
        found.push(`${what} cannot be on a tower floor: its ways through are its stairs and its mat.`);
      } else if ((end.look === 'stairs-up' || end.look === 'stairs-down') && kind === 'tower') {
        // FireRed lets a tower's stairs into the edge of its floor, up on the
        // east and down on the west: every tile of them is floor, and beyond
        // them is the edge of the room.
        const top = stairsAt(end);
        const floor = (x: number, y: number): boolean => ground(x, y) === MATERIAL_CHARS.paving;
        const beyond = end.look === 'stairs-up' ? top.x + top.width : top.x - 1;
        const fits =
          end.toward === stairsToward(end.look) &&
          [0, 1, 2].every((dy) => floor(top.x, top.y + dy) && floor(top.x + 1, top.y + dy)) &&
          !floor(beyond, end.y);
        if (!fits) {
          found.push(
            `${what} has to be let into the ${end.look === 'stairs-up' ? 'east' : 'west'} edge of the tower floor, on floor three tiles deep.`,
          );
        }
      } else if (end.look === 'tunnel-stairs' || kind === 'tunnel') {
        // A tunnel is gone down into and come up out of by its stairs, and
        // they are nothing else's.
        if (end.look !== 'tunnel-stairs') {
          found.push(`${what} cannot be in a tunnel: its ways out are its stairs up.`);
        } else if (kind !== 'tunnel') {
          found.push(`${what} belongs in a tunnel.`);
        } else {
          const at = tunnelStairsAt(end);
          const size =
            end.toward === 'left' || end.toward === 'right'
              ? TUNNEL_STAIRS_SIZE[end.toward]
              : undefined;
          if (
            !size ||
            at.x < 0 ||
            at.y < 0 ||
            at.x + size.width > area!.width ||
            at.y + size.height > area!.height
          ) {
            found.push(
              `${what} has to stand in the tunnel, pressed into west or east from beside them.`,
            );
          }
        }
      } else if (end.look === 'stairwell') {
        // The stairwell down into the Underground Path, in the floor of its
        // entrance, with floor round it.
        const at = stairwellAt(end);
        const floor = (x: number, y: number): boolean => ground(x, y) === MATERIAL_CHARS.paving;
        const clear = [0, 1, 2].every((dy) => [0, 1, 2].every((dx) => floor(at.x + dx, at.y + dy)));
        if (!area || !insideStairwell(area.style)) {
          found.push(`${what} is the Underground Path's: give the room the Gatehouse look.`);
        } else if (end.toward !== 'left' || !clear) {
          found.push(
            `${what} needs clear floor three tiles square, gone into westward from its east side.`,
          );
        }
      } else if (CAVE_LOOKS.includes(end.look) && kind !== 'cave') {
        found.push(`${what} belongs in a cave.`);
      } else if (!CAVE_LOOKS.includes(end.look) && kind === 'cave') {
        found.push(`${what} belongs in a building: a cave's way out is cut into its south wall.`);
      } else if (end.look === 'cave-exit') {
        // Daylight in a notch of the south wall, with rock either side of it.
        const wall = (x: number): boolean => ground(x, doorway.y) === MATERIAL_CHARS.wall;
        if (
          end.toward !== 'down' ||
          !wall(doorway.x) ||
          !wall(doorway.x - 1) ||
          !wall(doorway.x + 1)
        ) {
          found.push(
            `${what} has to be cut into the cave's south wall, with rock either side of it.`,
          );
        }
      } else if (end.look === 'ladder-up') {
        if (end.toward !== 'up' || ground(end.x, end.y - 1) === undefined) {
          found.push(`${what} needs a tile above it for the ladder.`);
        }
      } else if (end.look === 'ladder-down') {
        const under = ground(doorway.x, doorway.y);
        if (under === undefined || under === MATERIAL_CHARS.wall) {
          found.push(`${what} has to have floor for its hole, the way it faces.`);
        }
      } else if (end.look === 'stairs-up' || end.look === 'stairs-down') {
        // A staircase stands against the back wall of a room, which is two
        // rows deep: whatever of those two rows the staircase does not stand
        // in is wall above it, and all of it is on the room.
        const top = area ? stairsAt(end, area.style) : stairsAt(end);
        const above = area ? 2 - insideStairs(area.style, end.look).wallRows : 1;
        const fits =
          area !== undefined &&
          end.toward === stairsToward(end.look, area.style) &&
          top.x >= 0 &&
          top.y >= above &&
          top.x + top.width <= area.width &&
          top.y + top.height <= area.height &&
          Array.from({ length: above }, (_, row) => area.ground[top.y - 1 - row]).every((ground) =>
            [...ground.slice(top.x, top.x + top.width)].every((letter) => letter === 'B'),
          );
        if (!fits) {
          found.push(`${what} has to stand against the back wall of the room.`);
        }
      } else if (end.look === 'back-door') {
        // A doorway let into the back wall, walked up into from the floor
        // below it, with wall either side of it to frame it.
        const wall = (x: number, y: number): boolean => ground(x, y) === MATERIAL_CHARS.wall;
        const framed =
          end.toward === 'up' &&
          [-1, 0, 1].every(
            (dx) => wall(doorway.x + dx, doorway.y) && wall(doorway.x + dx, doorway.y - 1),
          );
        if (!framed) {
          found.push(
            `${what} has to be let into the back wall of the room, with wall either side of it.`,
          );
        } else if (area && !insideBackDoor(area.style)) {
          found.push(`${what} is a gatehouse's: give the room the Gatehouse look.`);
        }
      } else {
        // A mat is stepped off out of the room, over its edge, the dark beyond
        // its walls, or a wall: at its foot, or let into a side wall.
        const beyond = area?.ground[doorway.y]?.[doorway.x];
        const againstTheEdge =
          area !== undefined &&
          (doorway.x < 0 ||
            doorway.y < 0 ||
            doorway.x >= area.width ||
            doorway.y >= area.height ||
            beyond === MATERIAL_CHARS.wall ||
            beyond === MATERIAL_CHARS.cliff);
        if (!againstTheEdge || end.toward === 'up') {
          found.push(`${what} has to be against the room's wall, stepped off the way it faces.`);
        } else if (
          area &&
          (end.toward === 'left' || end.toward === 'right') &&
          !insideSideMat(area.style, end.toward)
        ) {
          found.push(
            `${what} is let into a side wall, as a gatehouse's is: give the room the Gatehouse look.`,
          );
        }
      }
      return found.map((text) => fault(text, 'doorways', end));
    }),
  );
  // A lift's door is let into the back wall above where it is stood on, with
  // wall either side of it and above it, in a room that has a lift to draw.
  for (const { spot, area } of liftStops) {
    const wall = (x: number, y: number): boolean => area.ground[y]?.[x] === MATERIAL_CHARS.wall;
    const framed = [-1, 0, 1].every((dx) => wall(spot.x + dx, spot.y - 1) && wall(spot.x + dx, spot.y - 2));
    if (!insideLift(area.style)) {
      doors.push(fault(`The lift in ${area.name} is the Rocket Hideout's: give the room the Rocket Hideout look.`, 'doorways', spot));
    } else if (!framed) {
      doors.push(
        fault(`The lift in ${area.name} has to be let into the back wall, with wall either side of it.`, 'doorways', spot),
      );
    }
  }
  // A boat sails straight from turn to turn, and only over deep water.
  for (const link of fileLinks) {
    if (!link.sails) {
      continue;
    }
    const [a, b] = link.ends;
    const turns = [doorwayOf(a), ...link.sails.course, doorwayOf(b)];
    const crooked = courseFaults(turns);
    const dry = coursePath(turns).filter(
      (tile) => file.ground[tile.y]?.[tile.x] !== MATERIAL_CHARS.water,
    );
    if (crooked.length > 0 || dry.length > 0) {
      doors.push(
        fault(
          `The boat ${link.sails.name} ${crooked.length > 0 ? crooked[0] : `runs aground at ${at(dry[0])}`}: a course is straight legs of deep water.`,
          'doorways',
          ...(dry.length > 0 ? [dry[0]] : []),
          a,
        ),
      );
    }
  }
  // A cave mouth is a way in or it is a hole in a hill that goes nowhere.
  for (const building of file.buildings) {
    const front = doorFront(building);
    if (
      building.kind === 'cave-mouth' &&
      front &&
      !fileLinks.some((link) =>
        link.ends.some((end) => end.area === undefined && end.x === front.x && end.y === front.y),
      )
    ) {
      doors.push(
        fault(
          `The cave mouth at ${at(building)} leads nowhere: make its cave, or take it away.`,
          'cave mouths',
          building,
        ),
      );
    }
  }

  // Every walk is measured with every exit but the one being walked to shut,
  // because an open exit takes whoever steps on it: a way out that is only
  // reached across another exit is not a way out, it is that exit.
  const exitTiles = new Set(file.exits.map((exit) => at(onGrid(exit))));
  // A figure that keeps a beat is a wall on every tile of it, whichever it is on.
  const figureTiles = [...people, ...signs, ...pokemon, ...berryTrees].flatMap((spot) =>
    beatSpots(spot).map((tile) => at(onGrid(tile))),
  );
  // A rock barrier is a wall for the way out, as a boulder is - nobody has to
  // solve a floor of switches to leave - and stands open for what is reached.
  const shut = new Set([
    ...exitTiles,
    ...figureTiles,
    ...boulders.map((spot) => at(onGrid(spot))),
    ...barrierTiles.map(({ spot }) => at(onGrid(spot))),
  ]);
  const pushedAside = new Set([...exitTiles, ...figureTiles]);
  // A painted ledge is a way down that only the player has (`ledges.ts`), so
  // every walk a player takes may hop it - one way, as the game does, and only
  // onto ground that is free - while the hunter's room is still asked of the
  // ground alone, because the hunter cannot follow.
  const hops = fileLedges(file).flatMap((ledge) =>
    ledge.brow.map((from) => {
      // Where it puts the player down, as the maker sees the map.
      const landing = {
        x: from.x + DIRECTION_DELTAS[ledge.drop].x * (ledge.depth + 1),
        y: from.y + DIRECTION_DELTAS[ledge.drop].y * (ledge.depth + 1),
      };
      return {
        // Where the maker painted it: the ledge tile in front of the brow.
        ledge: {
          x: ledge.brow[0].x + DIRECTION_DELTAS[ledge.drop].x,
          y: ledge.brow[0].y + DIRECTION_DELTAS[ledge.drop].y,
        },
        landing,
        from: onGrid(from),
        toward: ledge.drop,
        to: onGrid(landing),
      };
    }),
  );
  // A boat is a player's too, and the hunter's room is asked without it; so
  // is a lift, which runs for what is reached - as a barrier stands open - and
  // is ridden on the way out only if nothing has to be switched on to run it,
  // because nobody has to bring a floor back to life to leave.
  const switches = (file.areas ?? []).flatMap((area) => area.switches ?? []);
  const walksOut: GridLinks = new Map([
    ...links,
    ...linkTable(hops, composed.width),
    ...linkTable(sailingLinks(composed.sailings), composed.width),
    ...linkTable(liftLinks(composed.lifts?.filter((lift) => !liftNeedsPower(lift.id, switches))), composed.width),
  ]);
  const walks: GridLinks = new Map([...walksOut, ...linkTable(liftLinks(composed.lifts), composed.width)]);
  // A raid has to be leavable by a player who brought no Pokemon that knows Cut
  // or Surf, so the way out is walked with every door shut; what is behind a
  // door is still somewhere a map is for, so reaching it is walked with them open.
  const fromDropIn = file.dropIns.map((dropIn) => ({
    dropIn,
    steps: stepDistances(collision, onGrid(dropIn), shut, walksOut),
    opened: stepDistances(openCollision, onGrid(dropIn), pushedAside, walks),
    ground: stepDistances(collision, onGrid(dropIn), shut, links),
  }));
  const stepsTo = (steps: readonly Int32Array[], placed: MapFileSpot): number => {
    const spot = onGrid(placed);
    // A spot is reached by reaching any walkable tile beside it, then one step.
    if (exitTiles.has(at(spot))) {
      const beside = [
        { x: spot.x + 1, y: spot.y },
        { x: spot.x - 1, y: spot.y },
        { x: spot.x, y: spot.y + 1 },
        { x: spot.x, y: spot.y - 1 },
      ]
        .map((tile) => steps[tile.y]?.[tile.x] ?? -1)
        .filter((distance) => distance >= 0);
      return beside.length > 0 ? Math.min(...beside) + 1 : -1;
    }
    return steps[spot.y]?.[spot.x] ?? -1;
  };

  /** The soonest an exit can be left by from where a walk began, in ms; Infinity for never. */
  const soonestOut = (steps: readonly Int32Array[]): number =>
    Math.min(
      ...file.exits.map((exit) => {
        // A buried exit and a locked one are a way out only for a raid that
        // brought the Pickaxe or found the card, so neither is the way out -
        // and one a landmark opens is a way out only once it is worked, so a
        // drop-in is never held to it either.
        if (isBarredFileExit(exit) || exit.opens.when === 'landmark') {
          return Infinity;
        }
        const walk = stepsTo(steps, exit);
        if (walk < 0) {
          return Infinity;
        }
        const opensAtMs = exit.opens.when === 'after' ? exit.opens.seconds * 1_000 : 0;
        return Math.max(walk * STEP_DURATION_MS, opensAtMs);
      }),
    );
  const barred = [
    ...(file.exits.some((exit) => exit.opens.when === 'dug') ? ['a Pickaxe'] : []),
    ...(file.exits.some((exit) => exit.opens.when === 'key') ? ['the Card Key'] : []),
  ];
  const without = barred.length > 0 ? ` without ${barred.join(' or ')}` : '';
  const wayOut = fromDropIn.flatMap(({ dropIn, steps }) => {
    const best = soonestOut(steps);
    if (best === Infinity) {
      return [
        fault(
          `${kindAndName('Drop-in', dropIn.name)} cannot walk to any exit${without}.`,
          {
            group: 'drop-ins',
            says: `cannot walk to any exit${without}`,
          },
          dropIn,
        ),
      ];
    }
    // An exit opens at most `maxExitDelaySeconds` in, inside the clock, so
    // the walk is always what is too long: the fix is an exit nearer, never
    // one that opens sooner (playtest 39 B12).
    return best > RAID_DURATION_MS
      ? [
          fault(
            `${kindAndName('Drop-in', dropIn.name)} cannot reach an exit before the ${RAID_MINUTES}-minute raid clock runs out. Move an exit closer to it.`,
            { group: 'drop-ins', says: `cannot reach an exit before the ${RAID_MINUTES}-minute raid clock runs out` },
            dropIn,
          ),
        ]
      : [];
  });
  // A hop is one way, so wherever it puts the player down has to have a way
  // out of its own: a ledge into a pocket with no exit is a raid that can only
  // end on the clock. Every ledge in FireRed drops onto a road that goes on.
  // Only a hop somebody can stand at the brow of is asked about: a ledge on
  // ground no drop-in reaches is never hopped, and a door is opened to reach it.
  const hopped = hops.filter((hop) =>
    fromDropIn.some(({ opened }) => (opened[hop.from.y]?.[hop.from.x] ?? -1) >= 0),
  );
  const hopLandings = new Map(hopped.map((hop) => [at(hop.to), hop]));
  const strandedHops = [...hopLandings.values()]
    .filter((hop) => !shut.has(at(hop.to)))
    .filter((hop) => soonestOut(stepDistances(collision, hop.to, shut, walksOut)) === Infinity)
    .map((hop) =>
      fault(
        `The ledge at ${at(hop.ledge)} drops where no exit can be walked to.`,
        { group: 'ledges', says: 'drop where no exit can be walked to' },
        hop.ledge,
        hop.landing,
      ),
    );
  // One ledge says so once, however many of its tiles land in the pocket.
  const wayOutProblems = [
    ...wayOut,
    ...strandedHops.filter(
      (hop, index) => strandedHops.findIndex((other) => other.text === hop.text) === index,
    ),
  ];

  const reachable = [
    ...file.exits.map((spot) => ({ spot, what: kindAndName('Exit', spot.name), group: 'exits' })),
    ...file.itemSpots.map((spot, index) => ({
      spot,
      what: `Item spot ${index + 1}`,
      group: 'item spots',
    })),
    ...landmarks.map((spot) => ({
      spot,
      what: kindAndName('Landmark', spot.name),
      group: 'landmarks',
    })),
  ]
    .filter(({ spot }) => walkable(spot))
    .filter(({ spot }) => fromDropIn.every(({ opened }) => stepsTo(opened, spot) < 0))
    .map(({ spot, what, group }) =>
      fault(
        `${what} at ${tileOf(spot)} cannot be walked to from any drop-in.`,
        { group, says: 'cannot be walked to from any drop-in' },
        spot,
      ),
    );
  // A gate locked to the Card Key and the spot the card lies on come as a
  // pair: a lock with nowhere its card lies is a wall, and a card with no lock
  // is a key to nothing.
  const lockedExits = file.exits.filter((exit) => exit.opens.when === 'key');
  // A door locked to the card is a lock too (`MapFileSwitch`, a `key`).
  const lockedDoors = (file.areas ?? []).flatMap((area) =>
    (area.switches ?? []).filter((spot) => spot.kind === 'key').map((spot) => ({ ...spot, area: area.id })),
  );
  const keySpots = file.itemSpots.filter((spot) => spot.key);
  reachable.push(
    ...(keySpots.length === 0
      ? [
          ...lockedExits.map((exit) =>
            fault(
              `${kindAndName('Exit', exit.name)} at ${tileOf(exit)} is locked to the Card Key, and no item spot holds one.`,
              { group: 'exits', says: 'is locked to a Card Key nothing holds' },
              exit,
            ),
          ),
          ...lockedDoors.map((door) =>
            fault(
              `The door at ${tileOf(door)} is locked to the Card Key, and no item spot holds one.`,
              { group: 'barriers', says: 'is locked to a Card Key nothing holds' },
              door,
            ),
          ),
        ]
      : []),
    ...(lockedExits.length === 0 && lockedDoors.length === 0
      ? keySpots.map((spot) =>
          fault(
            `Item spot ${file.itemSpots.indexOf(spot) + 1} at ${tileOf(spot)} holds a Card Key no exit or door is locked to.`,
            { group: 'item spots', says: 'holds a Card Key no exit or door is locked to' },
            spot,
          ),
        )
      : []),
  );

  // An inside is walked into when any tile of it can be walked to. Drop-ins
  // that cannot leave are already a problem above, so a map with none says
  // nothing here.
  const areas =
    file.dropIns.length === 0
      ? []
      : composed.areas.slice(1).flatMap((placed) => {
          const { rect } = placed;
          const reached = fromDropIn.some(({ opened: steps }) => {
            for (let y = rect.y; y < rect.y + rect.height; y += 1) {
              for (let x = rect.x; x < rect.x + rect.width; x += 1) {
                if ((steps[y]?.[x] ?? -1) >= 0) {
                  return true;
                }
              }
            }
            return false;
          });
          // Its ways in, from wherever they are: the door a maker would mend.
          const ways = fileLinks.flatMap((link) =>
            link.ends.flatMap((end, index) =>
              end.area === placed.id && link.ends[1 - index].area !== placed.id
                ? [link.ends[1 - index]]
                : [],
            ),
          );
          return reached
            ? []
            : [
                fault(
                  `${placed.name} cannot be walked into from any drop-in.`,
                  { group: 'insides', says: 'cannot be walked into from any drop-in' },
                  ...ways,
                ),
              ];
        });

  // The hunter arrives exactly this many steps from the player, never closer
  // (`findHunterSpawnTile`), so a drop-in with no ground that far out is a raid
  // the hunter can never join. A maker has never been told that rule, so the
  // problem says it and what to do (playtest 39 B9).
  const boxedIn = `the hunter arrives ${HUNTER_SPAWN_DISTANCE} steps away and has nowhere to stand`;
  const hunterRoom = fromDropIn
    .filter(({ dropIn }) => walkable(dropIn))
    .filter(({ ground }) => !ground.some((row) => row.includes(HUNTER_SPAWN_DISTANCE)))
    .map(({ dropIn }) =>
      fault(
        `${kindAndName('Drop-in', dropIn.name)} is too boxed in: ${boxedIn}. Open up more ground around it.`,
        { group: 'drop-ins', says: `are too boxed in: ${boxedIn}` },
        dropIn,
      ),
    );

  // Each end by its own name, so the fault says which one a trainer sees
  // rather than "a drop-in or an exit" (playtest 39 B10).
  const ends = new Map([
    ...file.dropIns.map((spot) => [at(onGrid(spot)), { spot, what: kindAndName('Drop-in', spot.name) }] as const),
    ...file.exits.map((spot) => [at(onGrid(spot)), { spot, what: kindAndName('Exit', spot.name) }] as const),
  ]);
  const watch = trainers.flatMap((trainer) => {
    const seen = trainerSightTiles(
      { position: onGrid(trainer), facing: trainer.facing, sightRange: trainer.sight },
      (tile) => isBlockedAt(collision, tile.x, tile.y),
    );
    const seenEnds = seen.flatMap((tile) => {
      const end = ends.get(at(tile));
      return end ? [end] : [];
    });
    const seenLandings = seen.flatMap((tile) => {
      const hop = hopLandings.get(at(tile));
      return hop ? [hop.landing] : [];
    });
    return [
      ...(seenEnds.length > 0
        ? [
            fault(
              `${kindAndName('Trainer', trainer.name)} can see ${seenEnds.map((end) => end.what).join(' and ')}. Turn them, or watch less far.`,
              { group: 'trainers', says: 'can see a drop-in or an exit' },
              trainer,
              ...seenEnds.map((end) => end.spot),
            ),
          ]
        : []),
      // A hop is a step taken to get away, so it never lands in a fight.
      ...(seenLandings.length > 0
        ? [
            fault(
              `${kindAndName('Trainer', trainer.name)} can see where a ledge lands. Turn them, or watch less far.`,
              { group: 'trainers', says: 'can see where a ledge lands' },
              trainer,
              ...seenLandings,
            ),
          ]
        : []),
    ];
  });

  // A refusal names the field a word is in and never quotes the word (the
  // filter's list stays private), and a thing whose *name* is refused is
  // called by its number, because its name is the very word being refused
  // (playtest 39 B7: "Trainer Dick says something the game will not show"
  // left a maker guessing whether the name or a line was at fault).
  const lineFields = (lines: readonly string[]) =>
    lines.map((text, index) => ({ field: `line ${index + 1}`, text }));
  const said: {
    who: string;
    numbered: string;
    at?: MapFileSpot;
    fields: { field: string; text: string }[];
  }[] = [
    { who: 'The map', numbered: 'The map', fields: [{ field: 'its name', text: file.name }] },
    { who: 'The map', numbered: 'The map', fields: [{ field: "its maker's name", text: file.maker }] },
    ...file.dropIns.map((spot, index) => ({
      who: kindAndName('Drop-in', spot.name),
      numbered: `Drop-in ${index + 1}`,
      at: spot,
      fields: [
        { field: 'its name', text: spot.name },
        { field: 'its description', text: spot.description ?? '' },
      ],
    })),
    ...file.exits.map((spot, index) => ({
      who: kindAndName('Exit', spot.name),
      numbered: `Exit ${index + 1}`,
      at: spot,
      fields: [{ field: 'its name', text: spot.name }],
    })),
    ...landmarks.map((spot, index) => ({
      who: kindAndName('Landmark', spot.name),
      numbered: `Landmark ${index + 1}`,
      at: spot,
      fields: [{ field: 'its name', text: spot.name }],
    })),
    ...people.map((spot, index) => ({
      who: spot.name,
      numbered: `Person ${index + 1}`,
      at: spot,
      fields: [{ field: 'their name', text: spot.name }, ...lineFields(spot.lines)],
    })),
    ...signs.map((spot, index) => ({
      who: `Sign ${index + 1}`,
      numbered: `Sign ${index + 1}`,
      at: spot,
      fields: lineFields(spot.lines),
    })),
    ...trainers.map((spot, index) => ({
      who: kindAndName('Trainer', spot.name),
      numbered: `Trainer ${index + 1}`,
      at: spot,
      fields: [{ field: 'their name', text: spot.name }, ...lineFields(spot.lines)],
    })),
    ...(file.districts ?? []).map((district, index) => ({
      who: `District ${district.name}`,
      numbered: `District ${index + 1}`,
      at: district,
      fields: [{ field: 'its name', text: district.name }],
    })),
    ...(file.areas ?? []).map((area, index) => ({
      who: `The inside ${area.name}`,
      numbered: `Inside ${index + 1}`,
      fields: [{ field: 'its name', text: area.name }],
    })),
    ...fileLinks
      .flatMap((link) => (link.sails ? [{ sails: link.sails, at: link.ends[0] }] : []))
      .map(({ sails, at: place }, index) => ({
        who: `The boat ${sails.name}`,
        numbered: `Boat ${index + 1}`,
        at: place,
        fields: [{ field: 'its name', text: sails.name }],
      })),
  ];
  const words = said
    .map((thing) => ({
      ...thing,
      refused: thing.fields.filter(({ text }) => refusedWords(text).length > 0),
    }))
    .filter(({ refused }) => refused.length > 0)
    .map(({ who, numbered, at: place, refused }) => {
      const nameRefused = refused.some(({ field }) => field.endsWith('name'));
      const fields = refused.map(({ field }) => field);
      const listed =
        fields.length === 1
          ? fields[0]
          : `${fields.slice(0, -1).join(', ')} and ${fields[fields.length - 1]}`;
      const subject = `${nameRefused ? numbered : who}: ${listed}`;
      return fault(
        `${subject[0].toUpperCase()}${subject.slice(1)} ${fields.length === 1 ? 'uses a word' : 'use words'} the game does not show. Change ${fields.length === 1 ? 'it' : 'them'}.`,
        { group: 'names and lines', says: 'use a word the game does not show' },
        ...(place ? [place] : []),
      );
    })

  // The two checks about insides are only asked of a map that has one: a
  // tick against "every door leads somewhere" on a map with no doors says
  // nothing, and every line on that list is one a maker reads.
  const hasInsides =
    (file.areas ?? []).length > 0 ||
    fileLinks.length > 0 ||
    file.buildings.some((building) => building.kind === 'cave-mouth');
  return [
    check('loads', []),
    check('standing', standing),
    check('apart', apart),
    ...(hasInsides ? [check('doors', doors)] : []),
    check('way-out', wayOutProblems),
    check('reachable', reachable),
    ...(hasInsides ? [check('areas', areas)] : []),
    check('hunter-room', hunterRoom),
    check('watch', watch),
    check('words', words),
  ];
}

/** Whether every check passed. */
export function mapFileWorks(value: unknown): boolean {
  return checkMapFile(value).every((check) => check.passed);
}
